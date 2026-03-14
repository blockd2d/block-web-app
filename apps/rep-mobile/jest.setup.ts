import "react-native-gesture-handler/jestSetup";

jest.mock("expo-secure-store", () => {
  const mem = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => mem.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => {
      mem.set(k, v);
    },
    deleteItemAsync: async (k: string) => {
      mem.delete(k);
    }
  };
});

jest.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    }
  };
});


jest.mock("expo-network", () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
  addNetworkStateListener: () => ({ remove: () => {} })
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: async () => ({ status: "granted" })
}));

