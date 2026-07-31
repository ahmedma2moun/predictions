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

type DisplayEvent = MatchEvent & { icons: string[]; ownGoal: boolean };

function singleIcon(event: MatchEvent): { icon: string; ownGoal: boolean } {
  if (event.type === "goal") {
    const ownGoal = event.detail.toLowerCase().includes("own");
    return { icon: "⚽", ownGoal };
  }
  const isRed = event.detail.toLowerCase().includes("red");
  return { icon: isRed ? "🟥" : "🟨", ownGoal: false };
}

// A second-yellow dismissal comes back from TheSportsDB as two separate
// timeline entries — a Yellow Card immediately followed by a Red Card for
// the same player/minute/team. Collapse that pair into one event row
// showing both icons instead of two rows.
function toDisplayEvents(events: MatchEvent[]): DisplayEvent[] {
  const sorted = [...events].sort((a, b) => a.minute - b.minute);
  const used = new Set<number>();
  const result: DisplayEvent[] = [];

  sorted.forEach((e, i) => {
    if (used.has(i)) return;
    if (e.type === "card" && e.detail.toLowerCase().includes("yellow")) {
      const j = sorted.findIndex((o, idx) =>
        idx > i && !used.has(idx) && o.type === "card" &&
        o.detail.toLowerCase().includes("red") &&
        o.player === e.player && o.minute === e.minute && o.team === e.team
      );
      if (j !== -1) {
        used.add(i);
        used.add(j);
        result.push({ ...sorted[j], icons: ["🟨", "🟥"], ownGoal: false });
        return;
      }
    }
    used.add(i);
    const { icon, ownGoal } = singleIcon(e);
    result.push({ ...e, icons: [icon], ownGoal });
  });

  return result;
}

function EventIcon({ event }: { event: DisplayEvent }) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-0.5 h-5 ${event.icons.length > 1 ? "px-1" : "w-5"} rounded-full text-[11px] leading-none ${event.ownGoal ? "bg-live/15" : ""}`}
    >
      {event.icons.map((icon, i) => (
        <span key={i}>{icon}</span>
      ))}
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

  const displayEvents = toDisplayEvents(events);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Match Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {displayEvents.map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className={`flex-1 flex items-center justify-end gap-1.5 min-w-0 ${e.team !== "home" ? "invisible" : ""}`}>
              <span className="truncate text-right">{e.player}</span>
              <EventIcon event={e} />
            </div>
            <span className="shrink-0 w-9 text-center text-xs text-muted-foreground font-mono-nums">
              {e.minute}&apos;
            </span>
            <div className={`flex-1 flex items-center gap-1.5 min-w-0 ${e.team !== "away" ? "invisible" : ""}`}>
              <EventIcon event={e} />
              <span className="truncate">{e.player}</span>
            </div>
          </div>
        ))}
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
