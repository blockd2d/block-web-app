# Block API — Endpoint reference

Base URL: `https://<api-host>/v1` (e.g. `http://localhost:4000` for local). All routes below are under `/v1` unless noted.

**Auth:** Most endpoints require a session cookie (web) or `Authorization: Bearer <token>` (mobile). Web state-changing requests need `x-csrf` header; webhooks and login/refresh are exempt.

**Path parameters** such as `:id` are UUIDs.

---

## Health (no prefix)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no `/v1`) |

---

## Auth — `/v1/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/auth/login` | Login |
| POST | `/v1/auth/logout` | Logout |
| POST | `/v1/auth/refresh` | Refresh session/token |
| GET | `/v1/auth/me` | Current user/profile |
| POST | `/v1/auth/me/push-token` | Register push token |

---

## Invites — `/v1/invites`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/invites` | List invites |
| POST | `/v1/invites` | Create invite |
| DELETE | `/v1/invites/:id` | Delete invite |
| POST | `/v1/invites/accept` | Accept invite |

---

## Org — `/v1/org`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/org/members` | List org members (admin) |

---

## Zones — `/v1/zones`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/zones` | List zones |
| POST | `/v1/zones` | Create zone(s) / save drawn zones → cluster set |

---

## Counties — `/v1/counties`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/counties` | List counties for org |

---

## Properties — `/v1/properties`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/properties` | List properties (query params) |
| GET | `/v1/properties/by-cluster/:clusterId` | Properties by cluster |

---

## Reps — `/v1/reps`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/reps/me` | Current rep profile |
| GET | `/v1/reps/me/clusters` | Clusters assigned to current rep |
| POST | `/v1/reps/me/location` | Update rep location |
| GET | `/v1/reps/locations` | Latest rep locations |
| GET | `/v1/reps/locations/latest` | Latest rep locations (alias) |
| GET | `/v1/reps` | List reps |
| POST | `/v1/reps` | Create rep |
| PUT | `/v1/reps/:id` | Update rep |
| DELETE | `/v1/reps/:id` | Delete rep |

Response for `GET /v1/reps/me/clusters`: each cluster includes `scheduled_start` and `scheduled_end` (ISO 8601 or null).

---

## Interactions — `/v1/interactions`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/interactions` | Create interaction (e.g. knock outcome) |
| GET | `/v1/interactions` | List interactions (query params) |

---

## Cluster sets — `/v1/cluster-sets` (and `/v1/territories`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/cluster-sets` | List cluster sets |
| POST | `/v1/cluster-sets` | Create cluster set (queues worker job) |
| GET | `/v1/cluster-sets/:id` | Get cluster set |
| PATCH | `/v1/cluster-sets/:id` | Update cluster set (e.g. name) |
| DELETE | `/v1/cluster-sets/:id` | Delete cluster set |
| GET | `/v1/cluster-sets/:id/clusters` | List clusters in set |
| GET | `/v1/cluster-sets/:id/suggest-assignments` | Auto-suggest rep assignments |
| POST | `/v1/cluster-sets/:id/assign` | Assign clusters (bulk) |

Same routes are also mounted at `/v1/territories` for compatibility.

---

## Clusters — `/v1/clusters`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/clusters` | List clusters (requires `cluster_set_id` query) |
| POST | `/v1/clusters/assign` | Assign one cluster to rep |
| POST | `/v1/clusters/assign-bulk` | Bulk assign clusters |
| GET | `/v1/clusters/:id` | Get cluster |
| PATCH | `/v1/clusters/:id` | Update cluster (e.g. name, scheduled_start, scheduled_end) |
| GET | `/v1/clusters/:id/properties` | Properties in cluster |
| GET | `/v1/clusters/:id/inspector` | Cluster inspector payload (stats, drive-to, etc.) |

---

