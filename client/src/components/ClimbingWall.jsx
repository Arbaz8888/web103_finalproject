// Same colors as the hold legend, so each role is easy to spot
const ROLE_COLORS = {
  start: '#eab308',
  hand: '#3b82f6',
  foot: '#16a34a',
  finish: '#dc2626',
  any: '#f97316',
}

function ClimbingWall({ holds = [], interactive = false, compact = false, onHoldClick }) {
  const cells = Array.from({ length: 16 * 12 })
  // Only clickable walls need buttons (a button can't sit inside the gallery card's button)
  const Cell = interactive ? 'button' : 'div'

  return (
    <div className={`climbing-wall ${compact ? 'compact' : ''} ${interactive ? 'interactive' : ''}`}>
      {cells.map((_, index) => {
        const row = Math.floor(index / 12)
        const col = index % 12
        const hold = holds.find((item) => item.row === row && item.col === col)

        return (
          <Cell
            className={`wall-cell ${hold ? `hold-${hold.role}` : ''}`}
            key={`${row}-${col}`}
            {...(interactive && { onClick: () => onHoldClick?.(row, col), type: 'button' })}
            aria-label={hold ? `${hold.role} hold at row ${row}, column ${col}` : `Empty wall position ${row}, ${col}`}
          >
            {hold && <span className="hold-dot" style={{ backgroundColor: ROLE_COLORS[hold.role] ?? ROLE_COLORS.any }} />}
          </Cell>
        )
      })}
    </div>
  )
}

export default ClimbingWall
