import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Location} from '../services/location';
import {User, Rep, Cluster, Property, Route, FollowUp, Interaction} from '../types';

interface AuthState {
  user: User | null;
  profile: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: any) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

interface RepState {
  rep: Rep | null;
  isClockedIn: boolean;
  clockedInAt: string | null;
  setRep: (rep: Rep) => void;
  setClockedIn: (clockedIn: boolean, time?: string) => void;
}

interface LocationState {
  currentLocation: Location | null;
  currentClusterId: string | null;
  setCurrentLocation: (location: Location) => void;
  setCurrentClusterId: (clusterId: string | null) => void;
}

interface MapState {
  clusters: Cluster[];
  properties: Property[];
  selectedCluster: Cluster | null;
  mapZoom: number;
  setClusters: (clusters: Cluster[]) => void;
  setProperties: (properties: Property[]) => void;
  setSelectedCluster: (cluster: Cluster | null) => void;
  setMapZoom: (zoom: number) => void;
  updateCluster: (clusterId: string, updates: Partial<Cluster>) => void;
  updateProperty: (propertyId: string, updates: Partial<Property>) => void;
}

interface RouteState {
  activeRoute: Route | null;
  currentStopIndex: number;
  setActiveRoute: (route: Route | null) => void;
  setCurrentStopIndex: (index: number) => void;
  markStopVisited: (propertyId: string, outcome: string) => void;
  reorderStops: (stopIds: string[]) => void;
}

interface FollowUpState {
  followUps: FollowUp[];
  setFollowUps: (followUps: FollowUp[]) => void;
  addFollowUp: (followUp: FollowUp) => void;
  updateFollowUp: (followUpId: string, updates: Partial<FollowUp>) => void;
  removeFollowUp: (followUpId: string) => void;
}

interface StatsState {
  todayStats: any;
  xp: number;
  streak: number;
  leaderboard: any[];
  setTodayStats: (stats: any) => void;
  setXP: (xp: number) => void;
  setStreak: (streak: number) => void;
  setLeaderboard: (leaderboard: any[]) => void;
}

interface OfflineState {
  isOnline: boolean;
  syncQueue: any[];
  setOnline: (online: boolean) => void;
  setSyncQueue: (queue: any[]) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: user => set({user, isAuthenticated: !!user}),
      setProfile: profile => set({profile}),
      setLoading: loading => set({isLoading: loading}),
      logout: () => set({user: null, profile: null, isAuthenticated: false}),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useRepStore = create<RepState>()(
  persist(
    set => ({
      rep: null,
      isClockedIn: false,
      clockedInAt: null,
      setRep: rep => set({rep}),
      setClockedIn: (clockedIn, time) => set({isClockedIn: clockedIn, clockedInAt: time || null}),
    }),
    {
      name: 'rep-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useLocationStore = create<LocationState>()(set => ({
  currentLocation: null,
  currentClusterId: null,
  setCurrentLocation: location => set({currentLocation: location}),
  setCurrentClusterId: clusterId => set({currentClusterId: clusterId}),
}));

export const useMapStore = create<MapState>()(
  persist(
    set => ({
      clusters: [],
      properties: [],
      selectedCluster: null,
      mapZoom: 12,
      setClusters: clusters => set({clusters}),
      setProperties: properties => set({properties}),
      setSelectedCluster: cluster => set({selectedCluster: cluster}),
      setMapZoom: zoom => set({mapZoom: zoom}),
      updateCluster: (clusterId, updates) =>
        set(state => ({
          clusters: state.clusters.map(c =>
            c.id === clusterId ? {...c, ...updates} : c,
          ),
        })),
      updateProperty: (propertyId, updates) =>
        set(state => ({
          properties: state.properties.map(p =>
            p.id === propertyId ? {...p, ...updates} : p,
          ),
        })),
    }),
    {
      name: 'map-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useRouteStore = create<RouteState>()(
  persist(
    set => ({
      activeRoute: null,
      currentStopIndex: 0,
      setActiveRoute: route => set({activeRoute: route}),
      setCurrentStopIndex: index => set({currentStopIndex: index}),
      markStopVisited: (propertyId, outcome) =>
        set(state => {
          if (!state.activeRoute) return state;
          
          const updatedStops = state.activeRoute.stops.map(stop =>
            stop.property_id === propertyId
              ? {...stop, visited: true, outcome}
              : stop,
          );

          return {
            activeRoute: {
              ...state.activeRoute,
              stops: updatedStops,
            },
          };
        }),
      reorderStops: stopIds =>
        set(state => {
          if (!state.activeRoute) return state;

          const reorderedStops = stopIds.map((id, index) => {
            const stop = state.activeRoute!.stops.find(s => s.property_id === id);
            return stop ? {...stop, order_index: index} : null;
          }).filter(Boolean) as any[];

          return {
            activeRoute: {
              ...state.activeRoute,
              stops: reorderedStops,
            },
          };
        }),
    }),
    {
      name: 'route-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useFollowUpStore = create<FollowUpState>()(
  persist(
    set => ({
      followUps: [],
      setFollowUps: followUps => set({followUps}),
      addFollowUp: followUp =>
        set(state => ({followUps: [...state.followUps, followUp]})),
      updateFollowUp: (followUpId, updates) =>
        set(state => ({
          followUps: state.followUps.map(f =>
            f.id === followUpId ? {...f, ...updates} : f,
          ),
        })),
      removeFollowUp: followUpId =>
        set(state => ({
          followUps: state.followUps.filter(f => f.id !== followUpId),
        })),
    }),
    {
      name: 'followup-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useStatsStore = create<StatsState>()(
  persist(
    set => ({
      todayStats: null,
      xp: 0,
      streak: 0,
      leaderboard: [],
      setTodayStats: stats => set({todayStats: stats}),
      setXP: xp => set({xp}),
      setStreak: streak => set({streak}),
      setLeaderboard: leaderboard => set({leaderboard}),
    }),
    {
      name: 'stats-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useOfflineStore = create<OfflineState>()(
  persist(
    set => ({
      isOnline: true,
      syncQueue: [],
      setOnline: online => set({isOnline: online}),
      setSyncQueue: queue => set({syncQueue: queue}),
    }),
    {
      name: 'offline-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// Root store export
export const store = {
  auth: useAuthStore,
  rep: useRepStore,
  location: useLocationStore,
  map: useMapStore,
  route: useRouteStore,
  followUp: useFollowUpStore,
  stats: useStatsStore,
  offline: useOfflineStore,
};