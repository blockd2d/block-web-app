import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "cache:";

export const storageKeys = {
  clustersCache: "cache:clusters",
  clusterStops: (clusterId: string) => `cache:cluster:${clusterId}:stops`,
  clusterMap: (clusterId: string) => `cache:cluster:${clusterId}:map`,
  quoteDraftsForStop: (stopId: string) => `cache:stop:${stopId}:quotes`
};

export async function setJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}


export async function clearSalesLocalCaches(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const salesKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
  if (!salesKeys.length) return;
  await AsyncStorage.multiRemove(salesKeys);
}
