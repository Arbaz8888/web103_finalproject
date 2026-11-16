import { useCallback, useState } from 'react'
import { ToastContext } from '../../hooks/useToast'
import './ToastProvider.css'

let nextId = 1

// Small stack of messages in the corner that clear themselves after a few seconds
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const toast = useCallback(
    (message, tone = 'success') => {
      const id = nextId++
      setToasts((current) => [...current.slice(-2), { id, message, tone }])
      setTimeout(() => dismiss(id), 3800)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div className={`toast toast-${item.tone}`} key={item.id}>
            <span className="toast-icon" aria-hidden="true">{item.tone === 'error' ? '!' : '✓'}</span>
            <span>{item.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(item.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
