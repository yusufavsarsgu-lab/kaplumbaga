import { LocalNotifications } from '@capacitor/local-notifications';
import { socket } from './socket';

export async function initLocalNotifications(): Promise<void> {
  try {
    const permission = await LocalNotifications.requestPermissions();
    if (!permission.display) {
      console.log('[Notify] Permission denied');
      return;
    }

    socket.on('show_notification', (data: { title: string; body: string; data?: Record<string, string> }) => {
      void showLocalNotification(data.title, data.body, data.data);
    });
  } catch (err) {
    console.error('[Notify] Init failed:', err);
  }
}

async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now(),
          title,
          body,
          extra: data || {},
          smallIcon: 'ic_launcher',
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });
  } catch (err) {
    console.error('[Notify] Show failed:', err);
  }
}
