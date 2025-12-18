# Property Cluster API (K-means on lat/lon)

This is a tiny **Node/Express** API wrapper around the same clustering engine:

- **lat/lon → local XY meters** (equirectangular projection around a computed origin)
- **K-means++** in 2D
- returns **cluster centroids + assignments** (id, lat, lon, clusterId)

## Install + run

```bash
npm install
npm run start
# server: http://localhost:8080
```

## Endpoints

### POST `/api/clusters/suggest`
Give the API a count of points and constraints, it returns a handful of reasonable `k` values.

Body (JSON):
```json
{ "nPoints": 9109, "maxPerCluster": 200, "reps": 6 }
```

### POST `/api/clusters/from-csv`
Upload a CSV and cluster it.

- `file`: CSV (multipart)
- optional fields: `latField` (default `latitude`), `lonField` (default `longitude`), `idField` (optional)
- choose **one**: `k` or `maxPerCluster`
- tuning: `iterations` (default 40), `seed` (default 42)

`curl` example:
```bash
curl -F "file=@Block_Hendricks_County.csv" \
  -F "latField=latitude" -F "lonField=longitude" \
  -F "maxPerCluster=200" \
  http://localhost:8080/api/clusters/from-csv
```

Response (shape):
```json
{
  "runId": "abc123",
  "k": 46,
  "nPoints": 9109,
  "origin": {"lat0": 39.7, "lon0": -86.6},
  "inertia": 123456.7,
  "clusters": [
    {"clusterId": 0, "size": 193, "centroid": {"lat": 39.71, "lon": -86.62}}
  ],
  "assignments": [
    {"id": "123", "lat": 39.70, "lon": -86.61, "clusterId": 0}
  ]
}
```

### GET `/api/clusters/:runId`
Fetch a run summary (clusters + centroid data).

### GET `/api/clusters/:runId/points?clusterId=0&limit=5000`
Fetch points for a specific cluster (use this to render pins only for the selected territory).

---

## UI integration idea (matches your screenshots)

1) **Cluster Creation page**
- call `/api/clusters/suggest` to show options like “~200 doors per territory”, “one per rep”, etc.
- when user picks an option, upload the CSV once to `/api/clusters/from-csv`
- render:
  - polygons later (optional), but immediately you can render **centroid markers** and show cluster cards with `size`

2) **Cluster Assignment page**
- your app stores human labels/colors for each cluster (e.g., “North District”, “South District”)
- call `/api/clusters/:runId` to show all clusters
- when a user clicks a cluster, call `/api/clusters/:runId/points?clusterId=X` to render only that cluster’s pins

