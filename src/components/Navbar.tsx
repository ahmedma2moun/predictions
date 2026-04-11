"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Calendar, TrendingUp, Trophy, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { href: "/matches", label: "Matches", icon: Calendar },
  { href: "/predictions", label: "My Picks", icon: TrendingUp, adminHidden: true },
  { href: "/leaderboard", label: "Leaders", icon: Trophy },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <>
      {/* Top bar — desktop */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border items-center px-6 gap-6">
        <Link href="/matches" className="font-bold text-lg flex items-center gap-2">
          ⚽ Predictions
        </Link>
        <div className="flex items-center gap-1 flex-1">
          {navItems.filter(item => !(isAdmin && item.adminHidden)).map(item => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              prefetch={false}
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
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-card border-b border-border flex items-center justify-between px-4">
        <Link href="/matches" className="font-bold text-sm flex items-center gap-1.5">
          ⚽ Predictions
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

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-card border-t border-border flex items-center">
        {navItems.filter(item => !(isAdmin && item.adminHidden)).map(item => (
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
            <item.icon className="h-5 w-5" />
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
      </nav>
    </>
  );
}
