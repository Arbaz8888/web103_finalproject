# AGENTS.md

Guidance for AI coding agents working in this repo. Human-oriented explanation lives in `ARCHITECTURE.md`.

> Scope: backend (`/server`), the client↔API contract, and the frontend (`/client`). Both the backend and frontend describe the code **after** their respective refactor plans.

## Project

Custom Climbing Route Maker: build bouldering routes on a 12 × 16 virtual wall, save them, and browse/filter them. The MVP requirements are in `planning/user_stories.md`. Every change must keep all 13 stories working.

## Stack and commands

- Monorepo: `/server` (Express 5, `pg`, ESM, no ORM) and `/client` (React + Vite).
- Run from the repo root:
  - `npm run dev`: client (:5173) + server (:3000). Vite proxies `/api` → `:3000`.
  - `npm run reset`: **drops and recreates every table and enum**, then reseeds, in one transaction. Destructive. Don't run it against a shared DB without asking.
  - `npm start`: server only.
- Env: the repo-root `.env` (see `.env.example`), loaded by `server/config/dotenv.js`. Never commit `.env`. `client/.env.example` documents `VITE_API_URL` (production only).
- There is no test suite or linter for the server. To verify, start the server and `curl` the endpoints. Only use GET requests unless the user OKs writes. `POST /api/routes/reset` deletes every user-created route.

## Server layout (router → controller → SQL)

- `server.js`: mounts `/api/holds`, `/api/wall-types`, `/api/routes`, `/api/options`, then `notFound` for any other `/api/*` path, then `errorHandler`.
- `routes/*.js`: thin; only map verb + path → controller. `routes/climbingRoutes.js` also has a `router.param('id')` guard.
- `controllers/*.js`: validation + raw SQL via `pool` from `config/database.js` + response. No `try/catch` just to send an error; Express 5 forwards rejected promises to `errorHandler`.
- `config/rules.js`: the shared domain rules (grid size, hold limits, max rotation, max name length, default hold role).
- `config/database.js`: the `pool`, and `withTransaction(work)` for `BEGIN`/`COMMIT`/`ROLLBACK`.
- `config/reset.js`: the `npm run reset` CLI only. It has no exports.
- `db/schema.js`: `createSchema(client)` drops and recreates every enum and table.
- `db/seed.js`: `seedReferenceData(client)` (wall types, holds) and `seedStarterRoutes(client)` (routes and their holds). Seeds don't catch errors.
- `middleware/errors.js`: `notFound` and `errorHandler`.
- `data/*.js`: seed rows with explicit ids.

## Invariants (do not break)

1. **Postgres enums are the source of truth** for grades, hold roles/types/sizes and wall angles. The client fetches them from `GET /api/options`. Never hardcode these lists in the client. To change one, edit the `CREATE TYPE` in `db/schema.js` (and the seeds) and run `npm run reset`.
2. **Domain rules live in `config/rules.js`** (`GRID_ROWS`/`GRID_COLS`, `MIN_START_HOLDS`/`MAX_START_HOLDS`, `FINISH_HOLDS`, `MAX_ROTATION`, `MAX_ROUTE_NAME_LENGTH`, `DEFAULT_HOLD_ROLE`). Validation, the schema's `CHECK`s and `GET /api/options` all read from it. Change a rule there only. The client still duplicates the grid size in `WallComponent.jsx` / `utils/holdFootprint.js`; keep them in sync until the frontend refactor.
3. Grid is 16 rows (0–15, row 0 = top) × 12 cols (0–11), enforced by DB `CHECK`s. Rotation is 0–359 (inclusive), also a `CHECK`.
4. **The server derives a route's wall type from its angle** (`findWallTypeId`). The request body has no wall type. An angle outside every wall type's range is a 400.
5. Create/update run through `withTransaction`, and re-read the saved route **inside** the transaction (`findRoute(client, id)`) before `COMMIT`.
6. Update = **full replace**: the route row is updated, then all its `route_holds` are deleted and reinserted. The client sends `PUT`, and the body must be complete (rotation is required).
7. Error responses are always `{ error: string }` with a user-readable message. Postgres error text never reaches the client: the five bad-input codes (`22P02`, `23502`, `23503`, `23505`, `23514`) map to friendly 400s in `middleware/errors.js`, and anything else is a logged 500.
8. Seed inserts use explicit ids, so `resetIdSequence()` (in `db/seed.js`) must run after each table's seed.
9. Seed order: `wall_types` → `climbing_holds` → `climbing_routes` → `route_holds`. Starter routes must satisfy every rule the API enforces, including the client's hold-overlap rule.
10. `POST /api/routes/reset` reseeds **routes only** (`seedStarterRoutes`) in one transaction. `npm run reset` is the only thing that rebuilds the schema.

## API contract (everything is camelCase)

