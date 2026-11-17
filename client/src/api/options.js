// Allowed grades, hold roles, hold types and hold sizes, straight from the database enums
import { request } from './routes'

export async function getOptions() {
  const data = await request('/options')
  return {
    grades: data.grades,
    holdRoles: data.hold_roles,
    holdTypes: data.hold_types,
    holdSizes: data.hold_sizes,
    maxStartHolds: data.max_start_holds,
    finishHolds: data.finish_holds,
  }
}
