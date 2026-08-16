import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAccuracyStats } from '@/lib/services/prediction-service';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number((session.user as { id: string }).id);
  const stats = await getAccuracyStats(userId);
  return NextResponse.json(stats);
}
