'use client';

import { useEffect, useMemo, useRef } from 'react';
import { drawProceduralBasemap, type Viewport } from '../../lib/basemap';

type Overlay = {
  id: string;
  color: string;
  hull?: any; // GeoJSON
  center?: { lat: number; lng: number };
};

function toScreen(p: { lat: number; lng: number }, vp: Viewport) {
  // Simple equirectangular projection around center
  const dx = (p.lng - vp.centerLng) * vp.pxPerDegreeLng;
  const dy = -(p.lat - vp.centerLat) * vp.pxPerDegreeLat;
  return { x: vp.width / 2 + dx, y: vp.height / 2 + dy };
}

export function NormalMap({ overlays }: { overlays: Overlay[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const viewport = useMemo<Viewport>(() => {
    // default Indianapolis-ish
    const centerLat = 39.8;
    const centerLng = -86.2;
    const width = 1000;
    const height = 520;
    const pxPerDegreeLat = 16000; // zoom-ish
    const pxPerDegreeLng = 12000;
    return { width, height, centerLat, centerLng, pxPerDegreeLat, pxPerDegreeLng };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const vp = { ...viewport, width: rect.width, height: rect.height };
      drawProceduralBasemap(ctx, vp);

      // Overlays
      for (const o of overlays || []) {
        if (!o.hull?.coordinates?.[0]) continue;
        const ring = o.hull.coordinates[0] as number[][];
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const [lng, lat] = ring[i];
          const { x, y } = toScreen({ lat, lng }, vp);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = o.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (o.center) {
          const { x, y } = toScreen(o.center, vp);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = o.color;
          ctx.fill();
        }
      }
    }

    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [overlays, viewport]);

  return <canvas ref={canvasRef} className="h-[520px] w-full rounded-xl border border-border" />;
}
