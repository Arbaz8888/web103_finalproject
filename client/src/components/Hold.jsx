import { useCatalog } from '../hooks/useCatalog'
import { roleColor } from '../utils/display'

// Color key for hold roles; the roles themselves come from the backend
function HoldLegend() {
  const catalog = useCatalog()
  return (
    <div className="hold-legend" aria-label="Hold colors">
      {(catalog?.holdRoles ?? []).map((role) => (
        <span key={role}>
          <i className={`legend-dot ${role}`} style={{ background: roleColor(role) }} />
          {role}
        </span>
      ))}
    </div>
  )
}

export default HoldLegend
