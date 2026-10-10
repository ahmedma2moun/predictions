package com.maamoun.footballpredictions.features.champion

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.networking.HttpMethod
import com.maamoun.footballpredictions.core.networking.dto.ChampionBonusState
import com.maamoun.footballpredictions.core.networking.dto.PickChampionRequest
import com.maamoun.footballpredictions.core.networking.userMessage
import com.maamoun.footballpredictions.core.util.RemoteData
import kotlinx.coroutines.CancellationException

/** Champion Bonus state, shared by the Champion screen and the My Score card (RN `useChampionBonus`). */
class ChampionBonusViewModel(private val app: AppContainer) : ViewModel() {
    val remote = RemoteData<ChampionBonusState>()
    var picking by mutableStateOf<String?>(null)
        private set
    var pickError by mutableStateOf<String?>(null)
        private set

    suspend fun load() {
        val token = app.token ?: return
        remote.run { app.api.request("/api/mobile/champion-bonus", token = token) }
    }

    suspend fun refresh() {
        val token = app.token ?: return
        remote.run(isRefresh = true) { app.api.request("/api/mobile/champion-bonus", token = token) }
    }

    suspend fun pick(teamId: String) {
        val token = app.token ?: return
        picking = teamId
        pickError = null
        try {
            app.api.send("/api/mobile/champion-bonus/pick", HttpMethod.POST, PickChampionRequest(teamId.toIntOrNull() ?: 0), token)
            refresh()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            pickError = userMessage(e, "Failed to pick")
        }
        picking = null
    }
}
