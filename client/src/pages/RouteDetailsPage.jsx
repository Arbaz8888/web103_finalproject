import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import WallComponent from '../components/WallComponent'
import HoldLegend from '../components/Hold'
import ViewToggle from '../components/ViewToggle'
import Wall3DLazy from '../components/Wall3DLazy'

function RouteDetailsPage({ routes, onDelete }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [view, setView] = useState('2D')
  const route = routes.find((item) => item.id === Number(id))
  if (!route) return <p>That route could not be found.</p>

  async function handleDelete() {
    if (!window.confirm(`Delete “${route.name}”?`)) return
    try {
      await onDelete(route.id)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <Link className="back-link" to="/">← Back to gallery</Link>
      <div className="details-layout">
        <div>
          <p className="eyebrow">{route.wallType} WALL</p>
          <h1>{route.name}</h1>
          <div className="details-meta"><span className="grade-badge large">{route.grade}</span><span>{route.holds.length} holds</span></div>
          <div className="details-actions"><Link className="button button-primary" to={`/routes/${route.id}/edit`}>Edit route</Link><button className="button button-danger" onClick={handleDelete} type="button">Delete</button></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="share-hint">Share this route: <code>{window.location.href}</code></p>
        </div>
        <div className="wall-view">
          <ViewToggle view={view} onChange={setView} />
          {view === '3D' ? (
            <Wall3DLazy key={route.id} holds={route.holds} wallType={route.wallType} angle={route.angle} />
          ) : (
            <WallComponent holds={route.holds} size="lg" wallType={route.wallType} angle={route.angle} />
          )}
        </div>
      </div>
      <HoldLegend />
    </section>
  )
}

export default RouteDetailsPage
