package com.maamoun.footballpredictions.features.myscore

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.clickable
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppHeader
import com.maamoun.footballpredictions.app.AppNav
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.CenteredSpinner
import com.maamoun.footballpredictions.core.designsystem.IconButton
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.features.champion.ChampionBonusViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyScoreScreen(app: AppContainer, nav: AppNav) {
    val vm = appViewModel { MyScoreViewModel(app) }
    val champion = appViewModel { ChampionBonusViewModel(app) }
    val c = palette
    val predictionsState by vm.predictionsRemote.state.collectAsStateCompat()
    val statsState by vm.statsRemote.state.collectAsStateCompat()
    val championState by champion.remote.state.collectAsStateCompat()
    val scope = rememberCoroutineScope()
    val predictions = predictionsState.data ?: emptyList()

    LaunchedEffect(Unit) { coroutineScope { launch { vm.load() }; launch { champion.load() } } }

    val sorted = vm.sorted(predictions)
    val page = sorted.take(vm.visibleCount)
    val remaining = (sorted.size - vm.visibleCount).coerceAtLeast(0)

    Column(Modifier.fillMaxSize().background(c.background)) {
        AppHeader(app, "My Score", "${vm.totalPoints(predictions)} pts total")
        if (predictionsState.isLoading && predictions.isEmpty() && predictionsState.error == null) {
            CenteredSpinner()
        } else {
            PullToRefreshBox(
                isRefreshing = predictionsState.isRefreshing,
                onRefresh = { scope.launch { coroutineScope { launch { vm.refresh() }; launch { champion.refresh() } } } },
                modifier = Modifier.fillMaxSize(),
            ) {
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(Tokens.Spacing.lg), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md), modifier = Modifier.padding(bottom = Tokens.Spacing.sm)) {
                            statsState.data?.takeIf { it.totalFinished > 0 }?.let {
                                AccuracyStatsCard(it, vm.weekPoints(predictions), vm.recentPoints(predictions))
                            }
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                IconButton(AppIcon.chevronLeft, "Previous week", { vm.changeWeek(-1) }, diameter = 32.dp, iconSize = 18.dp)
                                Text(vm.weekLabel, color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold, mono = false))
                                IconButton(AppIcon.chevronRight, "Next week", { vm.changeWeek(1) }, diameter = 32.dp, iconSize = 18.dp)
                            }
                            ChampionBonusMyScoreCard(championState.data, onOpen = nav::openChampion)
                        }
                    }
                    if (page.isEmpty()) item {
                        Muted(
                            predictionsState.error ?: if (predictions.isEmpty()) "No predictions yet. Go predict some matches!" else "No scored predictions for this week.",
                            align = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xl),
                        )
                    }
                    items(page, key = { it.id }) { PredictionCard(app, it) }
                    if (remaining > 0) item {
                        Text(
                            "Show more ($remaining remaining)", color = c.mutedForeground, style = appFont(Tokens.FontSize.sm, align = TextAlign.Center),
                            modifier = Modifier.fillMaxWidth().clickable { vm.showMore() }.padding(vertical = Tokens.Spacing.md),
                        )
                    }
                }
            }
        }
    }
}
