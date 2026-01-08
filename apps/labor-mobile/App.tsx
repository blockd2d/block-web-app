import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text } from 'react-native';
import { AuthProvider, useAuth } from './src/state/auth';
import { capture } from './src/analytics/posthog';
import { LoginScreen } from './src/screens/LoginScreen';
import { JobsScreen } from './src/screens/JobsScreen';
import { JobDetailScreen } from './src/screens/JobDetailScreen';
import { AvailabilityScreen } from './src/screens/AvailabilityScreen';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  JobDetail: { jobId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Jobs" component={JobsScreen} />
      <Tabs.Screen name="Availability" component={AvailabilityScreen} />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const { status, themeMode } = useAuth();
  const navRef = React.useRef<any>(null);
  const routeNameRef = React.useRef<string | undefined>(undefined);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, opacity: 0.7 }}>Loading…</Text>
      </View>
    );
  }

  const navTheme = themeMode === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      ref={navRef}
      theme={navTheme}
      onReady={() => {
        const name = navRef.current?.getCurrentRoute?.()?.name;
        routeNameRef.current = name;
        if (name) capture('$screen', { screen: name });
      }}
      onStateChange={() => {
        const name = navRef.current?.getCurrentRoute?.()?.name;
        if (name && name !== routeNameRef.current) {
          routeNameRef.current = name;
          capture('$screen', { screen: name });
        }
      }}
    >
      <Stack.Navigator>
        {status !== 'authed' ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
