// Reusable 2D climbing wall: a grid of T-nut bolt holes (dimensions from the catalog).
// Row 0 is the top of the wall.
import { findOverlappingHold, getCoveredBolts, getHoldSize, HOLD_SCALE } from '../../utils/holdFootprint'
import { formatLabel } from '../../utils/format'
import './WallComponent.css'

const ROWS = 16
const COLS = 12

// Side view of the wall: floor line, dashed vertical reference, and the wall tilted to `angle`.
// The climber stands on the right, so overhangs lean right.
function WallProfile({ wallType, angle }) {
  const radians = (Math.max(-90, Math.min(90, angle)) * Math.PI) / 180
  const baseX = 14
  const baseY = 32
  const length = 26
  const topX = baseX + length * Math.sin(radians)
  const topY = baseY - length * Math.cos(radians)
  const name = formatLabel(wallType)

  return (
    <div className="wall-profile" aria-label={`${name} wall, ${angle} degrees`} role="img">
      <svg viewBox="0 0 44 36" aria-hidden="true">
        <line className="wall-profile-floor" x1="4" y1={baseY} x2="40" y2={baseY} />
        <line className="wall-profile-ref" x1={baseX} y1={baseY} x2={baseX} y2={baseY - length} />
        <line className="wall-profile-wall" x1={baseX} y1={baseY} x2={topX} y2={topY} />
      </svg>
      <span>{name} · {angle}°</span>
    </div>
  )
}

// placingSize: size of the hold the builder will bolt on next. Empty bolts where a hold of
// that size would overlap an existing hold are blocked.
function WallComponent({
  holds = [],
  editable = false,
  size = 'md',
  placingSize = 'medium',
  wallType,
  angle,
  selectedCell,
  onCellClick,
  onPlacedHoldClick,
}) {
  const holdsByCell = new Map(holds.map((hold) => [`${hold.gridRow}-${hold.gridCol}`, hold]))
  const coveredBolts = editable ? getCoveredBolts(holds) : new Map()

  return (
    <div className={`wall-frame wall-frame-${size}`}>
      {wallType && angle != null && <WallProfile wallType={wallType} angle={angle} />}
      <div className={`wall wall-${size}${editable ? ' wall-editable' : ''}`}>
      {Array.from({ length: ROWS * COLS }, (_, index) => {
        const row = Math.floor(index / COLS)
        const col = index % COLS
        const key = `${row}-${col}`
        const hold = holdsByCell.get(key)

        if (hold) {
          const role = hold.role ?? 'any'
          const holdSize = getHoldSize(hold)
          const scale = { '--hold-scale': `${Math.round(HOLD_SCALE[holdSize] * 100)}%` }
          const image = (
            <img
              className={`wall-hold role-${role}`}
              src={hold.imageUrl}
              alt=""
              draggable={false}
              style={{ ...scale, transform: `rotate(${hold.rotation ?? 0}deg)` }}
            />
          )
          const label = `${holdSize} ${hold.role} hold at row ${row}, column ${col}`
          const isSelected = selectedCell?.gridRow === row && selectedCell?.gridCol === col

          // The round hit area matches the hold's visible shape, so clicking anywhere on the
          // hold selects it (not the transparent corners of the PNG).
          return editable ? (
            <button
              className={`wall-cell${isSelected ? ' wall-cell-selected' : ''}`}
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              style={scale}
              onClick={() => onPlacedHoldClick?.(hold)}
            >
              {image}
              <span className="wall-hold-hit" style={scale} />
            </button>
          ) : (
            <div className="wall-cell" key={key} role="img" aria-label={label}>
              {image}
            </div>
          )
        }

        const coveringHold = coveredBolts.get(key)
        if (coveringHold) {
          // Bolt hidden under a bigger hold: not selectable on its own, clicking selects that hold.
          return (
            <button
              className="wall-cell wall-cell-covered"
              key={key}
              type="button"
              aria-label={`Bolt hole at row ${row}, column ${col}, covered by the ${coveringHold.role} hold at row ${coveringHold.gridRow}, column ${coveringHold.gridCol}`}
              onClick={() => onPlacedHoldClick?.(coveringHold)}
            />
          )
        }

        const blockingHold = editable && findOverlappingHold(row, col, placingSize, holds)
        if (blockingHold) {
          // A hold here would overlap a neighbor, so this bolt can't be used right now.
          return (
            <button
              className="wall-cell wall-cell-blocked"
              key={key}
              type="button"
              disabled
              aria-label={`Bolt hole at row ${row}, column ${col}, too close to the ${blockingHold.role} hold at row ${blockingHold.gridRow}, column ${blockingHold.gridCol}`}
            >
              <span className="wall-bolt" />
            </button>
          )
        }

        return editable ? (
          <button
            className="wall-cell"
            key={key}
            type="button"
            aria-label={`Empty bolt hole at row ${row}, column ${col}`}
            onClick={() => onCellClick?.(row, col)}
          >
            <span className="wall-bolt" />
          </button>
        ) : (
          <div className="wall-cell" key={key}>
            <span className="wall-bolt" />
          </div>
        )
      })}
      </div>
    </div>
  )
}

export default WallComponent
