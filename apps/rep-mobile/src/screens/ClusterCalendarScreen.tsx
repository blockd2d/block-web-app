import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import { formatClusterSchedule, formatTimeShort, parseIsoDate } from "../lib/format";
import { getJSON, setJSON, storageKeys } from "../lib/storage";
import { useSessionStore, useUIStore } from "../state";
import { Banner, EmptyState, Screen, ScreenHeader } from "../components";
import { theme } from "../theme";
import type { Cluster } from "../types";

const WORK_START_MIN = 8 * 60;
const WORK_END_MIN = 20 * 60;
const WINDOW_MIN = WORK_END_MIN - WORK_START_MIN;
const PX_PER_MIN = 1.6;
const TIME_RAIL_W = 84;
const COL_GAP = 8;
const CHIP_W = 40;
const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

type ScheduledCluster = Cluster & {
  startDate: Date;
  endDate: Date;
};

type LaidOutCluster = {
  cluster: ScheduledCluster;
  startMin: number;
  endMin: number;
  col: number;
  colCount: number;
};

function startOfWeekSunday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function minutesOfDayLocal(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function formatWeekRangeLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function formatTimeLabel(minsOfDay: number) {
  const h24 = Math.floor(minsOfDay / 60);
  const m = minsOfDay % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

function layoutWithOverlapColumns(items: Array<{ cluster: ScheduledCluster; startMin: number; endMin: number }>) {
  if (items.length === 0) return { laidOut: [] as LaidOutCluster[], hasOverlap: false, colCount: 1 };

  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const active: Array<{ endMin: number; col: number }> = [];
  const out: Array<{ cluster: ScheduledCluster; startMin: number; endMin: number; col: number }> = [];
  let maxCols = 1;

  for (const item of sorted) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMin <= item.startMin) active.splice(i, 1);
    }
    const used = new Set(active.map((x) => x.col));
    let col = 0;
    while (used.has(col)) col++;
    active.push({ endMin: item.endMin, col });
    maxCols = Math.max(maxCols, active.length);
    out.push({ ...item, col });
  }

  return {
    laidOut: out.map((item) => ({ ...item, colCount: maxCols })),
    hasOverlap: maxCols > 1,
    colCount: maxCols
  };
}

