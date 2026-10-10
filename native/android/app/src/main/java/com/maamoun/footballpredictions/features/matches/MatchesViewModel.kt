package com.maamoun.footballpredictions.features.matches

import androidx.lifecycle.ViewModel
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.networking.dto.MatchListItem
import com.maamoun.footballpredictions.core.networking.dto.MatchStatus
import com.maamoun.footballpredictions.core.util.RemoteData
import com.maamoun.footballpredictions.core.util.formatMatchDayHeader
import com.maamoun.footballpredictions.core.util.getMatchDayKey
import com.maamoun.footballpredictions.core.util.isMatchLocked
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

data class MatchSection(val id: String, val title: String, val matches: List<MatchListItem>)

class MatchesViewModel(private val app: AppContainer) : ViewModel() {
    val remote = RemoteData<List<MatchListItem>>()
    private var hasAppeared = false

    fun openCount(matches: List<MatchListItem>) =
        matches.count { !isMatchLocked(it.kickoffDate) && it.status == MatchStatus.SCHEDULED }

    fun subtitle(matches: List<MatchListItem>): String? =
        if (matches.isEmpty()) null else "${matches.size} fixture${if (matches.size != 1) "s" else ""} · ${openCount(matches)} still open"

    /** Matches arrive sorted by kickoff ascending, so grouping consecutively preserves order. */
    fun sections(matches: List<MatchListItem>): List<MatchSection> {
        val result = mutableListOf<MatchSection>()
        for (match in matches) {
            val key = getMatchDayKey(match.kickoffDate)
            val last = result.lastOrNull()
            if (last != null && last.id == key) {
                result[result.lastIndex] = last.copy(matches = last.matches + match)
            } else {
                result += MatchSection(key, formatMatchDayHeader(match.kickoffDate), listOf(match))
            }
        }
        return result
    }

    /** First resume loads; every later resume refetches (RN `useFocusEffect`). */
    suspend fun onResume() {
        if (hasAppeared) refresh() else { hasAppeared = true; load() }
    }

    suspend fun load() = remote.run { fetch() }
    suspend fun refresh() = remote.run(isRefresh = true) { fetch() }

    private suspend fun fetch(): List<MatchListItem> = coroutineScope {
        val token = app.token ?: return@coroutineScope emptyList()
        val scheduled = async { app.api.request<List<MatchListItem>>("/api/mobile/matches?status=scheduled", token = token) }
        val live = async { app.api.request<List<MatchListItem>>("/api/mobile/matches?status=live", token = token) }
        (live.await() + scheduled.await()).sortedBy { it.kickoffDate }
    }
}
