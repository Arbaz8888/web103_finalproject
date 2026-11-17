import { useEffect, useRef } from 'react'
import './Dialog.css'

// Native <dialog>: traps focus, closes on Escape, and dims the page behind it.
// Clicking the dimmed backdrop also closes it.
function Dialog({ open, onClose, className = '', labelledBy, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      {open && children}
    </dialog>
  )
}

export default Dialog
