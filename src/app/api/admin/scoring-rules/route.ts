import { ScoringRuleService } from '@/lib/services/scoring-rule-service';
import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rules = await ScoringRuleService.getAll({ orderBy: { priority: 'asc' } });
  return NextResponse.json(rules.map(r => ({ ...r, _id: r.id.toString() })));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, points, isActive } = await req.json();
  const data: any = {};
  if (typeof points === 'number') data.points = points;
  if (typeof isActive === 'boolean') data.isActive = isActive;

  const rule = await ScoringRuleService.update({ where: { id: Number(id) }, data });
  return NextResponse.json({ ...rule, _id: rule.id.toString() });
}
