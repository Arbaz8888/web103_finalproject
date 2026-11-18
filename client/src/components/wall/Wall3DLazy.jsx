import { lazy, Suspense } from 'react'
import { useCatalog } from '../../hooks/useCatalog'
import './Wall3DLazy.css'

// three.js is large, so it only downloads the first time a 3D wall is shown
const Wall3DComponent = lazy(() => import('./three/Wall3DComponent'))

function Wall3DLazy({ fallbackClassName = '', ...props }) {
  const { gridRows, gridCols } = useCatalog()
  const gridVars = { '--grid-cols': gridCols, '--grid-rows': gridRows }
  return (
    <Suspense fallback={<div className={`wall-3d wall-3d-loading ${fallbackClassName}`} style={gridVars}>Loading 3D wall…</div>}>
      <Wall3DComponent {...props} />
    </Suspense>
  )
}

export default Wall3DLazy
