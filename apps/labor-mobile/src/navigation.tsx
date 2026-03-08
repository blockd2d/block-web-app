import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuthStore } from "./state/auth";
import { theme } from "./theme";

import { SplashScreen } from "./screens/SplashScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { TodayScheduleScreen } from "./screens/TodayScheduleScreen";
import { UpcomingScreen } from "./screens/UpcomingScreen";
import { JobDetailScreen } from "./screens/JobDetailScreen";
import { PhotoCaptureScreen } from "./screens/PhotoCaptureScreen";
import { ClockScreen } from "./screens/ClockScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { MockViewBanner } from "./components/MockViewBanner";

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  JobDetail: { jobId: string };
  PhotoCapture: { jobId: string };
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted
      }}
    >
      <Tabs.Screen name="Today" component={TodayScheduleScreen} options={{ tabBarLabel: "Today" }} />
      <Tabs.Screen name="Upcoming" component={UpcomingScreen} options={{ tabBarLabel: "Upcoming" }} />
      <Tabs.Screen name="Clock" component={ClockScreen} options={{ tabBarLabel: "Clock" }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: "Profile" }} />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  mainWrap: { flex: 1, backgroundColor: theme.colors.bg },
  tabsWrap: { flex: 1 }
});

export function RootNavigator() {
  const { status } = useAuthStore();

  if (status === "idle" || status === "loading" || status === "boot_error") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.mainWrap, { paddingTop: insets.top }]}>
      <MockViewBanner />
      <View style={styles.tabsWrap}>
        <Stack.Navigator
          screenOptions={{
            headerTitleStyle: { fontWeight: "700" },
            headerStyle: { backgroundColor: theme.colors.bg },
            contentStyle: { backgroundColor: theme.colors.bg }
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: "Job" }} />
          <Stack.Screen name="PhotoCapture" component={PhotoCaptureScreen} options={{ title: "Photos" }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
        </Stack.Navigator>
      </View>
    </View>
  );
}
