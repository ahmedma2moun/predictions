"use client";
import { useEffect, useState } from "react";

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
      ? `${days}d ${remainHours}h left to predict`
      : `${days}d left to predict`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left to predict`;
  if (totalMinutes > 0) return `${totalMinutes}m left to predict`;
  return "< 1m left to predict";
}

export function DeadlineCountdown({ kickoffTime }: { kickoffTime: Date | string }) {
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
  return <p className="text-xs text-center text-amber-500 font-medium mt-1">⏱ {label}</p>;
}
