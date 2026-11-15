import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import * as api from './api'
import EditRoutePage from './pages/EditRoutePage'
import RouteBuilderPage from './pages/RouteBuilderPage'
import RouteDetailsPage from './pages/RouteDetailsPage'
import RouteGalleryPage from './pages/RouteGalleryPage'
import './App.css'

function App() {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getRoutes()
      .then(setRoutes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Returns the saved route so pages can navigate to it. Errors bubble up to RouteForm.
  async function saveRoute(route) {
    const saved = route.id ? await api.updateRoute(route) : await api.createRoute(route)
    setRoutes((current) =>
      route.id ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]
    )
    return saved
  }

  async function deleteRoute(id) {
    await api.deleteRoute(id)
    setRoutes((current) => current.filter((route) => route.id !== id))
  }

  async function resetRoutes() {
    await api.resetRoutes()
    setRoutes(await api.getRoutes())
  }

  return (
    <BrowserRouter>
      <Navbar />
      <main className="page-shell">
        {loading ? (
          <p>Loading routes…</p>
        ) : error ? (
          <p className="form-error" role="alert">Could not load routes: {error}</p>
        ) : (
          <Routes>
            <Route path="/" element={<RouteGalleryPage routes={routes} onReset={resetRoutes} />} />
            <Route path="/routes/new" element={<RouteBuilderPage routes={routes} onSave={saveRoute} />} />
            <Route path="/routes/:id" element={<RouteDetailsPage routes={routes} onDelete={deleteRoute} />} />
            <Route path="/routes/:id/edit" element={<EditRoutePage routes={routes} onSave={saveRoute} />} />
          </Routes>
        )}
      </main>
    </BrowserRouter>
  )
}

export default App
