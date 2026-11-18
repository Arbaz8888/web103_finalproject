// The physical wall: plywood board with bolt holes and framing, plus the steel support posts.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { CEILING, THICKNESS, wallPoint } from './sceneLayout'
import { getWallTextures } from './hold3d'

// Every bolt hole, drawn as one instanced mesh
function Bolts({ rows, cols, toWallX, toWallY }) {
  const mesh = useMemo(() => {
    const geometry = new THREE.CircleGeometry(0.022, 16)
    const material = new THREE.MeshStandardMaterial({ color: '#3a362f', roughness: 0.5, metalness: 0.4 })
    const instanced = new THREE.InstancedMesh(geometry, material, rows * cols)
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < rows * cols; i++) {
      matrix.setPosition(toWallX(i % cols), toWallY(Math.floor(i / cols)), 0.002)
      instanced.setMatrixAt(i, matrix)
    }
    instanced.receiveShadow = true
    return instanced
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols])

  useEffect(() => () => {
    mesh.geometry.dispose()
    mesh.material.dispose()
  }, [mesh])

  return <primitive object={mesh} />
}

// The plywood board: textured paint on the face, veneer layers on the edges, framing behind
export function WallBoard({ width, height, toWallX, toWallY, rows, cols }) {
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

  const studs = [-(width / 2 - 0.05), -width / 6, width / 6, width / 2 - 0.05]
  const rails = [-height / 2 + 0.05, 0, height / 2 - 0.05]
  const frameZ = -THICKNESS - 0.14

  return (
    <group>
      <mesh position={[0, 0, -THICKNESS / 2]} material={materials} castShadow receiveShadow>
        <boxGeometry args={[width, height, THICKNESS]} />
      </mesh>
      {studs.map((x) => (
        <mesh key={`stud${x}`} position={[x, 0, frameZ]} castShadow>
          <boxGeometry args={[0.09, height, 0.28]} />
          <meshStandardMaterial color="#c49a63" roughness={0.85} />
        </mesh>
      ))}
      {rails.map((y) => (
        <mesh key={`rail${y}`} position={[0, y, frameZ]} castShadow>
          <boxGeometry args={[width - 0.1, 0.09, 0.28]} />
          <meshStandardMaterial color="#c49a63" roughness={0.85} />
        </mesh>
      ))}
      <Bolts rows={rows} cols={cols} toWallX={toWallX} toWallY={toWallY} />
    </group>
  )
}

// Steel posts at the top back corners. A slab is propped up from the floor behind it;
// an overhang or roof hangs from the ceiling, so its posts run up out of frame.
export function SupportPosts({ tilt, width, height }) {
  if (Math.abs(tilt) < 0.03) return null
  const [, topY, topZ] = wallPoint(tilt, height - 0.1, -(THICKNESS + 0.21))
  const [bottom, top] = tilt < 0 ? [0, topY] : [topY, CEILING]
  const postX = width / 2 - 0.2
  return [-postX, postX].map((x) => (
    <mesh key={x} position={[x, (bottom + top) / 2, topZ]} castShadow>
      <boxGeometry args={[0.14, top - bottom, 0.14]} />
      <meshStandardMaterial color="#3a3f45" roughness={0.6} metalness={0.5} />
    </mesh>
  ))
}
