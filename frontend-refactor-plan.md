# Frontend Refactor Plan

This plan fixes the issues found in the frontend review (see `ARCHITECTURE.md` sections 8–13 and `AGENTS.md`). Every decision below was confirmed by the project owner. **Do not change behavior or visuals beyond what a step describes.** If the code doesn't match what a step expects, stop and ask instead of improvising.

## Ground rules for the implementer

- **Prerequisite:** `backend-refactor-plan.md` must be fully implemented and merged into `main` before you start. Check that `GET /api/options` returns `gridRows`, `gridCols`, `minStartHolds`, `maxRotation`, `maxNameLength` and `defaultHoldRole`. If it doesn't, stop and tell the owner.
- **Branch:** create `refactor/frontend` from `main`. Make **one commit per step**. Do not push or open a PR.
- **Database:** the shared Render DB may be written to (create/edit/delete/reset routes).
- **Style:** 2-space indents, no semicolons, single quotes, function components, and a `.css` file next to the component that owns its classes.
- **Verify every step:**
  - `npm run lint --prefix client` and `npm run build --prefix client` (from the repo root) must pass.
  - Run `npm run dev` and do the browser checks listed under the step. **If you can't drive a browser, list that step's browser checks in your final report** so the owner can run them. Don't skip them silently.
- **Moves and renames:** use `git mv` so history follows the file.
- **Starting point:** paths below assume the backend plan is done. That means `client/src/api/routes.js` already sends camelCase, uses `PUT`, and attaches `error.status`, and `useRoute` checks `err.status === 404`.

## Target structure (after Step 4)

```
client/src/
├── main.jsx, App.jsx
├── api/          client.js (request), routes.js, holds.js, options.js, wallTypes.js
├── hooks/        useCatalog.js, useRoute.js, useRouteList.js, useToast.js, usePageTitle.js, usePointerGlow.js
├── pages/        RouteGalleryPage, RouteBuilderPage, RouteDetailsPage, EditRoutePage, NotFoundPage (+ .css)
├── components/
│   ├── layout/     Navbar
│   ├── providers/  CatalogProvider
│   ├── routes/     RouteCard, RouteGallery, RouteFilters, QuickLookModal, GradeBadge, GallerySkeleton
│   ├── builder/    RouteForm, ClimbingHoldsDrawer, RotationDial
│   ├── wall/       WallComponent, HoldLegend, AngleGlyph, ViewToggle, Wall3DLazy, HeroWall, three/
│   └── ui/         Dialog, ConfirmDialog, ToastProvider
├── utils/        display.js, format.js, rotation.js, holdFootprint.js, webgl.js
└── styles/       theme.css (was src/index.css), base.css
```

---

## Step 0: Setup (no commit)

1. `git checkout main && git pull && git checkout -b refactor/frontend`
2. Run `npm run dev`. Confirm the gallery loads, and that `GET http://localhost:3000/api/options` returns the fields listed under the prerequisite.

---

## Step 1: Load reference data once, and handle the route list per page

**Why (bugs and decisions):**
- If any one of the three startup requests fails, every page is replaced by an error screen.
- The hold catalog is refetched every time the builder opens.
- The route details and edit pages have no retry button.

**Owner decisions:**
- Options, wall types and holds are required and gate the whole app.
- The route list's loading and error states are handled inside the gallery.
- The hold catalog loads once, along with the other reference data.

1. **`client/src/hooks/useCatalog.js`.** Keep `CatalogContext`, and make the hook throw when used outside the provider:
   ```js
   import { createContext, useContext } from 'react'

   // Everything the backend defines: enums, rules (grid size, hold limits, …), wall types and the hold catalog.
   // Loaded once by CatalogProvider; every component reads it from here instead of keeping its own copy.
   export const CatalogContext = createContext(null)

   export function useCatalog() {
     const catalog = useContext(CatalogContext)
     if (!catalog) throw new Error('useCatalog must be used inside <CatalogProvider>')
     return catalog
   }
   ```
   Then remove every `catalog?.` and `?? []` fallback on catalog fields: `GradeBadge.jsx`, `Hold.jsx`, `Wall3DComponent.jsx`. Use `const { grades } = useCatalog()` style destructuring like the other components.
2. **Create `client/src/components/providers/CatalogProvider.jsx`.**
   - It loads `Promise.all([getOptions(), getWallTypes(), getHolds()])` and provides `{ ...options, wallTypes, holds }`.
   - State: `{ status: 'loading' | 'ready' | 'error', catalog, error }`, with a `retry()`.
   - While loading, render `<div className="skeleton skeleton-page" aria-busy="true" aria-label="Loading" />`. Add `.skeleton-page { min-height: 60vh; }` to `styles/base.css` next to the other skeleton rules.
   - On error, render the error section currently in `App.jsx`: eyebrow `ERROR`, heading `Couldn't load the wall.`, the error message, and a **Try again** button that calls `retry`.
   - When ready, render `<CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>`.
   - Use the cancelled-flag pattern from `useRoute` so a late response can't update state after unmount.
