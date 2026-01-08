import messaging from '@react-native-firebase/messaging';
import { blockApi } from './blockApi';

export class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) return;

    const token = await messaging().getToken();
    await this.saveToken(token);

    messaging().onTokenRefresh(async newToken => {
      await this.saveToken(newToken);
    });

    messaging().onMessage(async remoteMessage => {
      console.log('[Notification] Foreground message:', remoteMessage);
    });

    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('[Notification] Background message:', remoteMessage);
    });
  }

  private async saveToken(token: string) {
    try {
      await blockApi.post('/v1/me/push-token', { token });
    } catch {
      // Non-fatal for MVP
    }
  }
}

export const notificationService = NotificationService.getInstance();
