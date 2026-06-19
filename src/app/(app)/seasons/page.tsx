"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const MEDAL_COLORS = ["#F2C744", "#C5CDD9", "#CB8C5C"] as const;
const TOWER_HEIGHTS = ["h-[86px]", "h-12", "h-[62px]"] as const;
const PODIUM_ORDER = [1, 0, 2] as const;

type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  totalPoints: number;
};

type Season = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string;
  startedAt: string | null;
  endedAt: string | null;
};

type StandingEntry = {
  id: string;
  rank: number;
  totalPoints: number;
  groupId: number | null;
  groupName: string | null;
  userId: string;
  userName: string | null;
};

type SeasonWithStandings = Season & { standings: StandingEntry[] };

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function PodiumTower({
  entry, rank, medalColor, towerHeight, isMe,
}: {
  entry: { name: string; totalPoints: number };
  rank: number;
  medalColor: string;
  towerHeight: string;
  isMe: boolean;
}) {
  const initials = entry.name.slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border-2",
          isMe ? "border-primary text-primary" : "border-border text-foreground",
        )}
        style={{ background: `${medalColor}22` }}
      >
        {initials}
      </div>
      <p className="text-[11px] font-semibold text-center leading-tight max-w-[60px] truncate">{entry.name}</p>
      <p className="text-[11px] font-mono-nums text-muted-foreground">{entry.totalPoints}</p>
      <div
        className={cn("w-full rounded-t-[14px] border-t border-x flex items-center justify-center", towerHeight)}
        style={{ background: `${medalColor}33`, borderColor: `${medalColor}55` }}
      >
        <span className="text-xl font-[800]" style={{ color: medalColor }}>{rank}</span>
      </div>
    </div>
  );
}

function Podium({
  entries, myId,
}: {
  entries: Array<{ userId: string; name: string; totalPoints: number }>;
  myId?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_1.2fr_1fr] items-end gap-2 px-2 pb-4">
      {PODIUM_ORDER.map((entryIdx, colIdx) => {
        const entry = entries[entryIdx];
        if (!entry) return <div key={colIdx} />;
        const rank = entryIdx + 1;
        const medalColor = MEDAL_COLORS[entryIdx];
        const towerHeight = colIdx === 1 ? TOWER_HEIGHTS[0] : colIdx === 0 ? TOWER_HEIGHTS[2] : TOWER_HEIGHTS[1];
        return (
          <PodiumTower
            key={entry.userId}
            entry={entry}
            rank={rank}
            medalColor={medalColor}
            towerHeight={towerHeight}
            isMe={entry.userId === myId}
          />
        );
      })}
    </div>
  );
}

function CompactRow({
  rank, entry, isMe,
}: {
  rank: number;
  entry: { userId: string; name: string; totalPoints: number };
  isMe: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border px-[14px] py-[11px] flex items-center gap-[10px]",
        isMe ? "bg-primary-soft border-primary-soft-border" : "bg-card border-border",
      )}
    >
      <span className="w-[26px] text-[13px] font-bold font-mono-nums text-muted-foreground shrink-0 text-center">
        {rank}
      </span>
      <div className="h-7 w-7 rounded-full bg-card-elevated border border-border flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold">{entry.name.slice(0, 2).toUpperCase()}</span>
      </div>
      <p className="text-[13px] font-semibold flex-1 truncate">{entry.name}</p>
      {isMe && <span className="text-[10px] font-bold uppercase text-primary shrink-0">YOU</span>}
      <span className="text-[14px] font-bold font-mono-nums shrink-0">{entry.totalPoints}</span>
    </div>
  );
}

function StandingsList({
  entries, myId,
}: {
  entries: Array<{ userId: string; name: string; totalPoints: number }>;
  myId?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No predictions scored yet.</p>;
  }

  const showPodium = entries.length >= 3;
  const compactEntries = showPodium ? entries.slice(3) : entries;

  return (
    <div className="space-y-2">
      {showPodium && <Podium entries={entries} myId={myId} />}
      {compactEntries.map((entry, idx) => (
        <CompactRow
          key={entry.userId}
          rank={showPodium ? idx + 4 : idx + 1}
          entry={entry}
          isMe={entry.userId === myId}
        />
      ))}
    </div>
  );
}

function SeasonCard({ season, myId }: { season: SeasonWithStandings; myId?: string }) {
  const [open, setOpen] = useState(false);

  const filteredEntries = useMemo(() => {
    return season.standings
      .filter(s => s.groupId === null)
      .sort((a, b) => a.rank - b.rank)
      .map(s => ({ userId: s.userId, name: s.userName ?? "Unknown", totalPoints: s.totalPoints }));
  }, [season.standings]);

  return (
    <div className="rounded-[14px] border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="font-semibold text-base">{season.name}</p>
          {season.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{season.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(season.startDate)}
            {season.endedAt && ` → ${formatDate(season.endedAt)}`}
          </p>
        </div>
        <ChevronDown
          className={cn("h-5 w-5 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <StandingsList entries={filteredEntries} myId={myId} />
        </div>
      )}
    </div>
  );
}

export default function SeasonsPage() {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id;

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [endedStandings, setEndedStandings] = useState<SeasonWithStandings[]>([]);
  const [seasonsLoaded, setSeasonsLoaded] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const activeSeason = useMemo(() => seasons.find(s => s.status === "ACTIVE") ?? null, [seasons]);

  useEffect(() => {
    fetch("/api/seasons")
      .then(r => r.ok ? r.json() : [])
      .then((data: Season[]) => { setSeasons(data); setSeasonsLoaded(true); })
      .catch(() => setSeasonsLoaded(true));
  }, []);

  useEffect(() => {
    const ended = seasons.filter(s => s.status === "ENDED");
    if (ended.length === 0) return;
    Promise.all(
      ended.map(s =>
        fetch(`/api/seasons/${s.id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ),
    ).then(data => setEndedStandings(data.filter(Boolean)));
  }, [seasons]);

  useEffect(() => {
    if (!activeSeason) {
      if (seasonsLoaded) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch("/api/leaderboard?period=all")
      .then(r => r.ok ? r.json() : [])
      .then((data: LeaderboardEntry[]) => { setLeaderboard(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [activeSeason, seasonsLoaded]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Seasons</h1>

      {activeSeason && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{activeSeason.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30 font-medium">
              In Progress
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-[14px] border border-border">
                  <Skeleton className="h-4 w-6 rounded" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 flex-1 rounded" />
                  <Skeleton className="h-6 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <StandingsList
              entries={leaderboard.map(e => ({ userId: e.userId, name: e.name, totalPoints: e.totalPoints }))}
              myId={myId}
            />
          )}
        </section>
      )}

      {endedStandings.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Past Seasons</h2>
          <div className="space-y-4">
            {endedStandings.map(s => (
              <SeasonCard key={s.id} season={s} myId={myId} />
            ))}
          </div>
        </section>
      )}

      {seasonsLoaded && !activeSeason && endedStandings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-base font-medium">No seasons yet</p>
          <p className="text-sm mt-1">Check back when a season is started by the admin.</p>
        </div>
      )}
    </div>
  );
}
