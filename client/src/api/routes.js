// Frontend API layer for climbing routes.
import { request } from './client'
export { request } from './client'

export const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1)

// Any angle -> 0..359 (some starter routes store negative rotations like -10)
export const normalizeRotation = (degrees = 0) => ((Math.round(degrees) % 360) + 360) % 360

// API route -> the shape the components use
function toClientRoute(route) {
  return {
    id: route.id,
    name: route.name,
    grade: route.grade,
    angle: route.angleDegrees,
    wallType: capitalize(route.wallType),
    createdAt: route.createdAt,
    holds: route.holds.map((hold) => ({
      holdId: hold.holdId,
      imageUrl: hold.imageUrl,
      size: hold.size,
      holdType: hold.holdType,
      color: hold.color,
      row: hold.gridRow,
      col: hold.gridCol,
      role: hold.role,
      rotation: normalizeRotation(hold.rotation),
    })),
  }
}

// Component route -> the body the API expects
function toApiRoute(route) {
  return {
    name: route.name,
    grade: route.grade,
    angleDegrees: route.angle,
    holds: route.holds.map((hold) => ({
      holdId: hold.holdId,
      gridRow: hold.row,
      gridCol: hold.col,
      role: hold.role,
      rotation: normalizeRotation(hold.rotation),
    })),
  }
}

export const getRoutes = async () => (await request('/routes')).map(toClientRoute)

export const getRoute = async (id) => toClientRoute(await request(`/routes/${id}`))

export const createRoute = async (route) =>
  toClientRoute(await request('/routes', { method: 'POST', body: JSON.stringify(toApiRoute(route)) }))

export const updateRoute = async (route) =>
  toClientRoute(await request(`/routes/${route.id}`, { method: 'PUT', body: JSON.stringify(toApiRoute(route)) }))

export const deleteRoute = (id) => request(`/routes/${id}`, { method: 'DELETE' })

export const resetRoutes = () => request('/routes/reset', { method: 'POST' })