3. **Rename `fetchHolds` to `getHolds`** in `api/holds.js`, matching `getRoutes` and `getOptions`.
4. **`ClimbingHoldsDrawer.jsx`:** delete its `useEffect` fetch, its `holds`/`status`/`attempt` state, the loading/error/retry markup and the `fetchHolds` import. Read `const { holds, holdTypes } = useCatalog()`. Build the sections by filtering `holds` per type in `holdTypes` order. **Remove the size sort**: the server already returns holds ordered by type then size. Keep the "No holds available yet." message for an empty catalog.
5. **Create `client/src/hooks/useRouteList.js`.** It owns the gallery list:
   - returns `{ status: 'loading' | 'ready' | 'error', routes, error, reload, setRoutes }`
   - loads `getRoutes()` on mount
   - `reload()` sets `status` to `'loading'` and refetches
   - uses the cancelled-flag pattern
6. **`App.jsx`:**
   - Remove `fetchAll`, `retry`, `catalog`, `loading`, `error` and the `getOptions`/`getWallTypes` imports. Use `const routeList = useRouteList()`.
   - Layout: `BrowserRouter > ToastProvider > (ScrollToTop, skip link, Navbar, <main> with CatalogProvider wrapping <Routes>, footer)`. The navbar and footer render even while the catalog loads.
   - `Navbar routeCount={routeList.status === 'ready' ? routeList.routes.length : null}`.
   - Gallery route: `<RouteGalleryPage routes={routeList.routes} status={routeList.status} error={routeList.error} onRetry={routeList.reload} onReset={resetRoutes} />`.
   - Builder route: pass `routes={routeList.status === 'ready' ? routeList.routes : []}`, so the random-route button stays disabled until the list loads.
   - Leave `saveRoute`/`deleteRoute`/`resetRoutes` working as they do now for this step; Step 2 changes them. They should call `routeList.reload()` instead of the old `refreshRoutes`.
7. **Move `GallerySkeleton`** out of `App.jsx` into `client/src/components/GallerySkeleton.jsx`. Step 4 moves it into `routes/`. In `RouteGalleryPage`:
   - `status === 'loading'`: render `<GallerySkeleton />` **in place of the saved-routes section only**. The hero and filters still render.
   - `status === 'error'`: render the existing `empty-panel` markup with heading `Couldn't load routes.`, the `error` text, and a **Try again** button calling `onRetry`.
   - `status === 'ready'`: today's behavior.
   - The hero stats and featured route use `routes`, which is `[]` while loading, so they show the existing empty values.
8. **`useRoute.js`:** add a retry.
   - Keep an `attempt` counter in state, include it in the effect's dependencies, and return `retry: () => setAttempt((n) => n + 1)`.
   - Reset `status` to `'loading'` when retrying.
   - In `RouteDetailsPage` and `EditRoutePage`, change the error branch to: `<section className="empty-state" role="alert"><p className="eyebrow">ERROR</p><h1>Couldn't load this route.</h1><p className="lede">{error}</p><button className="button button-primary" type="button" onClick={retry}>Try again</button></section>`.

**Verify:**
- Lint and build pass.
- Browser: the gallery, builder (drawer shows holds immediately, with no "Loading holds…"), details and edit pages all work.
- Stop the server and reload `/`. The navbar and footer render, and the catalog error with **Try again** shows. Start the server and click **Try again**: the app loads.
- To test a list-only failure, temporarily point `getRoutes` at `/routes-broken`. The gallery shows the route-list error with **Try again**, while `/routes/1` and `/routes/new` still work. **Revert the change before committing.**

**Commit:** `refactor(client): load reference data once and handle route-list loading per page`

---

## Step 2: Update the route list from mutation responses

**Why (bug):** today `saveRoute`, `deleteRoute` and `resetRoutes` refetch the whole list after the API call. If only that refetch fails, the action is reported as failed even though it succeeded. A retried save then creates a duplicate route. **Owner decision:** update the list locally from the API response.

In `App.jsx`:
```js
// Create/update return the saved route, so the list is patched from that response
async function saveRoute(route) {
  const saved = route.id ? await api.updateRoute(route) : await api.createRoute(route)
  routeList.setRoutes((current) =>
    route.id ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current],
  )
  return saved
}

async function deleteRoute(id) {
  await api.deleteRoute(id)
  routeList.setRoutes((current) => current.filter((item) => item.id !== id))
}

// Reset replaces every route, so the list has to be reloaded. If that reload fails,
// the reset still succeeded: the gallery shows its own "Couldn't load routes" retry.
async function resetRoutes() {
  await api.resetRoutes()
  routeList.reload()
}
```
- `useRouteList.setRoutes` must accept an updater function. Expose a wrapper that applies the updater to `routes` and leaves `status` and `error` alone.
- `reload()` here is fire-and-forget. It sets its own error state and must **not** throw.

