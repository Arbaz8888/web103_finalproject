import { useEffect, useRef, useState } from 'react'
import WallComponent from '../wall/WallComponent'
import HoldLegend from '../wall/HoldLegend'
import AngleGlyph from '../wall/AngleGlyph'
import ClimbingHoldsDrawer from './ClimbingHoldsDrawer'
import RotationDial from './RotationDial'
import ViewToggle from '../wall/ViewToggle'
import Wall3DLazy from '../wall/Wall3DLazy'
import { useCatalog } from '../../hooks/useCatalog'
import { normalizeRotation } from '../../utils/rotation'
import { formatLabel } from '../../utils/format'
import { gradeTone, roleColor } from '../../utils/display'
import './RouteForm.css'

const DEFAULT_ROLE = 'hand'
const HISTORY_LIMIT = 50
const isTyping = (target) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable
const sameSpot = (a, b) => a && b && a.gridRow === b.gridRow && a.gridCol === b.gridCol

function RouteForm({ existing, onSave, submitLabel = 'Save route' }) {
  const { grades, holdRoles, wallTypes, maxStartHolds, finishHolds } = useCatalog()
  const [name, setName] = useState(existing?.name ?? '')
  const [grade, setGrade] = useState(existing?.grade ?? grades[0])
  const [angleDegrees, setAngleDegrees] = useState(existing?.angleDegrees ?? 0)
  const [catalogHold, setCatalogHold] = useState(null)
  const [holds, setHolds] = useState(existing?.holds ?? [])
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null)
  const [view, setView] = useState('2D')
  const wallRef = useRef(null)
  const drawerRef = useRef(null)
  const draggingRotation = useRef(false)

  const selectedHold = holds.find((hold) => sameSpot(hold, selectedCell))
  // One slider covers every wall type; the type follows from the angle
  const minAngle = Math.min(...wallTypes.map((type) => type.minAngle))
  const maxAngle = Math.max(...wallTypes.map((type) => type.maxAngle))
  const wallType = wallTypes.find((type) => angleDegrees >= type.minAngle && angleDegrees <= type.maxAngle)
  const starts = holds.filter((hold) => hold.role === 'start').length
  const finishes = holds.filter((hold) => hold.role === 'finish').length

  const checks = [
    { id: 'name', label: 'Route name', done: Boolean(name.trim()) },
    { id: 'start', label: maxStartHolds > 1 ? `1 or ${maxStartHolds} start holds` : '1 start hold', done: starts >= 1 && starts <= maxStartHolds },
    { id: 'finish', label: `${finishHolds} finish hold`, done: finishes === finishHolds },
  ]
  const ready = checks.every((check) => check.done) && Boolean(wallType)

  // A role is unavailable for the selected hold when the route already has the most it allows
  function roleDisabled(role, hold) {
    if (hold.role === role) return false
    if (role === 'start') return starts >= maxStartHolds
    if (role === 'finish') return finishes >= finishHolds
    return false
  }

  // Every change to the holds goes through here so it can be undone
  function commitHolds(next, { record = true } = {}) {
    if (record) setHistory((past) => [...past.slice(-(HISTORY_LIMIT - 1)), holds])
    setHolds(next)
  }

  function undo() {
    if (history.length === 0) return
    setHolds(history[history.length - 1])
    setHistory((past) => past.slice(0, -1))
    setSelectedCell(null)
  }

  // On narrow screens the drawer sits below the wall, so jump back up after picking a hold
  function handlePickHold(hold) {
    setCatalogHold(hold)
    setError('')
    if (hold && window.matchMedia('(max-width: 960px)').matches) {
      wallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Place the picked hold, then select it so its role and rotation can be set
  function handleCellClick(row, col) {
    if (!catalogHold) {
      setError('Pick a hold from the drawer first.')
      return
    }
    setError('')
    commitHolds([
      ...holds,
      {
        gridRow: row,
        gridCol: col,
        role: DEFAULT_ROLE,
        rotation: 0,
        holdId: catalogHold.id,
        imageUrl: catalogHold.imageUrl,
        size: catalogHold.size,
        holdType: catalogHold.holdType,
        color: catalogHold.color,
      },
    ])
    setSelectedCell({ gridRow: row, gridCol: col })
  }

  function updateSelectedHold(changes, options) {
    commitHolds(holds.map((hold) => (hold === selectedHold ? { ...hold, ...changes } : hold)), options)
  }

  function handleRotationStart() {
    draggingRotation.current = true
    setHistory((past) => [...past.slice(-(HISTORY_LIMIT - 1)), holds])
  }

  function setRotation(degrees) {
    updateSelectedHold({ rotation: normalizeRotation(degrees) }, { record: !draggingRotation.current })
  }

  function handleRotationEnd() {
    draggingRotation.current = false
  }

  function removeHold() {
    commitHolds(holds.filter((hold) => hold !== selectedHold))
    setSelectedCell(null)
  }

  function clearWall() {
    if (holds.length === 0) return
    commitHolds([])
    setSelectedCell(null)
  }

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Delete remove, R rotate 15°, Escape deselect
  useEffect(() => {
    function onKeyDown(event) {
      if (isTyping(event.target) || event.target.getAttribute('role') === 'slider') return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (selectedHold && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        removeHold()
      } else if (selectedHold && event.key.toLowerCase() === 'r') {
        updateSelectedHold({ rotation: normalizeRotation(selectedHold.rotation + 15) })
      } else if (event.key === 'Escape') {
        setSelectedCell(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // The Save button stays disabled until the checklist is complete
  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave({ id: existing?.id, name: name.trim(), grade, angleDegrees, holds })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="builder" onSubmit={handleSubmit}>
      <div className="builder-wall" ref={wallRef}>
        <div className="builder-toolbar">
          <ViewToggle view={view} onChange={(next) => { setView(next); setSelectedCell(null) }} />
          <div className="builder-toolbar-actions">
            {catalogHold && (
              <button className="picked-chip" type="button" onClick={() => drawerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} title="Change hold">
                <img src={catalogHold.imageUrl} alt="" />
                <span>Change hold</span>
              </button>
            )}
            <button className="icon-button" type="button" onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)" aria-label="Undo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            </button>
            <button className="icon-button" type="button" onClick={clearWall} disabled={holds.length === 0} title="Clear all holds" aria-label="Clear all holds">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
            </button>
          </div>
        </div>

        {/* Editor for the selected hold; shows instructions when nothing is selected */}
        <div className={`hold-editor${selectedHold && view === '2D' ? ' active' : ''}`} aria-live="polite">
          {view === '3D' ? (
            <p className="wall-instruction">Live 3D preview. Switch to <strong>2D</strong> to place and edit holds.</p>
          ) : selectedHold ? (
            <>
              <div className="hold-editor-head">
                <img src={selectedHold.imageUrl} alt="" style={{ transform: `rotate(${selectedHold.rotation}deg)` }} />
                <span className="hold-editor-title">Selected hold</span>
                <button className="button button-danger-ghost button-sm push-right" onClick={removeHold} type="button">Remove</button>
                <button className="button button-primary button-sm" onClick={() => setSelectedCell(null)} type="button">Done</button>
              </div>
              <div className="hold-editor-body">
                <div className="hold-editor-field">
                  <span className="hold-editor-label">Role</span>
                  <div className="segmented segmented-sm role-segmented" role="group" aria-label="Hold role">
                    {holdRoles.map((item) => {
                      const disabled = roleDisabled(item, selectedHold)
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={selectedHold.role === item}
                          disabled={disabled}
                          title={disabled ? (item === 'start' ? `A route can have at most ${maxStartHolds} start holds` : `A route can have only ${finishHolds} finish hold`) : undefined}
                          onClick={() => updateSelectedHold({ role: item })}
                        >
                          <i className="dot" style={{ background: roleColor(item) }} />{item}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="hold-editor-field">
                  <span className="hold-editor-label">Rotation</span>
                  <RotationDial
                    value={selectedHold.rotation}
                    imageUrl={selectedHold.imageUrl}
                    onChangeStart={handleRotationStart}
                    onChange={setRotation}
                    onChangeEnd={handleRotationEnd}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="wall-instruction">
              {catalogHold ? (
                <>Tap a bolt to place <strong>{catalogHold.name}</strong>, then set its role and rotation.</>
              ) : (
                'Pick a hold from the drawer, then tap a bolt to place it.'
              )}
              <span className="shortcut-hint"><kbd>R</kbd> rotate · <kbd>Del</kbd> remove · <kbd>Esc</kbd> deselect · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo</span>
            </p>
          )}
        </div>

        {view === '3D' ? (
          <Wall3DLazy holds={holds} wallType={wallType?.name} angle={angleDegrees} />
        ) : (
          <div className="wall-stage">
            <WallComponent
              holds={holds}
              wallType={wallType?.name}
              angle={angleDegrees}
              placingSize={catalogHold?.size ?? 'medium'}
              selectedCell={selectedCell}
              editable
              onCellClick={handleCellClick}
              onPlacedHoldClick={(hold) => setSelectedCell({ gridRow: hold.gridRow, gridCol: hold.gridCol })}
            />
            <HoldLegend />
          </div>
        )}
      </div>

      <div className="builder-panel">
        <section className="panel">
          <h2 className="panel-title"><span className="step">1</span> Route details</h2>
          <label className="field">
            <span>Route name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Moonwalk" maxLength={60} />
          </label>

          <fieldset className="field">
            <legend>Grade</legend>
            <div className="grade-picker">
              {grades.map((item) => (
                <button key={item} type="button" className={`grade-option grade-${gradeTone(item, grades)}`} aria-pressed={grade === item} onClick={() => setGrade(item)}>
                  {item}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <span className="field-row">
              <label htmlFor="wall-angle">Wall angle</label>
              <span className="wall-type-readout">
                <AngleGlyph angle={angleDegrees} />
                <strong>{wallType ? formatLabel(wallType.name) : '—'}</strong>
                <output htmlFor="wall-angle" className="angle-value">{angleDegrees}°</output>
              </span>
            </span>
            <input
              id="wall-angle"
              className="range"
              type="range"
              min={minAngle}
              max={maxAngle}
              value={angleDegrees}
              onChange={(event) => setAngleDegrees(Number(event.target.value))}
              aria-valuetext={`${angleDegrees} degrees, ${wallType ? formatLabel(wallType.name) : 'unknown'} wall`}
            />
            {/* Each wall type's share of the slider, from the wall types */}
            <div className="wall-type-scale" aria-hidden="true">
              {wallTypes.map((type) => (
                <span
                  key={type.id}
                  className={type.id === wallType?.id ? 'current' : ''}
                  style={{ flexGrow: type.maxAngle - type.minAngle + 1 }}
                >
                  {formatLabel(type.name)}
                </span>
              ))}
            </div>
            {wallType?.description && <p className="field-hint">{wallType.description}</p>}
          </div>
        </section>

        <section className="panel" ref={drawerRef}>
          <h2 className="panel-title"><span className="step">2</span> Pick a hold</h2>
          <ClimbingHoldsDrawer selectedHold={catalogHold} onSelectHold={handlePickHold} />
        </section>

        <section className="panel save-panel">
          <h2 className="panel-title"><span className="step">3</span> Save</h2>
          <ul className="checklist">
            {checks.map((check) => (
              <li key={check.id} className={check.done ? 'done' : ''}>
                <span className="check" aria-hidden="true">{check.done ? '✓' : ''}</span>
                {check.label}
                <span className="sr-only">{check.done ? ' (done)' : ' (needed)'}</span>
              </li>
            ))}
          </ul>
          <p className="muted checklist-count">{holds.length} {holds.length === 1 ? 'hold' : 'holds'} placed</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-lg button-block" disabled={saving || !ready} type="submit">
            {saving ? 'Saving…' : submitLabel}
          </button>
        </section>
      </div>
    </form>
  )
}

export default RouteForm
