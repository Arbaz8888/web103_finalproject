import { useEffect } from 'react'

// Sets the browser tab title, e.g. "Moonwalk · Crux Maker"
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Crux Maker` : 'Crux Maker'
  }, [title])
}
