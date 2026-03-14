import React, { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Banner, Button, Card, Chip, Input, Screen, SelectField } from "../components";
import { theme } from "../theme";
import { api } from "../lib/api";
import {
  formatDateTime,
  formatKnockOutcome,
  formatPhoneInputDisplay,
  formatSyncState,
  normalizePhoneForStorage
} from "../lib/format";
import { getJSON, setJSON, storageKeys } from "../lib/storage";
import { useQueueStore, useStopActivityStore, useUIStore, useWalkingStore } from "../state";
import type { KnockOutcome, Stop } from "../types";
import { SalesMap, type SalesMapHandle } from "../SalesMap";
import { stopToLatLng } from "../lib/geo";

const OUTCOME_OPTIONS: { label: string; value: KnockOutcome }[] = [
  { label: "No answer", value: "no_answer" },
  { label: "Not interested", value: "not_interested" },
  { label: "Interested", value: "interested" },
  { label: "Estimated", value: "estimated" },
  { label: "Booked", value: "booked" }
];

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function WalkingModeScreen({ route, navigation }: any) {
  const { clusterId, startAtStopId } = route.params as { clusterId: string; startAtStopId?: string };

  const ui = useUIStore();
  const queryClient = useQueryClient();
  const queue = useQueueStore();
  const savedSession = useWalkingStore((s) => s.sessions[clusterId] ?? null);
  const setWalkingSession = useWalkingStore((s) => s.setSession);
  const clearWalkingSession = useWalkingStore((s) => s.clearSession);
  const stopActivity = useStopActivityStore();
  const insets = useSafeAreaInsets();

  const mapRef = useRef<SalesMapHandle | null>(null);
  const savedSessionSeedRef = useRef(savedSession);
  const persistedSessionRef = useRef<string>("");

  const [locAllowed, setLocAllowed] = useState(false);
  const [locChecked, setLocChecked] = useState(false);
  const [savingKnock, setSavingKnock] = useState(false);
  const [outcome, setOutcome] = useState<KnockOutcome>("no_answer");
  const [notes, setNotes] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

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

  const stops = useMemo(
    () => (stopsQ.data ?? cachedStopsQ.data ?? []).slice().sort((a, b) => a.sequence - b.sequence),
    [stopsQ.data, cachedStopsQ.data]
  );

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

  const initialIndex = useMemo(() => {
    if (!stops.length) return 0;
    if (startAtStopId) {
      const routeIdx = stops.findIndex((s) => s.id === startAtStopId);
      if (routeIdx >= 0) return routeIdx;
    }

    const saved = savedSessionSeedRef.current;
    if (saved?.currentStopId) {
      const savedIdx = stops.findIndex((s) => s.id === saved.currentStopId);
      if (savedIdx >= 0) return savedIdx;
    }
    if (typeof saved?.currentIndex === "number" && saved.currentIndex >= 0 && saved.currentIndex < stops.length) {
      return saved.currentIndex;
    }

    const firstIncomplete = stops.findIndex((s) => !s.completed);
    return firstIncomplete >= 0 ? firstIncomplete : 0;
  }, [stops, startAtStopId]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx((prev) => (prev === initialIndex ? prev : initialIndex));
  }, [initialIndex]);

  const current = stops[idx] ?? null;
  const next = stops[idx + 1] ?? null;
  const currentStopId = current?.id ?? null;
  const currentActivity = current ? stopActivity.byStopId[current.id] ?? null : null;
  const normalizedPhone = useMemo(() => normalizePhoneForStorage(phoneInput), [phoneInput]);
  const canSaveNumber = !!current && !!normalizedPhone && normalizedPhone !== currentActivity?.lastPhoneNumber;

  useEffect(() => {
    const nextKey = `${clusterId}:${idx}:${currentStopId ?? ""}`;
    if (persistedSessionRef.current === nextKey) return;
    persistedSessionRef.current = nextKey;
    setWalkingSession(clusterId, { currentIndex: idx, currentStopId });
  }, [clusterId, currentStopId, idx, setWalkingSession]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        setLocAllowed(res.status === "granted");
        setLocChecked(true);
      } catch {
        if (!mounted) return;
        setLocAllowed(false);
        setLocChecked(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const nextOutcome = currentActivity?.lastOutcome ?? "no_answer";
    const nextNotes = currentActivity?.lastNotes ?? "";
    const nextPhone = formatPhoneInputDisplay(currentActivity?.lastPhoneNumber ?? "");
    setOutcome((prev) => (prev === nextOutcome ? prev : nextOutcome));
    setNotes((prev) => (prev === nextNotes ? prev : nextNotes));
    setPhoneInput((prev) => (prev === nextPhone ? prev : nextPhone));
  }, [current?.id, currentActivity?.lastOutcome, currentActivity?.lastNotes, currentActivity?.lastPhoneNumber]);

  const completedCount = useMemo(() => stops.filter((s) => !!s.completed).length, [stops]);
  const remainingCount = Math.max(0, stops.length - completedCount);
  const progressLabel = stops.length ? `Stop ${Math.min(idx + 1, stops.length)} of ${stops.length}` : "";
  const disabledNav = !stops.length || !current;
  const focus = current ? stopToLatLng(current) : null;

  async function markStopCompleted(stopId: string) {
    const updated = stops.map((s) => (s.id === stopId ? { ...s, completed: true } : s));
    queryClient.setQueryData(["cluster_stops", clusterId], updated);
    queryClient.setQueryData(["cluster_stops_cache", clusterId], updated);
    await setJSON(storageKeys.clusterStops(clusterId), updated);
  }

  async function saveKnock() {
    if (!current || savingKnock) return;

    setSavingKnock(true);
    const payload = {
      clientEventId: uid("kn"),
      clusterId,
      stopId: current.id,
      outcome,
      notes: notes.trim() ? notes.trim() : null
    };

    stopActivity.recordKnockPending(payload);

    try {
      if (ui.isOnline) {
        try {
          const saved = await api.createKnockLog(payload);
          stopActivity.recordKnockSynced(saved);
        } catch {
          queue.enqueue("knock_log", payload);
        }
      } else {
        queue.enqueue("knock_log", payload);
      }

      await markStopCompleted(current.id);
      setNotes("");
      setOutcome("no_answer");

      if (idx < stops.length - 1) {
        setIdx((i) => Math.min(i + 1, stops.length - 1));
      }
    } finally {
      setSavingKnock(false);
    }
  }

  function savePhoneNumber() {
    if (!current || !normalizedPhone) return;

    stopActivity.savePhoneNumber({
      clusterId,
      stopId: current.id,
      phone: normalizedPhone
    });
    setPhoneInput(formatPhoneInputDisplay(normalizedPhone));
  }

  return (
    <Screen
      style={{
        paddingHorizontal: theme.space(2),
        paddingTop: Math.max(insets.top, theme.space(2)),
        paddingBottom: 0
      }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: theme.space(2), paddingBottom: Math.max(insets.bottom, theme.space(2)) }}>
          <View style={{ gap: theme.space(1) }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.space(1) }}>
              <Pressable
                onPress={() => {
                  clearWalkingSession(clusterId);
                  navigation.goBack();
                }}
                hitSlop={10}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  opacity: pressed ? 0.86 : 1
                })}
              >
                <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "900", lineHeight: 20 }}>✕</Text>
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: "900", color: theme.colors.text }}>Walking Mode</Text>
                <Text style={{ marginTop: 4, color: theme.colors.muted, fontWeight: "800" }}>{current?.address1 ?? "—"}</Text>
                <Text style={{ marginTop: 4, color: theme.colors.muted }} numberOfLines={1}>
                  Next: {next?.address1 ?? "—"}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <View style={{ backgroundColor: theme.colors.chipBg, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: "900" }}>{progressLabel}</Text>
                </View>
                <Text style={{ marginTop: 6, color: theme.colors.muted, fontWeight: "800" }}>
                  {completedCount}/{stops.length} done · {remainingCount} left
                </Text>
              </View>
            </View>

            {!ui.isOnline ? <Banner tone="warning" text="Offline: knock logs will sync when you reconnect." /> : null}
            {!!queue.lastFlushError ? <Banner tone="danger" text={`Sync error: ${queue.lastFlushError}`} /> : null}
            {locChecked && !locAllowed ? <Banner tone="info" text="Location is off: map won't show your dot." /> : null}
          </View>

          <SalesMap
            ref={mapRef}
            style={{ minHeight: 220 }}
            stops={stops}
            boundary={mapData.boundary}
            route={mapData.route}
            currentStopId={current?.id ?? null}
            nextStopId={next?.id ?? null}
            focus={focus}
            showUserLocation={locAllowed}
          />

          <Button
            title="Recenter"
            variant="secondary"
            onPress={() => {
              if (focus) mapRef.current?.focusOn(focus);
              else mapRef.current?.fitAll(true);
            }}
          />

          {currentActivity?.knockSyncState || currentActivity?.lastOutcome ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {currentActivity?.knockSyncState ? (
                <Chip label={formatSyncState(currentActivity.knockSyncState)} active={currentActivity.knockSyncState !== "synced"} />
              ) : null}
              {currentActivity?.lastOutcome ? <Chip label={`Last: ${formatKnockOutcome(currentActivity.lastOutcome)}`} /> : null}
            </View>
          ) : null}

          {currentActivity?.lastKnockAt ? (
            <View style={{ gap: 4 }}>
              <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>Last knock</Text>
              <Text style={{ color: theme.colors.text }}>{formatDateTime(currentActivity.lastKnockAt)}</Text>
              {currentActivity.lastNotes ? (
                <Text style={{ color: theme.colors.muted }} numberOfLines={2}>
                  “{currentActivity.lastNotes}”
                </Text>
              ) : null}
            </View>
          ) : null}

          <Card>
            <Text style={{ color: theme.colors.muted, fontWeight: "800", marginBottom: 8 }}>Phone number</Text>
            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="(555) 123-4567"
              placeholderTextColor={theme.colors.muted}
              keyboardType="phone-pad"
              autoCorrect={false}
              style={{
                minHeight: theme.tapMinHeight,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
                color: theme.colors.text,
                paddingHorizontal: 14,
                fontSize: 16,
                fontWeight: "700"
              }}
            />
            {phoneInput.trim() && !normalizedPhone ? (
              <Text style={{ marginTop: 8, color: theme.colors.warning, fontWeight: "700" }}>
                Enter a valid phone number to save.
              </Text>
            ) : null}
            {currentActivity?.lastPhoneSavedAt ? (
              <Text style={{ marginTop: 8, color: theme.colors.muted }}>
                Saved {formatDateTime(currentActivity.lastPhoneSavedAt)}
                {currentActivity?.lastPhoneNumber ? ` · ${formatPhoneInputDisplay(currentActivity.lastPhoneNumber)}` : ""}
              </Text>
            ) : null}
            <View style={{ marginTop: theme.space(1.5) }}>
              <Button title="Save Number" variant="secondary" onPress={savePhoneNumber} disabled={!canSaveNumber} />
            </View>
          </Card>

          <View>
            <SelectField label="Knock outcome" value={outcome} options={OUTCOME_OPTIONS} onChange={setOutcome} />
            <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes…" multiline numberOfLines={4} />
          </View>

          <View style={{ gap: theme.space(1) }}>
            <Button title={savingKnock ? "Saving…" : "Save Knock & Next"} onPress={saveKnock} loading={savingKnock} disabled={!current} />
          </View>

          <View style={{ flexDirection: "row", gap: theme.space(1) }}>
            <View style={{ flex: 1 }}>
              <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Next Stop" onPress={() => setIdx((i) => Math.min(i + 1, Math.max(0, stops.length - 1)))} disabled={disabledNav || idx >= stops.length - 1} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
