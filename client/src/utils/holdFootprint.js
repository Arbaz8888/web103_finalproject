// Footprint math for holds on the 12 x 16 bolt grid. Distances are in bolt cells.

export const SIZES = ['small', 'medium', 'large']

// How big each size is drawn, as a multiple of one bolt cell. Medium is the baseline:
// small is 50% of medium and large is 150% of medium.
const MEDIUM_SCALE = 1.6
export const HOLD_SCALE = { small: MEDIUM_SCALE * 0.5, medium: MEDIUM_SCALE, large: MEDIUM_SCALE * 1.5 }

// The hold itself fills about 85% of its square PNG; the rest is transparent padding.
const VISIBLE_FRACTION = 0.85

// Every hold PNG is the same square canvas, so it's scaled by the hold's size tag.
// Falls back to the size in the filename (e.g. jug-green-large.png), then medium.
export function getHoldSize(hold) {
  if (SIZES.includes(hold.size)) return hold.size
  return SIZES.find((size) => hold.imageUrl?.includes(size)) ?? 'medium'
}

// Radius of the circle a hold of this size visibly covers, in bolt cells
// (small ≈ 0.34, medium ≈ 0.68, large ≈ 1.02).
export function getFootprintRadius(size) {
  return (HOLD_SCALE[size] * VISIBLE_FRACTION) / 2
}

// Map of "row-col" -> hold for every bolt hole hidden under a neighboring hold.
// A bolt counts as covered when its center falls inside the hold's footprint,
// e.g. a large hold covers the four bolts directly around it.
export function getCoveredBolts(holds) {
  const covered = new Map()
  for (const hold of holds) {
    const radius = getFootprintRadius(getHoldSize(hold))
    const reach = Math.floor(radius)
    for (let row = hold.row - reach; row <= hold.row + reach; row++) {
      for (let col = hold.col - reach; col <= hold.col + reach; col++) {
        const isOwnCell = row === hold.row && col === hold.col
        const key = `${row}-${col}`
        if (!isOwnCell && !covered.has(key) && Math.hypot(row - hold.row, col - hold.col) <= radius) {
          covered.set(key, hold)
        }
      }
    }
  }
  return covered
}

// The first hold that a new hold of `size` bolted at (row, col) would overlap, or undefined.
// Two holds overlap when their footprint circles intersect.
export function findOverlappingHold(row, col, size, holds) {
  const radius = getFootprintRadius(size)
  return holds.find(
    (hold) => Math.hypot(row - hold.row, col - hold.col) < radius + getFootprintRadius(getHoldSize(hold)),
  )
}
