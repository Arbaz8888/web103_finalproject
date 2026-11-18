import { pool } from '../config/database.js';

const getWallTypes = async (req, res) => {
	const results = await pool.query(
		'SELECT id, name, min_angle, max_angle, description FROM wall_types ORDER BY min_angle'
	);
	res.status(200).json(results.rows);
};

export default { getWallTypes };
