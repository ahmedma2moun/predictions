import { NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/admin-auth';
import { getReminderHealth } from '@/lib/reminders/health';
export async function GET() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await getReminderHealth());
}
