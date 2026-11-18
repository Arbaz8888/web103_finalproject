import { useEffect, useState } from 'react'
import { getRoute } from '../api/routes'

// Fetches one route from the backend by id, so a route page always shows the saved version.
// status: 'loading' | 'ready' | 'missing' | 'error'
export function useRoute(id) {
  const [state, setState] = useState({ id, status: 'loading', route: null, error: '' })

  useEffect(() => {
    let cancelled = false
    getRoute(id)
      .then((route) => !cancelled && setState({ id, status: 'ready', route, error: '' }))
      .catch((err) => {
        if (cancelled) return
        const missing = err.status === 404
        setState({ id, status: missing ? 'missing' : 'error', route: null, error: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // While a new id loads, don't show the previous route
  return state.id === id ? state : { id, status: 'loading', route: null, error: '' }
}
