export type Viewport = {
  width: number;
  height: number;
  centerLat: number;
  centerLng: number;
  pxPerDegreeLat: number;
  pxPerDegreeLng: number;
};

class SeededRandom {
  seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// A lightweight procedural basemap inspired by Block V6.
export function drawProceduralBasemap(ctx: CanvasRenderingContext2D, vp: Viewport) {
  const w = vp.width;
  const h = vp.height;

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  const grid = 40;
  for (let x = 0; x < w; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Procedural roads (pseudo-random curves)
  const seed = Math.floor((vp.centerLat * 1000) ^ (vp.centerLng * 1000));
  const rnd = new SeededRandom(seed);

  function drawRoad(thickness: number, alpha: number) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const lines = 14;
    for (let i = 0; i < lines; i++) {
      const y0 = rnd.next() * h;
      const x0 = -100;
      const x1 = w + 100;
      const ctrl1 = { x: w * (0.3 + rnd.next() * 0.2), y: y0 + (rnd.next() - 0.5) * 160 };
      const ctrl2 = { x: w * (0.6 + rnd.next() * 0.2), y: y0 + (rnd.next() - 0.5) * 160 };

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(ctrl1.x, ctrl1.y, ctrl2.x, ctrl2.y, x1, y0 + (rnd.next() - 0.5) * 60);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // arterial then local
  drawRoad(3, 0.11);
  drawRoad(1.5, 0.08);

  // Vignette
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
