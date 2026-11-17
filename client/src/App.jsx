import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ToastProvider from './components/ui/ToastProvider'
import * as api from './api/routes'
import { getOptions } from './api/options'
import { getWallTypes } from './api/wallTypes'
import { CatalogContext } from './hooks/useCatalog'
import EditRoutePage from './pages/EditRoutePage'
import RouteBuilderPage from './pages/RouteBuilderPage'
import RouteDetailsPage from './pages/RouteDetailsPage'
import RouteGalleryPage from './pages/RouteGalleryPage'
import NotFoundPage from './pages/NotFoundPage'
import { usePointerGlow } from './hooks/usePointerGlow'

// Jump back to the top whenever the page changes
function ScrollToTop() {
  const { pathname } = useLocation()
  // Braces matter: newer browsers return a Promise from scrollTo, and an effect may only return a cleanup function
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function GallerySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading routes">
      <div className="skeleton skeleton-hero" />
      <div className="route-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton skeleton-card" key={index} />
        ))}
      </div>
    </div>
  )
}

function App() {
  usePointerGlow()
  const [routes, setRoutes] = useState([])
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Routes plus everything the backend allows (grades, roles, hold types/sizes, wall types)
  const fetchAll = useCallback(() => {
    Promise.all([api.getRoutes(), getOptions(), getWallTypes()])
      .then(([routeList, options, wallTypes]) => {
        setRoutes(routeList)
        setCatalog({ ...options, wallTypes })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  function retry() {
    setLoading(true)
    setError('')
    fetchAll()
  }

  // After any change, reload the list from the backend instead of patching a local copy
  const refreshRoutes = async () => setRoutes(await api.getRoutes())

  // Returns the saved route so pages can navigate to it. Errors bubble up to RouteForm.
  async function saveRoute(route) {
    const saved = route.id ? await api.updateRoute(route) : await api.createRoute(route)
    await refreshRoutes()
    return saved
  }

  async function deleteRoute(id) {
    await api.deleteRoute(id)
    await refreshRoutes()
  }

  async function resetRoutes() {
    await api.resetRoutes()
    await refreshRoutes()
  }

  return (
    <BrowserRouter>
      <CatalogContext.Provider value={catalog}>
      <ToastProvider>
        <ScrollToTop />
        <a className="skip-link" href="#main">Skip to content</a>
        <Navbar routeCount={loading ? null : routes.length} />
        <main className="page-shell" id="main">
          {loading ? (
            <GallerySkeleton />
          ) : error ? (
            <section className="empty-state" role="alert">
              <p className="eyebrow">ERROR</p>
              <h1>Couldn't load routes.</h1>
              <p className="lede">{error}</p>
              <button className="button button-primary" type="button" onClick={retry}>Try again</button>
            </section>
          ) : (
            <Routes>
              <Route path="/" element={<RouteGalleryPage routes={routes} onReset={resetRoutes} />} />
              <Route path="/routes/new" element={<RouteBuilderPage routes={routes} onSave={saveRoute} />} />
              <Route path="/routes/:id" element={<RouteDetailsPage onDelete={deleteRoute} />} />
              <Route path="/routes/:id/edit" element={<EditRoutePage onSave={saveRoute} />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          )}
        </main>
        <footer className="site-footer">
          <span><span className="brand-mark" aria-hidden="true">◈</span> Crux Maker</span>
          <span>Build bouldering routes on a virtual wall.</span>
        </footer>
      </ToastProvider>
      </CatalogContext.Provider>
    </BrowserRouter>
  )
}

export default App
