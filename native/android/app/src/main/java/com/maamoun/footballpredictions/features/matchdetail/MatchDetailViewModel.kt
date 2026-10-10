package com.maamoun.footballpredictions.features.matchdetail

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppNav
import com.maamoun.footballpredictions.core.networking.ApiError
import com.maamoun.footballpredictions.core.networking.HttpMethod
import com.maamoun.footballpredictions.core.networking.dto.LiveScoreResponse
import com.maamoun.footballpredictions.core.networking.dto.MatchDetail
import com.maamoun.footballpredictions.core.networking.dto.MatchEvent
import com.maamoun.footballpredictions.core.networking.dto.MatchForm
import com.maamoun.footballpredictions.core.networking.dto.MatchStatus
import com.maamoun.footballpredictions.core.networking.dto.SavePredictionRequest
import com.maamoun.footballpredictions.core.util.RemoteData
import com.maamoun.footballpredictions.core.util.formatMatchStatus
import com.maamoun.footballpredictions.core.util.formatStage
import com.maamoun.footballpredictions.core.util.isKnockoutStage
import com.maamoun.footballpredictions.core.util.isMatchLocked
import com.maamoun.footballpredictions.features.matches.LiveScorePoller
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class ScorePair(val home: Int, val away: Int)
data class MatchDetailPayload(val match: MatchDetail, val form: MatchForm?)

class MatchDetailViewModel(private val app: AppContainer, val matchId: String) : ViewModel() {
    val remote = RemoteData<MatchDetailPayload>()

    var home by mutableIntStateOf(0)
    var away by mutableIntStateOf(0)
    var saving by mutableStateOf(false)
        private set
    var saveCount by mutableIntStateOf(0)
        private set
    var liveScore by mutableStateOf<ScorePair?>(null)
        private set
    var matchEvents by mutableStateOf<List<MatchEvent>?>(null)
        private set

    val match: MatchDetail? get() = remote.value.data?.match
    val locked: Boolean get() = match?.let { isMatchLocked(it.kickoffDate) } ?: false
    val knockout: Boolean get() = isKnockoutStage(match?.stage)
    val canPredict: Boolean get() = match?.let { !it.isAdmin && !locked } ?: false

    val winnerLabel: String
        get() = match.let { m ->
            if (m == null) "Draw" else if (home > away) m.homeTeam.name else if (away > home) m.awayTeam.name else "Draw"
        }

    fun matchdayTitle(m: MatchDetail?): String {
        if (m == null) return ""
        val suffix = m.leagueName?.let { " · ${it.uppercase()}" } ?: ""
        return when {
            isKnockoutStage(m.stage) -> "${formatStage(m.stage!!)}${m.leg?.let { " · Leg $it" } ?: ""}$suffix"
            m.matchday != null -> "MD ${m.matchday}$suffix"
            else -> m.leagueName?.uppercase() ?: formatMatchStatus(m.status).uppercase()
        }
    }

    suspend fun load() {
        val token = app.token ?: return
        remote.run {
            coroutineScope {
                val detail = async { app.api.request<MatchDetail>("/api/mobile/matches/$matchId", token = token) }
                val form = async { runCatching { app.api.request<MatchForm>("/api/mobile/matches/$matchId/form", token = token) }.getOrNull() }
                MatchDetailPayload(detail.await(), form.await())
            }
        }
        match?.prediction?.let { home = it.homeScore; away = it.awayScore }
    }

    /**
     * Live score + events: only for locked matches with an external id. Re-polls every 60 s while the match
     * is `live`; any error ends polling (live data is best-effort).
     */
    suspend fun pollLive() {
        val token = app.token ?: return
        val m = match ?: return
        if (m.externalId == null || !locked) return
        while (true) {
            try {
                val live: LiveScoreResponse = app.api.request("/api/mobile/matches/$matchId/live", token = token)
                if (live.homeScore != null && live.awayScore != null) liveScore = ScorePair(live.homeScore, live.awayScore)
                if (!live.events.isNullOrEmpty()) matchEvents = live.events
                if (live.status != MatchStatus.LIVE) return
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                return
            }
            delay(LiveScorePoller.INTERVAL_MS)
        }
    }

    fun submit(nav: AppNav) {
        val token = app.token ?: return
        val m = match ?: return
        viewModelScope.launch {
            saving = true
            try {
                app.api.send("/api/mobile/predictions", HttpMethod.POST, SavePredictionRequest(m.id, home, away), token)
                saveCount++
                app.alerts.show("Prediction saved")
                val next = m.nextMatch
                if (next != null) nav.replaceMatch(next.id) else nav.back()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                app.alerts.show("Save failed", (e as? ApiError)?.message ?: "Failed to save prediction")
            } finally {
                saving = false
            }
        }
    }
}
