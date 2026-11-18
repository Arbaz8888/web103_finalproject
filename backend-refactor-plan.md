# Backend Refactor Plan

This plan fixes the issues found in the backend review (see `ARCHITECTURE.md` and `AGENTS.md` for how the system works today). Every decision below was confirmed by the project owner. **Do not change behavior beyond what a step describes.** If something in the code doesn't match what a step expects, stop and ask instead of improvising.

## Ground rules for the implementer

- **Branch:** create `refactor/backend` from `main`. Make **one commit per step** (Step 0 has no commit). Do not push or open a PR.
- **Database:** the `.env` points at the team's shared Render Postgres. Writes are allowed there, including `npm run reset`. Running `npm run reset` deletes every user-created route. That's expected and approved.
- **SSL stays always-on** in `server/config/database.js`. Don't change it.
- **The MVP must keep working.** All 13 stories in `planning/user_stories.md` must work after every step.
- **Style:** the server uses ESM, tabs and single quotes. The client uses ESM, 2-space indents, single quotes and no semicolons. Match the file you're editing.
- **Verify every step** with the commands listed under it before committing:
  - Start the server with `node server.js` from `/server` (it listens on port 3000) and stop it when you're done.
  - Any step that touches `/client` must also pass `npm run lint --prefix client` and `npm run build --prefix client` from the repo root.
- All `curl` examples assume bash and `API=http://localhost:3000/api`.

## Final API contract (target state after all steps)

Use this as the reference for what "done" looks like.

| Method & path | Success | Failure |
|---|---|---|
| `GET /api/options` | 200 `{ grades, holdRoles, holdTypes, holdSizes, gridRows, gridCols, minStartHolds, maxStartHolds, finishHolds, maxRotation, maxNameLength, defaultHoldRole }` | 500 |
| `GET /api/wall-types` | 200 `[{ id, name, minAngle, maxAngle, description }]` | 500 |
| `GET /api/holds` | 200 `[{ id, name, holdType, size, color, imageUrl }]` | 500 |
| `GET /api/routes` | 200 `[Route]`, newest first | 500 |
| `GET /api/routes/:id` | 200 `Route` | 404 (missing **or** malformed id) |
| `POST /api/routes` | 201 `Route` | 400 friendly message |
| `PUT /api/routes/:id` | 200 `Route` | 400 / 404 |
| `DELETE /api/routes/:id` | 200 `{ id }` | 404 |
| `POST /api/routes/reset` | 200 `{ message }`; reseeds **routes only**, in one transaction | 500 |
| anything else under `/api` | — | 404 JSON `{ error: 'Not found.' }` |

```jsonc
// Route (response)
{
  "id": 1, "name": "Easy Test", "grade": "V1",
  "angleDegrees": 0, "wallTypeId": 2, "wallType": "vertical",
  "createdAt": "2025-09-01T10:00:00.000Z",
  "holds": [{ "routeHoldId": 1, "holdId": 6, "imageUrl": "...", "size": "large", "holdType": "jug",
              "color": "green", "gridRow": 14, "gridCol": 4, "role": "start", "rotation": 0 }]
}

// Route body (POST / PUT). No wall type id: the server derives it from the angle.
{ "name": "My Route", "grade": "V3", "angleDegrees": 20,
  "holds": [{ "holdId": 6, "gridRow": 14, "gridCol": 4, "role": "start", "rotation": 0 }] }
```

Every error body is `{ "error": "<user-readable message>" }`. Postgres error text never reaches the client.

---

## Step 0: Setup (no commit)

1. `git checkout main && git pull && git checkout -b refactor/backend`
2. Start the server and confirm `curl -s $API/routes` returns JSON. This is your baseline.

---

## Step 1: Move shared rules into `server/config/rules.js`

**Why:** the hold limits live in a controller, `options.js` imports them from another controller, and the grid size is hard-coded. Later steps need one place to read these rules from. This step changes no behavior.

1. Create `server/config/rules.js`:
   ```js
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
   ```
2. In `server/controllers/climbingRoutes.js`:
   - Delete the `MAX_START_HOLDS`, `FINISH_HOLDS` and `MAX_ROTATION` declarations and import them from `../config/rules.js` instead.
   - Replace the old `hold.rotation >= MAX_ROTATION` check with `hold.rotation > MAX_ROTATION`, because the meaning changed from exclusive 360 to inclusive 359.
   - Use `MIN_START_HOLDS` where the code currently has a literal `1` for starts.
