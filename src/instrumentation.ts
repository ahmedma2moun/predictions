/**
 * Next.js instrumentation hook — runs once on server startup (each deployment).
 * Re-schedules QStash result-check jobs for any matches that kicked off but
 * haven't been scored yet, so no jobs are lost across deployments.
 */
export async function register() {
  // Skip only for edge runtime — allow 'nodejs' and undefined (local dev)
  if (process.env.NEXT_RUNTIME === 'edge') return;

  console.log('[instrumentation] register() called — runtime:', process.env.NEXT_RUNTIME ?? 'undefined');

  // Dynamic imports keep this out of the edge bundle
  const { prisma } = await import('@/lib/prisma');
  const { scheduleSlot } = await import('@/lib/result-scheduler');

  try {
    const now = new Date();
    console.log('[instrumentation] Querying pending matches at', now.toISOString());

    const pendingMatches = await prisma.match.findMany({
      where: {
        kickoffTime: { lt: now },
        status: { notIn: ['finished', 'cancelled'] },
        scoresProcessed: false,
      },
      select: { id: true, kickoffTime: true, homeTeamName: true, awayTeamName: true },
    });

    console.log(`[instrumentation] Found ${pendingMatches.length} pending match(es)`);

    if (pendingMatches.length === 0) {
      console.log('[instrumentation] Nothing to reschedule — all clear');
      return;
    }

    for (const m of pendingMatches) {
      console.log(`[instrumentation]   match ${m.id}: ${m.homeTeamName} vs ${m.awayTeamName} — kickoff ${m.kickoffTime.toISOString()}`);
    }

    const uniqueKickoffs = [
      ...new Set(pendingMatches.map(m => m.kickoffTime.getTime())),
    ].map(ts => new Date(ts));

    console.log(`[instrumentation] Scheduling ${uniqueKickoffs.length} unique slot(s)`);

    let ok = 0, failed = 0;
    for (const kickoffTime of uniqueKickoffs) {
      try {
        await scheduleSlot(kickoffTime, 0); // delay=0 → fire immediately, bypasses 6h cap
        ok++;
      } catch (e) {
        console.error(`[instrumentation] Failed to schedule slot ${kickoffTime.toISOString()}:`, e);
        failed++;
      }
    }

    console.log(`[instrumentation] Done — scheduled=${ok} failed=${failed}`);
  } catch (e) {
    console.error('[instrumentation] Unexpected error:', e);
  }
}
