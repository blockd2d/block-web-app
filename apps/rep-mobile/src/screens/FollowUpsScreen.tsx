import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { blockApi } from '../services/blockApi';

type Followup = {
  id: string;
  property_id: string;
  rep_id: string;
  due_at: string;
  status: 'open' | 'done' | 'snoozed' | string;
  notes: string | null;
  property?: {
    address1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
};

type Section = { title: string; data: Followup[] };

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const FollowUpsScreen: React.FC<any> = ({ navigation }) => {
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await blockApi.get('/v1/followups?status=open&limit=200');
      setItems(res.followups || []);
    } catch (e: any) {
      Alert.alert('Follow-ups', e?.message || 'Unable to load follow-ups.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    const byDay = new Map<string, Followup[]>();
    for (const f of items) {
      const d = new Date(f.due_at);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      byDay.set(key, [...(byDay.get(key) || []), f]);
    }
    const arr = [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, data]) => {
        data.sort((a, b) => (a.due_at < b.due_at ? -1 : 1));
        return { title: fmtDate(new Date(key)), data } as Section;
      });
    return arr;
  }, [items]);

  const markDone = useCallback(
    async (id: string) => {
      try {
        await blockApi.put(`/v1/followups/${id}`, { status: 'done' });
        setItems(prev => prev.filter(f => f.id !== id));
      } catch (e: any) {
        Alert.alert('Update failed', e?.message || 'Could not mark follow-up as done.');
      }
    },
    [setItems]
  );

  const openHouse = useCallback(
    (propertyId: string) => {
      navigation.navigate('HouseDetail', { propertyId });
    },
    [navigation]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await blockApi.get('/v1/followups?status=open&limit=200');
      setItems(res.followups || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading follow-ups…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Follow-ups</Text>
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySub}>No follow-ups due right now.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const d = new Date(item.due_at);
            const address = item.property?.address1
              ? `${item.property.address1}, ${item.property.city || ''} ${item.property.state || ''} ${item.property.zip || ''}`.trim()
              : `Property ${item.property_id}`;
            return (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{address}</Text>
                  <Text style={styles.cardSub}>{fmtTime(d)} • {item.notes || 'No notes'}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => openHouse(item.property_id)}>
                    <Text style={styles.secondaryText}>Open</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => markDone(item.id)}>
                    <Text style={styles.primaryText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 10, color: '#111' },
  sectionHeader: { marginTop: 14, marginBottom: 8, fontSize: 14, fontWeight: '800', color: '#374151' },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  cardTitle: { fontWeight: '800', color: '#111' },
  cardSub: { color: '#6b7280', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  primaryBtn: { backgroundColor: '#2b7cff', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { backgroundColor: '#f3f4f6', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  secondaryText: { color: '#111', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { color: '#6b7280', marginTop: 4 }
});

export default FollowUpsScreen;
