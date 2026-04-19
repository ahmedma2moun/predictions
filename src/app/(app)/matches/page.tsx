import { auth, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeMatch } from "@/models/Match";
import { getStandingsMap, standingKey } from "@/lib/standings";
import { formatStage, isKnockoutStage, ordinal } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KickoffTime } from "@/components/KickoffTime";
import { LiveLockIcon } from "@/components/LiveLockIcon";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import { CheckCircle } from "lucide-react";
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';

export default async function MatchesPage() {
  const session = await auth();
  const { id: userId, role } = getSessionUser(session!);
  const isAdmin = role === "admin";

  const matches = await MatchRepository.findMany({
    where: { status: { in: ["scheduled", "live"] } },
    orderBy: { kickoffTime: "asc" },
  });

  const matchIds = matches.map((m) => m.id);
  const uniqueLeagues = [
    ...new Map(matches.map((m) => [m.externalLeagueId, { externalLeagueId: m.externalLeagueId, season: 0 }])).values(),
  ];

  // Fetch predictions and standings in parallel — both are independent once we have matchIds
  const [predictions, standingMap] = await Promise.all([
    !isAdmin && matchIds.length > 0
      ? PredictionRepository.findMany({
          where: { userId, matchId: { in: matchIds } },
          select: { matchId: true, homeScore: true, awayScore: true },
        })
      : Promise.resolve([] as { matchId: number; homeScore: number; awayScore: number }[]),
    matches.length > 0 ? getStandingsMap(uniqueLeagues) : Promise.resolve(new Map()),
  ]);

  const predMap = new Map<number, { homeScore: number; awayScore: number }>();
  predictions.forEach((p) => predMap.set(p.matchId, p));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Upcoming Matches</h1>
      {matches.length === 0 ? (
        <p className="text-muted-foreground">No upcoming matches available.</p>
      ) : (
        matches.map((match) => {
          const serialized = serializeMatch(match);
          const prediction = predMap.get(match.id) ?? null;
          const homeStanding = standingMap.get(standingKey(match.homeTeamExtId, match.externalLeagueId));
          const awayStanding = standingMap.get(standingKey(match.awayTeamExtId, match.externalLeagueId));

          return (
            <Link key={serialized._id} href={`/matches/${serialized._id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer mb-3">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      <KickoffTime date={match.kickoffTime} />
                    </span>
                    <div className="flex items-center gap-2">
                      <LiveLockIcon kickoffTime={match.kickoffTime} />
                      {prediction && <CheckCircle className="h-3 w-3 text-green-500" />}
                      <Badge
                        variant={match.status === "live" ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {match.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <DeadlineCountdown kickoffTime={match.kickoffTime} />

                  {isKnockoutStage(serialized.stage) ? (
                    <p className="text-xs text-center text-muted-foreground mb-2">
                      {formatStage(serialized.stage!)}{serialized.leg ? ` · Leg ${serialized.leg}` : ''}
                    </p>
                  ) : match.matchday ? (
                    <p className="text-xs text-center text-muted-foreground mb-2">
                      Matchday {match.matchday}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <div className="flex-1 text-center">
                      <p className="font-semibold text-sm">{serialized.homeTeam.name}</p>
                      {serialized.homeTeam.logo && (
                        <Image
                          src={serialized.homeTeam.logo}
                          alt={serialized.homeTeam.name}
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
                      <p className="font-semibold text-sm">{serialized.awayTeam.name}</p>
                      {serialized.awayTeam.logo && (
                        <Image
                          src={serialized.awayTeam.logo}
                          alt={serialized.awayTeam.name}
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
