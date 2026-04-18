export type Period = "all" | "month" | "week";

export function getWeekBounds(offset: number): { from: Date; to: Date } {
  const now = new Date();
  const daysSinceFriday = (now.getDay() - 5 + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() - daysSinceFriday + offset * 7);
  friday.setHours(0, 0, 0, 0);
  const nextFriday = new Date(friday);
  nextFriday.setDate(friday.getDate() + 7);
  return { from: friday, to: nextFriday };
}

export function getMonthBounds(offset: number): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from, to };
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function computeWeekLabel(offset: number): string {
  const { from, to } = getWeekBounds(offset);
  const thursdayEnd = new Date(to);
  thursdayEnd.setDate(to.getDate() - 1);
  return `${fmtDate(from)} – ${fmtDate(thursdayEnd)}`;
}

export function computeMonthLabel(offset: number): string {
  return fmtMonthYear(getMonthBounds(offset).from);
}

export function getDateRange(
  period: Period,
  weekOffset: number,
  monthOffset: number,
): { from: Date; to: Date } | null {
  if (period === "week")  return getWeekBounds(weekOffset);
  if (period === "month") return getMonthBounds(monthOffset);
  return null;
}
