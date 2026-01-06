/*
  Territory & Route Playground — Demo-first, product-like sandbox
  - Offline/local: dummy houses + dummy reps/managers
  - Adjust territory radius, drag manager pins, click houses to override assignment
  - Route suggestion + metrics
  - requestAnimationFrame animation + reduced-motion support
*/
(() => {
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function seededRandom(seed){
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function nearestNeighbor(startIdx, pts){
    const n = pts.length;
    const used = new Array(n).fill(false);
    const order = [];
    let cur = startIdx;
    for (let i=0;i<n;i++){
      order.push(cur);
      used[cur] = true;
      let best = -1, bestD = Infinity;
      for (let j=0;j<n;j++){
        if (used[j]) continue;
        const d = dist(pts[cur], pts[j]);
        if (d < bestD){
          bestD = d; best = j;
        }
      }
      cur = best;
      if (cur === -1) break;
    }
    return order;
  }

  function polylineLength(points, order){
    let L = 0;
    for (let i=1;i<order.length;i++){
      L += dist(points[order[i-1]], points[order[i]]);
    }
    return L;
  }

  function roundRect(ctx, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  class Playground{
    constructor(root){
      this.root = root;
      this.canvas = root.querySelector("#demoCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.repSelect = root.querySelector("#repSelect");
      this.radius = root.querySelector("#radius");
      this.autoAssign = root.querySelector("#autoAssign");
      this.resetBtn = root.querySelector("#resetDemo");
      this.metricDrive = root.querySelector("#mDrive");
      this.metricStops = root.querySelector("#mStops");
      this.metricClose = root.querySelector("#mClose");
      this.list = root.querySelector("#houseList");

      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.w = 0;
      this.h = 0;

      this.seed = 42;
      this.rng = seededRandom(this.seed);

      this.houses = [];
      this.reps = [];
      this.activeRep = 0;

      this.drag = null;
      this.hoverHouse = -1;

      this._last = 0;
      this._running = true;

      this.init();
    }

    init(){
      this.setupData();
      this.bind();
      this.resize();
      this.recompute();
      this.start();
    }

    setupData(){
      this.reps = [
        { id: 0, name: "Rep A", x: 220, y: 210, rTarget: 160, rShown: 160, colorKey: "indigo" },
        { id: 1, name: "Rep B", x: 540, y: 180, rTarget: 150, rShown: 150, colorKey: "mint" },
        { id: 2, name: "Rep C", x: 420, y: 410, rTarget: 170, rShown: 170, colorKey: "coral" }
      ];

      const n = 92;
      this.houses = [];
      for (let i=0;i<n;i++){
        const cluster = Math.floor(this.rng() * 3);
        const base = cluster === 0 ? {x: 220, y: 320} : cluster === 1 ? {x: 520, y: 310} : {x: 380, y: 190};
        const jitter = () => (this.rng() - 0.5);
        this.houses.push({
          id: `H-${String(i+1).padStart(3,"0")}`,
          x: base.x + jitter()*220 + jitter()*60,
          y: base.y + jitter()*170 + jitter()*50,
          manualRep: -1,
          priority: this.rng() > 0.86
        });
      }
    }

    bind(){
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.canvas.parentElement);

      this.repSelect.addEventListener("change", () => {
        this.activeRep = parseInt(this.repSelect.value, 10) || 0;
        this.radius.value = String(this.reps[this.activeRep].rTarget);
        this.recompute();
      });

      this.radius.addEventListener("input", () => {
        const r = parseInt(this.radius.value, 10);
        this.reps[this.activeRep].rTarget = clamp(r, 80, 260);
        this.recompute();
      });

      this.autoAssign.addEventListener("change", () => this.recompute());

      this.resetBtn.addEventListener("click", () => {
        this.houses.forEach(h => { h.manualRep = -1; h.priority = (this.rng() > 0.86); });
        this.reps[0].x = 220; this.reps[0].y = 210; this.reps[0].rTarget = 160;
        this.reps[1].x = 540; this.reps[1].y = 180; this.reps[1].rTarget = 150;
        this.reps[2].x = 420; this.reps[2].y = 410; this.reps[2].rTarget = 170;
        this.radius.value = String(this.reps[this.activeRep].rTarget);
        this.recompute();
      });

      const onDown = (e) => {
        const p = this.toLocal(e);
        const hitRep = this.hitRep(p);
        if (hitRep !== -1){
          const r = this.reps[hitRep];
          this.drag = { type:"rep", idx: hitRep, dx: p.x - r.x, dy: p.y - r.y };
          this.canvas.setPointerCapture?.(e.pointerId);
          return;
        }
        const hitHouse = this.hitHouse(p);
        if (hitHouse !== -1){
          const h = this.houses[hitHouse];
          if (this.autoAssign.checked){
            h.manualRep = (h.manualRep === -1) ? this.activeRep : ((h.manualRep + 1) % this.reps.length);
          } else {
            h.manualRep = (h.manualRep === this.activeRep) ? -1 : this.activeRep;
          }
          if (e.shiftKey) h.priority = !h.priority;
          this.recompute();
        }
      };

      const onMove = (e) => {
        const p = this.toLocal(e);
        if (this.drag && this.drag.type === "rep"){
          const r = this.reps[this.drag.idx];
          r.x = clamp(p.x - this.drag.dx, 60, this.w - 60);
          r.y = clamp(p.y - this.drag.dy, 70, this.h - 60);
          this.recompute(false);
          return;
        }
        this.hoverHouse = this.hitHouse(p);
      };

      const onUp = (e) => {
        this.drag = null;
        try { this.canvas.releasePointerCapture?.(e.pointerId); } catch {}
      };

      this.canvas.addEventListener("pointerdown", onDown);
      this.canvas.addEventListener("pointermove", onMove);
      this.canvas.addEventListener("pointerup", onUp);
      this.canvas.addEventListener("pointercancel", onUp);

      document.addEventListener("visibilitychange", () => {
        this._running = !document.hidden;
        if (this._running && !prefersReduced) this.start();
      });
    }

    resize(){
      const rect = this.canvas.getBoundingClientRect();
      this.w = Math.max(320, Math.floor(rect.width));
      this.h = Math.max(420, Math.floor(rect.height));
      this.canvas.width = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.recompute();
    }

    toLocal(e){
      const r = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
    }

    hitRep(p){
      for (let i=0;i<this.reps.length;i++){
        const r = this.reps[i];
        if (Math.hypot(p.x - r.x, p.y - r.y) <= 14) return i;
      }
      return -1;
    }

    hitHouse(p){
      for (let i=this.houses.length-1;i>=0;i--){
        const h = this.houses[i];
        if (Math.hypot(p.x - h.x, p.y - h.y) <= 10) return i;
      }
      return -1;
    }

    assignHouse(h){
      if (h.manualRep !== -1) return h.manualRep;
      if (!this.autoAssign.checked) return -1;

      let best = -1, bestD = Infinity;
      for (let i=0;i<this.reps.length;i++){
        const r = this.reps[i];
        const d = Math.hypot(h.x - r.x, h.y - r.y);
        if (d <= r.rTarget && d < bestD){
          bestD = d; best = i;
        }
      }
      return best;
    }

    recompute(rebuildList=true){
      const rep = this.reps[this.activeRep];

      this.assigned = this.houses.map(h => this.assignHouse(h));
      this.activeStops = [];
      for (let i=0;i<this.houses.length;i++){
        if (this.assigned[i] === this.activeRep) this.activeStops.push(i);
      }

      const pri = [], non = [];
      for (const idx of this.activeStops){
        (this.houses[idx].priority ? pri : non).push(idx);
      }

      let orderStops = [];
      if (pri.length){
        const priPts = pri.map(i => this.houses[i]);
        const priOrder = nearestNeighbor(0, [{x:rep.x,y:rep.y}, ...priPts]).slice(1).map(k => pri[k-1]);
        orderStops = orderStops.concat(priOrder);
      }
      if (non.length){
        const start = orderStops.length ? this.houses[orderStops[orderStops.length-1]] : {x:rep.x, y:rep.y};
        const nonPts = non.map(i => this.houses[i]);
        const nnOrder = nearestNeighbor(0, [start, ...nonPts]).slice(1).map(k => non[k-1]);
        orderStops = orderStops.concat(nnOrder);
      }
      this.route = orderStops;

      const routePts = [ {x: rep.x, y: rep.y}, ...this.route.map(i => this.houses[i]) ];
      const routeOrder = Array.from({length: routePts.length}, (_,i)=>i);
      const pxLen = polylineLength(routePts, routeOrder);
      const minutesPerPx = 0.06;
      const driveMin = pxLen * minutesPerPx;
      const stops = this.route.length;

      const serviceMin = stops * 6;
      const totalMin = driveMin + serviceMin;
      const sph = totalMin > 0 ? (stops / (totalMin / 60)) : 0;

      const density = stops / Math.max(1, rep.rTarget*rep.rTarget) * 10000;
      const close = clamp(10 + sph * 2.2 + density * 6, 12, 38);

      this.metricDrive.textContent = `${Math.round(driveMin)} min`;
      this.metricStops.textContent = `${sph.toFixed(1)}`;
      this.metricClose.textContent = `${close.toFixed(0)}%`;

      if (rebuildList) this.renderList();
    }

    renderList(){
      const max = 12;
      const items = this.route.slice(0, max).map((idx, i) => {
        const h = this.houses[idx];
        const tag = h.priority ? "Priority" : "Lead";
        return `<div class="small" style="display:flex; justify-content:space-between; gap:.8rem; padding:.55rem .65rem; border-radius:14px; border:1px solid rgba(11,13,18,.10); background: rgba(255,255,255,.86);">
          <span><strong style="font-weight:950; color: rgba(11,13,18,.86);">#${i+1}</strong> ${h.id}</span>
          <span style="color: rgba(11,13,18,.62); font-weight:850;">${tag}</span>
        </div>`;
      }).join("");
      const empty = `<div class="small muted">No leads assigned to this rep yet. Increase radius, drag the manager pin, or click houses to assign.</div>`;
      this.list.innerHTML = items || empty;
    }

    step(dt){
      if (prefersReduced){
        for (const r of this.reps) r.rShown = r.rTarget;
        return;
      }
      const k = 10.5;
      for (const r of this.reps){
        r.rShown = lerp(r.rShown, r.rTarget, clamp(dt*k, 0, 1));
      }
    }

    drawTooltip(x, y, lines){
      const ctx = this.ctx;
      ctx.save();
      ctx.font = "800 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      const padX = 10, padY = 8;
      const widths = lines.map(t => ctx.measureText(t).width);
      const w = Math.max(...widths) + padX*2;
      const h = lines.length * 16 + padY*2;
      const bx = clamp(x, 10, this.w - w - 10);
      const by = clamp(y - h, 10, this.h - h - 10);

      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.strokeStyle = "rgba(11,13,18,0.16)";
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, w, h, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(11,13,18,0.82)";
      for (let i=0;i<lines.length;i++){
        ctx.fillText(lines[i], bx + padX, by + padY + 14 + i*16);
      }
      ctx.restore();
    }

    draw(){
      const ctx = this.ctx;
      ctx.clearRect(0,0,this.w,this.h);

      // grid
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#0B0D12";
      for (let x=40; x<this.w; x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.h); ctx.stroke(); }
      for (let y=40; y<this.h; y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.w,y); ctx.stroke(); }
      ctx.restore();

      const colors = {
        indigo: "rgba(61,45,255,0.18)",
        mint: "rgba(18,185,129,0.18)",
        coral: "rgba(255,77,90,0.18)"
      };
      const strokes = {
        indigo: "rgba(61,45,255,0.55)",
        mint: "rgba(18,185,129,0.55)",
        coral: "rgba(255,77,90,0.55)"
      };

      // territories
      for (let i=0;i<this.reps.length;i++){
        const r = this.reps[i];
        ctx.save();
        ctx.fillStyle = colors[r.colorKey];
        ctx.strokeStyle = strokes[r.colorKey];
        ctx.lineWidth = (i === this.activeRep) ? 2.6 : 1.8;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.rShown, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.rShown, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }

      // route
      const rep = this.reps[this.activeRep];
      if (this.route && this.route.length){
        ctx.save();
        ctx.strokeStyle = "rgba(11,13,18,0.55)";
        ctx.lineWidth = 3.0;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(rep.x, rep.y);
        for (const idx of this.route){
          const h = this.houses[idx];
          ctx.lineTo(h.x, h.y);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(61,45,255,0.55)";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(rep.x, rep.y);
        for (const idx of this.route){
          const h = this.houses[idx];
          ctx.lineTo(h.x, h.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // houses
      for (let i=0;i<this.houses.length;i++){
        const h = this.houses[i];
        const assigned = this.assigned[i];
        const isActive = assigned === this.activeRep;
        const isHover = i === this.hoverHouse;

        ctx.beginPath();
        ctx.fillStyle = isActive ? "rgba(11,13,18,0.82)" : "rgba(11,13,18,0.42)";
        ctx.arc(h.x, h.y, isActive ? 3.6 : 3.0, 0, Math.PI*2);
        ctx.fill();

        if (assigned !== -1){
          const key = this.reps[assigned].colorKey;
          ctx.beginPath();
          ctx.fillStyle = colors[key];
          ctx.arc(h.x, h.y, isActive ? 10.5 : 9.0, 0, Math.PI*2);
          ctx.fill();
        }

        if (h.priority){
          ctx.save();
          ctx.fillStyle = "rgba(255,77,90,0.95)";
          ctx.beginPath();
          ctx.arc(h.x+6, h.y-6, 2.2, 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
        }

        if (isHover){
          ctx.save();
          ctx.strokeStyle = "rgba(11,13,18,0.72)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(h.x, h.y, 12, 0, Math.PI*2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // rep pins
      for (let i=0;i<this.reps.length;i++){
        const r = this.reps[i];
        const key = r.colorKey;

        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.strokeStyle = strokes[key];
        ctx.lineWidth = (i === this.activeRep) ? 2.6 : 2.0;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 12, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = strokes[key];
        ctx.beginPath();
        ctx.arc(r.x, r.y, 4.2, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = "rgba(11,13,18,0.75)";
        ctx.font = "900 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
        ctx.fillText(r.name, r.x + 16, r.y + 4);
        ctx.restore();
      }

      if (this.hoverHouse !== -1){
        const h = this.houses[this.hoverHouse];
        const assigned = this.assigned[this.hoverHouse];
        const owner = (assigned === -1) ? "Unassigned" : this.reps[assigned].name;
        const tag = h.priority ? "Priority lead" : "Lead";
        const lines = [`${h.id} — ${tag}`, `Owner: ${owner}`, `Tip: click to assign, Shift+click toggles priority`];
        this.drawTooltip(h.x+14, h.y-14, lines);
      }
    }

    start(){
      if (prefersReduced){
        this.recompute();
        this.draw();
        return;
      }
      this._last = performance.now();
      const tick = (now) => {
        if (!this._running) return;
        const dt = clamp((now - this._last) / 1000, 0, 0.05);
        this._last = now;
        this.step(dt);
        this.draw();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  function init(){
    const root = document.getElementById("demoPlayground");
    if (!root) return;
    new Playground(root);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
