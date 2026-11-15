import { useEffect, useState } from 'react'
import WallComponent from './WallComponent'
import HoldLegend from './Hold'
import { getHolds, getWallTypes } from '../api'
import { grades } from '../data/grades'
import { findOverlappingHold, getHoldSize, SIZES } from '../utils/holdFootprint'

// TODO(#12): replace these with the hold picked in ClimbingHoldsDrawer (its image_url and size).
// Until then, each size bolts on a jug of that size from public/holds.
const DEFAULT_HOLD_IMAGES = {
  small: '/holds/jug-babyblue-small.png',
  medium: '/holds/jug-orange-medium.png',
  large: '/holds/jug-green-large.png',
}

function RouteForm({ existing, onSave }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [grade, setGrade] = useState(existing?.grade ?? 'V0')
  const [wallTypeId, setWallTypeId] = useState(existing?.wallTypeId ?? null)
  const [angle, setAngle] = useState(existing?.angle ?? 0)
  const [role, setRole] = useState('hand')
  const [holdSize, setHoldSize] = useState('medium')
  const [holds, setHolds] = useState(existing?.holds ?? [])
  const [wallTypes, setWallTypes] = useState([])
  const [holdOptions, setHoldOptions] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null)
  const selectedHold = selectedCell && holds.find((hold) => hold.row === selectedCell.row && hold.col === selectedCell.col)
  const wallType = wallTypes.find((type) => type.id === wallTypeId)

  // Load the wall type and hold choices from the API
  useEffect(() => {
    Promise.all([getWallTypes(), getHolds()])
      .then(([types, holdList]) => {
        setWallTypes(types)
        setHoldOptions(holdList)
        setWallTypeId((current) => current ?? types.find((type) => type.name === 'Vertical')?.id ?? types[0]?.id)
      })
      .catch((err) => setError(err.message))
  }, [])

  // The hold from the database to bolt on for a given size
  function defaultHold(size) {
    const hold = holdOptions.find((item) => item.image_url === DEFAULT_HOLD_IMAGES[size])
    return { holdId: hold?.id, imageUrl: DEFAULT_HOLD_IMAGES[size], size }
  }

  function handleWallTypeChange(id) {
    const type = wallTypes.find((item) => item.id === id)
    setWallTypeId(id)
    if (type) setAngle(type.min_angle)
  }

  function handleCellClick(row, col) {
    setHolds((current) => [...current, { row, col, role, rotation: 0, ...defaultHold(holdSize) }])
    setSelectedCell(null)
  }

  function handlePlacedHoldClick(hold) {
    setSelectedCell({ row: hold.row, col: hold.col })
  }

  function updateSelectedHold(changes) {
    setHolds((current) => current.map((hold) => (hold === selectedHold ? { ...hold, ...changes } : hold)))
  }

  function cycleRole() {
    const roles = ['start', 'hand', 'foot', 'finish']
    updateSelectedHold({ role: roles[(roles.indexOf(selectedHold.role) + 1) % roles.length] })
  }

  function rotateHold() {
    updateSelectedHold({ rotation: ((selectedHold.rotation ?? 0) + 45) % 360 })
  }

  // A placed hold can only change to a size that still fits without overlapping its neighbors.
  function sizeFits(size) {
    const others = holds.filter((hold) => hold !== selectedHold)
    return !findOverlappingHold(selectedHold.row, selectedHold.col, size, others)
  }

  function resizeHold(size) {
    updateSelectedHold(defaultHold(size))
  }

  function removeHold() {
    setHolds((current) => current.filter((hold) => hold !== selectedHold))
    setSelectedCell(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim() || !holds.some((hold) => hold.role === 'start') || !holds.some((hold) => hold.role === 'finish')) {
      setError('Add a route name, at least one start hold, and a finish hold before saving.')
      return
    }

    setError('')
    setSaving(true)
    try {
      await onSave({ id: existing?.id, name: name.trim(), grade, wallTypeId, angle, holds })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="builder-layout" onSubmit={handleSubmit}>
      <div className="form-panel">
        <label>Route name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Moonwalk" /></label>
        <label>Grade<select value={grade} onChange={(event) => setGrade(event.target.value)}>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Wall type<select value={wallTypeId ?? ''} onChange={(event) => handleWallTypeChange(Number(event.target.value))}>{wallTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label>Wall angle (°)<input type="number" value={angle} min={wallType?.min_angle} max={wallType?.max_angle} onChange={(event) => setAngle(Number(event.target.value))} /></label>
        <fieldset>
          <legend>Next hold role</legend>
          <div className="role-picker">{['start', 'hand', 'foot', 'finish'].map((item) => <button type="button" className={role === item ? 'selected' : ''} key={item} onClick={() => setRole(item)}>{item}</button>)}</div>
        </fieldset>
        <fieldset>
          <legend>Next hold size</legend>
          <div className="role-picker">{SIZES.map((item) => <button type="button" className={holdSize === item ? 'selected' : ''} key={item} onClick={() => setHoldSize(item)}>{item}</button>)}</div>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="button button-reset" onClick={() => { setHolds([]); setSelectedCell(null) }} type="button">Clear Holds</button>
          <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save route'}</button>
        </div>
      </div>
      <div>
        <p className="wall-instruction">Click a bolt to place a <strong>{holdSize} {role}</strong> hold. Click a placed hold to edit it.</p>
        {selectedHold && (
          <div className="hold-actions">
            <span>
              <strong>{getHoldSize(selectedHold)} {selectedHold.role}</strong> hold · row {selectedHold.row}, col {selectedHold.col} · {selectedHold.rotation ?? 0}°
            </span>
            <div className="hold-size-buttons" role="group" aria-label="Hold size">
              {SIZES.map((item) => {
                const isCurrent = getHoldSize(selectedHold) === item
                const fits = isCurrent || sizeFits(item)
                return (
                  <button
                    className={`button button-reset${isCurrent ? ' selected' : ''}`}
                    disabled={!fits}
                    key={item}
                    onClick={() => resizeHold(item)}
                    title={fits ? `Make this a ${item} hold` : `A ${item} hold would overlap a neighboring hold`}
                    type="button"
                  >
                    {item}
                  </button>
                )
              })}
            </div>
            <button className="button button-reset" onClick={cycleRole} type="button">Cycle role</button>
            <button className="button button-reset" onClick={rotateHold} type="button">Rotate 45°</button>
            <button className="button button-danger" onClick={removeHold} type="button">Remove</button>
            <button className="button button-reset" onClick={() => setSelectedCell(null)} type="button">Done</button>
          </div>
        )}
        <WallComponent holds={holds} wallType={wallType?.name} angle={angle} placingSize={holdSize} editable onCellClick={handleCellClick} onPlacedHoldClick={handlePlacedHoldClick} />
        <HoldLegend />
      </div>
    </form>
  )
}

export default RouteForm
