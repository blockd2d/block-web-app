import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Text, View } from "react-native";

import type { LatLng, Stop } from "./types";
import { theme } from "./theme";
import { bounds, compactLatLng, stopToLatLng } from "./lib/geo";
import { config } from "./lib/runtimeConfig";

type Props = {
  style?: any;
  stops: Stop[];
  boundary?: LatLng[] | null;
  route?: LatLng[] | null;
  currentStopId?: string | null;
  nextStopId?: string | null;
  showUserLocation?: boolean;
  focus?: LatLng | null;
  onPressStop?: (stopId: string) => void;
  provider?: "google" | "default";
};

export type SalesMapHandle = {
  fitAll(animated?: boolean): void;
  focusOn(p: LatLng, delta?: number): void;
};

type MapboxModule = any;

let cachedMapboxModule: MapboxModule | null | undefined = undefined;

function getMapboxModule(): MapboxModule | null {
  if (cachedMapboxModule !== undefined) return cachedMapboxModule;
  try {
    const mod = require("@rnmapbox/maps");
    cachedMapboxModule = mod?.default ?? mod ?? null;
  } catch {
    cachedMapboxModule = null;
  }
  return cachedMapboxModule;
}

function lngLat(p: LatLng): [number, number] {
  return [p.longitude, p.latitude];
}

function pointFeature(id: string, p: LatLng, properties?: Record<string, unknown>) {
  return {
    type: "Feature" as const,
    id,
    properties: { ...(properties ?? {}) },
    geometry: {
      type: "Point" as const,
      coordinates: [p.longitude, p.latitude] as [number, number],
    },
  };
}

function featureCollection(features: any[]) {
  return {
    type: "FeatureCollection" as const,
    features,
  };
}

function lineFeature(points: LatLng[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
  };
}

function polygonFeature(points: LatLng[]) {
  const ring = points.map((p) => [p.longitude, p.latitude]);
  if (ring.length >= 3) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [ring],
    },
  };
}

function markerColor(stopId: string, currentStopId?: string | null, nextStopId?: string | null) {
  if (stopId === currentStopId) return "#0F2747";
  if (stopId === nextStopId) return "#3466AF";
  return "#FFFFFF";
}

function markerBorderColor(stopId: string, currentStopId?: string | null, nextStopId?: string | null) {
  if (stopId === currentStopId) return "#FFFFFF";
  if (stopId === nextStopId) return "#FFFFFF";
  return "#0F2747";
}

function MapUnavailableCard({ title, body, detail }: { title: string; body: string; detail?: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: theme.radius.lg,
        overflow: "hidden",
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        minHeight: 220,
        padding: 16,
        gap: 10,
        justifyContent: "center",
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 16 }}>{title}</Text>
      <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>{body}</Text>
      {detail ? <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>{detail}</Text> : null}
    </View>
  );
}

