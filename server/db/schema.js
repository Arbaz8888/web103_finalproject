import { GRID_COLS, GRID_ROWS } from '../config/rules.js';

// Drops and recreates every table and enum. Runs on the client of a transaction.
export const createSchema = async (client) => {
	await client.query(`
		DROP TABLE IF EXISTS route_holds, climbing_routes, climbing_holds, wall_types CASCADE;
		DROP TYPE IF EXISTS hold_roles, grades, hold_sizes, hold_types, wall_angles;

		CREATE TYPE wall_angles AS ENUM ('slab', 'vertical', 'overhang', 'roof');
		CREATE TYPE hold_types AS ENUM ('crimp', 'jug', 'sloper', 'pocket', 'pinch');
		CREATE TYPE hold_sizes AS ENUM ('small', 'medium', 'large');
		CREATE TYPE grades AS ENUM ('V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12');
		CREATE TYPE hold_roles AS ENUM ('start', 'hand', 'foot', 'any', 'finish');

		CREATE TABLE wall_types (
			id SERIAL PRIMARY KEY,
			name wall_angles NOT NULL UNIQUE,
			min_angle INTEGER,
			max_angle INTEGER,
			description VARCHAR
		);

		CREATE TABLE climbing_holds (
			id SERIAL PRIMARY KEY,
			name VARCHAR NOT NULL,
			hold_type hold_types,
			size hold_sizes,
			color VARCHAR NOT NULL,
			image_url TEXT
		);

		CREATE TABLE climbing_routes (
			id SERIAL PRIMARY KEY,
			name VARCHAR NOT NULL,
			grade grades NOT NULL,
			angle_degrees INTEGER NOT NULL,
			wall_type_id INTEGER NOT NULL REFERENCES wall_types(id),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE route_holds (
			id SERIAL PRIMARY KEY,
			route_id INTEGER NOT NULL REFERENCES climbing_routes(id) ON DELETE CASCADE,
			hold_id INTEGER NOT NULL REFERENCES climbing_holds(id) ON DELETE CASCADE,
			grid_row INTEGER NOT NULL CHECK (grid_row BETWEEN 0 AND ${GRID_ROWS - 1}),
			grid_col INTEGER NOT NULL CHECK (grid_col BETWEEN 0 AND ${GRID_COLS - 1}),
			role hold_roles,
			rotation INTEGER NOT NULL DEFAULT 0,
			CONSTRAINT unique_hold_position_per_route UNIQUE (route_id, grid_row, grid_col)
		);
	`);
};
