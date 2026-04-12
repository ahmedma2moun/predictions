import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
  });
}
