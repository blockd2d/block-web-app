# Nova Sales Mobile (Expo)

This is the **Sales Rep** mobile app for Nova Services.

- **Location:** `apps/sales-mobile`
- **Tech:** Expo + React Native + TypeScript
- **State:** React Query (server/cache) + Zustand (session + offline queue)
- **Storage:** SecureStore (auth session) + AsyncStorage (cache + queue)
- **Design goal:** visually consistent with `apps/labor-mobile`, but fully separate at runtime

## Running

```bash
cd apps/sales-mobile
npm i
npm run start
```

For the real in-app Mapbox map, use a development build instead of Expo Go:

```bash
cd apps/sales-mobile
npm i
npx expo prebuild --clean
npx expo run:ios
```

Useful scripts:
- `npm run ios`
- `npm run android`
- `npm run test`
- `npm run typecheck`

## Environment

This app supports a mock mode so the UI works immediately without a backend.

Copy `apps/sales-mobile/.env.example` to `apps/sales-mobile/.env`.

Required variables:
- `EXPO_PUBLIC_SALES_MOCK_MODE=true` for mock data
- `EXPO_PUBLIC_SUPABASE_URL=...`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk....` for the live in-app Mapbox map
- `EXPO_PUBLIC_MAPBOX_STYLE_URL=mapbox://styles/mapbox/streets-v12` (optional)

When `EXPO_PUBLIC_SALES_MOCK_MODE=false`, Supabase auth + data queries are used.

For native Mapbox builds, you may also need a secret `MAPBOX_DOWNLOADS_TOKEN` in your shell or EAS environment. Do not expose that one as `EXPO_PUBLIC_*`.

## Current MVP status

Delivered in the current app:
- Boot/login/session restore flow
- Role-gated entry for sales users
- Tabs: **Clusters** and **Profile**
- Cluster list with progress, distance, and sync hints
- Cluster Detail with summary, stop preview, map, Drive to Start, Start/Resume Walking
- Walking Mode with in-app map, stop progression, knock logging, auto-advance, Resume Walking, and sync badges
- Quote Builder with draft/estimated/booked flow and offline queue support
- Offline queue for knock logs and quotes
- Local cache for clusters, stops, map overlays, and recent quote drafts

## Architecture

### UI + navigation
- `src/theme.ts` + `src/components.tsx` are **copied/adapted from labor-mobile** to keep the product family consistent
- `src/navigation.tsx` uses stack + pill-style bottom tabs similar to labor-mobile
- List screens use `FlatList`
- Scrollable screens use the same safe-area / bottom-tab padding pattern as labor-mobile

### State
- `src/state.ts`
  - Session store: boot → restore session → role check
  - Offline queue: `knock_log`, `upsert_quote`
  - Stop activity store: local last knock/quote state + per-stop sync badges (`novasales:stop-activity`)
  - Walking session resume: current stop per cluster (`novasales:walking`)

### API + data layer
- `src/lib/api.ts`
  - mock server implementation for immediate dev/testing
  - Supabase scaffolding behind the same interface
- `src/lib/mockServer.ts`
  - realistic sample clusters, stops, and map overlays
- `src/lib/storage.ts`
  - AsyncStorage keys for caches and drafts

## File map

- `App.tsx` — app shell, QueryClient, online/foreground/periodic queue flush
- `src/navigation.tsx` — root stack + tabs
- `src/screens/ClustersScreen.tsx` — assigned clusters home
- `src/screens/ClusterDetailScreen.tsx` — cluster summary, preview map, start/resume walking
- `src/screens/WalkingModeScreen.tsx` — full walking workflow
- `src/screens/QuoteBuilderScreen.tsx` — mobile quote entry/edit flow
- `src/screens/ProfileScreen.tsx` — profile + sync state
- `src/SalesMap.tsx` — reusable map surface with markers, polyline, boundary, fit/focus helpers
- `src/lib/openMaps.ts` — external Apple/Google Maps links for driving/open stop actions

## Backend alignment

This app is wired to the **actual Prisma/Supabase schema** (as provided) via `src/lib/api.ts`.

### Current schema mapping used by the mobile app

- Auth user → profile: `profiles.id == auth.users.id`
- Org: `profiles.org_id → organizations`
- Rep: `reps.profile_id → profiles.id`
- Assigned clusters: `clusters.assigned_rep_id → reps.id`
- Cluster name/label: `cluster_sets.name + cluster.id (short)`
- Stops (houses): `cluster_properties(cluster_id, property_id) → properties`
- Knock logs: `interactions(org_id, rep_id, property_id, outcome, notes)`
- Quotes/estimates/bookings: `sales(org_id, rep_id, property_id, price, status, notes, customer_*)`
- Cluster boundary polygon: `clusters.hull_geojson` (GeoJSON Polygon/MultiPolygon)

If your schema changes, update only `src/lib/api.ts`.

## Route-order assumptions

Walking Mode consumes a **precomputed stop sequence**.

In the current schema, there is no dedicated `sequence` column on `cluster_properties`.
The mobile app uses this priority order:
1) `clusters.stats_json.ordered_property_ids` or `clusters.stats_json.stop_order` if present (manager/web precomputed)
2) Otherwise, a stable fallback sort by distance-from-cluster-center + property id

The mobile app does **not** do route optimization.

## Offline + sync strategy

### Cached reads
- assigned clusters: `cache:clusters`
- cluster stops: `cache:cluster:<id>:stops`
- cluster map overlays: `cache:cluster:<id>:map`
- quote drafts per stop: `cache:stop:<id>:quotes`

### Queued writes
- knock logs
- quote upserts

### Sync triggers
- network reconnect
- app foreground
- immediate best-effort flush when a queued item is added while online
- periodic best-effort flush while app is active (30s interval)
- manual **Sync now** in Profile

### Conflict policy
- last write wins for MVP
- schema does not include explicit client ids; mobile embeds `clientEventId` / `clientWriteId` inside a `NOVASALES_META` block in `interactions.notes` and `sales.notes` for best-effort idempotency

## Maps + location

- In-app maps use `@rnmapbox/maps` with a real Mapbox background style
- Default style: `mapbox://styles/mapbox/streets-v12`
- The map renders cluster boundaries, route polyline, all stop markers, and the current/next stop highlight
- When location permission is granted, the Mapbox location puck shows the rep's live position
- Driving to cluster start still uses external maps deep links
- Walking Mode stays in-app
- The app falls back gracefully if the token is missing or if the current binary was opened in Expo Go instead of a development build

## Known backend follow-ups

Before production wiring, confirm these with the backend/web app:
- final role names for sales users
- real table/view names
- whether stop completion is stored or derived
- quote line item structure if BOM requires more than base + adjustments
- whether map overlays exist or should be derived from stops only
- Android release-map key setup, if required in your build pipeline

## Handoff checklist

1. Copy `.env.example` to `.env`
2. Decide whether to use mock mode or real Supabase
3. If using real Supabase, create the backend contract from `docs/`
4. Populate one rep, one assigned cluster, and ordered stops
5. Run the app and verify:
   - login
   - clusters list
   - cluster detail map
   - Drive to Start
   - Walking Mode knock save + auto-advance
   - Quote save
   - offline queue + reconnect sync

## Phase 6 hardening

This repo now also includes two cleanup fixes that matter for real users:

- **Unsupported-role screen**: wrong-account logins no longer silently drop back to Login; the app now shows a clear account-state screen and guidance.
- **Logout/user-switch cleanup**: persisted queue items, walking resume state, stop activity, and cached cluster data are cleared on logout and before a fresh login is finalized, so one rep’s local data does not bleed into another rep’s session.
