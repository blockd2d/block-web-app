import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRepStore } from '../store';
import { locationService } from '../services/location';
import { blockApi } from '../services/blockApi';
import { offlineSyncService } from '../services/offlineSync';

/**
 * Clock-in/out controls for reps.
 *
 * V7 note: we DO NOT talk directly to Supabase from the client.
 * Clock state is represented by the rep app + `rep_locations.clocked_in` updates sent to the Railway API.
 */
const ClockInButton: React.FC = () => {
  const { isClockedIn, setClockedIn } = useRepStore();
  const [busy, setBusy] = useState(false);

  const label = useMemo(() => {
    if (busy) return '…';
    return isClockedIn ? 'Clock Out' : 'Clock In';
  }, [busy, isClockedIn]);

  const sendClockEvent = useCallback(
    async (clockedIn: boolean) => {
      try {
        const loc = await locationService.getCurrentLocation();
        await blockApi.post('/v1/reps/me/location', {
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speed ?? null,
          heading: loc.heading ?? null,
          clocked_in: clockedIn,
          recorded_at: new Date(loc.timestamp).toISOString()
        });
      } catch (e) {
        // Offline or GPS failure: best-effort queue.
        try {
          const now = new Date().toISOString();
          offlineSyncService.queueItem({
            type: 'location_update',
            data: {
              lat: null,
              lng: null,
              speed: null,
              heading: null,
              clocked_in: clockedIn,
              recorded_at: now
            },
            timestamp: Date.now()
          } as any);
        } catch {
          // ignore
        }
      }
    },
    []
  );

  const onPress = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!isClockedIn) {
        setClockedIn(true, new Date().toISOString());
        await locationService.startTracking();
        await sendClockEvent(true);
      } else {
        setClockedIn(false, null);
        await sendClockEvent(false);
        await locationService.stopTracking();
      }
    } catch (e: any) {
      Alert.alert('Clock Error', e?.message || 'Unable to update clock status.');
    } finally {
      setBusy(false);
    }
  }, [busy, isClockedIn, sendClockEvent, setClockedIn]);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, isClockedIn ? styles.clockedIn : styles.clockedOut, busy && styles.disabled]}
      disabled={busy}
      accessibilityRole="button"
    >
      <View style={styles.inner}>
        <Text style={styles.text}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140
  },
  inner: { flexDirection: 'row', alignItems: 'center' },
  text: { color: '#fff', fontSize: 16, fontWeight: '700' },
  clockedIn: { backgroundColor: '#d14343' },
  clockedOut: { backgroundColor: '#2b7cff' },
  disabled: { opacity: 0.65 }
});

export default ClockInButton;
