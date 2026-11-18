import { pool } from '../config/database.js';
import {
	DEFAULT_HOLD_ROLE,
	FINISH_HOLDS,
	GRID_COLS,
	GRID_ROWS,
	MAX_ROTATION,
	MAX_ROUTE_NAME_LENGTH,
	MAX_START_HOLDS,
	MIN_START_HOLDS,
} from '../config/rules.js';

// Serves the allowed values for grades and hold fields (straight from the database enums,
// see db/schema.js) plus every rule in config/rules.js, so the frontend never keeps its own copy.
const getOptions = async (req, res) => {
	const results = await pool.query(`
		SELECT
			enum_range(NULL::grades)::text[] AS grades,
			enum_range(NULL::hold_roles)::text[] AS "holdRoles",
			enum_range(NULL::hold_types)::text[] AS "holdTypes",
			enum_range(NULL::hold_sizes)::text[] AS "holdSizes"
	`);
	res.status(200).json({
		...results.rows[0],
		gridRows: GRID_ROWS,
		gridCols: GRID_COLS,
		minStartHolds: MIN_START_HOLDS,
		maxStartHolds: MAX_START_HOLDS,
		finishHolds: FINISH_HOLDS,
		maxRotation: MAX_ROTATION,
		maxNameLength: MAX_ROUTE_NAME_LENGTH,
		defaultHoldRole: DEFAULT_HOLD_ROLE,
	});
};

export default { getOptions };
