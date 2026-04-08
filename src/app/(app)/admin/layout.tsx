import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leagues", label: "Leagues" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/scoring", label: "Scoring" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") redirect("/dashboard");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">⚙️ Admin</h1>
      <div className="flex gap-1 flex-wrap mb-6 border-b border-border pb-4">
        {adminLinks.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
