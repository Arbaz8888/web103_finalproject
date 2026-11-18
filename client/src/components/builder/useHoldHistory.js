// The holds on the wall plus an undo stack. Every change goes through commit() so it can be undone.
import { useState } from 'react'

const HISTORY_LIMIT = 50

export function useHoldHistory(initialHolds) {
  const [holds, setHolds] = useState(initialHolds ?? [])
  const [history, setHistory] = useState([])

  // Push current holds onto the undo stack without changing them (used at the start of a drag)
  function checkpoint() {
    setHistory((past) => [...past.slice(-(HISTORY_LIMIT - 1)), holds])
  }

  // Replace holds; optionally skip recording so a drag's intermediate frames don't flood the stack
  function commit(next, { record = true } = {}) {
    if (record) setHistory((past) => [...past.slice(-(HISTORY_LIMIT - 1)), holds])
    setHolds(next)
  }

  function undo() {
    if (history.length === 0) return false
    setHolds(history[history.length - 1])
    setHistory((past) => past.slice(0, -1))
    return true
  }

  function clear() {
    if (holds.length === 0) return
    setHistory((past) => [...past.slice(-(HISTORY_LIMIT - 1)), holds])
    setHolds([])
  }

  return { holds, canUndo: history.length > 0, commit, checkpoint, undo, clear }
}
