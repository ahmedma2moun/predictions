"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "odds_explainer_v1_seen";

const STEPS = [
  {
    emoji: "🔮",
    title: "Pick your outcome",
    desc: "Choose who wins (or a draw) like you always have — nothing changes here.",
  },
  {
    emoji: "⚡",
    title: "Bold picks earn bonus points",
    desc: "Once the match is done, your score is multiplied based on how many people made the same pick. Rare correct predictions earn more.",
  },
  {
    emoji: "🏆",
    title: "Multiplier revealed after the match",
    desc: "You won't see the odds until the match is locked and results are in — everyone finds out at the same time.",
  },
];

export function OddsExplainerModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm gap-5">
        <DialogHeader>
          <div className="text-2xl mb-1">🎯</div>
          <DialogTitle className="text-base leading-snug">
            Predictions just got more exciting
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Your predictions now earn{" "}
            <span className="font-semibold text-foreground">bonus points</span>{" "}
            based on how bold your pick was.
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {STEPS.map((step) => (
            <div key={step.title} className="flex gap-3">
              <span className="text-xl leading-none mt-0.5">{step.emoji}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-foreground">Example</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            8 out of 10 players picked a home win — only you and one friend picked the
            away team. The away team wins. Your base score of 10 pts becomes{" "}
            <span className="font-semibold text-foreground">25 pts</span> with a 2.5× multiplier. 🎉
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            Got it, let&apos;s play!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
