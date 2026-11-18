import { useEffect, useState } from 'react'
import { getRoutes } from '../api/routes'

// Owns the gallery route list: loading, error and reload are handled here.
// setRoutes accepts an updater function or a new array.
export function useRouteList() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', routes: [], error: '' })

  useEffect(() => {
    let cancelled = false
    getRoutes()
      .then((routes) => {
        if (cancelled) return
        setState({ status: 'ready', routes, error: '' })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ status: 'error', routes: [], error: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  function reload() {
    setState((current) => ({ ...current, status: 'loading' }))
    setAttempt((n) => n + 1)
  }

  function setRoutes(updater) {
    setState((current) => ({
      ...current,
      routes: typeof updater === 'function' ? updater(current.routes) : updater,
    }))
  }

  return { status: state.status, routes: state.routes, error: state.error, reload, setRoutes }
}
