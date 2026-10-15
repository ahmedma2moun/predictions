import { NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { getUserGroups } from '@/lib/services/group-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('groups.get', async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: userId, role } = getSessionUser(session);
  const isAdmin = role === 'admin';

  const groups = await getUserGroups(userId, isAdmin);

  return NextResponse.json(groups, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  });
});
