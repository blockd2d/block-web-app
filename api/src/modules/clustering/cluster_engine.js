import { meanLatLon, projectToXY, unprojectToLatLon } from './geo.js';
import { kmeans2D } from './kmeans.js';

/**
 * Cluster lat/lon points into k groups.
 * points: [{id, lat, lon, ...}]
 */
export function clusterPoints(points, opts = {}) {
  const k = opts.k;
  const maxPerCluster = opts.maxPerCluster;
  const iterations = opts.iterations ?? 40;
  const seed = opts.seed ?? 42;

  if (!Number.isInteger(k) && !Number.isInteger(maxPerCluster)) {
    throw new Error('Provide either k or maxPerCluster');
  }

  const clean = points
    .map((p, idx) => ({ ...p, _idx: idx }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  const [lat0, lon0] = meanLatLon(clean);

  const XY = clean.map(p => projectToXY(p.lat, p.lon, lat0, lon0));

  const kFinal = Number.isInteger(k)
    ? Math.max(1, Math.min(k, XY.length))
    : Math.max(1, Math.ceil(XY.length / maxPerCluster));

  const { centroids, assignments, inertia } = kmeans2D(XY, kFinal, { iterations, seed });

  const clusterCounts = new Array(kFinal).fill(0);
  for (const a of assignments) clusterCounts[a]++;

  const clusters = centroids.map((c, i) => {
    const [clat, clon] = unprojectToLatLon(c[0], c[1], lat0, lon0);
    return {
      clusterId: i,
      size: clusterCounts[i],
      centroid: { lat: clat, lon: clon },
    };
  });

  const pointAssignments = clean.map((p, i) => ({
    id: p.id ?? p._idx,
    lat: p.lat,
    lon: p.lon,
    clusterId: assignments[i]
  }));

  return {
    k: kFinal,
    origin: { lat0, lon0 },
    inertia,
    clusters,
    assignments: pointAssignments
  };
}