**Verify:**
- Lint and build pass.
- Browser: create a route. It appears first in the gallery without a reload, and the navbar count goes up by 1.
- Edit it. The card shows the new name.
- Delete it. It disappears, and the count goes down.
- Reset the wall. Only the 3 starter routes remain.
- In DevTools Network, a save makes **one** request (POST/PUT) and no follow-up `GET /api/routes`.

**Commit:** `fix(client): update the route list from save/delete responses instead of refetching`

---

## Step 3: Fix the lost undo history for rotation changes

**Why (bug):** `RouteForm` sets `rotating.current = true` on every rotation change, but only resets it when a mouse drag ends. Arrow-key and typed rotations leave it stuck, so later rotations (including the next drag) skip the undo history.

1. **`RotationDial.jsx`:** add an `onChangeStart` prop and call `onChangeStart?.()` in `handlePointerDown`, **before** the first `onChange`. Update the top comment: `onChangeStart fires when a drag begins, onChange on every change, onChangeEnd when the drag ends. Keyboard and typed changes only fire onChange.`
2. **`RouteForm.jsx`:**
   - Replace the `rotating` ref with `const draggingRotation = useRef(false)`.
   - `handleRotationStart`: set `draggingRotation.current = true`, then push the current `holds` onto history once. Use the same 50-entry cap as `commitHolds`, and pull that cap into a `HISTORY_LIMIT = 50` constant used in both places.
   - `setRotation(degrees)`: call `updateSelectedHold({ rotation: normalizeRotation(degrees) }, { record: !draggingRotation.current })`. Don't set the ref here.
   - `handleRotationEnd`: set `draggingRotation.current = false`.
   - Pass `onChangeStart={handleRotationStart}` and `onChangeEnd={handleRotationEnd}` to `RotationDial`.

**Verify (browser, in the builder):**
1. Place a hold. Press → three times on the dial, then Ctrl+Z three times: the rotation returns to 0 step by step.
2. Type `90` and press Enter, then Ctrl+Z: it goes back to the previous value.
3. Drag the dial in a full sweep, then Ctrl+Z **once**: the whole drag is undone.
4. Press → once, drag, then Ctrl+Z twice: first the drag is undone, then the arrow step.

**Commit:** `fix(client): record every rotation change in undo history`

---

## Step 4: Group components by feature and fix misleading names

**Why:** `components/` is a flat folder of about 20 files, and some names are misleading. **Owner decision:** group by feature. This step is **moves and renames only**. Don't change any logic.

1. Move the files with `git mv`. Each `.css` moves with its `.jsx`.

   | From | To |
   |---|---|
   | `components/Navbar.*` | `components/layout/Navbar.*` |
   | `components/RouteCard.*`, `RouteGallery.jsx`, `QuickLookModal.*`, `GradeBadge.*`, `GallerySkeleton.jsx` | `components/routes/` |
   | `components/GradeFilter.jsx` / `.css` | `components/routes/RouteFilters.jsx` / `.css` (rename the component to `RouteFilters`) |
   | `components/RouteForm.*`, `ClimbingHoldsDrawer.*`, `RotationDial.*` | `components/builder/` |
   | `components/WallComponent.*`, `AngleGlyph.*`, `ViewToggle.*`, `Wall3DLazy.*`, `Wall3DComponent.*` | `components/wall/` |
   | `components/Hold.jsx` | `components/wall/HoldLegend.jsx` |
   | `src/index.css` | `src/styles/theme.css` |

2. Split `request()` out of `api/routes.js` into a new `api/client.js`:
   - Move `API_URL` and `request` there, with the existing comment about the Vite proxy.
   - `routes.js`, `holds.js`, `options.js` and `wallTypes.js` import `request` from `./client`.
   - `capitalize` and `normalizeRotation` stay in `routes.js` for now; Step 5 moves them.
3. Fix every import path, and update `main.jsx` to import `./styles/theme.css`.
4. Search for stale paths. Both of these should return nothing:
   ```bash
   grep -rn "components/Hold'\|GradeFilter\|from '\./index.css'" client/src
   grep -rn "from '\.\./\(api\|hooks\|utils\)/" client/src/components/*/   # should be ../../ now
   ```

**Verify:** lint and build pass. In the browser, every page renders exactly as before.

**Commit:** `refactor(client): group components by feature and rename misleading files`

---

## Step 5: Use the API's field names everywhere, and move display helpers to `utils/`

**Why:** the client renames API fields (`angleDegrees` → `angle`, `gridRow`/`gridCol` → `row`/`col`) and capitalizes `wallType` inside the API mapper, which mixes display formatting into the data layer. **Owner decision:** use the API names directly. One vocabulary from the database to the UI.

1. **Create `utils/format.js`:**
   ```js
   // Display formatting for backend enum values, e.g. 'overhang' -> 'Overhang'
   export const formatLabel = (value) => value.charAt(0).toUpperCase() + value.slice(1)
   ```
