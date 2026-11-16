import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import WallComponent from '../components/WallComponent'
import HoldLegend from '../components/Hold'
import GradeBadge from '../components/GradeBadge'
import AngleGlyph from '../components/AngleGlyph'
import RoleBar from '../components/RoleBar'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ViewToggle from '../components/ViewToggle'
import Wall3DLazy from '../components/Wall3DLazy'
import NotFoundPage from './NotFoundPage'
import { countRoles, grades, ROLE_COLORS } from '../data/grades'
import { useToast } from '../hooks/useToast'
import { usePageTitle } from '../hooks/usePageTitle'

function RouteDetailsPage({ routes, onDelete }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [view, setView] = useState('2D')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const route = routes.find((item) => item.id === Number(id))
  usePageTitle(route?.name ?? 'Route not found')
  if (!route) return <NotFoundPage message="That route doesn't exist, or it was deleted." />

  const counts = countRoles(route.holds)
  const gradeIndex = grades.indexOf(route.grade)
  // Up to three routes within one grade of this one, closest grade first
  const related = routes
    .filter((item) => item.id !== route.id && Math.abs(grades.indexOf(item.grade) - gradeIndex) <= 1)
    .sort((a, b) => Math.abs(grades.indexOf(a.grade) - gradeIndex) - Math.abs(grades.indexOf(b.grade) - gradeIndex))
    .slice(0, 3)

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
              <p className="eyebrow">{route.wallType.toUpperCase()} WALL · {route.angle}°</p>
              <h1>{route.name}</h1>
            </div>
          </div>

          <dl className="stat-grid">
            <div>
              <dt>Wall</dt>
              <dd><AngleGlyph angle={route.angle} className="angle-glyph-lg" />{route.wallType}</dd>
            </div>
            <div><dt>Angle</dt><dd>{route.angle}°</dd></div>
            <div><dt>Holds</dt><dd>{route.holds.length}</dd></div>
          </dl>

          <div className="panel">
            <h2 className="panel-title">Hold breakdown</h2>
            <RoleBar holds={route.holds} />
            <ul className="role-counts">
              {Object.entries(counts).filter(([, count]) => count > 0).map(([role, count]) => (
                <li key={role}><i style={{ background: ROLE_COLORS[role] }} />{role}<b>{count}</b></li>
              ))}
            </ul>
          </div>

          <div className="details-actions">
            <Link className="button button-primary" to={`/routes/${route.id}/edit`}>✎ Edit route</Link>
            <button className="button button-ghost" onClick={handleShare} type="button">↗ Share</button>
            <button className="button button-danger-ghost" onClick={() => setConfirmDelete(true)} type="button">Delete</button>
          </div>
        </div>

        <div className="wall-view">
          <ViewToggle view={view} onChange={setView} />
          {view === '3D' ? (
            <Wall3DLazy key={route.id} holds={route.holds} wallType={route.wallType} angle={route.angle} />
          ) : (
            <div className="wall-stage">
              <WallComponent holds={route.holds} size="lg" wallType={route.wallType} angle={route.angle} />
              <HoldLegend />
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="related">
          <div className="section-heading">
            <h2>Routes at a similar grade</h2>
            <Link className="text-link push-right" to="/">See all routes →</Link>
          </div>
          <div className="related-grid">
            {related.map((item) => (
              <Link className="related-card" to={`/routes/${item.id}`} key={item.id}>
                <WallComponent holds={item.holds} size="sm" />
                <div>
                  <strong>{item.name}</strong>
                  <span className="muted">{item.wallType} · {item.holds.length} holds</span>
                </div>
                <GradeBadge grade={item.grade} />
              </Link>
            ))}
          </div>
        </section>
      )}

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
