// The whole 3D scene: lights, floor, pads, kicker, tilted wall with its holds, camera controls and effects.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import CameraRig from './CameraRig'
// Explicit extension: on case-insensitive filesystems './Hold3D' would resolve to hold3d.js
import Hold3D from './Hold3D.jsx'
import { SupportPosts, WallBoard } from './WallBoard'
import { KICKER, SCENE_BG, THICKNESS, wallPoint } from './sceneLayout'

export default function Scene({ holds, tilt, view, focusRole, autoRotate, onInteract, background = SCENE_BG, interactive = true, lite = false, layout }) {
  const { width, height, toWallX, toWallY, rows, cols } = layout
  const tiltGroup = useRef()
  const [hovered, setHovered] = useState(null)
  const lean = Math.sin(Math.max(tilt, 0))
  const padDepth = 3 + 7 * lean
  const center = wallPoint(tilt, height / 2)

  // Bottom holds appear first, like a climber reading the route from the ground
  const order = useMemo(() => {
    const sorted = [...holds].sort((a, b) => b.gridRow - a.gridRow || a.gridCol - b.gridCol)
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
        <boxGeometry args={[width, KICKER, THICKNESS]} />
        <meshStandardMaterial color="#3b3f44" roughness={0.8} />
      </mesh>

      <SupportPosts tilt={tilt} width={width} height={height} />

      {/* Tilted around the X axis at the wall's bottom edge: positive leans toward the climber */}
      <group ref={tiltGroup} position={[0, KICKER, 0]}>
        <group position={[0, height / 2, 0]}>
          <WallBoard width={width} height={height} toWallX={toWallX} toWallY={toWallY} rows={rows} cols={cols} />
          {holds.map((hold) => {
            const key = `${hold.gridRow}-${hold.gridCol}`
            return (
              <Hold3D
                key={key}
                hold={hold}
                order={order.get(hold)}
                hovered={hovered === key}
                dimmed={Boolean(focusRole) && hold.role !== focusRole}
                onHover={(target) => setHovered(target ? `${target.gridRow}-${target.gridCol}` : null)}
                toWallX={toWallX}
                toWallY={toWallY}
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
