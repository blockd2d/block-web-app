import React, {useState} from 'react';
import {TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator} from 'react-native';
import {useRepStore, useAuthStore} from '../store';
import {supabase} from '../services/supabase';
import {locationService} from '../services/location';

export const ClockInButton: React.FC = () => {
  const {rep, isClockedIn, setClockedIn} = useRepStore();
  const {user} = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleClockInOut = async () => {
    if (!user || !rep) return;

    setLoading(true);
    try {
      if (!isClockedIn) {
        // Clock in
        const now = new Date().toISOString();
        const location = await locationService.getCurrentLocation();
        
        const {error} = await supabase
          .from('reps')
          .update({
            is_clocked_in: true,
            clocked_in_at: now,
            last_location_lat: location.lat,
            last_location_lng: location.lng,
            last_location_updated_at: now,
          })
          .eq('id', rep.id);

        if (error) throw error;

        setClockedIn(true, now);
        await locationService.startTracking();
        
        Alert.alert('Clocked In', 'You are now clocked in and location tracking is active.');
      } else {
        // Clock out
        const {error} = await supabase
          .from('reps')
          .update({
            is_clocked_in: false,
            current_cluster_id: null,
          })
          .eq('id', rep.id);

        if (error) throw error;

        setClockedIn(false);
        await locationService.stopTracking();
        
        Alert.alert('Clocked Out', 'You are now clocked out.');
      }
    } catch (error) {
      console.error('Clock in/out error:', error);
      Alert.alert('Error', 'Failed to update clock status');
    } finally {
      setLoading(false);
    }
  };

  if (!rep) return null;

  return (
    <TouchableOpacity
      style={[styles.button, isClockedIn && styles.clockedInButton]}
      onPress={handleClockInOut}
      disabled={loading}>
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={[styles.buttonText, isClockedIn && styles.clockedInText]}>
          {isClockedIn ? 'Clock Out' : 'Clock In'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  clockedInButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  clockedInText: {
    color: '#FFFFFF',
  },
});