3. In `server/controllers/options.js`, import `FINISH_HOLDS` and `MAX_START_HOLDS` from `../config/rules.js` instead of `./climbingRoutes.js`.

**Verify:** `GET /api/options` still returns `max_start_holds: 2, finish_holds: 1`. A POST with zero start holds still returns 400 `A route needs 1 or 2 start holds.`

**Commit:** `refactor(server): move shared domain rules into config/rules.js`

---

## Step 2: Split schema and seed out of `config/reset.js`, and stop swallowing errors

**Why (review items 1 and 9, plus the `IF NOT EXISTS` nit from item 12):**
- Every create/seed helper catches and logs its own error, so a failed reset still "succeeds."
- A controller imports a CLI script.
- `CREATE TABLE IF NOT EXISTS` right after `DROP TABLE` is redundant.

1. **Add a transaction helper** to `server/config/database.js`, below `pool`:
   ```js
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
   ```
2. **Create `server/db/schema.js`** exporting `createSchema(client)`. It runs one multi-statement query that:
   - drops all tables in a single statement: `DROP TABLE IF EXISTS route_holds, climbing_routes, climbing_holds, wall_types CASCADE;`
   - drops all five enum types: `DROP TYPE IF EXISTS hold_roles, grades, hold_sizes, hold_types, wall_angles;`
   - recreates the five enums and four tables exactly as `config/reset.js` defines them today, **without** `IF NOT EXISTS`.
   - builds the grid `CHECK`s from `rules.js`: `CHECK (grid_row BETWEEN 0 AND ${GRID_ROWS - 1})` and `CHECK (grid_col BETWEEN 0 AND ${GRID_COLS - 1})`.
   - **Don't** add the rotation `CHECK` yet; that's Step 4.
3. **Create `server/db/seed.js`.** Its functions take a `client` and **must not catch errors or log per row**.
   - `resetIdSequence(client, table)`: same SQL as today. Add a comment that `table` must be a hardcoded table name, never user input.
   - `seedReferenceData(client)`: inserts `WallTypes`, then `StartingHolds`, with explicit ids, then resets both sequences.
   - `seedStarterRoutes(client)`: inserts `StartingRoutes`, then `StartingRouteHolds`, then resets both sequences. Step 3 extends this function.
   - Import the data files from `../data/`.
4. **Rewrite `server/config/reset.js`** as a thin CLI with no exports and no `process.argv` guard:
   ```js
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
   ```
5. In `server/controllers/climbingRoutes.js`, `resetRoutes` must stop importing from `config/reset.js`. Change it temporarily to:
   ```js
   await withTransaction(async (client) => {
   	await createSchema(client);
   	await seedReferenceData(client);
   	await seedStarterRoutes(client);
   });
   ```
   Step 3 narrows this.

