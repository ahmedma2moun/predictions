import { ROUTES } from '@/constants/routes';

/**
 * Maps a push-notification `data.type` to the in-app route that should open
 * when the user taps the notification.
 *
 * Notification types are emitted by the backend:
 *  - `results`            — scores were processed (score-related)        → My Score
 *  - `result_correction`  — a previous score was corrected (score-related) → My Score
 *  - `season_end`         — a season finished                            → Seasons
 *  - `new_matches`        — new fixtures available to predict            → Matches
 *  - `prediction_reminder`— reminder to submit predictions              → Matches
 *  - `daily_reminder`     — daily nudge                                  → Matches
 *  - anything else / missing                                            → Matches
 */
export function routeForNotification(data: unknown): string {
  const type = (data as { type?: string } | null | undefined)?.type;

  switch (type) {
    case 'results':
    case 'result_correction':
      return ROUTES.predictions; // "My Score" tab
    case 'season_end':
      return ROUTES.seasons;
    case 'new_matches':
    case 'prediction_reminder':
    case 'daily_reminder':
    default:
      return ROUTES.matches;
  }
}
