import './dotenv.js';
import { pool, withTransaction } from './database.js';
import { createSchema } from '../db/schema.js';
import { seedReferenceData, seedStarterRoutes } from '../db/seed.js';

// npm run reset: rebuild every table and enum, then load the starter data.
// Runs in one transaction, so a failure leaves the database untouched.
try {
	await withTransaction(async (client) => {
		await createSchema(client);
		await seedReferenceData(client);
		await seedStarterRoutes(client);
	});
	console.log('🎉 Database reset and seeded');
} catch (error) {
	console.error('⚠️ Database reset failed; no changes were made', error);
	process.exitCode = 1;
} finally {
	await pool.end();
}
