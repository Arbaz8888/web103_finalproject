import { useState } from 'react'
import Dialog from './Dialog'

// "Are you sure?" dialog. onConfirm may be async; the button shows progress while it runs.
function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} className="dialog-confirm" labelledBy="confirm-title">
      <div className={`confirm-icon confirm-icon-${tone}`} aria-hidden="true">!</div>
      <h2 id="confirm-title">{title}</h2>
      <p>{message}</p>
      <div className="dialog-actions">
        <button className="button button-ghost" type="button" onClick={onClose} disabled={busy} autoFocus>
          Cancel
        </button>
        <button className={`button button-${tone}`} type="button" onClick={handleConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}

export default ConfirmDialog
