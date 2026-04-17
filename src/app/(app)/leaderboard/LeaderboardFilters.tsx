"use client";
import type { RefObject } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Group, League } from "./useLeaderboard";

type Props = {
  groups: Group[];
  groupId: string | null;
  setGroupId: (id: string) => void;
  leagues: League[];
  selectedLeagues: string[];
  setSelectedLeagues: React.Dispatch<React.SetStateAction<string[]>>;
  leagueDropdownOpen: boolean;
  setLeagueDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  leagueDropdownRef: RefObject<HTMLDivElement | null>;
};

export function LeaderboardFilters({
  groups, groupId, setGroupId,
  leagues, selectedLeagues, setSelectedLeagues,
  leagueDropdownOpen, setLeagueDropdownOpen, leagueDropdownRef,
}: Props) {
  return (
    <>
      {/* Group selector */}
      {groups.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setGroupId(g.id)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                groupId === g.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Tournament multi-select */}
      {leagues.length > 0 && (
        <div className="relative" ref={leagueDropdownRef}>
          <button
            onClick={() => setLeagueDropdownOpen(o => !o)}
            className={cn(
              "w-full flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
              leagueDropdownOpen
                ? "border-ring ring-2 ring-ring bg-background"
                : "border-border bg-background hover:border-foreground"
            )}
          >
            <span className="truncate text-left">
              {selectedLeagues.length === 0
                ? "All Tournaments"
                : selectedLeagues.length === 1
                ? leagues.find(l => l.externalId.toString() === selectedLeagues[0])?.name ?? "1 selected"
                : `${selectedLeagues.length} tournaments`}
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", leagueDropdownOpen && "rotate-180")} />
          </button>

          {leagueDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md">
              <button
                onClick={() => setSelectedLeagues([])}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors",
                  selectedLeagues.length === 0 && "font-medium"
                )}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0",
                  selectedLeagues.length === 0 ? "bg-primary border-primary" : "border-border"
                )}>
                  {selectedLeagues.length === 0 && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                All Tournaments
              </button>

              <div className="border-t border-border" />

              {leagues.map(l => {
                const val = l.externalId.toString();
                const checked = selectedLeagues.includes(val);
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      setSelectedLeagues(prev =>
                        checked ? prev.filter(x => x !== val) : [...prev, val]
                      );
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded border shrink-0",
                      checked ? "bg-primary border-primary" : "border-border"
                    )}>
                      {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
