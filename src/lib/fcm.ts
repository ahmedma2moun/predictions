import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from './prisma';

function initFirebase(): void {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var is not set');
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  initializeApp({ credential: cert(serviceAccount) });
}

/**
 * Sends a push notification to every registered Android device belonging to
 * the given user IDs. Silently deletes stale tokens FCM marks as unregistered.
 * Failures are thrown to callers — wrap in try/catch at call sites.
 */
export async function sendPushToUsers(
  userIds: number[],
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<void> {
  if (userIds.length === 0) return;
  initFirebase();

  const deviceTokens = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, token: true },
  });
  if (deviceTokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens: deviceTokens.map(d => d.token),
    notification: { title: notification.title, body: notification.body },
    data: notification.data ?? {},
    android: {
      priority: 'high',
      notification: { channelId: 'predictions' },
    },
  });

  // Clean up tokens FCM reports as permanently invalid
  const staleIds: number[] = [];
  response.responses.forEach((r, i) => {
    if (
      !r.success &&
      r.error?.code === 'messaging/registration-token-not-registered'
    ) {
      staleIds.push(deviceTokens[i].id);
    }
  });
  if (staleIds.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: staleIds } } });
  }
}
