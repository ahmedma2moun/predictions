const DAY = 86_400_000;
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });

export function cairoDay(value: Date | string): string {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

// Find the first instant of a Cairo calendar date, including the DST day on
// which 00:00 does not exist. No dependency on the server's local timezone.
export function cairoDayStart(day: string): Date {
  const nominal = Date.parse(`${day}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 10) !== day) throw new Error('Invalid calendar date');
  let low = nominal - DAY;
  let high = nominal + DAY;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (cairoDay(new Date(mid)) < day) low = mid + 1;
    else high = mid;
  }
  return new Date(low);
}

export function gameWeekKey(value: Date | string, offset = 0) {
  const day = cairoDay(value);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const key = shiftDay(day, -((weekday - 5 + 7) % 7) + offset * 7);
  return key;
}

export function gameWeek(value: Date | string, offset = 0) {
  const key = gameWeekKey(value, offset);
  return { key, from: cairoDayStart(key), to: cairoDayStart(shiftDay(key, 7)) };
}
