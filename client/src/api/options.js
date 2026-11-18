// Allowed grades, hold roles, hold types and hold sizes, straight from the database enums,
// plus the hold-count limits from the server's rules
import { request } from './routes'

export const getOptions = () => request('/options')
