// src/kmeans.js
// Seeded K-means with K-means++ init on 2D points.
// points: Array<[x,y]>
// returns { centroids, assignments, iters, inertia }
export function kmeans2D(points, opts = {}) {
  const {
    k,
    maxIter = 100,
    tol = 1e-4,
    seed = 42
  } = opts;

  if (!Number.isInteger(k) || k <= 0) throw new Error("k must be a positive integer.");
  if (points.length < k) throw new Error(`Need at least k points (have ${points.length}, k=${k}).`);

  const rng = mulberry32(seed);

  // --- init centroids with kmeans++ ---
  let centroids = initKMeansPP(points, k, rng);

  let assignments = new Array(points.length).fill(-1);
  let iters = 0;

  for (; iters < maxIter; iters++) {
    // Assign step
    let changed = 0;
    let inertia = 0;

    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      let best = 0;
      let bestD = dist2([x, y], centroids[0]);

      for (let c = 1; c < centroids.length; c++) {
        const d = dist2([x, y], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }

      inertia += bestD;
      if (assignments[i] !== best) { assignments[i] = best; changed++; }
    }

    // Update step
    const sums = Array.from({ length: k }, () => [0, 0, 0]); // sumX, sumY, count
    for (let i = 0; i < points.length; i++) {
      const c = assignments[i];
      const [x, y] = points[i];
      sums[c][0] += x;
      sums[c][1] += y;
      sums[c][2] += 1;
    }

    let maxShift = 0;
    for (let c = 0; c < k; c++) {
      if (sums[c][2] === 0) {
        // Empty cluster: re-seed to a random point
        const p = points[Math.floor(rng() * points.length)];
        maxShift = Math.max(maxShift, Math.sqrt(dist2(centroids[c], p)));
        centroids[c] = [p[0], p[1]];
        continue;
      }
      const nx = sums[c][0] / sums[c][2];
      const ny = sums[c][1] / sums[c][2];
      const shift = Math.sqrt(dist2(centroids[c], [nx, ny]));
      if (shift > maxShift) maxShift = shift;
      centroids[c] = [nx, ny];
    }

    if (maxShift <= tol) {
      return { centroids, assignments, iters: iters + 1, inertia };
    }

    // If nothing changed, we're effectively done.
    if (changed === 0) {
      return { centroids, assignments, iters: iters + 1, inertia };
    }
  }

  // Final inertia calc
  let inertia = 0;
  for (let i = 0; i < points.length; i++) inertia += dist2(points[i], centroids[assignments[i]]);
  return { centroids, assignments, iters, inertia };
}

function dist2(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function initKMeansPP(points, k, rng) {
  // Choose first centroid uniformly at random
  const centroids = [];
  centroids.push(points[Math.floor(rng() * points.length)].slice());

  // Distances to nearest centroid (squared)
  const d2 = new Array(points.length).fill(Infinity);

  for (let c = 1; c < k; c++) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const d = dist2(points[i], centroids[centroids.length - 1]);
      if (d < d2[i]) d2[i] = d;
      sum += d2[i];
    }

    // Pick next centroid proportional to d2
    let r = rng() * sum;
    let idx = 0;
    for (; idx < d2.length; idx++) {
      r -= d2[idx];
      if (r <= 0) break;
    }
    centroids.push(points[Math.min(idx, points.length - 1)].slice());
  }
  return centroids;
}

// Small fast seeded PRNG
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
