// Frontend API layer for climbing routes. In dev, Vite proxies /api to the server (see vite.config.js).
const API_URL = import.meta.env.VITE_API_URL ?? ''

export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error ?? 'Something went wrong. Try again.')
    error.status = response.status
    throw error
  }
  return data
}

export const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1)

// Any angle -> 0..359 (some starter routes store negative rotations like -10)
export const normalizeRotation = (degrees = 0) => ((Math.round(degrees) % 360) + 360) % 360

// API route -> the shape the components use
function toClientRoute(route) {
  return {
    id: route.id,
    name: route.name,
    grade: route.grade,
    angle: route.angle_degrees,
    wallTypeId: route.wall_type_id,
    wallType: capitalize(route.wall_type),
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
    angle_degrees: route.angle,
    wall_type_id: route.wallTypeId,
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
  toClientRoute(await request(`/routes/${route.id}`, { method: 'PATCH', body: JSON.stringify(toApiRoute(route)) }))

export const deleteRoute = (id) => request(`/routes/${id}`, { method: 'DELETE' })

export const resetRoutes = () => request('/routes/reset', { method: 'POST' })
