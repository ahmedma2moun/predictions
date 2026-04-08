interface ScoringRule {
  id: number;
  name: string;
  key: string;
  points: number;
  priority: number;
  isActive: boolean;
}

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away' | 'draw';
}

interface PredictionInput {
  homeScore: number;
  awayScore: number;
}

type RuleEvaluator = (pred: PredictionInput, actual: MatchResult) => boolean;

const ruleEvaluators: Record<string, RuleEvaluator> = {
  correct_winner: (pred, actual) => {
    const predWinner = pred.homeScore > pred.awayScore ? 'home' : pred.homeScore < pred.awayScore ? 'away' : 'draw';
    return predWinner === actual.winner;
  },
  exact_score: (pred, actual) =>
    pred.homeScore === actual.homeScore && pred.awayScore === actual.awayScore,
  score_difference: (pred, actual) =>
    actual.winner !== 'draw' &&
    pred.homeScore - pred.awayScore === actual.homeScore - actual.awayScore,
  one_team_score: (pred, actual) =>
    pred.homeScore === actual.homeScore || pred.awayScore === actual.awayScore,
};

const TIERED_KEYS = ['exact_score', 'score_difference', 'one_team_score'];

export function calculateScore(
  prediction: PredictionInput,
  result: MatchResult,
  rules: ScoringRule[]
): { totalPoints: number; breakdown: Array<{ ruleId: number; ruleName: string; pointsAwarded: number; matched: boolean }> } {
  const activeRules = rules.filter((r) => r.isActive).sort((a, b) => a.priority - b.priority);
  const breakdown: Array<{ ruleId: number; ruleName: string; pointsAwarded: number; matched: boolean }> = [];
  let totalPoints = 0;

  // correct_winner is always evaluated independently
  const winnerRule = activeRules.find((r) => r.key === 'correct_winner');
  if (winnerRule) {
    const matched = ruleEvaluators.correct_winner(prediction, result);
    breakdown.push({ ruleId: winnerRule.id, ruleName: winnerRule.name, pointsAwarded: matched ? winnerRule.points : 0, matched });
    if (matched) totalPoints += winnerRule.points;
  }

  // Tiered: only highest matching one applies
  const tieredRules = activeRules.filter((r) => TIERED_KEYS.includes(r.key));
  let tieredApplied = false;
  for (const rule of tieredRules) {
    const evaluator = ruleEvaluators[rule.key];
    if (!evaluator) continue;
    const matched = !tieredApplied && evaluator(prediction, result);
    if (matched && !tieredApplied) {
      breakdown.push({ ruleId: rule.id, ruleName: rule.name, pointsAwarded: rule.points, matched: true });
      totalPoints += rule.points;
      tieredApplied = true;
    } else {
      breakdown.push({ ruleId: rule.id, ruleName: rule.name, pointsAwarded: 0, matched: false });
    }
  }

  return { totalPoints, breakdown };
}
