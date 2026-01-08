import Geolocation from '@react-native-community/geolocation';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { useLocationStore, useRepStore } from '../store';
import { blockApi } from './blockApi';

export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export class LocationService {
  private static instance: LocationService;
  private isTracking = false;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async initialize() {
    await BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_MEDIUM,
      distanceFilter: 25,
      stopTimeout: 5,
      debug: false,
      logLevel: BackgroundGeolocation.LOG_LEVEL_OFF,
      stopOnTerminate: false,
      startOnBoot: false,
      batchSync: false,
      autoSync: false
    });

    BackgroundGeolocation.onLocation(this.onLocation.bind(this));
  }

  private onLocation(location: any) {
    const loc: Location = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: location.timestamp
    };

    // Update zustand store
    useLocationStore.setState({ currentLocation: loc });

    const repState = useRepStore.getState();
    if (repState.isClockedIn) {
      // Fire-and-forget (background-safe) location update
      blockApi
        .post('/v1/reps/me/location', {
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speed ?? null,
          heading: loc.heading ?? null,
          clocked_in: true,
          recorded_at: new Date(loc.timestamp).toISOString()
        })
        .catch(() => {
          // If offline, the offlineSyncService can pick these up later.
        });
    }
  }

  async startTracking() {
    if (this.isTracking) return;
    this.isTracking = true;
    await BackgroundGeolocation.start();
  }

  async stopTracking() {
    if (!this.isTracking) return;
    this.isTracking = false;
    await BackgroundGeolocation.stop();
  }

  async getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            timestamp: position.timestamp
          };
          resolve(location);
        },
        error => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        }
      );
    });
  }

  watchPosition(callback: (location: Location) => void): number {
    return Geolocation.watchPosition(
      position => {
        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
          timestamp: position.timestamp
        };
        callback(location);
      },
      error => console.error('[Location] Watch error:', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 25,
        interval: 7000,
        fastestInterval: 3000
      }
    );
  }

  clearWatch(watchId: number) {
    Geolocation.clearWatch(watchId);
  }
}

export const locationService = LocationService.getInstance();
