import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { useMapStore, useRepStore } from '../store';
import { Cluster, Property } from '../types';
import { blockApi } from '../services/blockApi';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Config = require('react-native-config');

Mapbox.setAccessToken(Config.MAPBOX_ACCESS_TOKEN || '');

const MapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { clusters, properties, selectedCluster, setClusters, setProperties, setSelectedCluster } = useMapStore();
  const { rep } = useRepStore();
  const [loading, setLoading] = useState(true);

  const loadClusters = async () => {
    setLoading(true);
    try {
      const res = await blockApi.get('/v1/reps/me/clusters');
      setClusters((res.clusters ?? []) as Cluster[]);
    } catch (e) {
      console.error('Failed to load clusters', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPropertiesForCluster = async (clusterId: string) => {
    try {
      const res = await blockApi.get(`/v1/clusters/${clusterId}/properties`);
      setProperties((res.properties ?? []) as Property[]);
    } catch (e) {
      console.error('Failed to load properties for cluster', e);
      setProperties([]);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  useEffect(() => {
    if (selectedCluster) {
      loadPropertiesForCluster(selectedCluster.id);
    } else {
      setProperties([]);
    }
  }, [selectedCluster?.id]);

  const clusterFeatures = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: clusters
        .filter(c => c.hull_geojson)
        .map(c => ({
          type: 'Feature',
          geometry: c.hull_geojson,
          properties: {
            id: c.id,
            color: c.color || '#5b8cff',
            count: c.stats_json?.size || c.stats_json?.count || 0
          }
        }))
    } as any;
  }, [clusters]);

  const pointsFC = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: properties
        .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
        .map(p => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [p.lng, p.lat]
          },
          properties: {
            id: p.id,
            address: p.address1 || 'Property'
          }
        }))
    } as any;
  }, [properties]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading territories…</Text>
      </View>
    );
  }

  const initialCenter = rep?.home_lat && rep?.home_lng ? [rep.home_lng, rep.home_lat] : [-86.1581, 39.7684];

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
        <Mapbox.Camera zoomLevel={11} centerCoordinate={initialCenter} animationDuration={0} />

        <Mapbox.ShapeSource
          id="clusters"
          shape={clusterFeatures}
          onPress={(e: any) => {
            const f = e.features?.[0];
            if (!f) return;
            const id = f.properties?.id as string;
            const found = clusters.find(c => c.id === id);
            if (found) setSelectedCluster(found);
          }}
        >
          <Mapbox.FillLayer
            id="cluster-fill"
            style={{
              fillOpacity: 0.25,
              fillColor: ['get', 'color']
            }}
          />
          <Mapbox.LineLayer
            id="cluster-outline"
            style={{
              lineWidth: 2,
              lineColor: ['get', 'color'],
              lineOpacity: 0.9
            }}
          />
        </Mapbox.ShapeSource>

        {selectedCluster ? (
          <Mapbox.ShapeSource
            id="properties"
            shape={pointsFC}
            onPress={(e: any) => {
              const f = e.features?.[0];
              if (!f) return;
              navigation.navigate('HouseDetail', { propertyId: f.properties?.id });
            }}
          >
            <Mapbox.CircleLayer id="property-points" style={{ circleRadius: 4, circleOpacity: 0.85 }} />
          </Mapbox.ShapeSource>
        ) : null}
      </Mapbox.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});

export default MapScreen;
