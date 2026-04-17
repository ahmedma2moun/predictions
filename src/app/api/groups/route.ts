import { NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { getUserGroups } from '@/lib/services/group-service';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: userId, role } = getSessionUser(session);
  const isAdmin = role === 'admin';

  const groups = await getUserGroups(userId, isAdmin);

  return NextResponse.json(groups, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  });
}
