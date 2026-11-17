// 3D view of a climbing wall. Same 12 x 16 bolt grid as WallComponent, built as a
// 6 x 8 unit board (0.5 units per bolt), tilted to the route's wall angle and set in a
// small gym scene: kicker, crash pads, back framing, soft lighting and glowing role rings.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { getFootprintRadius, getHoldSize, HOLD_SCALE } from '../utils/holdFootprint'
import { getHoldColor, getHoldGeometry, getHoldType, getReadyRelief, getWallTextures, loadHoldRelief } from '../utils/hold3d'

const ROWS = 16
const COLS = 12
const CELL = 0.5
const WALL_WIDTH = COLS * CELL // 6
const WALL_HEIGHT = ROWS * CELL // 8
const THICKNESS = 0.18
const KICKER = 0.5 // the wall starts this far off the floor so pads don't hide the bottom row

// Same colors as the 2D glow and the legend dots in App.css
const ROLES = [
  { id: 'start', label: 'Start', color: '#eab308' },
  { id: 'hand', label: 'Hand', color: '#3b82f6' },
  { id: 'foot', label: 'Foot', color: '#16a34a' },
  { id: 'finish', label: 'Finish', color: '#dc2626' },
  { id: 'any', label: 'Any', color: '#f97316' },
]
const roleOf = (hold) => ROLES.find((role) => role.id === hold.role) ?? ROLES[4]

const SCENE_BG = '#14171a'
const SHOWCASE_BG = '#0c0e10' // matches the page background so the homepage scene fades into it
const VIEWS = [
  { id: 'angled', label: 'Angled' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'climber', label: 'Climber' },
]

// Grid cell -> point on the wall face, with the wall's center at the origin
const toWallX = (col) => (col - 5.5) * CELL
const toWallY = (row) => (7.5 - row) * CELL

// A point on the wall face (height up the wall, distance out from it) in world space
function wallPoint(tilt, up, out = 0) {
  return [0, KICKER + up * Math.cos(tilt) - out * Math.sin(tilt), up * Math.sin(tilt) + out * Math.cos(tilt)]
}

// Camera positions for each view, worked out from the tilt so steep walls stay in frame
function getViews(tilt) {
  const lean = Math.sin(Math.max(tilt, 0))
  const center = wallPoint(tilt, WALL_HEIGHT / 2)
  const atLeast = (y) => Math.max(y, 1.1)
  return {
    intro: { position: [12, center[1] + 5, center[2] + 20], target: center },
    angled: { position: [7.5, atLeast(center[1] + 1.5 - 2.5 * lean), center[2] + 13 + 3 * lean], target: center },
    front: { position: [0, atLeast(center[1] + 1 - 2.5 * lean), center[2] + 15.5 + 3 * lean], target: center },
    side: { position: [16, center[1] + 1.5, center[2] + 1.5], target: center },
    // Standing on the pads a few units off the face, looking up the line
    climber: { position: climberPoint(tilt), target: wallPoint(tilt, WALL_HEIGHT * 0.82) },
  }
}

function climberPoint(tilt) {
  const [, y, z] = wallPoint(tilt, WALL_HEIGHT * 0.3, 4.2)
  return [1.4, Math.max(y, 1.2), z]
}

const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2

// Glides the camera to the chosen view. Any drag or zoom hands control back to the viewer.
function CameraRig({ view, onInteract }) {
  const controls = useThree((state) => state.controls)
  const active = useRef(true)
  const goal = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3() }), [])

  useEffect(() => {
    active.current = true
  }, [view])

  useEffect(() => {
    if (!controls) return
    const stop = () => {
      active.current = false
      onInteract()
    }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls, onInteract])

  useFrame(({ camera, controls }, delta) => {
    // Keep the camera above the floor while still letting it look up at an overhang
    if (camera.position.y < 0.6) camera.position.y = 0.6
    if (!active.current || !controls) return
    goal.position.set(...view.position)
    goal.target.set(...view.target)
    const step = 1 - Math.exp(-3 * delta)
    camera.position.lerp(goal.position, step)
    controls.target.lerp(goal.target, step)
    controls.update()
    if (camera.position.distanceTo(goal.position) < 0.01 && controls.target.distanceTo(goal.target) < 0.01) {
      active.current = false
    }
  })

  return null
}