export const SalesMap = forwardRef<SalesMapHandle, Props>(function SalesMap(props, ref) {
  const Mapbox = useMemo(() => getMapboxModule(), []);
  const cameraRef = useRef<any>(null);

  const token = config.mapboxAccessToken;
  const styleURL = config.mapboxStyleUrl || Mapbox?.StyleURL?.Street || "mapbox://styles/mapbox/streets-v12";

  useEffect(() => {
    if (!Mapbox || !token) return;
    try {
      if (typeof Mapbox.setAccessToken === "function") Mapbox.setAccessToken(token);
    } catch {
      // ignore, fallback UI below will still help if native setup is incomplete
    }
  }, [Mapbox, token]);

  const stopPoints = useMemo(
    () => compactLatLng(props.stops.map(stopToLatLng)),
    [props.stops],
  );

  const allFitPoints = useMemo(
    () => compactLatLng([...(props.boundary ?? []), ...(props.route ?? []), ...stopPoints]),
    [props.boundary, props.route, stopPoints],
  );

  const fit = useMemo(() => {
    const b = bounds(allFitPoints);
    if (!b) return null;
    const pad = Math.max(0.0025, Math.max(b.maxLat - b.minLat, b.maxLng - b.minLng) * 0.15);
    return {
      ne: [b.maxLng + pad, b.maxLat + pad] as [number, number],
      sw: [b.minLng - pad, b.minLat - pad] as [number, number],
      paddingTop: 42,
      paddingBottom: 42,
      paddingLeft: 42,
      paddingRight: 42,
    };
  }, [allFitPoints]);

  const boundaryFeature = useMemo(() => {
    const pts = compactLatLng(props.boundary ?? []);
    return pts.length >= 3 ? polygonFeature(pts) : null;
  }, [props.boundary]);

  const routeFeature = useMemo(() => {
    const pts = compactLatLng(props.route ?? []);
    return pts.length >= 2 ? lineFeature(pts) : null;
  }, [props.route]);

  useImperativeHandle(
    ref,
    () => ({
      fitAll: (animated = true) => {
        if (!fit || !cameraRef.current?.fitBounds) return;
        cameraRef.current.fitBounds(fit.ne, fit.sw, [fit.paddingTop, fit.paddingRight, fit.paddingBottom, fit.paddingLeft], animated ? 450 : 0);
      },
      focusOn: (p: LatLng, delta = 15.5) => {
        if (!cameraRef.current) return;
        if (typeof cameraRef.current.setCamera === "function") {
          cameraRef.current.setCamera({
            centerCoordinate: lngLat(p),
            zoomLevel: delta,
            animationDuration: 350,
          });
          return;
        }
        if (typeof cameraRef.current.flyTo === "function") {
          cameraRef.current.flyTo(lngLat(p), 350);
        }
      },
    }),
    [fit],
  );

  useEffect(() => {
    if (!Mapbox || !token) return;
    if (props.focus && cameraRef.current?.setCamera) {
      cameraRef.current.setCamera({
        centerCoordinate: lngLat(props.focus),
        zoomLevel: 16,
        animationDuration: 350,
      });
      return;
    }
    if (fit && cameraRef.current?.fitBounds) {
      cameraRef.current.fitBounds(fit.ne, fit.sw, [fit.paddingTop, fit.paddingRight, fit.paddingBottom, fit.paddingLeft], 0);
    }
  }, [Mapbox, token, props.focus?.latitude, props.focus?.longitude, fit?.ne?.[0], fit?.ne?.[1], fit?.sw?.[0], fit?.sw?.[1]]);

  if (!token) {
    return (
      <MapUnavailableCard
        title="Mapbox token missing"
        body="Add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to apps/rep-mobile/.env to render the live map background and real stop locations."
        detail="After adding the token, rebuild the app as a development build so the native Mapbox module is included."
      />
    );
  }

  if (!Mapbox?.MapView || !Mapbox?.Camera) {
    return (
      <MapUnavailableCard
        title="Map placeholder"
        body="Full map available in development build."
        detail="You can still use all other features (clusters, stops, knock logs, quotes)."
      />
    );
  }

  return (
    <View
      style={[
        {
          borderRadius: theme.radius.lg,
          overflow: "hidden",
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          minHeight: 220,
        },
        props.style,
      ]}
    >
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={styleURL}
        compassEnabled
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        pitchEnabled={false}
        rotateEnabled
      >
        <Mapbox.Camera ref={cameraRef} animationDuration={0} bounds={fit ?? undefined} />

        {props.showUserLocation && Mapbox.LocationPuck ? (
          <Mapbox.LocationPuck visible puckBearingEnabled puckBearing="heading" />
        ) : null}

        {boundaryFeature && Mapbox.ShapeSource ? (
          <Mapbox.ShapeSource id="cluster-boundary" shape={boundaryFeature}>
            {Mapbox.FillLayer ? (
              <Mapbox.FillLayer
                id="cluster-boundary-fill"
                style={{
                  fillColor: "#3466AF",
                  fillOpacity: 0.12,
                }}
              />
            ) : null}
            {Mapbox.LineLayer ? (
              <Mapbox.LineLayer
                id="cluster-boundary-line"
                style={{
                  lineColor: "#3466AF",
                  lineWidth: 2,
                  lineOpacity: 0.7,
                }}
              />
            ) : null}
          </Mapbox.ShapeSource>
        ) : null}

        {routeFeature && Mapbox.ShapeSource && Mapbox.LineLayer ? (
          <Mapbox.ShapeSource id="cluster-route" shape={routeFeature}>
            <Mapbox.LineLayer
              id="cluster-route-line"
              style={{
                lineColor: "#0F2747",
                lineWidth: 4,
                lineOpacity: 0.85,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}

        {props.stops.map((stop) => {
          const p = stopToLatLng(stop);
          if (!p || !Mapbox.PointAnnotation) return null;
          const active = stop.id === props.currentStopId || stop.id === props.nextStopId;
          return (
            <Mapbox.PointAnnotation
              key={stop.id}
              id={`stop-${stop.id}`}
              coordinate={lngLat(p)}
              onSelected={() => props.onPressStop?.(stop.id)}
            >
              <View
                style={{
                  width: active ? 24 : 18,
                  height: active ? 24 : 18,
                  borderRadius: 999,
                  backgroundColor: markerColor(stop.id, props.currentStopId, props.nextStopId),
                  borderWidth: 3,
                  borderColor: markerBorderColor(stop.id, props.currentStopId, props.nextStopId),
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#000",
                  shadowOpacity: 0.16,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "900", color: stop.id === props.currentStopId ? "#FFFFFF" : "#0F2747" }}>
                  {String(stop.sequence)}
                </Text>
              </View>
            </Mapbox.PointAnnotation>
          );
        })}
      </Mapbox.MapView>
    </View>
  );
});
