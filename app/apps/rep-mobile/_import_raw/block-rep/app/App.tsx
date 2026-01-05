import React, {useEffect, useState} from 'react';
import {StatusBar, LogBox} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import MapScreen from './src/screens/MapScreen';
import RouteScreen from './src/screens/RouteScreen';
import FollowUpsScreen from './src/screens/FollowUpsScreen';
import StatsScreen from './src/screens/StatsScreen';
import HouseDetailScreen from './src/screens/HouseDetailScreen';
import ContractScreen from './src/screens/ContractScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Services
import {supabase} from './src/services/supabase';
import {locationService} from './src/services/location';
import {offlineSyncService} from './src/services/offlineSync';
import {notificationService} from './src/services/notification';

// Store
import {useAuthStore} from './src/store';

// Components
import {ClockInButton} from './src/components/ClockInButton';
import {SyncIndicator} from './src/components/SyncIndicator';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Mapbox warning',
]);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({color, size}) => {
          let iconName;

          switch (route.name) {
            case 'Map':
              iconName = 'map';
              break;
            case 'Route':
              iconName = 'directions-walk';
              break;
            case 'FollowUps':
              iconName = 'schedule';
              break;
            case 'Stats':
              iconName = 'bar-chart';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
          borderTopWidth: 0.5,
        },
        headerRight: () => <ClockInButton />,
        headerLeft: () => <SyncIndicator />,
      })}>
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{title: 'Territory Map'}}
      />
      <Tab.Screen
        name="Route"
        component={RouteScreen}
        options={{title: 'Current Route'}}
      />
      <Tab.Screen
        name="FollowUps"
        component={FollowUpsScreen}
        options={{title: 'Follow-ups'}}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{title: 'Performance'}}
      />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#007AFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="HouseDetail"
        component={HouseDetailScreen}
        options={{title: 'Property Details'}}
      />
      <Stack.Screen
        name="Contract"
        component={ContractScreen}
        options={{title: 'Contract'}}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{title: 'Profile'}}
      />
    </Stack.Navigator>
  );
}

function App(): React.JSX.Element {
  const {user, isAuthenticated, setUser, setLoading} = useAuthStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize services
      await locationService.initialize();
      await offlineSyncService.initialize();
      await notificationService.initialize();

      // Listen for auth changes
      const {data: authListener} = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('[Auth] Event:', event);
          
          if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user as any);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
          }
          
          setInitializing(false);
          setLoading(false);
        },
      );

      // Check current session
      const {data: session} = await supabase.auth.getSession();
      if (session?.session) {
        setUser(session.session.user as any);
      }

      return () => {
        authListener.subscription.unsubscribe();
      };
    } catch (error) {
      console.error('[App] Initialization error:', error);
      setInitializing(false);
      setLoading(false);
    }
  };

  if (initializing || useAuthStore.getState().isLoading) {
    return null; // Could show a splash screen here
  }

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer>
        {isAuthenticated ? <AppStack /> : <LoginScreen />}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default App;