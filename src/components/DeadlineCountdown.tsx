"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function getLabel(kickoffTime: Date | string): string | null {
  const ms = new Date(kickoffTime).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return remainHours > 0
      ? `${days}d ${remainHours}h to predict`
      : `${days}d to predict`;
  }
  if (hours > 0) return `${hours}h ${minutes}m to predict`;
  if (totalMinutes > 0) return `${totalMinutes}m to predict`;
  return "< 1m to predict";
}

export function DeadlineCountdown({
  kickoffTime,
  compact = false,
}: {
  kickoffTime: Date | string;
  compact?: boolean;
}) {
  const [label, setLabel] = useState(() => getLabel(kickoffTime));

  useEffect(() => {
    const intervalId = setInterval(() => setLabel(getLabel(kickoffTime)), 30_000);
    const ms = new Date(kickoffTime).getTime() - Date.now();
    const timeoutId = ms > 0 ? setTimeout(() => { setLabel(null); clearInterval(intervalId); }, ms) : null;
    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [kickoffTime]);

  if (!label) return null;

  if (compact) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold font-mono-nums text-warning">
        <Clock className="h-3 w-3 shrink-0" />
        {label}
      </span>
    );
  }

  return <p className="text-xs text-center text-amber-500 font-medium mt-1">⏱ {label}</p>;
}
