import { useEffect, useState } from 'react'
import { supportsWebGL } from '../../utils/webgl'
import WallComponent from './WallComponent'
import Wall3DLazy from './Wall3DLazy'

// The homepage hero wall. The 3D showcase is heavy (three.js), so it loads once the browser is idle,
// behind a same-size placeholder. Reduced motion, data saver or no WebGL get the 2D wall instead.
function HeroWall({ route }) {
  const [prefers2D] = useState(
    () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      navigator.connection?.saveData === true ||
      !supportsWebGL(),
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (prefers2D) return
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(() => setReady(true))
      return () => cancelIdleCallback(handle)
    }
    const handle = setTimeout(() => setReady(true), 200)
    return () => clearTimeout(handle)
  }, [prefers2D])

  if (prefers2D) {
    return <WallComponent holds={route.holds} size="lg" wallType={route.wallType} angle={route.angleDegrees} />
  }
  if (!ready) return <div className="wall-3d wall-3d-showcase wall-3d-loading" />
  return (
    <Wall3DLazy
      key={route.id}
      holds={route.holds}
      angle={route.angleDegrees}
      wallType={route.wallType}
      showcase
      fallbackClassName="wall-3d-showcase"
    />
  )
}

export default HeroWall
