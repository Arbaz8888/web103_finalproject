// Glides the camera to its home view and hands control back to the viewer on any drag or zoom.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Glides the camera to its home view. Any drag or zoom hands control back to the viewer.
export default function CameraRig({ view, onInteract }) {
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
