import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../state/auth';
import { offlineQueue } from '../services/offlineQueue';
import type { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Job = {
  id: string;
  sale_id: string;
  status: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'scheduled', label: 'Upcoming' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'complete', label: 'Complete' }
] as const;

export function JobsScreen() {
  const nav = useNavigation<Nav>();
  const { logout, profile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('scheduled');
  const [refreshing, setRefreshing] = useState(false);
  const [qCount, setQCount] = useState(0);

  const load = useCallback(async () => {
    const data = await api.listJobs();
    setJobs((data.jobs || []) as Job[]);
  }, []);

  const refreshQueueCount = useCallback(async () => {
    const q = await offlineQueue.list();
    setQCount(q.length);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await offlineQueue.flush();
      await load();
      await refreshQueueCount();
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshQueueCount]);

  useEffect(() => {
    load().catch(() => void 0);
    refreshQueueCount().catch(() => void 0);
  }, [load, refreshQueueCount]);

  const filtered = useMemo(() => {
    if (filter === 'all') return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const syncNow = async () => {
    await offlineQueue.flush({ max: 50 });
    await refreshQueueCount();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Jobs</Text>
        <Text style={{ marginTop: 4, opacity: 0.7 }}>Signed in as {profile?.email || 'labor'}</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: filter === f.key ? '#111' : '#ddd',
                backgroundColor: filter === f.key ? '#111' : 'transparent'
              }}
            >
              <Text style={{ color: filter === f.key ? '#fff' : '#111', fontWeight: '600' }}>{f.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <Pressable
            onPress={syncNow}
            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' }}
          >
            <Text style={{ fontWeight: '600' }}>Sync ({qCount})</Text>
          </Pressable>
          <Pressable onPress={logout} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 }}>
            <Text style={{ color: '#b00020', fontWeight: '600' }}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.navigate('JobDetail', { jobId: item.id })}
            style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
          >
            <Text style={{ fontWeight: '700' }}>Job #{item.id.slice(0, 6)}</Text>
            <Text style={{ marginTop: 6, opacity: 0.7 }}>Status: {item.status}</Text>
            {item.scheduled_start ? <Text style={{ marginTop: 4, opacity: 0.7 }}>Scheduled: {new Date(item.scheduled_start).toLocaleString()}</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ padding: 24 }}>
            <Text style={{ fontWeight: '700' }}>No jobs</Text>
            <Text style={{ marginTop: 6, opacity: 0.7 }}>If you just seeded the demo, refresh in a moment.</Text>
          </View>
        }
      />
    </View>
  );
}
