package com.maamoun.footballpredictions.features.matches

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppForeground
import com.maamoun.footballpredictions.core.networking.ApiError
import com.maamoun.footballpredictions.core.networking.dto.LiveScoreResponse
import com.maamoun.footballpredictions.core.networking.dto.MatchListItem
import com.maamoun.footballpredictions.core.networking.dto.MatchStatus
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.coroutines.coroutineContext

data class LiveScore(val status: MatchStatus, val homeScore: Int?, val awayScore: Int?)

/**
 * Polls `GET matches/{id}/live` every 60 s while the owning composable is visible (LaunchedEffect cancels it).
 * Mirrors `useLiveMatchScore`: skips fetches while backgrounded, keeps the last score on transient
 * errors, stops on 400/401/403/404 and once the match leaves live/scheduled.
 */
class LiveScorePoller(private val app: AppContainer, private val match: MatchListItem) {
    private var score by mutableStateOf<LiveScore?>(null)

    /** Current best-known score: polled value, else the match's own result. */
    val displayed: LiveScore?
        get() = score ?: match.result?.let { LiveScore(match.status, it.homeScore, it.awayScore) }

    suspend fun run() {
        val token = app.token ?: return
        if (match.externalId == null || match.status != MatchStatus.LIVE) return
        while (coroutineContext.isActive) {
            var shouldPoll = true
            if (AppForeground.isActive) {
                try {
                    val data: LiveScoreResponse = app.api.request("/api/mobile/matches/${match.id}/live", token = token)
                    if (data.homeScore != null && data.awayScore != null) score = LiveScore(data.status, data.homeScore, data.awayScore)
                    shouldPoll = data.status == MatchStatus.LIVE || data.status == MatchStatus.SCHEDULED
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    if (e is ApiError && e.status in listOf(400, 401, 403, 404)) shouldPoll = false
                }
            }
            if (!shouldPoll) return
            delay(INTERVAL_MS)
        }
    }

    companion object { const val INTERVAL_MS = 60_000L }
}