- Route request body (POST/PUT): `{ name, grade, angleDegrees, holds: [{ holdId, gridRow, gridCol, role, rotation }] }`
- Route response: `{ id, name, grade, angleDegrees, wallTypeId, wallType, createdAt, holds: [{ routeHoldId, holdId, imageUrl, size, holdType, color, gridRow, gridCol, role, rotation }] }`. Built in SQL by `SELECT_ROUTES` (column aliases) and `json_build_object`. Database columns stay snake_case.
- `GET /api/holds`: `[{ id, name, holdType, size, color, imageUrl }]`. `GET /api/wall-types`: `[{ id, name, minAngle, maxAngle, description }]`.
- `GET /api/options`: `{ grades, holdRoles, holdTypes, holdSizes, gridRows, gridCols, minStartHolds, maxStartHolds, finishHolds, maxRotation, maxNameLength, defaultHoldRole }`.
- `GET /api/routes/:id` and `DELETE /api/routes/:id` return 404 `Route not found.` for a missing **or malformed** id. `PUT` returns 404 for a missing route. Any unknown `/api/*` path returns 404 `{ error: 'Not found.' }`.
- The client translates payloads in `client/src/api/routes.js` (`toClientRoute`, `toApiRoute`). `api/holds.js` and `api/options.js` pass the response through. If you change a server field, update those in the same change.
- `useRoute` (client) detects a missing route with `err.status === 404`. `request()` in `api/routes.js` attaches the HTTP status to every error it throws.

## Known quirks

- `POST /api/routes/reset` has **no authentication**. This is deliberate for the demo.

## Frontend layout (`/client/src`)

- `App.jsx` owns the route list via `useRouteList` and the `saveRoute`/`deleteRoute`/`resetRoutes` mutations. After each mutation the list is **updated locally** (no full refetch), except `resetRoutes`, which calls `reload()` because the full list changes.
- `components/providers/CatalogProvider.jsx` loads options + wall types + holds in `Promise.all`. Until it succeeds it shows a full-page skeleton; on error it shows a retry screen. All pages that need catalog data live inside it.
- `api/*.js` is the **only** place that may call `fetch`. Every call goes through `request()` in `api/client.js` (re-exported from `api/routes.js`).
- `hooks/useCatalog()` returns backend-defined lists, limits and the hold catalog. `hooks/useRoute(id)` loads a single route for the details and edit pages.
- `pages/` holds one component per URL. `components/builder/RouteForm.jsx` is the builder and is shared by the new and edit pages.
- Components are grouped in subdirectories: `builder/`, `layout/`, `routes/`, `wall/`, `providers/`, `ui/`.
- 2D wall: `components/wall/WallComponent.jsx` + `utils/holdFootprint.js`. 3D wall: `components/wall/three/` (`Wall3DComponent.jsx` is the entry; `Scene`, `WallBoard`, `Hold3D`, `CameraRig`, `sceneLayout.js` and `hold3d.js` sit beside it). It's always loaded through `Wall3DLazy`. `AngleGlyph` is the only angle sketch (used by cards, the 2D wall profile and the 3D chip).
- Run `npm run lint --prefix client` and `npm run build --prefix client` after any client change. There are no client tests.

## Frontend rules

1. Never hardcode a value the backend defines (grades, roles, hold types/sizes, wall types and their angle ranges, hold limits). Read it from `useCatalog()`.
2. Components use the API's own field names (`angleDegrees`, `gridRow`, `gridCol`, `wallType` lowercase). `api/routes.js`'s `toApiRoute()` strips display-only fields before sending. Use `formatLabel()` from `utils/format.js` to capitalize enum values for display.
3. Pages don't call the API for mutations. They call the `onSave`/`onDelete`/`onReset` props from `App`.
4. Visual-only constants (colors, 3D scene numbers, animation timings) may live in the client. Role colors are defined **once** in `utils/display.js` (`ROLE_COLORS`); `WallComponent` applies them via the `--role-color` CSS variable (no `.role-*` classes).
5. Client style: 2-space indents, no semicolons, single quotes, function components, a CSS file next to each component.

## Frontend known quirks

- The hold-overlap rule (`holdFootprint.js`) exists only on the client as a **placement aid**. The server rejects two holds on the same bolt but does not enforce footprint circles. The starter routes satisfy the client rule.
- The 3D chunk (three.js, ~1.3 MB) loads on the homepage only once the browser is idle: `HeroWall` shows a placeholder, then the 3D showcase. Reduced motion, data saver or no WebGL get the 2D wall and never load the chunk.

## Conventions

- ESM (`import`/`export`), tabs for indentation in `/server`, single quotes.
- Parameterized queries only (`$1, $2…`). The one exception is `resetIdSequence`, which interpolates a table name from a hardcoded list.
- Each controller file default-exports an object of handlers. Routers import that object.
