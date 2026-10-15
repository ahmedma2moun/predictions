import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getReminderLeagues, getUserReminderPreferences, saveUserReminderPreferences } from '@/lib/services/reminder-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('mobile.reminders.get', async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = Number(session.id);
  return NextResponse.json({ leagues: await getReminderLeagues(), selections: await getUserReminderPreferences(userId) });
});

export const PUT = withApiLogging('mobile.reminders.put', async function PUT(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json({ selections: await saveUserReminderPreferences(Number(session.id), body?.selections) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid selections' }, { status: 400 });
  }
});
