import { Client } from '@upstash/qstash';
import { prisma } from '@/lib/prisma';

const INITIAL_DELAY_MS = 2 * 60 * 60 * 1000;   // 2 hours after kickoff
const RETRY_DELAY_SECONDS = 30 * 60;             // 30 minutes between retries
const MAX_HOURS_AFTER_KICKOFF = 6;               // give up after 6 hours

function getClient() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error('QSTASH_TOKEN is not set');
  return new Client({ token });
}

function getAppUrl() {
  const url = process.env.NEXTAUTH_URL;
  if (!url) throw new Error('NEXTAUTH_URL is not set');
  return url.replace(/\/$/, '');
}

/**
 * Schedule (or reschedule) a result-check job for a given kickoff time slot.
 *
 * - Groups all matches with the same kickoffTime under one slot.
 * - If a job already exists for this slot it is cancelled first (dedup).
 * - Does nothing if the slot is already marked done, or if the kickoff time
 *   is beyond the MAX_HOURS_AFTER_KICKOFF safety window.
 *
 * @param kickoffTime  The shared kickoff time for the slot.
 * @param delaySeconds Override the delay. Defaults to kickoffTime + 2h from now.
 */
export async function scheduleSlot(
  kickoffTime: Date,
  delaySeconds?: number,
): Promise<void> {
  const now = Date.now();
  const maxCheckTime = kickoffTime.getTime() + MAX_HOURS_AFTER_KICKOFF * 60 * 60 * 1000;
  if (now > maxCheckTime) {
    console.log(`[result-scheduler] Slot ${kickoffTime.toISOString()} is beyond max window — skipping`);
    return;
  }

  const existing = await prisma.resultCheckSlot.findUnique({ where: { kickoffTime } });
  if (existing?.status === 'done') return;

  const delay = Math.max(
    delaySeconds ??
      Math.max(Math.round((kickoffTime.getTime() + INITIAL_DELAY_MS - now) / 1000), 30),
    1, // QStash requires at least 1 second
  );

  const fireAt = new Date(now + delay * 1000);
  const qstash = getClient();
  const appUrl = getAppUrl();

  // Cancel the existing QStash job before issuing a new one
  if (existing?.qstashJobId) {
    try {
      await qstash.messages.cancel(existing.qstashJobId);
    } catch {
      // Already delivered or gone — safe to ignore
    }
  }

  // Upsert the slot to get a stable DB id before publishing
  const slot = await prisma.resultCheckSlot.upsert({
    where: { kickoffTime },
    create: { kickoffTime, scheduledAt: fireAt, status: 'pending' },
    update: { scheduledAt: fireAt, status: 'pending', qstashJobId: null },
  });

  // Publish the job — body carries only the slotId
  const res = await qstash.publishJSON({
    url: `${appUrl}/api/jobs/check-results`,
    delay,
    body: { slotId: slot.id },
  });

  await prisma.resultCheckSlot.update({
    where: { id: slot.id },
    data: { qstashJobId: res.messageId },
  });

  console.log(
    `[result-scheduler] Slot ${kickoffTime.toISOString()} → job ${res.messageId} fires in ${delay}s`,
  );
}

/**
 * Schedule a retry for a slot that still has unfinished matches.
 * Uses RETRY_DELAY_SECONDS (30 min) as the delay.
 */
export async function rescheduleSlot(slotId: string): Promise<void> {
  const slot = await prisma.resultCheckSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.status === 'done') return;
  await scheduleSlot(slot.kickoffTime, RETRY_DELAY_SECONDS);
}

/**
 * Mark a slot as done — no further checks will be issued.
 */
export async function markSlotDone(slotId: string): Promise<void> {
  await prisma.resultCheckSlot.update({
    where: { id: slotId },
    data: { status: 'done', qstashJobId: null },
  });
}
