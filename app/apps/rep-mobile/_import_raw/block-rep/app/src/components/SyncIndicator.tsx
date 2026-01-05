import React, {useEffect, useState} from 'react';
import {View, StyleSheet, ActivityIndicator, Text} from 'react-native';
import {offlineSyncService} from '../services/offlineSync';
import {useOfflineStore} from '../store';
import Icon from 'react-native-vector-icons/MaterialIcons';

export const SyncIndicator: React.FC = () => {
  const {isOnline} = useOfflineStore();
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const updateSyncStatus = async () => {
      const count = await offlineSyncService.getUnsyncedCount();
      setUnsyncedCount(count);
    };

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (!isOnline) {
      return <Icon name="cloud-off" size={20} color="#FF3B30" />;
    }
    
    if (isSyncing) {
      return <ActivityIndicator size={20} color="#007AFF" />;
    }
    
    if (unsyncedCount > 0) {
      return <Icon name="cloud-upload" size={20} color="#FF9500" />;
    }
    
    return <Icon name="cloud-done" size={20} color="#34C759" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (unsyncedCount > 0) return `${unsyncedCount} pending`;
    return 'Synced';
  };

  return (
    <View style={styles.container}>
      {getStatusIcon()}
      <Text style={styles.text}>{getStatusText()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  text: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
});