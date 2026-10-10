package com.maamoun.footballpredictions.core.push

/** Where a tapped push notification should take the user. */
sealed interface NotificationDestination {
    data object Matches : NotificationDestination
    data object MyScore : NotificationDestination
    data object Club : NotificationDestination
    data object Slip : NotificationDestination
    data class MatchDetail(val id: String) : NotificationDestination
}

/**
 * Maps a push `data.type` (+ `data.matchId`) to a destination.
 * Behaviour is taken from `mobile/src/notifications/route-for-notification.ts` — and mirrors iOS `NotificationRouter`.
 */
object NotificationRouter {
    fun destination(data: Map<String, String>?): NotificationDestination {
        val matchId = data?.get("matchId")?.takeIf { it.isNotEmpty() }
        return when (data?.get("type")) {
            "results", "result_correction" -> NotificationDestination.MyScore
            "season_end" -> NotificationDestination.Club
            "goal", "match_started", "match_reminder" ->
                matchId?.let { NotificationDestination.MatchDetail(it) } ?: NotificationDestination.Matches
            "new_matches", "prediction_reminder", "daily_reminder" -> NotificationDestination.Slip
            else -> NotificationDestination.Matches
        }
    }
}
