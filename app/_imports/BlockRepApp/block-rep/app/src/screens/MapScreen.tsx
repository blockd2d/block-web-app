import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import Mapbox, {
  MapView,
  Camera,
  ShapeSource,
  FillLayer,
  LineLayer,
  CircleLayer,
  SymbolLayer,
  UserLocation,
  Images,
} from '@rnmapbox/maps';
import {BottomSheet} from 'react-native-elements';
import {useFocusEffect} from '@react-navigation/native';

// Services
import {supabase} from '../services/supabase';
import {locationService} from '../services/location';

// Store
import {
  useAuthStore,
  useMapStore,
  useLocationStore,
  useRepStore,
  useRouteStore,
} from '../store';

// Components
import {ClusterInfoSheet} from '../components/ClusterInfoSheet';

// Types
import {Cluster, Property} from '../types';
import Config from 'react-native-config';

Mapbox.setAccessToken(Config.MAPBOX_ACCESS_TOKEN || '');
Mapbox.setConnected(true);

const MapScreen: React.FC = () => {
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);
  const {user} = useAuthStore();
  const {clusters, properties, selectedCluster, setClusters, setProperties, setSelectedCluster} = useMapStore();
  const {currentLocation, setCurrentLocation} = useLocationStore();
  const {rep} = useRepStore();
  const {setActiveRoute} = useRouteStore();
  const [isLoading, setIsLoading] = useState(false);
  const [cameraFollowUser, setCameraFollowUser] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(12);

  useFocusEffect(
    useCallback(() => {
      loadMapData();
      startLocationTracking();
      return () => {
        // Cleanup when screen loses focus
      };
    }, []),
  );

  const startLocationTracking = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
      
      if (cameraFollowUser && cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [location.lng, location.lat],
          zoomLevel: 16,
          animationDuration: 1000,
        });
      }
    } catch (error) {
      console.error('[Map] Error getting location:', error);
    }
  };

  const loadMapData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load assigned clusters
      const {data: clustersData, error: clustersError} = await supabase
        .from('clusters')
        .select(`*, properties:cluster_properties(property_id)`)
        .or(`assigned_rep_id.eq.${user.id},status.eq.unassigned`)
        .order('created_at');

      if (clustersError) throw clustersError;

      // Load properties for assigned clusters
      const clusterIds = clustersData?.map(c => c.id) || [];
      if (clusterIds.length > 0) {
        const {data: propertiesData, error: propertiesError} = await supabase
          .from('properties')
          .select('*')
          .in('cluster_id', clusterIds)
          .eq('do_not_knock', false);

        if (propertiesError) throw propertiesError;
        setProperties(propertiesData || []);
      }

      setClusters(clustersData || []);
    } catch (error) {
      console.error('[Map] Error loading data:', error);
      Alert.alert('Error', 'Failed to load map data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClusterPress = (cluster: Cluster) => {
    setSelectedCluster(cluster);
    
    // Center camera on cluster
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [cluster.center_lng, cluster.center_lat],
        zoomLevel: 15,
        animationDuration: 1000,
      });
    }
  };

  const handlePropertyPress = (property: Property) => {
    // Navigate to house detail
    // This would use navigation from props in a real implementation
    console.log('[Map] Property pressed:', property.address);
  };

  const startRoute = async (cluster: Cluster) => {
    try {
      // Get properties for this cluster
      const clusterProperties = properties.filter(p => p.cluster_id === cluster.id);
      
      if (clusterProperties.length === 0) {
        Alert.alert('No Properties', 'This cluster has no properties available');
        return;
      }

      // Create route
      const route = {
        id: `route-${Date.now()}`,
        cluster_id: cluster.id,
        rep_id: user?.id || '',
        stops: clusterProperties.map((property, index) => ({
          property_id: property.id,
          address: property.address,
          lat: property.lat,
          lng: property.lng,
          order_index: index,
          visited: false,
        })),
        status: 'active' as const,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setActiveRoute(route);
      
      // Navigate to route screen
      // This would use navigation from props
      
      // Close bottom sheet
      setSelectedCluster(null);
      
    } catch (error) {
      console.error('[Map] Error starting route:', error);
      Alert.alert('Error', 'Failed to start route');
    }
  };

  const onRegionDidChange = (region: any) => {
    setZoomLevel(region.properties.zoomLevel);
    
    // Check which cluster the user is in
    if (currentLocation && rep) {
      const inCluster = clusters.find(cluster => 
        isPointInPolygon(
          currentLocation.lat,
          currentLocation.lng,
          cluster.polygon_coords,
        ),
      );
      
      if (inCluster && inCluster.id !== rep.current_cluster_id) {
        // Update rep's current cluster
        supabase
          .from('reps')
          .update({current_cluster_id: inCluster.id})
          .eq('id', rep.id);
      }
    }
  };

  const isPointInPolygon = (lat: number, lng: number, polygon: any[]) => {
    // Ray casting algorithm for point in polygon
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng;
      const xj = polygon[j].lat, yj = polygon[j].lng;
      
      const intersect = ((yi > lng) !== (yj > lng))
          && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Prepare data for Mapbox
  const clusterFeatures = clusters.map(cluster => ({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [cluster.polygon_coords.map(coord => [coord.lng, coord.lat])],
    },
    properties: {
      id: cluster.id,
      name: cluster.name,
      color: cluster.color,
      status: cluster.status,
      totalProperties: cluster.total_properties,
      completedDoors: cluster.completed_doors,
    },
  }));

  const propertyFeatures = properties.map(property => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [property.lng, property.lat],
    },
    properties: {
      id: property.id,
      address: property.address,
      lastOutcome: property.last_outcome,
      visitCount: property.visit_count,
    },
  }));

  const showPropertyPins = zoomLevel >= 14;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        onRegionDidChange={onRegionDidChange}
        logoEnabled={false}
        attributionEnabled={false}>
        
        <Camera
          ref={cameraRef}
          followUserLocation={cameraFollowUser}
          followUserMode="normal"
          zoomLevel={zoomLevel}
        />

        <UserLocation
          androidRenderMode="normal"
          iosShowsUserHeadingIndicator
          onUpdate={(location: any) => {
            if (location) {
              setCurrentLocation({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                accuracy: location.coords.accuracy,
                timestamp: location.timestamp,
              });
            }
          }}
        />

        {/* Cluster polygons */}
        <ShapeSource
          id="clusters"
          shape={{type: 'FeatureCollection', features: clusterFeatures}}>
          <FillLayer
            id="clusterFill"
            style={{
              fillColor: ['get', 'color'],
              fillOpacity: 0.2,
            }}
          />
          <LineLayer
            id="clusterOutline"
            style={{
              lineColor: ['get', 'color'],
              lineWidth: 2,
              lineOpacity: 0.8,
            }}
          />
        </ShapeSource>

        {/* Property pins - only show when zoomed in */}
        {showPropertyPins && (
          <ShapeSource
            id="properties"
            shape={{type: 'FeatureCollection', features: propertyFeatures}}>
            <CircleLayer
              id="propertyPins"
              style={{
                circleRadius: 8,
                circleColor: '#007AFF',
                circleStrokeColor: '#FFFFFF',
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {/* Location button */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={() => {
          setCameraFollowUser(true);
          if (currentLocation && cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: [currentLocation.lng, currentLocation.lat],
              zoomLevel: 16,
              animationDuration: 1000,
            });
          }
        }}>
        <Icon name="my-location" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* Cluster info bottom sheet */}
      <BottomSheet
        isVisible={!!selectedCluster}
        containerStyle={styles.bottomSheet}>
        {selectedCluster && (
          <ClusterInfoSheet
            cluster={selectedCluster}
            onStartRoute={() => startRoute(selectedCluster)}
            onClose={() => setSelectedCluster(null)}
          />
        )}
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomSheet: {
    backgroundColor: 'transparent',
  },
});

export default MapScreen;