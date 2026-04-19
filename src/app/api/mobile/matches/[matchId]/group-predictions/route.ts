import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getGroupPredictionsForMatch } from '@/lib/services/prediction-service';
import { serializeBreakdown } from '@/models/Prediction';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const userId = Number(session.id);
  const isAdmin = session.role === 'admin';

  const groupIdParam = req.nextUrl.searchParams.get('groupId');
  if (!groupIdParam) return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
  const groupId = Number(groupIdParam);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return NextResponse.json({ error: 'Invalid groupId' }, { status: 400 });
  }

  const result = await getGroupPredictionsForMatch(Number(matchId), groupId, userId, isAdmin);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(
    result.entries.map(e => ({ ...e, scoringBreakdown: serializeBreakdown(e.scoringBreakdown) })),
  );
}
