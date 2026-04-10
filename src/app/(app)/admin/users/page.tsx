"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { toastApiError } from "@/lib/client-api";

type AdminUser = {
  _id: string;
  id: number;
  name: string;
  email: string;
  role: string;
  notificationEmail?: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [saving, setSaving] = useState(false);

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "user", password: "", notificationEmail: "" });
  const [editSaving, setEditSaving] = useState(false);

  async function loadUsers() {
    try {
      const r = await fetch("/api/admin/users");
      if (!r.ok) throw new Error("Failed to load users");
      setUsers(await r.json());
    } catch {
      setError("Failed to load users. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) {
      toast.success("User created");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "user" });
      await loadUsers();
    } else {
      await toastApiError(r, "Failed to create user");
    }
  }

  function openEdit(user: AdminUser) {
    setEditUser(user);
    setEditForm({ name: user.name, role: user.role, password: "", notificationEmail: user.notificationEmail ?? "" });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    const payload: Record<string, string> = {
      id: editUser._id,
      name: editForm.name,
      role: editForm.role,
      notificationEmail: editForm.notificationEmail,
    };
    if (editForm.password) payload.password = editForm.password;
    const r = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditSaving(false);
    if (r.ok) {
      toast.success("User updated");
      setEditUser(null);
      await loadUsers();
    } else {
      await toastApiError(r, "Failed to update user");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Users</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <form onSubmit={createUser} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "Creating..." : "Create User"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
                <Skeleton className="h-8 w-16 rounded" />
              </div>
            ))
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            users.map(user => (
              <div key={user._id} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  {user.notificationEmail && (
                    <p className="text-xs text-muted-foreground">Notify: {user.notificationEmail}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                  <Button size="sm" variant="outline" onClick={() => openEdit(user)}>Edit</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={open => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User — {editUser?.name}</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notification Email</Label>
              <Input type="email" placeholder="Leave empty to disable notifications" value={editForm.notificationEmail} onChange={e => setEditForm(f => ({ ...f, notificationEmail: e.target.value }))} />
            </div>
            <div className="space-y-2"><Label>New Password <span className="text-muted-foreground">(optional)</span></Label><Input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} /></div>
            <Button type="submit" className="w-full" disabled={editSaving}>{editSaving ? "Saving..." : "Save Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
