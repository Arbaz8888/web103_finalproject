import { useEffect } from 'react'
import { APP_NAME } from '../config/app'

// Sets the browser tab title, e.g. "Moonwalk · BetaSpray"
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
