"use client";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type TeamFormMatch = {
  date: string;
  opponentName: string;
  opponentLogo: string | null;
  isHome: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  penaltyTeamScore: number | null;
  penaltyOpponentScore: number | null;
  result: "W" | "D" | "L" | null;
  competition: string;
  status: string;
};

const resultBadgeClass: Record<"W" | "D" | "L", string> = {
  W: "bg-emerald-500/15 text-emerald-500",
  D: "bg-muted text-muted-foreground",
  L: "bg-red-500/15 text-red-500",
};

function FormColumn({ teamName, matches }: { teamName?: string; matches: TeamFormMatch[] }) {
  return (
    <div className="flex-1 min-w-0 space-y-2">
      <p className="text-xs font-medium truncate">{teamName ?? "—"}</p>
      <div className="flex gap-1">
        {matches.map((m, i) => (
          <span
            key={i}
            className={`h-5 w-5 flex-shrink-0 rounded flex items-center justify-center text-[10px] font-bold ${m.result ? resultBadgeClass[m.result] : "bg-muted text-muted-foreground"}`}
          >
            {m.result ?? "–"}
          </span>
        ))}
      </div>
      <div className="space-y-1.5">
        {matches.map((m, i) => (
          <div key={i} className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1 min-w-0">
              {m.opponentLogo && (
                <Image src={m.opponentLogo} alt={m.opponentName} width={14} height={14} className="object-contain flex-shrink-0" />
              )}
              <span className="truncate text-muted-foreground">
                {m.isHome ? "vs" : "@"} {m.opponentName}
              </span>
            </div>
            <span className="flex-shrink-0 font-semibold tabular-nums">
              {m.teamScore ?? "–"}-{m.opponentScore ?? "–"}
            </span>
          </div>
        ))}
        {matches.length === 0 && (
          <p className="text-xs text-muted-foreground">No recent games</p>
        )}
      </div>
    </div>
  );
}

export function MatchForm({
  home,
  away,
  loading,
  homeTeamName,
  awayTeamName,
}: {
  home: TeamFormMatch[] | null;
  away: TeamFormMatch[] | null;
  loading: boolean;
  homeTeamName?: string;
  awayTeamName?: string;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Form</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map(col => (
              <div key={col} className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                {[0, 1, 2, 3, 4].map(row => (
                  <div key={row} className="h-4 w-full rounded bg-muted animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if ((!home || home.length === 0) && (!away || away.length === 0)) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Form</CardTitle>
        <p className="text-xs text-muted-foreground">Last 5 games</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <FormColumn teamName={homeTeamName} matches={home ?? []} />
          <FormColumn teamName={awayTeamName} matches={away ?? []} />
        </div>
      </CardContent>
    </Card>
  );
}
