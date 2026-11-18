import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import ToastProvider from './components/ui/ToastProvider'
import CatalogProvider from './components/providers/CatalogProvider'
import * as api from './api/routes'
import { useRouteList } from './hooks/useRouteList'
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

function App() {
  usePointerGlow()
  const routeList = useRouteList()

  // Returns the saved route so pages can navigate to it. Errors bubble up to RouteForm.
  async function saveRoute(route) {
    const saved = route.id ? await api.updateRoute(route) : await api.createRoute(route)
    routeList.setRoutes((current) =>
      route.id ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current],
    )
    return saved
  }

  async function deleteRoute(id) {
    await api.deleteRoute(id)
    routeList.setRoutes((current) => current.filter((item) => item.id !== id))
  }

  // Reset replaces every route, so the list has to be reloaded. If that reload fails,
  // the reset still succeeded: the gallery shows its own "Couldn't load routes" retry.
  async function resetRoutes() {
    await api.resetRoutes()
    routeList.reload()
  }

  return (
    <BrowserRouter>
      <ToastProvider>
        <ScrollToTop />
        <a className="skip-link" href="#main">Skip to content</a>
        <Navbar routeCount={routeList.status === 'ready' ? routeList.routes.length : null} />
        <main className="page-shell" id="main">
          <CatalogProvider>
            <Routes>
              <Route
                path="/"
                element={
                  <RouteGalleryPage
                    routes={routeList.routes}
                    status={routeList.status}
                    error={routeList.error}
                    onRetry={routeList.reload}
                    onReset={resetRoutes}
                  />
                }
              />
              <Route
                path="/routes/new"
                element={
                  <RouteBuilderPage
                    routes={routeList.status === 'ready' ? routeList.routes : []}
                    onSave={saveRoute}
                  />
                }
              />
              <Route path="/routes/:id" element={<RouteDetailsPage onDelete={deleteRoute} />} />
              <Route path="/routes/:id/edit" element={<EditRoutePage onSave={saveRoute} />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </CatalogProvider>
        </main>
        <footer className="site-footer">
          <span><span className="brand-mark" aria-hidden="true">◈</span> Crux Maker</span>
          <span>Build bouldering routes on a virtual wall.</span>
        </footer>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
