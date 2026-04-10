import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKickoff(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  // Add 2 hours for CLT (UTC+2)
  const clt = new Date(d.getTime() + 2 * 60 * 60 * 1000);
  return format(clt, 'EEE dd MMM, HH:mm');
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

export function isKnockoutStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  return stage !== 'GROUP_STAGE';
}

export function getFridayDate(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 5=Fri
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setUTCDate(now.getUTCDate() - (day === 5 ? 0 : (day > 5 ? day - 5 : 7 - (5 - day))));
  friday.setUTCHours(0, 0, 0, 0);
  return friday;
}
