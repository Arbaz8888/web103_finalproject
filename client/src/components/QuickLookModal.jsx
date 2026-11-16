import { Link } from 'react-router-dom'
import Dialog from './ui/Dialog'
import WallComponent from './WallComponent'
import GradeBadge from './GradeBadge'
import RoleBar from './RoleBar'
import { countRoles, ROLE_COLORS } from '../data/grades'

function QuickLookModal({ route, onClose }) {
  const counts = route ? countRoles(route.holds) : {}
  return (
    <Dialog open={Boolean(route)} onClose={onClose} className="dialog-quicklook" labelledBy="quicklook-title">
      {route && (
        <>
          <button className="dialog-close" onClick={onClose} aria-label="Close quick look" type="button">×</button>
          <div className="quicklook-wall">
            <WallComponent holds={route.holds} size="sm" wallType={route.wallType} angle={route.angle} />
          </div>
          <div className="quicklook-info">
            <p className="eyebrow">QUICK LOOK</p>
            <div className="quicklook-title">
              <h2 id="quicklook-title">{route.name}</h2>
              <GradeBadge grade={route.grade} size="lg" />
            </div>
            <p className="muted">{route.wallType} wall at {route.angle}° · {route.holds.length} holds</p>
            <RoleBar holds={route.holds} />
            <ul className="role-counts">
              {Object.entries(counts).filter(([, count]) => count > 0).map(([role, count]) => (
                <li key={role}><i style={{ background: ROLE_COLORS[role] }} />{role}<b>{count}</b></li>
              ))}
            </ul>
            <Link className="button button-primary button-block" to={`/routes/${route.id}`} onClick={onClose}>Open full route →</Link>
          </div>
        </>
      )}
    </Dialog>
  )
}

export default QuickLookModal
