import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Dimensions, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "./theme";
import { useSessionStore } from "./state";

import { BootScreen } from "./screens/BootScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { ClustersScreen } from "./screens/ClustersScreen";
import { ClusterCalendarScreen } from "./screens/ClusterCalendarScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { ClusterDetailScreen } from "./screens/ClusterDetailScreen";
import { WalkingModeScreen } from "./screens/WalkingModeScreen";
import { QuoteBuilderScreen } from "./screens/QuoteBuilderScreen";
import { UnsupportedRoleScreen } from "./screens/UnsupportedRoleScreen";

export type RootStackParamList = {
  Boot: undefined;
  Login: undefined;
  Main: undefined;
  UnsupportedRole: undefined;
  ClusterDetail: { clusterId: string };
  WalkingMode: { clusterId: string; startAtStopId?: string };
  QuoteBuilder: { clusterId: string; stopId: string; quoteId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

function PillTabButton(props: BottomTabBarButtonProps & { label: string; tabCount: number }) {
  const focused = !!props.accessibilityState?.selected;
  const baseCharW = 8;
  const baseSidePad = 30;
  const desiredWidth = Math.round((props.label.length * baseCharW + baseSidePad) * 1.18);
  const winW = Dimensions.get("window").width;
  const maxPerTab = Math.floor(winW / props.tabCount) - 16;
  const pillWidth = Math.min(desiredWidth, maxPerTab);

  return (
    <View style={[{ flex: 1, alignItems: "center" }, props.style]}>
      <Pressable
        testID={props.testID}
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        accessibilityRole="button"
        accessibilityState={props.accessibilityState}
        accessibilityLabel={props.accessibilityLabel}
        accessibilityHint={props.accessibilityHint}
        style={({ pressed }) => [
          {
            height: 42,
            width: pillWidth,
            borderRadius: 999,
            marginHorizontal: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1c2e4a",
            borderWidth: focused ? 1 : 0,
            borderColor: focused ? "rgba(255,255,255,0.35)" : "transparent"
          },
          pressed ? { opacity: 0.86 } : null
        ]}
      >
        <Text style={{ fontSize: 13, fontWeight: "900", color: "#FFFFFF" }}>{props.label}</Text>
      </Pressable>
    </View>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();

  const baseHeight = 64;
  const basePaddingTop = 6;
  const basePaddingBottom = 10;

  const height = baseHeight + insets.bottom;
  const paddingBottom = basePaddingBottom + insets.bottom;

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { height, paddingTop: basePaddingTop, paddingBottom }
      }}
    >
      <Tabs.Screen
        name="Clusters"
        component={ClustersScreen}
        options={{
          tabBarLabel: "Clusters",
          tabBarButton: (p) => <PillTabButton {...p} label="Clusters" tabCount={3} />
        }}
      />
      <Tabs.Screen
        name="Calendar"
        component={ClusterCalendarScreen}
        options={{
          tabBarLabel: "Calendar",
          tabBarButton: (p) => <PillTabButton {...p} label="Calendar" tabCount={3} />
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarButton: (p) => <PillTabButton {...p} label="Profile" tabCount={3} />
        }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const session = useSessionStore();
  const isAuthed = session.status === "authenticated";

  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: "900" },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.bg },
        contentStyle: { backgroundColor: theme.colors.bg }
      }}
    >
      {session.status === "idle" || session.status === "loading" || session.status === "boot_error" ? (
        <Stack.Screen name="Boot" component={BootScreen} options={{ headerShown: false }} />
      ) : session.status === "unsupported_role" ? (
        <Stack.Screen name="UnsupportedRole" component={UnsupportedRoleScreen} options={{ headerShown: false }} />
      ) : !isAuthed ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: true, title: "", headerRight: () => null }} />
          <Stack.Screen name="ClusterDetail" component={ClusterDetailScreen} options={{ title: "Cluster" }} />
          <Stack.Screen name="WalkingMode" component={WalkingModeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="QuoteBuilder" component={QuoteBuilderScreen} options={{ title: "Quote" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
