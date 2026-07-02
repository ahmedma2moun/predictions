import { useCallback, useEffect, useState } from "react";

export type AllowedTeam = { teamId: string; name: string; logo: string | null };

export type AwardTile = {
  matchId: string;
  gameNumber: number;
  opponentName: string;
  homeAway: "home" | "away";
  teamScore: number | null;
  opponentScore: number | null;
  kickoffTime: string;
  isWin: boolean;
  points: number;
};

export type RevealTeam = {
  teamId: string;
  name: string;
  logo: string | null;
  awards: AwardTile[];
  totalPoints: number;
  nextWinPoints: number;
};

export type RevealPick = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  totalBonus: number;
};

export type ChampionState =
  | { enabled: false }
  | {
      enabled: true;
      status: "OPEN";
      league: { id: string; name: string; logo: string | null };
      allowedTeams: AllowedTeam[];
      pickCount: number;
      myPick: { teamId: string } | null;
    }
  | {
      enabled: true;
      status: "LOCKED";
      league: { id: string; name: string; logo: string | null };
      lockedAt: string;
      myPick: { teamId: string } | null;
      teams: Record<string, RevealTeam>;
      picks: RevealPick[];
    };

export function useChampionBonus() {
  const [state, setState] = useState<ChampionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/champion-bonus");
      if (!res.ok) throw new Error();
      setState(await res.json());
    } catch {
      // leave prior state on transient errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function pick(teamId: string) {
    setPicking(teamId);
    setError(null);
    try {
      const res = await fetch("/api/champion-bonus/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: Number(teamId) }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to pick");
        return;
      }
      await load();
    } finally {
      setPicking(null);
    }
  }

  return { state, isLoading, picking, error, pick, reload: load };
}
