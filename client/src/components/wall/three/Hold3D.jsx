// One hold in 3D: its photo raised into relief with a glowing role ring, popping on from the floor up.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { getFootprintRadius, getHoldSize, HOLD_SCALE } from '../../../utils/holdFootprint'
import { describeRole } from '../../../utils/display'
import { CELL, easeOutBack } from './sceneLayout'
import { getHoldGeometry, getReadyRelief, getWallTextures, loadHoldRelief } from './hold3d'

// How far each type of hold sticks out from the wall, as a fraction of its image width
const RELIEF_DEPTH = { jug: 0.34, sloper: 0.26, crimp: 0.2, pinch: 0.3, pocket: 0.28 }
const DEFAULT_RELIEF_DEPTH = 0.28
const FALLBACK_HOLD_COLOR = '#8d939a' // only if a hold's photo fails to load

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
export default function Hold3D({ hold, order, hovered, dimmed, onHover, toWallX, toWallY }) {
  const pop = useRef()
  const start = useRef(null)
  const size = getHoldSize(hold)
  const type = hold.holdType
  const role = describeRole(hold.role)
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
    <group position={[toWallX(hold.gridCol), toWallY(hold.gridRow), 0]}>
      <group ref={pop} scale={0.0001}>
        {relief ? (
          <mesh
            geometry={relief.geometry}
            scale={[imageSize, imageSize, imageSize * (RELIEF_DEPTH[type] ?? DEFAULT_RELIEF_DEPTH)]}
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
              color={FALLBACK_HOLD_COLOR}
              roughness={0.5}
              clearcoat={0.35}
              clearcoatRoughness={0.45}
              bumpMap={getWallTextures().grit}
              bumpScale={1.2}
              emissive={FALLBACK_HOLD_COLOR}
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
            <span>{size} {hold.color} {type}</span>
          </div>
        </Html>
      )}
    </group>
  )
}
