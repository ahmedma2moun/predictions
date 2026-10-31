package com.maamoun.footballpredictions.widget

import android.content.Context
import androidx.glance.appwidget.updateAll
import com.maamoun.footballpredictions.core.networking.dto.MatchListItem
import com.maamoun.footballpredictions.core.networking.dto.MatchStatus
import com.maamoun.footballpredictions.core.util.countMissingPicks
import com.maamoun.footballpredictions.core.util.formatKickoff
import com.maamoun.footballpredictions.core.util.isMatchLocked
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.Instant

/**
 * What the home-screen widget shows. The app writes it whenever it loads matches or the leaderboard; the widget
 * only reads it (no network, no token in the widget). The iOS twin is `Shared/WidgetSnapshot.swift`.
 */
@Serializable
data class WidgetMatch(
    val id: String,
    val home: String,
    val away: String,
    val kickoffEpochSeconds: Long,
    /** Pre-formatted in the app's display time zone (CLT), e.g. "Sat 17 Oct, 14:00". */
    val kickoffLabel: String,
    val competition: String? = null,
    /** "2–1" when the user already predicted this match. */
    val prediction: String? = null,
) {
    val kickoff: Instant get() = Instant.ofEpochSecond(kickoffEpochSeconds)
}

@Serializable
data class WidgetSnapshot(
    val signedIn: Boolean = false,
    /** Soonest scheduled, still-open match (predicted or not). */
    val next: WidgetMatch? = null,
    /** Upcoming open matches without a prediction (same number as the Matches tab badge). */
    val missingPicks: Int = 0,
    /** All-time leaderboard standing, only set after the user has viewed the unfiltered all-time board. */
    val rank: Int? = null,
    val points: Int? = null,
    val players: Int? = null,
) {
    /** A match is locked from kickoff on (same rule as `isMatchLocked`). */
    fun isLocked(match: WidgetMatch, now: Instant = Instant.now()): Boolean = isMatchLocked(match.kickoff, now)

    companion object {
        val SignedOut = WidgetSnapshot()
        val Sample = WidgetSnapshot(
            signedIn = true,
            next = WidgetMatch("1", "Arsenal", "Chelsea", Instant.now().plusSeconds(2 * 3600 + 14 * 60).epochSecond, "Sat 17 Oct, 21:00", "Premier League"),
            missingPicks = 3, rank = 3, points = 48, players = 12,
        )
    }
}

/** Soonest scheduled match that has not kicked off, as the widget shows it. */
fun nextWidgetMatch(matches: List<MatchListItem>, now: Instant = Instant.now()): WidgetMatch? {
    val m = matches
        .filter { it.status == MatchStatus.SCHEDULED && !isMatchLocked(it.kickoffDate, now) }
        .minByOrNull { it.kickoffDate } ?: return null
    return WidgetMatch(
        id = m.id, home = m.homeTeam.name, away = m.awayTeam.name,
        kickoffEpochSeconds = m.kickoffDate.epochSecond, kickoffLabel = formatKickoff(m.kickoffDate),
        competition = m.leagueName,
        prediction = m.prediction?.let { "${it.homeScore}–${it.awayScore}" },
    )
}

/** Deep links opened from a widget tap: the same intent extras a push notification tap carries. */
object WidgetLink {
    fun match(id: String) = mapOf("type" to "match_reminder", "matchId" to id)
    val matches = mapOf("type" to "widget_matches")
    val slip = mapOf("type" to "new_matches")
    val leaders = mapOf("type" to "leaderboard")
}

/** Keeps the widget snapshot in step with what the app has loaded. Best-effort: never fails the caller. */
object WidgetBridge {
    private const val PREFS = "fp_widget"
    private const val KEY = "snapshot"
    private val json = Json { ignoreUnknownKeys = true }

    fun load(context: Context): WidgetSnapshot =
        runCatching {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
                ?.let { json.decodeFromString<WidgetSnapshot>(it) }
        }.getOrNull() ?: WidgetSnapshot.SignedOut

    suspend fun update(context: Context, matches: List<MatchListItem>, now: Instant = Instant.now()) {
        write(context, load(context).copy(signedIn = true, next = nextWidgetMatch(matches, now), missingPicks = countMissingPicks(matches, now)))
    }

    /** Call only for the unfiltered all-time board, so the number means one thing. */
    suspend fun update(context: Context, rank: Int, points: Int, players: Int) {
        write(context, load(context).copy(signedIn = true, rank = rank, points = points, players = players))
    }

    suspend fun clear(context: Context) = write(context, WidgetSnapshot.SignedOut)

    private suspend fun write(context: Context, snapshot: WidgetSnapshot) {
        if (load(context) == snapshot) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json.encodeToString(snapshot)).apply()
        runCatching { NextMatchWidget().updateAll(context) }
    }
}
