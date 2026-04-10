"use client";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { isMatchLocked } from "@/lib/utils";

/**
 * Renders a lock icon that automatically appears when the match kickoff time
 * is reached — even if the user has the page open since before kickoff.
 * Uses a one-shot setTimeout to avoid polling.
 */
export function LiveLockIcon({ kickoffTime }: { kickoffTime: Date | string }) {
  const [locked, setLocked] = useState(() => isMatchLocked(kickoffTime));

  useEffect(() => {
    if (locked) return;
    const ms = new Date(kickoffTime).getTime() - Date.now();
    if (ms <= 0) { setLocked(true); return; }
    const timer = setTimeout(() => setLocked(true), ms);
    return () => clearTimeout(timer);
  }, [kickoffTime, locked]);

  if (!locked) return null;
  return <Lock className="h-3 w-3 text-muted-foreground" />;
}
