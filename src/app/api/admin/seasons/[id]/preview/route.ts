import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/admin-auth';
import { SeasonService } from '@/lib/services/season-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('admin.seasons.[id].preview.get', async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const preview = await SeasonService.getChampionPreview(Number(id));
    return NextResponse.json(preview);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
  }
});
