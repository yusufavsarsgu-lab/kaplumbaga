import { PushNotifications } from '@capacitor/push-notifications';
import { socket } from './socket';

let fcmToken: string | null = null;

export async function initPushNotifications(): Promise<void> {
  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('[Push] Permission denied');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      console.log('[Push] FCM token:', token.value);
      fcmToken = token.value;
      socket.emit('register_fcm_token', { token: token.value });
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err.error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Action performed:', action);
    });
  } catch (err) {
    console.error('[Push] Init failed:', err);
  }
}

export function getFcmToken(): string | null {
  return fcmToken;
}
