package com.maamoun.footballpredictions.features.club

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.networking.HttpMethod
import com.maamoun.footballpredictions.core.networking.dto.GameHub
import com.maamoun.footballpredictions.core.networking.dto.WeekCompetition
import com.maamoun.footballpredictions.core.networking.userMessage
import com.maamoun.footballpredictions.core.util.RemoteData
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

enum class ClubSection(val label: String) {
    Week("Weekly cup"), Feed("Activity"), Rival("My rival"), Rewards("Challenges"), Recap("My recap")
}

/** Query identity: the screen re-fetches when group/season selection changes. */
data class ClubQueryKey(val groupId: Int?, val seasonId: Int?)

class ClubViewModel(private val app: AppContainer) : ViewModel() {
    val remote = RemoteData<GameHub>()

    var groupId by mutableStateOf<Int?>(null)
        private set
    var seasonId by mutableStateOf<Int?>(null)
        private set
    var weekKey by mutableStateOf("")
    var section by mutableStateOf(ClubSection.Week)
    var busy by mutableStateOf(false)
        private set
    var notice by mutableStateOf("")
        private set

    fun selectGroup(id: Int) { groupId = id; weekKey = "" }
    fun selectSeason(id: Int) { seasonId = id; weekKey = "" }

    val queryKey: ClubQueryKey get() = ClubQueryKey(groupId, seasonId)

    fun selectedWeek(hub: GameHub): WeekCompetition? =
        hub.weeks.firstOrNull { it.key == weekKey } ?: hub.weeks.firstOrNull { it.key == hub.currentWeekKey } ?: hub.weeks.firstOrNull()

    private val query: String
        get() = listOfNotNull(groupId?.let { "groupId=$it" }, seasonId?.let { "seasonId=$it" }).joinToString("&")

    suspend fun load() {
        val token = app.token ?: return
        val q = query
        remote.run { app.api.request("/api/mobile/game?$q", token = token) }
    }

    suspend fun refresh() {
        val token = app.token ?: return
        val q = query
        remote.run(isRefresh = true) { app.api.request("/api/mobile/game?$q", token = token) }
    }

    /** POST /api/mobile/game. Explicit JSON nulls (clear rival/title/reaction, unset group/season) are significant. */
    suspend fun act(fields: Map<String, JsonElement>) {
        val hub = remote.value.data ?: return
        val token = app.token ?: return
        if (busy) return
        busy = true
        notice = ""
        try {
            val body = JsonObject(
                fields + mapOf(
                    "groupId" to (hub.groupId?.let { JsonPrimitive(it) } ?: JsonNull),
                    "seasonId" to (hub.seasonId?.let { JsonPrimitive(it) } ?: JsonNull),
                ),
            )
            app.api.send("/api/mobile/game", HttpMethod.POST, body, token)
            refresh()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            notice = userMessage(e, "Please try again")
        }
        busy = false
    }

    suspend fun react(eventKey: String, emoji: String?) = act(mapOf(
        "action" to JsonPrimitive("reaction"), "eventKey" to JsonPrimitive(eventKey), "emoji" to (emoji?.let { JsonPrimitive(it) } ?: JsonNull)))
    suspend fun setRival(rivalId: Int?) = act(mapOf("action" to JsonPrimitive("rival"), "rivalId" to (rivalId?.let { JsonPrimitive(it) } ?: JsonNull)))
    suspend fun setTitle(key: String?) = act(mapOf("action" to JsonPrimitive("title"), "key" to (key?.let { JsonPrimitive(it) } ?: JsonNull)))

    fun winnerNames(week: WeekCompetition): String =
        week.standings.filter { it.userId in week.winnerIds }.joinToString(" & ") { it.name }
}
