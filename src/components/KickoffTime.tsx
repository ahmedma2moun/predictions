"use client";

interface KickoffTimeProps {
  date: string | Date;
  weekdayOnly?: boolean;
}

export function KickoffTime({ date, weekdayOnly }: KickoffTimeProps) {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatted = weekdayOnly
    ? d.toLocaleDateString(undefined, { weekday: "short" })
    : d.toLocaleString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
  return <>{formatted}</>;
}
