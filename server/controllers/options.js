import { pool } from '../config/database.js';
import { FINISH_HOLDS, MAX_START_HOLDS } from './climbingRoutes.js';

// The allowed values for grades and hold fields come straight from the database enums
// (see config/reset.js), and the hold limits come from the same rules the save check uses,
// so the frontend never keeps its own copy of any of them.
const getOptions = async (req, res) => {
	try {
		const results = await pool.query(`
			SELECT
				enum_range(NULL::grades)::text[] AS grades,
				enum_range(NULL::hold_roles)::text[] AS hold_roles,
				enum_range(NULL::hold_types)::text[] AS hold_types,
				enum_range(NULL::hold_sizes)::text[] AS hold_sizes
		`);
		res.status(200).json({
			...results.rows[0],
			max_start_holds: MAX_START_HOLDS,
			finish_holds: FINISH_HOLDS,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export default { getOptions };
