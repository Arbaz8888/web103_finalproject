import { useEffect, useRef, useState } from 'react'
import WallComponent from './WallComponent'
import HoldLegend from './Hold'
import AngleGlyph from './AngleGlyph'
import { getWallTypes } from '../api/wallTypes'
import { gradeTone, grades, ROLE_COLORS } from '../data/grades'
import ClimbingHoldsDrawer from './ClimbingHoldsDrawer'
import ViewToggle from './ViewToggle'
import Wall3DLazy from './Wall3DLazy'
import { findOverlappingHold, getHoldSize, SIZES } from '../utils/holdFootprint'

const ROLES = ['start', 'hand', 'foot', 'finish']
const isTyping = (target) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable

function RouteForm({ existing, onSave, submitLabel = 'Save route' }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [grade, setGrade] = useState(existing?.grade ?? 'V0')
  const [wallTypeId, setWallTypeId] = useState(existing?.wallTypeId ?? null)
  const [angle, setAngle] = useState(existing?.angle ?? 0)
  const [wallTypes, setWallTypes] = useState([])
  const [role, setRole] = useState('hand')
  const [rotation, setRotation] = useState(0)
  const [catalogHold, setCatalogHold] = useState(null)
  const [holds, setHolds] = useState(existing?.holds ?? [])
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null)
  const [view, setView] = useState('2D')
  const wallRef = useRef(null)
  const drawerRef = useRef(null)
  const selectedHold = selectedCell && holds.find((hold) => hold.row === selectedCell.row && hold.col === selectedCell.col)
  const wallType = wallTypes.find((type) => type.id === wallTypeId)

  const checks = [
    { id: 'name', label: 'Route name', done: Boolean(name.trim()) },
    { id: 'start', label: 'A start hold', done: holds.some((hold) => hold.role === 'start') },
    { id: 'finish', label: 'A finish hold', done: holds.some((hold) => hold.role === 'finish') },
  ]
  const ready = checks.every((check) => check.done) && Boolean(wallTypeId)

  // Load the wall type choices from the API
  useEffect(() => {
    getWallTypes()
      .then((types) => {
        setWallTypes(types)
        setWallTypeId((current) => current ?? types.find((type) => type.name === 'Vertical')?.id ?? types[0]?.id)
      })
      .catch((err) => setError(err.message))
  }, [])

  // Every change to the holds goes through here so it can be undone
  function commitHolds(next) {
    setHistory((past) => [...past.slice(-49), holds])
    setHolds(next)
  }

  function undo() {
    if (history.length === 0) return
    setHolds(history[history.length - 1])
    setHistory((past) => past.slice(0, -1))
    setSelectedCell(null)
  }

  function handleWallTypeChange(id) {
    const type = wallTypes.find((item) => item.id === id)
    setWallTypeId(id)
    if (type) setAngle(Math.min(Math.max(angle, type.min_angle), type.max_angle))
  }

  function handleCellClick(row, col) {
    if (!catalogHold) {
      setError('Pick a hold from the drawer first.')
      return
    }
    setError('')
    commitHolds([
      ...holds,
      { row, col, role, holdId: catalogHold.id, imageUrl: catalogHold.imageUrl, size: catalogHold.size, holdType: catalogHold.holdType, color: catalogHold.color, rotation },
    ])
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

  function handlePlacedHoldClick(hold) {
    setSelectedCell({ row: hold.row, col: hold.col })
  }

  function updateSelectedHold(changes) {
    commitHolds(holds.map((hold) => (hold === selectedHold ? { ...hold, ...changes } : hold)))
  }

  function rotateHold() {
    updateSelectedHold({ rotation: ((selectedHold.rotation ?? 0) + 45) % 360 })
  }

  // A placed hold can only change to a size that still fits without overlapping its neighbors.
  function sizeFits(size) {
    const others = holds.filter((hold) => hold !== selectedHold)
    return !findOverlappingHold(selectedHold.row, selectedHold.col, size, others)
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

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Delete remove, R rotate, Escape deselect
  useEffect(() => {
    function onKeyDown(event) {
      if (isTyping(event.target)) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (selectedHold && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        removeHold()
      } else if (selectedHold && event.key.toLowerCase() === 'r') {
        rotateHold()
      } else if (event.key === 'Escape') {
        setSelectedCell(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  async function handleSubmit(event) {
    event.preventDefault()
    if (!ready) {
      setError('Add a route name, at least one start hold, and a finish hold before saving.')
      return
    }

    setError('')
    setSaving(true)
    try {
      await onSave({ id: existing?.id, name: name.trim(), grade, wallTypeId, angle, holds })
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
          <p className="wall-instruction" aria-live="polite">
            {view === '3D' ? (
              <>Live 3D preview. Switch to <strong>2D</strong> to place holds.</>
            ) : selectedHold ? (
              <>Editing a <strong>{selectedHold.role}</strong> hold. <kbd>R</kbd> rotate · <kbd>Del</kbd> remove · <kbd>Esc</kbd> done</>
            ) : catalogHold ? (
              <>Tap a bolt to place <strong>{catalogHold.name}</strong> as a <strong style={{ color: ROLE_COLORS[role] }}>{role}</strong> hold.</>
            ) : (
              'Pick a hold from the drawer, then tap a bolt to place it.'
            )}
          </p>
          <div className="builder-toolbar-actions">
            {catalogHold && (
              <button className="picked-chip" type="button" onClick={() => drawerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} title="Change hold">
                <img src={catalogHold.imageUrl} alt="" style={{ transform: `rotate(${rotation}deg)` }} />
                <i className="dot" style={{ background: ROLE_COLORS[role] }} />
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

        {view === '3D' ? (
          <Wall3DLazy holds={holds} wallType={wallType?.name} angle={angle} />
        ) : (
        <div className="wall-stage">
          {selectedHold && (
            <div className="hold-popover" role="group" aria-label="Selected hold">
              <div className="hold-popover-row">
                <span className="hold-popover-label">Role</span>
                <div className="segmented segmented-sm">
                  {ROLES.map((item) => (
                    <button key={item} type="button" aria-pressed={selectedHold.role === item} onClick={() => updateSelectedHold({ role: item })}>
                      <i className="dot" style={{ background: ROLE_COLORS[item] }} />{item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="hold-popover-row">
                <span className="hold-popover-label">Size</span>
                <div className="segmented segmented-sm">
                  {SIZES.map((item) => {
                    const isCurrent = getHoldSize(selectedHold) === item
                    const fits = isCurrent || sizeFits(item)
                    return (
                      <button
                        aria-pressed={isCurrent}
                        disabled={!fits}
                        key={item}
                        onClick={() => updateSelectedHold({ size: item })}
                        title={fits ? `Make this a ${item} hold` : `A ${item} hold would overlap a neighboring hold`}
                        type="button"
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="hold-popover-row">
                <button className="button button-ghost button-sm" onClick={rotateHold} type="button">↻ {selectedHold.rotation ?? 0}°</button>
                <button className="button button-danger-ghost button-sm" onClick={removeHold} type="button">Remove</button>
                <button className="button button-primary button-sm push-right" onClick={() => setSelectedCell(null)} type="button">Done</button>
              </div>
            </div>
          )}
          <WallComponent holds={holds} wallType={wallType?.name} angle={angle} placingSize={catalogHold?.size ?? 'medium'} editable onCellClick={handleCellClick} onPlacedHoldClick={handlePlacedHoldClick} />
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
                <button key={item} type="button" className={`grade-option grade-${gradeTone(item)}`} aria-pressed={grade === item} onClick={() => setGrade(item)}>
                  {item}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Wall type</legend>
            <div className="wall-type-picker">
              {wallTypes.map((type) => (
                <button key={type.id} type="button" aria-pressed={wallTypeId === type.id} onClick={() => handleWallTypeChange(type.id)} title={type.description}>
                  <AngleGlyph angle={(type.min_angle + type.max_angle) / 2} />
                  <strong>{type.name}</strong>
                  <span>{type.min_angle}° to {type.max_angle}°</span>
                </button>
              ))}
              {wallTypes.length === 0 && <p className="muted">Loading wall types…</p>}
            </div>
          </fieldset>

          <label className="field">
            <span className="field-row">Wall angle <output className="angle-value">{angle}°</output></span>
            <input
              className="range"
              type="range"
              min={wallType?.min_angle ?? -20}
              max={wallType?.max_angle ?? 90}
              value={angle}
              onChange={(event) => setAngle(Number(event.target.value))}
            />
          </label>
        </section>

        <section className="panel" ref={drawerRef}>
          <h2 className="panel-title"><span className="step">2</span> Place the holds</h2>
          <ClimbingHoldsDrawer
            selectedHold={catalogHold}
            onSelectHold={handlePickHold}
            role={role}
            onRoleChange={setRole}
            rotation={rotation}
            onRotationChange={setRotation}
          />
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
            <li className={holds.length > 0 ? 'done' : ''}><span className="check" aria-hidden="true">{holds.length > 0 ? '✓' : ''}</span>{holds.length} {holds.length === 1 ? 'hold' : 'holds'} placed</li>
          </ul>
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
