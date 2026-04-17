import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { GroupService } from '@/lib/services/group-service';

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/groups/[id] — full group detail with members
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isSessionAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const groupId = Number(id);

  const group = await GroupService.getGroupDetails(groupId);

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    _id: group.id.toString(),
    id:  group.id,
    name: group.name,
    isDefault: group.isDefault,
    members: group.members.map(m => ({ ...m.user, _id: m.user.id.toString() })),
    createdAt: group.createdAt,
  });
}

// PATCH /api/admin/groups/[id]
// Body options:
//   { name: string }
//   { action: 'add-member' | 'remove-member', userId: number }
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isSessionAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const groupId = Number(id);
  const body = await req.json();

  const group = await GroupService.getGroupExistence(groupId);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action, name, userId } = body;

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    await GroupService.updateGroupName(groupId, name.trim());
  }

  if (action === 'add-member') {
    await GroupService.addGroupMember(groupId, Number(userId));
  } else if (action === 'remove-member') {
    if (group.isDefault) return NextResponse.json({ error: 'Cannot remove members from the default group' }, { status: 400 });
    await GroupService.removeGroupMember(groupId, Number(userId));
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/groups/[id] — delete a non-default group
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || !isSessionAdmin(session))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const groupId = Number(id);

  const group = await GroupService.getGroupExistence(groupId);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (group.isDefault) return NextResponse.json({ error: 'Cannot delete the default group' }, { status: 400 });

  await GroupService.deleteGroup(groupId);
  return NextResponse.json({ ok: true });
}
