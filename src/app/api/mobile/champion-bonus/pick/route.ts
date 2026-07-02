import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { ChampionBonusService } from '@/lib/services/champion-bonus-service';
import { safeParseBody } from '@/lib/request';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await safeParseBody<{ teamId?: number }>(req);
  if (!body || typeof body.teamId !== 'number') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const userId = Number(session.id);
  const result = await ChampionBonusService.setPick(userId, body.teamId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ success: true, teamId: result.teamId.toString() });
}
