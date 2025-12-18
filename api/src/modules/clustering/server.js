import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { nanoid } from 'nanoid';

import { parseCsvBuffer, coerceNumber } from './csv.js';
import { clusterPoints } from './cluster_engine.js';
import { saveRun, getRun, listRuns } from './store.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

// --- Suggest k values based on constraints
app.post('/api/clusters/suggest', (req, res) => {
  const nPoints = Number(req.body?.nPoints);
  const maxPerCluster = req.body?.maxPerCluster != null ? Number(req.body.maxPerCluster) : null;
  const reps = req.body?.reps != null ? Number(req.body.reps) : null;

  if (!Number.isFinite(nPoints) || nPoints <= 0) {
    return res.status(400).json({ error: 'nPoints must be > 0' });
  }

  const suggestions = [];

  if (Number.isFinite(maxPerCluster) && maxPerCluster > 0) {
    const k = Math.ceil(nPoints / maxPerCluster);
    suggestions.push({ k, reason: 'ceil(n/maxPerCluster)', avgSize: nPoints / k });
    suggestions.push({ k: Math.max(1, k - 1), reason: 'slightly larger clusters', avgSize: nPoints / Math.max(1, k - 1) });
    suggestions.push({ k: k + 1, reason: 'slightly smaller clusters', avgSize: nPoints / (k + 1) });
  }

  if (Number.isFinite(reps) && reps > 0) {
    suggestions.push({ k: Math.round(reps), reason: 'one territory per rep', avgSize: nPoints / Math.round(reps) });
    suggestions.push({ k: Math.round(reps * 2), reason: 'two territories per rep', avgSize: nPoints / Math.round(reps * 2) });
  }

  // de-dupe + sane sort
  const uniq = new Map();
  for (const s of suggestions) {
    const kk = Math.max(1, Math.min(5000, Number(s.k)));
    if (!Number.isFinite(kk)) continue;
    if (!uniq.has(kk)) uniq.set(kk, { ...s, k: kk });
  }

  const out = Array.from(uniq.values()).sort((a, b) => a.k - b.k).slice(0, 12);
  res.json({ suggestions: out });
});

// --- Create clusters from uploaded CSV
app.post('/api/clusters/from-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'Missing file' });

    const latField = (req.body.latField || 'latitude').toString();
    const lonField = (req.body.lonField || 'longitude').toString();
    const idField = (req.body.idField || '').toString().trim();

    const k = req.body.k != null && req.body.k !== '' ? Number(req.body.k) : null;
    const maxPerCluster = req.body.maxPerCluster != null && req.body.maxPerCluster !== '' ? Number(req.body.maxPerCluster) : null;
    const iterations = req.body.iterations != null ? Number(req.body.iterations) : 40;
    const seed = req.body.seed != null ? Number(req.body.seed) : 42;

    const rows = await parseCsvBuffer(req.file.buffer);

    const points = rows.map((r, idx) => {
      const lat = coerceNumber(r[latField]);
      const lon = coerceNumber(r[lonField]);
      const id = idField && r[idField] != null && String(r[idField]).trim() !== '' ? String(r[idField]).trim() : String(idx);
      return { id, lat, lon, raw: r };
    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

    if (points.length === 0) return res.status(400).json({ error: 'No valid lat/lon points in CSV' });

    const run = clusterPoints(points, {
      k: Number.isFinite(k) ? Math.round(k) : undefined,
      maxPerCluster: Number.isFinite(maxPerCluster) ? Math.round(maxPerCluster) : undefined,
      iterations: Number.isFinite(iterations) ? Math.round(iterations) : 40,
      seed: Number.isFinite(seed) ? Math.round(seed) : 42,
    });

    const runId = nanoid(10);
    saveRun(runId, {
      runId,
      ...run,
      nPoints: points.length,
      // Keep raw rows out of memory by default; store only ids/coords/clusterId.
    });

    res.json({ runId, ...run, nPoints: points.length });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// --- Create multiple cluster options from the same uploaded CSV
// Useful for "show me all reasonable clusterings" in your UI.
// Provide one of:
//   - ks: "10,20,30" (comma-separated)
//   - maxPerClusters: "150,200,250" (comma-separated)
// Returns lightweight summaries; points can be fetched per-run via /api/clusters/:runId/points
app.post('/api/clusters/multi-from-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'Missing file' });

    const latField = (req.body.latField || 'latitude').toString();
    const lonField = (req.body.lonField || 'longitude').toString();
    const idField = (req.body.idField || '').toString().trim();

    const iterations = req.body.iterations != null ? Number(req.body.iterations) : 40;
    const seed = req.body.seed != null ? Number(req.body.seed) : 42;

    const ks = (req.body.ks || '').toString().split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
    const maxPerClusters = (req.body.maxPerClusters || '').toString().split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);

    if (ks.length === 0 && maxPerClusters.length === 0) {
      return res.status(400).json({ error: 'Provide ks or maxPerClusters' });
    }

    const rows = await parseCsvBuffer(req.file.buffer);
    const points = rows.map((r, idx) => {
      const lat = coerceNumber(r[latField]);
      const lon = coerceNumber(r[lonField]);
      const id = idField && r[idField] != null && String(r[idField]).trim() !== '' ? String(r[idField]).trim() : String(idx);
      return { id, lat, lon };
    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

    if (points.length === 0) return res.status(400).json({ error: 'No valid lat/lon points in CSV' });

    const desired = [];
    for (const k of ks) desired.push({ k: Math.round(k) });
    for (const m of maxPerClusters) desired.push({ maxPerCluster: Math.round(m) });

    // De-dupe "effective k" outcomes by computing k after clustering (since maxPerCluster derives k)
    const outputs = [];
    const seenK = new Set();
    for (const d of desired) {
      const run = clusterPoints(points, {
        k: d.k,
        maxPerCluster: d.maxPerCluster,
        iterations: Number.isFinite(iterations) ? Math.round(iterations) : 40,
        seed: Number.isFinite(seed) ? Math.round(seed) : 42,
      });
      if (seenK.has(run.k)) continue;
      seenK.add(run.k);

      const runId = nanoid(10);
      saveRun(runId, { runId, ...run, nPoints: points.length });
      outputs.push({
        runId,
        k: run.k,
        nPoints: points.length,
        origin: run.origin,
        inertia: run.inertia,
        clusters: run.clusters,
      });
    }

    outputs.sort((a, b) => a.k - b.k);
    res.json({ nPoints: points.length, options: outputs });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// --- List runs (debug)
app.get('/api/clusters', (req, res) => {
  res.json({ runs: listRuns() });
});

// --- Get run summary
app.get('/api/clusters/:runId', (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) return res.status(404).json({ error: 'runId not found' });
  res.json({
    runId: run.runId,
    createdAt: run.createdAt,
    k: run.k,
    nPoints: run.nPoints,
    origin: run.origin,
    inertia: run.inertia,
    clusters: run.clusters,
  });
});

// --- Get points for a given cluster
app.get('/api/clusters/:runId/points', (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) return res.status(404).json({ error: 'runId not found' });

  const clusterId = Number(req.query.clusterId);
  const limit = req.query.limit != null ? Number(req.query.limit) : 5000;

  if (!Number.isFinite(clusterId)) return res.status(400).json({ error: 'clusterId required' });

  const pts = run.assignments.filter(p => p.clusterId === clusterId).slice(0, Math.max(1, limit));
  res.json({ runId: run.runId, clusterId, points: pts, returned: pts.length });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(PORT, () => {
  console.log(`Property Cluster API listening on http://localhost:${PORT}`);
});
