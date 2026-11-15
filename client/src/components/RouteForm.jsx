import { useEffect, useState } from 'react'
import ClimbingWall from './ClimbingWall'
import HoldLegend from './Hold'
import { getHolds, getWallTypes } from '../api'
import { grades } from '../data/grades'

function RouteForm({ existing, onSave }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [grade, setGrade] = useState(existing?.grade ?? 'V0')
  const [wallTypeId, setWallTypeId] = useState(existing?.wallTypeId ?? null)
  const [angle, setAngle] = useState(existing?.angle ?? 0)
  const [role, setRole] = useState('hand')
  const [holdId, setHoldId] = useState(null)
  const [holds, setHolds] = useState(existing?.holds ?? [])
  const [wallTypes, setWallTypes] = useState([])
  const [holdOptions, setHoldOptions] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Load the wall type and hold choices from the API
  useEffect(() => {
    Promise.all([getWallTypes(), getHolds()])
      .then(([types, holdList]) => {
        setWallTypes(types)
        setHoldOptions(holdList)
        setHoldId(holdList[0]?.id ?? null)
        setWallTypeId((current) => current ?? types.find((type) => type.name === 'Vertical')?.id ?? types[0]?.id)
      })
      .catch((err) => setError(err.message))
  }, [])

  const wallType = wallTypes.find((type) => type.id === wallTypeId)

  function handleWallTypeChange(id) {
    const type = wallTypes.find((item) => item.id === id)
    setWallTypeId(id)
    if (type) setAngle(type.min_angle)
  }

  function handleHoldClick(row, col) {
    setHolds((current) => {
      const found = current.find((hold) => hold.row === row && hold.col === col)
      if (found) return current.filter((hold) => hold !== found)
      return [...current, { row, col, role, holdId, rotation: 0 }]
    })
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
        <label>Hold<select value={holdId ?? ''} onChange={(event) => setHoldId(Number(event.target.value))}>{holdOptions.map((hold) => <option key={hold.id} value={hold.id}>{hold.name}</option>)}</select></label>
        <fieldset>
          <legend>Next hold role</legend>
          <div className="role-picker">{['start', 'hand', 'foot', 'finish'].map((item) => <button type="button" className={role === item ? 'selected' : ''} key={item} onClick={() => setRole(item)}>{item}</button>)}</div>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="button button-reset" onClick={() => setHolds([])} type="button">Clear Holds</button>
          <button className="button button-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save route'}</button>
        </div>
      </div>
      <div>
        <p className="wall-instruction">Select <strong>{role}</strong> holds on the wall. Select a hold again to remove it.</p>
        <ClimbingWall holds={holds} interactive onHoldClick={handleHoldClick} />
        <HoldLegend />
      </div>
    </form>
  )
}

export default RouteForm
