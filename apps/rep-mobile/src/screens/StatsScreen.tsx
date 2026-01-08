import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { blockApi } from '../services/blockApi';

type Summary = {
  interactions: number;
  sales: number;
  jobs_completed: number;
  payments_collected: number;
};

type LeaderboardRow = { rep_id: string; name: string; score: number };

const ranges = ['week', 'month', 'all'] as const;
type Range = (typeof ranges)[number];

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.card}>
    <Text style={styles.cardLabel}>{label}</Text>
    <Text style={styles.cardValue}>{value}</Text>
  </View>
);

const StatsScreen: React.FC<any> = () => {
  const [range, setRange] = useState<Range>('week');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await blockApi.get(`/v1/analytics/summary?range=${range}`);
      setSummary(s.summary || null);
      const lb = await blockApi.get(`/v1/analytics/leaderboard?range=${range}`);
      setLeaderboard(lb.leaderboard || []);
    } catch (e: any) {
      Alert.alert('Stats', e?.message || 'Unable to load stats.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const xp = useMemo(() => {
    // Simple MVP scoring: interactions = 1, sales = 10
    if (!summary) return 0;
    return summary.interactions * 1 + summary.sales * 10;
  }, [summary]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading stats…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.sub}>Track your activity and see the team leaderboard.</Text>

      <View style={styles.rangeRow}>
        {ranges.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.rangePill, r === range && styles.rangePillActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeText, r === range && styles.rangeTextActive]}>{r.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <StatCard label="Doors (Interactions)" value={summary?.interactions || 0} />
        <StatCard label="Sales" value={summary?.sales || 0} />
        <StatCard label="Jobs Completed" value={summary?.jobs_completed || 0} />
        <StatCard label="Payments Collected" value={summary?.payments_collected || 0} />
      </View>

      <View style={styles.xpBox}>
        <Text style={styles.xpTitle}>XP</Text>
        <Text style={styles.xpValue}>{xp}</Text>
        <Text style={styles.xpSub}>MVP scoring: 1 per interaction, 10 per sale.</Text>
      </View>

      <Text style={styles.sectionTitle}>Leaderboard</Text>
      {leaderboard.length === 0 ? (
        <Text style={styles.muted}>No leaderboard data yet.</Text>
      ) : (
        <View style={styles.table}>
          {leaderboard.map((row, idx) => (
            <View key={row.rep_id} style={styles.tableRow}>
              <Text style={styles.rank}>{idx + 1}</Text>
              <Text style={styles.name}>{row.name}</Text>
              <Text style={styles.score}>{row.score}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '900', color: '#111' },
  sub: { color: '#4b5563', marginTop: 6, marginBottom: 14 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rangePill: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#f3f4f6' },
  rangePillActive: { backgroundColor: '#111' },
  rangeText: { fontWeight: '800', color: '#111', fontSize: 12 },
  rangeTextActive: { color: '#fff' },
  refreshBtn: { marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#2b7cff' },
  refreshText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 12 },
  cardLabel: { color: '#6b7280', fontWeight: '800' },
  cardValue: { marginTop: 6, fontSize: 22, fontWeight: '900', color: '#111' },
  xpBox: { marginTop: 14, borderRadius: 16, padding: 14, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  xpTitle: { color: '#1d4ed8', fontWeight: '900' },
  xpValue: { fontSize: 30, fontWeight: '900', color: '#1e3a8a', marginTop: 4 },
  xpSub: { marginTop: 6, color: '#1e40af' },
  sectionTitle: { marginTop: 16, fontSize: 16, fontWeight: '900', color: '#111' },
  muted: { color: '#6b7280', marginTop: 8 },
  table: { marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rank: { width: 24, fontWeight: '900', color: '#111' },
  name: { flex: 1, fontWeight: '800', color: '#111' },
  score: { fontWeight: '900', color: '#111' }
});

export default StatsScreen;
