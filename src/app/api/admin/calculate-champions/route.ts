import { NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/admin-auth';
import { awardAllTimeGroupChampions } from '@/lib/services/streak-badge-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const POST = withApiLogging('admin.calculate-champions.post', async function POST() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await awardAllTimeGroupChampions();
  return NextResponse.json(result);
});
