import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { api } from '../api';

type Block = { day_of_week: number; start_time: string; end_time: string; timezone?: string };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function normalizeTime(t: string) {
  if (!t) return '';
  // Accept HH:MM or HH:MM:SS
  const m = /^\d{2}:\d{2}/.exec(t);
  return m ? m[0] : t;
}

export function AvailabilityScreen() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [timeOff, setTimeOff] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [newStart, setNewStart] = useState('2026-01-06T09:00:00Z');
  const [newEnd, setNewEnd] = useState('2026-01-06T17:00:00Z');
  const [newReason, setNewReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const model = useMemo(() => {
    const byDay: Record<number, Block> = {};
    for (const b of blocks) byDay[b.day_of_week] = b;
    return DAYS.map((label, day) => ({
      label,
      day,
      enabled: !!byDay[day],
      start: byDay[day] ? normalizeTime(byDay[day].start_time) : '09:00',
      end: byDay[day] ? normalizeTime(byDay[day].end_time) : '17:00'
    }));
  }, [blocks]);

  const load = async () => {
    const a = await api.getAvailability();
    setBlocks((a.blocks || []) as Block[]);
    const t = await api.getTimeOff();
    setTimeOff(t.items || []);
  };

  useEffect(() => {
    load().catch((e) => setMsg(e?.message || 'Failed to load'));
  }, []);

  const updateDay = (day: number, patch: Partial<{ enabled: boolean; start: string; end: string }>) => {
    setBlocks((prev) => {
      const existing = prev.find((b) => b.day_of_week === day);
      const enabled = patch.enabled ?? !!existing;
      const start = patch.start ?? (existing ? normalizeTime(existing.start_time) : '09:00');
      const end = patch.end ?? (existing ? normalizeTime(existing.end_time) : '17:00');
      const next = prev.filter((b) => b.day_of_week !== day);
      if (!enabled) return next;
      next.push({ day_of_week: day, start_time: `${start}:00`, end_time: `${end}:00` });
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.setAvailability(blocks);
      setMsg('Saved');
    } catch (e: any) {
      setMsg(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addTimeOff = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.addTimeOff(newStart, newEnd, newReason || undefined);
      await load();
      setMsg('Time off added');
    } catch (e: any) {
      setMsg(e?.message || 'Add failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteTimeOff = async (id: string) => {
    setSaving(true);
    setMsg(null);
    try {
      await api.deleteTimeOff(id);
      await load();
      setMsg('Removed');
    } catch (e: any) {
      setMsg(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Availability</Text>
      <Text style={{ marginTop: 6, opacity: 0.7 }}>Set weekly hours and time off. Use 24-hour time (HH:MM).</Text>

      {msg ? <Text style={{ marginTop: 10, opacity: 0.8 }}>{msg}</Text> : null}

      <View style={{ marginTop: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 16, overflow: 'hidden' }}>
        {model.map((d, idx) => (
          <View
            key={d.day}
            style={{
              padding: 12,
              borderTopWidth: idx === 0 ? 0 : 1,
              borderTopColor: '#f0f0f0',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{d.label}</Text>
              {d.enabled ? (
                <Text style={{ marginTop: 4, opacity: 0.7 }}>{d.start}–{d.end}</Text>
              ) : (
                <Text style={{ marginTop: 4, opacity: 0.6 }}>Off</Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {d.enabled ? (
                <>
                  <TextInput
                    value={d.start}
                    onChangeText={(v) => updateDay(d.day, { start: v })}
                    style={{ width: 64, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 }}
                  />
                  <TextInput
                    value={d.end}
                    onChangeText={(v) => updateDay(d.day, { end: v })}
                    style={{ width: 64, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 }}
                  />
                </>
              ) : null}
              <Pressable
                onPress={() => updateDay(d.day, { enabled: !d.enabled })}
                style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' }}
              >
                <Text style={{ fontWeight: '600' }}>{d.enabled ? 'Disable' : 'Enable'}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={save}
        disabled={saving}
        style={{ marginTop: 12, backgroundColor: '#111', padding: 12, borderRadius: 14, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save weekly hours'}</Text>
      </Pressable>

      <View style={{ marginTop: 28 }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Time off</Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>Add a time-off range using ISO timestamps.</Text>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Start (ISO)</Text>
          <TextInput value={newStart} onChangeText={setNewStart} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 10 }} />
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>End (ISO)</Text>
          <TextInput value={newEnd} onChangeText={setNewEnd} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 10 }} />
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Reason (optional)</Text>
          <TextInput value={newReason} onChangeText={setNewReason} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 10 }} />
        </View>

        <Pressable
          onPress={addTimeOff}
          disabled={saving}
          style={{ marginTop: 12, borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 14, alignItems: 'center', opacity: saving ? 0.7 : 1 }}
        >
          <Text style={{ fontWeight: '700' }}>{saving ? 'Working…' : 'Add time off'}</Text>
        </Pressable>

        <View style={{ marginTop: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 16, overflow: 'hidden' }}>
          {(timeOff || []).map((t, idx) => (
            <View key={t.id} style={{ padding: 12, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#f0f0f0' }}>
              <Text style={{ fontWeight: '700' }}>{new Date(t.start_at).toLocaleString()} → {new Date(t.end_at).toLocaleString()}</Text>
              {t.reason ? <Text style={{ marginTop: 4, opacity: 0.7 }}>{t.reason}</Text> : null}
              <Pressable onPress={() => deleteTimeOff(t.id)} style={{ marginTop: 8 }}>
                <Text style={{ color: '#b00020', fontWeight: '600' }}>Remove</Text>
              </Pressable>
            </View>
          ))}
          {(!timeOff || timeOff.length === 0) ? (
            <View style={{ padding: 12 }}>
              <Text style={{ opacity: 0.7 }}>No time off scheduled.</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