export function ClusterCalendarScreen({ navigation }: any) {
  const ui = useUIStore();
  const session = useSessionStore();
  const userId = session.me?.user.id ?? null;
  const { width: windowW } = useWindowDimensions();

  const contentW = Math.max(0, windowW - theme.space(2) * 2);
  const chipGap = Math.max(0, Math.floor((contentW - 7 * CHIP_W) / 7));

  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedDow, setSelectedDow] = useState<number>(() => new Date().getDay());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNowMs(Date.now());
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const currentWeekStart = useMemo(() => startOfWeekSunday(now), [now]);
  const viewWeekStart = useMemo(() => addDays(currentWeekStart, weekOffset * 7), [currentWeekStart, weekOffset]);
  const selectedDate = useMemo(() => addDays(viewWeekStart, selectedDow), [viewWeekStart, selectedDow]);
  const weekLabel = useMemo(() => formatWeekRangeLabel(viewWeekStart), [viewWeekStart]);

  const canGoPrev = weekOffset > -1;
  const canGoNext = weekOffset < 1;

  const chipsCarouselX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    chipsCarouselX.setValue(-contentW);
  }, [chipsCarouselX, contentW]);

  const chipsPanResponder = useMemo(() => {
    const threshold = Math.max(60, contentW * 0.22);
    const edgeRevealMax = contentW * 0.28;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 10,
      onPanResponderMove: (_evt, gs) => {
        const dx = gs.dx;
        const draggingRight = dx > 0;
        const draggingLeft = dx < 0;

        let adj = dx;
        if (draggingRight && !canGoPrev) adj = Math.min(edgeRevealMax, dx * 0.15);
        if (draggingLeft && !canGoNext) adj = Math.max(-edgeRevealMax, dx * 0.15);
        adj = Math.max(-contentW, Math.min(contentW, adj));
        chipsCarouselX.setValue(-contentW + adj);
      },
      onPanResponderRelease: (_evt, gs) => {
        const dx = gs.dx;
        const goNext = dx < -threshold && canGoNext;
        const goPrev = dx > threshold && canGoPrev;

        if (goNext) {
          Animated.timing(chipsCarouselX, {
            toValue: -2 * contentW,
            duration: 180,
            useNativeDriver: true
          }).start(() => {
            setWeekOffset((w) => Math.min(1, w + 1));
            chipsCarouselX.setValue(-contentW);
          });
          return;
        }

        if (goPrev) {
          Animated.timing(chipsCarouselX, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true
          }).start(() => {
            setWeekOffset((w) => Math.max(-1, w - 1));
            chipsCarouselX.setValue(-contentW);
          });
          return;
        }

        Animated.spring(chipsCarouselX, {
          toValue: -contentW,
          useNativeDriver: true
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(chipsCarouselX, { toValue: -contentW, useNativeDriver: true }).start();
      }
    });
  }, [canGoNext, canGoPrev, chipsCarouselX, contentW]);

  const clustersQ = useQuery({
    queryKey: ["clusters", userId, "calendar"],
    queryFn: async () => {
      if (!userId) return [] as Cluster[];
      const res = await api.listAssignedClusters(userId);
      await setJSON(storageKeys.clustersCache, res);
      return res;
    },
    enabled: !!userId,
    staleTime: 10_000
  });

  const cachedQ = useQuery({
    queryKey: ["clusters_cache", "calendar"],
    queryFn: async () => (await getJSON<Cluster[]>(storageKeys.clustersCache)) ?? [],
    staleTime: Infinity,
    enabled: !ui.isOnline && clustersQ.isError
  });

  const clusters = clustersQ.data ?? cachedQ.data ?? [];

  const scheduledClusters = useMemo(() => {
    return clusters.flatMap((cluster) => {
      const startDate = parseIsoDate(cluster.scheduledStart);
      if (!startDate) return [];
      const explicitEnd = parseIsoDate(cluster.scheduledEnd);
      const fallbackEnd = new Date(startDate.getTime() + Math.max(cluster.estDurationMins ?? 60, 30) * 60_000);
      return [{ ...cluster, startDate, endDate: explicitEnd ?? fallbackEnd } satisfies ScheduledCluster];
    });
  }, [clusters]);

  const dayClusters = useMemo(() => {
    let outsideCount = 0;
    const items: Array<{ cluster: ScheduledCluster; startMin: number; endMin: number }> = [];

    for (const cluster of scheduledClusters) {
      if (!sameLocalDay(cluster.startDate, selectedDate)) continue;
      const startMin = minutesOfDayLocal(cluster.startDate);
      const endMin = Math.max(startMin + 30, minutesOfDayLocal(cluster.endDate));
      if (startMin < WORK_START_MIN || endMin > WORK_END_MIN) {
        outsideCount += 1;
        continue;
      }
      items.push({ cluster, startMin, endMin });
    }

    return { items, outsideCount };
  }, [scheduledClusters, selectedDate]);

  const { laidOut, hasOverlap, colCount } = useMemo(() => layoutWithOverlapColumns(dayClusters.items), [dayClusters.items]);
  const blockW = useMemo(() => {
    const usable = Math.max(0, contentW - TIME_RAIL_W - theme.space(1));
    return Math.max(132, Math.floor((usable - Math.max(0, colCount - 1) * COL_GAP) / colCount));
  }, [colCount, contentW]);

  const railH = WINDOW_MIN * PX_PER_MIN;
  const timelineTicks = useMemo(() => {
    const out: Array<{ minuteOfDay: number; kind: "hour" | "half" }> = [];
    for (let m = WORK_START_MIN; m <= WORK_END_MIN; m += 30) {
      out.push({ minuteOfDay: m, kind: m % 60 === 0 ? "hour" : "half" });
    }
    return out;
  }, []);

  const unscheduledCount = clusters.length - scheduledClusters.length;

  return (
    <Screen>
      {!ui.isOnline && <Banner tone="warning" text="Offline: showing cached cluster schedules when available." />}
      {unscheduledCount > 0 ? <Banner tone="info" text={`${unscheduledCount} cluster${unscheduledCount === 1 ? "" : "s"} have no schedule and are omitted here.`} /> : null}
      {dayClusters.outsideCount > 0 ? <Banner tone="info" text={`${dayClusters.outsideCount} cluster${dayClusters.outsideCount === 1 ? "" : "s"} fall outside the 8:00 AM–8:00 PM view.`} /> : null}
      {hasOverlap ? <Banner tone="warning" text="Overlapping clusters detected for this day." /> : null}

      <ScreenHeader title="Calendar" subtitle={`Week · ${weekLabel}`} />

      {!clustersQ.isLoading && laidOut.length === 0 ? (
        <EmptyState
          title="No scheduled clusters"
          body={ui.isOnline ? `No scheduled clusters for ${selectedDate.toLocaleDateString()}.` : "You're offline and no cached scheduled clusters are available yet."}
        />
      ) : null}

      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: theme.space(2) }} showsVerticalScrollIndicator>
          <View style={{ position: "relative", height: railH, marginTop: theme.space(1) }}>
            {timelineTicks.map((tick) => {
              const y = Math.min(railH - 1, (tick.minuteOfDay - WORK_START_MIN) * PX_PER_MIN);
              return (
                <View key={`tick_${tick.minuteOfDay}`} style={{ position: "absolute", top: y, left: 0, right: 0 }}>
                  {tick.kind === "hour" ? (
                    <Text
                      style={{
                        position: "absolute",
                        left: 0,
                        top: -8,
                        width: TIME_RAIL_W,
                        color: theme.colors.muted,
                        fontWeight: "900",
                        fontSize: 12
                      }}
                    >
                      {formatTimeLabel(tick.minuteOfDay)}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      position: "absolute",
                      left: TIME_RAIL_W,
                      right: 0,
                      height: 1,
                      backgroundColor: theme.colors.border,
                      opacity: tick.kind === "half" ? 0.35 : 0.6
                    }}
                  />
                </View>
              );
            })}

            {laidOut.map((item) => {
              const y = (item.startMin - WORK_START_MIN) * PX_PER_MIN;
              const h = Math.max(36, (item.endMin - item.startMin) * PX_PER_MIN);
              const left = TIME_RAIL_W + theme.space(1) + item.col * (blockW + COL_GAP);

              return (
                <Pressable
                  key={item.cluster.id}
                  onPress={() => navigation.navigate("ClusterDetail", { clusterId: item.cluster.id })}
                  style={({ pressed }) => [
                    {
                      position: "absolute",
                      top: y,
                      left,
                      height: h,
                      width: blockW,
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                      borderWidth: 1,
                      borderRadius: theme.radius.md,
                      padding: theme.space(1.25),
                      opacity: pressed ? 0.9 : 1,
                      shadowColor: "#000",
                      shadowOpacity: 0.18,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 3
                    }
                  ]}
                >
                  <Text numberOfLines={2} style={{ fontWeight: "900", color: "#FFFFFF", fontSize: 14 }}>
                    {item.cluster.name}
                  </Text>
                  <Text numberOfLines={1} style={{ marginTop: 4, color: "rgba(255,255,255,0.85)", fontWeight: "800" }}>
                    {formatClusterSchedule(item.cluster.scheduledStart, item.cluster.scheduledEnd, { includeDate: false })}
                  </Text>
                  <Text
                    style={{
                      position: "absolute",
                      right: theme.space(1),
                      bottom: theme.space(0.9),
                      fontSize: 12,
                      fontWeight: "900",
                      color: "rgba(255,255,255,0.92)",
                      backgroundColor: "rgba(255,255,255,0.12)",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      overflow: "hidden"
                    }}
                  >
                    Open cluster
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={{ paddingTop: theme.space(0.5), paddingBottom: theme.space(1) }}>
        <View {...chipsPanResponder.panHandlers} style={{ overflow: "hidden" }}>
          <Animated.View
            style={{
              flexDirection: "row",
              width: contentW * 3,
              transform: [{ translateX: chipsCarouselX }]
            }}
          >
            {[addDays(viewWeekStart, -7), viewWeekStart, addDays(viewWeekStart, 7)].map((weekStart, idxRow) => {
              const isCurrentRow = idxRow === 1;
              const rowIsPrev = idxRow === 0;
              const rowIsNext = idxRow === 2;
              const rowEnabled = isCurrentRow;
              const rowAllowed = isCurrentRow || (rowIsPrev ? canGoPrev : rowIsNext ? canGoNext : true);
              const rowOpacity = rowAllowed ? 1 : 0.25;

              return (
                <View
                  key={`wk_${weekStart.toISOString()}_${idxRow}`}
                  pointerEvents={rowEnabled ? "auto" : "none"}
                  style={{
                    width: contentW,
                    flexDirection: "row",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    paddingHorizontal: chipGap / 2,
                    opacity: rowOpacity
                  }}
                >
                  {dayNames.map((label, idx) => {
                    const selected = idx === selectedDow;
                    const dayDate = addDays(weekStart, idx);
                    const isToday = sameLocalDay(dayDate, now);
                    return (
                      <Pressable
                        key={`${label}_${idxRow}_${idx}`}
                        onPress={() => setSelectedDow(idx)}
                        style={({ pressed }) => [
                          {
                            width: CHIP_W,
                            height: CHIP_W,
                            borderRadius: 999,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: theme.colors.chipBg,
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected ? "#000" : theme.colors.border,
                            marginRight: idx === dayNames.length - 1 ? 0 : chipGap,
                            opacity: pressed ? 0.85 : 1
                          }
                        ]}
                      >
                        <Text style={{ fontWeight: "900", color: isToday ? theme.colors.danger : theme.colors.text }}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </Animated.View>
        </View>
      </View>

      <View style={{ paddingBottom: theme.space(1) }}>
        <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>
          {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </Text>
        {laidOut.length > 0 ? (
          <Text style={{ marginTop: 4, color: theme.colors.text, fontWeight: "900" }}>
            {laidOut.length} scheduled cluster{laidOut.length === 1 ? "" : "s"} · {formatTimeShort(laidOut[0].cluster.startDate)} onward
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