2. **Create `utils/rotation.js`**, moving `normalizeRotation` out of `api/routes.js` with its comment. Step 6 parameterizes it.
3. **`api/routes.js`:**
   - Delete `toClientRoute` and `capitalize`.
   - `getRoutes` and `getRoute` return the API response unchanged.
   - Keep a small `toApiRoute(route)` that sends only what the API accepts:
     `{ name, grade, angleDegrees, holds: holds.map(({ holdId, gridRow, gridCol, role, rotation }) => ({ holdId, gridRow, gridCol, role, rotation })) }`.
   - Add a comment explaining that it drops display-only fields (`imageUrl`, `size`, …) that placed holds carry in the builder.
4. **`api/wallTypes.js`:** return the API response unchanged (no capitalizing).
5. **Rename the fields in components:**
   - every `route.angle` → `route.angleDegrees`
   - every placed-hold `hold.row` / `hold.col` → `hold.gridRow` / `hold.gridCol`
   - `RouteForm`'s `angle` state → `angleDegrees`, and the new-hold object uses `gridRow`/`gridCol`
   - `selectedCell` → `{ gridRow, gridCol }`, and `sameSpot` compares those
   - `holdFootprint.js` functions take and read `gridRow`/`gridCol`
   - `Wall3DComponent` uses `toWallX(hold.gridCol)` / `toWallY(hold.gridRow)` and keys like `` `${hold.gridRow}-${hold.gridCol}` ``

   Loop variables that aren't hold fields (for example the `row`/`col` loop in `WallComponent`) may keep their names.
6. **Format at display time.** `route.wallType` and `wallType.name` are now lowercase enum values.
   - Wherever the UI used to show the capitalized form, wrap it in `formatLabel(...)`: `RouteCard`, `QuickLookModal`, `RouteDetailsPage` (stat grid), `RouteForm` (readout and wall-type scale), and the `RouteFilters` wall-type chips (display only; filter on the raw name).
   - `WallProfile` and `Wall3DComponent` each capitalize by hand today; replace both with `formatLabel`.
   - The details eyebrow keeps `.toUpperCase()` on the raw value.
   - The drawer tabs and role legend show raw lowercase values today. Leave them unchanged.
7. **`RotationDial` and `RouteForm`** import `normalizeRotation` from `utils/rotation`.
8. **Search for leftovers.** The command below should return only loop variables or unrelated matches. Review each hit.
   ```bash
   grep -rnE "\.angle\b|angle=\{route|\.row\b|\.col\b|capitalize|toClientRoute" client/src
   ```

**Verify:**
- Lint and build pass.
- Browser: gallery cards show "Overhang · 30°"-style meta.
- The wall-type filter works.
- Quick look, the details page (2D and 3D) and the builder (place, select, rotate, change role, save) all work.
- Editing a starter route loads its holds in the right places.
- The "Newest" sort still works (it uses `createdAt`).

**Commit:** `refactor(client): use API field names directly and format labels at display time`

---

## Step 6: Read every backend-defined value from the catalog

**Why (single source of truth):** the grid size, hold limits, rotation range, name length and default role are hard-coded on the client. The `any` role was removed in the backend plan.

