export type LatLng = { lat: number; lng: number };

function cross(o: LatLng, a: LatLng, b: LatLng) {
  return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
}

/** Graham scan convex hull (returns counter-clockwise points). */
export function convexHull(points: LatLng[]): LatLng[] {
  if (!points || points.length < 3) return points ? [...points] : [];
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i].lat < points[lowest].lat ||
      (points[i].lat === points[lowest].lat && points[i].lng < points[lowest].lng)
    ) {
      lowest = i;
    }
  }
  const pivot = points[lowest];
  const rest = points.filter((_, i) => i !== lowest);
  rest.sort((a, b) => {
    const angleA = Math.atan2(a.lat - pivot.lat, a.lng - pivot.lng);
    const angleB = Math.atan2(b.lat - pivot.lat, b.lng - pivot.lng);
    if (angleA !== angleB) return angleA - angleB;
    const distA = (a.lat - pivot.lat) ** 2 + (a.lng - pivot.lng) ** 2;
    const distB = (b.lat - pivot.lat) ** 2 + (b.lng - pivot.lng) ** 2;
    return distA - distB;
  });

  const stack: LatLng[] = [pivot];
  for (const p of rest) {
    while (stack.length > 1 && cross(stack[stack.length - 2], stack[stack.length - 1], p) <= 0) {
      stack.pop();
    }
    stack.push(p);
  }
  return stack;
}

export function centroid(points: LatLng[]): LatLng {
  if (!points || points.length === 0) return { lat: 0, lng: 0 };
  let sumLat = 0;
  let sumLng = 0;
  for (const p of points) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  return { lat: sumLat / points.length, lng: sumLng / points.length };
}
