// Domain rules shared by validation, the DB schema, and GET /api/options.
// The frontend reads these from /api/options instead of keeping its own copy.
export const GRID_ROWS = 16; // rows 0-15, row 0 is the top of the wall
export const GRID_COLS = 12; // cols 0-11
export const MIN_START_HOLDS = 1;
export const MAX_START_HOLDS = 2;
export const FINISH_HOLDS = 1;
export const MAX_ROTATION = 359; // inclusive; rotation is 0-359 degrees
export const MAX_ROUTE_NAME_LENGTH = 60;
export const DEFAULT_HOLD_ROLE = 'hand'; // role a newly placed hold starts with
