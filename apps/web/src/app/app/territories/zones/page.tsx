'use client';

import * as React from 'react';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { PolygonDrawer } from '../../../../ui/map/polygon-drawer';
import { Button } from '../../../../ui/button';

export default function DrawZonesPage() {
  const handleSave = React.useCallback(async (geojson: GeoJSON.Polygon) => {
    await api.post('/v1/zones', { name: 'Drawn zone', geojson });
  }, []);

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
            Click the map to add points. Close the polygon, then Save.
          </p>
        </div>
        <Link href="/app/territories">
          <Button variant="secondary">Back to territories</Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <PolygonDrawer onSave={handleSave} />
      </div>
    </div>
  );
}
