"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { KickoffTime } from "@/components/KickoffTime";
import { useChampionBonus, type AllowedTeam, type RevealTeam, type ChampionState } from "./useChampionBonus";

const LOGO_SIZES = {
  6: "h-6 w-6",
  7: "h-7 w-7",
  12: "h-12 w-12",
} as const;

function TeamLogo({ logo, name, size = 6 }: { logo: string | null; name: string; size?: keyof typeof LOGO_SIZES }) {
  const sizeClass = LOGO_SIZES[size];
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className={cn(sizeClass, "object-contain")} />;
  }
  return (
    <div className={cn(sizeClass, "rounded-full bg-card-elevated border border-border flex items-center justify-center text-[10px] font-bold shrink-0")}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[14px] border border-border bg-card px-6 py-10 text-center space-y-3">
      <p className="text-4xl">👑</p>
      <p className="font-semibold text-base">Champion Bonus isn&apos;t running right now</p>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Each season the admin picks one league and a subset of its teams. You choose one team as your
        champion — once picks lock, every game your champion plays doubles the bonus:
        <br />
        <span className="font-medium text-foreground">Win 1 = 2 pts · Win 2 = 4 · Win 3 = 8 …</span>
        <br />
        Draws and losses still double the next stake, so it&apos;s a gamble!
      </p>
    </div>
  );
}

function PickCard({
  team,
  isPicked,
  isPicking,
  onPick,
}: {
  team: AllowedTeam;
  isPicked: boolean;
  isPicking: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      disabled={isPicking}
      className={cn(
        "flex flex-col items-center gap-2 rounded-[14px] border-2 px-3 py-4 transition-colors text-center",
        isPicked
          ? "border-amber-500 bg-amber-500/10"
          : "border-border bg-card hover:bg-accent",
        isPicking && "opacity-60",
      )}
    >
      <div className="relative">
        <TeamLogo logo={team.logo} name={team.name} size={12} />
        {isPicked && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">✓</span>
        )}
      </div>
      <span className="text-xs font-medium truncate max-w-full">{team.name}</span>
    </button>
  );
}

type OpenState = Extract<ChampionState, { status: "OPEN" }>;
type LockedState = Extract<ChampionState, { status: "LOCKED" }>;

function OpenView({
  state,
  picking,
  error,
  pick,
}: {
  state: OpenState;
  picking: string | null;
  error: string | null;
  pick: (teamId: string) => void;
}) {
  const [confirmTeam, setConfirmTeam] = useState<AllowedTeam | null>(null);

  const myPick = state.myPick;
  const myTeam = myPick ? state.allowedTeams.find(t => t.teamId === myPick.teamId) : null;

  function handleClick(team: AllowedTeam) {
    if (myPick && myPick.teamId !== team.teamId) {
      setConfirmTeam(team);
    } else if (!myPick) {
      pick(team.teamId);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-amber-500/25 bg-amber-500/10 px-4 py-3">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Crown className="h-4 w-4 text-amber-500" /> Picks are open — the admin can lock at any time
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {state.pickCount} player{state.pickCount !== 1 ? "s have" : " has"} picked a champion from {state.league.name}.
          {myTeam && ` You picked ${myTeam.name}.`}
        </p>
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>}

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {state.allowedTeams.map(team => (
          <PickCard
            key={team.teamId}
            team={team}
            isPicked={myPick?.teamId === team.teamId}
            isPicking={picking === team.teamId}
            onPick={() => handleClick(team)}
          />
        ))}
      </div>

      {confirmTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-2">Switch champion?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Switch from <strong>{myTeam?.name}</strong> to <strong>{confirmTeam.name}</strong>? You can change again anytime before picks lock.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmTeam(null)}
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => { pick(confirmTeam.teamId); setConfirmTeam(null); }}
                className="px-3 py-1.5 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600"
              >
                Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AwardRow({ award }: { award: RevealTeam["awards"][number] }) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5",
      award.isWin ? "bg-green-500/10" : "bg-muted/50 text-muted-foreground",
    )}>
      <span className="font-semibold w-14 shrink-0">Game {award.gameNumber}</span>
      <span className="truncate flex-1">
        {award.homeAway === "home" ? "vs" : "@"} {award.opponentName}
        {award.teamScore !== null && ` · ${award.teamScore}–${award.opponentScore}`}
      </span>
      <span className="shrink-0 hidden sm:inline text-muted-foreground"><KickoffTime date={award.kickoffTime} /></span>
      <span className={cn("font-bold font-mono-nums shrink-0", award.isWin ? "text-green-600 dark:text-green-400" : "line-through opacity-60")}>
        +{award.points}
      </span>
    </div>
  );
}

