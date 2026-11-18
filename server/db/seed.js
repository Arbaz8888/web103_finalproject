import WallTypes from '../data/WallTypes.js';
import StartingHolds from '../data/StartingHolds.js';
import StartingRoutes from '../data/StartingRoutes.js';
import StartingRouteHolds from '../data/StartingRouteHolds.js';

// Explicit ids are inserted, so move the SERIAL sequence past them to avoid collisions on later inserts.
// table must be a hardcoded table name, never user input (it is interpolated into the SQL).
const resetIdSequence = async (client, table) => {
	await client.query(
		`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`
	);
};

// Order matters because of foreign keys: wall_types and climbing_holds come first
export const seedReferenceData = async (client) => {
	for (const wallType of WallTypes) {
		await client.query(
			'INSERT INTO wall_types (id, name, min_angle, max_angle, description) VALUES ($1, $2, $3, $4, $5)',
			[wallType.id, wallType.name, wallType.min_angle, wallType.max_angle, wallType.description]
		);
	}
	await resetIdSequence(client, 'wall_types');

	for (const hold of StartingHolds) {
		await client.query(
			'INSERT INTO climbing_holds (id, name, hold_type, size, color, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
			[hold.id, hold.name, hold.hold_type, hold.size, hold.color, hold.image_url]
		);
	}
	await resetIdSequence(client, 'climbing_holds');
};

export const seedStarterRoutes = async (client) => {
	// Clears every route (and its holds) so only the starter routes remain
	await client.query('TRUNCATE route_holds, climbing_routes RESTART IDENTITY');

	for (const route of StartingRoutes) {
		await client.query(
			'INSERT INTO climbing_routes (id, name, grade, angle_degrees, wall_type_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
			[route.id, route.name, route.grade, route.angle_degrees, route.wall_type_id, route.created_at]
		);
	}
	await resetIdSequence(client, 'climbing_routes');

	for (const routeHold of StartingRouteHolds) {
		await client.query(
			'INSERT INTO route_holds (id, route_id, hold_id, grid_row, grid_col, role, rotation) VALUES ($1, $2, $3, $4, $5, $6, $7)',
			[
				routeHold.id,
				routeHold.route_id,
				routeHold.hold_id,
				routeHold.grid_row,
				routeHold.grid_col,
				routeHold.role,
				routeHold.rotation,
			]
		);
	}
	await resetIdSequence(client, 'route_holds');
};
