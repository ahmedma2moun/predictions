import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = Number(new URL(req.url).searchParams.get('userId'));
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { id: true, platform: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ count: tokens.length, tokens });
}
