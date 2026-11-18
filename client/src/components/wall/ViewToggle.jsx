import './ViewToggle.css'

const OPTIONS = [
  { id: '2D', icon: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16' },
  { id: '3D', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5' },
]

// Pill switch between the flat bolt grid and the 3D wall
function ViewToggle({ view, onChange }) {
  return (
    <div className={`view-toggle view-toggle-${view.toLowerCase()}`} role="group" aria-label="Wall view">
      <span className="view-toggle-thumb" aria-hidden="true" />
      {OPTIONS.map((option) => (
        <button key={option.id} type="button" aria-pressed={view === option.id} onClick={() => onChange(option.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={option.icon} />
          </svg>
          {option.id}
        </button>
      ))}
    </div>
  )
}

export default ViewToggle
