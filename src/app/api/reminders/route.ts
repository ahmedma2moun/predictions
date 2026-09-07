import { NextRequest, NextResponse } from 'next/server';
import { auth, getSessionUser } from '@/lib/auth';
import { getReminderLeagues, getUserReminderPreferences, saveUserReminderPreferences } from '@/lib/services/reminder-service';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = getSessionUser(session);
  return NextResponse.json({ leagues: await getReminderLeagues(), selections: await getUserReminderPreferences(id) });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const selections = body && typeof body === 'object' && !Array.isArray(body) ? (body as { selections?: unknown }).selections : undefined;
  try {
    const { id } = getSessionUser(session);
    return NextResponse.json({ selections: await saveUserReminderPreferences(id, selections) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid selections' }, { status: 400 });
  }
}
