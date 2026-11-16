import { ROLE_COLORS } from '../data/grades'

function HoldLegend() {
  return (
    <div className="hold-legend" aria-label="Hold colors">
      {['start', 'hand', 'foot', 'finish'].map((role) => (
        <span key={role}>
          <i className={`legend-dot ${role}`} style={{ background: ROLE_COLORS[role] }} />
          {role}
        </span>
      ))}
    </div>
  )
}

export default HoldLegend
