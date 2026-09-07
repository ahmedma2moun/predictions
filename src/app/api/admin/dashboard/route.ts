import { NextResponse } from 'next/server';
import { auth } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [totalUsers, activeLeagues, upcomingMatches, predictionsToday] = await Promise.all([
    prisma.user.count(), prisma.league.count({ where: { isActive: true } }),
    prisma.match.count({ where: { status: { in: ['scheduled', 'live'] } } }),
    prisma.prediction.count({ where: { createdAt: { gte: today } } }),
  ]);
  return NextResponse.json({ totalUsers, activeLeagues, upcomingMatches, predictionsToday });
}
