// Frontend API layer for the hold catalog
import { request } from './client'

// The server already sends camelCase fields (id, name, holdType, size, color, imageUrl)
export const getHolds = () => request('/holds')
