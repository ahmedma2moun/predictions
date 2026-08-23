import type { Href } from 'expo-router';
import { ROUTES } from '@/constants/routes';

/**
 * Maps a push-notification `data.type` (+ `data.matchId` where relevant) to
 * the in-app route that should open when the user taps the notification.
 *
 * Notification types are emitted by the backend:
 *  - `results`            — scores were processed (score-related)        → My Score
 *  - `result_correction`  — a previous score was corrected (score-related) → My Score
 *  - `season_end`         — a season finished                            → Seasons
 *  - `goal`                — a goal in a live match                       → Match details (falls back to Matches if matchId missing)
 *  - `match_started`       — a match just kicked off                      → Match details (falls back to Matches if matchId missing)
 *  - `match_reminder`      — a specific match kicks off in 60 minutes     → Match details (falls back to Matches if matchId missing)
 *  - `new_matches`        — new fixtures available to predict            → Matches
 *  - `prediction_reminder`— reminder to submit predictions              → Matches
 *  - `daily_reminder`     — daily nudge                                  → Matches
 *  - anything else / missing                                            → Matches
 */
export function routeForNotification(data: unknown): Href {
  const { type, matchId } = (data as { type?: string; matchId?: string } | null | undefined) ?? {};

  switch (type) {
    case 'results':
    case 'result_correction':
      return ROUTES.predictions; // "My Score" tab
    case 'season_end':
      return ROUTES.seasons;
    case 'goal':
    case 'match_started':
    case 'match_reminder':
      return matchId ? ROUTES.matchDetail(matchId) : ROUTES.matches;
    case 'new_matches':
    case 'prediction_reminder':
    case 'daily_reminder':
    default:
      return ROUTES.matches;
  }
}
