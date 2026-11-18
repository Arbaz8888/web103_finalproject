// Ctrl/Cmd+Z undo, Delete/Backspace remove, R rotate, Escape deselect.
// Ignored while typing in a field or using the rotation slider.
import { useEffect, useEffectEvent } from 'react'

const ROTATE_STEP = 15

const isTyping = (target) =>
  ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable

export function useBuilderShortcuts({ onUndo, onRemove, onRotate, onDeselect, hasSelection }) {
  const onKeyDown = useEffectEvent((event) => {
    if (isTyping(event.target) || event.target.getAttribute('role') === 'slider') return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      onUndo()
    } else if (hasSelection && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault()
      onRemove()
    } else if (hasSelection && event.key.toLowerCase() === 'r') {
      onRotate(ROTATE_STEP)
    } else if (event.key === 'Escape') {
      onDeselect()
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
