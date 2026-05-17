import { auth } from "@/lib/auth";
import { SeasonService } from "@/lib/services/season-service";
import { getLeaderboard } from "@/lib/services/leaderboard-service";
import { prisma } from "@/lib/prisma";

const MEDALS = ["🥇", "🥈", "🥉"];

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDuration(start: Date, end: Date) {
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""}`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks !== 1 ? "s" : ""}`;
}

function PodiumRow({ rank, name, points }: { rank: number; name: string | null; points: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-lg w-6 text-center">{MEDALS[rank - 1] ?? `#${rank}`}</span>
      <span className="font-medium flex-1 truncate">{name ?? "Unknown"}</span>
      <span className="text-sm font-mono text-muted-foreground">{points} pts</span>
    </div>
  );
}

export default async function SeasonsPage() {
  await auth();

  const seasons = await SeasonService.getPublicSeasons();

  const activeSeason = seasons.find(s => s.status === "ACTIVE") ?? null;
  const endedSeasons = seasons.filter(s => s.status === "ENDED");

  // For active season, get live leaderboard (top 5 overall)
  let liveLeaderboard: Array<{ userId: number; name: string | null; totalPoints: number }> = [];
  let liveMatchCount = 0;
  if (activeSeason) {
    const [entries, matchCount] = await Promise.all([
      getLeaderboard({ seasonId: activeSeason.id }),
      prisma.match.count({ where: { seasonId: activeSeason.id } }),
    ]);
    liveLeaderboard = entries.slice(0, 5).map(e => ({
      userId: e.userId,
      name: e.name,
      totalPoints: e.totalPoints,
    }));
    liveMatchCount = matchCount;
  }

  // For ended seasons, fetch standings with user info
  const endedWithStandings = await Promise.all(
    endedSeasons.map(s => SeasonService.getSeasonWithStandings(s.id))
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold">Seasons</h1>

      {/* Active Season */}
      {activeSeason && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Current Season</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30 font-medium">
              In Progress
            </span>
          </div>

          <div className="rounded-[14px] border border-green-500/30 bg-card p-4 space-y-4">
            <div>
              <p className="font-semibold text-base">{activeSeason.name}</p>
              {activeSeason.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{activeSeason.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Started {formatDate(activeSeason.startDate)} · {liveMatchCount} match{liveMatchCount !== 1 ? "es" : ""}
              </p>
            </div>

            {liveLeaderboard.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Live Standings</p>
                <div className="divide-y divide-border">
                  {liveLeaderboard.map((entry, idx) => (
                    <PodiumRow key={entry.userId} rank={idx + 1} name={entry.name} points={entry.totalPoints} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No scored predictions yet — be the first!</p>
            )}
          </div>
        </section>
      )}

      {/* Ended Seasons */}
      {endedWithStandings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Past Seasons</h2>
          <div className="space-y-4">
            {endedWithStandings.map(season => {
              if (!season) return null;

              const overallTop3 = season.standings
                .filter(s => s.groupId === null)
                .sort((a, b) => a.rank - b.rank)
                .slice(0, 3);

              const groupMap = new Map<number, typeof season.standings>();
              for (const s of season.standings.filter(s => s.groupId !== null)) {
                const arr = groupMap.get(s.groupId!) ?? [];
                arr.push(s);
                groupMap.set(s.groupId!, arr);
              }

              return (
                <div key={season.id} className="rounded-[14px] border border-border bg-card p-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-base">{season.name}</p>
                    </div>
                    {season.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{season.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(season.startDate)}
                      {season.endedAt && ` → ${formatDate(season.endedAt)} · ${formatDuration(season.startDate, season.endedAt)}`}
                    </p>
                  </div>

                  {overallTop3.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Overall Champions</p>
                      <div className="divide-y divide-border">
                        {overallTop3.map(s => (
                          <PodiumRow key={s.id} rank={s.rank} name={s.userName} points={s.totalPoints} />
                        ))}
                      </div>
                    </div>
                  )}

                  {groupMap.size > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Group Champions</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[...groupMap.entries()].map(([, entries]) => {
                          const sorted = [...entries].sort((a, b) => a.rank - b.rank);
                          const groupName = sorted[0]?.groupName ?? "Group";
                          const winner = sorted[0];
                          if (!winner) return null;
                          return (
                            <div key={groupName} className="rounded-lg bg-card-elevated border border-border px-3 py-2">
                              <p className="text-xs text-muted-foreground mb-1">{groupName}</p>
                              <div className="flex items-center gap-2">
                                <span>🥇</span>
                                <span className="font-medium text-sm truncate">{winner.userName ?? "Unknown"}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{winner.totalPoints} pts</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {overallTop3.length === 0 && (
                    <p className="text-sm text-muted-foreground">No predictions were scored in this season.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!activeSeason && endedWithStandings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-base font-medium">No seasons yet</p>
          <p className="text-sm mt-1">Check back when a season is started by the admin.</p>
        </div>
      )}
    </div>
  );
}
