// Any angle -> 0..359 (some starter routes store negative rotations like -10)
export const normalizeRotation = (degrees = 0) => ((Math.round(degrees) % 360) + 360) % 360
