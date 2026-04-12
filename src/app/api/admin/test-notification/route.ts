import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushToUsers } from '@/lib/fcm';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON env var is not set' }, { status: 500 });
  }

  const body = await req.json();
  const { userIds, title, body: notifBody, type } = body as {
    userIds?: number[];
    title?: string;
    body?: string;
    type?: string;
  };

  // Resolve target user IDs — either explicit list or all users with device tokens
  let targetUserIds: number[];
  if (Array.isArray(userIds) && userIds.length > 0) {
    targetUserIds = userIds.map(Number).filter(Boolean);
  } else {
    const all = await prisma.deviceToken.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    targetUserIds = all.map(d => d.userId);
  }

  if (targetUserIds.length === 0) {
    return NextResponse.json({ error: 'No target users found — no userIds provided and no registered device tokens' }, { status: 400 });
  }

  // Count device tokens for the response
  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: targetUserIds } },
    select: { userId: true, token: true },
  });

  if (tokens.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'Target users have no registered device tokens',
      targetUserIds,
    }, { status: 400 });
  }

  const resolvedTitle = title ?? 'Test Notification';
  const resolvedBody  = notifBody ?? 'This is a test push notification from the admin panel.';
  const resolvedType  = type ?? 'new_matches';

  try {
    await sendPushToUsers(targetUserIds, {
      title: resolvedTitle,
      body: resolvedBody,
      data: { type: resolvedType },
    });

    // Fetch user names for the response
    const users = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({
      ok: true,
      sentTo: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
      deviceTokenCount: tokens.length,
      notification: { title: resolvedTitle, body: resolvedBody, type: resolvedType },
    });
  } catch (e: any) {
    console.error('[test-notification] FCM error:', e);
    return NextResponse.json({ error: e?.message ?? 'FCM send failed' }, { status: 500 });
  }
}
