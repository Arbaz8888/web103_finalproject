// Talks to the Express API. In dev, Vite proxies /api to the server (see vite.config.js).
const API_URL = import.meta.env.VITE_API_URL ?? ''

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Try again.')
  return data
}

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1)

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
      row: hold.gridRow,
      col: hold.gridCol,
      role: hold.role,
      rotation: hold.rotation,
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
      rotation: hold.rotation ?? 0,
    })),
  }
}

export const getRoutes = async () => (await request('/routes')).map(toClientRoute)

export const getHolds = () => request('/holds')

export const getWallTypes = async () =>
  (await request('/wall-types')).map((type) => ({ ...type, name: capitalize(type.name) }))

export const createRoute = async (route) =>
  toClientRoute(await request('/routes', { method: 'POST', body: JSON.stringify(toApiRoute(route)) }))

export const updateRoute = async (route) =>
  toClientRoute(await request(`/routes/${route.id}`, { method: 'PATCH', body: JSON.stringify(toApiRoute(route)) }))

export const deleteRoute = (id) => request(`/routes/${id}`, { method: 'DELETE' })

export const resetRoutes = () => request('/routes/reset', { method: 'POST' })
