"use client";

import { useEffect, useState } from "react";

type Score = { homeScore: number; awayScore: number };

export function LiveMatchScore({
  matchId,
  hasExternalId,
  initialScore,
  prediction,
}: {
  matchId: string;
  hasExternalId: boolean;
  initialScore: Score | null;
  prediction: Score | null;
}) {
  const [score, setScore] = useState(initialScore);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!hasExternalId) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function fetchScore() {
      let shouldPoll = true;
      try {
        const response = await fetch(`/api/matches/${matchId}/live`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          if (controller.signal.aborted) return;
          if (typeof data.homeScore === "number" && typeof data.awayScore === "number") {
            setScore({ homeScore: data.homeScore, awayScore: data.awayScore });
          }
          setFinished(data.status === "finished");
          shouldPoll = data.status === "live" || data.status === "scheduled";
        } else if ([400, 401, 403, 404].includes(response.status)) {
          shouldPoll = false;
        }
      } catch {
        // Keep the last known score and retry after transient failures.
      } finally {
        if (!controller.signal.aborted && shouldPoll) {
          timer = setTimeout(fetchScore, 60_000);
        }
      }
    }

    void fetchScore();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [matchId, hasExternalId]);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="text-center">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-live">
          {finished ? "Full time" : "Live score"}
        </p>
        <div className="min-w-[70px] px-[14px] py-1 rounded-md bg-live/10 border border-live/25 text-live font-mono-nums score-glow text-[19px] font-bold">
          {score ? `${score.homeScore}–${score.awayScore}` : "–"}
        </div>
      </div>
      {prediction && (
        <p className="mt-1.5 text-[10.5px] text-muted-foreground font-mono-nums">
          Your pick: {prediction.homeScore}–{prediction.awayScore}
        </p>
      )}
    </>
  );
}
