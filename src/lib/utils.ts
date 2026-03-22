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

export function getFridayDate(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 5=Fri
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setUTCDate(now.getUTCDate() - (day === 5 ? 0 : (day > 5 ? day - 5 : 7 - (5 - day))));
  friday.setUTCHours(0, 0, 0, 0);
  return friday;
}
