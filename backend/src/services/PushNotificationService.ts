import { prisma } from '../db/prisma';

export async function saveFcmToken(userId: string, token: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: token },
  });
}

interface PendingNotification {
  title: string;
  body: string;
  data: Record<string, string>;
  createdAt: Date;
}

const pendingNotifications = new Map<string, PendingNotification[]>();

export function queueNotification(
  receiverId: string,
  title: string,
  body: string,
  data: Record<string, string>
): void {
  const list = pendingNotifications.get(receiverId) || [];
  list.push({ title, body, data, createdAt: new Date() });
  pendingNotifications.set(receiverId, list);
  console.log('[Notify] Queued notification for offline user', receiverId);
}

export function getPendingNotifications(userId: string): PendingNotification[] {
  const list = pendingNotifications.get(userId) || [];
  pendingNotifications.delete(userId);
  return list;
}
