import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getUserGroups } from '@/lib/services/group-service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.id);
  // Admins have no memberships and see every group (same as the web /api/groups).
  const groups = await getUserGroups(userId, session.role === 'admin');

  // Mobile: non-default first, then default
  groups.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json(groups);
}
