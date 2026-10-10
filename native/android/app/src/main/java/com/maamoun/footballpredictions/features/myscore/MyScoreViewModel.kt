package com.maamoun.footballpredictions.features.myscore

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.networking.dto.AccuracyStats
import com.maamoun.footballpredictions.core.networking.dto.PredictionHistoryItem
import com.maamoun.footballpredictions.core.util.RemoteData
import com.maamoun.footballpredictions.core.util.computeWeekLabel
import com.maamoun.footballpredictions.core.util.getWeekBounds
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

class MyScoreViewModel(private val app: AppContainer) : ViewModel() {
    val predictionsRemote = RemoteData<List<PredictionHistoryItem>>()
    val statsRemote = RemoteData<AccuracyStats>()

    var weekOffset by mutableIntStateOf(0)
        private set
    var visibleCount by mutableIntStateOf(PAGE_SIZE)
        private set

    fun changeWeek(delta: Int) { weekOffset += delta; visibleCount = PAGE_SIZE }
    fun showMore() { visibleCount += PAGE_SIZE }

    val weekLabel: String get() = computeWeekLabel(weekOffset)

    fun totalPoints(all: List<PredictionHistoryItem>) = all.sumOf { it.pointsAwarded }

    private fun weekPredictions(all: List<PredictionHistoryItem>): List<PredictionHistoryItem> {
        val bounds = getWeekBounds(weekOffset)
        return all.filter { p -> p.match.result != null && p.match.kickoffDate >= bounds.from && p.match.kickoffDate < bounds.to }
    }

    /** Scored predictions in the selected week, newest first. */
    fun sorted(all: List<PredictionHistoryItem>) = weekPredictions(all).sortedByDescending { it.match.kickoffDate }
    fun weekPoints(all: List<PredictionHistoryItem>) = weekPredictions(all).sumOf { it.pointsAwarded }

    /** Last 10 scored predictions across all time, oldest first (sparkline). */
    fun recentPoints(all: List<PredictionHistoryItem>): List<Int> =
        all.filter { it.match.result != null }.sortedByDescending { it.match.kickoffDate }.take(10).reversed().map { it.pointsAwarded }

    suspend fun load() = fetchBoth(false)
    suspend fun refresh() = fetchBoth(true)

    private suspend fun fetchBoth(isRefresh: Boolean) = coroutineScope {
        val token = app.token ?: return@coroutineScope
        val a = async { predictionsRemote.run(isRefresh) { app.api.request("/api/mobile/predictions", token = token) } }
        val b = async { statsRemote.run(isRefresh) { app.api.request("/api/mobile/predictions/stats", token = token) } }
        a.await(); b.await()
    }

    companion object { const val PAGE_SIZE = 20 }
}
