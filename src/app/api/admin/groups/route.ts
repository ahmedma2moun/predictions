import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/admin-auth';
import { GroupService } from '@/lib/services/group-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('admin.groups.get', async function GET() {
  const session = await auth();
  if (!session || !isSessionAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const groups = await GroupService.getAllGroupsWithCounts();

  return NextResponse.json(groups.map(g => ({
    _id: g.id.toString(),
    id: g.id,
    name: g.name,
    isDefault: g.isDefault,
    memberCount: g._count.members,
    createdAt: g.createdAt,
  })));
});

export const POST = withApiLogging('admin.groups.post', async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const group = await GroupService.createGroup(name.trim());
  return NextResponse.json({ _id: group.id.toString(), ...group });
});
