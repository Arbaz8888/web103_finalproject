// Frontend API layer for climbing routes.
import { request } from './client'
import { normalizeRotation } from '../utils/rotation'
export { request } from './client'

// Drops display-only fields (imageUrl, size, holdType, color, wallTypeId, wallType, createdAt)
// that placed holds carry in the builder but the API doesn't accept.
function toApiRoute(route) {
  return {
    name: route.name,
    grade: route.grade,
    angleDegrees: route.angleDegrees,
    holds: route.holds.map(({ holdId, gridRow, gridCol, role, rotation }) => ({
      holdId,
      gridRow,
      gridCol,
      role,
      rotation: normalizeRotation(rotation),
    })),
  }
}

export const getRoutes = () => request('/routes')

export const getRoute = (id) => request(`/routes/${id}`)

export const createRoute = (route) =>
  request('/routes', { method: 'POST', body: JSON.stringify(toApiRoute(route)) })

export const updateRoute = (route) =>
  request(`/routes/${route.id}`, { method: 'PUT', body: JSON.stringify(toApiRoute(route)) })

export const deleteRoute = (id) => request(`/routes/${id}`, { method: 'DELETE' })

export const resetRoutes = () => request('/routes/reset', { method: 'POST' })
