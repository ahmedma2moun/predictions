import { ScoringRuleService } from '@/lib/services/scoring-rule-service';
import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { recalculateAllScores } from '@/lib/services/prediction-service';

export async function POST() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rules = await ScoringRuleService.getAll({ where: { isActive: true } });
  
  const updated = await recalculateAllScores(rules);

  return NextResponse.json({ updated });
}
