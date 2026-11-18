import pg from 'pg';

const config = {
	user: process.env.PGUSER,
	password: process.env.PGPASSWORD,
	host: process.env.PGHOST,
	port: process.env.PGPORT,
	database: process.env.PGDATABASE,
	// Always on: the team's Postgres is hosted on Render, which requires SSL. A local Postgres must have SSL enabled.
	ssl: {
		rejectUnauthorized: false,
	},
};

export const pool = new pg.Pool(config);

// Runs work(client) inside BEGIN/COMMIT on one pooled connection.
// Any thrown error rolls everything back and is rethrown to the caller.
export const withTransaction = async (work) => {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const result = await work(client);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		throw error;
	} finally {
		client.release();
	}
};
