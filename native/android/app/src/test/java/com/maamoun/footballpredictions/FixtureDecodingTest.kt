package com.maamoun.footballpredictions

import com.maamoun.footballpredictions.core.networking.AppJson
import com.maamoun.footballpredictions.core.networking.dto.*
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.serializer
import org.junit.Assert.*
import org.junit.Test

/**
 * Decodes every file in `native/contract/fixtures` into its DTO. The iOS suite does the same with the same
 * file list, so a wire-format change must be reflected on both platforms.
 */
class FixtureDecodingTest {
    private fun text(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name.json")!!.readText()

    private fun <T> decode(s: KSerializer<T>, name: String): T = try {
        AppJson.decodeFromString(s, text(name))
    } catch (e: Exception) {
        fail("Failed to decode $name: $e"); throw e
    }

    private inline fun <reified T> decode(name: String): T = decode(serializer<T>(), name)

    /** Every fixture name must be listed here (and in the iOS test). Keep alphabetical. */
    private val covered = setOf(
        "auth-login", "champion-bonus-disabled", "champion-bonus-locked", "champion-bonus-open", "error",
        "game-hub", "game-hub-empty", "groups", "leaderboard", "leaderboard-live", "leaderboard-user-predictions",
        "leagues", "match-detail", "match-detail-finished", "match-form", "match-group-predictions", "match-live",
        "match-live-minimal", "matches-list", "prediction-save-response", "predictions-history", "predictions-stats",
        "reminders", "reminders-save-response", "season-detail", "seasons", "slip", "slip-save-response", "success",
    )

    @Test fun everyFixtureHasADecodingTest() {
        val dir = java.io.File(javaClass.classLoader!!.getResource("fixtures")!!.toURI())
        val names = dir.listFiles()!!.filter { it.name.endsWith(".json") }.map { it.name.removeSuffix(".json") }.toSet()
        assertEquals("Fixture list out of sync with FixtureDecodingTest.covered", covered, names)
    }

    @Test fun authLogin() {
        val r = decode<LoginResponse>("auth-login")
        assertEquals("7", r.user.id)
        assertEquals("user", r.user.role)
    }

    @Test fun matchesList() {
        val items = decode<List<MatchListItem>>("matches-list")
        assertEquals(4, items.size)
        assertEquals("100", items[0].id) // string ids
        assertEquals(MatchStatus.LIVE, items[0].status)
        assertEquals(1, items[0].result?.homeScore)
        assertEquals(PredictedWinner.HOME, items[1].prediction?.predictedWinner)
        assertEquals(1, items[2].leg)
        assertNull(items[2].homeStanding)
        assertNull(items[3].externalId)
        assertNull(items[3].homeTeam.logo)
        assertNotEquals(java.time.Instant.MAX, items[0].kickoffDate)
    }

    @Test fun matchDetail() {
        val d = decode<MatchDetail>("match-detail")
        assertEquals("101", d.id)
        assertEquals("WWDWW", d.homeStanding?.form)
        assertEquals("100", d.prevMatch?.id)
        assertEquals(5, d.odds?.votes?.homeWin)
        assertEquals(2, d.allPredictions?.size)
        assertEquals(5, d.allPredictions?.first()?.oddsBonus?.finalScore)
        val f = decode<MatchDetail>("match-detail-finished")
        assertEquals(4, f.result?.penaltyHomeScore)
        assertTrue(f.isKnockout)
        assertNull(f.allPredictions)
    }

    @Test fun matchFormAndLive() {
        val form = decode<MatchForm>("match-form")
        assertEquals(3, form.home.size)
        assertEquals(FormResult.W, form.home[0].result)
        assertNull(form.away[0].result)
        assertNull(form.away[0].teamScore)
        val live = decode<LiveScoreResponse>("match-live")
        assertEquals(MatchStatus.LIVE, live.status)
        assertEquals(4, live.events?.size)
        val minimal = decode<LiveScoreResponse>("match-live-minimal")
        assertNull(minimal.homeScore)
        assertEquals(emptyList<MatchEvent>(), minimal.events)
    }

    @Test fun groupPredictions() {
        val rows = decode<List<GroupPredictionEntry>>("match-group-predictions")
        assertEquals(2, rows.size)
        assertFalse(rows[1].predicted)
        assertNull(rows[1].userName)
    }

    @Test fun leaderboard() {
        val rows = decode<List<LeaderboardEntry>>("leaderboard")
        assertEquals(4, rows.size)
        assertTrue(rows[0].isGroupChampion)
        assertEquals(6, rows[1].championBonusPoints)
        val live = decode<LiveGroupStanding>("leaderboard-live")
        assertEquals(listOf(LiveMovement.UP, LiveMovement.SAME, LiveMovement.DOWN), live.standings.map { it.movement })
        assertNull(live.standings[1].name)
        assertEquals(2, decode<List<LeaderboardUserPrediction>>("leaderboard-user-predictions")[0].scoringBreakdown?.size)
    }

    @Test fun groupsAndLeagues() {
        assertEquals(2, decode<List<LeaderboardGroup>>("groups").size)
        assertEquals(2021, decode<List<LeaderboardLeague>>("leagues")[0].externalId)
    }

    @Test fun predictions() {
        val items = decode<List<PredictionHistoryItem>>("predictions-history")
        assertEquals(8, items[0].pointsAwarded)
        assertEquals(1.5, items[0].outcomeOdds, 0.0)
        assertNull(items[1].predictedWinner)
        assertEquals(20, decode<AccuracyStats>("predictions-stats").totalFinished)
        assertTrue(decode<SuccessBody>("prediction-save-response").success)
    }

    @Test fun seasons() {
        assertEquals(listOf("ACTIVE", "ENDED"), decode<List<Season>>("seasons").map { it.status })
        val detail = decode<SeasonWithStandings>("season-detail")
        assertEquals(3, detail.standings.size)
        assertNull(detail.standings[1].userName)
        assertEquals(3, detail.standings[2].groupId)
    }

    @Test fun championBonus() {
        assertEquals(ChampionBonusState.Disabled, decode<ChampionBonusState>("champion-bonus-disabled"))
        val open = decode<ChampionBonusState>("champion-bonus-open") as ChampionBonusState.Open
        assertEquals(2, open.allowedTeams.size)
        assertEquals("11", open.myPick?.teamId)
        val locked = decode<ChampionBonusState>("champion-bonus-locked") as ChampionBonusState.Locked
        assertEquals(2, locked.teams["11"]?.awards?.size)
        assertEquals(2, locked.picks.size)
        assertNull(locked.picks[1].name)
    }

    @Test fun gameHub() {
        val hub = decode<GameHub>("game-hub")
        assertEquals(7, hub.userId) // numeric ids
        assertEquals(listOf(7), hub.weeks[1].winnerIds)
        assertEquals(55, hub.feed[0].matchId)
        assertNull(hub.feed[1].matchId)
        assertEquals(-22, hub.rival?.gap)
        assertEquals(8, hub.recap?.bestPrediction?.points)
        val empty = decode<GameHub>("game-hub-empty")
        assertNull(empty.groupId)
        assertNull(empty.rival)
    }

    @Test fun slipAndReminders() {
        val slip = decode<SlipData>("slip")
        assertEquals(101, slip.matches[0].id)
        assertNull(slip.matches[1].homeScore)
        assertTrue(slip.matches[2].locked)
        assertEquals("Match is locked", decode<SlipSaveResponse>("slip-save-response").results[1].error)
        val reminders = decode<RemindersData>("reminders")
        assertEquals(3, reminders.leagues[0].teams.size)
        assertEquals(2, reminders.selections[0].teams.size)
        assertEquals(1, decode<ReminderSaveResponse>("reminders-save-response").selections.size)
    }

    @Test fun errorAndSuccessShapes() {
        assertEquals("Match is locked", decode<ErrorBody>("error").error)
        assertTrue(decode<SuccessBody>("success").success)
    }

    @Serializable private data class ErrorBody(val error: String)
    @Serializable private data class SuccessBody(val success: Boolean)
}
