import { Link } from 'react-router-dom'
import Dialog from '../ui/Dialog'
import WallComponent from '../wall/WallComponent'
import GradeBadge from './GradeBadge'
import HoldLegend from '../wall/HoldLegend'
import { formatLabel } from '../../utils/format'
import './QuickLookModal.css'

function QuickLookModal({ route, onClose }) {
  return (
    <Dialog open={Boolean(route)} onClose={onClose} className="dialog-quicklook" labelledBy="quicklook-title">
      {route && (
        <>
          <button className="dialog-close" onClick={onClose} aria-label="Close quick look" type="button">×</button>
          <div className="quicklook-wall">
            <WallComponent holds={route.holds} size="sm" wallType={route.wallType} angle={route.angleDegrees} />
          </div>
          <div className="quicklook-info">
            <p className="eyebrow">QUICK LOOK</p>
            <div className="quicklook-title">
              <h2 id="quicklook-title">{route.name}</h2>
              <GradeBadge grade={route.grade} size="lg" />
            </div>
            <p className="muted">{formatLabel(route.wallType)} wall at {route.angleDegrees}° · {route.holds.length} holds</p>
            <HoldLegend />
            <Link className="button button-primary button-block" to={`/routes/${route.id}`} onClick={onClose}>Open full route →</Link>
          </div>
        </>
      )}
    </Dialog>
  )
}

export default QuickLookModal
