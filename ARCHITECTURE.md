# Architecture

This document explains how Custom Climbing Route Maker is put together. It's for teammates (and future us) who need to find their way around the code.

> **Scope:** Sections 1–7 cover the **backend** (`/server`) and the API contract. Sections 8–13 cover the **frontend** (`/client`). Both the backend and frontend describe the code **after** their respective refactor plans. Steps 8 and 10 of `frontend-refactor-plan.md` (AngleGlyph dedup + 3D component split; hero idle-load + 2D fallback for reduced motion) are still pending.

---

## 1. The big picture

```
┌──────────────────────────┐   fetch /api/*    ┌──────────────────────────┐   pg Pool   ┌──────────────┐
│  React app  (/client)    │ ───────────────►  │  Express API  (/server)  │ ──────────► │  PostgreSQL  │
│  Vite dev server :5173   │ ◄───────────────  │  :3000                   │ ◄────────── │  (Render)    │
└──────────────────────────┘   JSON            └──────────────────────────┘             └──────────────┘
```

- In development, `npm run dev` (repo root) starts both apps with `concurrently`. Vite proxies every `/api/*` request to `http://localhost:3000` (see `client/vite.config.js`), so the client never needs to know the server's URL.
- In production, the client reads the server's address from `VITE_API_URL`.
- The server is a plain Express app with no ORM: every query is hand-written SQL run through a shared `pg.Pool`.

## 2. Folder layout

```
server/
├── server.js                 Entry point: loads env, mounts the routers, the JSON 404 and the error handler
├── config/
│   ├── dotenv.js             Loads the repo-root .env (imported for its side effect)
│   ├── database.js           Exports the shared pg Pool and withTransaction(work)
│   ├── rules.js              Domain rules shared by validation, the schema and /api/options
│   └── reset.js              CLI for `npm run reset`: rebuild the schema and seed, in one transaction
├── db/
│   ├── schema.js             createSchema(client): drops and recreates every enum and table
│   └── seed.js               seedReferenceData(client), seedStarterRoutes(client)
├── middleware/
│   └── errors.js             notFound (JSON 404 for /api/*) and errorHandler (friendly 400/500 messages)
├── routes/                   One Express Router per resource. Maps URL + verb → controller function
│   ├── climbingRoutes.js
│   ├── holds.js
│   ├── options.js
│   └── wallTypes.js
├── controllers/              Request handlers. Validation, SQL and the HTTP response all live here
│   ├── climbingRoutes.js
│   ├── holds.js
│   ├── options.js
│   └── wallTypes.js
└── data/                     Starter rows used by db/seed.js
    ├── WallTypes.js
    ├── StartingHolds.js
    ├── StartingRoutes.js
    └── StartingRouteHolds.js
```

The pattern is **router → controller → SQL**. There's no separate model or service layer; each controller talks to the database directly.

> **Naming gotcha:** "route" means two things here. A **climbing route** is a boulder problem (the `climbing_routes` table). An **Express route** is a URL handler (the `routes/` folder). The code uses `ClimbingRoutes…` for the first meaning to keep them apart.

## 3. Database

### Tables

```
wall_types 1 ──── * climbing_routes 1 ──── * route_holds * ──── 1 climbing_holds
```

| Table | What it holds | Notes |
|---|---|---|
| `wall_types` | The 4 wall styles (slab, vertical, overhang, roof) and the angle range each one covers | Reference data, seeded only |
| `climbing_holds` | The catalog of hold shapes you can place (type, size, color, image) | Reference data, seeded only. `image_url` points to files in `client/public/holds/` |
| `climbing_routes` | A saved boulder problem: name, grade, wall angle, wall type | `wall_type_id` → `wall_types.id` |
| `route_holds` | One placed hold on one route: which hold, where on the grid, its role and rotation | Join table. Deleting a route deletes its holds (`ON DELETE CASCADE`) |

### Enums

