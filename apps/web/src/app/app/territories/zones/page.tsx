'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { PolygonDrawer } from '../../../../ui/map/polygon-drawer';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Trash2 } from 'lucide-react';

export default function DrawZonesPage() {
  const router = useRouter();
  const [polygons, setPolygons] = React.useState<GeoJSON.Polygon[]>([]);
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAddZone = React.useCallback((geojson: GeoJSON.Polygon) => {
    setPolygons((prev) => [...prev, geojson]);
    setError(null);
  }, []);

  const removeZone = React.useCallback((index: number) => {
    setPolygons((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSaveClusterSet = React.useCallback(async () => {
    if (polygons.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      const res = await api.post('/v1/zones', {
        name: name.trim() || 'Drawn zones',
        zones: polygons
      }) as { cluster_set_id: string };
      router.push(`/app/territories/${res.cluster_set_id}`);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save cluster set');
    } finally {
      setSaving(false);
    }
  }, [name, polygons, router]);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-mutedForeground">
            <Link href="/app/territories" className="hover:underline">
              Territories
            </Link>
            <span>›</span>
            <span className="text-foreground/80">Draw zone</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Draw zone</h1>
          <p className="mt-1 text-sm text-mutedForeground">
            Draw one or more zones, add each to the list, then save as one cluster set. Houses inside each zone will be included.
          </p>
        </div>
        <Link href="/app/territories">
          <Button variant="secondary">Back to territories</Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-4">
          <label className="text-xs text-mutedForeground">Cluster set name</label>
          <Input
            className="mt-1 max-w-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My territories"
          />
        </div>

        {polygons.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-mutedForeground mb-2">Zones in this set ({polygons.length})</div>
            <ul className="flex flex-wrap gap-2">
              {polygons.map((_, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-1 text-sm"
                >
                  <span>Zone {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeZone(i)}
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label={`Remove zone ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <PolygonDrawer onAddZone={handleAddZone} />

        {polygons.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={handleSaveClusterSet}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save cluster set'}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        )}

        {polygons.length === 0 && (
          <p className="mt-3 text-sm text-mutedForeground">
            Draw a polygon (min 3 points), close it, then click &quot;Add zone&quot; to add it. Add more zones if needed, then name the set and click &quot;Save cluster set&quot;.
          </p>
        )}
      </div>
    </div>
  );
}
