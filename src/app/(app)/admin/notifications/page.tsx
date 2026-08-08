"use client";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useApiResource } from "@/hooks/useApiResource";

type AdminUser = {
  id: number;
  _id: string;
  name: string;
  email: string;
  role: string;
};

type DeviceInfo = {
  count: number;
  tokens: { id: number; platform: string; createdAt: string }[];
};

type AdminMatch = {
  _id: string;
  externalId: number | null;
  status: string;
  kickoffTime: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
};

export default function AdminNotificationsPage() {
  const [selectedUserId, setSelectedUserId] = useState<number | "all">("all");
  const [title, setTitle] = useState("Test Notification");
  const [body, setBody] = useState("This is a test push notification from the admin.");
  const [type, setType] = useState("new_matches");

  const [sending, setSending] = useState(false);

  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [triggering, setTriggering] = useState(false);

  const loadMatches = useCallback(async () => {
    const r = await fetch("/api/admin/matches?page=1");
    if (!r.ok) throw new Error("Failed to load matches");
    const data = await r.json() as { matches: AdminMatch[] };
    return data.matches.filter(m => m.externalId != null);
  }, []);
  const { data: liveGoalMatches, loading: loadingMatches } = useApiResource(loadMatches, [] as AdminMatch[], "Failed to load matches.");

  async function triggerLiveGoalTest() {
    if (!selectedMatchId) return;
    setTriggering(true);
    try {
      const r = await fetch("/api/admin/live-goals/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: Number(selectedMatchId) }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Failed to trigger tick");
      } else {
        toast.success(data.message ?? "Tick published");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTriggering(false);
    }
  }

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (!r.ok) throw new Error("Failed to load users");
    return r.json() as Promise<AdminUser[]>;
  }, []);
  const { data: users, loading: loadingUsers } = useApiResource(loadUsers, [] as AdminUser[], "Failed to load users.");

  const loadDeviceInfo = useCallback(async () => {
    if (selectedUserId === "all") return null;
    const r = await fetch(`/api/admin/notifications/devices?userId=${selectedUserId}`);
    if (!r.ok) throw new Error("Failed to load device info");
    return r.json() as Promise<DeviceInfo>;
  }, [selectedUserId]);
  const { data: deviceInfo, loading: loadingDevices } = useApiResource(loadDeviceInfo, null as DeviceInfo | null);

  async function sendNotification() {
    setSending(true);
    try {
      const payload: Record<string, unknown> = { title, text: body, type };
      if (selectedUserId === "all") {
        payload.allUsers = true;
      } else {
        payload.userIds = [selectedUserId];
      }

      const r = await fetch("/api/admin/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Failed to send");
      } else {
        toast.success(`Sent to ${data.tokensTargeted ?? 0} device(s) across ${data.usersTargeted ?? 0} user(s)`);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  }

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-xl font-semibold">Push Notifications</h2>

      <Card>
        <CardHeader><CardTitle className="text-base">Send Test Notification</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          {/* User picker */}
          <div className="space-y-2">
            <Label>Recipient</Label>
            {loadingUsers ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : (
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All users with the app installed</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            )}
          </div>

          {/* Device token status */}
          {selectedUserId !== "all" && (
            <div className="text-sm text-muted-foreground">
              {loadingDevices ? (
                <Skeleton className="h-4 w-40 rounded" />
              ) : deviceInfo ? (
                deviceInfo.count === 0 ? (
                  <Badge variant="destructive">No devices registered — user has not logged in on Android</Badge>
                ) : (
                  <Badge variant="secondary">{deviceInfo.count} device{deviceInfo.count > 1 ? "s" : ""} registered</Badge>
                )
              ) : null}
            </div>
          )}

          {/* Notification type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="new_matches">new_matches — opens Matches screen</option>
              <option value="results">results — opens Predictions screen</option>
              <option value="prediction_reminder">prediction_reminder — opens Matches screen</option>
              <option value="daily_reminder">daily_reminder — opens Matches screen</option>
            </select>
          </div>

          {/* Title + Body */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Input value={body} onChange={e => setBody(e.target.value)} />
          </div>

          <Button
            className="w-full"
            onClick={sendNotification}
            disabled={
              sending ||
              (selectedUserId !== "all" && deviceInfo?.count === 0)
            }
          >
            {sending ? "Sending..." : "Send Notification"}
          </Button>

          {selectedUserId !== "all" && deviceInfo?.count === 0 && (
            <p className="text-xs text-destructive text-center">
              {selectedUser?.name} has no registered Android devices.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Live Goal Polling — Test Tick</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Publishes one immediate QStash tick for the selected match — exercises the real pipeline
            (QStash → signature verify → fetch fixture → diff/notify → rearm) without waiting for kickoff.
            Predictors on the match get a push only if the fetched score has actually advanced since the
            last tick.
          </p>

          <div className="space-y-2">
            <Label>Match</Label>
            {loadingMatches ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : (
              <select
                value={selectedMatchId}
                onChange={e => setSelectedMatchId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a match with an externalId…</option>
                {liveGoalMatches.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.homeTeam.name} vs {m.awayTeam.name} — {m.status} — {new Date(m.kickoffTime).toLocaleString()}
                  </option>
                ))}
              </select>
            )}
            {!loadingMatches && liveGoalMatches.length === 0 && (
              <Badge variant="destructive">No matches with an externalId found on page 1 of admin/matches</Badge>
            )}
          </div>

          <Button
            className="w-full"
            onClick={triggerLiveGoalTest}
            disabled={triggering || !selectedMatchId}
          >
            {triggering ? "Publishing..." : "Trigger Test Tick"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
