"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminScoringPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [recalcing, setRecalcing] = useState(false);

  useEffect(() => {
    fetch("/api/admin/scoring-rules").then(r => r.json()).then(setRules).finally(() => setLoading(false));
  }, []);

  async function updateRule(id: string, update: any) {
    const r = await fetch("/api/admin/scoring-rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...update }) });
    if (r.ok) setRules(prev => prev.map(rule => rule._id === id ? { ...rule, ...update } : rule));
  }

  async function recalculate() {
    setRecalcing(true);
    const r = await fetch("/api/admin/recalculate", { method: "POST" });
    const data = await r.json();
    toast.success(`Recalculated ${data.updated} predictions`);
    setRecalcing(false);
    setRecalcOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Scoring Rules</h2>
        <Button variant="outline" onClick={() => setRecalcOpen(true)}>Recalculate All</Button>
      </div>

      <div className="grid gap-4">
        {loading ? <p className="text-muted-foreground">Loading...</p> : rules.map(rule => (
          <Card key={rule._id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                  <Badge variant="outline" className="mt-1 text-xs">{rule.key}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">pts:</span>
                    <Input
                      type="number"
                      value={rule.points}
                      onChange={e => updateRule(rule._id, { points: Number(e.target.value) })}
                      className="w-16 h-8 text-center"
                      min={0}
                      max={20}
                    />
                  </div>
                  <Switch checked={rule.isActive} onCheckedChange={v => updateRule(rule._id, { isActive: v })} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={recalcOpen} onOpenChange={setRecalcOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalculate All Scores</DialogTitle>
            <DialogDescription>
              This will recalculate points for ALL predictions across ALL finished matches using the current scoring rules. This may take a moment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecalcOpen(false)}>Cancel</Button>
            <Button onClick={recalculate} disabled={recalcing}>{recalcing ? "Recalculating..." : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
