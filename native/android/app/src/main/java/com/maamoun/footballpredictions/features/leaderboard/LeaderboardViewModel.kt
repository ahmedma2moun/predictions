package com.maamoun.footballpredictions.features.leaderboard

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.networking.dto.ChampionBonusState
import com.maamoun.footballpredictions.core.networking.dto.LeaderboardEntry
import com.maamoun.footballpredictions.core.networking.dto.LeaderboardGroup
import com.maamoun.footballpredictions.core.networking.dto.LeaderboardLeague
import com.maamoun.footballpredictions.core.networking.dto.LeaderboardUserPrediction
import com.maamoun.footballpredictions.core.networking.dto.Season
import com.maamoun.footballpredictions.core.util.DateBounds
import com.maamoun.footballpredictions.core.util.RemoteData
import com.maamoun.footballpredictions.core.util.computeMonthLabel
import com.maamoun.footballpredictions.core.util.computeWeekLabel
import com.maamoun.footballpredictions.core.util.getMonthBounds
import com.maamoun.footballpredictions.core.util.getWeekBounds
import com.maamoun.footballpredictions.core.util.isoString
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.net.URLEncoder
import java.time.Instant

enum class Period(val label: String) { Week("Week"), Month("Month"), All("All Time") }

/** Identity of the current query; the screen re-fetches (and collapses any expanded row) when it changes. */
data class QueryKey(val ready: Boolean, val period: Period, val weekOffset: Int, val monthOffset: Int, val groupId: String?, val leagues: List<String>)

class LeaderboardViewModel(private val app: AppContainer) : ViewModel() {
    val entriesRemote = RemoteData<List<LeaderboardEntry>>()
    private val expandedCache = LinkedHashMap<String, List<LeaderboardUserPrediction>>()

    var period by mutableStateOf(Period.All)
    var weekOffset by mutableIntStateOf(0)
    var monthOffset by mutableIntStateOf(0)

    var groups by mutableStateOf<List<LeaderboardGroup>>(emptyList())
        private set
    var groupId by mutableStateOf<String?>(null)
    var groupsReady by mutableStateOf(false)
        private set

    var leagues by mutableStateOf<List<LeaderboardLeague>>(emptyList())
        private set
    var selectedLeagues by mutableStateOf<List<String>>(emptyList())
    var leagueDropdownOpen by mutableStateOf(false)

    var expandedUserId by mutableStateOf<String?>(null)
        private set
    var expandedLoading by mutableStateOf(false)
        private set
    var expandedData by mutableStateOf<List<LeaderboardUserPrediction>?>(null)
        private set

    var championTeamByUser by mutableStateOf<Map<String, String>>(emptyMap())
        private set
    var offSeason by mutableStateOf(false)
        private set

    val myId: String? get() = app.auth.user?.id
    val weekLabel: String get() = computeWeekLabel(weekOffset)
    val monthLabel: String get() = computeMonthLabel(monthOffset)

    val dateRange: DateBounds?
        get() = when (period) { Period.Week -> getWeekBounds(weekOffset); Period.Month -> getMonthBounds(monthOffset); Period.All -> null }
    val isCurrentPeriod: Boolean get() = dateRange?.let { it.to.isAfter(Instant.now()) } ?: true

    val queryKey: QueryKey get() = QueryKey(groupsReady, period, weekOffset, monthOffset, groupId, selectedLeagues)

    fun subtitle(entries: List<LeaderboardEntry>): String? {
        if (entries.isEmpty()) return null
        val players = "${entries.size} player${if (entries.size != 1) "s" else ""}"
        return groups.firstOrNull { it.id == groupId }?.name?.let { "$it · $players" } ?: players
    }

    /** Groups, leagues, champion picks and season status (fire-once). */
    suspend fun loadStatic() {
        val token = app.token ?: return
        coroutineScope {
            val g = async {
                runCatching { app.api.request<List<LeaderboardGroup>>("/api/mobile/groups", token = token) }.getOrNull()?.let { data ->
                    groups = data.filter { !it.isDefault } + data.filter { it.isDefault }
                    groupId = groups.firstOrNull()?.id
                }
                groupsReady = true
            }
            val l = async { leagues = runCatching { app.api.request<List<LeaderboardLeague>>("/api/mobile/leagues", token = token) }.getOrDefault(emptyList()) }
            val ch = async {
                val state = runCatching { app.api.request<ChampionBonusState>("/api/mobile/champion-bonus", token = token) }.getOrNull()
                if (state is ChampionBonusState.Locked) championTeamByUser = state.picks.associate { it.userId to it.teamName }
            }
            val s = async {
                runCatching { app.api.request<List<Season>>("/api/mobile/seasons", token = token) }.getOrNull()?.let { seasons ->
                    offSeason = seasons.none { it.status == "ACTIVE" }
                }
            }
            g.await(); l.await(); ch.await(); s.await()
        }
    }

    suspend fun loadEntries() {
        collapse()
        if (!groupsReady) return
        entriesRemote.run { fetchEntries() }
    }

    suspend fun refresh() {
        if (!groupsReady) return
        entriesRemote.run(isRefresh = true) { fetchEntries() }
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun rangeQuery(): String =
        dateRange?.let { "&from=${enc(isoString(it.from))}&to=${enc(isoString(it.to))}" } ?: ""

    private suspend fun fetchEntries(): List<LeaderboardEntry> {
        val token = app.token ?: return emptyList()
        var url = "/api/mobile/leaderboard?_=1" + rangeQuery()
        groupId?.let { url += "&groupId=${enc(it)}" }
        selectedLeagues.forEach { url += "&leagueId=${enc(it)}" }
        return app.api.request(url, token = token)
    }

    private fun collapse() { expandedUserId = null; expandedData = null }

    suspend fun toggleExpand(userId: String) {
        if (expandedUserId == userId) { collapse(); return }
        val token = app.token ?: return
        val range = dateRange
        val key = listOf(userId, range?.let { isoString(it.from) } ?: "", range?.let { isoString(it.to) } ?: "", selectedLeagues.sorted().joinToString(",")).joinToString(":")

        expandedUserId = userId
        expandedCache[key]?.let { expandedData = it; return }
        expandedLoading = true
        expandedData = null
        var url = "/api/mobile/leaderboard/user-predictions?userId=${enc(userId)}" + rangeQuery()
        selectedLeagues.forEach { url += "&leagueId=${enc(it)}" }
        try {
            val data: List<LeaderboardUserPrediction> = app.api.request(url, token = token)
            if (expandedCache.size >= 20) expandedCache.remove(expandedCache.keys.first())
            expandedCache[key] = data
            if (expandedUserId == userId) expandedData = data
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (expandedUserId == userId) expandedData = emptyList()
        }
        expandedLoading = false
    }
}
