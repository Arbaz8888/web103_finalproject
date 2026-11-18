import { formatLabel } from './format'

// How things look on screen. The values themselves (grades, roles, ...) come from the backend;
// this file only decides colors.

export const ROLE_COLORS = { start: '#eab308', hand: '#3b82f6', foot: '#16a34a', finish: '#dc2626' }
const UNKNOWN_ROLE_COLOR = '#9ba39c'
export const roleColor = (role) => ROLE_COLORS[role] ?? UNKNOWN_ROLE_COLOR
export const describeRole = (role) => ({ id: role, label: formatLabel(role), color: roleColor(role) })

// Difficulty band for a grade, by where it falls in the backend's grade list:
// first quarter easy, then moderate, hard, elite
export function gradeTone(grade, grades = []) {
  const index = grades.indexOf(grade)
  if (index < 0 || grades.length < 2) return 'moderate'
  const position = index / (grades.length - 1)
  if (position < 0.2) return 'easy'
  if (position < 0.45) return 'moderate'
  if (position < 0.7) return 'hard'
  return 'elite'
}
