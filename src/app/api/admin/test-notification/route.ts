import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { DeviceTokenService } from '@/lib/services/device-service';
import { UserService } from '@/lib/services/user-service';
import { sendPushToUsers } from '@/lib/fcm';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { title, text, userIds, allUsers, link } = body;

  if (!title || !text) {
    return NextResponse.json({ error: 'Title and text are required' }, { status: 400 });
  }

  let targetIds: number[] = [];

  if (allUsers) {
    const all = await DeviceTokenService.getAll({
      select: { userId: true },
      distinct: ['userId'],
    });
    targetIds = all.map(d => d.userId);
  } else if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    targetIds = userIds.map(Number);
  } else {
    return NextResponse.json({ error: 'Must specify userIds or allUsers' }, { status: 400 });
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ message: 'No devices found for targets' });
  }

  const tokens = await DeviceTokenService.getAll({
    where: { userId: { in: targetIds } },
    select: { token: true, userId: true },
  });

  if (tokens.length === 0) {
    return NextResponse.json({ message: 'No active device tokens found for selected users' });
  }

  const data: Record<string, string> = { type: 'admin_test' };
  if (link) data.url = link;

  try {
    const results = await sendPushToUsers(targetIds, {
      title,
      body: text,
      data,
    });

    return NextResponse.json({
      message: 'Notifications sent',
      tokensTargeted: tokens.length,
      usersTargeted: targetIds.length,
      firebaseResult: results,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send push' }, { status: 500 });
  }
}
