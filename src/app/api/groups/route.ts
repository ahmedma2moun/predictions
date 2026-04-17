import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserGroups } from '@/lib/services/group-service';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = (session.user as any).role === 'admin';
  const userId  = Number((session.user as any).id);

  const groups = await getUserGroups(userId, isAdmin);

  return NextResponse.json(groups, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  });
}
