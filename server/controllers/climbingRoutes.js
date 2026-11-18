import { pool, withTransaction } from '../config/database.js';
import { seedStarterRoutes } from '../db/seed.js';
import {
	FINISH_HOLDS,
	GRID_COLS,
	GRID_ROWS,
	MAX_ROTATION,
	MAX_ROUTE_NAME_LENGTH,
	MAX_START_HOLDS,
	MIN_START_HOLDS,
} from '../config/rules.js';

// Each route comes back with its wall type and an array of its placed holds
const SELECT_ROUTES = `
	SELECT
		cr.id,
		cr.name,
		cr.grade,
		cr.angle_degrees,
		cr.wall_type_id,
		wt.name AS wall_type,
		cr.created_at,
		COALESCE(
			json_agg(
				json_build_object(
					'routeHoldId', rh.id,
					'holdId', rh.hold_id,
					'imageUrl', ch.image_url,
					'size', ch.size,
					'holdType', ch.hold_type,
					'color', ch.color,
					'gridRow', rh.grid_row,
					'gridCol', rh.grid_col,
					'role', rh.role,
					'rotation', rh.rotation
				) ORDER BY rh.id
			) FILTER (WHERE rh.id IS NOT NULL),
			'[]'
		) AS holds
	FROM climbing_routes cr
	JOIN wall_types wt ON wt.id = cr.wall_type_id
	LEFT JOIN route_holds rh ON rh.route_id = cr.id
	LEFT JOIN climbing_holds ch ON ch.id = rh.hold_id
`;


// Save Check: a route needs a name, grade, wall type, angle, valid holds, 1-2 start holds and exactly one finish hold
const validateRoute = ({ name, grade, wall_type_id, angle_degrees, holds } = {}) => {
	if (!name?.trim() || !grade || !wall_type_id) {
		return 'A route needs a name, grade, and wall type.';
	}
	if (name.trim().length > MAX_ROUTE_NAME_LENGTH) {
		return `Route names can be at most ${MAX_ROUTE_NAME_LENGTH} characters.`;
	}
	if (!Number.isInteger(angle_degrees)) {
		return 'A route needs a wall angle in degrees.';
	}
	if (!Array.isArray(holds)) {
		return 'A route needs a holds array.';
	}
	for (const hold of holds) {
		if (!Number.isInteger(hold?.holdId)) {
			return 'Each hold needs a hold id.';
		}
		const rowOk = Number.isInteger(hold.gridRow) && hold.gridRow >= 0 && hold.gridRow < GRID_ROWS;
		const colOk = Number.isInteger(hold.gridCol) && hold.gridCol >= 0 && hold.gridCol < GRID_COLS;
		if (!rowOk || !colOk) {
			return 'A hold is placed off the wall.';
		}
		if (typeof hold.role !== 'string') {
			return 'Each hold needs a role.';
		}
	}
	const spots = new Set(holds.map((hold) => `${hold.gridRow},${hold.gridCol}`));
	if (spots.size !== holds.length) {
		return "Two holds can't share the same spot on the wall.";
	}
	const starts = holds.filter((hold) => hold.role === 'start').length;
	const finishes = holds.filter((hold) => hold.role === 'finish').length;
	if (starts < MIN_START_HOLDS || starts > MAX_START_HOLDS) {
		return `A route needs 1 or ${MAX_START_HOLDS} start holds.`;
	}
	if (finishes !== FINISH_HOLDS) {
		return 'A route needs exactly one finish hold.';
	}
	if (holds.some((hold) => !Number.isInteger(hold.rotation) || hold.rotation < 0 || hold.rotation > MAX_ROTATION)) {
		return 'Hold rotation must be a whole number from 0 to 359 degrees.';
	}
	return null;
};

// The wall type must be the one whose angle range contains the route's angle
const wallTypeMatchesAngle = async (db, wallTypeId, angle) => {
	const results = await db.query(
		'SELECT 1 FROM wall_types WHERE id = $1 AND $2 BETWEEN min_angle AND max_angle',
		[wallTypeId, angle]
	);
	return results.rowCount > 0;
};

