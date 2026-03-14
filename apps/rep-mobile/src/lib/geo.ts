import type { LatLng, Stop } from "../types";

export function stopToLatLng(s: Stop): LatLng | null {
  const lat = s.lat;
  const lng = s.lng;
  if (typeof lat === "number" && typeof lng === "number") return { latitude: lat, longitude: lng };
  return null;
}

export function compactLatLng(points: Array<LatLng | null | undefined>): LatLng[] {
  const out: LatLng[] = [];
  for (const p of points) {
    if (!p) continue;
    if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) out.push(p);
  }
  return out;
}

export function bounds(points: LatLng[]): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  if (!points.length) return null;
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function regionFromBounds(b: { minLat: number; maxLat: number; minLng: number; maxLng: number }, padding = 0.01) {
  const latDelta = Math.max(0.002, b.maxLat - b.minLat + padding);
  const lngDelta = Math.max(0.002, b.maxLng - b.minLng + padding);
  return {
    latitude: (b.minLat + b.maxLat) / 2,
    longitude: (b.minLng + b.maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta
  };
}

// Haversine distance in meters.
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const x = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export function polylineDistanceMiles(points: LatLng[]): number {
  if (points.length < 2) return 0;
  let meters = 0;
  for (let i = 1; i < points.length; i++) meters += haversineMeters(points[i - 1], points[i]);
  return meters / 1609.344;
}
