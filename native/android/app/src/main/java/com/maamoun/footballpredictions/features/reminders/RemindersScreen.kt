package com.maamoun.footballpredictions.features.reminders

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppHeader
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppButton
import com.maamoun.footballpredictions.core.designsystem.Card
import com.maamoun.footballpredictions.core.designsystem.ErrorCard
import com.maamoun.footballpredictions.core.designsystem.Heading
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemindersScreen(app: AppContainer) {
    val vm = appViewModel { RemindersViewModel(app) }
    val c = palette
    val state by vm.remote.state.collectAsStateCompat()
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current

    LaunchedEffect(Unit) { vm.load() }
    LaunchedEffect(vm.notice) { if (vm.notice == "Reminder preferences saved") haptic.performHapticFeedback(HapticFeedbackType.LongPress) }

    Column(Modifier.fillMaxSize().background(c.background)) {
        AppHeader(app, "Match reminders", "60 minutes before kickoff")
        PullToRefreshBox(isRefreshing = state.isRefreshing, onRefresh = { scope.launch { vm.refresh() } }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Tokens.Spacing.lg), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Muted("Choose at least two teams in a league. You will only be notified for matches between selected teams.")
                state.error?.let { ErrorCard(it) { scope.launch { vm.refresh() } } }
                val data = state.data
                if (state.isLoading && data == null) {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = c.primary) }
                } else {
                    data?.leagues?.forEach { league ->
                        Card(spacing = 10.dp) {
                            Heading(league.name)
                            league.teams.forEach { team ->
                                Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(team.name, color = c.foreground, style = appFont(Tokens.FontSize.md), modifier = Modifier.weight(1f))
                                    Switch(
                                        checked = team.teamLeagueId in vm.selected, onCheckedChange = { vm.setSelected(team.teamLeagueId, it) },
                                        colors = SwitchDefaults.colors(checkedTrackColor = c.primary, checkedThumbColor = c.primaryForeground),
                                    )
                                }
                            }
                        }
                    }
                }
                if (vm.notice.isNotEmpty()) Text(vm.notice, color = if (vm.noticeIsSuccess) c.primary else c.destructive, style = appFont(Tokens.FontSize.md))
                AppButton(if (vm.saving) "Saving..." else "Save preferences", onClick = { scope.launch { vm.save() } }, enabled = !vm.saving && data != null, fullWidth = true)
            }
        }
    }
}