## Sales — `/v1/sales`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/sales` | List sales (filter by status, rep, etc.) |
| GET | `/v1/sales/:id` | Get sale |
| GET | `/v1/sales/:id/attachments` | List attachments for sale |
| POST | `/v1/sales` | Create sale |
| PUT | `/v1/sales/:id` | Update sale |
| DELETE | `/v1/sales/:id` | Delete sale |
| POST | `/v1/sales/:id/attachments` | Add attachment |
| POST | `/v1/sales/:id/signature` | Add signature |

---

## Contracts — `/v1/contracts`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/contracts/generate` | Generate contract (e.g. PDF) |
| GET | `/v1/contracts/by-sale/:saleId` | Contract(s) for a sale |

---

## Follow-ups — `/v1/followups`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/followups` | List follow-ups |
| POST | `/v1/followups` | Create follow-up |
| PUT | `/v1/followups/:id` | Update follow-up |

---

## Messages — `/v1/messages`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/messages/threads` | List message threads |
| GET | `/v1/messages/threads/:id` | Get thread |
| GET | `/v1/messages/threads/:id/messages` | Messages in thread |
| POST | `/v1/messages/send` | Send message |
| POST | `/v1/messages/threads/:id/reassign` | Reassign thread |
| POST | `/v1/messages/threads/:id/status` | Update thread status |
| POST | `/v1/messages/threads/:id/resolve` | Resolve thread |
| POST | `/v1/messages/threads/:id/dnk` | Mark DNK (do not knock) |
| POST | `/v1/messages/twilio/inbound` | Twilio inbound webhook |

---

## Labor — `/v1/labor`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/labor/me` | Current laborer profile |
| GET | `/v1/labor/jobs` | List jobs (for laborer) |
| GET | `/v1/labor/availability` | Get availability |
| PUT | `/v1/labor/availability` | Update availability |
| GET | `/v1/labor/time-off` | List time-off |
| POST | `/v1/labor/time-off` | Create time-off |
| DELETE | `/v1/labor/time-off/:id` | Delete time-off |
| POST | `/v1/labor/jobs/:id/start` | Start job |
| POST | `/v1/labor/jobs/:id/complete` | Complete job |
| POST | `/v1/labor/jobs/:id/photo` | Upload job photo |
| GET | `/v1/labor/laborers` | List laborers (managers) |
| POST | `/v1/labor/laborers` | Create laborer |
| DELETE | `/v1/labor/laborers/:id` | Delete laborer |
| POST | `/v1/labor/jobs` | Create job (manager) |

---

## Jobs — `/v1/jobs`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/jobs` | List jobs |
| GET | `/v1/jobs/:id` | Get job |
| POST | `/v1/jobs` | Create job |
| POST | `/v1/jobs/:id/start` | Start job |
| POST | `/v1/jobs/:id/complete` | Complete job |
| POST | `/v1/jobs/:id/photos` | Upload job photos |
| GET | `/v1/jobs/:id/photos` | List job photos |

---

## Payments — `/v1/payments`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/payments/create-checkout` | Create Stripe checkout |
| POST | `/v1/payments/create-intent` | Create Stripe payment intent |
| POST | `/v1/payments/stripe/webhook` | Stripe webhook |

---

## Exports — `/v1/exports`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/exports` | List exports |
| POST | `/v1/exports` | Create export (queue job) |
| GET | `/v1/exports/:id/download` | Download export file |

---

## Analytics — `/v1/analytics`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/analytics/summary` | Analytics summary |
| GET | `/v1/analytics/timeseries` | Time-series analytics |
| GET | `/v1/analytics/leaderboard` | Leaderboard |

---

## Dashboard — `/v1/dashboard`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/dashboard/overview` | Dashboard overview |

---

## Audit — `/v1/audit`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/audit` | List audit log (query params) |

---

## Aliases (under `/v1`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/me` | Current user (alias; see also `/v1/auth/me`) |
| POST | `/v1/twilio/inbound` | Twilio inbound webhook (alias) |
| POST | `/v1/stripe/webhook` | Stripe webhook (alias) |
