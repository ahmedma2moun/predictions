import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scheduleSlot } from '@/lib/result-scheduler';

/**
 * POST /api/jobs/reschedule-pending
 *
 * Deployment-recovery endpoint. Call this once after each deployment to
 * re-schedule result checks for all matches that kicked off but haven't
 * been marked finished yet.
 *
 * - Groups matches by kickoffTime (one slot per unique time)
 * - Cancels any existing QStash job for each slot and issues a fresh one
 * - Idempotent — safe to call multiple times
 *
 * Requires Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find all unfinished matches that have already kicked off
  const pendingMatches = await prisma.match.findMany({
    where: {
      kickoffTime: { lt: now },
      status: { notIn: ['finished', 'cancelled'] },
      scoresProcessed: false,
    },
    select: { kickoffTime: true },
  });

  if (pendingMatches.length === 0) {
    return NextResponse.json({ message: 'No pending matches', rescheduled: 0 });
  }

  // Collect unique kickoff times
  const uniqueKickoffs = [...new Set(pendingMatches.map(m => m.kickoffTime.getTime()))].map(
    ts => new Date(ts),
  );

  console.log(`[reschedule-pending] ${pendingMatches.length} pending matches across ${uniqueKickoffs.length} slot(s)`);

  let rescheduled = 0;
  let skipped = 0;

  for (const kickoffTime of uniqueKickoffs) {
    try {
      // scheduleSlot handles the 6-hour safety window internally
      await scheduleSlot(kickoffTime, 0); // delay=0 → fire immediately
      rescheduled++;
    } catch (e) {
      console.error(`[reschedule-pending] Failed for slot ${kickoffTime.toISOString()}:`, e);
      skipped++;
    }
  }

  return NextResponse.json({
    rescheduled,
    skipped,
    totalPendingMatches: pendingMatches.length,
    timestamp: now.toISOString(),
  });
}
