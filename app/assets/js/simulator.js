/*
  Block Route Quality Simulator
  - No external APIs, runs locally.
  - requestAnimationFrame animation, reduced-motion aware.
  - Manual vs Optimized toggle
  - Sliders: density, tightness
  - Visual: points cluster + route tightens
*/
(() => {
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function dist(a, b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

  function seededRandom(seed){
    // Mulberry32
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function kmeans(points, k, rng, iters=6){
    // Very small, fast k-means for visual clustering.
    const centers = [];
    for (let i=0;i<k;i++){
      const p = points[Math.floor(rng()*points.length)];
      centers.push({x:p.x, y:p.y});
    }
    const assign = new Array(points.length).fill(0);

    for (let it=0; it<iters; it++){
      // assign
      for (let i=0;i<points.length;i++){
        let best=0, bestD=Infinity;
        for (let c=0;c<k;c++){
          const d = (points[i].x-centers[c].x)**2 + (points[i].y-centers[c].y)**2;
          if (d<bestD){ bestD=d; best=c; }
        }
        assign[i]=best;
      }
      // recompute
      const sums = new Array(k).fill(0).map(()=>({x:0,y:0,n:0}));
      for (let i=0;i<points.length;i++){
        const c = assign[i];
        sums[c].x += points[i].x;
        sums[c].y += points[i].y;
        sums[c].n += 1;
      }
      for (let c=0;c<k;c++){
        if (sums[c].n>0){
          centers[c].x = sums[c].x / sums[c].n;
          centers[c].y = sums[c].y / sums[c].n;
        }
      }
    }
    return {centers, assign};
  }

  function routeLength(order, pts){
    let L = 0;
    for (let i=1;i<order.length;i++){
      L += dist(pts[order[i-1]], pts[order[i]]);
    }
    return L;
  }

  function nearestNeighbor(pts){
    // Greedy TSP-ish starting at first point
    const n = pts.length;
    const used = new Array(n).fill(false);
    const order = new Array(n);
    order[0] = 0;
    used[0] = true;
    for (let i=1;i<n;i++){
      const last = order[i-1];
      let best=-1, bestD=Infinity;
      for (let j=0;j<n;j++){
        if (used[j]) continue;
        const d = dist(pts[last], pts[j]);
        if (d<bestD){ bestD=d; best=j; }
      }
      order[i]=best;
      used[best]=true;
    }
    return order;
  }

  function twoOpt(order, pts, passes=2){
    // Simple 2-opt improvement; capped passes for speed.
    const n = order.length;
    function segCost(a,b,c,d){
      return dist(pts[a], pts[b]) + dist(pts[c], pts[d]);
    }
    for (let pass=0; pass<passes; pass++){
      let improved=false;
      for (let i=1; i<n-2; i++){
        for (let k=i+1; k<n-1; k++){
          const a = order[i-1], b=order[i], c=order[k], d=order[k+1];
          const before = segCost(a,b,c,d);
          const after  = dist(pts[a], pts[c]) + dist(pts[b], pts[d]);
          if (after + 1e-6 < before){
            // reverse segment i..k
            for (let s=0, e=k; s < (k-i+1)/2; s++, e--){
              const tmp = order[i+s];
              order[i+s] = order[e];
              order[e] = tmp;
            }
            improved=true;
          }
        }
      }
      if (!improved) break;
    }
    return order;
  }

  class Simulator{
    constructor(root){
      this.root = root;
      this.canvas = root.querySelector("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.modeButtons = Array.from(root.querySelectorAll("[data-mode]"));
      this.density = root.querySelector("#density");
      this.tightness = root.querySelector("#tightness");
      this.statClose = root.querySelector("#statClose");
      this.statTime = root.querySelector("#statTime");
      this.statOver = root.querySelector("#statOver");
      this.pillMode = root.querySelector("#pillMode");

      this.mode = "manual";
      this.seed = 7;
      this.rng = seededRandom(this.seed);

      this.points = [];
      this.original = [];
      this.target = [];
      this.orderManual = [];
      this.orderOpt = [];

      this.resizeObserver = null;
      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.t = 0;
      this.running = true;

      this.init();
    }

    init(){
      this.bind();
      this.onResize();
      this.regen();
      this.start();
    }

    bind(){
      // mode toggles
      this.modeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
          const m = btn.getAttribute("data-mode");
          this.setMode(m);
        });
      });

      const onInput = () => {
        this.regen();
      };
      this.density.addEventListener("input", onInput);
      this.tightness.addEventListener("input", () => {
        // no regen; just change target blending
      });

      // Resize
      const ro = new ResizeObserver(() => this.onResize());
      ro.observe(this.canvas.parentElement);
      this.resizeObserver = ro;

      document.addEventListener("visibilitychange", () => {
        this.running = !document.hidden;
        if (this.running && !prefersReduced) this.start();
      });
    }

    setMode(m){
      this.mode = m === "optimized" ? "optimized" : "manual";
      this.modeButtons.forEach(b => b.setAttribute("aria-pressed", (b.getAttribute("data-mode") === this.mode) ? "true" : "false"));
      if (this.pillMode) this.pillMode.textContent = (this.mode === "optimized") ? "Optimized route" : "Manual route";
    }

    onResize(){
      const wrap = this.canvas.parentElement;
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.floor(420);
      this.canvas.width = Math.floor(w * this.dpr);
      this.canvas.height = Math.floor(h * this.dpr);
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    }

    regen(){
      const n = parseInt(this.density.value, 10);
      // fixed RNG per regen for stable feel when dragging
      this.rng = seededRandom(this.seed + n * 17);

      const pad = 30;
      const w = this.canvas.clientWidth || 720;
      const h = 420;

      const pts = [];
      for (let i=0;i<n;i++){
        // generate scattered but with mild clusters so the "optimized" can tighten territories
        const u = this.rng();
        const v = this.rng();
        pts.push({
          x: lerp(pad, w-pad, u),
          y: lerp(pad, h-pad, v),
          vx: 0, vy: 0
        });
      }

      // store
      this.original = pts.map(p => ({x:p.x, y:p.y}));
      this.points = pts.map(p => ({x:p.x, y:p.y, vx:0, vy:0}));
      this.target = pts.map(p => ({x:p.x, y:p.y}));

      // compute routes
      this.orderManual = Array.from({length:n}, (_,i)=>i); // "entered order" = poor manual route
      this.orderOpt = nearestNeighbor(this.original);
      this.orderOpt = twoOpt(this.orderOpt.slice(), this.original, 2);

      // compute cluster targets for optimized mode (visual)
      const k = clamp(Math.round(n / 28), 3, 7);
      const km = kmeans(this.original, k, this.rng, 6);
      // small deterministic offsets so points don't stack perfectly
      const offsets = km.centers.map(() => ({x:(this.rng()-0.5)*18, y:(this.rng()-0.5)*18}));
      this.cluster = {centers: km.centers, assign: km.assign, offsets};
    }

    computeTargets(){
      const tight = parseFloat(this.tightness.value);
      for (let i=0;i<this.points.length;i++){
        const o = this.original[i];
        if (this.mode === "manual"){
          this.target[i].x = o.x;
          this.target[i].y = o.y;
        } else {
          const c = this.cluster.assign[i];
          const center = this.cluster.centers[c];
          const off = this.cluster.offsets[c];
          // pull points toward center; tightness controls how much territory tightens
          this.target[i].x = lerp(o.x, center.x + off.x, tight);
          this.target[i].y = lerp(o.y, center.y + off.y, tight);
        }
      }
    }

    step(dt){
      // smooth points toward targets (spring-ish)
      this.computeTargets();
      const stiffness = prefersReduced ? 1 : 10;
      const damping = prefersReduced ? 1 : 0.86;
      for (let i=0;i<this.points.length;i++){
        const p = this.points[i];
        const tx = this.target[i].x;
        const ty = this.target[i].y;
        const ax = (tx - p.x) * stiffness;
        const ay = (ty - p.y) * stiffness;
        p.vx = (p.vx + ax * dt) * damping;
        p.vy = (p.vy + ay * dt) * damping;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    metrics(){
      // Compare manual vs current (mode impacts route algorithm + visual positions)
      const ptsForRoute = this.points.map(p => ({x:p.x, y:p.y}));

      const manualLen = routeLength(this.orderManual, ptsForRoute);
      const optOrder = (this.mode === "optimized") ? this.orderOpt : this.orderManual;
      const curLen = routeLength(optOrder, ptsForRoute);

      // Convert pixels to "minutes" (arbitrary but consistent). Keep believable.
      const minutesPerPx = 0.055; // scale
      const savedMin = Math.max(0, (manualLen - curLen) * minutesPerPx);

      // Close-rate model (simple, transparent): less travel + tighter territories improves focus.
      const ratio = manualLen > 0 ? (manualLen / curLen) : 1;
      const tight = parseFloat(this.tightness.value);
      const closeGain = clamp((ratio - 1) * 14 + tight * 4, 0, 22); // percentage points
      const overheadGain = clamp(savedMin * 0.12 + tight * 6, 0, 18);

      return { manualLen, curLen, savedMin, closeGain, overheadGain };
    }

    draw(){
      const ctx = this.ctx;
      const w = this.canvas.clientWidth || 720;
      const h = 420;

      ctx.clearRect(0,0,w,h);

      // Background grid (subtle)
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#0C0F14";
      ctx.lineWidth = 1;
      for (let x=40; x<w; x+=40){
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
      }
      for (let y=40; y<h; y+=40){
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
      }
      ctx.restore();

      // Route
      const order = (this.mode === "optimized") ? this.orderOpt : this.orderManual;
      ctx.save();
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      // Use a multi-stop stroke by drawing twice (no new colors; uses brand variables computed in CSS?)
      // We can't access CSS vars directly reliably for canvas, so we use neutral + alpha; still premium.
      ctx.strokeStyle = "rgba(47,60,246,.55)";
      ctx.beginPath();
      for (let i=0;i<order.length;i++){
        const p = this.points[order[i]];
        if (i===0) ctx.moveTo(p.x,p.y);
        else ctx.lineTo(p.x,p.y);
      }
      ctx.stroke();

      ctx.strokeStyle = "rgba(12,15,20,.22)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i=0;i<order.length;i++){
        const p = this.points[order[i]];
        if (i===0) ctx.moveTo(p.x,p.y);
        else ctx.lineTo(p.x,p.y);
      }
      ctx.stroke();
      ctx.restore();

      // Points
      for (let i=0;i<this.points.length;i++){
        const p = this.points[i];
        ctx.beginPath();
        ctx.fillStyle = "rgba(12,15,20,.76)";
        ctx.arc(p.x, p.y, 3.4, 0, Math.PI*2);
        ctx.fill();

        // halo
        ctx.beginPath();
        ctx.fillStyle = "rgba(47,60,246,.10)";
        ctx.arc(p.x, p.y, 8.8, 0, Math.PI*2);
        ctx.fill();
      }

      // Legend labels
      ctx.save();
      ctx.fillStyle = "rgba(12,15,20,.70)";
      ctx.font = "600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      ctx.fillText("Leads", 14, 18);
      ctx.fillStyle = "rgba(47,60,246,.65)";
      ctx.fillText(this.mode === "optimized" ? "Optimized path" : "Manual path", 14, 36);
      ctx.restore();
    }

    updateStats(){
      const m = this.metrics();
      if (this.statClose) this.statClose.textContent = `+${m.closeGain.toFixed(1)}%`;
      if (this.statTime) this.statTime.textContent = `${Math.round(m.savedMin)} min`;
      if (this.statOver) this.statOver.textContent = `-${m.overheadGain.toFixed(0)}%`;
    }

    start(){
      if (prefersReduced) {
        // One paint for reduced motion
        this.step(1/60);
        this.draw();
        this.updateStats();
        return;
      }
      let last = performance.now();
      const tick = (now) => {
        if (!this.running) return;
        const dt = clamp((now - last) / 1000, 0.0, 0.05);
        last = now;
        this.step(dt);
        this.draw();
        this.updateStats();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  function init(){
    const root = document.getElementById("route-sim");
    if (!root) return;
    new Simulator(root);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
