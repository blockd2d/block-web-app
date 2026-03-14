import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Banner, Button, Card, Chip, ScrollScreen, ScreenHeader, SkeletonRow } from "../components";
import { theme } from "../theme";
import { api } from "../lib/api";
import { formatClusterSchedule, formatKnockOutcome, formatSyncState } from "../lib/format";
import { compactLatLng, polylineDistanceMiles, stopToLatLng } from "../lib/geo";
import { getJSON, setJSON, storageKeys } from "../lib/storage";
import { openDriveToLatLng } from "../lib/openMaps";
import { SalesMap } from "../SalesMap";
import { useStopActivityStore, useUIStore, useWalkingStore } from "../state";
import type { Cluster, Stop } from "../types";

export function ClusterDetailScreen({ route, navigation }: any) {
  const { clusterId } = route.params as { clusterId: string };

  const ui = useUIStore();
  const resume = useWalkingStore((s) => s.sessions[clusterId] ?? null);
  const stopActivity = useStopActivityStore();

  const clustersQ = useQuery({
    queryKey: ["clusters_for_detail"],
    queryFn: async () => (await getJSON<Cluster[]>(storageKeys.clustersCache)) ?? [],
    staleTime: Infinity
  });

  const cluster = useMemo(() => (clustersQ.data ?? []).find((c) => c.id === clusterId) ?? null, [clustersQ.data, clusterId]);

  const stopsQ = useQuery({
    queryKey: ["cluster_stops", clusterId],
    queryFn: async () => {
      const res = await api.getClusterStops(clusterId);
      await setJSON(storageKeys.clusterStops(clusterId), res);
      return res;
    },
    staleTime: 10_000
  });

  const cachedStopsQ = useQuery({
    queryKey: ["cluster_stops_cache", clusterId],
    queryFn: async () => (await getJSON<Stop[]>(storageKeys.clusterStops(clusterId))) ?? [],
    staleTime: Infinity,
    enabled: !ui.isOnline && stopsQ.isError
  });

  const stops = stopsQ.data ?? cachedStopsQ.data ?? [];

  const mapQ = useQuery({
    queryKey: ["cluster_map", clusterId],
    queryFn: async () => {
      const res = await api.getClusterMapData(clusterId);
      await setJSON(storageKeys.clusterMap(clusterId), res);
      return res;
    },
    staleTime: 60_000
  });

  const cachedMapQ = useQuery({
    queryKey: ["cluster_map_cache", clusterId],
    queryFn: async () => (await getJSON<any>(storageKeys.clusterMap(clusterId))) ?? { boundary: null, route: null },
    staleTime: Infinity,
    enabled: !ui.isOnline && mapQ.isError
  });

  const mapData = mapQ.data ?? cachedMapQ.data ?? { boundary: null, route: null };

  const derivedRouteMiles = useMemo(() => {
    const routePts = compactLatLng(mapData.route ?? []);
    if (routePts.length >= 2) return polylineDistanceMiles(routePts);
    const stopPts = compactLatLng(stops.map(stopToLatLng));
    return stopPts.length >= 2 ? polylineDistanceMiles(stopPts) : 0;
  }, [mapData.route, stops]);

  const progressText = cluster ? `${cluster.completedCount}/${cluster.stopCount} completed` : "";

  const resumeStopId = useMemo(() => {
    if (!resume) return null;
    if (resume.currentStopId) return resume.currentStopId;
    const sorted = stops.slice().sort((a, b) => a.sequence - b.sequence);
    return sorted[resume.currentIndex]?.id ?? null;
  }, [resume, stops]);

  const pendingStops = stops.filter((s) => {
    const activity = stopActivity.byStopId[s.id];
    return activity?.knockSyncState === "pending" || activity?.knockSyncState === "syncing";
  }).length;

  const failedStops = stops.filter((s) => {
    const activity = stopActivity.byStopId[s.id];
    return activity?.knockSyncState === "failed";
  }).length;

  return (
    <ScrollScreen>
      {!ui.isOnline && <Banner tone="warning" text="Offline: you can still view cached stops and log knocks." />}
      {failedStops > 0 ? <Banner tone="danger" text={`${failedStops} stop${failedStops === 1 ? "" : "s"} need re-sync.`} /> : null}
      {!failedStops && pendingStops > 0 ? <Banner tone="info" text={`${pendingStops} stop${pendingStops === 1 ? "" : "s"} pending sync.`} /> : null}

      <ScreenHeader title={cluster?.name ?? "Cluster"} subtitle={progressText} />

      <Card style={{ marginBottom: theme.space(2) }}>
        <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>Cluster</Text>
        <Text style={{ marginTop: 4, fontWeight: "900", color: theme.colors.text }}>{cluster?.id ?? clusterId}</Text>

        <View style={{ marginTop: theme.space(2), flexDirection: "row", justifyContent: "space-between", gap: theme.space(1) }}>
          <View>
            <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>Stops</Text>
            <Text style={{ marginTop: 4, fontWeight: "900", color: theme.colors.text }}>{cluster?.stopCount ?? stops.length}</Text>
          </View>
          <View>
            <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>Walk</Text>
            <Text style={{ marginTop: 4, fontWeight: "900", color: theme.colors.text }}>
              {cluster?.walkingDistanceMiles
                ? `${cluster.walkingDistanceMiles.toFixed(1)} mi`
                : derivedRouteMiles
                  ? `${derivedRouteMiles.toFixed(1)} mi`
                  : "—"}
            </Text>
          </View>
          <View>
            <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>ETA</Text>
            <Text style={{ marginTop: 4, fontWeight: "900", color: theme.colors.text }}>
              {cluster?.estDurationMins ? `${cluster.estDurationMins}m` : "—"}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: theme.space(2) }}>
          <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>Scheduled</Text>
          <Text style={{ marginTop: 4, fontWeight: "900", color: theme.colors.text }}>
            {formatClusterSchedule(cluster?.scheduledStart, cluster?.scheduledEnd)}
          </Text>
        </View>
      </Card>

      <Card style={{ marginBottom: theme.space(2) }}>
        <Text style={{ fontWeight: "900", color: theme.colors.text }}>Map</Text>
        <View style={{ height: 240, marginTop: theme.space(1) }}>
          <SalesMap
            stops={stops}
            boundary={mapData.boundary}
            route={mapData.route}
            onPressStop={(stopId) => navigation.navigate("WalkingMode", { clusterId, startAtStopId: stopId })}
          />
        </View>

        <View style={{ marginTop: theme.space(1), flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>Route</Text>
          <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
            {cluster?.walkingDistanceMiles
              ? `${cluster.walkingDistanceMiles.toFixed(1)} mi (est)`
              : derivedRouteMiles
                ? `${derivedRouteMiles.toFixed(1)} mi (map)`
                : "—"}
          </Text>
        </View>
      </Card>

      <View style={{ gap: theme.space(1), marginBottom: theme.space(2) }}>
        <Button
          title="Drive to Start"
          onPress={async () => {
            const lat = cluster?.startLat ?? null;
            const lng = cluster?.startLng ?? null;
            if (typeof lat === "number" && typeof lng === "number") {
              await openDriveToLatLng(lat, lng, cluster?.name ?? "Cluster start");
            }
          }}
          disabled={!(typeof cluster?.startLat === "number" && typeof cluster?.startLng === "number")}
        />
        {resume ? (
          <Button
            title="Resume Walking"
            variant="primary"
            onPress={() => navigation.navigate("WalkingMode", { clusterId, startAtStopId: resumeStopId ?? undefined })}
          />
        ) : (
          <Button title="Start Walking Mode" onPress={() => navigation.navigate("WalkingMode", { clusterId })} variant="primary" />
        )}
      </View>

      <Card>
        <Text style={{ fontWeight: "900", color: theme.colors.text }}>Stops</Text>
        <Text style={{ marginTop: 8, color: theme.colors.muted }}>
          Ordered stop list is manager-defined (web app). Tap a stop to start walking at that address.
        </Text>

        {stopsQ.isLoading ? (
          <View style={{ marginTop: theme.space(2) }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : stops.length === 0 ? (
          <Text style={{ marginTop: theme.space(2), color: theme.colors.muted, fontWeight: "800" }}>No stops found.</Text>
        ) : (
          <View style={{ marginTop: theme.space(1) }}>
            {stops.slice(0, 5).map((s, idx) => {
              const activity = stopActivity.byStopId[s.id] ?? null;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => navigation.navigate("WalkingMode", { clusterId, startAtStopId: s.id })}
                  style={{
                    paddingVertical: 12,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: theme.colors.border
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>Stop {s.sequence}</Text>
                      <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 4 }}>{s.address1}</Text>
                      {(activity?.knockSyncState || activity?.lastOutcome || s.completed) ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                          {activity?.knockSyncState ? (
                            <Chip label={formatSyncState(activity.knockSyncState)} active={activity.knockSyncState !== "synced"} />
                          ) : null}
                          {activity?.lastOutcome ? <Chip label={formatKnockOutcome(activity.lastOutcome)} /> : null}
                          {s.completed ? <Chip label="Completed" /> : null}
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>›</Text>
                  </View>
                </Pressable>
              );
            })}
            {stops.length > 5 ? <Text style={{ marginTop: 10, color: theme.colors.muted, fontWeight: "700" }}>+ {stops.length - 5} more</Text> : null}
          </View>
        )}
      </Card>
    </ScrollScreen>
  );
}
