import { useCatalog } from '../../hooks/useCatalog'
import { formatLabel } from '../../utils/format'
import './RouteFilters.css'

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'easiest', label: 'Easiest' },
  { id: 'hardest', label: 'Hardest' },
]

// Search, grade chips, wall type chips and sort for the gallery
function RouteFilters({ routes, filters, onChange, onClear }) {
  const { query, grade, wallType, sort } = filters
  const { grades, wallTypes: allWallTypes } = useCatalog()
  const gradeCounts = Object.fromEntries(grades.map((item) => [item, routes.filter((route) => route.grade === item).length]))
  const wallTypes = allWallTypes.map((type) => type.name)
  const wallCounts = Object.fromEntries(wallTypes.map((item) => [item, routes.filter((route) => route.wallType === item).length]))
  const active = query || grade || wallType

  return (
    <section className="filters" aria-label="Route filters">
      <div className="filters-row">
        <label className="search">
          <span className="sr-only">Search routes</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            type="search"
            placeholder="Search routes by name"
            value={query}
            onChange={(event) => onChange({ query: event.target.value })}
          />
        </label>
        <div className="segmented" role="group" aria-label="Sort routes">
          {SORTS.map((item) => (
            <button key={item.id} type="button" aria-pressed={sort === item.id} onClick={() => onChange({ sort: item.id })}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chip-row" role="group" aria-label="Filter by grade">
        <button className="chip" type="button" aria-pressed={!grade} onClick={() => onChange({ grade: '' })}>All grades</button>
        {grades.map((item) => (
          <button
            key={item}
            className="chip chip-grade"
            type="button"
            aria-pressed={grade === item}
            disabled={gradeCounts[item] === 0 && grade !== item}
            onClick={() => onChange({ grade: grade === item ? '' : item })}
          >
            {item}
            {gradeCounts[item] > 0 && <span className="chip-count">{gradeCounts[item]}</span>}
          </button>
        ))}
      </div>

      <div className="chip-row" role="group" aria-label="Filter by wall type">
        <button className="chip" type="button" aria-pressed={!wallType} onClick={() => onChange({ wallType: '' })}>Any wall</button>
        {wallTypes.map((item) => (
          <button
            key={item}
            className="chip"
            type="button"
            aria-pressed={wallType === item}
            disabled={wallCounts[item] === 0 && wallType !== item}
            onClick={() => onChange({ wallType: wallType === item ? '' : item })}
          >
            {formatLabel(item)}
            {wallCounts[item] > 0 && <span className="chip-count">{wallCounts[item]}</span>}
          </button>
        ))}
        {active && <button className="chip-clear" type="button" onClick={onClear}>Clear filters</button>}
      </div>
    </section>
  )
}

export default RouteFilters
