import { useRef, useState } from 'react'
import { normalizeRotation } from '../api/routes'
import './RotationDial.css'

// Knob for any rotation from 0 to 359°, plus a box to type an exact value.
// 0° points up and angles go clockwise, matching CSS rotate() on the 2D wall.
// onChange fires continuously while dragging; onChangeEnd fires once when the drag ends.
function RotationDial({ value, onChange, onChangeEnd, imageUrl }) {
  const knob = useRef(null)
  const [dragging, setDragging] = useState(false)
  // What's typed in the box while editing; null shows the current value
  const [draft, setDraft] = useState(null)

  function angleFromPointer(event) {
    const box = knob.current.getBoundingClientRect()
    const x = event.clientX - (box.left + box.width / 2)
    const y = event.clientY - (box.top + box.height / 2)
    return normalizeRotation((Math.atan2(x, -y) * 180) / Math.PI)
  }

  function handlePointerDown(event) {
    event.preventDefault()
    knob.current.setPointerCapture(event.pointerId)
    knob.current.focus()
    setDragging(true)
    onChange(angleFromPointer(event))
  }

  function handlePointerMove(event) {
    if (dragging) onChange(angleFromPointer(event))
  }

  function handlePointerUp() {
    if (!dragging) return
    setDragging(false)
    onChangeEnd?.()
  }

  function handleKeyDown(event) {
    const step = event.shiftKey ? 15 : 1
    const moves = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 45, PageDown: -45 }
    if (event.key in moves) onChange(normalizeRotation(value + moves[event.key]))
    else if (event.key === 'Home') onChange(0)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  function commitText() {
    const number = Number(draft)
    if (draft !== null && draft.trim() !== '' && !Number.isNaN(number)) onChange(normalizeRotation(number))
    setDraft(null)
  }

  return (
    <div className="rotation-dial">
      <div
        ref={knob}
        className={`dial${dragging ? ' dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Hold rotation"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={value}
        aria-valuetext={`${value} degrees`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {[0, 90, 180, 270].map((tick) => (
          <span key={tick} className="dial-tick" style={{ transform: `rotate(${tick}deg)` }} />
        ))}
        {imageUrl && <img className="dial-preview" src={imageUrl} alt="" draggable={false} style={{ transform: `rotate(${value}deg)` }} />}
        <span className="dial-handle" style={{ transform: `rotate(${value}deg)` }}>
          <i />
        </span>
      </div>
      <label className="dial-input">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={359}
          value={draft ?? value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitText()
            }
          }}
          aria-label="Rotation in degrees"
        />
        <span aria-hidden="true">°</span>
      </label>
    </div>
  )
}

export default RotationDial
