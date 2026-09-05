import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const CAIRO_TIME_ZONE = 'Africa/Cairo';

function cairoParts(date: string | Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const value = typeof date === 'string' ? new Date(date) : date;
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: CAIRO_TIME_ZONE, ...options })
      .formatToParts(value)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKickoff(date: string | Date): string {
  const parts = cairoParts(date, {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
}

/** Cairo calendar-day key, e.g. "2026-08-24" — used to group matches by day. */
export function getMatchDayKey(date: string | Date): string {
  const parts = cairoParts(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Human-readable day-group header in Cairo time: "Today", "Tomorrow", or "EEEE, dd MMMM". */
export function formatMatchDayHeader(date: string | Date): string {
  const dayDiff = Math.round(
    (Date.parse(getMatchDayKey(date)) - Date.parse(getMatchDayKey(new Date()))) / 86_400_000,
  );
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff === -1) return 'Yesterday';
  const parts = cairoParts(date, { weekday: 'long', day: '2-digit', month: 'long' });
  return `${parts.weekday}, ${parts.day} ${parts.month}`;
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

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE:        'Group Stage',
  ROUND_OF_64:        'Round of 64',
  ROUND_OF_32:        'Round of 32',
  ROUND_OF_16:        'Round of 16',
  QUARTER_FINALS:     'Quarter Final',
  SEMI_FINALS:        'Semi Final',
  THIRD_PLACE:        'Third Place',
  FINAL:              'Final',
  PLAYOFF_ROUND_ONE:  'Playoff Round 1',
  PLAYOFF_ROUND_TWO:  'Playoff Round 2',
  PLAYOFFS:           'Playoffs',
};

export function formatStage(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const NON_KNOCKOUT_STAGES = new Set(['GROUP_STAGE', 'REGULAR_SEASON']);

export function isKnockoutStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  return !NON_KNOCKOUT_STAGES.has(stage);
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const remainder = n % 100;
  return n + (s[(remainder - 20) % 10] ?? s[remainder] ?? s[0]);
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

export function getFridayDate(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 5=Fri
  const friday = new Date(now);
  friday.setUTCDate(now.getUTCDate() - (day === 5 ? 0 : (day > 5 ? day - 5 : 7 - (5 - day))));
  friday.setUTCHours(0, 0, 0, 0);
  return friday;
}
