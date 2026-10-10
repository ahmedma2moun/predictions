package com.maamoun.footballpredictions.features.reminders

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.networking.HttpMethod
import com.maamoun.footballpredictions.core.networking.dto.ReminderSelectionsRequest
import com.maamoun.footballpredictions.core.networking.dto.RemindersData
import com.maamoun.footballpredictions.core.networking.userMessage
import com.maamoun.footballpredictions.core.util.RemoteData
import kotlinx.coroutines.CancellationException

class RemindersViewModel(private val app: AppContainer) : ViewModel() {
    val remote = RemoteData<RemindersData>()
    var selected by mutableStateOf<Set<Int>>(emptySet())
        private set
    var notice by mutableStateOf("")
        private set
    var saving by mutableStateOf(false)
        private set

    val noticeIsSuccess: Boolean get() = notice.contains("saved")

    suspend fun load() { fetch(false) }
    suspend fun refresh() { fetch(true) }

    private suspend fun fetch(isRefresh: Boolean) {
        val token = app.token ?: return
        remote.run(isRefresh) { app.api.request("/api/mobile/reminders", token = token) }
        remote.value.data?.let { data -> selected = data.selections.flatMap { l -> l.teams.map { it.teamLeagueId } }.toSet() }
    }

    fun setSelected(teamLeagueId: Int, on: Boolean) { selected = if (on) selected + teamLeagueId else selected - teamLeagueId }

    suspend fun save() {
        val token = app.token ?: return
        val data = remote.value.data
        data?.leagues?.firstOrNull { l -> l.teams.count { it.teamLeagueId in selected } == 1 }?.let {
            notice = "Select at least two teams in ${it.name}"
            return
        }
        saving = true
        notice = ""
        try {
            app.api.send("/api/mobile/reminders", HttpMethod.PUT, ReminderSelectionsRequest(selected.sorted()), token)
            notice = "Reminder preferences saved"
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            notice = userMessage(e, "Could not save")
        }
        saving = false
    }
}
