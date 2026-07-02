import Link from "next/link";
import type { UserStateDTO } from "@/lib/services/champion-bonus-service";

export function ChampionBonusMyScoreCard({ state }: { state: UserStateDTO }) {
  if (!state.enabled) return null;

  if (state.status === "OPEN") {
    return (
      <Link
        href="/champion"
        className="block rounded-[14px] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/15 transition-colors"
      >
        <span className="font-medium">👑 Champion Bonus</span>{" "}
        <span className="text-muted-foreground">
          {state.myPick ? "— you've picked your champion" : "— pick your champion before picks lock"}
        </span>
      </Link>
    );
  }

  const myTeam = state.myPick ? state.teams[state.myPick.teamId] : null;
  if (!myTeam) {
    return (
      <Link
        href="/champion"
        className="block rounded-[14px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        👑 Champion Bonus — you didn&apos;t pick a champion this round
      </Link>
    );
  }

  const wins = myTeam.awards.filter(a => a.isWin).length;

  return (
    <Link
      href="/champion"
      className="block rounded-[14px] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/15 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">👑 Champion Bonus ({myTeam.name})</span>
        <span className="font-bold font-mono-nums">+{myTeam.totalPoints} pts</span>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {myTeam.awards.length} game{myTeam.awards.length !== 1 ? "s" : ""} played · {wins} win{wins !== 1 ? "s" : ""} · next win = {myTeam.nextWinPoints} pts
      </p>
    </Link>
  );
}
