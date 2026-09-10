import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { reconcileReminders } from '@/lib/reminders/reconcile';
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  if (!(await verifyCronRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await reconcileReminders());
}
