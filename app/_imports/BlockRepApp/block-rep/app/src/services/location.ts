import Geolocation from '@react-native-community/geolocation';
import BackgroundGeolocation from 'react-native-background-geolocation';
import {supabase} from './supabase';
import {store} from '../store';
import {setCurrentLocation} from '../store/locationSlice';

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
    // Configure background geolocation
    BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10,
      stopTimeout: 5,
      debug: false,
      logLevel: BackgroundGeolocation.LOG_LEVEL_OFF,
      stopOnTerminate: false,
      startOnBoot: false,
      url: `${supabase.supabaseUrl}/functions/v1/location-update`,
      batchSync: false,
      autoSync: true,
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      params: {
        user_uid: (await supabase.auth.getUser()).data.user?.id,
      },
    });

    // Listen for location updates
    BackgroundGeolocation.onLocation(this.onLocation.bind(this));
    BackgroundGeolocation.onHttp(this.onHttp.bind(this));
  }

  private onLocation(location: any) {
    const locationData: Location = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: location.timestamp,
    };

    // Update Redux store
    store.dispatch(setCurrentLocation(locationData));

    // Save to Supabase if clocked in
    const state = store.getState();
    if (state.rep.isClockedIn) {
      this.saveLocation(locationData);
    }
  }

  private onHttp(response: any) {
    console.log('[Location] HTTP response:', response);
  }

  async startTracking() {
    if (this.isTracking) return;

    this.isTracking = true;
    await BackgroundGeolocation.start();
    console.log('[Location] Started tracking');
  }

  async stopTracking() {
    if (!this.isTracking) return;

    this.isTracking = false;
    await BackgroundGeolocation.stop();
    console.log('[Location] Stopped tracking');
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
            timestamp: position.timestamp,
          };
          resolve(location);
        },
        error => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    });
  }

  private async saveLocation(location: Location) {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const {error} = await supabase.from('rep_locations').insert({
        rep_id: user.id,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        timestamp: new Date(location.timestamp).toISOString(),
      });

      if (error) {
        console.error('[Location] Error saving location:', error);
      }
    } catch (error) {
      console.error('[Location] Error:', error);
    }
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
          timestamp: position.timestamp,
        };
        callback(location);
      },
      error => console.error('[Location] Watch error:', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
        fastestInterval: 2000,
      },
    );
  }

  clearWatch(watchId: number) {
    Geolocation.clearWatch(watchId);
  }
}

export const locationService = LocationService.getInstance();