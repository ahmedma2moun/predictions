package com.maamoun.footballpredictions

import com.maamoun.footballpredictions.core.push.NotificationDestination
import com.maamoun.footballpredictions.core.push.NotificationRouter
import org.junit.Assert.assertEquals
import org.junit.Test

/** Mirrors `mobile/src/notifications/route-for-notification.ts` — and the iOS `NotificationRouterTests`. */
class NotificationRouterTest {
    private fun route(data: Map<String, String>?) = NotificationRouter.destination(data)

    @Test fun scoreNotificationsOpenMyScore() {
        assertEquals(NotificationDestination.MyScore, route(mapOf("type" to "results")))
        assertEquals(NotificationDestination.MyScore, route(mapOf("type" to "result_correction")))
    }

    @Test fun seasonEndOpensClub() = assertEquals(NotificationDestination.Club, route(mapOf("type" to "season_end")))

    @Test fun matchNotificationsOpenDetailOrFallBack() {
        for (type in listOf("goal", "match_started", "match_reminder")) {
            assertEquals(NotificationDestination.MatchDetail("42"), route(mapOf("type" to type, "matchId" to "42")))
            assertEquals(NotificationDestination.Matches, route(mapOf("type" to type)))
            assertEquals(NotificationDestination.Matches, route(mapOf("type" to type, "matchId" to "")))
        }
    }

    @Test fun reminderNotificationsOpenSlip() {
        for (type in listOf("new_matches", "prediction_reminder", "daily_reminder")) assertEquals(NotificationDestination.Slip, route(mapOf("type" to type)))
    }

    @Test fun unknownOrMissingOpensMatches() {
        assertEquals(NotificationDestination.Matches, route(mapOf("type" to "wat")))
        assertEquals(NotificationDestination.Matches, route(emptyMap()))
        assertEquals(NotificationDestination.Matches, route(null))
    }
}
