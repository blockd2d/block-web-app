# Nova Sales Mobile — Block API alignment

This app uses the **Block API** (Fastify backend at `/v1/*`) for all production data. When `EXPO_PUBLIC_SALES_MOCK_MODE=true`, the app uses the mock server instead and does not call the Block API.

## Endpoints used

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Auth login | `POST /v1/auth/login` | Body: `{ email, password, turnstileToken }` |
| Auth refresh | `POST /v1/auth/refresh` | Body: `{ refresh_token }` |
| Auth me | `GET /v1/auth/me` | Returns `{ user }` |
| Auth logout | `POST /v1/auth/logout` | Clears session |
| Rep profile | `GET /v1/reps/me` | Returns `{ rep }` |
| Assigned clusters | `GET /v1/reps/me/clusters` | Returns `{ clusters }` |
| Cluster detail | `GET /v1/clusters/:id` | For hull_geojson, stats_json |
| Cluster properties | `GET /v1/clusters/:id/properties` | Returns `{ properties }` |
| Interactions list | `GET /v1/interactions` | Rep-filtered, for completed stops |
| Create interaction | `POST /v1/interactions` | Body: `{ property_id, outcome, notes?, followup_at? }` |
| List sales | `GET /v1/sales?property_id=...` | For quotes per stop |
| Create sale | `POST /v1/sales` | Body: SaleCreateSchema |
| Update sale | `PUT /v1/sales/:id` | Body: partial SaleCreateSchema |

## Data mappings

### Knock outcome (mobile → API)

| rep-mobile | Block API |
|------------|-----------|
| no_answer | not_home |
| not_interested | talked_not_interested |
| interested | lead |
| estimated | quote |
| booked | sold |

### Sale status (mobile → API)

| rep-mobile | Block API |
|------------|-----------|
| draft | lead |
| estimated | quote |
| booked | sold |

## Idempotency / offline retries

The schema does not include explicit client id columns. The mobile app embeds metadata inside a `NOVASALES_META` block appended to:

- `interactions.notes` (contains `clientEventId`)
- `sales.notes` (contains `clientWriteId`, line items, base price)

## Route/stop order

Walking Mode uses this priority:

1. `clusters.stats_json.ordered_property_ids` or `clusters.stats_json.stop_order` if present
2. Otherwise, sort by distance from cluster center + property id
