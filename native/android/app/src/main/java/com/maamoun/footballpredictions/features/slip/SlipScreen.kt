package com.maamoun.footballpredictions.features.slip

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.clickable
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppNav
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppButton
import com.maamoun.footballpredictions.core.designsystem.AppButtonVariant
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Card
import com.maamoun.footballpredictions.core.designsystem.Divider
import com.maamoun.footballpredictions.core.designsystem.ErrorCard
import com.maamoun.footballpredictions.core.designsystem.Heading
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.SlipMatch
import com.maamoun.footballpredictions.core.util.formatSlipKickoff
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SlipScreen(app: AppContainer, nav: AppNav) {
    val vm = appViewModel { SlipViewModel(app) }
    val c = palette
    val state by vm.remote.state.collectAsStateCompat()
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val data = state.data

    LaunchedEffect(Unit) { vm.load() }
    LaunchedEffect(Unit) { vm.tick() }
    LaunchedEffect(vm.notice) { if (vm.notice.contains("saved.")) haptic.performHapticFeedback(HapticFeedbackType.LongPress) }

    Column(Modifier.fillMaxSize().background(c.background).imePadding()) {
        CenterAlignedTopAppBar(
            title = { Text("Matchday slip", color = c.foreground, style = appFont(Tokens.FontSize.lg, W.Bold)) },
            navigationIcon = {
                Box(Modifier.padding(start = Tokens.Spacing.sm).height(40.dp).width(40.dp).clip(androidx.compose.foundation.shape.CircleShape)
                    .clickable(role = Role.Button, onClick = nav::back).semantics { contentDescription = "Back" }, contentAlignment = Alignment.Center) {
                    Icon(AppIcon.chevronLeft, null, tint = c.foreground)
                }
            },
            colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = c.background),
        )
        Divider()
        PullToRefreshBox(isRefreshing = false, onRefresh = { scope.launch { vm.load() } }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Tokens.Spacing.lg), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.lg)) {
                Heading("Your matchday slip")
                Muted("Quick picks for the next seven Cairo calendar days. Each match locks at kickoff.")
                if (state.isLoading && data == null) Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = c.primary) }
                state.error?.let { ErrorCard(it) { scope.launch { vm.load() } } }
                if (data != null) {
                    Card(spacing = Tokens.Spacing.sm) {
                        Heading("${vm.remaining(data)} predictions remaining")
                        Muted("Counts saved picks only.")
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Muted("Unfinished only")
                            Switch(
                                checked = vm.missingOnly, onCheckedChange = { vm.missingOnly = it },
                                colors = SwitchDefaults.colors(checkedTrackColor = c.primary, checkedThumbColor = c.primaryForeground),
                                modifier = Modifier.semantics { contentDescription = "Show unfinished predictions only" },
                            )
                        }
                    }
                    vm.visibleMatches(data).forEach { MatchCard(vm, nav, it) }
                    if (data.matches.isEmpty()) Muted("No fixtures in the next seven days.")
                    if (vm.missingOnly && vm.remaining(data) == 0) Muted("You’re all set. Every open match has a saved pick.")
                    AppButton("Save predictions", onClick = { scope.launch { vm.save() } }, loading = vm.busy, enabled = vm.canSave(data), fullWidth = true)
                }
                if (vm.notice.isNotEmpty()) Text(vm.notice, color = c.foreground, style = appFont(Tokens.FontSize.md))
            }
        }
    }
}

@Composable
private fun MatchCard(vm: SlipViewModel, nav: AppNav, m: SlipMatch) {
    val c = palette
    val draft = vm.draft(m)
    val locked = vm.isLocked(m)
    Card(spacing = 12.dp) {
        Muted("${m.league} · ${formatSlipKickoff(m.kickoffDate)}")
        Text(vm.status(m), color = if (locked) c.mutedForeground else c.primary, style = appFont(Tokens.FontSize.md))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
            Text(m.homeTeamName, color = c.foreground, style = appFont(Tokens.FontSize.md, W.Semibold), modifier = Modifier.weight(1f))
            ScoreField(draft.home, !vm.busy && !locked, "${m.homeTeamName} goals against ${m.awayTeamName}") { vm.edit(m, home = it) }
            ScoreField(draft.away, !vm.busy && !locked, "${m.awayTeamName} goals against ${m.homeTeamName}") { vm.edit(m, away = it) }
            Text(m.awayTeamName, color = c.foreground, style = appFont(Tokens.FontSize.md, W.Semibold, align = TextAlign.End), modifier = Modifier.weight(1f))
        }
        vm.errors[m.id]?.let { Text(it, color = c.destructive, style = appFont(Tokens.FontSize.md)) }
        if (locked && vm.drafts[m.id] != null) Muted("Kickoff passed before this edit was saved. Your previous saved pick still applies.")
        AppButton("Form and match details", onClick = { nav.openMatch(m.id.toString()) }, variant = AppButtonVariant.Ghost)
    }
}

@Composable
private fun ScoreField(value: String, enabled: Boolean, label: String, onChange: (String) -> Unit) {
    val c = palette
    val shape = RoundedCornerShape(Tokens.Radius.md)
    BasicTextField(
        value = value, onValueChange = onChange, enabled = enabled, singleLine = true,
        textStyle = appFont(Tokens.FontSize.md, W.Bold, align = TextAlign.Center).copy(color = c.foreground),
        cursorBrush = SolidColor(c.primary),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
        modifier = Modifier.width(52.dp).height(46.dp).alpha(if (enabled) 1f else 0.6f).background(c.cardElevated, shape).border(1.dp, c.input, shape)
            .semantics { contentDescription = label },
        decorationBox = { inner -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { inner() } },
    )
}
