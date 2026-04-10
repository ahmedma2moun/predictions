import { NextRequest, NextResponse } from 'next/server';
import { runExportJob } from '@/lib/export/job';

export async function GET(req: NextRequest) {
  const authHeader    = req.headers.get('authorization');
  const cronSecret    = process.env.CRON_SECRET;
  const triggerSecret = process.env.TRIGGER_SECRET;
  const isVercelCron  = !!req.headers.get('x-vercel-cron-schedule');
  const authorized =
    isVercelCron ||
    (cronSecret    && authHeader === `Bearer ${cronSecret}`) ||
    (triggerSecret && authHeader === `Bearer ${triggerSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const correlationId = Date.now().toString(36);
  try {
    const result = await runExportJob({ correlationId });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), correlationId },
      { status: 500 },
    );
  }
}
