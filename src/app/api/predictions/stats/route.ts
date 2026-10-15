import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAccuracyStats } from '@/lib/services/prediction-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('predictions.stats', async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number((session.user as { id: string }).id);
  const stats = await getAccuracyStats(userId);
  return NextResponse.json(stats);
});
