import { auth, getSessionUser } from "@/lib/auth";
import { serializeMatch } from "@/models/Match";
import { getStandingsMap, standingKey } from "@/lib/standings";
import { formatStage, isKnockoutStage } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { KickoffTime } from "@/components/KickoffTime";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { cn } from "@/lib/utils";

export default async function MatchesPage() {
  const session = await auth();
  const { id: userId, role } = getSessionUser(session!);
  const isAdmin = role === "admin";

  const matches = await MatchRepository.findMany({
    where: { status: { in: ["scheduled", "live"] } },
    orderBy: { kickoffTime: "asc" },
    include: { league: { select: { name: true } } },
  });

  const matchIds = matches.map((m) => m.id);
  const uniqueLeagues = [
    ...new Map(matches.map((m) => [m.externalLeagueId, { externalLeagueId: m.externalLeagueId, season: 0 }])).values(),
  ];

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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
      <h1 className="text-2xl font-bold">Upcoming Matches</h1>
      {matches.length === 0 ? (
        <p className="text-muted-foreground">No upcoming matches available.</p>
      ) : (
        matches.map((match) => {
          const serialized = serializeMatch(match);
          const prediction = predMap.get(match.id) ?? null;
          const homeStanding = standingMap.get(standingKey(match.homeTeamExtId, match.externalLeagueId));
          const awayStanding = standingMap.get(standingKey(match.awayTeamExtId, match.externalLeagueId));
          const locked = new Date() >= new Date(match.kickoffTime);
          const isLive = match.status === "live";

          // Competition label: "MATCHDAY 35 · PREMIER LEAGUE"
          const leagueName = (match as any).league?.name as string | undefined;
          const compParts: string[] = [];
          if (match.matchday) {
            compParts.push(`MATCHDAY ${match.matchday}`);
          } else if (isKnockoutStage(serialized.stage)) {
            compParts.push(formatStage(serialized.stage!).toUpperCase());
          }
          if (leagueName) compParts.push(leagueName.toUpperCase());
          const competitionLabel = compParts.join(" · ") || "MATCH";

          return (
            <Link key={serialized._id} href={`/matches/${serialized._id}`}>
              <div
                className={cn(
                  "rounded-[14px] border border-border bg-card overflow-hidden transition-colors hover:border-primary/40",
                  "mb-1"
                )}
              >
                {/* Top strip */}
                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-[10px]",
                    isLive && "bg-[rgba(255,77,109,0.06)]"
                  )}
                >
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground truncate">
                    {competitionLabel}
                  </span>
                  <div className="shrink-0 ml-2">
                    {isLive ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(255,77,109,0.12)] border border-[rgba(255,77,109,0.30)] text-live text-[10px] font-bold uppercase">
                        <span className="animate-live inline-block h-1.5 w-1.5 rounded-full bg-live" />
                        LIVE
                      </span>
                    ) : locked ? (
                      <span className="px-2.5 py-1 rounded-full border border-border text-muted-foreground text-[10px] font-bold uppercase">
                        LOCKED
                      </span>
                    ) : prediction ? (
                      <span className="px-2.5 py-1 rounded-full bg-primary-soft border border-primary-soft-border text-primary text-[10px] font-bold uppercase">
                        PICKED
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Body — 3-col grid */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-2">
                  {/* Home team */}
                  <div className="flex flex-col items-center gap-1.5">
                    {serialized.homeTeam.logo ? (
                      <Image
                        src={serialized.homeTeam.logo}
                        alt={serialized.homeTeam.name}
                        width={36}
                        height={36}
                        className="object-contain"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-card-elevated" />
                    )}
                    <p className="text-sm font-semibold text-center leading-tight">{serialized.homeTeam.name}</p>
                    {homeStanding && (
                      <p className="text-[10.5px] text-muted-foreground font-mono-nums">
                        #{homeStanding.position} · {homeStanding.points} pts
                      </p>
                    )}
                  </div>

                  {/* Score chip */}
                  <div className="flex flex-col items-center justify-center">
                    {prediction ? (
                      <div className="min-w-[70px] px-[14px] py-1 rounded-md text-center bg-primary-soft border border-primary-soft-border text-primary font-mono-nums text-[19px] font-bold">
                        {prediction.homeScore}–{prediction.awayScore}
                      </div>
                    ) : isLive ? (
                      <div className="min-w-[70px] px-[14px] py-1 rounded-md text-center bg-card-elevated border border-border text-foreground font-mono-nums text-xl font-bold">
                        –
                      </div>
                    ) : (
                      <span className="text-xs font-semibold uppercase text-muted-foreground">VS</span>
                    )}
                  </div>

                  {/* Away team */}
                  <div className="flex flex-col items-center gap-1.5">
                    {serialized.awayTeam.logo ? (
                      <Image
                        src={serialized.awayTeam.logo}
                        alt={serialized.awayTeam.name}
                        width={36}
                        height={36}
                        className="object-contain"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-card-elevated" />
                    )}
                    <p className="text-sm font-semibold text-center leading-tight">{serialized.awayTeam.name}</p>
                    {awayStanding && (
                      <p className="text-[10.5px] text-muted-foreground font-mono-nums">
                        #{awayStanding.position} · {awayStanding.points} pts
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                {!locked && (
                  <div className="border-t border-dashed border-border mt-[14px] pt-3 px-4 pb-[14px] flex items-center justify-between">
                    <span className="text-[11.5px] text-muted-foreground">
                      <KickoffTime date={match.kickoffTime} />
                    </span>
                    <DeadlineCountdown kickoffTime={match.kickoffTime} compact />
                  </div>
                )}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}

