import { Link } from 'react-router-dom'
import WallComponent from '../wall/WallComponent'
import GradeBadge from './GradeBadge'
import AngleGlyph from '../wall/AngleGlyph'
import { formatLabel } from '../../utils/format'
import './RouteCard.css'

// The whole card links to the route page; the eye button opens a quick look instead.
// Tilt the wall preview toward the mouse and move the card's light with it (mouse only)
function handlePointerMove(event) {
  if (event.pointerType !== 'mouse') return
  const card = event.currentTarget
  const box = card.getBoundingClientRect()
  const x = (event.clientX - box.left) / box.width
  const y = (event.clientY - box.top) / box.height
  card.style.setProperty('--px', `${x * 100}%`)
  card.style.setProperty('--py', `${y * 100}%`)
  card.style.setProperty('--tx', (x - 0.5).toFixed(3))
  card.style.setProperty('--ty', (y - 0.5).toFixed(3))
}

function handlePointerLeave(event) {
  event.currentTarget.style.setProperty('--tx', 0)
  event.currentTarget.style.setProperty('--ty', 0)
}

function RouteCard({ route, onQuickLook, style }) {
  return (
    <article className="route-card" style={style} onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <div className="route-card-preview">
        <WallComponent holds={route.holds} size="sm" />
        <button className="quick-look-button" onClick={() => onQuickLook(route)} type="button" aria-label={`Quick look at ${route.name}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
          Quick look
        </button>
      </div>
      <div className="route-card-content">
        <div className="route-card-title">
          <h2><Link className="card-link" to={`/routes/${route.id}`}>{route.name}</Link></h2>
          <GradeBadge grade={route.grade} />
        </div>
        <div className="route-card-meta">
          <span><AngleGlyph angle={route.angleDegrees} /> {formatLabel(route.wallType)} · {route.angleDegrees}°</span>
          <span>{route.holds.length} holds</span>
        </div>
      </div>
    </article>
  )
}

export default RouteCard
