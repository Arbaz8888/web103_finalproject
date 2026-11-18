// Frontend API layer for wall types (slab, vertical, overhang, roof).
import { request } from './client'

export const getWallTypes = () => request('/wall-types')
