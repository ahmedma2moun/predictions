"use client";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type H2HMatch = {
  date: string;
  homeTeam: { name: string; logo: string };
  awayTeam: { name: string; logo: string };
  homeScore: number | null;
  awayScore: number | null;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
  competition: string;
  status: string;
};

function formatH2HDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}

function teamsMatch(h2hName: string, upcomingName: string): boolean {
  const a = h2hName.toLowerCase().trim();
  const b = upcomingName.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

function computeSummary(h2h: H2HMatch[], homeTeamName: string, awayTeamName: string) {
  const done = h2h.filter(m => m.homeScore !== null && m.awayScore !== null);
  if (done.length === 0) return null;

  let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0;
  for (const m of done) {
    const hs = m.homeScore!, as = m.awayScore!;
    totalGoals += hs + as;
    const leftIsHome = teamsMatch(m.homeTeam.name, homeTeamName);
    if (hs > as)      leftIsHome ? homeWins++ : awayWins++;
    else if (as > hs) leftIsHome ? awayWins++ : homeWins++;
    else              draws++;
  }

  const last = done[0];
  return {
    homeWins, draws, awayWins,
    avgGoals: Math.round((totalGoals / done.length) * 10) / 10,
    last: { homeScore: last.homeScore!, awayScore: last.awayScore! },
  };
}

export function MatchH2H({
  h2h,
  loading,
  homeTeamName,
  awayTeamName,
}: {
  h2h: H2HMatch[] | null;
  loading: boolean;
  homeTeamName?: string;
  awayTeamName?: string;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Head to Head</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-5 w-full rounded bg-muted animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!h2h || h2h.length === 0) return null;

  const summary = homeTeamName && awayTeamName
    ? computeSummary(h2h, homeTeamName, awayTeamName)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Head to Head</CardTitle>
        <p className="text-xs text-muted-foreground">
          Last {h2h.length} meeting{h2h.length !== 1 ? "s" : ""}
        </p>
        {summary && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center text-sm">
              <div className="flex-1 text-center">
                <p className="font-bold">{summary.homeWins}</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[80px] mx-auto">{homeTeamName}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="font-bold">{summary.draws}</p>
                <p className="text-[10px] text-muted-foreground">Draw</p>
              </div>
              <div className="flex-1 text-center">
                <p className="font-bold">{summary.awayWins}</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[80px] mx-auto">{awayTeamName}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
              <span>Avg {summary.avgGoals} goals/game</span>
              <span>Last: {summary.last.homeScore} – {summary.last.awayScore}</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {h2h.map((m, i) => {
          const winner =
            m.homeScore !== null && m.awayScore !== null
              ? m.homeScore > m.awayScore ? "home"
              : m.awayScore > m.homeScore ? "away"
              : "draw"
              : null;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{formatH2HDate(m.date)}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[140px] text-right">{m.competition}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`flex-1 flex items-center gap-1.5 min-w-0 ${winner === "home" ? "font-semibold" : winner !== null && winner !== "draw" ? "text-muted-foreground" : ""}`}>
                  {m.homeTeam.logo && <Image src={m.homeTeam.logo} alt={m.homeTeam.name} width={16} height={16} className="object-contain flex-shrink-0" />}
                  <span className="truncate">{m.homeTeam.name}</span>
                </div>
                <div className="flex-shrink-0 w-14 text-center">
                  <span className="font-bold tabular-nums text-sm">
                    {m.homeScore ?? "–"} – {m.awayScore ?? "–"}
                  </span>
                  {m.penaltyHomeScore != null && (
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      ({m.penaltyHomeScore} – {m.penaltyAwayScore} pen)
                    </p>
                  )}
                </div>
                <div className={`flex-1 flex items-center justify-end gap-1.5 min-w-0 ${winner === "away" ? "font-semibold" : winner !== null && winner !== "draw" ? "text-muted-foreground" : ""}`}>
                  <span className="truncate text-right">{m.awayTeam.name}</span>
                  {m.awayTeam.logo && <Image src={m.awayTeam.logo} alt={m.awayTeam.name} width={16} height={16} className="object-contain flex-shrink-0" />}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
