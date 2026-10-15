import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('health.get', async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
});
