import { countRoles, ROLE_COLORS } from '../data/grades'

// Thin stacked bar showing how a route's holds split across start / hand / foot / finish
function RoleBar({ holds }) {
  const counts = countRoles(holds)
  const total = holds.length || 1
  const summary = Object.entries(counts).filter(([, count]) => count > 0).map(([role, count]) => `${count} ${role}`).join(', ')
  return (
    <div className="role-bar" role="img" aria-label={summary || 'No holds'}>
      {Object.entries(counts).map(([role, count]) =>
        count > 0 ? <span key={role} style={{ flexGrow: count / total, background: ROLE_COLORS[role] }} /> : null,
      )}
    </div>
  )
}

export default RoleBar