const insertRouteHolds = (client, routeId, holds) => {
	const values = [routeId];
	const rows = holds.map((hold) => {
		values.push(hold.holdId, hold.gridRow, hold.gridCol, hold.role, hold.rotation);
		const n = values.length;
		return `($1, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`;
	});

	return client.query(
		`INSERT INTO route_holds (route_id, hold_id, grid_row, grid_col, role, rotation)
		VALUES ${rows.join(', ')}`,
		values
	);
};

// db is the pool, or a transaction client when the route must be read before COMMIT
const findRoute = async (db, id) => {
	const results = await db.query(`${SELECT_ROUTES} WHERE cr.id = $1 GROUP BY cr.id, wt.id`, [id]);
	return results.rows[0];
};

const getRoutes = async (req, res) => {
	const results = await pool.query(
		`${SELECT_ROUTES} GROUP BY cr.id, wt.id ORDER BY cr.created_at DESC`
	);
	res.status(200).json(results.rows);
};

const getRouteById = async (req, res) => {
	const route = await findRoute(pool, req.params.id);
	if (!route) {
		return res.status(404).json({ error: 'Route not found.' });
	}
	res.status(200).json(route);
};

const createRoute = async (req, res) => {
	const message = validateRoute(req.body);
	if (message) {
		return res.status(400).json({ error: message });
	}

	const { name, grade, angle_degrees, wall_type_id, holds } = req.body;
	if (!(await wallTypeMatchesAngle(pool, wall_type_id, angle_degrees))) {
		return res.status(400).json({ error: "The wall type doesn't match the wall angle." });
	}

	const route = await withTransaction(async (client) => {
		const results = await client.query(
			'INSERT INTO climbing_routes (name, grade, angle_degrees, wall_type_id) VALUES ($1, $2, $3, $4) RETURNING id',
			[name.trim(), grade, angle_degrees, wall_type_id]
		);
		const routeId = results.rows[0].id;
		await insertRouteHolds(client, routeId, holds);
		return findRoute(client, routeId);
	});
	res.status(201).json(route);
};

const updateRoute = async (req, res) => {
	const message = validateRoute(req.body);
	if (message) {
		return res.status(400).json({ error: message });
	}

	const { id } = req.params;
	const { name, grade, angle_degrees, wall_type_id, holds } = req.body;
	if (!(await wallTypeMatchesAngle(pool, wall_type_id, angle_degrees))) {
		return res.status(400).json({ error: "The wall type doesn't match the wall angle." });
	}

	// Returns null when no route has this id (nothing was written, so COMMIT is harmless)
	const route = await withTransaction(async (client) => {
		const results = await client.query(
			'UPDATE climbing_routes SET name = $1, grade = $2, angle_degrees = $3, wall_type_id = $4 WHERE id = $5',
			[name.trim(), grade, angle_degrees, wall_type_id, id]
		);
		if (results.rowCount === 0) {
			return null;
		}

		// Swap out all the old holds for the new ones
		await client.query('DELETE FROM route_holds WHERE route_id = $1', [id]);
		await insertRouteHolds(client, id, holds);
		return findRoute(client, id);
	});
	if (!route) {
		return res.status(404).json({ error: 'Route not found.' });
	}
	res.status(200).json(route);
};

const deleteRoute = async (req, res) => {
	// route_holds rows go away on their own (ON DELETE CASCADE)
	const results = await pool.query(
		'DELETE FROM climbing_routes WHERE id = $1 RETURNING id',
		[req.params.id]
	);
	if (results.rowCount === 0) {
		return res.status(404).json({ error: 'Route not found.' });
	}
	res.status(200).json({ id: results.rows[0].id });
};

const resetRoutes = async (req, res) => {
	await withTransaction(seedStarterRoutes);
	res.status(200).json({ message: 'Wall reset to starter routes.' });
};

export default {
	getRoutes,
	getRouteById,
	createRoute,
	updateRoute,
	deleteRoute,
	resetRoutes,
};
