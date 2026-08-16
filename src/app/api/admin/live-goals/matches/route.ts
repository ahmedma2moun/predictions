import { NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { withErrorHandling } from '@/lib/api-handler';

/**
 * Matches eligible for the live-goal test-tick picker (admin/notifications page) —
 * filtered server-side to externalId != null, since the generic /api/admin/matches
 * list is paginated/sorted by kickoffTime and can easily bury or exclude them
 * behind custom (externalId-less) matches on the first page.
 */
export const GET = withErrorHandling('admin/live-goals/matches GET', async () => {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const matches = await MatchRepository.findMany({
    where: { externalId: { not: null } },
    orderBy: { kickoffTime: 'desc' },
    take: 100,
    select: { id: true, externalId: true, homeTeamName: true, awayTeamName: true, status: true, kickoffTime: true },
  });

  return NextResponse.json({
    matches: matches.map(m => ({
      id: m.id.toString(),
      externalId: m.externalId,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      status: m.status,
      kickoffTime: m.kickoffTime,
    })),
  });
});