All of these are Postgres enums created in `db/schema.js`. **They are the single source of truth.** The frontend reads them at runtime via `GET /api/options` instead of keeping its own copy.

| Enum | Values |
|---|---|
| `wall_angles` | slab, vertical, overhang, roof |
| `grades` | V0 … V12 (the enum order is used as the difficulty order for sorting) |
| `hold_types` | crimp, jug, sloper, pocket, pinch |
| `hold_sizes` | small, medium, large |
| `hold_roles` | start, hand, foot, finish (`hand` means a hand or a foot hold) |

### Constraints that act as business rules

The numbers come from `server/config/rules.js` (the schema builds its `CHECK`s from them).

- `route_holds.grid_row` is 0–15 and `grid_col` is 0–11. That's the 12 × 16 bolt grid. Row 0 is the top of the wall.
- `route_holds.rotation` is 0–359.
- `route_holds.role` defaults to `hand`.
- `climbing_routes.name` is at most 60 characters.
- `UNIQUE (route_id, grid_row, grid_col)`: a route can't have two holds on the same bolt.
- Wall type ranges (from `data/WallTypes.js`): slab −20…−1°, vertical 0…5°, overhang 6…50°, roof 51…90°.

### Resetting and seeding

There are two different resets:

- **`npm run reset`** runs `config/reset.js`. In **one transaction** it calls `createSchema` (drop every table and enum, recreate them), `seedReferenceData` (wall types and holds) and `seedStarterRoutes`. If anything fails the transaction rolls back, nothing changes and the script exits non-zero.
- **`POST /api/routes/reset`** (the "Reset wall" button) only calls `seedStarterRoutes` in a transaction: it truncates `route_holds` and `climbing_routes`, restarts their ids, and reinserts the starter routes. Holds and wall types are left alone.

Seed rows are inserted with **explicit ids**, so `seed.js` moves each table's id sequence past the highest id afterwards. The seed functions don't catch errors; a failure propagates to the transaction.

**The reset endpoint has no authentication.** That's a deliberate choice for the demo.

## 4. API reference

All responses are JSON. Errors are always `{ "error": "<user-readable message>" }`. Postgres error text never reaches the client. Every field is `camelCase`.

| Method & path | Controller | What it does | Used by (client) |
|---|---|---|---|
| `GET /api/options` | `options.getOptions` | Enum values plus every rule in `config/rules.js` | `api/options.js` → `App.jsx` → catalog context |
| `GET /api/wall-types` | `wallTypes.getWallTypes` | All wall types, ordered by `minAngle` | `api/wallTypes.js` → `App.jsx` → catalog context |
| `GET /api/holds` | `holds.getHolds` | The hold catalog | `api/holds.js` → `ClimbingHoldsDrawer` |
| `GET /api/routes` | `climbingRoutes.getRoutes` | Every route with its holds, newest first | `api/routes.js` → `App.jsx` (gallery list) |
| `GET /api/routes/:id` | `climbingRoutes.getRouteById` | One route with its holds. 404 if missing **or** the id isn't a positive 32-bit integer | `hooks/useRoute.js` → details & edit pages |
| `POST /api/routes` | `climbingRoutes.createRoute` | Create a route (validated). 201 | `RouteForm` → `RouteBuilderPage` → `App.saveRoute` |
| `PUT /api/routes/:id` | `climbingRoutes.updateRoute` | Replace a route and **all** of its holds | `RouteForm` → `EditRoutePage` → `App.saveRoute` |
| `DELETE /api/routes/:id` | `climbingRoutes.deleteRoute` | Delete a route (its holds cascade). Returns `{ id }` | `RouteDetailsPage` → `App.deleteRoute` |
| `POST /api/routes/reset` | `climbingRoutes.resetRoutes` | Reseed the **starter routes only**, in one transaction | `RouteGalleryPage` → `App.resetRoutes` |
| anything else under `/api` | `middleware/errors.notFound` | 404 `{ "error": "Not found." }` | — |

