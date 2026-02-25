'use client';

import * as React from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { OpsMap } from '../../../../ui/map/ops-map';
import { Button } from '../../../../ui/button';

type ClusterSet = { id: string; name: string; status: string };

export default function LeadMapPage() {
  const [clusterSets, setClusterSets] = React.useState<ClusterSet[]>([]);
  const [clusterSetId, setClusterSetId] = React.useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/v1/cluster-sets');
        const items = (r.items || []).filter((x: any) => x.status === 'complete');
        setClusterSets(items);
        if (items.length && !clusterSetId) setClusterSetId(items[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lead map</h1>
          <p className="mt-1 text-sm text-mutedForeground">Territory map: clusters and rep assignments. Use Leads list to add or edit.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm"
            value={clusterSetId ?? ''}
            onChange={(e) => {
              setClusterSetId(e.target.value || null);
              setSelectedClusterId(null);
            }}
          >
            <option value="">No cluster set</option>
            {clusterSets.map((cs) => (
              <option key={cs.id} value={cs.id}>
                {cs.name}
              </option>
            ))}
          </select>
          <Link href="/app/leads">
            <Button variant="secondary">Back to leads</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
        <OpsMap
          clusterSetId={clusterSetId}
          selectedClusterId={selectedClusterId}
          onSelectCluster={setSelectedClusterId}
          enablePropertyPoints={true}
          className="h-[560px]"
        />
      </div>
      {clusterSetId && selectedClusterId ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-mutedForeground">
          <span>Selected cluster: {selectedClusterId.slice(0, 8)}…</span>
          <Link href={`/app/territories/${clusterSetId}?cluster=${encodeURIComponent(selectedClusterId)}`} className="text-primary hover:underline">
            Open in territories
          </Link>
        </div>
      ) : null}
    </div>
  );
}
