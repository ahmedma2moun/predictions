package com.maamoun.footballpredictions.features.slip

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.networking.HttpMethod
import com.maamoun.footballpredictions.core.networking.dto.SlipData
import com.maamoun.footballpredictions.core.networking.dto.SlipMatch
import com.maamoun.footballpredictions.core.networking.dto.SlipPredictionInput
import com.maamoun.footballpredictions.core.networking.dto.SlipResult
import com.maamoun.footballpredictions.core.networking.dto.SlipSaveRequest
import com.maamoun.footballpredictions.core.networking.dto.SlipSaveResponse
import com.maamoun.footballpredictions.core.networking.userMessage
import com.maamoun.footballpredictions.core.util.RemoteData
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import java.time.Instant

data class SlipDraft(val home: String, val away: String)

class SlipViewModel(private val app: AppContainer) : ViewModel() {
    val remote = RemoteData<SlipData>()

    var drafts by mutableStateOf<Map<Int, SlipDraft>>(emptyMap())
        private set
    var errors by mutableStateOf<Map<Int, String>>(emptyMap())
        private set
    var busy by mutableStateOf(false)
        private set
    var notice by mutableStateOf("")
        private set
    var missingOnly by mutableStateOf(false)
    var now by mutableStateOf(Instant.now())
        private set

    fun isLocked(m: SlipMatch) = m.locked || !m.kickoffDate.isAfter(now)

    fun remaining(data: SlipData?) = data?.matches?.count { !isLocked(it) && it.homeScore == null } ?: 0
    fun visibleMatches(data: SlipData): List<SlipMatch> = data.matches.filter { !missingOnly || (!isLocked(it) && it.homeScore == null) }
    fun canSave(data: SlipData?) = data?.matches?.any { drafts[it.id] != null && !isLocked(it) } ?: false

    fun draft(m: SlipMatch) = drafts[m.id] ?: SlipDraft(m.homeScore?.toString() ?: "", m.awayScore?.toString() ?: "")

    fun edit(m: SlipMatch, home: String? = null, away: String? = null) {
        val d = draft(m)
        drafts = drafts + (m.id to SlipDraft(
            home = home?.filter { it.isDigit() }?.take(2) ?: d.home,
            away = away?.filter { it.isDigit() }?.take(2) ?: d.away,
        ))
    }

    fun status(m: SlipMatch) = when {
        isLocked(m) -> "Locked"
        drafts[m.id] != null -> "Unsaved"
        m.homeScore == null -> "Open"
        else -> "✓ Saved"
    }

    suspend fun load() {
        val token = app.token ?: return
        remote.run { app.api.request("/api/mobile/predictions/slip", token = token) }
    }

    /** Keeps lock state accurate while the screen is open (1 s tick, cancelled with the composition). */
    suspend fun tick() { while (true) { delay(1000); now = Instant.now() } }

    private fun valid(s: String) = s.length in 1..2 && s.all { it in '0'..'9' }

    suspend fun save() {
        val data = remote.value.data ?: return
        val token = app.token ?: return
        if (busy) return
        val pending = data.matches.filter { drafts[it.id] != null && !isLocked(it) }
        if (pending.isEmpty()) return

        val invalid = pending.filter { val d = drafts[it.id]!!; !valid(d.home) || !valid(d.away) }.associate { it.id to "Enter both scores, from 0 to 99." }
        errors = invalid
        if (invalid.isNotEmpty()) { notice = "Check your scores. Nothing has been saved."; return }

        busy = true
        notice = ""
        val results = mutableListOf<SlipResult>()
        try {
            pending.chunked(50).forEach { chunk ->
                val body = SlipSaveRequest(chunk.map { SlipPredictionInput(it.id, drafts[it.id]!!.home.toInt(), drafts[it.id]!!.away.toInt()) })
                val response: SlipSaveResponse = app.api.request("/api/mobile/predictions/slip", HttpMethod.POST, body, token)
                results += response.results
            }
            val failed = results.any { !it.saved }
            notice = "${results.count { it.saved }} predictions saved.${if (failed) " Check the matches that could not be saved." else ""}"
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            notice = "${userMessage(e, "Save failed")}. Unsaved entries are still here; retry to confirm them."
        }
        val saved = results.filter { it.saved }.map { it.matchId }.toSet()
        drafts = drafts.filterKeys { it !in saved }
        errors = results.filter { !it.saved }.associate { it.matchId to (it.error ?: "Try again") }
        busy = false
        load()
    }
}