### `GET /api/options` (response)

```jsonc
{
  "grades": ["V0", "...", "V12"], "holdRoles": ["start", "hand", "foot", "finish"],
  "holdTypes": ["crimp", "jug", "sloper", "pocket", "pinch"], "holdSizes": ["small", "medium", "large"],
  "gridRows": 16, "gridCols": 12,
  "minStartHolds": 1, "maxStartHolds": 2, "finishHolds": 1,
  "maxRotation": 359, "maxNameLength": 60, "defaultHoldRole": "hand"
}
```

### Route object (response)

```jsonc
{
  "id": 1,
  "name": "Easy Test",
  "grade": "V1",
  "angleDegrees": 0,
  "wallTypeId": 2,
  "wallType": "vertical",
  "createdAt": "2025-09-01T10:00:00.000Z",
  "holds": [
    {
      "routeHoldId": 1, "holdId": 6,
      "imageUrl": "/holds/jug-green-large.png", "size": "large", "holdType": "jug", "color": "green",
      "gridRow": 14, "gridCol": 4, "role": "start", "rotation": 0
    }
  ]
}
```

The database columns stay `snake_case`; the SQL aliases them (`cr.angle_degrees AS "angleDegrees"`, and so on) so the API is camelCase throughout.

### Route body (create / update request)

```jsonc
{
  "name": "My Route",
  "grade": "V3",
  "angleDegrees": 20,
  "holds": [
    { "holdId": 6, "gridRow": 14, "gridCol": 4, "role": "start", "rotation": 0 }
  ]
}
```

There is no wall type in the body. **The server derives the wall type from the angle** (`findWallTypeId`): the wall type whose `minAngle`…`maxAngle` range contains `angleDegrees`. An angle that fits no wall type is a 400.

### The "Save Check" (user story 6)

A save goes through three layers of checking, in this order:

1. **`validateRoute()`** in `controllers/climbingRoutes.js` (plain JS, before touching the DB). The first failing check wins:
   - `name` (non-blank) and `grade` are present, and the trimmed name is at most `MAX_ROUTE_NAME_LENGTH` (60) characters
   - `angleDegrees` is an integer
   - `holds` is an array, and each hold has an integer `holdId`, an on-grid `gridRow`/`gridCol` and a string `role`
   - no two holds share the same `gridRow`/`gridCol`
   - between `MIN_START_HOLDS` (1) and `MAX_START_HOLDS` (2) start holds, and exactly `FINISH_HOLDS` (1) finish hold
   - every `rotation` is an integer from 0 to `MAX_ROTATION` (359). Rotation is required.
2. **`findWallTypeId()`**: the angle must fall inside some wall type's range.
3. **Postgres constraints**: unknown grade/role (bad enum), unknown `holdId` (foreign key), off-grid position (CHECK), two holds on one bolt (UNIQUE). These are a safety net: `middleware/errors.js` maps their error codes (`22P02`, `23502`, `23503`, `23505`, `23514`) to a friendly 400 message.

The frontend `RouteForm` mirrors rule 1 using the limits from `/api/options`, so the Save button is disabled until the route would pass.

### Error handling

Controllers don't catch errors. Express 5 forwards a rejected async handler to `errorHandler` in `middleware/errors.js`, which sends:

- **400** with a friendly message for the five Postgres bad-input codes, and for a malformed JSON body (`The request body is not valid JSON.`),
- **500** `Something went wrong. Try again.` for everything else. The full error is logged on the server only.

`router.param('id')` in `routes/climbingRoutes.js` answers 404 `Route not found.` for any `:id` that isn't a positive 32-bit integer, so `/routes/abc` is a 404 like any other missing route.

### Create and update are transactions

`createRoute` and `updateRoute` run their writes through `withTransaction` (`config/database.js`), which does `BEGIN`, runs the work on one pooled client, and then `COMMIT` (or `ROLLBACK` on any error):

