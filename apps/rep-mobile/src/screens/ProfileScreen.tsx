import React, { useCallback } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore, useRepStore } from '../store';
import { blockApi } from '../services/blockApi';
import { phCapture, phReset } from '../analytics/posthog';

const ProfileScreen: React.FC<any> = () => {
  const { user, logout } = useAuthStore();
  const { rep } = useRepStore();

  const onLogout = useCallback(async () => {
    try {
      await blockApi.post('/v1/auth/logout', {});
    } catch {
      // ignore
    } finally {
      phCapture('rep_logout');
      phReset();
      logout();
    }
  }, [logout]);

  const openSupport = useCallback(async () => {
    try {
      await Linking.openURL('mailto:support@useblock.ai?subject=Block%20Rep%20Support');
    } catch {
      Alert.alert('Unable to open mail app');
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.kicker}>Signed in as</Text>
        <Text style={styles.value}>{user?.email || 'Unknown'}</Text>
        <Text style={styles.kicker}>Role</Text>
        <Text style={styles.value}>{user?.role || 'rep'}</Text>
        <Text style={styles.kicker}>Rep</Text>
        <Text style={styles.value}>{rep?.name || '—'}</Text>
        <Text style={styles.kicker}>Home Base</Text>
        <Text style={styles.value}>
          {rep?.home_lat != null && rep?.home_lng != null ? `${rep.home_lat.toFixed(5)}, ${rep.home_lng.toFixed(5)}` : 'Not set'}
        </Text>
      </View>

      <TouchableOpacity style={styles.secondary} onPress={openSupport}>
        <Text style={styles.secondaryText}>Contact Support</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 12 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 14 },
  kicker: { marginTop: 10, color: '#6b7280', fontWeight: '800', fontSize: 12, textTransform: 'uppercase' },
  value: { marginTop: 4, fontWeight: '900', color: '#111' },
  logout: { marginTop: 'auto', backgroundColor: '#111827', padding: 14, borderRadius: 16, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '900' },
  secondary: { marginTop: 12, backgroundColor: '#f3f4f6', padding: 14, borderRadius: 16, alignItems: 'center' },
  secondaryText: { color: '#111', fontWeight: '900' }
});

export default ProfileScreen;
