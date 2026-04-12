"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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

export default function AdminNotificationsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState<number | "all">("all");
  const [title, setTitle] = useState("Test Notification");
  const [body, setBody] = useState("This is a test push notification from the admin.");
  const [type, setType] = useState("new_matches");

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(setUsers)
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (selectedUserId === "all") {
      setDeviceInfo(null);
      return;
    }
    setLoadingDevices(true);
    fetch(`/api/admin/notifications/devices?userId=${selectedUserId}`)
      .then(r => r.json())
      .then(setDeviceInfo)
      .catch(() => setDeviceInfo(null))
      .finally(() => setLoadingDevices(false));
  }, [selectedUserId]);

  async function sendNotification() {
    setSending(true);
    try {
      const payload: Record<string, unknown> = { title, body, type };
      if (selectedUserId !== "all") payload.userIds = [selectedUserId];

      const r = await fetch("/api/admin/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Failed to send");
      } else {
        const names = (data.sentTo as { name: string }[]).map(u => u.name).join(", ");
        toast.success(`Sent to ${data.deviceTokenCount} device(s) — ${names}`);
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
    </div>
  );
}
