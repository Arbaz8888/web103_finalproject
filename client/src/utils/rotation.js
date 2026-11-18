// Any angle -> 0..maxRotation (some starter routes store negative rotations like -10).
// maxRotation defaults to 359 (a full 0–359° range).
export const normalizeRotation = (degrees = 0, maxRotation = 359) => {
  const turn = maxRotation + 1
  return ((Math.round(degrees) % turn) + turn) % turn
}
