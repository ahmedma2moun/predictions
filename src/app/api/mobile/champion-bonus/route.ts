import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { ChampionBonusService } from '@/lib/services/champion-bonus-service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.id);
  const state = await ChampionBonusService.getUserState(userId);
  return NextResponse.json(state);
}
