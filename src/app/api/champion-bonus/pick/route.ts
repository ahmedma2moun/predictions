import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { ChampionBonusService } from '@/lib/services/champion-bonus-service';
import { safeParseBody } from '@/lib/request';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await safeParseBody<{ teamId?: number }>(req);
  if (!body || typeof body.teamId !== 'number') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { id: userId } = getSessionUser(session);
  const result = await ChampionBonusService.setPick(userId, body.teamId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ success: true, teamId: result.teamId.toString() });
}
