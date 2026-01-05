import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {Cluster} from '../types';

interface ClusterInfoSheetProps {
  cluster: Cluster;
  onStartRoute: () => void;
  onClose: () => void;
}

export const ClusterInfoSheet: React.FC<ClusterInfoSheetProps> = ({
  cluster,
  onStartRoute,
  onClose,
}) => {
  const completionRate = cluster.total_doors > 0 
    ? Math.round((cluster.completed_doors / cluster.total_doors) * 100)
    : 0;

  const remainingDoors = cluster.total_doors - cluster.completed_doors;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{cluster.name}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{cluster.total_properties}</Text>
          <Text style={styles.statLabel}>Properties</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{cluster.total_doors}</Text>
          <Text style={styles.statLabel}>Total Doors</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{remainingDoors}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressPercent}>{completionRate}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View 
            style={[styles.progressFill, {width: `${completionRate}%`}]} 
          />
        </View>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status: </Text>
        <Text style={[styles.statusValue, {color: getStatusColor(cluster.status)}]}>
          {cluster.status.replace('_', ' ').toUpperCase()}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.startButton} 
        onPress={onStartRoute}
        disabled={remainingDoors === 0}>
        <Text style={styles.startButtonText}>
          {remainingDoors === 0 ? 'Completed' : 'Start Route'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'assigned': return '#007AFF';
    case 'in_progress': return '#FF9500';
    case 'completed': return '#34C759';
    default: return '#8E8E93';
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#8E8E93',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#007AFF',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});