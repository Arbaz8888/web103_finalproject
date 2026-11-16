// Same grades the database allows (see the grades enum in server/config/reset.js)
export const grades = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12']

// Difficulty band for coloring grade badges: V0-V2 easy, V3-V5 moderate, V6-V8 hard, V9+ elite
export function gradeTone(grade) {
  const index = grades.indexOf(grade)
  if (index <= 2) return 'easy'
  if (index <= 5) return 'moderate'
  if (index <= 8) return 'hard'
  return 'elite'
}

export const ROLE_COLORS = { start: '#eab308', hand: '#3b82f6', foot: '#16a34a', finish: '#dc2626', any: '#f97316' }

// { start: 2, hand: 6, ... } for a route's holds
export function countRoles(holds) {
  const counts = { start: 0, hand: 0, foot: 0, finish: 0, any: 0 }
  for (const hold of holds) counts[hold.role in counts ? hold.role : 'any'] += 1
  return counts
}
