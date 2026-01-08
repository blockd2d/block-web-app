import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import {useRouteStore, useMapStore} from '../store';

const RouteScreen: React.FC = () => {
  const {activeRoute, currentStopIndex, setCurrentStopIndex, reorderStops} = useRouteStore();
  const {properties, updateProperty} = useMapStore();
  const [isReordering, setIsReordering] = useState(false);
  const [nextStop, setNextStop] = useState<any>(null);

  useEffect(() => {
    if (activeRoute && activeRoute.stops.length > 0) {
      const currentStop = activeRoute.stops[currentStopIndex];
      const property = properties.find(p => p.id === currentStop.property_id);
      setNextStop({...currentStop, ...property});
    }
  }, [activeRoute, currentStopIndex, properties]);

  const handleStopPress = (stop: any, index: number) => {
    if (stop.visited) return;
    
    setCurrentStopIndex(index);
    // Navigate to house detail screen
    // navigation.navigate('HouseDetail', {propertyId: stop.property_id});
  };

  const renderStopItem = ({item, index, drag}: any) => {
    const isCurrent = index === currentStopIndex;
    const isVisited = item.visited;

    return (
      <TouchableOpacity
        style={[styles.stopItem, isCurrent && styles.currentStop, isVisited && styles.visitedStop]}
        onPress={() => handleStopPress(item, index)}
        onLongPress={drag}
        disabled={isReordering}>
        <View style={styles.stopNumber}>
          <Text style={styles.stopNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.stopInfo}>
          <Text style={[styles.address, isVisited && styles.visitedText]}>
            {item.address}
          </Text>
          {item.outcome && (
            <Text style={styles.outcomeText}>{item.outcome}</Text>
          )}
        </View>
        {isCurrent && <View style={styles.currentIndicator} />}
      </TouchableOpacity>
    );
  };

  if (!activeRoute) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active route</Text>
        <Text style={styles.emptySubtext}>
          Select a cluster from the map to start a route
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Next Stop Card */}
      {nextStop && (
        <View style={styles.nextStopCard}>
          <Text style={styles.nextStopLabel}>Next Stop</Text>
          <Text style={styles.nextStopAddress}>{nextStop.address}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                // Navigate to house detail
              }}>
              <Text style={styles.actionButtonText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => {
                // Mark as visited and move to next
              }}>
              <Text style={[styles.actionButtonText, styles.completeButtonText]}>
                Mark Complete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Route List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Route ({activeRoute.stops.length} stops)</Text>
        <TouchableOpacity
          onPress={() => setIsReordering(!isReordering)}>
          <Text style={styles.reorderButton}>
            {isReordering ? 'Done' : 'Reorder'}
          </Text>
        </TouchableOpacity>
      </View>

      <DraggableFlatList
        data={activeRoute.stops}
        renderItem={renderStopItem}
        keyExtractor={(item) => item.property_id}
        onDragEnd={({data}) => reorderStops(data.map((item: any) => item.property_id))}
        scrollPercent={5}
        disabled={!isReordering}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  nextStopCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  nextStopLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  nextStopAddress: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  completeButtonText: {
    color: '#FFFFFF',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  reorderButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  currentStop: {
    backgroundColor: '#E6F2FF',
  },
  visitedStop: {
    opacity: 0.6,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stopNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  stopInfo: {
    flex: 1,
  },
  address: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  visitedText: {
    color: '#8E8E93',
  },
  outcomeText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  currentIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
});

export default RouteScreen;