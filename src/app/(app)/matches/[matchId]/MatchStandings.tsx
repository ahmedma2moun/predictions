"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ordinal } from "@/lib/utils";

export type Standing = {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDifference: number;
  form: string | null;
} | null;

function StandingsRow({ label, standing }: { label: string; standing: Standing }) {
  if (!standing) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="font-medium w-20 truncate text-xs text-muted-foreground">{label}</span>
      <span className="font-bold w-8 text-center">{ordinal(standing.position)}</span>
      <span className="text-muted-foreground text-xs w-12 text-center">
        {standing.won}W {standing.drawn}D {standing.lost}L
      </span>
      <span className="font-semibold w-10 text-center">{standing.points} pts</span>
    </div>
  );
}

export function MatchStandings({
  homeTeamName,
  awayTeamName,
  standings,
}: {
  homeTeamName: string;
  awayTeamName: string;
  standings: { home: Standing; away: Standing };
}) {
  const hasStandings = standings.home !== null || standings.away !== null;
  if (!hasStandings) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">League Standings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-0 mb-1">
          <span className="w-20" />
          <span className="w-8 text-center">Pos</span>
          <span className="w-12 text-center">Record</span>
          <span className="w-10 text-center">Pts</span>
        </div>
        <StandingsRow label={homeTeamName} standing={standings.home} />
        <StandingsRow label={awayTeamName} standing={standings.away} />
      </CardContent>
    </Card>
  );
}
