// Frontend API layer for the hold catalog
import { request } from './routes'

// The server already sends camelCase fields (id, name, holdType, size, color, imageUrl)
export const fetchHolds = () => request('/holds')