**Verify:**
- `npm run reset` exits 0 and prints one success line.
- `GET /api/routes` shows the 3 starter routes.
- `GET /api/holds` returns 16 holds.
- Temporarily break a seed row (for example set one route's `grade` to `'V99'`), run `npm run reset`, and confirm it exits non-zero and that `GET /api/routes` still returns the previous data. **Revert the break before committing.**

**Commit:** `refactor(server): split schema/seed modules and make reset transactional`

---

## Step 3: Make `POST /api/routes/reset` reseed routes only

**Why (review items 1 and 2):** the button should restore the starter routes, not drop the whole schema. The owner chose to **leave the endpoint unauthenticated** for the demo.

1. In `server/db/seed.js`, make `seedStarterRoutes(client)` start with:
   ```js
   // Clears every route (and its holds) so only the starter routes remain
   await client.query('TRUNCATE route_holds, climbing_routes RESTART IDENTITY');
   ```
   The CLI path from Step 2 still works, because the tables are empty after `createSchema` anyway.
2. In `resetRoutes`, the transaction now calls **only** `seedStarterRoutes(client)`. Remove the `createSchema` and `seedReferenceData` calls and their imports from the controller.
3. `resetRoutes` keeps responding 200 `{ message: 'Wall reset to starter routes.' }`. Error handling is finished in Step 5. For now, errors may fall through to the existing `catch`.

**Verify:**
1. Create a route:
   ```bash
   curl -s -X POST $API/routes -H 'Content-Type: application/json' -d '{"name":"Reset Check","grade":"V2","angle_degrees":10,"wall_type_id":3,"holds":[{"holdId":6,"gridRow":14,"gridCol":4,"role":"start","rotation":0},{"holdId":6,"gridRow":1,"gridCol":6,"role":"finish","rotation":0}]}'
   ```
2. Run `curl -s -X POST $API/routes/reset`. It should return 200.
3. `GET /api/routes` returns exactly ids 1, 2 and 3, and "Reset Check" is gone.
4. `GET /api/holds` still returns 16 holds, and `GET /api/wall-types` still returns 4.
5. Create another route. It should get id `4`, which shows the sequence was reset.

**Commit:** `fix(server): reset endpoint reseeds starter routes only, in a transaction`

---

## Step 4: Schema and seed data fixes (rotation, roles, name length, overlap)

**Why:** review item 3 (the seed data stores negative rotations that the API itself rejects), plus four owner decisions from the frontend review:
- remove the redundant `any` role (`hand` already means hands or feet),
- give `role` a database default,
- enforce the route-name length on the server,
- make the starter routes respect the client's hold-overlap rule.

All of these change the schema or seeds, so they share the one `npm run reset` at the end of this step.

1. In `server/data/StartingRouteHolds.js`, replace each negative rotation `r` with `r + 360`:

   | Seed id | Old | New |
   |---|---|---|
   | 8 | -10 | 350 |
   | 20 | -20 | 340 |
   | 28 | -30 | 330 |
   | 30 | -45 | 315 |

   Search the file for `rotation: -` to make sure there are no others.
2. **Remove the `any` role.** In `server/data/StartingRouteHolds.js`, change `role: 'any'` to `role: 'hand'` on seed ids **9** and **21**, and search the file for `'any'` to make sure there are no others.
3. **Fix the starter-route overlap.** Seed id **3** (route 1, `hold_id: 8`, a large jug at row 15, col 5) overlaps seed id 1 under the client's footprint rule. Change its `hold_id` from `8` to `5` (Baby Blue Small Jug) and leave its position, role and rotation unchanged.
4. In `server/db/schema.js` (import the constants from `rules.js`):
   - `CREATE TYPE hold_roles AS ENUM ('start', 'hand', 'foot', 'finish');`, so `'any'` is removed.
   - `route_holds.role` becomes `role hold_roles NOT NULL DEFAULT '${DEFAULT_HOLD_ROLE}'`.
   - `route_holds.rotation` becomes `rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation BETWEEN 0 AND ${MAX_ROTATION})`.
   - `climbing_routes.name` becomes `name VARCHAR(${MAX_ROUTE_NAME_LENGTH}) NOT NULL`.
5. Run `npm run reset`. This is needed once to apply the schema changes.
6. Leave the client alone. The frontend plan handles the client's side of these changes.

**Verify:**
- `GET /api/routes/1`: the hold at `gridRow 9, gridCol 8` has `rotation: 350`, and the hold at `gridRow 15, gridCol 5` has `holdId: 5`.
- `GET /api/options`: `hold_roles` is `["start","hand","foot","finish"]`.
- POST a route with one hold at `"rotation": -10`. It should return 400 with the existing rotation message.
- Paste this into `node` from the repo root. It should print `0` (no overlapping pairs in any starter route):
  ```js
  const { default: holds } = await import('./server/data/StartingHolds.js');
  const { default: rh } = await import('./server/data/StartingRouteHolds.js');
  const S = { small: 0.8, medium: 1.6, large: 2.4 }, r = (s) => (S[s] * 0.85) / 2;
  const size = Object.fromEntries(holds.map((h) => [h.id, h.size]));
  let n = 0;
  for (const a of rh) for (const b of rh)
    if (a.id < b.id && a.route_id === b.route_id &&
        Math.hypot(a.grid_row - b.grid_row, a.grid_col - b.grid_col) < r(size[a.hold_id]) + r(size[b.hold_id])) n++;
  console.log(n);
  ```

**Commit:** `fix(server): normalize seed data, drop the 'any' role, add role default and name length`

---

## Step 5: Central error handling, friendly messages, and JSON 404s

**Why (review items 5 and 10):** Postgres error text reaches users, error handling differs between controllers, and unknown `/api` paths return an HTML page.

1. **Create `server/middleware/errors.js`:**
   ```js
   // Postgres errors that mean the request had bad data. Each maps to a user-readable 400.
   // validateRoute catches most of these first; these are the safety net.
   const BAD_INPUT_MESSAGES = {
   	'22P02': 'The route has an unknown grade or hold role.',
   	'23502': 'The route is missing a required field.',
   	'23503': "One of the holds isn't in the hold catalog.",
   	'23505': "Two holds can't share the same spot on the wall.",
   	'23514': 'A hold is off the wall or has an invalid rotation.',
   };

   // Unmatched /api/* paths
   export const notFound = (req, res) => {
   	res.status(404).json({ error: 'Not found.' });
   };

   // Express 5 forwards errors thrown in async handlers here
   export const errorHandler = (error, req, res, next) => {
   	if (BAD_INPUT_MESSAGES[error.code]) {
   		return res.status(400).json({ error: BAD_INPUT_MESSAGES[error.code] });
   	}
   	// Malformed JSON body (thrown by express.json())
   	if (error.type === 'entity.parse.failed') {
   		return res.status(400).json({ error: 'The request body is not valid JSON.' });
   	}
   	console.error(error);
   	res.status(500).json({ error: 'Something went wrong. Try again.' });
   };
   ```
2. **In `server/server.js`**, after the four `app.use('/api/...')` lines, add `app.use('/api', notFound);`. Then, after `app.get('/')` and before `app.listen`, add `app.use(errorHandler);`.
3. **Controllers:**
   - Remove every `try/catch` that only exists to send an error response: `getHolds`, `getWallTypes`, `getOptions`, `getRoutes`, `getRouteById`, `deleteRoute` and `resetRoutes`. Express 5 sends rejected promises to `errorHandler`.
   - Delete `BAD_INPUT_CODES` and `sendError` from `climbingRoutes.js`.
4. **Rewrite `createRoute` and `updateRoute` to use `withTransaction`**:
   - Change `findRoute(id)` to `findRoute(db, id)`, where `db` is `pool` or a transaction `client`.
   - **Re-read the saved route inside the transaction, before COMMIT.** This fixes the item-12 nit where a failed re-read after COMMIT returned 500 for a route that had actually been saved.
   - `getRouteById` calls `findRoute(pool, req.params.id)`.
   - Keep `wallTypeMatchesAngle` for now (Step 9 replaces it), but run it with `pool` **before** the transaction.

   Shape of the result:
   ```js
   const createRoute = async (req, res) => {
   	const message = validateRoute(req.body);
   	if (message) return res.status(400).json({ error: message });
   	const { name, grade, angle_degrees, wall_type_id, holds } = req.body;
   	if (!(await wallTypeMatchesAngle(pool, wall_type_id, angle_degrees))) {
   		return res.status(400).json({ error: "The wall type doesn't match the wall angle." });
   	}
   	const route = await withTransaction(async (client) => {
   		const results = await client.query('INSERT ... RETURNING id', [...]);
   		await insertRouteHolds(client, results.rows[0].id, holds);
   		return findRoute(client, results.rows[0].id);
   	});
   	res.status(201).json(route);
   };
   ```
   In `updateRoute`, the transaction returns `null` when the `UPDATE` matched no rows. The controller then responds 404 `Route not found.` Nothing has been written at that point, so COMMIT is harmless.
5. **Tighten `validateRoute`** so bad holds are rejected with a clear message before reaching the DB. Add these checks per hold, in this order, after the existing array check:
   - `Number.isInteger(hold.holdId)`, otherwise `'Each hold needs a hold id.'`
   - `gridRow` is an integer from 0 to `GRID_ROWS - 1` and `gridCol` is an integer from 0 to `GRID_COLS - 1`, otherwise `'A hold is placed off the wall.'`
   - `typeof hold.role === 'string'`, otherwise `'Each hold needs a role.'`

   Also add a route-level check right after the existing name check: `name.trim().length <= MAX_ROUTE_NAME_LENGTH`, otherwise `` `Route names can be at most ${MAX_ROUTE_NAME_LENGTH} characters.` ``.
   - no two holds share the same `gridRow`/`gridCol`, otherwise `"Two holds can't share the same spot on the wall."`

   Keep the existing start/finish/rotation checks after these. **Rotation must now be required:** remove the `?? 0` defaults in both `validateRoute` and `insertRouteHolds`. The client always sends rotation.

**Verify** (each should return the listed status and message):

| Request | Expected |
|---|---|
| `GET $API/nope` | 404 `{"error":"Not found."}` |
| `POST $API/routes` with body `{bad json` | 400 `The request body is not valid JSON.` |
| POST valid body but `"grade":"V99"` | 400 `The route has an unknown grade or hold role.` |
| POST valid body but one `"holdId":9999` | 400 `One of the holds isn't in the hold catalog.` |
| POST valid body with two holds at the same row/col | 400 `Two holds can't share the same spot on the wall.` |
| POST valid body with `"gridRow":16` | 400 `A hold is placed off the wall.` |
| POST valid body with a 61-character name | 400 `Route names can be at most 60 characters.` |
| POST valid body | 201 with the full route |
| `PUT $API/routes/99999` valid body | 404 `Route not found.` |

Also check that the server terminal logs the full error for any 500, and that no response body contains Postgres text such as `violates` or `constraint`.

**Commit:** `fix(server): central error handler with user-readable messages and JSON 404s`

---

## Step 6: Malformed route ids return 404, and the client checks the status code

**Why (review item 4):** `/routes/abc` returns a Postgres 400, and the client decides a route is "not found" by searching the error text.

1. In `server/routes/climbingRoutes.js`, add this before the route definitions:
   ```js
   const MAX_POSTGRES_INT = 2147483647;

   // Any :id that isn't a positive 32-bit integer can't match a route
   router.param('id', (req, res, next, id) => {
   	if (!/^[1-9]\d*$/.test(id) || Number(id) > MAX_POSTGRES_INT) {
   		return res.status(404).json({ error: 'Route not found.' });
   	}
   	next();
   });
   ```
2. In `client/src/api/routes.js` → `request()`, attach the HTTP status to the thrown error:
   ```js
   if (!response.ok) {
     const error = new Error(data.error ?? 'Something went wrong. Try again.')
     error.status = response.status
     throw error
   }
   ```
3. In `client/src/hooks/useRoute.js`, replace the regex check with `const missing = err.status === 404`.

**Verify:**
- `GET $API/routes/abc`, `GET $API/routes/0`, `GET $API/routes/99999999999` and `DELETE $API/routes/abc` all return 404 `Route not found.`
- `GET $API/routes/1` returns 200.
- `POST $API/routes/reset` still returns 200. The `:id` param doesn't apply to `/reset`.
- Client lint and build pass.

**Commit:** `fix: treat malformed route ids as 404 and detect 404 by status on the client`

---

## Step 7: camelCase everywhere in the API

**Why (review item 6, plus the item-12 `created_at` nit):** one response currently mixes snake_case and camelCase, and the client needs a mapper for every endpoint. The owner also chose to keep `createdAt` on the client so "newest" can sort explicitly.

**Server:** alias columns in SQL; leave the database columns snake_case.
1. `SELECT_ROUTES` in `controllers/climbingRoutes.js`: `cr.angle_degrees AS "angleDegrees"`, `cr.wall_type_id AS "wallTypeId"`, `wt.name AS "wallType"`, `cr.created_at AS "createdAt"`. The nested hold keys are already camelCase.
2. `controllers/holds.js`: replace `SELECT *` with `SELECT id, name, hold_type AS "holdType", size, color, image_url AS "imageUrl" FROM climbing_holds ORDER BY hold_type, size`.
3. `controllers/wallTypes.js`: `min_angle AS "minAngle"`, `max_angle AS "maxAngle"`.
4. `controllers/options.js`: alias to `"holdRoles"`, `"holdTypes"`, `"holdSizes"`, and return `maxStartHolds` and `finishHolds`.
5. Request body: `validateRoute`, `createRoute` and `updateRoute` read `angleDegrees` instead of `angle_degrees` (and `wallTypeId` instead of `wall_type_id` until Step 9 removes it). Update the validation message text only if it names a field. It doesn't today.

**Client:**
6. `client/src/api/holds.js`: `fetchHolds` becomes `export const fetchHolds = () => request('/holds')`. Update the file comment.
7. `client/src/api/options.js`: `getOptions` becomes `export const getOptions = () => request('/options')`. Keep the file comment about where the values come from.
8. `client/src/api/routes.js`:
   - In `toClientRoute`: `angle: route.angleDegrees`, `wallTypeId: route.wallTypeId`, `wallType: capitalize(route.wallType)`, and add `createdAt: route.createdAt`.
   - In `toApiRoute`: send `angleDegrees: route.angle` and `wallTypeId: route.wallTypeId`.
   - Keep the `row`/`col` and `angle` renames. Whether the client should use the API names directly is a frontend-pass decision.
9. `client/src/components/RouteForm.jsx`: replace `type.min_angle` / `type.max_angle` with `type.minAngle` / `type.maxAngle` (4 places: the min/max angle lines, the `wallType` lookup, and the `flexGrow` style).
10. `client/src/pages/RouteGalleryPage.jsx`:
    - Change `if (filters.sort === 'newest') return filtered` to sort explicitly: `return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))`.
    - Update the comment above `visibleRoutes`, which currently says the order comes from the API.
11. Search the client for leftovers. The command below should return no matches outside comments:
    ```bash
    grep -rnE "angle_degrees|wall_type|min_angle|max_angle|hold_type|image_url|hold_roles|hold_types|hold_sizes|max_start_holds|finish_holds|created_at" client/src
    ```

**Verify:**
- Every GET response matches the "Final API contract" above (minus `gridRows`/`gridCols`).
- A POST with a camelCase body returns 201. A POST with the old `angle_degrees` key returns 400.
- Client lint and build pass.
- Run `npm run dev` and check in the browser that the gallery loads, the "Newest" sort lists the newest route first, the holds drawer shows holds, and the angle slider and wall type work in the builder.

**Commit:** `refactor: use camelCase for all API fields`

---

## Step 8: `PUT` only for route updates

**Why (review item 7):** the handler replaces the whole route, which is what `PUT` means. `PATCH` implies a partial update.

1. Delete the `router.patch('/:id', ...)` line in `server/routes/climbingRoutes.js`.
2. In `client/src/api/routes.js` → `updateRoute`, change `method: 'PATCH'` to `method: 'PUT'`.

**Verify:**
- `PUT $API/routes/1` with a valid body returns 200.
- `PATCH $API/routes/1` returns 404 `Not found.` (from the Step 5 catch-all).
- Client lint and build pass.
- In the browser, editing a route saves successfully.

**Commit:** `refactor: route updates use PUT only`

---

## Step 9: The server derives the wall type from the angle

**Why (review item 8):** the client currently sends a value the server can work out itself.

1. In `controllers/climbingRoutes.js`, replace `wallTypeMatchesAngle` with:
   ```js
   // Each wall type covers an angle range; the route's angle picks its type
   const findWallTypeId = async (angle) => {
   	const results = await pool.query(
   		'SELECT id FROM wall_types WHERE $1 BETWEEN min_angle AND max_angle',
   		[angle]
   	);
   	return results.rows[0]?.id ?? null;
   };
   ```
2. In `validateRoute`, drop `wallTypeId` from the required fields. The first message becomes `'A route needs a name and grade.'`
3. In `createRoute` and `updateRoute`:
   - Call `findWallTypeId(angleDegrees)` before the transaction.
   - If it returns `null`, respond 400 `"The wall angle doesn't match any wall type."`
   - Otherwise use the id in the INSERT/UPDATE. Stop reading `wallTypeId` from the body.
4. Client:
   - `client/src/api/routes.js` → `toApiRoute`: stop sending `wallTypeId`.
   - `RouteForm.jsx` `handleSubmit`: remove `wallTypeId: wallType.id` from the `onSave` payload. Keep the `wallType` variable, because the UI and the `ready` check still use it.
   - Search `client/src` for `wallTypeId`. If nothing reads it any more, remove it from `toClientRoute` too.

**Verify:**
- POST `"angleDegrees": 30` with no wall type returns 201 and `"wallType": "overhang"`.
- POST `"angleDegrees": 95` returns 400 `The wall angle doesn't match any wall type.`
- POST `"angleDegrees": -1` returns `"wallType": "slab"`.
- Client lint and build pass.
- In the browser, building and editing a route still work, and the wall type label follows the slider.

**Commit:** `refactor: derive a route's wall type from its angle on the server`

---

## Step 10: Expose every remaining rule in `/api/options`

**Why (review item 9, remainder, plus frontend-review decisions):** the client should read every rule from the server instead of hard-coding it.

1. In `controllers/options.js`, import all the rules from `rules.js` and add these to the response:
   ```js
   gridRows: GRID_ROWS,
   gridCols: GRID_COLS,
   minStartHolds: MIN_START_HOLDS,
   maxStartHolds: MAX_START_HOLDS,
   finishHolds: FINISH_HOLDS,
   maxRotation: MAX_ROTATION,
   maxNameLength: MAX_ROUTE_NAME_LENGTH,
   defaultHoldRole: DEFAULT_HOLD_ROLE,
   ```
2. Update the comment at the top of `options.js` to say it serves the enums plus every rule in `config/rules.js`.
3. **Don't** change any client file. The frontend plan moves the client onto these values.

**Verify:** `GET /api/options` returns `grades`, `holdRoles`, `holdTypes`, `holdSizes`, `gridRows: 16`, `gridCols: 12`, `minStartHolds: 1`, `maxStartHolds: 2`, `finishHolds: 1`, `maxRotation: 359`, `maxNameLength: 60` and `defaultHoldRole: "hand"`.

**Commit:** `feat(server): expose all domain rules in /api/options`

---

## Step 11: Validation message wording

**Why (review item 12):** the start-hold message is hard-coded around a maximum of 2.

In `validateRoute`, build the messages from the constants:
- Starts: `` `A route needs between ${MIN_START_HOLDS} and ${MAX_START_HOLDS} start holds.` ``
- Finish: `` `A route needs exactly ${FINISH_HOLDS} finish hold.` ``

Leave the client's own checklist labels in `RouteForm.jsx` alone; they're reviewed in the frontend pass.

**Verify:** a POST with zero start holds returns 400 `A route needs between 1 and 2 start holds.`

**Commit:** `refactor(server): build validation messages from the shared rules`

---

## Step 12: Environment example

**Why (review item 11):** `PORT` and `VITE_API_URL` aren't documented. SSL stays always-on by the owner's decision.

1. Append to `.env.example`:
   ```
   # Optional: API port (defaults to 3000)
   PORT=
   ```
2. Create `client/.env.example` (Vite reads env files from `/client`, because `vite.config.js` doesn't set `envDir`):
   ```
   # Production only: base URL of the deployed API, e.g. https://your-api.onrender.com
   # Leave unset in development so the Vite proxy sends /api to localhost:3000.
   VITE_API_URL=
   ```
   Check that `client/.gitignore` doesn't ignore `.env.example`. If it does, ask the owner before changing it.
3. Add a comment above the `ssl` block in `server/config/database.js`: `// Always on: the team's Postgres is hosted on Render, which requires SSL. A local Postgres must have SSL enabled.`

**Commit:** `docs: document PORT, VITE_API_URL and the always-on DB SSL setting`

---

## Step 13: Update the docs, then do a full regression check

1. Update `ARCHITECTURE.md` and `AGENTS.md` to match the code:
   - the new `server/db/` and `server/middleware/` folders and `config/rules.js`
   - the camelCase contract
   - `PUT` only
   - the derived wall type
   - reset reseeding routes only
   - the error handler
   - 404 on malformed ids
   - grid size in `/api/options`

   Remove each "Known quirk" in `AGENTS.md` that is now fixed. Keep the note that reset is unauthenticated.
2. **Regression check:** run `npm run reset`, then `npm run dev`, and walk through every user story in the browser:

   | # | Check |
   |---|---|
   | 1–3 | Build a route with a name, a grade, 2 start holds and 1 finish hold, then save. You land on its page. |
   | 4 | Edit that route (change the grade and move a hold), then save. The changes persist after a reload. |
   | 5 | Delete it. It disappears from the gallery. |
   | 6 | Save is blocked without a start or finish hold. A server 400 (for example duplicate spot, sent with curl) shows a readable message. |
   | 7 | Reset the wall. Only the 3 starter routes remain. |
   | 8–10 | The gallery lists routes. The grade filter and the Easiest/Hardest/Newest sorts work. |
   | 11–12 | `/routes/1` loads. Copying the link and opening it in a new tab works. `/routes/abc` shows the Not Found page. |
   | 13 | Quick look opens from a card. |

3. Commit the docs: `docs: update architecture and agent docs for the backend refactor`

---

## What comes next

`frontend-refactor-plan.md` runs **after** this plan is complete. It depends on the final API contract above: camelCase fields, `PUT`, 404 status codes, and the full `/api/options`. Don't start any of its steps here.
