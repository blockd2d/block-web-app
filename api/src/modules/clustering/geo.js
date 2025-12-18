// src/geo.js
// Lightweight lat/lon <-> local Cartesian conversion for K-means.
// Uses an equirectangular approximation relative to a chosen origin (lat0, lon0).
const R = 6371000; // meters

export function makeLocalProjector(lat0, lon0) {
  const lat0Rad = (lat0 * Math.PI) / 180;
  const lon0Rad = (lon0 * Math.PI) / 180;
  const cosLat0 = Math.cos(lat0Rad);

  function toXY(lat, lon) {
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const x = (lonRad - lon0Rad) * cosLat0 * R;
    const y = (latRad - lat0Rad) * R;
    return [x, y];
  }

  function toLatLon(x, y) {
    const latRad = (y / R) + lat0Rad;
    const lonRad = (x / (R * cosLat0)) + lon0Rad;
    return [(latRad * 180) / Math.PI, (lonRad * 180) / Math.PI];
  }

  return { toXY, toLatLon, lat0, lon0 };
}

export function meanLatLon(points) {
  // points: Array<{lat:number, lon:number}>
  let sLat = 0, sLon = 0, n = 0;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    sLat += p.lat; sLon += p.lon; n++;
  }
  if (n === 0) throw new Error("No valid lat/lon points.");
  return { lat0: sLat / n, lon0: sLon / n };
}
