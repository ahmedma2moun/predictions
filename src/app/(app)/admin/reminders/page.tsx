"use client";
import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiResource } from "@/hooks/useApiResource";

type UserReminderSelection = {
  userId: number;
  userName: string;
  userEmail: string;
  teams: { teamLeagueId: number; teamName: string; teamLogo: string | null; leagueName: string }[];
};

export default function AdminRemindersPage() {
  const loadSelections = useCallback(async () => {
    const r = await fetch("/api/admin/reminders");
    if (!r.ok) throw new Error("Failed to load reminders");
    return r.json() as Promise<UserReminderSelection[]>;
  }, []);
  const { data: selections, loading, error } = useApiResource(
    loadSelections,
    [] as UserReminderSelection[],
    "Failed to load reminders. Please refresh.",
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Reminders</h2>
        <p className="text-sm text-muted-foreground">
          {loading ? "" : `${selections.length} user${selections.length === 1 ? "" : "s"} with reminders enabled`}
        </p>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-3">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-48 rounded" />
                <Skeleton className="h-6 w-full max-w-sm rounded" />
              </div>
            ))
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : selections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users have enabled reminders for any team yet.</p>
          ) : (
            selections.map(s => (
              <div key={s.userId} className="p-3 rounded-lg bg-accent space-y-2">
                <div>
                  <p className="font-medium text-sm">{s.userName}</p>
                  <p className="text-xs text-muted-foreground">{s.userEmail}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.teams.map(t => (
                    <Badge key={t.teamLeagueId} variant="secondary">
                      {t.teamName} · {t.leagueName}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
