import { ScoringRuleService } from '@/lib/services/scoring-rule-service';
import { NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { recalculateAllScores } from '@/lib/services/prediction-service';
import { SeasonService } from '@/lib/services/season-service';
import { ChampionBonusService } from '@/lib/services/champion-bonus-service';
import { logger } from '@/lib/logger';

export async function POST() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rules = await ScoringRuleService.getAll({ where: { isActive: true } });

  const updated = await recalculateAllScores(rules);

  // Catch-all: rebuild Champion Bonus ledger for the active season (handles result resets/edge cases).
  const activeSeason = await SeasonService.getActiveSeason();
  if (activeSeason) {
    await ChampionBonusService.recomputeSeason(activeSeason.id).catch(e =>
      logger.error('[recalculate] Champion Bonus recompute failed:', { error: e instanceof Error ? e.message : String(e) }),
    );
  }

  return NextResponse.json({ updated });
}
