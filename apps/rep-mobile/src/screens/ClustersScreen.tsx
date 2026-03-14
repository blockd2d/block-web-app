import React, { useMemo } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";

import { Banner, Card, Chip, EmptyState, Screen, ScreenHeader, SkeletonRow } from "../components";
import { theme } from "../theme";
import { api } from "../lib/api";
import { formatClusterSchedule } from "../lib/format";
import { getJSON, setJSON, storageKeys } from "../lib/storage";
import { useQueueStore, useSessionStore, useStopActivityStore, useUIStore, useWalkingStore } from "../state";
import type { Cluster } from "../types";

export function ClustersScreen({ navigation }: any) {
  const ui = useUIStore();
  const session = useSessionStore();
  const queue = useQueueStore();
  const walkingSessions = useWalkingStore((s) => s.sessions);
  const stopActivity = useStopActivityStore();

  const tabBarHeight = useBottomTabBarHeight();
  const listBottomPadding = tabBarHeight + theme.space(2);

  const userId = session.me?.user.id ?? null;

  const q = useQuery({
    queryKey: ["clusters", userId],
    queryFn: async () => {
      if (!userId) return [] as Cluster[];
      const res = await api.listAssignedClusters(userId);
      await setJSON(storageKeys.clustersCache, res);
      return res;
    },
    enabled: !!userId,
    staleTime: 10_000
  });

  const cached = useQuery({
    queryKey: ["clusters_cache"],
    queryFn: async () => (await getJSON<Cluster[]>(storageKeys.clustersCache)) ?? [],
    staleTime: Infinity,
    enabled: !ui.isOnline && q.isError
  });

  const data = q.data ?? cached.data ?? [];

  const clusters = useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list;
  }, [data]);

  const pendingCount = queue.items.length;
  const failedCount = queue.items.filter((item) => !!item.lastError).length;

  const activityByCluster = useMemo(() => {
    const counts: Record<string, { pending: number; failed: number }> = {};
    for (const activity of Object.values(stopActivity.byStopId) as Array<(typeof stopActivity.byStopId)[string]>) {
      if (!activity.clusterId) continue;
      if (!counts[activity.clusterId]) counts[activity.clusterId] = { pending: 0, failed: 0 };
      if (activity.knockSyncState === "pending" || activity.knockSyncState === "syncing") {
        counts[activity.clusterId].pending += 1;
      }
      if (activity.knockSyncState === "failed") {
        counts[activity.clusterId].failed += 1;
      }
    }
    return counts;
  }, [stopActivity.byStopId]);

  return (
    <Screen>
      {!ui.isOnline && <Banner tone="warning" text="Offline: knocks/quotes will sync when online." />}
      {failedCount > 0 ? <Banner tone="danger" text={`Sync needs attention: ${failedCount} failed item${failedCount === 1 ? "" : "s"}.`} /> : null}
      {!failedCount && pendingCount > 0 ? <Banner tone="info" text={`Pending sync: ${pendingCount} item${pendingCount === 1 ? "" : "s"}`} /> : null}

      <ScreenHeader title="Clusters" subtitle="Assigned" />

      {q.isLoading && (
        <Card>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      )}

      {!q.isLoading && clusters.length === 0 && (
        <EmptyState
          title="No assigned clusters"
          body={ui.isOnline ? "You have no clusters assigned yet." : "You're offline and no cached clusters are available yet."}
          action={
            <Pressable
              onPress={() => q.refetch()}
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: 14,
                paddingHorizontal: 16,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.chipBg,
                opacity: pressed ? 0.9 : 1
              })}
            >
              <Text style={{ fontWeight: "900", color: theme.colors.text }}>Refresh</Text>
            </Pressable>
          }
        />
      )}

      <FlatList
        style={{ flex: 1 }}
        data={clusters}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        contentContainerStyle={{ paddingBottom: listBottomPadding }}
        renderItem={({ item }) => {
          const activity = activityByCluster[item.id] ?? { pending: 0, failed: 0 };
          return (
            <Pressable
              onPress={() => navigation.navigate("ClusterDetail", { clusterId: item.id })}
              style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1, marginBottom: theme.space(1.5) })}
            >
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: theme.colors.text }}>{item.name}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {walkingSessions[item.id] ? <Chip label="Resume walking" /> : null}
                      {activity.failed > 0 ? <Chip label={`${activity.failed} sync failed`} active /> : null}
                      {activity.failed === 0 && activity.pending > 0 ? <Chip label={`${activity.pending} pending`} active /> : null}
                    </View>
                    <Text style={{ marginTop: 10, color: theme.colors.muted, fontWeight: "800" }}>
                      {item.completedCount}/{item.stopCount} completed
                    </Text>
                    <Text style={{ marginTop: 4, color: theme.colors.muted, fontWeight: "800" }}>
                      {item.walkingDistanceMiles ? `${item.walkingDistanceMiles.toFixed(1)} mi walk` : "Walk distance —"}
                    </Text>
                    <Text style={{ marginTop: 4, color: theme.colors.muted, fontWeight: "800" }}>
                      {formatClusterSchedule(item.scheduledStart, item.scheduledEnd)}
                    </Text>
                  </View>
                  <StatusPill status={item.status} />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

function StatusPill(props: { status: string }) {
  const s = props.status;
  const tone = s === "completed" ? "success" : s === "active" ? "warning" : "info";

  const bg = tone === "success" ? theme.colors.successBg : tone === "warning" ? theme.colors.warningBg : theme.colors.infoBg;
  const fg = tone === "success" ? theme.colors.success : tone === "warning" ? theme.colors.warning : theme.colors.info;

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontWeight: "900" }}>{formatStatus(s)}</Text>
    </View>
  );
}

function formatStatus(s: string) {
  return s.replace(/_/g, " ");
}
