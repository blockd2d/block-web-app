import {Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import {supabase} from './supabase';

export class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    // Request permission
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[Notification] Permission not granted');
      return;
    }

    // Get FCM token
    const token = await messaging().getToken();
    console.log('[Notification] FCM Token:', token);

    // Save token to Supabase
    await this.saveToken(token);

    // Listen for token refresh
    messaging().onTokenRefresh(async newToken => {
      console.log('[Notification] Token refreshed:', newToken);
      await this.saveToken(newToken);
    });

    // Handle foreground messages
    messaging().onMessage(async remoteMessage => {
      console.log('[Notification] Foreground message:', remoteMessage);
      this.handleNotification(remoteMessage);
    });

    // Handle background messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('[Notification] Background message:', remoteMessage);
      this.handleNotification(remoteMessage);
    });

    // Handle notification opened
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('[Notification] Opened from background:', remoteMessage);
      this.handleNotificationOpened(remoteMessage);
    });

    // Check if app was opened from a notification
    const initialNotification = await messaging().getInitialNotification();
    if (initialNotification) {
      console.log('[Notification] App opened from notification:', initialNotification);
      this.handleNotificationOpened(initialNotification);
    }
  }

  private async saveToken(token: string) {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const {error} = await supabase.from('profiles').upsert({
        id: user.id,
        push_token: token,
        push_token_updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[Notification] Error saving token:', error);
      }
    } catch (error) {
      console.error('[Notification] Error saving token:', error);
    }
  }

  private handleNotification(remoteMessage: any) {
    const {data, notification} = remoteMessage;
    
    if (data?.type === 'follow_up_reminder') {
      // Handle follow-up reminder
      console.log('[Notification] Follow-up reminder:', data.follow_up_id);
    } else if (data?.type === 'new_message') {
      // Handle new message
      console.log('[Notification] New message:', data.message_id);
    } else if (data?.type === 'assignment_update') {
      // Handle cluster assignment update
      console.log('[Notification] Assignment update:', data.cluster_id);
    }
  }

  private handleNotificationOpened(remoteMessage: any) {
    const {data} = remoteMessage;
    
    if (data?.type === 'follow_up_reminder') {
      // Navigate to follow-ups screen
    } else if (data?.type === 'new_message') {
      // Navigate to messages screen
    } else if (data?.type === 'assignment_update') {
      // Navigate to map screen
    }
  }

  async scheduleFollowUpReminder(followUpId: string, scheduledFor: Date) {
    // This would typically be done via a backend service
    // that schedules push notifications
    console.log('[Notification] Scheduling reminder for:', followUpId, scheduledFor);
  }

  async cancelFollowUpReminder(followUpId: string) {
    console.log('[Notification] Canceling reminder for:', followUpId);
  }
}

export const notificationService = NotificationService.getInstance();