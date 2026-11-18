import { useEffect, useState } from 'react'
import { getOptions } from '../../api/options'
import { getWallTypes } from '../../api/wallTypes'
import { getHolds } from '../../api/holds'
import { CatalogContext } from '../../hooks/useCatalog'

function CatalogProvider({ children }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', catalog: null, error: '' })

  useEffect(() => {
    let cancelled = false
    Promise.all([getOptions(), getWallTypes(), getHolds()])
      .then(([options, wallTypes, holds]) => {
        if (cancelled) return
        setState({ status: 'ready', catalog: { ...options, wallTypes, holds }, error: '' })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ status: 'error', catalog: null, error: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  function retry() {
    setState({ status: 'loading', catalog: null, error: '' })
    setAttempt((n) => n + 1)
  }

  if (state.status === 'loading') {
    return <div className="skeleton skeleton-page" aria-busy="true" aria-label="Loading" />
  }

  if (state.status === 'error') {
    return (
      <section className="empty-state" role="alert">
        <p className="eyebrow">ERROR</p>
        <h1>Couldn't load the wall.</h1>
        <p className="lede">{state.error}</p>
        <button className="button button-primary" type="button" onClick={retry}>Try again</button>
      </section>
    )
  }

  return (
    <CatalogContext.Provider value={state.catalog}>
      {children}
    </CatalogContext.Provider>
  )
}

export default CatalogProvider
