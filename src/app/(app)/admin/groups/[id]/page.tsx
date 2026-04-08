"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

type User = { id: number; _id: string; name: string; email: string; avatarUrl?: string };

type GroupDetail = {
  id: number;
  _id: string;
  name: string;
  isDefault: boolean;
  members: User[];
};

export default function AdminGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [group, setGroup]       = useState<GroupDetail | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [nameEdit, setNameEdit] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [busy, setBusy]         = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  async function loadAll() {
    const [grp, users] = await Promise.all([
      fetch(`/api/admin/groups/${id}`).then(r => r.json()),
      fetch("/api/admin/users").then(r => r.json()),
    ]);
    setGroup(grp);
    setNameEdit(grp.name ?? "");
    setAllUsers(users);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [id]);

  async function patch(body: object, busyKey: string) {
    setBusy(busyKey);
    const r = await fetch(`/api/admin/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!r.ok) {
      const err = await r.json();
      toast.error(err.error || "Failed");
      return false;
    }
    await loadAll();
    return true;
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const ok = await patch({ name: nameEdit }, "name");
    setSavingName(false);
    if (ok) toast.success("Name updated");
  }

  const memberIds = new Set(group?.members.map(m => m.id) ?? []);
  const availableUsers = allUsers.filter(u =>
    !memberIds.has(u.id) &&
    (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
     u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!group)  return <p className="text-destructive text-sm">Group not found.</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/groups")}>← Back</Button>
        <h2 className="text-xl font-semibold">{group.name}</h2>
        {group.isDefault && <Badge variant="secondary">Default</Badge>}
      </div>

      {/* Rename */}
      <Card>
        <CardHeader><CardTitle className="text-base">Group Name</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="flex gap-2">
            <Input value={nameEdit} onChange={e => setNameEdit(e.target.value)} className="max-w-xs" required />
            <Button type="submit" size="sm" disabled={savingName || nameEdit === group.name}>
              {savingName ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader><CardTitle className="text-base">Members ({group.members.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {group.members.length > 0 && (
            <div className="space-y-2">
              {group.members.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-accent">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={u.avatarUrl} />
                    <AvatarFallback className="text-xs">{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {!group.isDefault && (
                    <Button
                      variant="ghost" size="sm"
                      disabled={busy === `rm-${u.id}`}
                      onClick={() => patch({ action: "remove-member", userId: u.id }, `rm-${u.id}`)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Add member</p>
            <Input
              placeholder="Search users…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  {userSearch ? "No matching users" : "All users are already members"}
                </p>
              ) : (
                availableUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                    <div>
                      <p className="text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Button
                      size="sm" variant="outline"
                      disabled={busy === `add-${u.id}`}
                      onClick={() => patch({ action: "add-member", userId: u.id }, `add-${u.id}`)}
                    >
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
