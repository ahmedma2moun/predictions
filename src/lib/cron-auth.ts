import { NextRequest } from 'next/server';

export function verifyCronRequest(req: NextRequest): boolean {
  const authHeader    = req.headers.get('authorization');
  const cronSecret    = process.env.CRON_SECRET;
  const triggerSecret = process.env.TRIGGER_SECRET;
  const isVercelCron  = !!req.headers.get('x-vercel-cron-schedule');

  return isVercelCron
    || (!!cronSecret && authHeader === `Bearer ${cronSecret}`)
    || (!!triggerSecret && authHeader === `Bearer ${triggerSecret}`);
}
