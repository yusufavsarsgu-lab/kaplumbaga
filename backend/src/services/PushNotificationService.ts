import { prisma } from '../db/prisma';

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;

export async function saveFcmToken(userId: string, token: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: token },
  });
}

export async function sendPushNotification(
  receiverId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!FCM_SERVER_KEY) {
    console.log('[Push] FCM_SERVER_KEY not set, skipping push notification');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { fcmToken: true },
  });

  if (!user?.fcmToken) {
    console.log('[Push] No FCM token for user', receiverId);
    return;
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: user.fcmToken,
        notification: { title, body },
        data: data || {},
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Push] FCM send failed:', error);
    } else {
      console.log('[Push] Notification sent to', receiverId);
    }
  } catch (err) {
    console.error('[Push] FCM request failed:', err);
  }
}
