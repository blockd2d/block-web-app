'use client';

import * as React from 'react';
import mapboxgl from 'mapbox-gl';
import { point } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { repColor } from '../../lib/color';
import { api } from '../../lib/api';

type ClusterRow = {
  id: string;
  assigned_rep_id: string | null;
  center_lat: number;
  center_lng: number;
  hull_geojson: any | null;
  stats_json: any | null;
};

type RepRow = {
  id: string;
  name: string;
  home_lat: number | null;
  home_lng: number | null;
};

type RepLocationRow = {
  rep_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  clocked_in: boolean;
};

type PropertyRow = {
  id: string;
  lat: number;
  lng: number;
  value_estimate: number | null;
};

const ZOOM_PROPERTIES_THRESHOLD = 14;

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function OpsMap({
  clusterSetId,
  selectedClusterId,
  onSelectCluster,
  enablePropertyPoints = true,
  className
}: {
  clusterSetId: string | null;
  selectedClusterId: string | null;
  onSelectCluster: (id: string) => void;
  enablePropertyPoints?: boolean;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<mapboxgl.Map | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  const [clusters, setClusters] = React.useState<ClusterRow[]>([]);
  const [reps, setReps] = React.useState<RepRow[]>([]);
  const [repLocs, setRepLocs] = React.useState<RepLocationRow[]>([]);

  // Load clusters + reps
  React.useEffect(() => {
    (async () => {
      try {
        const [rReps, rClusters] = await Promise.all([
          api('/v1/reps'),
          clusterSetId ? api(`/v1/clusters?cluster_set_id=${encodeURIComponent(clusterSetId)}`) : Promise.resolve({ items: [] })
        ]);
        setReps((rReps.items || rReps.reps || []) as any);
        setClusters((rClusters.items || rClusters.clusters || []) as any);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [clusterSetId]);

  // Poll rep locations while map is mounted
  React.useEffect(() => {
    let stopped = false;
    let t: any;
    async function tick() {
      try {
        const r = await api('/v1/reps/locations');
        if (!stopped) setRepLocs((r.items || r.locations || []) as any);
      } catch (e) {
        // ignore
      } finally {
        if (!stopped) t = setTimeout(tick, 5000);
      }
    }
    tick();
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, []);

  // Init map
  React.useEffect(() => {
    if (!containerRef.current) return;

    if (!token) {
      console.warn('NEXT_PUBLIC_MAPBOX_TOKEN is not set; Mapbox map will not render.');
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-86.158, 39.762],
      zoom: 10,
      attributionControl: false
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      map.addSource('clusters-polygons', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
      map.addSource('clusters-centers', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
      map.addSource('rep-locations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });
      map.addSource('properties', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as any });

      map.addLayer({
        id: 'clusters-fill',
        type: 'fill',
        source: 'clusters-polygons',
        paint: {
          'fill-color': ['get', 'repColor'],
          'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.26, 0.12]
        }
      });

      map.addLayer({
        id: 'clusters-outline',
        type: 'line',
        source: 'clusters-polygons',
        paint: {
          'line-color': ['get', 'repColor'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 2.6, 1.3],
          'line-opacity': 0.85
        }
      });

      map.addLayer({
        id: 'clusters-centers',
        type: 'circle',
        source: 'clusters-centers',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 7, 5],
          'circle-color': ['get', 'repColor'],
          'circle-opacity': 0.95,
          'circle-stroke-width': 1.6,
          'circle-stroke-color': 'hsl(var(--background))'
        }
      });

      // Property points: only visible at high zoom
      map.addLayer({
        id: 'properties-points',
        type: 'circle',
        source: 'properties',
        minzoom: ZOOM_PROPERTIES_THRESHOLD,
        paint: {
          'circle-radius': 2.5,
          'circle-color': 'hsl(var(--foreground) / 0.6)',
          'circle-opacity': 0.55
        }
      });

      if (!enablePropertyPoints) {
        map.setLayoutProperty('properties-points', 'visibility', 'none');
      }

      // Rep locations
      map.addLayer({
        id: 'rep-locations',
        type: 'circle',
        source: 'rep-locations',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'clockedIn'], 1], 7, 5],
          'circle-color': ['get', 'repColor'],
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'hsl(var(--background))'
        }
      });

      map.addLayer({
        id: 'rep-labels',
        type: 'symbol',
        source: 'rep-locations',
        layout: {
          'text-field': ['get', 'repName'],
          'text-size': 12,
          'text-offset': [0, 1.2],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': 'hsl(var(--foreground))',
          'text-halo-color': 'hsl(var(--background))',
          'text-halo-width': 1.5
        }
      });

      map.on('click', 'clusters-centers', (e) => {
        const feat = e.features?.[0] as any;
        const id = feat?.properties?.id;
        if (id) onSelectCluster(String(id));
      });

      map.on('mouseenter', 'clusters-centers', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters-centers', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, onSelectCluster]);

  // Update cluster overlays
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enablePropertyPoints) {
      (map.getSource('properties') as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: []
      } as any);
      return;
    }
    if (!map.isStyleLoaded()) return;

    const repNameById = new Map(reps.map((r) => [r.id, r.name]));

    const polyFeatures: any[] = [];
    const centerFeatures: any[] = [];

    for (const c of clusters) {
      const repId = c.assigned_rep_id || 'unassigned';
      const color = c.assigned_rep_id ? repColor(repId) : 'hsl(240 4% 56%)';
      const selected = selectedClusterId === c.id ? 1 : 0;

      if (c.hull_geojson) {
        polyFeatures.push({
          type: 'Feature',
          properties: {
            id: c.id,
            repId: c.assigned_rep_id,
            repColor: color,
            selected,
            size: c.stats_json?.size ?? null,
            totalPotential: c.stats_json?.total_potential ?? null
          },
          geometry: c.hull_geojson
        });
      }

      centerFeatures.push({
        type: 'Feature',
        properties: {
          id: c.id,
          repId: c.assigned_rep_id,
          repColor: color,
          selected,
          size: c.stats_json?.size ?? null,
          totalPotential: c.stats_json?.total_potential ?? null,
          repName: c.assigned_rep_id ? repNameById.get(c.assigned_rep_id) : 'Unassigned'
        },
        geometry: { type: 'Point', coordinates: [c.center_lng, c.center_lat] }
      });
    }

    (map.getSource('clusters-polygons') as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: polyFeatures
    } as any);

    (map.getSource('clusters-centers') as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: centerFeatures
    } as any);

    // Fit bounds once when cluster set changes
    if (clusters.length > 0) {
      const b = new mapboxgl.LngLatBounds();
      for (const c of clusters) b.extend([c.center_lng, c.center_lat]);
      if (!b.isEmpty()) map.fitBounds(b, { padding: 70, duration: 450, maxZoom: 14 });
    }
  }, [clusters, reps, selectedClusterId]);

  // Update rep locations + compute "rep in cluster" indicator
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;

    const repById = new Map(reps.map((r) => [r.id, r]));

    const clusterPolys: { id: string; geom: any }[] = clusters
      .filter((c) => !!c.hull_geojson)
      .map((c) => ({ id: c.id, geom: c.hull_geojson }));

    const feats: any[] = [];
    for (const loc of repLocs) {
      const rep = repById.get(loc.rep_id);
      const repName = rep?.name || 'Rep';
      const color = repColor(loc.rep_id);

      let insideClusterId: string | null = null;
      if (clusterPolys.length > 0) {
        const pt = point([loc.lng, loc.lat]);
        for (const c of clusterPolys) {
          try {
            if (booleanPointInPolygon(pt, c.geom)) {
              insideClusterId = c.id;
              break;
            }
          } catch {
            // ignore malformed hull
          }
        }
      }

      feats.push({
        type: 'Feature',
        properties: {
          repId: loc.rep_id,
          repName,
          repColor: color,
          clockedIn: loc.clocked_in ? 1 : 0,
          inClusterId: insideClusterId
        },
        geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] }
      });
    }

    (map.getSource('rep-locations') as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: feats
    } as any);
  }, [repLocs, reps, clusters]);

  // BBox property fetching
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let abort: AbortController | null = null;

    const fetchProperties = debounce(async () => {
      const map = mapRef.current;
      if (!map) return;
      if (!map.isStyleLoaded()) return;

      const z = map.getZoom();
      if (z < ZOOM_PROPERTIES_THRESHOLD) {
        (map.getSource('properties') as mapboxgl.GeoJSONSource | undefined)?.setData({
          type: 'FeatureCollection',
          features: []
        } as any);
        return;
      }

      const b = map.getBounds();
      const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;

      try {
        abort?.abort();
        abort = new AbortController();

        const all: PropertyRow[] = [];
        let cursor: string | null = null;
        let safety = 0;

        while (safety++ < 20) {
          const url = `/v1/properties?bbox=${encodeURIComponent(bbox)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
          const r = await api(url, { signal: abort.signal } as any);
          const items: PropertyRow[] = r.items || [];
          all.push(...items);
          cursor = r.nextCursor || null;
          if (!cursor || items.length === 0) break;
          if (all.length > 8000) break;
        }

        const feats: any[] = all.map((p) => ({
          type: 'Feature',
          properties: { id: p.id, value: p.value_estimate },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
        }));

        (map.getSource('properties') as mapboxgl.GeoJSONSource | undefined)?.setData({
          type: 'FeatureCollection',
          features: feats
        } as any);
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.warn(e);
      }
    }, 300);

    const handler = () => fetchProperties();

    map.on('moveend', handler);
    map.on('zoomend', handler);

    // initial
    fetchProperties();

    return () => {
      abort?.abort();
      map.off('moveend', handler);
      map.off('zoomend', handler);
    };
  }, [enablePropertyPoints]);

  return (
    <div
      ref={containerRef}
      className={
        className ??
        'h-[560px] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft'
      }
    />
  );
}
