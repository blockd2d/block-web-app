export type Point = { id: string; lat: number; lng: number };
export type Cluster = { key: string; points: Point[]; center: { lat: number; lng: number } };

function haversineMeters(a: Point, b: Point) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const lat1 = a.lat * Math.PI/180;
  const lat2 = b.lat * Math.PI/180;
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}

export function gridDbscan(points: Point[], epsMeters: number, minPts: number): Cluster[] {
  // fast-ish grid bucketing by approx degrees
  const deg = epsMeters / 111000;
  const grid = new Map<string, Point[]>();
  const keyFor = (p: Point) => `${Math.floor(p.lat/deg)}:${Math.floor(p.lng/deg)}`;
  for (const p of points) {
    const k = keyFor(p);
    const arr = grid.get(k) ?? [];
    arr.push(p);
    grid.set(k, arr);
  }

  const visited = new Set<string>();
  const assigned = new Set<string>();
  const clusters: Cluster[] = [];

  const neighbors = (p: Point) => {
    const [gy, gx] = keyFor(p).split(":").map(Number);
    const out: Point[] = [];
    for (let dy=-1; dy<=1; dy++){
      for (let dx=-1; dx<=1; dx++){
        const arr = grid.get(`${gy+dy}:${gx+dx}`);
        if (!arr) continue;
        for (const q of arr) {
          if (haversineMeters(p,q) <= epsMeters) out.push(q);
        }
      }
    }
    return out;
  };

  for (const p of points) {
    if (visited.has(p.id)) continue;
    visited.add(p.id);

    const ns = neighbors(p);
    if (ns.length < minPts) continue;

    const clusterPts: Point[] = [];
    const stack = [...ns];
    while (stack.length) {
      const q = stack.pop()!;
      if (!visited.has(q.id)) {
        visited.add(q.id);
        const ns2 = neighbors(q);
        if (ns2.length >= minPts) stack.push(...ns2);
      }
      if (!assigned.has(q.id)) {
        assigned.add(q.id);
        clusterPts.push(q);
      }
    }

    const center = clusterPts.reduce((acc, pt) => ({ lat: acc.lat + pt.lat, lng: acc.lng + pt.lng }), {lat:0,lng:0});
    center.lat /= Math.max(1, clusterPts.length);
    center.lng /= Math.max(1, clusterPts.length);

    clusters.push({ key: `c${clusters.length+1}`, points: clusterPts, center });
  }
  return clusters;
}

export function convexHullLngLat(points: {lng:number; lat:number}[]) {
  // Monotonic chain on (lng,lat)
  const pts = [...points].sort((a,b)=> a.lng===b.lng ? a.lat-b.lat : a.lng-b.lng);
  const cross = (o:any,a:any,b:any)=> (a.lng-o.lng)*(b.lat-o.lat)-(a.lat-o.lat)*(b.lng-o.lng);
  const lower:any[] = [];
  for(const p of pts){
    while(lower.length>=2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper:any[] = [];
  for(const p of pts.slice().reverse()){
    while(upper.length>=2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  const hull = lower.concat(upper);
  return hull;
}

export function hullToGeoJSONPolygon(hull: {lng:number; lat:number}[]) {
  if (hull.length < 3) return null;
  const ring = hull.concat([hull[0]]).map(p => [p.lng, p.lat]);
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
}
