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
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Format kickoff in the device's local timezone. */
export function formatKickoff(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = DAYS[d.getDay()];
  const dayNum = pad2(d.getDate());
  const month = MONTHS[d.getMonth()];
  const h = pad2(d.getHours());
  const m = pad2(d.getMinutes());
  return `${day} ${dayNum} ${month}, ${h}:${m}`;
}

/** Local calendar-day key, e.g. "2026-08-24" — used to group matches by day. */
export function getMatchDayKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Human-readable day-group header in the device's local timezone: "Today", "Tomorrow", or "Weekday, dd Month". */
export function formatMatchDayHeader(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayDiff = Math.round((startOfLocalDay(d) - startOfLocalDay(new Date())) / 86_400_000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff === -1) return 'Yesterday';
  return `${FULL_DAYS[d.getDay()]}, ${d.getDate()} ${FULL_MONTHS[d.getMonth()]}`;
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

export function formatMatchStatus(status: string): string {
  switch (status) {
    case 'live':      return 'LIVE';
    case 'finished':  return 'FT';
    case 'postponed': return 'PST';
    case 'cancelled': return 'CANC';
    default:          return 'Upcoming';
  }
}

export function formatH2HDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit',
  });
}
