# Backend & Supabase Changes for Nova Sales Mobile

Simple checklist for API and database changes needed to support the rep-mobile app. This doc extends the **Block API Endpoint Reference Guide** (internal PDF) with schema details rep-mobile requires.

**rep-mobile uses these Block API routes (all listed in the PDF):**

| PDF Section | Route | Method | Purpose |
|-------------|-------|--------|---------|
| Auth | `/v1/auth/login` | POST | Sign in |
| Auth | `/v1/auth/logout` | POST | Sign out |
| Auth | `/v1/auth/refresh` | POST | Renew session |
| Auth | `/v1/auth/me` | GET | Current user |
| Reps | `/v1/reps/me` | GET | Signed-in rep profile |
| Reps | `/v1/reps/me/clusters` | GET | Clusters assigned to rep |
| Clusters | `/v1/clusters/:id` | GET | Cluster detail |
| Clusters | `/v1/clusters/:id/properties` | GET | Properties in cluster |
| Interactions | `/v1/interactions` | GET | Interaction records |
| Interactions | `/v1/interactions` | POST | Create interaction (knock) |
| Sales | `/v1/sales` | GET | Sales (filtered by property_id) |
| Sales | `/v1/sales` | POST | Create sale |
| Sales | `/v1/sales/:id` | PUT | Update sale |

---

## 1. API Changes

### Cluster schedule fields (extension to `/v1/reps/me/clusters`)

**Endpoint:** `GET /v1/reps/me/clusters` (PDF: Reps, "Returns the clusters currently assigned to the signed-in rep")

**Required:** Each cluster must expose schedule times. The mobile app reads from:

- Top-level: `scheduled_start`, `scheduled_end` (ISO 8601 strings, e.g. `"2025-03-10T09:00:00.000Z"`)
- Fallback: `stats_json.scheduled_start`, `stats_json.scheduled_end`

**Example response shape:**
  
```json
{
  "clusters": [
    {
      "id": "...",
      "scheduled_start": "2025-03-10T09:00:00.000Z",
      "scheduled_end": "2025-03-10T11:00:00.000Z"
    }
  ]
}
```

If a cluster has no schedule, return `null` for those fields. The app will show "Unscheduled" and omit it from the Calendar view.

---

## 2. Supabase Changes

### Option A: Add columns to `clusters`

Add two nullable timestamp columns:

| Column           | Type        | Notes                          |
|------------------|-------------|--------------------------------|
| `scheduled_start`| `timestamptz` | When the cluster is scheduled to start |
| `scheduled_end`  | `timestamptz` | When the cluster is scheduled to end   |

Migration example:

```sql
ALTER TABLE clusters
  ADD COLUMN IF NOT EXISTS scheduled_start timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end timestamptz;
```

### Option B: Store in `stats_json`

Store schedule in the existing `stats_json` JSONB column:

```json
{
  "scheduled_start": "2025-03-10T09:00:00.000Z",
  "scheduled_end": "2025-03-10T11:00:00.000Z",
  "stop_count": 14,
  "ordered_property_ids": ["..."]
}
```

The API should include `scheduled_start` and `scheduled_end` in the cluster payload, reading from either the columns or `stats_json`.

---

## 3. Summary

| Area        | Change                                                      |
|-------------|-------------------------------------------------------------|
| API         | Return `scheduled_start` and `scheduled_end` per cluster    |
| Supabase    | Add columns or populate `stats_json` with schedule fields   |