// Every bolt hole, drawn as one instanced mesh
function Bolts() {
  const mesh = useMemo(() => {
    const geometry = new THREE.CircleGeometry(0.022, 16)
    const material = new THREE.MeshStandardMaterial({ color: '#3a362f', roughness: 0.5, metalness: 0.4 })
    const instanced = new THREE.InstancedMesh(geometry, material, ROWS * COLS)
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < ROWS * COLS; i++) {
      matrix.setPosition(toWallX(i % COLS), toWallY(Math.floor(i / COLS)), 0.002)
      instanced.setMatrixAt(i, matrix)
    }
    instanced.receiveShadow = true
    return instanced
  }, [])

  useEffect(() => () => {
    mesh.geometry.dispose()
    mesh.material.dispose()
  }, [mesh])

  return <primitive object={mesh} />
}

// The plywood board: textured paint on the face, veneer layers on the edges, framing behind
function WallBoard() {
  const materials = useMemo(() => {
    const { face, edge } = getWallTextures()
    const edgeAcross = edge.clone()
    edgeAcross.center.set(0.5, 0.5)
    edgeAcross.rotation = Math.PI / 2
    const side = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.8 })
    const topBottom = new THREE.MeshStandardMaterial({ map: edgeAcross, roughness: 0.8 })
    const front = new THREE.MeshStandardMaterial({ map: face, roughness: 0.92 })
    const back = new THREE.MeshStandardMaterial({ color: '#b08a58', roughness: 0.85 })
    return [side, side, topBottom, topBottom, front, back]
  }, [])

  const studs = [-2.95, -1, 1, 2.95]
  const rails = [-WALL_HEIGHT / 2 + 0.05, 0, WALL_HEIGHT / 2 - 0.05]
  const frameZ = -THICKNESS - 0.14

  return (
    <group>
      <mesh position={[0, 0, -THICKNESS / 2]} material={materials} castShadow receiveShadow>
        <boxGeometry args={[WALL_WIDTH, WALL_HEIGHT, THICKNESS]} />
      </mesh>
      {studs.map((x) => (
        <mesh key={`stud${x}`} position={[x, 0, frameZ]} castShadow>
          <boxGeometry args={[0.09, WALL_HEIGHT, 0.28]} />
          <meshStandardMaterial color="#c49a63" roughness={0.85} />
        </mesh>
      ))}
      {rails.map((y) => (
        <mesh key={`rail${y}`} position={[0, y, frameZ]} castShadow>
          <boxGeometry args={[WALL_WIDTH - 0.1, 0.09, 0.28]} />
          <meshStandardMaterial color="#c49a63" roughness={0.85} />
        </mesh>
      ))}
      <Bolts />
    </group>
  )
}

// Steel posts at the top back corners. A slab is propped up from the floor behind it;
// an overhang or roof hangs from the ceiling, so its posts run up out of frame.
const CEILING = 16
function SupportPosts({ tilt }) {
  if (Math.abs(tilt) < 0.03) return null
  const [, topY, topZ] = wallPoint(tilt, WALL_HEIGHT - 0.1, -(THICKNESS + 0.21))
  const [bottom, top] = tilt < 0 ? [0, topY] : [topY, CEILING]
  return [-2.8, 2.8].map((x) => (
    <mesh key={x} position={[x, (bottom + top) / 2, topZ]} castShadow>
      <boxGeometry args={[0.14, top - bottom, 0.14]} />
      <meshStandardMaterial color="#3a3f45" roughness={0.6} metalness={0.5} />
    </mesh>
  ))
}

// How far each type of hold sticks out from the wall, as a fraction of its image width
const RELIEF_DEPTH = { jug: 0.34, sloper: 0.26, crimp: 0.2, pinch: 0.3, pocket: 0.28 }

// The 3D relief built from a hold's photo; undefined while it loads
function useHoldRelief(url) {
  const [failedUrl, setFailedUrl] = useState(null)
  const [, setLoadedUrl] = useState(null)

  useEffect(() => {
    if (!url || getReadyRelief(url)) return
    let cancelled = false
    loadHoldRelief(url)
      .then(() => !cancelled && setLoadedUrl(url))
      .catch(() => !cancelled && setFailedUrl(url))
    return () => {
      cancelled = true
    }
  }, [url])

  return { relief: url ? getReadyRelief(url) : undefined, failed: !url || failedUrl === url }
}

