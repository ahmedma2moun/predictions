import { NextResponse } from 'next/server';
import { auth } from '@/lib/admin-auth';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('mobile.admin.session.get', async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
  return NextResponse.json({ user: session.user }, { headers: { 'Cache-Control': 'no-store' } });
});
