// Frontend API layer for the hold catalog
import { request } from './routes'

// Server rows are snake_case; the wall and footprint code read camelCase, so map once here.
export async function fetchHolds() {
  const rows = await request('/holds')
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    holdType: row.hold_type,
    size: row.size,
    color: row.color,
    imageUrl: row.image_url,
  }))
}
