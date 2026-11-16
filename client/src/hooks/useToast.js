import { createContext, useContext } from 'react'

export const ToastContext = createContext(() => {})

// toast('Route saved') or toast('Could not delete', 'error')
export const useToast = () => useContext(ToastContext)
