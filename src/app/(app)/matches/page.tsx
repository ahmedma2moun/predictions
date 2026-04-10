import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeMatch } from "@/models/Match";
import { getStandingsMap, standingKey } from "@/lib/standings";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isMatchLocked } from "@/lib/utils";
import { KickoffTime } from "@/components/KickoffTime";
import { Lock, CheckCircle } from "lucide-react";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default async function MatchesPage() {
  const session = await auth();
  const userId = Number((session!.user as any).id);
  const isAdmin = (session!.user as any).role === "admin";

  const matches = await prisma.match.findMany({
    where: { status: { in: ["scheduled", "live"] } },
    orderBy: { kickoffTime: "asc" },
  });

  const predMap = new Map<number, { homeScore: number; awayScore: number }>();
  if (!isAdmin && matches.length > 0) {
    const matchIds = matches.map((m) => m.id);
    const predictions = await prisma.prediction.findMany({
      where: { userId, matchId: { in: matchIds } },
      select: { matchId: true, homeScore: true, awayScore: true },
    });
    predictions.forEach((p) => predMap.set(p.matchId, p));
  }

  // Fetch standings on the fly (cached in DB for 2 h to protect rate limits)
  const uniqueLeagues = [
    ...new Map(matches.map((m) => [m.externalLeagueId, { externalLeagueId: m.externalLeagueId, season: 0 }])).values(),
  ];
  const standingMap = matches.length > 0
    ? await getStandingsMap(uniqueLeagues)
    : new Map();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Upcoming Matches</h1>
      {matches.length === 0 ? (
        <p className="text-muted-foreground">No upcoming matches available.</p>
      ) : (
        matches.map((match) => {
          const s = serializeMatch(match);
          const locked = isMatchLocked(match.kickoffTime);
          const prediction = predMap.get(match.id) ?? null;
          const homeStanding = standingMap.get(standingKey(match.homeTeamExtId, match.externalLeagueId));
          const awayStanding = standingMap.get(standingKey(match.awayTeamExtId, match.externalLeagueId));

          return (
            <Link key={s._id} href={`/matches/${s._id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer mb-3">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      <KickoffTime date={match.kickoffTime} />
                    </span>
                    <div className="flex items-center gap-2">
                      {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {prediction && <CheckCircle className="h-3 w-3 text-green-500" />}
                      <Badge
                        variant={match.status === "live" ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {match.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {match.matchday && (
                    <p className="text-xs text-center text-muted-foreground mb-2">
                      Matchday {match.matchday}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex-1 text-center">
                      <p className="font-semibold text-sm">{s.homeTeam.name}</p>
                      {s.homeTeam.logo && (
                        <Image
                          src={s.homeTeam.logo}
                          alt={s.homeTeam.name}
                          width={32}
                          height={32}
                          className="mx-auto mt-1 object-contain"
                        />
                      )}
                      {homeStanding && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {ordinal(homeStanding.position)} · {homeStanding.points} pts
                        </p>
                      )}
                    </div>
                    <div className="px-4 text-center">
                      {prediction ? (
                        <div className="text-lg font-bold tabular-nums">
                          {prediction.homeScore} – {prediction.awayScore}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">vs</span>
                      )}
                    </div>
                    <div className="flex-1 text-center">
                      <p className="font-semibold text-sm">{s.awayTeam.name}</p>
                      {s.awayTeam.logo && (
                        <Image
                          src={s.awayTeam.logo}
                          alt={s.awayTeam.name}
                          width={32}
                          height={32}
                          className="mx-auto mt-1 object-contain"
                        />
                      )}
                      {awayStanding && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {ordinal(awayStanding.position)} · {awayStanding.points} pts
                        </p>
                      )}
                    </div>
                  </div>
                  {prediction && (
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Your prediction ✓
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })
      )}
    </div>
  );
}