// One hold: its own photo raised into 3D, with a glowing ring for its role.
// Falls back to a generated shape in the hold's color if the photo can't load.
function Hold3D({ hold, order, hovered, dimmed, onHover }) {
  const pop = useRef()
  const start = useRef(null)
  const size = getHoldSize(hold)
  const type = getHoldType(hold)
  const paint = getHoldColor(hold)
  const role = roleOf(hold)
  const radius = getFootprintRadius(size) * CELL
  const imageSize = HOLD_SCALE[size] * CELL
  const { relief, failed } = useHoldRelief(hold.imageUrl)
  // CSS rotates clockwise; three.js rotates counterclockwise around Z
  const rotation = (-(hold.rotation ?? 0) * Math.PI) / 180
  const ringColor = useMemo(() => new THREE.Color(role.color).multiplyScalar(hovered ? 4.5 : 1.9), [role.color, hovered])

  // Holds pop on one by one from the floor up, after the wall has started to tilt
  useFrame((state) => {
    if (!pop.current) return
    if (start.current === null) start.current = state.clock.elapsedTime
    const progress = Math.min(Math.max((state.clock.elapsedTime - start.current - 0.5 - order * 0.05) / 0.45, 0), 1)
    const scale = progress === 0 ? 0.0001 : easeOutBack(progress) * (hovered ? 1.08 : 1)
    pop.current.scale.setScalar(scale)
  })

  const pointer = {
    onPointerOver: (event) => {
      event.stopPropagation()
      onHover(hold)
    },
    onPointerOut: () => onHover(null),
  }
  // Materials are keyed on `dimmed` so three.js rebuilds the shader when the hold switches to see-through
  const fadeKey = dimmed ? 'dimmed' : 'solid'
  const fade = { transparent: dimmed, opacity: dimmed ? 0.18 : 1, depthWrite: !dimmed }

  return (
    <group position={[toWallX(hold.col), toWallY(hold.row), 0]}>
      <group ref={pop} scale={0.0001}>
        {relief ? (
          <mesh
            geometry={relief.geometry}
            scale={[imageSize, imageSize, imageSize * (RELIEF_DEPTH[type] ?? 0.28)]}
            rotation={[0, 0, rotation]}
            position={[0, 0, 0.003]}
            castShadow={!dimmed}
            receiveShadow
            {...pointer}
          >
            <meshPhysicalMaterial
              key={fadeKey}
              {...fade}
              map={relief.texture}
              alphaTest={0.5}
              roughness={0.72}
              clearcoat={0.15}
              clearcoatRoughness={0.6}
              emissive="#ffffff"
              emissiveIntensity={hovered ? 0.12 : 0}
            />
          </mesh>
        ) : failed ? (
          <mesh
            geometry={getHoldGeometry(type, hold.holdId ?? 1)}
            scale={[radius, radius, radius]}
            rotation={[0, 0, rotation]}
            castShadow={!dimmed}
            receiveShadow
            {...pointer}
          >
            <meshPhysicalMaterial
              key={fadeKey}
              {...fade}
              color={paint.hex}
              roughness={0.5}
              clearcoat={0.35}
              clearcoatRoughness={0.45}
              bumpMap={getWallTextures().grit}
              bumpScale={1.2}
              emissive={paint.hex}
              emissiveIntensity={hovered ? 0.35 : 0}
            />
          </mesh>
        ) : null}
        {!dimmed && (
          <mesh position={[0, 0, 0.004]}>
            <ringGeometry args={[radius * 1.12, radius * 1.2, 64]} />
            <meshBasicMaterial color={ringColor} toneMapped={false} />
          </mesh>
        )}
      </group>
      {hovered && (
        <Html position={[0, radius + 0.12, 0.3]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="w3d-tip" role="status">
            <i style={{ background: role.color }} />
            <strong>{role.label}</strong>
            <span>{size} {paint.name} {type}</span>
          </div>
        </Html>
      )}
    </group>
  )
}

function Scene({ holds, tilt, view, focusRole, autoRotate, onInteract, background = SCENE_BG, interactive = true, lite = false }) {
  const tiltGroup = useRef()
  const [hovered, setHovered] = useState(null)
  const lean = Math.sin(Math.max(tilt, 0))
  const padDepth = 3 + 7 * lean
  const center = wallPoint(tilt, WALL_HEIGHT / 2)

  // Bottom holds appear first, like a climber reading the route from the ground
  const order = useMemo(() => {
    const sorted = [...holds].sort((a, b) => b.row - a.row || a.col - b.col)
    return new Map(sorted.map((hold, index) => [hold, index]))
  }, [holds])

  // The wall swings from vertical to its angle when the view opens
  useFrame((_, delta) => {
    if (tiltGroup.current) tiltGroup.current.rotation.x = THREE.MathUtils.damp(tiltGroup.current.rotation.x, tilt, 2.4, delta)
  })

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, 22, 48]} />

      {/* Warm bounce from the floor and pads lights the underside of overhangs and roofs */}
      <hemisphereLight args={['#dfe8ff', '#958d80', 0.9]} />
      <directionalLight
        position={[5, 13, 10]}
        intensity={2.2}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={12}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={45}
      />
      <directionalLight position={[-8, 5, 6]} intensity={0.45} color="#cfe0ff" />
      <directionalLight position={[0, 9, -8]} intensity={0.7} color="#9fb8ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[0, 7, 9]} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={1} position={[-9, 3, 3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#dbe7ff" />
        <Lightformer form="rect" intensity={0.8} position={[9, 3, 3]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#ffe1bd" />
        <Lightformer form="ring" intensity={1.5} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={4} />
      </Environment>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#1e2124" roughness={0.9} />
      </mesh>

      {/* Crash pads, deep enough to reach under the top of an overhang */}
      {[-2.6, 0, 2.6].map((x) => (
        <RoundedBox key={x} args={[2.55, 0.42, padDepth]} radius={0.09} smoothness={4} position={[x, 0.21, 0.2 + padDepth / 2]} castShadow receiveShadow>
          <meshStandardMaterial color="#26344c" roughness={0.95} />
        </RoundedBox>
      ))}

      {/* Kicker panel under the wall */}
      <mesh position={[0, KICKER / 2, -THICKNESS / 2]} castShadow receiveShadow>
        <boxGeometry args={[WALL_WIDTH, KICKER, THICKNESS]} />
        <meshStandardMaterial color="#3b3f44" roughness={0.8} />
      </mesh>

      <SupportPosts tilt={tilt} />

      {/* Tilted around the X axis at the wall's bottom edge: positive leans toward the climber */}
      <group ref={tiltGroup} position={[0, KICKER, 0]}>
        <group position={[0, WALL_HEIGHT / 2, 0]}>
          <WallBoard />
          {holds.map((hold) => {
            const key = `${hold.row}-${hold.col}`
            return (
              <Hold3D
                key={key}
                hold={hold}
                order={order.get(hold)}
                hovered={hovered === key}
                dimmed={Boolean(focusRole) && roleOf(hold).id !== focusRole}
                onHover={(target) => setHovered(target ? `${target.row}-${target.col}` : null)}
              />
            )
          })}
        </group>
      </group>

      <OrbitControls
        makeDefault
        enabled={interactive}
        target={center}
        enablePan={false}
        enableRotate={false}
        minDistance={2}
        maxDistance={28}
        maxPolarAngle={Math.PI * 0.9}
        autoRotate={autoRotate}
        autoRotateSpeed={0.7}
      />
      <CameraRig view={view} onInteract={onInteract} />

      <EffectComposer multisampling={4}>
        {/* Ambient occlusion is the priciest pass; the always-on homepage scene skips it */}
        {!lite && <N8AO halfRes aoRadius={0.5} intensity={2.2} distanceFalloff={0.6} />}
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.7} radius={0.5} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Vignette offset={0.32} darkness={0.6} />
      </EffectComposer>
    </>
  )
}

