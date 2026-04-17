// Mirrors football-predictions/src/lib/utils.ts

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  ROUND_OF_64: 'Round of 64',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter Final',
  SEMI_FINALS: 'Semi Final',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
  PLAYOFF_ROUND_ONE: 'Playoff Round 1',
  PLAYOFF_ROUND_TWO: 'Playoff Round 2',
  PLAYOFFS: 'Playoffs',
};

const NON_KNOCKOUT_STAGES = new Set(['GROUP_STAGE', 'REGULAR_SEASON']);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Format kickoff in CLT (UTC+2) — matches `formatKickoff()` in web utils.ts. */
export function formatKickoff(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const clt = new Date(d.getTime() + 2 * 60 * 60 * 1000);
  const day = DAYS[clt.getUTCDay()];
  const dayNum = pad2(clt.getUTCDate());
  const month = MONTHS[clt.getUTCMonth()];
  const h = pad2(clt.getUTCHours());
  const m = pad2(clt.getUTCMinutes());
  return `${day} ${dayNum} ${month}, ${h}:${m}`;
}

export function isMatchLocked(kickoffTime: string | Date): boolean {
  const d = typeof kickoffTime === 'string' ? new Date(kickoffTime) : kickoffTime;
  return new Date() >= d;
}

export function getWinner(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

export function formatStage(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function isKnockoutStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  return !NON_KNOCKOUT_STAGES.has(stage);
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function formatH2HDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit',
  });
}
