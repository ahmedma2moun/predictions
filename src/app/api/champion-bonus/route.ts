import { NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { ChampionBonusService } from '@/lib/services/champion-bonus-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('champion-bonus.get', async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: userId } = getSessionUser(session);
  const state = await ChampionBonusService.getUserState(userId);
  return NextResponse.json(state);
});
