import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Banner, Button, Card, Chip, Input, ScrollScreen, SelectField } from "../components";
import { theme } from "../theme";
import { api } from "../lib/api";
import { formatDateTime, formatQuoteStatus, formatSyncState } from "../lib/format";
import { getJSON, setJSON, storageKeys } from "../lib/storage";
import { useQueueStore, useStopActivityStore, useUIStore } from "../state";
import type { Quote, QuoteLineItem, QuoteStatus } from "../types";

const STATUS_OPTIONS: { label: string; value: QuoteStatus }[] = [
  { label: "Draft", value: "draft" },
  { label: "Estimated", value: "estimated" },
  { label: "Booked", value: "booked" }
];

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function centsFromDollarsInput(s: string): number {
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function dollarsFromCents(c: number): string {
  return (c / 100).toFixed(2);
}

export function QuoteBuilderScreen({ route, navigation }: any) {
  const { clusterId, stopId, quoteId } = route.params as { clusterId: string; stopId: string; quoteId?: string };

  const ui = useUIStore();
  const queue = useQueueStore();
  const stopActivity = useStopActivityStore();

  const draftsQ = useQuery({
    queryKey: ["quote_drafts", stopId],
    queryFn: async () => (await getJSON<Quote[]>(storageKeys.quoteDraftsForStop(stopId))) ?? [],
    staleTime: Infinity
  });

  const existing = useMemo(() => {
    if (!quoteId) return null;
    return (draftsQ.data ?? []).find((q) => q.id === quoteId || q.clientWriteId === quoteId) ?? null;
  }, [draftsQ.data, quoteId]);

  const [clientWriteId, setClientWriteId] = useState<string>(existing?.clientWriteId ?? uid("qwrite"));
  const [status, setStatus] = useState<QuoteStatus>(existing?.status ?? "draft");
  const [basePrice, setBasePrice] = useState<string>(existing ? dollarsFromCents(existing.basePriceCents) : "");
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");
  const [items, setItems] = useState<QuoteLineItem[]>(existing?.lineItems ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setClientWriteId(existing.clientWriteId);
      setStatus(existing.status);
      setBasePrice(dollarsFromCents(existing.basePriceCents));
      setNotes(existing.notes ?? "");
      setItems(existing.lineItems ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.clientWriteId]);

  const baseCents = centsFromDollarsInput(basePrice);
  const itemsTotal = items.reduce((a, it) => a + (it.amountCents ?? 0), 0);
  const totalCents = baseCents + itemsTotal;

  function addItem() {
    setItems((prev) => [...prev, { id: uid("li"), label: "Adjustment", amountCents: 0 }]);
  }

  function updateItem(id: string, patch: Partial<QuoteLineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function saveQuote() {
    if (saving) return;
    setSaving(true);

    const payload = {
      clientWriteId,
      clusterId,
      stopId,
      status,
      basePriceCents: baseCents,
      lineItems: items.map((it) => ({ ...it, amountCents: it.amountCents ?? 0 })),
      notes: notes.trim() ? notes.trim() : null,
      totalCents
    };

    stopActivity.recordQuotePending({ stopId, clusterId, status });

    try {
      if (ui.isOnline) {
        try {
          const saved = await api.upsertQuote(payload);
          stopActivity.recordQuoteSynced(saved);
          await upsertDraftCache(saved);
        } catch {
          queue.enqueue("upsert_quote", payload);
          await upsertDraftCache({
            id: clientWriteId,
            clientWriteId,
            clusterId,
            stopId,
            status,
            basePriceCents: baseCents,
            lineItems: payload.lineItems,
            notes: payload.notes,
            totalCents,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        queue.enqueue("upsert_quote", payload);
        await upsertDraftCache({
          id: clientWriteId,
          clientWriteId,
          clusterId,
          stopId,
          status,
          basePriceCents: baseCents,
          lineItems: payload.lineItems,
          notes: payload.notes,
          totalCents,
          updatedAt: new Date().toISOString()
        });
      }

      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  async function upsertDraftCache(q: Quote) {
    const prev = (await getJSON<Quote[]>(storageKeys.quoteDraftsForStop(stopId))) ?? [];
    const idx = prev.findIndex((x) => x.clientWriteId === q.clientWriteId);
    const next = idx >= 0 ? prev.map((x) => (x.clientWriteId === q.clientWriteId ? q : x)) : [q, ...prev];
    await setJSON(storageKeys.quoteDraftsForStop(stopId), next.slice(0, 25));
  }

  return (
    <ScrollScreen>
      {!ui.isOnline && <Banner tone="warning" text="Offline: quote will sync when online." />}

      <Card style={{ marginBottom: theme.space(2) }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>Quote Builder</Text>
        <Text style={{ marginTop: 6, color: theme.colors.muted }}>Stop: {stopId}</Text>
        {(stopActivity.byStopId[stopId]?.quoteSyncState || stopActivity.byStopId[stopId]?.lastQuoteStatus) ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {stopActivity.byStopId[stopId]?.quoteSyncState ? (
              <Chip label={formatSyncState(stopActivity.byStopId[stopId]?.quoteSyncState)} active={stopActivity.byStopId[stopId]?.quoteSyncState !== "synced"} />
            ) : null}
            {stopActivity.byStopId[stopId]?.lastQuoteStatus ? <Chip label={formatQuoteStatus(stopActivity.byStopId[stopId]?.lastQuoteStatus)} /> : null}
          </View>
        ) : null}
      </Card>

      <Card style={{ marginBottom: theme.space(2) }}>
        <SelectField label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Input label="Base price ($)" value={basePrice} onChangeText={setBasePrice} placeholder="0.00" />

        <View style={{ marginTop: 6 }}>
          <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>Adjustments</Text>

          {items.length === 0 ? (
            <Text style={{ marginTop: 8, color: theme.colors.muted }}>No adjustments yet.</Text>
          ) : (
            <View style={{ marginTop: 10, gap: 12 }}>
              {items.map((it) => (
                <View key={it.id} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.space(1.5) }}>
                  <Input label="Label" value={it.label} onChangeText={(t) => updateItem(it.id, { label: t })} placeholder="Adjustment" />
                  <Input
                    label="Amount ($)"
                    value={dollarsFromCents(it.amountCents)}
                    onChangeText={(t) => updateItem(it.id, { amountCents: centsFromDollarsInput(t) })}
                    placeholder="0.00"
                  />
                  <Button title="Remove" variant="danger" onPress={() => removeItem(it.id)} />
                </View>
              ))}
            </View>
          )}

          <View style={{ marginTop: theme.space(1) }}>
            <Button title="Add adjustment" variant="secondary" onPress={addItem} />
          </View>
        </View>

        <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional…" multiline numberOfLines={4} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.space(2) }}>
          <Text style={{ fontWeight: "900", color: theme.colors.text }}>Total</Text>
          <Text style={{ fontWeight: "900", color: theme.colors.text, fontSize: 18 }}>${dollarsFromCents(totalCents)}</Text>
        </View>

        <Button title={saving ? "Saving…" : "Save Quote"} onPress={saveQuote} loading={saving} />
      </Card>

      {draftsQ.data && draftsQ.data.length > 0 ? (
        <Card>
          <Text style={{ fontWeight: "900", color: theme.colors.text }}>Recent drafts</Text>
          <Text style={{ marginTop: 6, color: theme.colors.muted }}>
            Quick access for this stop (local cache).
          </Text>
          <View style={{ marginTop: theme.space(1) }}>
            {draftsQ.data.slice(0, 5).map((d, idx) => (
              <Pressable
                key={d.clientWriteId}
                onPress={() => navigation.setParams({ quoteId: d.clientWriteId })}
                style={{ paddingVertical: 12, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: theme.colors.border }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>{formatQuoteStatus(d.status).toUpperCase()}</Text>
                    <Text style={{ marginTop: 4, color: theme.colors.text, fontWeight: "900" }}>${dollarsFromCents(d.totalCents)}</Text>
                    <Text style={{ marginTop: 2, color: theme.colors.muted, fontWeight: "700" }}>{formatDateTime(d.updatedAt)}</Text>
                  </View>
                  {stopActivity.byStopId[stopId]?.quoteSyncState ? (
                    <Chip label={formatSyncState(stopActivity.byStopId[stopId]?.quoteSyncState)} active={stopActivity.byStopId[stopId]?.quoteSyncState !== "synced"} />
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollScreen>
  );
}
