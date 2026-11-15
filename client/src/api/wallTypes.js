// Frontend API layer for wall types (slab, vertical, overhang, roof).
import { capitalize, request } from './routes'

export const getWallTypes = async () =>
  (await request('/wall-types')).map((type) => ({ ...type, name: capitalize(type.name) }))
