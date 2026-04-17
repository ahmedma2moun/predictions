"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/leagues", label: "Leagues" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/scoring", label: "Scoring" },
  { href: "/admin/notifications", label: "Notifications" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 flex-wrap mb-6 border-b border-border pb-4">
      {adminLinks.map(link => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
