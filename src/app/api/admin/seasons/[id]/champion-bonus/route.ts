import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/admin-auth';
import { ChampionBonusService } from '@/lib/services/champion-bonus-service';
import { safeParseBody } from '@/lib/request';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('admin.seasons.[id].champion-bonus.get', async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const state = await ChampionBonusService.getAdminState(Number(id));
  return NextResponse.json(state);
});

export const POST = withApiLogging('admin.seasons.[id].champion-bonus.post', async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await safeParseBody<{ leagueId?: number; teamIds?: number[] }>(req);
  if (!body || typeof body.leagueId !== 'number' || !Array.isArray(body.teamIds)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const state = await ChampionBonusService.enable(Number(id), body.leagueId, body.teamIds.map(Number));
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
  }
});

export const PATCH = withApiLogging('admin.seasons.[id].champion-bonus.patch', async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await safeParseBody<{ teamIds?: number[] }>(req);
  if (!body || !Array.isArray(body.teamIds)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const state = await ChampionBonusService.updateTeams(Number(id), body.teamIds.map(Number));
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
  }
});

export const DELETE = withApiLogging('admin.seasons.[id].champion-bonus.delete', async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const state = await ChampionBonusService.cancel(Number(id));
  return NextResponse.json(state);
});
