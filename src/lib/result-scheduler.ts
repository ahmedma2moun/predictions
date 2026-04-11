import { Client } from '@upstash/qstash';
import { prisma } from '@/lib/prisma';

const INITIAL_DELAY_MS = 2 * 60 * 60 * 1000;   // 2 hours after kickoff
const RETRY_DELAY_SECONDS = 30 * 60;             // 30 minutes between retries
const MAX_HOURS_AFTER_KICKOFF = 6;               // give up after 6 hours

const LOG = '[result-scheduler]';

function getClient() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error('QSTASH_TOKEN is not set');
  return new Client({ token });
}

function getAppUrl(): string {
  // VERCEL_URL is auto-set by Vercel on every deployment (no https:// prefix)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Fallback to explicit NEXTAUTH_URL (must be a public URL in production)
  const url = process.env.NEXTAUTH_URL;
  if (!url) throw new Error('Neither VERCEL_URL nor NEXTAUTH_URL is set');
  return url.replace(/\/$/, '');
}

function isLocalDev(): boolean {
  const url = getAppUrl();
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Schedule (or reschedule) a result-check job for a given kickoff time slot.
 *
 * - Groups all matches with the same kickoffTime under one slot.
 * - If a job already exists for this slot it is cancelled first (dedup).
 * - Does nothing if the slot is already marked done, or if the kickoff time
 *   is beyond the MAX_HOURS_AFTER_KICKOFF safety window (auto-schedule only).
 *
 * @param kickoffTime  The shared kickoff time for the slot.
 * @param delaySeconds Override the delay. Defaults to kickoffTime + 2h from now.
 *                     Passing this explicitly also bypasses the 6h safety cap.
 */
export async function scheduleSlot(
  kickoffTime: Date,
  delaySeconds?: number,
): Promise<void> {
  const now = Date.now();
  const isExplicit = delaySeconds !== undefined;

  console.log(`${LOG} scheduleSlot called — kickoff=${kickoffTime.toISOString()} explicit=${isExplicit} delaySeconds=${delaySeconds ?? 'auto'}`);

  // Enforce the 6h cap only for auto-scheduled jobs.
  // Explicit triggers (delaySeconds provided) bypass it — they are recovery calls
  // that must run regardless of how old the match is.
  if (!isExplicit) {
    const maxCheckTime = kickoffTime.getTime() + MAX_HOURS_AFTER_KICKOFF * 60 * 60 * 1000;
    if (now > maxCheckTime) {
      console.log(`${LOG} Beyond ${MAX_HOURS_AFTER_KICKOFF}h window — skipping auto-schedule for ${kickoffTime.toISOString()}`);
      return;
    }
  }

  const existing = await prisma.resultCheckSlot.findUnique({ where: { kickoffTime } });
  console.log(`${LOG} Existing slot: ${existing ? `id=${existing.id} status=${existing.status} jobId=${existing.qstashJobId ?? 'none'}` : 'none'}`);

  if (existing?.status === 'done') {
    console.log(`${LOG} Slot already done — nothing to schedule`);
    return;
  }

  const delay = Math.max(
    delaySeconds ??
      Math.max(Math.round((kickoffTime.getTime() + INITIAL_DELAY_MS - now) / 1000), 30),
    1, // QStash requires at least 1 second
  );

  const fireAt = new Date(now + delay * 1000);
  console.log(`${LOG} Computed delay=${delay}s → fires at ${fireAt.toISOString()}`);

  const appUrl = getAppUrl();
  console.log(`${LOG} Target URL: ${appUrl}/api/jobs/check-results`);

  // QStash cannot reach localhost — skip publishing in local dev
  if (isLocalDev()) {
    console.warn(`${LOG} Local dev detected — skipping QStash publish (localhost is unreachable from QStash). Slot will be picked up on next deployment.`);
    await prisma.resultCheckSlot.upsert({
      where: { kickoffTime },
      create: { kickoffTime, scheduledAt: fireAt, status: 'pending' },
      update: { scheduledAt: fireAt, status: 'pending' },
    });
    return;
  }

  const qstash = getClient();

  // Cancel the existing QStash job before issuing a new one
  if (existing?.qstashJobId) {
    try {
      await qstash.messages.cancel(existing.qstashJobId);
      console.log(`${LOG} Cancelled previous job ${existing.qstashJobId}`);
    } catch (e) {
      console.warn(`${LOG} Could not cancel job ${existing.qstashJobId} (may already be delivered):`, e);
    }
  }

  // Upsert the slot to get a stable DB id before publishing
  const slot = await prisma.resultCheckSlot.upsert({
    where: { kickoffTime },
    create: { kickoffTime, scheduledAt: fireAt, status: 'pending' },
    update: { scheduledAt: fireAt, status: 'pending', qstashJobId: null },
  });
  console.log(`${LOG} Slot upserted — id=${slot.id}`);

  // Publish the job — body carries only the slotId
  let messageId: string;
  try {
    const res = await qstash.publishJSON({
      url: `${appUrl}/api/jobs/check-results`,
      delay,
      body: { slotId: slot.id },
    });
    messageId = res.messageId;
    console.log(`${LOG} QStash job published — messageId=${messageId} delay=${delay}s`);
  } catch (e) {
    console.error(`${LOG} QStash publish FAILED for slot ${slot.id}:`, e);
    throw e;
  }

  await prisma.resultCheckSlot.update({
    where: { id: slot.id },
    data: { qstashJobId: messageId },
  });

  console.log(`${LOG} ✓ Slot ${slot.id} scheduled — kickoff=${kickoffTime.toISOString()} job=${messageId} fireAt=${fireAt.toISOString()}`);
}

/**
 * Schedule a retry for a slot that still has unfinished matches.
 * Uses RETRY_DELAY_SECONDS (30 min) as the delay.
 */
export async function rescheduleSlot(slotId: string): Promise<void> {
  console.log(`${LOG} rescheduleSlot — id=${slotId}`);
  const slot = await prisma.resultCheckSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.status === 'done') {
    console.log(`${LOG} rescheduleSlot skipped — slot ${slotId} is ${slot?.status ?? 'not found'}`);
    return;
  }
  await scheduleSlot(slot.kickoffTime, RETRY_DELAY_SECONDS);
}

/**
 * Mark a slot as done — no further checks will be issued.
 */
export async function markSlotDone(slotId: string): Promise<void> {
  console.log(`${LOG} markSlotDone — id=${slotId}`);
  await prisma.resultCheckSlot.update({
    where: { id: slotId },
    data: { status: 'done', qstashJobId: null },
  });
}
