# Crowd Odds — Feature Proposal

**Product:** Football Predictions  
**Feature Name:** Crowd Odds  
**Status:** Proposed  
**Date:** 2026-05-28

---

## Executive Summary

Crowd Odds transforms the prediction experience by turning the group's collective picks into a live scoring multiplier. Players who correctly predict an outcome that the majority dismissed earn a higher reward than those who followed the crowd. The multiplier is derived purely from how the group distributed its predictions — no house odds, no external data.

**How it is calculated:** Once a match result is confirmed, the system counts how many players submitted a prediction and how many of those picked the winning outcome. The multiplier is:

```
multiplier = total submitted predictions / number of players who picked correctly
```

The result is always rounded up to the nearest whole number. That multiplier is then applied to the player's **full score** for the match — base points plus any exact-score bonus. The result is floored at **×1** (unanimous correct picks earn no penalty) and capped at **ceil(total players / 2) + 1** — for a group of 7 that cap is ×5 (7/2 + 1 = 4.5 → rounds up to 5). For example, if 7 players predicted and only 2 picked the winning team, those 2 players receive ×4 (7/2 = 3.5 → rounds up to 4).

This adds a second axis of competition alongside raw prediction accuracy: **conviction**. It keeps every match consequential for every player, compresses runaway leaderboards naturally, and deepens engagement on prediction days.

---

## Problem Statement

In the current system, ten players who all correctly predict the same result earn identical scores. There is no reward for reading a match differently from the group, and no meaningful interaction between players' picks. Once a few players build a points lead, the rest of the group has limited mathematical paths back into contention.

---

## Proposed Solution

At match lock time, the app records how each player predicted the result (Home Win / Away Win / Draw). When the final result is confirmed, the system computes a **Crowd Odds multiplier** for each outcome based on how many players predicted it versus the total number of predictions submitted.

**Multiplier formula:**

```
multiplier = ceil( total_submitted_predictions / predictions_for_winning_outcome )
```

Decimal results always round up to the next whole number. The multiplier is then applied to the **full score** earned by each player who picked the correct outcome, including exact-score bonus points.

---

## Rules & Mechanics

### Multiplier Calculation

Cap for 7 players = ceil(7/2) + 1 = **×5**

| Players who picked correctly | Total predictions submitted | Raw multiplier | Rounded up | Applied multiplier |
|---|---|---|---|---|
| 1 | 7 | 7.0 | 7 | **×5** (cap) |
| 2 | 7 | 3.5 | 4 | **×4** |
| 3 | 7 | 2.33 | 3 | **×3** |
| 4 | 7 | 1.75 | 2 | **×2** |
| 5 | 7 | 1.4 | 2 | **×2** |
| 6 | 7 | 1.17 | 2 | **×2** |
| 7 | 7 | 1.0 | 1 | **×1** (floor) |

### Key Rules

**Floor — ×1.0**
A unanimous correct pick receives no bonus and no penalty. Correct is still always worth something.

**Cap — ceil(total players / 2) + 1**
The cap scales with group size. For a group of 7 the cap is ×5. This preserves skill as the dominant factor over variance while still rewarding bold picks meaningfully.

**Applied to full score**
The multiplier is applied to the player's total points for that match, including exact-score bonus points. A player who nails the exact scoreline on a contrarian pick is maximally rewarded.

**Draw is a first-class outcome**
Home Win, Away Win, and Draw are three independent prediction buckets. A player who predicted Draw when only 1 of 7 players did, and the result is a draw, receives the same multiplier logic: `7 / 1 = 7 → capped at ×5`.

**Missing predictions are excluded**
Only submitted predictions count in the denominator. Players who do not predict a match do not dilute or inflate the multipliers for those who did.

**Distribution is hidden until lock**
Crowd pick distribution is not shown to players before the match locks. This eliminates herding behavior and ensures every prediction reflects genuine independent judgment.

---

## User Experience

### Prediction Day
Players predict as normal. No crowd data is visible. The only change is the knowledge that going against the group will pay off more if correct.

### Post-Match Scorecard
Each player's match result card shows:
- Base score earned
- Crowd Odds multiplier applied
- Final score after multiplier

**Example:**
```
Real Madrid vs. Barcelona
Your pick: Draw  ✓ Correct
Base score:        5 pts
Crowd Odds:      × 5  (1 of 7 picked Draw → capped at ×5)
Final score:      25 pts
```

### Leaderboard
The rank change view highlights when a Crowd Odds multiplier caused a position change, making the social dynamic visible and discussable after each match.

---

## Strategic Benefits

**Decompresses leaderboards**
Consensus picks yield low multipliers. A single well-read contrarian match can close a 20-point gap that looked insurmountable under the flat scoring system.

**Rewards football knowledge, not just safe picks**
Players who study form, injuries, and head-to-head records are more likely to deviate from group consensus with justified conviction. The system rewards that research.

**Increases re-engagement after bad rounds**
A player who has fallen behind knows one high-multiplier correct pick can bring them back. This keeps them invested rather than disengaged during a losing streak.

**Creates a social conversation layer**
"I can't believe you went against everyone on that one" becomes a recurring moment. The feature generates natural post-match discussion without any additional product surface.

**No external dependency**
Multipliers are computed entirely from group behavior. There are no third-party odds feeds, no licensing costs, and no alignment issues with betting products.

---

## Out of Scope

- Displaying crowd distribution before match lock
- Player-vs-player side bets or challenges
- Historical Crowd Odds stats or dashboards (Phase 1)
- Multipliers based on external bookmaker odds

---

## Success Metrics

| Metric | Baseline | Target |
|---|---|---|
| Avg. time spent on prediction screen | Current | +20% |
| Round-over-round rank stability | Current | −15% (more movement) |
| Player return rate after a losing round | Current | +10% |
| Group chat activity post-match | Qualitative | Noticeably higher |

---

## Open Questions

None. All edge cases and design decisions have been resolved and are reflected in this document.

---

## Appendix — Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Multiplier floor | ×1 | Correct is always rewarded; no penalty for consensus picks |
| Multiplier cap | ceil(total players / 2) + 1 | Scales with group size; ×5 for 7 players — prevents lottery outcomes |
| Decimal rounding | Always round up (ceiling) | Keeps multipliers as whole numbers; favors the correct predictor |
| Score application | Full score (base + exact-score bonus) | Maximizes reward for the highest-quality contrarian picks |
| Draw treatment | Independent third outcome | Draws are a legitimate and skillful prediction |
| Missing predictions | Excluded from denominator | Absent players should not affect active players' odds |
| Crowd visibility | Hidden until match lock | Eliminates herding; preserves independent judgment |
| Minimum group size | 7 (current group floor) | No special handling needed at current scale |
