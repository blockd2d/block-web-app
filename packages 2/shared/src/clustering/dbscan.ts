import { centroid, convexHull, type LatLng } from './hull';

const EARTH_RADIUS_MILES = 3958.8;

export type DbPoint = LatLng & { id: string; value?: number | null };

export type DbCluster = {
  id: string;
  memberPropertyIds: string[];
  center: LatLng;
  hull: LatLng[];
};

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/** Convert meters to miles. */
export function metersToMiles(m: number) {
  return m / 1609.344;
}

type SpatialIndex = {
  grid: Map<string, number[]>;
  cellSizeLat: number;
  cellSizeLng: number;
};

function buildSpatialIndex(points: DbPoint[], epsMiles: number): SpatialIndex {
  let avgLat = 0;
  for (const p of points) avgLat += p.lat;
  avgLat /= points.length;

  const latDegPerMile = 1 / 69;
  const lngDegPerMile = 1 / (69 * Math.cos((avgLat * Math.PI) / 180));

  const cellSizeLat = epsMiles * latDegPerMile * 1.1;
  const cellSizeLng = epsMiles * lngDegPerMile * 1.1;

  const grid = new Map<string, number[]>();
  points.forEach((point, index) => {
    const cellX = Math.floor(point.lng / cellSizeLng);
    const cellY = Math.floor(point.lat / cellSizeLat);
    const key = `${cellX},${cellY}`;
    const arr = grid.get(key) || [];
    arr.push(index);
    grid.set(key, arr);
  });

  return { grid, cellSizeLat, cellSizeLng };
}

function rangeQuery(points: DbPoint[], pointIndex: number, index: SpatialIndex, epsMiles: number) {
  const point = points[pointIndex];
  const { grid, cellSizeLat, cellSizeLng } = index;
  const cellX = Math.floor(point.lng / cellSizeLng);
  const cellY = Math.floor(point.lat / cellSizeLat);

  const neighbors: number[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${cellX + dx},${cellY + dy}`;
      const cell = grid.get(key);
      if (!cell) continue;
      for (const idx of cell) {
        if (idx === pointIndex) continue;
        const dist = haversineMiles(point.lat, point.lng, points[idx].lat, points[idx].lng);
        if (dist <= epsMiles) neighbors.push(idx);
      }
    }
  }
  neighbors.push(pointIndex);
  return neighbors;
}

function expandCluster(
  points: DbPoint[],
  labels: number[],
  pointIndex: number,
  neighbors: number[],
  clusterId: number,
  epsMiles: number,
  minPts: number,
  index: SpatialIndex
) {
  labels[pointIndex] = clusterId;
  const queue = [...neighbors];
  const processed = new Set<number>([pointIndex]);

  while (queue.length > 0) {
    const currentIdx = queue.shift()!;
    if (processed.has(currentIdx)) continue;
    processed.add(currentIdx);

    if (labels[currentIdx] === -1) labels[currentIdx] = clusterId;
    if (labels[currentIdx] !== -2) continue;

    labels[currentIdx] = clusterId;

    const currentNeighbors = rangeQuery(points, currentIdx, index, epsMiles);
    if (currentNeighbors.length >= minPts) {
      for (const idx of currentNeighbors) {
        if (!processed.has(idx)) queue.push(idx);
      }
    }
  }
}

/** DBSCAN clustering adapted from Block V6 (grid index + haversine). */
export function dbscanCluster(
  points: DbPoint[],
  epsMeters: number,
  minPts: number,
  onProgress?: (p: number) => void
): DbCluster[] {
  if (!points || points.length === 0) return [];
  const epsMiles = metersToMiles(epsMeters);

  const index = buildSpatialIndex(points, epsMiles);
  const labels = new Array(points.length).fill(-2); // -2 = undefined, -1 = noise
  let clusterId = 0;

  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== -2) continue;
    const neighbors = rangeQuery(points, i, index, epsMiles);

    if (neighbors.length < minPts) labels[i] = -1;
    else {
      expandCluster(points, labels, i, neighbors, clusterId, epsMiles, minPts, index);
      clusterId++;
    }
    if (onProgress && i % 2000 === 0) onProgress(i / points.length);
  }
  if (onProgress) onProgress(1);

  const clusters: DbCluster[] = [];
  for (let c = 0; c < clusterId; c++) {
    const memberIdx: number[] = [];
    for (let i = 0; i < labels.length; i++) if (labels[i] === c) memberIdx.push(i);
    if (memberIdx.length < minPts) continue;
    const memberPoints = memberIdx.map((i) => points[i]);
    const memberIds = memberPoints.map((p) => p.id);
    const center = centroid(memberPoints);
    const hull = convexHull(memberPoints);
    clusters.push({ id: uid('cluster'), memberPropertyIds: memberIds, center, hull });
  }
  return clusters;
}
