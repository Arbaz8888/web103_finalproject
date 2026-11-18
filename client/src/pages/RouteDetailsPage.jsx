import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import WallComponent from '../components/wall/WallComponent'
import HoldLegend from '../components/wall/HoldLegend'
import GradeBadge from '../components/routes/GradeBadge'
import AngleGlyph from '../components/wall/AngleGlyph'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ViewToggle from '../components/wall/ViewToggle'
import Wall3DLazy from '../components/wall/Wall3DLazy'
import { formatLabel } from '../utils/format'
import NotFoundPage from './NotFoundPage'
import { useRoute } from '../hooks/useRoute'
import { useToast } from '../hooks/useToast'
import { usePageTitle } from '../hooks/usePageTitle'
import './RouteDetailsPage.css'

function RouteDetailsPage({ onDelete }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [view, setView] = useState('2D')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { status, route, error, retry } = useRoute(id)
  usePageTitle(route?.name ?? (status === 'loading' ? 'Loading route' : 'Route not found'))

  if (status === 'loading') return <div className="skeleton skeleton-details" aria-busy="true" aria-label="Loading route" />
  if (status === 'missing') return <NotFoundPage message="That route doesn't exist, or it was deleted." />
  if (status === 'error') return (
    <section className="empty-state" role="alert">
      <p className="eyebrow">ERROR</p>
      <h1>Couldn't load this route.</h1>
      <p className="lede">{error}</p>
      <button className="button button-primary" type="button" onClick={retry}>Try again</button>
    </section>
  )

  async function handleDelete() {
    try {
      await onDelete(route.id)
      toast(`Deleted “${route.name}”`)
      navigate('/')
    } catch (err) {
      toast(err.message, 'error')
      setConfirmDelete(false)
    }
  }

  async function handleShare() {
    const url = window.location.href
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: route.name, text: `Try ${route.name} (${route.grade})`, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast('Link copied to clipboard')
      }
    } catch (err) {
      if (err.name !== 'AbortError') toast('Could not copy the link', 'error')
    }
  }

  return (
    <section className="details">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Routes</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{route.name}</span>
      </nav>

      <div className="details-layout">
        <div className="details-info">
          <div className="details-title">
            <GradeBadge grade={route.grade} size="xl" />
            <div>
              <p className="eyebrow">{route.wallType.toUpperCase()} WALL · {route.angleDegrees}°</p>
              <h1>{route.name}</h1>
            </div>
          </div>

          <dl className="stat-grid">
            <div>
              <dt>Wall</dt>
              <dd><AngleGlyph angle={route.angleDegrees} className="angle-glyph-lg" />{formatLabel(route.wallType)}</dd>
            </div>
            <div><dt>Angle</dt><dd>{route.angleDegrees}°</dd></div>
            <div><dt>Holds</dt><dd>{route.holds.length}</dd></div>
          </dl>

          <div className="details-actions">
            <Link className="button button-primary" to={`/routes/${route.id}/edit`}>✎ Edit route</Link>
            <button className="button button-ghost" onClick={handleShare} type="button">↗ Share</button>
            <button className="button button-danger-ghost" onClick={() => setConfirmDelete(true)} type="button">Delete</button>
          </div>
        </div>

        <div className="wall-view">
          <ViewToggle view={view} onChange={setView} />
          {view === '3D' ? (
            <Wall3DLazy key={route.id} holds={route.holds} wallType={route.wallType} angle={route.angleDegrees} />
          ) : (
            <div className="wall-stage">
              <WallComponent holds={route.holds} size="lg" wallType={route.wallType} angle={route.angleDegrees} />
              <HoldLegend />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${route.name}”?`}
        message="The route and all its holds will be removed for everyone. This can't be undone."
        confirmLabel="Delete route"
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </section>
  )
}

export default RouteDetailsPage
