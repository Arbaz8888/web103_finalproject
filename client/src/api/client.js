// In dev, Vite proxies /api to the Express server (see vite.config.js).
// In production, VITE_API_URL is the absolute origin of the API.
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
