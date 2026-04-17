import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { safeParseBody } from '@/lib/request';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await safeParseBody<any>(req);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { fcmToken } = body;
  if (!fcmToken || typeof fcmToken !== 'string') {
    return NextResponse.json({ error: 'fcmToken is required' }, { status: 400 });
  }

  await prisma.deviceToken.upsert({
    where: { token: fcmToken },
    create: { userId: Number(session.id), token: fcmToken, platform: 'android' },
    update: { userId: Number(session.id), updatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await safeParseBody<any>(req);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { fcmToken } = body;
  if (!fcmToken || typeof fcmToken !== 'string') {
    return NextResponse.json({ error: 'fcmToken is required' }, { status: 400 });
  }

  await prisma.deviceToken.deleteMany({
    where: { token: fcmToken, userId: Number(session.id) },
  });

  return NextResponse.json({ success: true });
}
