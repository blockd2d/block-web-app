'use client';

import * as React from 'react';
import Link from 'next/link';
import { Input } from '../../../ui/input';
import { Button } from '../../../ui/button';
import { api } from '../../../lib/api';

type ClusterSet = {
  id: string;
  name: string;
  created_at: string;
  status: string;
  radius_m: number;
  min_houses: number;
  filters_json: any;
};

type County = { id: string; name: string };

export default function TerritoriesPage() {
  const [clusterSets, setClusterSets] = React.useState<ClusterSet[]>([]);
  const [counties, setCounties] = React.useState<County[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('Hendricks - Door-to-door');
  const [countyId, setCountyId] = React.useState('');
  const [radiusM, setRadiusM] = React.useState(120);
  const [minHouses, setMinHouses] = React.useState(12);
  const [valueMin, setValueMin] = React.useState<number | ''>(180000);
  const [valueMax, setValueMax] = React.useState<number | ''>(650000);
  const [excludeDNK, setExcludeDNK] = React.useState(true);
  const [onlyUnworked, setOnlyUnworked] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    const [cs, c] = await Promise.all([api('/v1/cluster-sets'), api('/v1/counties')]);
    setClusterSets(cs.items || []);
    setCounties(c.items || []);
    if (!countyId && (c.items?.length || 0) > 0) setCountyId(c.items[0].id);
  }

  React.useEffect(() => {
    load().catch(() => {
      /* ignore */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createClusterSet() {
    setCreating(true);
    setError(null);
    try {
      const payload = {
        name,
        county_id: countyId,
        filters: {
          radius_m: Number(radiusM),
          min_houses: Number(minHouses),
          value_min: valueMin === '' ? null : Number(valueMin),
          value_max: valueMax === '' ? null : Number(valueMax),
          exclude_dnk: excludeDNK,
          only_unworked: onlyUnworked
        }
      };
      const r = await api('/v1/cluster-sets', { method: 'POST', body: JSON.stringify(payload) });
      // Worker will generate clusters async
      setClusterSets((prev) => [r.cluster_set || r, ...prev]);
    } catch (e: any) {
      setError(e?.message || 'Failed to create cluster set');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="text-sm font-semibold">Create a cluster set</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-mutedForeground">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-mutedForeground">County</label>
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
                  value={countyId}
                  onChange={(e) => setCountyId(e.target.value)}
                >
                  {counties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-mutedForeground">Radius (m)</label>
                <Input type="number" value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-mutedForeground">Min houses</label>
                <Input type="number" value={minHouses} onChange={(e) => setMinHouses(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-mutedForeground">Value min</label>
                <Input
                  type="number"
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-mutedForeground">Value max</label>
                <Input
                  type="number"
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={excludeDNK} onChange={(e) => setExcludeDNK(e.target.checked)} />
                    Exclude DNK
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={onlyUnworked}
                      onChange={(e) => setOnlyUnworked(e.target.checked)}
                    />
                    Only unworked
                  </label>
                </div>
              </div>
            </div>

            {error ? <div className="mt-3 text-sm text-destructive">{error}</div> : null}

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-mutedForeground">
                Cluster generation runs async in the worker. Refresh in a few seconds.
              </div>
              <Button onClick={createClusterSet} disabled={creating || !countyId}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
              <div className="text-sm font-semibold">Cluster sets</div>
              <div className="flex items-center gap-2">
                <Link href="/app/territories/zones">
                  <Button variant="ghost" type="button">
                    Draw zone
                  </Button>
                </Link>
                <Button variant="ghost" onClick={() => load()}>
                  Refresh
                </Button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {clusterSets.length ? (
                clusterSets.map((cs) => (
                  <div key={cs.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{cs.name}</span>
                        <span
                          className={
                            cs.status === 'complete'
                              ? 'rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-700 dark:text-green-400'
                              : cs.status === 'running' || cs.status === 'queued'
                                ? 'rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400'
                                : 'rounded-full bg-muted px-2 py-0.5 text-xs text-mutedForeground'
                          }
                        >
                          {cs.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-mutedForeground">
                        radius {cs.radius_m}m • min {cs.min_houses} houses
                      </div>
                    </div>
                    <Link href={`/app/territories/${cs.id}`} className="shrink-0 text-sm text-primary hover:underline">
                      Open & assign
                    </Link>
                  </div>
                ))
              ) : (
                <div className="p-4 text-sm text-mutedForeground">No cluster sets yet. Create your first one.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
