"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

type Group = {
  _id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
};

export default function AdminGroupsPage() {
  const [groups, setGroups]   = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [name, setName]       = useState("");
  const [saving, setSaving]   = useState(false);

  async function loadGroups() {
    const r = await fetch("/api/admin/groups");
    setGroups(await r.json());
    setLoading(false);
  }

  useEffect(() => { loadGroups(); }, []);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (r.ok) {
      toast.success("Group created");
      setOpen(false);
      setName("");
      await loadGroups();
    } else {
      const err = await r.json();
      toast.error(err.error || "Failed");
    }
  }

  async function deleteGroup(id: string, groupName: string) {
    if (!confirm(`Delete group "${groupName}"? This cannot be undone.`)) return;
    const r = await fetch(`/api/admin/groups/${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Group deleted");
      await loadGroups();
    } else {
      const err = await r.json();
      toast.error(err.error || "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Groups</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Group</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
            <form onSubmit={createGroup} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Champions League Fans" required />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Creating…" : "Create Group"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">No groups yet.</p>
          ) : (
            groups.map(group => (
              <div key={group._id} className="flex items-center justify-between p-3 rounded-lg bg-accent gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{group.name}</p>
                    {group.isDefault && <Badge variant="secondary">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/groups/${group._id}`}>Manage</Link>
                  </Button>
                  {!group.isDefault && (
                    <Button variant="destructive" size="sm" onClick={() => deleteGroup(group._id, group.name)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
