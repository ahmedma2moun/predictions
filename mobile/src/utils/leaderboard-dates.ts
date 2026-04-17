export function getWeekBounds(offset: number) {
  const now = new Date();
  const daysSinceFriday = (now.getDay() - 5 + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() - daysSinceFriday + offset * 7);
  friday.setHours(0, 0, 0, 0);
  const next = new Date(friday);
  next.setDate(friday.getDate() + 7);
  return { from: friday, to: next };
}

export function getMonthBounds(offset: number) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from, to };
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function fmtMonthYear(d: Date) {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
