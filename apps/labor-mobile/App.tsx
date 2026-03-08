import React, { useEffect } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RootNavigator } from "./src/navigation";
import { SyncBanner } from "./src/components/SyncBanner";
import { useAuthStore } from "./src/state/auth";
import { registerForPushNotifications } from "./src/lib/notifications";
import { theme } from "./src/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const msg = (error as Error)?.message ?? "";
        if (msg.includes("401") || msg.includes("JWT")) return false;
        return failureCount < 2;
      },
      staleTime: 20_000
    }
  }
});

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap().catch((e) => {
      console.error("[app] bootstrap failed", (e as Error)?.message ?? e);
    });
  }, [bootstrap]);

  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (status === "authenticated" && userId) {
      registerForPushNotifications(userId).catch(() => {});
    }
  }, [status, userId]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <SyncBanner />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="dark" />
        </View>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
