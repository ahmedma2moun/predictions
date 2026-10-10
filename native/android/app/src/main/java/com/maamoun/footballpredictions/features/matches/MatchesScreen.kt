package com.maamoun.footballpredictions.features.matches

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppHeader
import com.maamoun.footballpredictions.app.AppNav
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppButton
import com.maamoun.footballpredictions.core.designsystem.AppButtonVariant
import com.maamoun.footballpredictions.core.designsystem.CenteredSpinner
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberUpdatedState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchesScreen(app: AppContainer, nav: AppNav) {
    val vm = appViewModel { MatchesViewModel(app) }
    val c = palette
    val state by vm.remote.state.collectAsStateCompat()
    val scope = rememberCoroutineScope()
    val matches = state.data ?: emptyList()

    // Refetch on focus: first resume loads, later resumes refresh.
    LifecycleResumeEffect(Unit) {
        val job = scope.launch { vm.onResume() }
        onPauseOrDispose { job.cancel() }
    }

    Column(Modifier.fillMaxSize().background(c.background)) {
        AppHeader(app, "Matches", vm.subtitle(matches))
        if (state.isLoading && matches.isEmpty() && state.error == null) {
            CenteredSpinner()
        } else {
            PullToRefreshBox(
                isRefreshing = state.isRefreshing,
                onRefresh = { scope.launch { vm.refresh() } },
                modifier = Modifier.fillMaxSize(),
            ) {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(Tokens.Spacing.lg),
                    verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md),
                ) {
                    item {
                        AppButton("Fill your matchday slip →", onClick = nav::openSlip, variant = AppButtonVariant.Outline, modifier = Modifier.fillMaxWidth().let { it })
                    }
                    val sections = vm.sections(matches)
                    if (sections.isEmpty()) {
                        item {
                            Muted(state.error ?: "No upcoming matches available.", align = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xl))
                        }
                    }
                    sections.forEach { section ->
                        item(key = "h-${section.id}") {
                            Text(
                                section.title.uppercase(), color = c.mutedForeground,
                                style = appFont(12.sp, W.Bold, letterSpacing = 0.8.sp), modifier = Modifier.semantics { heading() },
                            )
                        }
                        items(section.matches, key = { it.id }) { match ->
                            MatchCard(app, match) { nav.openMatch(match.id) }
                        }
                    }
                }
            }
        }
    }
}