- **Create:** find the wall type from the angle → insert the `climbing_routes` row → insert all `route_holds` rows in one multi-row `INSERT` (`insertRouteHolds`) → re-read the full route with `findRoute(client, id)` **before** the commit → return it with 201.
- **Update:** find the wall type from the angle → update the `climbing_routes` row (404 if it doesn't exist) → delete **all** that route's `route_holds` → reinsert the new set → re-read the route inside the transaction → return it.

So an update is always a **full replacement** of the route and its holds.

## 5. Tracing a request end to end

### Loading the app

```
App.jsx
  └─ useRouteList  → GET /api/routes  → SELECT_ROUTES … ORDER BY created_at DESC
       routes → props to RouteGalleryPage / RouteBuilderPage; count to Navbar

CatalogProvider  (mounts inside App, wraps all pages)
  └─ Promise.all([getOptions(), getWallTypes(), getHolds()])
       ├─ GET /api/options     → enum_range(...) for each enum + rules.js values
       ├─ GET /api/wall-types  → SELECT … FROM wall_types
       └─ GET /api/holds       → SELECT … FROM climbing_holds
            → CatalogContext (read with useCatalog() by RouteForm, RouteFilters,
                               GradeBadge, HoldLegend, ClimbingHoldsDrawer, Wall3DComponent)
```

### Saving a new route

```
RouteForm  (user clicks Save)
  → RouteBuilderPage.handleSave
  → App.saveRoute(route)                       (no id → create)
  → api/routes.js createRoute → toApiRoute()   (strips display-only fields, keeps API names)
  → POST /api/routes
  → validateRoute → findWallTypeId → BEGIN / INSERT route / INSERT holds / findRoute / COMMIT
  ← 201 + route JSON  (raw API shape, used directly)
  → App.setRoutes(current => [saved, ...current])  (local prepend, no refetch)
  → navigate to /routes/:id
```

Editing follows the same path through `EditRoutePage`, with an `id` present, so `App.saveRoute` calls `updateRoute` (`PUT`) and replaces the matching entry in the list.

### Shape translation (client side)

Components use the API's own field names directly: `angleDegrees`, `gridRow`, `gridCol`, `wallType` (lowercase). `toApiRoute()` strips display-only fields (`imageUrl`, `size`, `holdType`, `color`, `wallTypeId`, `wallType`, `createdAt`) from hold objects before the body is sent; it doesn't rename any keys. `formatLabel()` in `utils/format.js` capitalizes enum values for display (`"overhang"` → `"Overhang"`).

`api/holds.js`, `api/options.js` and `api/wallTypes.js` pass the server's camelCase response straight through.

## 6. How the MVP user stories map to the backend

| # | Story | Backend support |
|---|---|---|
| 1 | Click holds to build a route | `GET /api/holds` (catalog) + `POST /api/routes` |
| 2 | Mark start and finish holds | `hold_roles` enum, `route_holds.role` |
| 3 | Name and grade | `climbing_routes.name`, `grades` enum |
| 4 | Edit a saved route | `GET /api/routes/:id` + `PUT /api/routes/:id` |
| 5 | Delete a route | `DELETE /api/routes/:id` (holds cascade) |
| 6 | Block saves without start/finish | `validateRoute()` + DB constraints |
| 7 | Reset to starter routes | `POST /api/routes/reset` → `seedStarterRoutes()` |
| 8 | See all routes | `GET /api/routes` |
| 9 | Filter by grade | Client-side filter on the full list |
| 10 | Sort easiest → hardest | Client-side sort using the `grades` enum order from `/api/options` |
| 11 | Open a route on its own page | `GET /api/routes/:id` |
| 12 | Share a link | Client URL `/routes/:id` (backed by #11) |
| 13 | Quick look | Uses data already loaded by `GET /api/routes` (no extra request) |

## 7. Configuration

| Variable | Where it's read | Purpose |
|---|---|---|
| `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE` | `server/config/database.js` | Postgres connection (copy `.env.example` → `.env` at the repo root) |
| `PORT` | `server/server.js` | API port, defaults to `3000` |
| `VITE_API_URL` | `client/src/api/routes.js` | API base URL in production. Leave it unset in dev so the Vite proxy is used |

The pool always connects with `ssl: { rejectUnauthorized: false }`: the team's Postgres is hosted on Render, which requires SSL, so a local Postgres must have SSL enabled. `client/.env.example` documents `VITE_API_URL`.

---

# Frontend

## 8. Frontend stack and layout

BetaSpray's frontend is React 19 + Vite, React Router, and three.js (through `@react-three/fiber`, `drei` and `postprocessing`) for the 3D wall. There's no state library: shared data lives in `App.jsx` and in React contexts. Plain CSS sits next to each component; design tokens live in `styles/theme.css`.

```
client/src/
├── main.jsx                 Mounts <App/> in StrictMode, loads global CSS
├── App.jsx                  Owns the route list (useRouteList), mutations, and the page tree
├── config/
│   └── app.js               APP_NAME = 'BetaSpray' and APP_TAGLINE
├── api/                     The only code that calls fetch()
│   ├── client.js            request() helper + API_URL (re-exported from routes.js)
│   ├── routes.js            Route CRUD; toApiRoute() strips display-only fields before sending
│   ├── holds.js             GET /holds
│   ├── options.js           GET /options
│   └── wallTypes.js         GET /wall-types
├── hooks/
│   ├── useCatalog.js        CatalogContext + useCatalog()
│   ├── useRoute.js          Fetch one route by id, with loading/ready/missing/error status
│   ├── useRouteList.js      Fetch + manage the gallery route list; local updates after mutations
│   ├── useToast.js          ToastContext: toast(message, tone)
│   ├── usePageTitle.js      Sets document.title (uses APP_NAME)
│   └── usePointerGlow.js    Cursor spotlight effect (purely visual)
├── pages/                   One component per URL
│   ├── RouteGalleryPage     /                 hero + 3D showcase, filters, cards, quick look, reset
│   ├── RouteBuilderPage     /routes/new       wraps RouteForm
│   ├── RouteDetailsPage     /routes/:id       2D/3D wall, share, delete
│   ├── EditRoutePage        /routes/:id/edit  wraps RouteForm with an existing route
│   └── NotFoundPage         *
├── components/
│   ├── builder/
│   │   ├── RouteForm          The builder: wall editing, hold editor, details, save checklist
│   │   ├── ClimbingHoldsDrawer  Hold catalog picker
│   │   ├── RotationDial       Rotation knob + number input
│   │   ├── useHoldHistory.js  Undo stack (last 50 hold arrays)
│   │   └── useBuilderShortcuts.js  Keyboard shortcuts (Ctrl+Z, Delete, R, Escape)
│   ├── layout/
│   │   └── Navbar             Brand, nav links, route count
│   ├── routes/
│   │   ├── RouteGallery + RouteGallery.css   Responsive card grid
│   │   ├── RouteCard          Tilt/glow card, quick look button
│   │   ├── RouteFilters       Search + grade chips + wall-type chips + sort
│   │   ├── GradeBadge         Coloured grade pill
│   │   ├── QuickLookModal     Detail overlay
│   │   └── GallerySkeleton    Loading skeleton (uses RouteGallery.css)
│   ├── wall/
│   │   ├── WallComponent + WallComponent.css  2D bolt grid
│   │   ├── HoldLegend + HoldLegend.css        Role color key
│   │   ├── Wall3DLazy + Wall3DLazy.css        Lazy wrapper + showcase styles
│   │   ├── Wall3DComponent                    3D gym scene
│   │   ├── AngleGlyph                         Angle diagram SVG
│   │   └── ViewToggle                         2D / 3D segmented control
│   ├── providers/
│   │   └── CatalogProvider    Loads options + wall types + holds; shows skeleton/error until ready
│   └── ui/
│       ├── Dialog, ConfirmDialog  Native <dialog> wrappers
│       └── ToastProvider          Toast stack
├── utils/
│   ├── display.js           ROLE_COLORS, roleColor(), gradeTone()
│   ├── format.js            formatLabel() — capitalize a backend enum value for display
│   ├── rotation.js          normalizeRotation(degrees, maxRotation)
│   ├── holdFootprint.js     Hold scale, footprint radius, covered/overlapping bolts
│   └── hold3d.js            Procedural geometry and canvas textures for 3D holds
└── styles/
    ├── base.css              Shared layout, type, buttons, .wall-stage
    ├── theme.css             Design tokens (CSS custom properties)
    └── index.css             Imports theme and base; loaded globally
```

## 9. Component tree and who owns what state

```
App  (useRouteList: status, routes[], reload, setRoutes)
└── ToastProvider  (toast stack)
    ├── Navbar  (routeCount)
    └── <Routes>
        └── CatalogProvider  (options + wallTypes + holds → CatalogContext)
            ├── RouteGalleryPage  props: routes, status, error, onRetry, onReset
            │                     state: filters, previewRoute, confirmReset
            │   ├── Wall3DLazy (showcase of the route with the most holds)
            │   ├── RouteFilters → RouteGallery → RouteCard → WallComponent (sm)
            │   ├── QuickLookModal → Dialog → WallComponent
            │   └── ConfirmDialog (reset)
            ├── RouteBuilderPage  props: routes, onSave
            │   └── RouteForm (new)   state: name, grade, angleDegrees, holds[], selectedCell,
            │                               pickedHold, view, error, saving
            │                         hooks: useHoldHistory (undo stack), useBuilderShortcuts
            ├── RouteDetailsPage  props: onDelete            useRoute(id); state: view, confirmDelete
            │   ├── WallComponent (lg) + HoldLegend   or   Wall3DLazy
            │   └── ConfirmDialog (delete)
            ├── EditRoutePage     props: onSave              useRoute(id)
            │   └── RouteForm (existing)
            └── NotFoundPage
```

**RouteForm** owns all editing state. It reads all limits (`maxStartHolds`, `finishHolds`, `maxNameLength`, `maxRotation`, `defaultHoldRole`) from `useCatalog()` and derives the wall type from `angleDegrees` using `catalog.wallTypes`.

## 10. How the frontend gets its data

| Data | Fetched by | When | Kept in | Read by |
|---|---|---|---|---|
| Route list | `useRouteList` → `api.getRoutes` | App start + on `reload()` after reset | `useRouteList` state | Gallery, Builder (random route), Navbar count |
| Options (enums + limits) | `CatalogProvider` → `getOptions` | App start | `CatalogContext` | RouteForm, RouteFilters, GradeBadge, HoldLegend, Drawer, Wall3D, Gallery sort |
| Wall types | `CatalogProvider` → `getWallTypes` | App start | `CatalogContext` | RouteForm (slider), RouteFilters |
| Hold catalog | `CatalogProvider` → `getHolds` | App start | `CatalogContext` | `ClimbingHoldsDrawer` |
| One route | `useRoute(id)` → `getRoute` | Details or edit page opens | Hook state | Details page, Edit page |

- **Catalog** (`CatalogProvider`): all three requests run in `Promise.all`. Until they all succeed, `CatalogProvider` shows a full-page skeleton. On error it shows a retry screen. `ClimbingHoldsDrawer` reads holds straight from the catalog; it no longer fetches them itself.
- **Route list** (`useRouteList`): after `saveRoute` (create/update) or `deleteRoute`, the list is **updated locally** (`setRoutes`). After `resetRoutes` only, `reload()` is called because the full list changes.
- Quick Look and gallery cards reuse the list data — no extra requests.
- Errors from mutations are thrown back to the caller (shown in the form or as a toast).

## 11. Shape translation and display

`getRoutes()` and `getRoute()` return the raw API shape. Components use the API's own field names throughout: `angleDegrees`, `gridRow`, `gridCol`, `wallType` (lowercase). There is no `toClientRoute` transformation.

`toApiRoute()` in `api/routes.js` strips display-only fields (`imageUrl`, `size`, `holdType`, `color`, `wallTypeId`, `wallType`, `createdAt`) before the body is sent to the server.

Display-only mappings on the client:

- **Enum labels:** `formatLabel(value)` in `utils/format.js` capitalizes the first letter of a backend enum value for display.
- **Role colors:** `ROLE_COLORS` in `utils/display.js`. `WallComponent` applies them via the `--role-color` CSS variable on each `.wall-hold` element (glow `drop-shadow`). `HoldLegend` reads them through `roleColor()`. No `.role-*` CSS classes.
- **Grade tones:** `gradeTone()` splits the backend's grade list into easy/moderate/hard/elite by position.
- **Hold size → drawn scale:** `HOLD_SCALE` in `utils/holdFootprint.js` (small 0.8, medium 1.6, large 2.4 bolt cells).
- **3D relief depth per hold type:** `RELIEF_DEPTH` in `Wall3DComponent.jsx`.
- **Rotation normalization:** `normalizeRotation(degrees, maxRotation)` in `utils/rotation.js`; `maxRotation` comes from the catalog.

## 12. The 2D wall and placement rules

`WallComponent` draws a CSS grid sized by `--grid-rows` and `--grid-cols` CSS variables (set from `useCatalog()`). Each cell is one of:

1. a **placed hold**: a button when editable, otherwise an image,
2. a **covered bolt**: hidden under a larger neighboring hold; clicking it selects that hold,
3. a **blocked bolt**: an empty bolt where the hold being placed would overlap an existing one (editable mode only),
4. an **empty bolt**.

The covered/overlap rules use footprint circles from `holdFootprint.js`. **These rules are a client-side placement aid only.** The server rejects two holds on the exact same bolt, but does not enforce footprint circles. The starter routes satisfy the client rule.

## 13. Frontend view of each user story

| # | Story | Where it happens |
|---|---|---|
| 1 | Click holds to build | `RouteForm.handleCellClick` → `WallComponent` (editable) + `ClimbingHoldsDrawer` |
| 2 | Start/finish roles | Hold editor in `RouteForm` (role buttons from `catalog.holdRoles`, limited by `maxStartHolds`/`finishHolds`) |
| 3 | Name and grade | `RouteForm` "Route details" panel (grades from `catalog.grades`) |
| 4 | Edit | `EditRoutePage` → `useRoute` → `RouteForm existing` → `App.saveRoute` → PUT |
| 5 | Delete | `RouteDetailsPage` → `ConfirmDialog` → `App.deleteRoute` |
| 6 | Save check | `RouteForm` checklist disables Save; server errors are shown in `form-error` |
| 7 | Reset | `RouteGalleryPage` → `ConfirmDialog` → `App.resetRoutes` |
| 8 | All routes | `RouteGalleryPage` → `RouteGallery` → `RouteCard` |
| 9 | Filter by grade | `RouteFilters` chips → `filters.grade` in `RouteGalleryPage.visibleRoutes` |
| 10 | Sort by difficulty | `filters.sort` sorts by index in `catalog.grades` (sort preference kept on filter clear) |
| 11 | Route page | `/routes/:id` → `RouteDetailsPage` |
| 12 | Share link | `RouteDetailsPage.handleShare` (Web Share API on touch devices, otherwise copy to clipboard) |
| 13 | Quick look | `RouteCard` eye button → `QuickLookModal` |
