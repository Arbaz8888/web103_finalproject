import { useEffect } from 'react'

// Feeds the mouse position to CSS (--mx, --my) for the spotlight that follows the cursor.
// Mouse only, once per frame; touch screens and reduced motion skip it.
export function usePointerGlow() {
  useEffect(() => {
    if (window.matchMedia('(hover: none), (prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    let frame = 0
    function onMove(event) {
      if (frame) return
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--mx', `${event.clientX}px`)
        root.style.setProperty('--my', `${event.clientY}px`)
        frame = 0
      })
    }
    root.classList.add('has-glow')
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
      root.classList.remove('has-glow')
    }
  }, [])
}
