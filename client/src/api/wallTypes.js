// Frontend API layer for wall types (slab, vertical, overhang, roof).
import { capitalize } from './routes'
import { request } from './client'

export const getWallTypes = async () =>
  (await request('/wall-types')).map((type) => ({ ...type, name: capitalize(type.name) }))
