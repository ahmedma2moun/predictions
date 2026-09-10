import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/admin-auth';
import { TeamLeagueRepository } from '@/lib/repositories/team-league-repository';
import { getAllUserReminderSelections } from '@/lib/services/reminder-service';

export async function GET() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const selections = await getAllUserReminderSelections();
  return NextResponse.json(selections.map(s => ({
    ...s,
    _id: s.userId.toString(),
    teams: s.teams.map(t => ({ ...t, _id: t.teamLeagueId.toString() })),
  })));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const teamLeagueId = Number(body?.teamLeagueId);
  if (!Number.isSafeInteger(teamLeagueId) || teamLeagueId < 1 || typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'teamLeagueId and enabled are required' }, { status: 400 });
  const row = await TeamLeagueRepository.update({ where: { id: teamLeagueId }, data: { reminderEnabled: body.enabled } });
  return NextResponse.json({ teamLeagueId: row.id, reminderEnabled: row.reminderEnabled });
}
