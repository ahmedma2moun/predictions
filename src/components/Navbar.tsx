"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Calendar, TrendingUp, Trophy, Settings, LogOut, Star, Users, Bell } from "lucide-react";
import { cn, isMatchLocked } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { href: "/matches", label: "Matches", icon: Calendar },
  { href: "/predictions", label: "My Score", icon: TrendingUp },
  { href: "/leaderboard", label: "Leaders", icon: Trophy },
  { href: "/club", label: "Club", icon: Users },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/seasons", label: "Seasons", icon: Star },
];

type MatchLite = { status: string; kickoffTime: string; prediction?: unknown | null };

/** Upcoming (scheduled, unlocked) matches the user has not predicted — the Matches tab badge. */
export function countMissingPicks(matches: MatchLite[]): number {
  return matches.filter(m => m.status === "scheduled" && !m.prediction && !isMatchLocked(m.kickoffTime)).length;
}

function useMissingPicks(enabled: boolean, pathname: string) {
  const [count, setCount] = useState(0);
  // Refetch on every navigation (mirrors the native apps refetching when Matches regains focus).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/matches?status=scheduled")
      .then(r => (r.ok ? r.json() : []))
      .then((m: MatchLite[]) => { if (!cancelled) setCount(countMissingPicks(m)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, pathname]);
  return enabled ? count : 0;
}

function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} upcoming ${count === 1 ? "match" : "matches"} without a prediction`}
      className={cn(
        "min-w-4 h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold leading-4 text-center",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  // Admins have no predictions of their own, so every match would count as missing.
  const missingPicks = useMissingPicks(!!session && !isAdmin, pathname);

  return (
    <>
      {/* Top bar — desktop */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 bg-card/85 backdrop-blur-md border-b border-border items-center px-6 gap-6">
        <Link href="/matches" className="font-bold text-lg flex items-center gap-2">
          <span className="h-8 w-8 rounded-sm bg-primary text-primary-foreground flex items-center justify-center text-lg leading-none">
            ⚽
          </span>
          Predictions
        </Link>
        <div className="flex items-center gap-1 flex-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}

              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.href === "/matches" && <Badge count={missingPicks} />}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"

              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Settings className="h-4 w-4" />
              Admin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{session?.user?.name}</span>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* Top bar — mobile */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-card/85 backdrop-blur-md border-b border-border flex items-center justify-between px-4">
        <Link href="/matches" className="font-bold text-sm flex items-center gap-1.5">
          <span className="h-6 w-6 rounded-sm bg-primary text-primary-foreground flex items-center justify-center text-sm leading-none">
            ⚽
          </span>
          Predictions
        </Link>
        <div className="flex items-center gap-1.5">
          <div className="text-right">
            <p className="text-xs font-medium leading-none">{session?.user?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{isAdmin ? "Admin" : "Player"}</p>
          </div>
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* Bottom nav — mobile
          The outer nav has no fixed height so it can grow to fill the
          iOS/Android safe-area inset below the home indicator.
          bg-card extends through that inset, eliminating the floating gap.
          The inner div is the fixed 64 px tap-target strip.        */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/85 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom,0px)]">
        <div className="h-16 flex items-center">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                pathname.startsWith(item.href)
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.href === "/matches" && <Badge count={missingPicks} className="absolute -top-1.5 -right-2.5" />}
              </span>
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              prefetch={false}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                pathname.startsWith("/admin")
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Settings className="h-5 w-5" />
              Admin
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