| Value | Replace in | With |
|---|---|---|
| Grid 16 × 12 | `WallComponent.jsx` `ROWS`/`COLS` | `const { gridRows, gridCols } = useCatalog()` |
| Grid in CSS | `WallComponent.css` `.wall` `grid-template-*` and `aspect-ratio` | Set `style={{ '--grid-rows': gridRows, '--grid-cols': gridCols }}` on `.wall`; CSS uses `repeat(var(--grid-cols), 1fr)`, `repeat(var(--grid-rows), 1fr)` and `aspect-ratio: var(--grid-cols) / var(--grid-rows)` |
| Grid in 3D | `Wall3DComponent.jsx` `ROWS`, `COLS`, `WALL_WIDTH`, `WALL_HEIGHT`, `toWallX`/`toWallY` (`5.5`, `7.5`), studs `[-2.95, -1, 1, 2.95]`, posts `±2.8` | Read the grid in the top-level `Wall3DComponent` (outside the `<Canvas>`) and pass `rows`/`cols` down as props. Derive `width = cols * CELL`, `height = rows * CELL`, `toWallX = (col) => (col - (cols - 1) / 2) * CELL`, `toWallY = (row) => ((rows - 1) / 2 - row) * CELL`, studs `[-(width / 2 - 0.05), -width / 6, width / 6, width / 2 - 0.05]`, posts `±(width / 2 - 0.2)`. Add `rows`/`cols` to `Bolts`' `useMemo` dependencies |
| 3D frame shape | `Wall3DLazy.css` `.wall-3d { aspect-ratio: 3 / 4 }` | `aspect-ratio: var(--grid-cols) / var(--grid-rows)`; set the variables inline on the `.wall-3d` root in both `Wall3DLazy` (fallback) and `Wall3DComponent` |
| Hero copy "12 × 16 bolt grid" | `RouteGalleryPage.jsx` | `` `${gridCols} × ${gridRows}` `` |
| `1 or N start holds` / `N finish hold` | `RouteForm` checks and role-button titles | `minStartHolds`, `maxStartHolds`, `finishHolds`. Labels match the server's wording: `` `Between ${minStartHolds} and ${maxStartHolds} start holds` `` and `` `Exactly ${finishHolds} finish hold` ``. The start check becomes `starts >= minStartHolds && starts <= maxStartHolds` |
| Rotation 0–359 | `RotationDial` `aria-valuemax`, input `max`; `normalizeRotation` `% 360` | `RotationDial` takes a `maxRotation` prop (from `RouteForm`'s catalog). `normalizeRotation(degrees, maxRotation)` uses `const turn = maxRotation + 1` in place of `360`. Every caller passes `maxRotation` |
| Name `maxLength={60}` | `RouteForm` | `maxLength={maxNameLength}` |
| `DEFAULT_ROLE = 'hand'` | `RouteForm` | `defaultHoldRole` from the catalog; delete the constant |
| `'any'` fallbacks | `WallComponent` `hold.role ?? 'any'`, `Wall3DComponent` `roleOf` `hold.role ?? 'any'`, `display.js` `ROLE_COLORS.any` and the `?? ROLE_COLORS.any` fallback | Use `hold.role` directly (the DB now guarantees it). Delete `any` from `ROLE_COLORS` and add `const UNKNOWN_ROLE_COLOR = '#9ba39c'` (the `--muted` token) as the fallback |

Also update the `holdFootprint.js` and `WallComponent.jsx` top comments so they don't state grid numbers ("the bolt grid from the catalog").

**Search:** review every hit of the command below. Only visual constants (pixel sizes, animation numbers, the ±90° drawing clamp) may remain.
```bash
grep -rnE "\b(16|12|359|360|60)\b|'hand'|'any'" client/src --include=*.js --include=*.jsx
```

**Verify:**
- Lint and build pass.
- Browser: the 2D and 3D walls look identical to before, and holds sit on the same bolts.
- The builder checklist reads "Between 1 and 2 start holds" and "Exactly 1 finish hold".
- New holds start as `hand`.
- The rotation input stops at 359, and the name input stops at 60 characters.
- The role buttons and legend show start/hand/foot/finish (no `any`).
- **Temporary test:** change `GRID_COLS` to `10` in `server/config/rules.js` and restart the server. The 2D and 3D walls render 10 columns with the same proportions logic. **Revert it before committing.**

**Commit:** `refactor(client): read grid, limits, rotation, name length and default role from the catalog`

---

## Step 7: Define role colors once

**Why:** role colors are written twice, in `utils/display.js` and the `.role-*` rules in `WallComponent.css`. **Owner decision:** colors are client presentation, defined once in `display.js`.

1. **`WallComponent.jsx`:**
   - Remove the `role-${role}` class from the hold `<img>`.
   - Add `'--role-color': roleColor(hold.role)` to its existing `style` object.
2. **`WallComponent.css`:**
   - Delete the `.role-any`, `.role-start`, `.role-hand`, `.role-foot` and `.role-finish` rules, plus the `.wall-editable … .role-any` hover rule.
   - Add: `.wall-hold { filter: drop-shadow(0 0 2px var(--role-color)) drop-shadow(0 0 4px var(--role-color)); }`. Merge this into the existing `.wall-hold` rule if there is one.
3. **`HoldLegend.jsx`:** remove the `${role}` class from `legend-dot`. The inline `background` already sets the color.
4. Search `client/src` for `role-` in CSS and JSX. The only remaining hits should be unrelated (for example `role-segmented`).

**Verify:** lint and build pass. In the browser, the glow colors on the 2D wall, the legend dots, the builder role buttons and the 3D rings all match the previous colors.

**Commit:** `refactor(client): single definition of role colors`

---

## Step 8: Remove the duplicate angle sketches and split the 3D component

**Why:**
- The wall-angle sketch is implemented three times: `AngleGlyph.jsx`, a private `AngleGlyph` in `Wall3DComponent.jsx`, and `WallProfile` in `WallComponent.jsx`.
- `Wall3DComponent.jsx` is 575 lines covering five separate concerns.

This step must not change how anything looks.

1. **One `AngleGlyph`.** `components/wall/AngleGlyph.jsx` stays the only implementation. Its lines use the classes `angle-glyph-floor`, `angle-glyph-ref` and `angle-glyph-wall`.
   - In `Wall3DComponent`, delete the private `AngleGlyph`. Render `<AngleGlyph angle={safeAngle} className="w3d-glyph" />`, and change `Wall3DComponent.css` selectors from `.w3d-glyph-floor/-ref/-wall` to `.w3d-glyph .angle-glyph-floor/-ref/-wall`.
   - In `WallComponent`'s `WallProfile`, replace the inline `<svg>` with `<AngleGlyph angle={angle} className="wall-profile-glyph" />`. Change `WallComponent.css` so `.wall-profile-glyph` gets the size the old `.wall-profile svg` had, and the old `.wall-profile-floor/-ref/-wall` colors move to `.wall-profile-glyph .angle-glyph-*`.
   - The profile used a different `viewBox` (44 × 36). Confirm the profile looks the same size and angle in the browser and adjust the CSS size if needed.
2. **Move `roleOf`** out of `Wall3DComponent` into `utils/display.js` as `describeRole(role)`, returning `{ id: role, label: formatLabel(role), color: roleColor(role) }`.
3. **Split `components/wall/Wall3DComponent.jsx` into `components/wall/three/`.** Move code; don't rewrite it.

   | New file | Contents |
   |---|---|
   | `three/sceneLayout.js` | `CELL`, `THICKNESS`, `KICKER`, `CEILING`, `SCENE_BG`, `SHOWCASE_BG`, `createWallLayout(rows, cols)` → `{ width, height, toWallX, toWallY }`, `wallPoint`, `getViews`, `easeOutBack` |
   | `three/CameraRig.jsx` | `CameraRig` |
   | `three/WallBoard.jsx` | `WallBoard`, `Bolts`, `SupportPosts` |
   | `three/Hold3D.jsx` | `Hold3D`, `useHoldRelief`, `RELIEF_DEPTH`, `DEFAULT_RELIEF_DEPTH`, `FALLBACK_HOLD_COLOR` |
   | `three/Scene.jsx` | `Scene` (lights, floor, pads, kicker, holds, controls, effects) |
   | `three/Wall3DComponent.jsx` | The exported component: canvas, overlay chip/tools/legend, `ICONS`/`Icon` |
   | `three/hold3d.js` | Moved from `utils/hold3d.js` (only the 3D code uses it) |
   | `three/Wall3DComponent.css` | Moved CSS |

   `Wall3DLazy` lazy-imports `./three/Wall3DComponent`. Each file's top comment says what it holds.

**Verify:**
- Lint and build pass. The build still emits a separate `Wall3DComponent-*.js` chunk.
- Browser: on the details page in 3D, the camera glide, hold pop-in, hover tooltip, role highlight buttons, reset view, auto-rotate and fullscreen all work.
- The wall tilts correctly for a slab, a vertical and a roof starter route.
- The angle glyphs on the cards, the builder readout, the 2D wall profile and the 3D chip look the same as before.

**Commit:** `refactor(client): single AngleGlyph and split the 3D wall into focused modules`

---

## Step 9: Extract `RouteForm`'s undo history and keyboard shortcuts

**Why:** `RouteForm` (334 lines) mixes undo history, keyboard shortcuts, hold editing and the form. Its keyboard `useEffect` has no dependency array, so it re-registers on every render.

1. **Create `components/builder/useHoldHistory.js`** (feature-local hook):
   ```js
   // The holds on the wall plus an undo stack. Every change goes through commit() so it can be undone.
   export function useHoldHistory(initialHolds) {
     // returns { holds, canUndo, commit(next, { record = true } = {}), checkpoint(), undo(), clear() }
   }
   ```
   - It owns `holds`, `history` and `HISTORY_LIMIT` (moved here from Step 3).
   - `checkpoint()` pushes the current holds without changing them. The rotation drag start from Step 3 uses it.
   - `RouteForm` replaces `commitHolds`, `undo`, `clearWall`'s internals and the history state with this hook. `setSelectedCell(null)` stays in `RouteForm`.
2. **Create `components/builder/useBuilderShortcuts.js`:**
   ```js
   import { useEffect, useEffectEvent } from 'react'

   // Ctrl/Cmd+Z undo, Delete/Backspace remove, R rotate, Escape deselect.
   // Ignored while typing in a field or using the rotation slider.
   export function useBuilderShortcuts({ onUndo, onRemove, onRotate, onDeselect, hasSelection }) {
     const onKeyDown = useEffectEvent((event) => { /* body moved from RouteForm's effect */ })
     useEffect(() => {
       window.addEventListener('keydown', onKeyDown)
       return () => window.removeEventListener('keydown', onKeyDown)
     }, [])
   }
   ```
   Move `isTyping` into this file. `RouteForm` calls the hook with its handlers. The `R` step (15°) stays a UI constant: `ROTATE_STEP = 15`.
3. `RouteForm`'s behavior is unchanged.

**Verify:**
- Lint and build pass (no `react-hooks` warnings).
- Browser, in the builder: place holds, undo/redo by Ctrl+Z, Delete removes the selected hold, R rotates by 15°, Escape deselects, and typing "r" in the name field does **not** rotate.
- Clearing the wall then pressing Ctrl+Z restores the holds.
- The three rotation-undo checks from Step 3 still pass.

**Commit:** `refactor(client): extract hold history and keyboard shortcuts from RouteForm`

---

## Step 10: Load the hero's 3D showcase after the page is idle, with a 2D fallback

**Why:** the hero renders a 3D showcase immediately, which downloads the ~1.3 MB three.js chunk on every homepage visit. The comment in `Wall3DLazy` says it only loads "the first time a 3D wall is shown", which isn't true in practice.

**Owner decision:**
- Render a same-size placeholder first.
- Load 3D once the browser is idle, and fade it in.
- Show the 2D wall instead for reduced motion, data-saver, or no WebGL.

1. **Create `utils/webgl.js`:**
   ```js
   // True when the browser can create a WebGL context (needed for the 3D wall)
   export function supportsWebGL() {
     try {
       const canvas = document.createElement('canvas')
       return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
     } catch {
       return false
     }
   }
   ```
2. **Create `components/wall/HeroWall.jsx`.** It takes `route` (the featured route).
   - `const prefers2D = window.matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true || !supportsWebGL()`. Compute it once with `useState(() => …)`.
   - If `prefers2D`, render `<WallComponent holds={route.holds} size="lg" wallType={route.wallType} angle={route.angleDegrees} />`.
   - Otherwise keep `const [ready, setReady] = useState(false)`. In an effect, schedule `setReady(true)` with `requestIdleCallback` (falling back to `setTimeout(…, 200)` where it's undefined), and cancel it in the cleanup.
     - While `!ready`, render the placeholder `<div className="wall-3d wall-3d-showcase wall-3d-loading" />`.
     - Once ready, render `<Wall3DLazy key={route.id} holds={route.holds} angle={route.angleDegrees} wallType={route.wallType} showcase fallbackClassName="wall-3d-showcase" />`.
     - The placeholder and the Suspense fallback must have the same size, so nothing shifts.
3. **Fade-in:** in the 3D component's CSS, add `.wall-3d-showcase { animation: wall-3d-fade-in 600ms ease-out both; }` with `@keyframes wall-3d-fade-in { from { opacity: 0 } to { opacity: 1 } }`. Apply it only to the mounted 3D root, not the placeholder (scope it as `.wall-3d.wall-3d-showcase:not(.wall-3d-loading)`).
4. **`RouteGalleryPage`:** replace the inline `Wall3DLazy` in `.hero-stage` with `<HeroWall route={featured} />`. Keep the featured-chip link and the "Build a route to see it here in 3D" empty state.
5. **Fix the comment** in `Wall3DLazy.jsx`: `// three.js is large, so it downloads the first time a 3D wall renders: the details/builder 3D toggle, or the homepage hero once the page is idle.`

**Verify:**
- Lint and build pass.
- Browser, DevTools Network with "Disable cache": on `/`, the document, main JS and `GET /api/*` requests finish **before** the `Wall3DComponent-*.js` chunk is requested.
- The hero shows the dark placeholder, then the 3D wall fades in with its intro glide.
- In DevTools Rendering, emulate `prefers-reduced-motion: reduce` and reload: the hero shows the 2D wall and the 3D chunk is **not** requested.
- The 2D↔3D toggle on details and builder pages still works.

**Commit:** `perf(client): load the hero 3D showcase when idle, with a 2D fallback`

---

## Step 11: Make "Clear filters" consistent

**Why:** the filter-bar "Clear filters" keeps the chosen sort, but the "No routes match" button also resets the sort to Newest. **Owner decision:** clearing filters keeps the sort, because sort is a view preference, not a filter.

In `RouteGalleryPage.jsx`, add one function and use it everywhere filters are cleared:
```js
// Clears search, grade and wall type; the sort is a view preference and stays
const clearFilters = () => setFilters((current) => ({ ...EMPTY_FILTERS, sort: current.sort }))
```
- Pass it as `RouteFilters`' `onClear`.
- Use it for the "No routes match" button.
- Use it in `handleReset` in place of `setFilters(EMPTY_FILTERS)`. Resetting the wall clears filters the same way.

**Verify:** in the browser, pick "Hardest", filter to a grade with no matches, and click the empty-state "Clear filters": the routes show and "Hardest" is still selected. The same happens with the filter-bar button and with Reset wall.

**Commit:** `fix(client): clearing filters keeps the chosen sort everywhere`

---

## Step 12: CSS ownership and readable formatting

**Why:** some CSS files restyle classes owned by other components, and every rule is minified onto one line. **Owner decision:** keep plain global CSS next to each component. Each class is styled in the file of the component that renders it, or in `styles/base.css` if two or more unrelated components render it. Format every rule readably.

1. **Format all CSS** with Prettier as a one-off. Don't add it as a dependency.
   ```bash
   cd client && npx --yes prettier@3.3.3 --write "src/**/*.css"
   ```
   Commit this formatting **on its own first** (`style(client): format CSS`), so the ownership moves below show up as clean diffs.
2. **Fix the known ownership problems:**

   | Class | Defined today in | Move to |
   |---|---|---|
   | `.wall-stage` | `builder/RouteForm.css` and `wall/WallComponent.css` (used by RouteForm and RouteDetailsPage) | Merge into one definition in `styles/base.css` |
   | `.hold-legend`, `.legend-dot` | `wall/WallComponent.css` and `routes/QuickLookModal.css` | New `wall/HoldLegend.css`, imported by `HoldLegend.jsx`. If QuickLook's rule is a variant, give `HoldLegend` a `className` prop, pass a modifier such as `hold-legend-compact` from `QuickLookModal`, and define the modifier in `HoldLegend.css` |
   | `.wall-3d-showcase` | `pages/RouteGalleryPage.css` | `wall/Wall3DLazy.css` (next to `.wall-3d`; the showcase is a prop of the 3D component) |
   | `.route-grid` | `routes/RouteCard.css` (used by `RouteGallery` and `GallerySkeleton`) | New `routes/RouteGallery.css`, imported by `RouteGallery.jsx` and `GallerySkeleton.jsx` |
   | `.segmented` | `styles/base.css` and `routes/RouteFilters.css` | Keep the base in `base.css`. If `RouteFilters.css` changes the base look, turn it into a modifier class (for example `segmented-filter`) applied in `RouteFilters.jsx` |

3. **Audit the rest:**
   - For every class selector in every component and page CSS file, find where it's used: `grep -rn "<class>" client/src --include=*.jsx`.
   - If the rule lives somewhere other than the file of the component that renders it (or `base.css` for shared classes), move it.
   - List every additional move in the commit message body.
4. Don't change any property values.

**Verify:** lint and build pass. In the browser, compare each page (gallery, quick look, builder in 2D and 3D, details in 2D and 3D, 404, the confirm dialogs and toasts) with how it looked before this step. Nothing should change visually.

**Commits:** `style(client): format CSS`, then `refactor(client): style each class in the file of the component that owns it`

---

## Step 13: Rename the app to BetaSpray and remove template leftovers

**Why:**
- The UI says "Crux Maker", `index.html` says "Custom Climbing Route Makers", and the README says "Custom Climbing Route Maker".
- **Owner decision:** the app is **BetaSpray**, with the tagline **"A virtual spray wall"**. Update the README too.

1. **Create `client/src/config/app.js`:**
   ```js
   export const APP_NAME = 'BetaSpray'
   export const APP_TAGLINE = 'A virtual spray wall'
   ```
2. **Apply the name:**
   - `index.html`: `<title>BetaSpray</title>`.
   - `usePageTitle.js`: `` `${title} · ${APP_NAME}` `` and fallback `APP_NAME`. Update its example comment.
   - `Navbar.jsx`: brand `Beta<span className="brand-light">Spray</span>`, `aria-label={`${APP_NAME} home`}`.
   - Footer in `App.jsx`: `{APP_NAME}` and `{APP_TAGLINE}.`
   - Gallery hero eyebrow: `{APP_TAGLINE.toUpperCase()}`.
   - Then `grep -rni "crux" client/` (excluding `node_modules` and `dist`) must return nothing.
3. **Update the root `README.md`:**
   - Title: `# BetaSpray`.
   - The line under it: `A virtual spray wall. CodePath WEB103 Final Project (Custom Climbing Route Maker).`
   - In "Description and Purpose", start with `BetaSpray lets you build your own bouldering routes…`.
   - Change nothing else.
4. **Delete the unused template leftovers.** First confirm each has no references (`grep -rn "<name>" client/src client/index.html`):
   - `client/src/assets/hero.png`
   - `client/src/assets/react.svg`
   - `client/src/assets/vite.svg`
   - `client/public/icons.svg`
   - `client/README.md` (the default Vite template README)

**Verify:** lint and build pass. In the browser, the tab titles read "Route gallery · BetaSpray" and so on, the navbar and footer show the new name and tagline, and nothing references a deleted file (no 404s in the Network tab).

**Commit:** `chore: rename the app to BetaSpray and remove Vite template leftovers`

---

## Step 14: Update the docs and run a full regression

1. Update `ARCHITECTURE.md` sections 8–13 and the frontend parts of `AGENTS.md` to match the code:
   - the new folder layout
   - `CatalogProvider` (options + wall types + holds) and `useRouteList`
   - local list updates after mutations
   - API field names used directly, with `formatLabel` at display time
   - every value read from the catalog
   - role colors defined once
   - the `three/` split
   - the hero idle-load and fallback
   - the overlap rule documented as a **client-only placement aid** that the server doesn't enforce
   - the BetaSpray name

   Remove the fixed "Frontend known quirks".
2. **Regression check:** run `npm run reset`, then `npm run dev`, and walk through:

   | # | Check |
   |---|---|
   | 1–3 | Build a route (name, grade, 2 start holds, 1 finish) and save. You land on its page, and it's first in the gallery. |
   | 4 | Edit it (grade, move a hold, rotate with the keyboard, then undo), save, and reload. The changes persist. |
   | 5 | Delete it. It's gone from the gallery and the count drops. |
   | 6 | Save is disabled without a start or finish hold. The checklist wording matches the server's. |
   | 7 | Reset the wall. 3 starter routes remain, and the sort is kept. |
   | 8–10 | Gallery, grade filter, and the Easiest/Hardest/Newest sorts work. |
   | 11–12 | `/routes/1` loads in 2D and 3D. The copied link works in a new tab. `/routes/abc` shows Not Found. |
   | 13 | Quick look opens from a card. |
   | — | The hero 3D fades in after load. With reduced motion, it shows 2D. |
   | — | With the server stopped: the catalog error appears with Try again. With only the list broken: gallery retry, while other pages still work. |
3. Commit: `docs: update architecture and agent docs for the frontend refactor`
