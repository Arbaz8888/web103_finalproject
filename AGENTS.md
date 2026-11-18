# AGENTS.md

Guidance for AI coding agents working in this repo. Human-oriented explanation lives in `ARCHITECTURE.md`.

> Scope: backend (`/server`), the client↔API contract, and the frontend (`/client`). Describes the code before the refactors in `backend-refactor-plan.md`.

## Project

Custom Climbing Route Maker: build bouldering routes on a 12 × 16 virtual wall, save them, and browse/filter them. The MVP requirements are in `planning/user_stories.md`. Every change must keep all 13 stories working.

## Stack and commands

- Monorepo: `/server` (Express 5, `pg`, ESM, no ORM) and `/client` (React + Vite).
- Run from the repo root:
  - `npm run dev`: client (:5173) + server (:3000). Vite proxies `/api` → `:3000`.
  - `npm run reset`: **drops and recreates every table and enum**, then reseeds. Destructive. Don't run it against a shared DB without asking.
  - `npm start`: server only.
- Env: the repo-root `.env` (see `.env.example`), loaded by `server/config/dotenv.js`. Never commit `.env`.
- There is no test suite or linter for the server. To verify, start the server and `curl` the endpoints. Only use GET requests unless the user OKs writes. `POST /api/routes/reset` wipes the DB.

## Server layout (router → controller → SQL)

- `server.js`: mounts `/api/holds`, `/api/wall-types`, `/api/routes`, `/api/options`.
- `routes/*.js`: thin; only map verb + path → controller.
- `controllers/*.js`: validation + raw SQL via `pool` from `config/database.js` + response.
- `config/reset.js`: schema DDL **and** seed logic. Exports `seedAllTables()`. Running it directly seeds and closes the pool (guarded by a `process.argv[1]` check).
- `data/*.js`: seed rows with explicit ids.

## Invariants (do not break)

1. **Postgres enums are the source of truth** for grades, hold roles/types/sizes and wall angles. The client fetches them from `GET /api/options`. Never hardcode these lists in the client. To change one, edit the `CREATE TYPE` in `config/reset.js` (and the seeds) and reset.
2. Hold-count limits `MAX_START_HOLDS` (2) and `FINISH_HOLDS` (1) are exported from `controllers/climbingRoutes.js` and served by `/api/options`. Change them there only.
3. Grid is 16 rows (0–15, row 0 = top) × 12 cols (0–11). Enforced by DB `CHECK`s in `reset.js`. The client duplicates these numbers in `WallComponent.jsx` / `utils/holdFootprint.js`; keep them in sync.
4. A route's wall type must match its angle (`wallTypeMatchesAngle`). The client derives `wallTypeId` from the angle using `/api/wall-types`.
5. Create/update run in a transaction on a dedicated `pool.connect()` client. Always `ROLLBACK` on error and `release()` in `finally`.
6. Update = **full replace**: the route row is updated, then all its `route_holds` are deleted and reinserted. The client sends `PATCH`, but the body must be complete.
7. Error responses are always `{ error: string }`. In `climbingRoutes.js`, use `sendError()` so Postgres input errors (`22P02`, `23502`, `23503`, `23505`, `23514`) become 400.
8. Seed inserts use explicit ids, so `resetIdSequence()` must run after each table's seed.
9. Seed order: `wall_types` → `climbing_holds` → `climbing_routes` → `route_holds`.

## API contract (field casing matters)

- Route request body: `{ name, grade, angle_degrees, wall_type_id, holds: [{ holdId, gridRow, gridCol, role, rotation }] }`
- Route response: route fields are **snake_case**, but nested `holds[]` are **camelCase** (built in SQL by `json_build_object` in `SELECT_ROUTES`). Includes `wall_type` (enum name) and `routeHoldId`.
- `GET /api/holds` returns raw **snake_case** rows (`hold_type`, `image_url`).
- The client translates every payload in `client/src/api/*.js` (`toClientRoute`, `toApiRoute`, `fetchHolds`, `getOptions`). If you change a server field, update those mappers in the same change.
- `useRoute` (client) detects a 404 by regex-matching `/not found/i` on the error message. Keep the message `'Route not found.'` or update the hook.

## Known quirks

- Seed data has negative `rotation` values (e.g. `-10`), but `validateRoute` only accepts 0–359. This works only because the client's `normalizeRotation` maps reads to 0–359 before re-saving.
- `POST /api/routes/reset` reseeds **all** tables (holds and wall types too, not just routes), has no auth, and always returns 200. The seed helpers catch and log their own errors.
- `PUT` and `PATCH /api/routes/:id` both map to the same full-replace handler.
- Postgres error messages are returned to the client verbatim in 400/500 responses.

## Frontend layout (`/client/src`)

- `App.jsx` loads routes + `/options` + `/wall-types` once, puts options and wall types in `CatalogContext`, and owns the route list plus the `saveRoute`/`deleteRoute`/`resetRoutes` mutations. Each mutation refetches the full list.
- `api/*.js` is the **only** place that may call `fetch`. Every call goes through `request()` in `api/routes.js`.
- `hooks/useCatalog()` returns backend-defined lists and limits. `hooks/useRoute(id)` loads a single route for the details and edit pages.
- `pages/` holds one component per URL. `components/RouteForm.jsx` is the builder and is shared by the new and edit pages.
- 2D wall: `components/WallComponent.jsx` + `utils/holdFootprint.js`. 3D wall: `components/Wall3DComponent.jsx` + `utils/hold3d.js`. It's always loaded through `Wall3DLazy`.
- Run `npm run lint --prefix client` and `npm run build --prefix client` after any client change. There are no client tests.

## Frontend rules

1. Never hardcode a value the backend defines (grades, roles, hold types/sizes, wall types and their angle ranges, hold limits). Read it from `useCatalog()`.
2. Components use the client shape (`angle`, `row`, `col`, `wallType` capitalized). Only `api/*.js` knows the API field names.
3. Pages don't call the API for mutations. They call the `onSave`/`onDelete`/`onReset` props from `App`.
4. Visual-only constants (colors, 3D scene numbers, animation timings) may live in the client. Keep role colors in sync between `utils/display.js` and `WallComponent.css`.
5. Client style: 2-space indents, no semicolons, single quotes, function components, a CSS file next to each component.

## Frontend known quirks (pre-refactor)

- The grid size (16 × 12) is hardcoded in `WallComponent.jsx`, `WallComponent.css`, `Wall3DComponent.jsx` (including the derived `5.5`/`7.5` centering), and the gallery hero text.
- The hold-overlap rule (`holdFootprint.js`) exists only on the client. Starter route 1 breaks it (seed holds 1 and 3).
- The 3D chunk loads on the homepage, because the hero shows a 3D showcase.

## Conventions

- ESM (`import`/`export`), tabs for indentation in `/server`, single quotes.
- Parameterized queries only (`$1, $2…`). The one exception is `resetIdSequence`, which interpolates a table name from a hardcoded list.
- Each controller file default-exports an object of handlers. Routers import that object.