function RevealRow({
  pickEntry,
  team,
  isMe,
  isExpanded,
  onToggle,
}: {
  pickEntry: { userId: string; name: string | null; avatarUrl: string | null; teamId: string; teamName: string; teamLogo: string | null; totalBonus: number };
  team: RevealTeam | undefined;
  isMe: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <div
        onClick={onToggle}
        className={cn(
          "rounded-[14px] border px-[14px] py-[11px] flex items-center gap-[10px] cursor-pointer transition-colors",
          isMe ? "bg-primary-soft border-primary-soft-border" : "bg-card border-border",
        )}
      >
        <TeamLogo logo={pickEntry.teamLogo} name={pickEntry.teamName} size={7} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate flex items-center gap-1.5">
            {pickEntry.name ?? `User ${pickEntry.userId}`}
            {isMe && <span className="text-[10px] font-bold uppercase text-primary shrink-0">YOU</span>}
          </p>
          <p className="text-xs text-muted-foreground truncate">{pickEntry.teamName}</p>
        </div>
        <span className="text-[14px] font-bold font-mono-nums shrink-0">+{pickEntry.totalBonus}</span>
        <button className="p-1 rounded hover:bg-card-elevated transition-colors text-muted-foreground shrink-0" aria-label={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {isExpanded && (
        <div className="px-3 pb-2 pt-2 space-y-1.5">
          {!team || team.awards.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No games played yet since lock.</p>
          ) : (
            <>
              {team.awards.map(a => <AwardRow key={a.matchId} award={a} />)}
              <p className="text-xs text-muted-foreground text-right pt-1">Next win = {team.nextWinPoints} pts</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LockedView({ state }: { state: LockedState }) {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id;
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const myTeam = state.myPick ? state.teams[state.myPick.teamId] : null;

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-blue-500/25 bg-blue-500/10 px-4 py-3">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Crown className="h-4 w-4 text-blue-500" /> {state.league.name} — locked {new Date(state.lockedAt).toLocaleDateString()}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          A postponed match finishing late can renumber later games — the ledger always rebuilds in kickoff order.
        </p>
      </div>

      {myTeam ? (
        <div className="rounded-[14px] border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold flex items-center gap-2">
              <TeamLogo logo={myTeam.logo} name={myTeam.name} size={6} />
              Your champion: {myTeam.name}
            </span>
            <span className="text-lg font-bold font-mono-nums">+{myTeam.totalPoints}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {myTeam.awards.length} game{myTeam.awards.length !== 1 ? "s" : ""} played · next win = {myTeam.nextWinPoints} pts
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-4 py-3">
          You didn&apos;t pick a champion this round — but you can still browse everyone else&apos;s below.
        </p>
      )}

      <div className="space-y-2">
        {state.picks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No one picked a champion this round.</p>
        ) : (
          state.picks.map(p => (
            <RevealRow
              key={p.userId}
              pickEntry={p}
              team={state.teams[p.teamId]}
              isMe={p.userId === myId}
              isExpanded={expandedUserId === p.userId}
              onToggle={() => setExpandedUserId(v => v === p.userId ? null : p.userId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-[14px]" />
      ))}
    </div>
  );
}

export function ChampionClient() {
  const { state, isLoading, picking, error, pick } = useChampionBonus();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Crown className="h-6 w-6 text-amber-500" /> Champion Bonus
      </h1>

      {isLoading || !state ? (
        <LoadingSkeleton />
      ) : !state.enabled ? (
        <EmptyState />
      ) : state.status === "OPEN" ? (
        <OpenView state={state} picking={picking} error={error} pick={pick} />
      ) : (
        <LockedView state={state} />
      )}
    </div>
  );
}
