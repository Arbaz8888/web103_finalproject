// 3D view of a climbing wall. Grid dimensions come from the catalog.
// Renders the canvas plus the overlay: angle chip, view tools and the role highlight legend.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { describeRole } from '../../../utils/display'
import { formatLabel } from '../../../utils/format'
import { useCatalog } from '../../../hooks/useCatalog'
import AngleGlyph from '../AngleGlyph'
import Scene from './Scene'
import { createWallLayout, getViews, SCENE_BG, SHOWCASE_BG } from './sceneLayout'
import './Wall3DComponent.css'

const ICONS = {
  home: 'M4 11.5 12 5l8 6.5M6.5 10v9h11v-9',
  rotate: 'M4 12a8 8 0 0 1 13.66-5.66L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.66 5.66L4 15.3M4 20v-4.7h4.7',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
}
const Icon = ({ path }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={path} />
  </svg>
)


const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// showcase: a hands-off, slowly turning wall with no controls, used as the homepage backdrop
function Wall3DComponent({ holds = [], angle = 0, wallType, showcase = false }) {
  const container = useRef()
  const [visible, setVisible] = useState(true)
  const [recenter, setRecenter] = useState(0)
  const { holdRoles, gridRows, gridCols } = useCatalog()
  const [focusRole, setFocusRole] = useState(null)
  const [autoRotate, setAutoRotate] = useState(() => showcase && !prefersReducedMotion())
  const [interacted, setInteracted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const safeAngle = Math.max(-90, Math.min(90, angle ?? 0))
  const tilt = THREE.MathUtils.degToRad(safeAngle)
  // Derive layout from catalog so the 3D scene matches the 2D grid
  const layout = useMemo(() => ({ ...createWallLayout(gridRows, gridCols), rows: gridRows, cols: gridCols }), [gridRows, gridCols])
  const views = useMemo(() => getViews(tilt, layout.height), [tilt, layout.height])
  // A new object on every "reset view" click, so the camera glides home again
  const view = useMemo(() => ({ ...views.home, recenter }), [views, recenter])
  const name = wallType ? formatLabel(wallType) : 'Wall'
  // Roles used on this wall, in the backend's order, for the highlight buttons
  const usedRoles = holdRoles.filter((role) => holds.some((hold) => hold.role === role)).map(describeRole)
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
    <div
      className={`wall-3d${showcase ? ' wall-3d-showcase' : ''}`}
      ref={container}
      style={{ '--grid-cols': gridCols, '--grid-rows': gridRows }}
    >
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
          layout={layout}
        />
      </Canvas>

      {!showcase && (
      <>

      <div className="w3d-top">
        <div className="w3d-chip">
          <AngleGlyph angle={safeAngle} className="w3d-glyph" />
          <div>
            <strong>{name}</strong>
            <span>{safeAngle}°</span>
          </div>
        </div>
        <div className="w3d-tools">
          <button
            type="button"
            className="w3d-icon"
            aria-label="Reset view"
            title="Reset view"
            onClick={() => setRecenter((count) => count + 1)}
          >
            <Icon path={ICONS.home} />
          </button>
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
          {usedRoles.map((role) => (
            <button
              key={role.id}
              type="button"
              aria-pressed={focusRole === role.id}
              className={focusRole && focusRole !== role.id ? 'muted' : ''}
              onClick={() => setFocusRole((current) => (current === role.id ? null : role.id))}
            >
              <i style={{ background: role.color, boxShadow: `0 0 8px ${role.color}` }} />
              {role.label}
            </button>
          ))}
        </div>
        <p className={`w3d-hint${interacted ? ' hidden' : ''}`}>Drag to rotate · Scroll to zoom · Hover a hold</p>
      </div>
      </>
      )}
    </div>
  )
}

export default Wall3DComponent
