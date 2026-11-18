import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import RouteFilters from '../components/routes/RouteFilters'
import QuickLookModal from '../components/routes/QuickLookModal'
import RouteGallery from '../components/routes/RouteGallery'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import GradeBadge from '../components/routes/GradeBadge'
import GallerySkeleton from '../components/routes/GallerySkeleton'
import Wall3DLazy from '../components/wall/Wall3DLazy'
import { useCatalog } from '../hooks/useCatalog'
import { useToast } from '../hooks/useToast'
import { usePageTitle } from '../hooks/usePageTitle'
import './RouteGalleryPage.css'

const EMPTY_FILTERS = { query: '', grade: '', wallType: '', sort: 'newest' }

function RouteGalleryPage({ routes, status, error, onRetry, onReset }) {
  usePageTitle('Route gallery')
  const toast = useToast()
  const { grades, gridRows, gridCols } = useCatalog()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [previewRoute, setPreviewRoute] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // Filter by query/grade/wall type, then sort by the chosen order
  const visibleRoutes = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    const filtered = routes.filter(
      (route) =>
        (!query || route.name.toLowerCase().includes(query)) &&
        (!filters.grade || route.grade === filters.grade) &&
        (!filters.wallType || route.wallType === filters.wallType),
    )
    if (filters.sort === 'newest') return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const direction = filters.sort === 'easiest' ? 1 : -1
    return [...filtered].sort((a, b) => direction * (grades.indexOf(a.grade) - grades.indexOf(b.grade)))
  }, [filters, grades, routes])

  const stats = useMemo(() => {
    const sorted = routes.map((route) => grades.indexOf(route.grade)).sort((a, b) => a - b)
    return {
      routes: routes.length,
      holds: routes.reduce((sum, route) => sum + route.holds.length, 0),
      range: sorted.length ? `${grades[sorted[0]]}–${grades[sorted[sorted.length - 1]]}` : '—',
      walls: new Set(routes.map((route) => route.wallType)).size,
    }
  }, [grades, routes])

  // The busiest route makes the best-looking homepage wall
  const featured = useMemo(() => routes.reduce((best, route) => (!best || route.holds.length > best.holds.length ? route : best), null), [routes])

  // Clears search, grade and wall type; the sort is a view preference and stays
  const clearFilters = () => setFilters((current) => ({ ...EMPTY_FILTERS, sort: current.sort }))

  async function handleReset() {
    try {
      await onReset()
      clearFilters()
      toast('Wall reset to the starter routes')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setConfirmReset(false)
    }
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">BOULDERING ROUTE BUILDER</p>
          <h1>Build bouldering routes on a <span className="accent-text">virtual wall.</span></h1>
          <p className="lede">Pick holds, place them on a {gridCols} × {gridRows} bolt grid, mark the start and finish, and set the wall angle. Sketch a route here before you set it on a real wall.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-lg" to="/routes/new">＋ Build a route</Link>
            <a className="button button-ghost button-lg" href="#routes">See saved routes ↓</a>
          </div>
          <dl className="hero-stats">
            <div><dt>Routes built</dt><dd>{stats.routes}</dd></div>
            <div><dt>Grade range</dt><dd>{stats.range}</dd></div>
            <div><dt>Holds placed</dt><dd>{stats.holds}</dd></div>
            <div><dt>Wall types</dt><dd>{stats.walls}</dd></div>
          </dl>
        </div>
        <div className="hero-stage">
          {featured ? (
            <>
              <Wall3DLazy key={featured.id} holds={featured.holds} angle={featured.angleDegrees} wallType={featured.wallType} showcase fallbackClassName="wall-3d-showcase" />
              <Link className="featured-chip" to={`/routes/${featured.id}`}>
                <span className="featured-label">Featured route</span>
                <strong>{featured.name}</strong>
                <GradeBadge grade={featured.grade} />
                <span className="featured-arrow" aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <div className="wall-3d wall-3d-showcase wall-3d-loading">Build a route to see it here in 3D</div>
          )}
        </div>
      </section>

      <div className="section-heading" id="routes">
        <h2>Saved routes</h2>
        <span className="muted">
          Showing {visibleRoutes.length} of {routes.length}
        </span>
        <button className="button button-ghost button-sm push-right" onClick={() => setConfirmReset(true)} type="button">
          ⟳ Reset wall
        </button>
      </div>

      <RouteFilters routes={routes} filters={filters} onChange={(changes) => setFilters((current) => ({ ...current, ...changes }))} onClear={clearFilters} />

      {status === 'loading' ? (
        <GallerySkeleton />
      ) : status === 'error' ? (
        <section className="empty-panel" role="alert">
          <h3>Couldn't load routes.</h3>
          <p className="muted">{error}</p>
          <button className="button button-primary" type="button" onClick={onRetry}>Try again</button>
        </section>
      ) : routes.length === 0 ? (
        <section className="empty-panel">
          <h3>No routes yet.</h3>
          <p className="muted">Build the first route, or reset the wall to bring back the starter routes.</p>
          <Link className="button button-primary" to="/routes/new">Build the first route</Link>
        </section>
      ) : visibleRoutes.length === 0 ? (
        <section className="empty-panel">
          <h3>No routes match.</h3>
          <p className="muted">Try a different grade or wall type, or clear your filters.</p>
          <button className="button button-ghost" type="button" onClick={clearFilters}>Clear filters</button>
        </section>
      ) : (
        <RouteGallery routes={visibleRoutes} onQuickLook={setPreviewRoute} />
      )}

      <QuickLookModal route={previewRoute} onClose={() => setPreviewRoute(null)} />
      <ConfirmDialog
        open={confirmReset}
        title="Reset the wall?"
        message="This deletes every route and brings back the starter routes. It can't be undone."
        confirmLabel="Reset wall"
        onConfirm={handleReset}
        onClose={() => setConfirmReset(false)}
      />
    </>
  )
}

export default RouteGalleryPage
