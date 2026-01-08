'use client';

import { useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

type Overlay = {
  id: string;
  color: string;
  hull?: any; // GeoJSON Polygon/MultiPolygon
  center: { lat: number; lng: number };
  assigned_rep_id?: string | null;
};

export function MapboxMap({
  overlays,
  selectedId,
  onSelect
}: {
  overlays: Overlay[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  const polygons = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: overlays
        .filter((o) => !!o.hull)
        .map((o) => ({
          type: 'Feature',
          properties: { id: o.id, color: o.color, selected: selectedId === o.id ? 1 : 0 },
          geometry: o.hull
        }))
    } as any;
  }, [overlays, selectedId]);

  const centers = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: overlays.map((o) => ({
        type: 'Feature',
        properties: { id: o.id, color: o.color, selected: selectedId === o.id ? 1 : 0 },
        geometry: { type: 'Point', coordinates: [o.center.lng, o.center.lat] }
      }))
    } as any;
  }, [overlays, selectedId]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!token) {
      // eslint-disable-next-line no-console
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
      map.addSource('clusters-polygons', { type: 'geojson', data: polygons });
      map.addSource('clusters-centers', { type: 'geojson', data: centers });

      map.addLayer({
        id: 'clusters-fill',
        type: 'fill',
        source: 'clusters-polygons',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.28, 0.14]
        }
      });

      map.addLayer({
        id: 'clusters-outline',
        type: 'line',
        source: 'clusters-polygons',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 2.5, 1.2],
          'line-opacity': 0.85
        }
      });

      map.addLayer({
        id: 'clusters-centers',
        type: 'circle',
        source: 'clusters-centers',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 7, 5],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.95,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0a0a0a'
        }
      });

      map.on('click', 'clusters-centers', (e) => {
        const feat = e.features?.[0] as any;
        const id = feat?.properties?.id;
        if (id && onSelect) onSelect(String(id));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update sources when overlays change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) return;

    const poly = map.getSource('clusters-polygons') as mapboxgl.GeoJSONSource | undefined;
    const cen = map.getSource('clusters-centers') as mapboxgl.GeoJSONSource | undefined;
    if (poly) poly.setData(polygons);
    if (cen) cen.setData(centers);

    if (overlays.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const o of overlays) bounds.extend([o.center.lng, o.center.lat]);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, duration: 400, maxZoom: 14 });
    }
  }, [polygons, centers, overlays]);

  return <div ref={containerRef} className="h-[560px] w-full overflow-hidden rounded-2xl" />;
}
