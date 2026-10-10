package com.maamoun.footballpredictions.features.leaderboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppHeader
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.CenteredSpinner
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaderboardScreen(app: AppContainer) {
    val vm = appViewModel { LeaderboardViewModel(app) }
    val c = palette
    val state by vm.entriesRemote.state.collectAsStateCompat()
    val scope = rememberCoroutineScope()
    val entries = state.data ?: emptyList()
    val showPodium = entries.size >= 3 && vm.isCurrentPeriod
    val loading = state.isLoading || !vm.groupsReady

    LaunchedEffect(Unit) { vm.loadStatic() }
    LaunchedEffect(vm.queryKey) { vm.loadEntries() }

    Column(Modifier.fillMaxSize().background(c.background)) {
        AppHeader(app, "Leaders", vm.subtitle(entries))
        if (loading && entries.isEmpty() && state.error == null) {
            CenteredSpinner()
        } else {
            PullToRefreshBox(isRefreshing = state.isRefreshing, onRefresh = { scope.launch { vm.refresh() } }, modifier = Modifier.fillMaxSize()) {
                LazyColumn(
                    Modifier.fillMaxSize().alpha(if (loading) 0.6f else 1f),
                    contentPadding = PaddingValues(start = Tokens.Spacing.lg, end = Tokens.Spacing.lg, top = Tokens.Spacing.sm, bottom = Tokens.Spacing.lg),
                    verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs),
                ) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md), modifier = Modifier.padding(bottom = Tokens.Spacing.xs)) {
                            LeaderboardFilters(vm)
                            if (showPodium) Podium(entries)
                        }
                    }
                    if (entries.isEmpty()) item {
                        when {
                            loading -> Box(Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xl), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = c.primary) }
                            state.error != null -> EmptyBlock(AppIcon.alert, "Failed to load", state.error!!)
                            vm.offSeason -> EmptyBlock(AppIcon.tabLeaders, "Season has ended", "The leaderboard is cleared. Check the Seasons tab to see final standings.")
                            else -> Muted("No predictions yet", align = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xl))
                        }
                    }
                    itemsIndexed(entries, key = { _, e -> e.userId }) { index, entry ->
                        LeaderboardRow(
                            entry, index, vm.myId, vm.isCurrentPeriod, vm.expandedUserId == entry.userId, vm.expandedLoading,
                            if (vm.expandedUserId == entry.userId) vm.expandedData else null, showPodium && index < 3,
                            vm.championTeamByUser[entry.userId],
                        ) { scope.launch { vm.toggleExpand(entry.userId) } }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyBlock(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, message: String) {
    val c = palette
    Column(Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xxl), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
        Icon(icon, null, tint = c.mutedForeground, modifier = Modifier.size(36.dp))
        Text(title, color = c.foreground, style = appFont(15.sp, W.Semibold))
        Muted(message, align = TextAlign.Center, modifier = Modifier.padding(horizontal = Tokens.Spacing.xl))
    }
}