const ICONS = {
  rotate: 'M4 12a8 8 0 0 1 13.66-5.66L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.66 5.66L4 15.3M4 20v-4.7h4.7',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
}
const Icon = ({ path }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={path} />
  </svg>
)

// Little side-on sketch of the wall angle for the info chip
function AngleGlyph({ angle }) {
  const radians = (Math.max(-90, Math.min(90, angle)) * Math.PI) / 180
  return (
    <svg className="w3d-glyph" viewBox="0 0 28 24" aria-hidden="true">
      <line x1="2" y1="21" x2="26" y2="21" className="w3d-glyph-floor" />
      <line x1="9" y1="21" x2="9" y2="3" className="w3d-glyph-ref" />
      <line x1="9" y1="21" x2={9 + 17 * Math.sin(radians)} y2={21 - 17 * Math.cos(radians)} className="w3d-glyph-wall" />
    </svg>
  )
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// showcase: a hands-off, slowly turning wall with no controls, used as the homepage backdrop
function Wall3DComponent({ holds = [], angle = 0, wallType, showcase = false }) {
  const container = useRef()
  const [visible, setVisible] = useState(true)
  const [viewId, setViewId] = useState({ id: 'intro', nonce: 0 })
  const [focusRole, setFocusRole] = useState(null)
  const [autoRotate, setAutoRotate] = useState(() => showcase && !prefersReducedMotion())
  const [interacted, setInteracted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const safeAngle = Math.max(-90, Math.min(90, angle ?? 0))
  const tilt = THREE.MathUtils.degToRad(safeAngle)
  const views = useMemo(() => getViews(tilt), [tilt])
  // A new object on every click, so picking the same view again re-centers the camera
  const view = useMemo(() => ({ ...views[viewId.id === 'intro' ? 'angled' : viewId.id], nonce: viewId.nonce }), [views, viewId])
  const name = wallType ? wallType.charAt(0).toUpperCase() + wallType.slice(1).toLowerCase() : 'Wall'
  const counts = ROLES.map((role) => ({ ...role, count: holds.filter((hold) => roleOf(hold).id === role.id).length })).filter(
    (role) => role.count > 0,
  )
  const handleInteract = useCallback(() => setInteracted(true), [])

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === container.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  // Stop rendering while the canvas is scrolled out of view
  useEffect(() => {
    const element = container.current
    if (!element || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '100px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else container.current?.requestFullscreen?.()
  }

  return (
    <div className={`wall-3d${showcase ? ' wall-3d-showcase' : ''}`} ref={container}>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        shadows
        dpr={showcase ? [1, 1.5] : [1, 2]}
        camera={{ position: views.intro.position, fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: false }}
        aria-label={`3D view of a ${name.toLowerCase()} wall at ${safeAngle} degrees with ${holds.length} holds`}
        role="img"
      >
        <Scene
          holds={holds}
          tilt={tilt}
          view={view}
          focusRole={focusRole}
          autoRotate={autoRotate}
          onInteract={handleInteract}
          background={showcase ? SHOWCASE_BG : SCENE_BG}
          interactive={!showcase}
          lite={showcase}
        />
      </Canvas>

      {!showcase && (
      <>

      <div className="w3d-top">
        <div className="w3d-chip">
          <AngleGlyph angle={safeAngle} />
          <div>
            <strong>{name}</strong>
            <span>{safeAngle}°</span>
          </div>
        </div>
        <div className="w3d-tools">
          <div className="w3d-views" role="group" aria-label="Camera view">
            {VIEWS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={viewId.id === option.id || (viewId.id === 'intro' && option.id === 'angled') ? 'active' : ''}
                onClick={() => setViewId((current) => ({ id: option.id, nonce: current.nonce + 1 }))}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`w3d-icon${autoRotate ? ' active' : ''}`}
            aria-pressed={autoRotate}
            aria-label="Auto-rotate"
            title="Auto-rotate"
            onClick={() => setAutoRotate((on) => !on)}
          >
            <Icon path={ICONS.rotate} />
          </button>
          <button
            type="button"
            className="w3d-icon"
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            title={fullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={toggleFullscreen}
          >
            <Icon path={fullscreen ? ICONS.collapse : ICONS.expand} />
          </button>
        </div>
      </div>

      <div className="w3d-bottom">
        <div className="w3d-legend" role="group" aria-label="Highlight holds by role">
          {counts.map((role) => (
            <button
              key={role.id}
              type="button"
              aria-pressed={focusRole === role.id}
              className={focusRole && focusRole !== role.id ? 'muted' : ''}
              onClick={() => setFocusRole((current) => (current === role.id ? null : role.id))}
            >
              <i style={{ background: role.color, boxShadow: `0 0 8px ${role.color}` }} />
              {role.label}
              <b>{role.count}</b>
            </button>
          ))}
        </div>
        <p className={`w3d-hint${interacted ? ' hidden' : ''}`}>Scroll to zoom · Hover a hold</p>
      </div>
      </>
      )}
    </div>
  )
}

export default Wall3DComponent
