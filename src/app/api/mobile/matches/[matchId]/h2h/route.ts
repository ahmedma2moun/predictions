import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileSession } from '@/lib/mobile-auth';
import { getH2H } from '@/lib/h2h';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const match = await prisma.match.findUnique({
    where: { id: Number(matchId) },
    select: { externalId: true },
  });
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const data = await getH2H(match.externalId, 5);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch head-to-head data' }, { status: 502 });
  }
}
