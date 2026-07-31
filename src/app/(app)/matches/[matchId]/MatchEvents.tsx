"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type MatchEvent = {
  type: "goal" | "card";
  detail: string;
  minute: number;
  team: "home" | "away";
  player: string;
  assistPlayer?: string | null;
};

function eventBadge(event: MatchEvent): { icon: string; label: string; ownGoal: boolean } {
  if (event.type === "goal") {
    const ownGoal = event.detail.toLowerCase().includes("own");
    return { icon: "⚽", label: ownGoal ? "Own Goal" : "Goal", ownGoal };
  }
  const isRed = event.detail.toLowerCase().includes("red");
  return { icon: isRed ? "🟥" : "🟨", label: isRed ? "Red Card" : "Yellow Card", ownGoal: false };
}

function EventIcon({ event }: { event: MatchEvent }) {
  const { icon, ownGoal } = eventBadge(event);
  return (
    <span
      className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] leading-none ${ownGoal ? "bg-live/15" : ""}`}
    >
      {icon}
    </span>
  );
}

export function MatchEvents({
  events,
  homeTeamName,
  awayTeamName,
}: {
  events: MatchEvent[] | null | undefined;
  homeTeamName?: string;
  awayTeamName?: string;
}) {
  if (!events || events.length === 0) return null;

  const sorted = [...events].sort((a, b) => a.minute - b.minute);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Match Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((e, i) => {
          const { label, ownGoal } = eventBadge(e);
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className={`flex-1 flex flex-col items-end gap-0.5 min-w-0 ${e.team !== "home" ? "invisible" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-right">{e.player}</span>
                  <EventIcon event={e} />
                </div>
                <span className={`text-[10px] ${ownGoal ? "text-live" : "text-muted-foreground"}`}>{label}</span>
              </div>
              <span className="shrink-0 w-9 text-center text-xs text-muted-foreground font-mono-nums">
                {e.minute}&apos;
              </span>
              <div className={`flex-1 flex flex-col items-start gap-0.5 min-w-0 ${e.team !== "away" ? "invisible" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <EventIcon event={e} />
                  <span className="truncate">{e.player}</span>
                </div>
                <span className={`text-[10px] ${ownGoal ? "text-live" : "text-muted-foreground"}`}>{label}</span>
              </div>
            </div>
          );
        })}
        {(homeTeamName || awayTeamName) && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border">
            <span className="truncate max-w-[45%]">{homeTeamName}</span>
            <span className="truncate max-w-[45%] text-right">{awayTeamName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
