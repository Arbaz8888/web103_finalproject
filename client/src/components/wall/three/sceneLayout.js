// Shared numbers and geometry helpers for the 3D scene: sizes, colors, grid -> wall mapping, camera views.
export const CELL = 0.5
export const THICKNESS = 0.18
export const KICKER = 0.5 // the wall starts this far off the floor so pads don't hide the bottom row
export const CEILING = 16

export const SCENE_BG = '#14171a'
export const SHOWCASE_BG = '#0c0e10' // matches the page background so the homepage scene fades into it

// Grid cell -> point on the wall face, with the wall's center at the origin
export function createWallLayout(rows, cols) {
  const width = cols * CELL
  const height = rows * CELL
  const toWallX = (col) => (col - (cols - 1) / 2) * CELL
  const toWallY = (row) => ((rows - 1) / 2 - row) * CELL
  return { width, height, toWallX, toWallY }
}

// A point on the wall face (height up the wall, distance out from it) in world space
export function wallPoint(tilt, up, out = 0) {
  return [0, KICKER + up * Math.cos(tilt) - out * Math.sin(tilt), up * Math.sin(tilt) + out * Math.cos(tilt)]
}

// Where the camera starts (far out, for the intro glide) and where it settles, worked out
// from the tilt so steep walls stay in frame. After that the viewer drags to look around.
export function getViews(tilt, height) {
  const lean = Math.sin(Math.max(tilt, 0))
  const center = wallPoint(tilt, height / 2)
  return {
    intro: { position: [12, center[1] + 5, center[2] + 20], target: center },
    home: { position: [7.5, Math.max(center[1] + 1.5 - 2.5 * lean, 1.1), center[2] + 13 + 3 * lean], target: center },
  }
}

export const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2
