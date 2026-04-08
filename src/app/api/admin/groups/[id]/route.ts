import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

async function getGroupOr404(id: number) {
  const group = await prisma.group.findUnique({ where: { id } });
  return group;
}

// GET /api/admin/groups/[id] — full group detail with members, leagues, teams
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const groupId = Number(id);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members:      { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      groupLeagues: { include: { league: { select: { id: true, name: true, country: true, logo: true } } } },
      groupTeams:   { include: { team:   { select: { id: true, name: true, logo: true } } } },
    },
  });

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    _id: group.id.toString(),
    id:  group.id,
    name: group.name,
    isDefault: group.isDefault,
    members:  group.members.map(m => ({ ...m.user, _id: m.user.id.toString() })),
    leagues:  group.groupLeagues.map(gl => ({ ...gl.league, _id: gl.league.id.toString() })),
    teams:    group.groupTeams.map(gt => ({ ...gt.team,   _id: gt.team.id.toString() })),
    createdAt: group.createdAt,
  });
}

// PATCH /api/admin/groups/[id] — update name / add-remove members, leagues, teams
// Body options:
//   { name: string }
//   { action: 'add-member' | 'remove-member', userId: number }
//   { action: 'add-league' | 'remove-league', leagueId: number }
//   { action: 'add-team'   | 'remove-team',   teamId: number }
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const groupId = Number(id);
  const body = await req.json();

  const group = await getGroupOr404(groupId);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action, name, userId, leagueId, teamId } = body;

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    await prisma.group.update({ where: { id: groupId }, data: { name: name.trim() } });
  }

  if (action === 'add-member') {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: Number(userId) } },
      create: { groupId, userId: Number(userId) },
      update: {},
    });
  } else if (action === 'remove-member') {
    if (group.isDefault) return NextResponse.json({ error: 'Cannot remove members from the default group' }, { status: 400 });
    await prisma.groupMember.deleteMany({ where: { groupId, userId: Number(userId) } });
  } else if (action === 'add-league') {
    await prisma.groupLeague.upsert({
      where: { groupId_leagueId: { groupId, leagueId: Number(leagueId) } },
      create: { groupId, leagueId: Number(leagueId) },
      update: {},
    });
  } else if (action === 'remove-league') {
    await prisma.groupLeague.deleteMany({ where: { groupId, leagueId: Number(leagueId) } });
  } else if (action === 'add-team') {
    await prisma.groupTeam.upsert({
      where: { groupId_teamId: { groupId, teamId: Number(teamId) } },
      create: { groupId, teamId: Number(teamId) },
      update: {},
    });
  } else if (action === 'remove-team') {
    await prisma.groupTeam.deleteMany({ where: { groupId, teamId: Number(teamId) } });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/groups/[id] — delete a non-default group
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const groupId = Number(id);

  const group = await getGroupOr404(groupId);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (group.isDefault) return NextResponse.json({ error: 'Cannot delete the default group' }, { status: 400 });

  await prisma.group.delete({ where: { id: groupId } });
  return NextResponse.json({ ok: true });
}
