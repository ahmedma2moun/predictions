import { NextRequest, NextResponse } from 'next/server';
import { runExportJob } from '@/lib/export/job';
import { verifyCronRequest } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
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
