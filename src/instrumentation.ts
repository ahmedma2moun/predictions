/**
 * Next.js instrumentation hook — runs once on server startup (each deployment).
 * Re-schedules QStash result-check jobs for any matches that kicked off but
 * haven't been scored yet, so no jobs are lost across deployments.
 */
export async function register() {
  // Skip only for edge runtime — allow 'nodejs' and undefined (local dev)
  if (process.env.NEXT_RUNTIME === 'edge') return;

  // Dynamic imports keep this out of the edge bundle
  const { prisma } = await import('@/lib/prisma');
  const { scheduleSlot } = await import('@/lib/result-scheduler');

  try {
    const now = new Date();

    const pendingMatches = await prisma.match.findMany({
      where: {
        kickoffTime: { lt: now },
        status: { notIn: ['finished', 'cancelled'] },
        scoresProcessed: false,
      },
      select: { kickoffTime: true },
    });

    if (pendingMatches.length === 0) {
      console.log('[instrumentation] No pending matches to reschedule');
      return;
    }

    const uniqueKickoffs = [
      ...new Set(pendingMatches.map(m => m.kickoffTime.getTime())),
    ].map(ts => new Date(ts));

    console.log(
      `[instrumentation] Rescheduling ${uniqueKickoffs.length} slot(s) for ${pendingMatches.length} pending match(es)`,
    );

    for (const kickoffTime of uniqueKickoffs) {
      try {
        await scheduleSlot(kickoffTime, 0); // fire immediately
      } catch (e) {
        console.error(`[instrumentation] Failed to reschedule slot ${kickoffTime.toISOString()}:`, e);
      }
    }
  } catch (e) {
    console.error('[instrumentation] Error during pending match rescheduling:', e);
  }
}
