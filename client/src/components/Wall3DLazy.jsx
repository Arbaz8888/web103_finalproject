import { lazy, Suspense } from 'react'
import './Wall3DLazy.css'

// three.js is large, so it only downloads the first time a 3D wall is shown
const Wall3DComponent = lazy(() => import('./Wall3DComponent'))

function Wall3DLazy({ fallbackClassName = '', ...props }) {
  return (
    <Suspense fallback={<div className={`wall-3d wall-3d-loading ${fallbackClassName}`}>Loading 3D wall…</div>}>
      <Wall3DComponent {...props} />
    </Suspense>
  )
}

export default Wall3DLazy
