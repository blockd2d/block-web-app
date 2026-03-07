'use client';

import * as React from 'react';
import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

type LngLat = [number, number];

export function PolygonDrawer({
  onSave,
  onAddZone,
  className
}: {
  onSave?: (geojson: GeoJSON.Polygon) => void | Promise<void>;
  /** When set, "Add zone" adds the current polygon and clears for the next; use with page-level "Save cluster set". */
  onAddZone?: (geojson: GeoJSON.Polygon) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [points, setPoints] = React.useState<LngLat[]>([]);
  const [closed, setClosed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  const polygonFeature = React.useMemo((): GeoJSON.Feature<GeoJSON.Polygon> | null => {
    if (points.length < 3) return null;
    const coords = closed ? [...points, points[0]] : points;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coords]
      }
    };
  }, [points, closed]);

  useEffect(() => {
    if (!containerRef.current || !token) return;
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
      map.addSource('draw-polygon', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'draw-polygon-fill',
        type: 'fill',
        source: 'draw-polygon',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.2 }
      });
      map.addLayer({
        id: 'draw-polygon-line',
        type: 'line',
        source: 'draw-polygon',
        paint: { 'line-color': '#3b82f6', 'line-width': 2 }
      });
      setMapReady(true);
    });
    mapRef.current = map;
    return () => {
      mapRef.current = null;
      // Do not call map.remove(): Mapbox v3 can throw AbortError (sync or async) that surfaces
      // as unhandled. React will remove the container on unmount; the map is then GC'd.
    };
  }, [token]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const src = map?.getSource('draw-polygon') as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    if (polygonFeature) {
      src.setData({ type: 'FeatureCollection', features: [polygonFeature] });
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [polygonFeature, mapReady]);

  const handleMapClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      if (closed) return;
      const { lng, lat } = e.lngLat;
      setPoints((prev) => [...prev, [lng, lat]]);
    },
    [closed]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [handleMapClick]);

  const handleClose = useCallback(() => {
    if (points.length >= 3) setClosed(true);
  }, [points.length]);

  const handleClear = useCallback(() => {
    setPoints([]);
    setClosed(false);
    setMessage(null);
  }, []);

  const handleAddZone = useCallback(() => {
    if (!polygonFeature?.geometry || polygonFeature.geometry.type !== 'Polygon' || !onAddZone) return;
    onAddZone(polygonFeature.geometry);
    setPoints([]);
    setClosed(false);
    setMessage(null);
  }, [polygonFeature, onAddZone]);

  const handleSave = useCallback(async () => {
    if (!polygonFeature?.geometry || polygonFeature.geometry.type !== 'Polygon') return;
    if (!onSave) return;
    setMessage(null);
    setSaving(true);
    try {
      await onSave(polygonFeature.geometry);
      setMessage('Saved.');
    } catch (e: any) {
      setMessage(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [polygonFeature, onSave]);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-mutedForeground">
          {closed ? 'Polygon closed.' : points.length < 3 ? 'Click map to add points (min 3).' : 'Click "Close" to finish, or add more points.'}
        </span>
        {!closed && points.length >= 3 && (
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Close polygon
          </button>
        )}
        <button
          type="button"
          onClick={handleClear}
          className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Clear
        </button>
        {closed && polygonFeature && onAddZone && (
          <button
            type="button"
            onClick={handleAddZone}
            className="rounded-xl border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:opacity-90"
          >
            Add zone
          </button>
        )}
        {closed && polygonFeature && onSave && !onAddZone && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primaryForeground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save zone'}
          </button>
        )}
        {message && <span className="text-sm text-mutedForeground">{message}</span>}
      </div>
      <div ref={containerRef} className="h-[400px] w-full overflow-hidden rounded-2xl" />
    </div>
  );
}
