package com.maamoun.footballpredictions.features.matchdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppNav
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppButton
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Card
import com.maamoun.footballpredictions.core.designsystem.CenteredSpinner
import com.maamoun.footballpredictions.core.designsystem.Divider
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Pill
import com.maamoun.footballpredictions.core.designsystem.PillTone
import com.maamoun.footballpredictions.core.designsystem.SectionTitle
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.AdjacentMatch
import com.maamoun.footballpredictions.core.networking.dto.MatchDetail
import com.maamoun.footballpredictions.core.networking.dto.MatchStatus
import com.maamoun.footballpredictions.core.util.formatKickoff

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchDetailScreen(app: AppContainer, nav: AppNav, matchId: String) {
    // Keyed by id so every piece of per-match state resets when stepping prev/next.
    val vm = appViewModel(key = "match-$matchId") { MatchDetailViewModel(app, matchId) }
    val c = palette
    val state by vm.remote.state.collectAsStateCompat()
    val match = state.data?.match
    val haptic = LocalHapticFeedback.current

    LaunchedEffect(matchId) { vm.load() }
    LaunchedEffect(match?.id) { if (match != null) vm.pollLive() }
    LaunchedEffect(state.error) { state.error?.let { app.alerts.show("Failed to load match", it) } }
    LaunchedEffect(vm.saveCount) { if (vm.saveCount > 0) haptic.performHapticFeedback(HapticFeedbackType.LongPress) }

    Column(Modifier.fillMaxSize().background(c.background)) {
        CenterAlignedTopAppBar(
            title = { Text(vm.matchdayTitle(match), color = c.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(11.5.sp, W.Bold, letterSpacing = 0.8.sp)) },
            navigationIcon = {
                Box(
                    Modifier.padding(start = Tokens.Spacing.sm).size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClick = nav::back)
                        .semantics { contentDescription = "Back" },
                    contentAlignment = Alignment.Center,
                ) { Icon(AppIcon.chevronLeft, null, tint = c.foreground) }
            },
            colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = c.background),
        )
        Divider()
        when {
            state.isLoading && match == null -> CenteredSpinner()
            match == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Match not found", color = c.foreground) }
            else -> Content(app, nav, vm, match, state.data?.form)
        }
    }
}

@Composable
private fun Content(app: AppContainer, nav: AppNav, vm: MatchDetailViewModel, match: MatchDetail, form: com.maamoun.footballpredictions.core.networking.dto.MatchForm?) {
    val c = palette
    Column(Modifier.fillMaxSize()) {
        if (match.prevMatch != null || match.nextMatch != null) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = Tokens.Spacing.lg, vertical = Tokens.Spacing.sm),
                horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
            ) {
                NavButton(match.prevMatch, prev = true, onClick = nav::replaceMatch, modifier = Modifier.weight(1f))
                NavButton(match.nextMatch, prev = false, onClick = nav::replaceMatch, modifier = Modifier.weight(1f))
            }
            Divider()
        }
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(Tokens.Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md),
        ) {
            HeroCard(vm, match, nav)
            OddsCard(vm, match)
            vm.matchEvents?.takeIf { it.isNotEmpty() }?.let { events ->
                Card(spacing = Tokens.Spacing.xs) {
                    SectionTitle("Match Events")
                    Column { mergeMatchEvents(events).forEach { MatchEventRow(it) } }
                }
            }
            val fh = form?.home ?: emptyList()
            val fa = form?.away ?: emptyList()
            if (fh.isNotEmpty() || fa.isNotEmpty()) {
                Card(spacing = Tokens.Spacing.md) {
                    SectionTitle("Recent Form")
                    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
                        TeamFormColumn(match.homeTeam.name, fh, Modifier.weight(1f))
                        TeamFormColumn(match.awayTeam.name, fa, Modifier.weight(1f))
                    }
                }
            }
            if (!vm.knockout && (match.homeStanding != null || match.awayStanding != null)) {
                Card(spacing = Tokens.Spacing.sm) {
                    SectionTitle("League Standings")
                    StandingsRow(match.homeTeam.name, match.homeStanding)
                    StandingsRow(match.awayTeam.name, match.awayStanding)
                }
            }
            GroupComparisonCard(app, match.id, match.isAdmin, vm.locked, match.result != null, vm.knockout, vm.liveScore)
        }
    }
}

@Composable
private fun HeroCard(vm: MatchDetailViewModel, match: MatchDetail, nav: AppNav) {
    val c = palette
    Card(padding = 0.dp) {
        Row(Modifier.fillMaxWidth().padding(Tokens.Spacing.lg), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(formatKickoff(match.kickoffDate).uppercase(), color = c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Semibold, letterSpacing = 0.8.sp))
            when {
                match.status == MatchStatus.LIVE -> Pill("LIVE", tone = PillTone.Live)
                vm.locked -> Pill("LOCKED", tone = PillTone.Ghost)
                else -> Pill("OPEN", tone = PillTone.Amber, icon = { Icon(AppIcon.clock, null, tint = c.warning, modifier = Modifier.size(10.dp)) })
            }
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = Tokens.Spacing.lg).padding(bottom = Tokens.Spacing.lg),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.md),
        ) {
            TeamColumn(match.homeTeam.name, match.homeTeam.logo, if (vm.knockout) null else match.homeStanding?.position, vm.home, { vm.home = it }, !vm.canPredict, Modifier.weight(1f))
            Text("–", color = c.mutedForeground, style = appFont(Tokens.FontSize.xl, W.Bold, mono = true))
            TeamColumn(match.awayTeam.name, match.awayTeam.logo, if (vm.knockout) null else match.awayStanding?.position, vm.away, { vm.away = it }, !vm.canPredict, Modifier.weight(1f))
        }
        if (vm.canPredict) {
            Text(
                androidx.compose.ui.text.buildAnnotatedString {
                    append("Your call: ")
                    pushStyle(androidx.compose.ui.text.SpanStyle(color = c.foreground, fontWeight = W.Semibold))
                    append(vm.winnerLabel)
                    pop()
                },
                color = c.mutedForeground, style = appFont(Tokens.FontSize.sm, align = TextAlign.Center),
                modifier = Modifier.fillMaxWidth().padding(horizontal = Tokens.Spacing.lg).padding(bottom = Tokens.Spacing.sm),
            )
        }
        vm.liveScore?.let { live ->
            val shape = RoundedCornerShape(Tokens.Radius.md)
            Column(
                Modifier.fillMaxWidth().padding(Tokens.Spacing.lg).padding(top = 0.dp).background(Tokens.Fixed.liveBoxFill, shape)
                    .border(1.dp, Tokens.Fixed.liveBoxBorder, shape).padding(Tokens.Spacing.md),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.size(6.dp).background(Tokens.Fixed.liveDot, CircleShape))
                    Text("LIVE SCORE", color = c.live, style = appFont(10.sp, W.Bold, letterSpacing = 1.sp))
                }
                Text("${live.home} – ${live.away}", color = c.foreground, style = appFont(Tokens.FontSize.xxl, W.Bold, mono = true))
            }
        }
        match.result?.let { result ->
            val shape = RoundedCornerShape(Tokens.Radius.md)
            Column(
                Modifier.fillMaxWidth().padding(Tokens.Spacing.lg).padding(top = 0.dp).background(c.cardElevated, shape)
                    .border(1.dp, c.border, shape).padding(Tokens.Spacing.md),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Muted("Final Result", size = Tokens.FontSize.xs)
                Text("${result.homeScore} – ${result.awayScore}", color = c.foreground, style = appFont(Tokens.FontSize.xxl, W.Bold, mono = true))
                if (result.penaltyHomeScore != null) Muted("Penalties: ${result.penaltyHomeScore} – ${result.penaltyAwayScore ?: ""}", size = Tokens.FontSize.xs)
                if (!match.isAdmin && !vm.knockout && match.prediction != null) {
                    Text("+${match.prediction.pointsAwarded} pts", color = c.warning, style = appFont(Tokens.FontSize.sm, W.Bold), modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        if (vm.canPredict) {
            AppButton(
                if (match.prediction != null) "Update Prediction" else "Save Prediction", onClick = { vm.submit(nav) },
                loading = vm.saving, fullWidth = true, modifier = Modifier.padding(horizontal = Tokens.Spacing.lg).padding(bottom = Tokens.Spacing.lg).height(48.dp),
            )
        } else if (!match.isAdmin && vm.locked && match.result == null) {
            Muted("Predictions are locked for this match", modifier = Modifier.fillMaxWidth().padding(bottom = Tokens.Spacing.lg), align = TextAlign.Center)
        }
    }
}

@Composable
private fun OddsCard(vm: MatchDetailViewModel, match: MatchDetail) {
    val c = palette
    val odds = match.odds ?: return
    if (!(vm.locked || match.isAdmin)) return
    val votes = odds.votes ?: com.maamoun.footballpredictions.core.networking.dto.MatchOddsVotes(0, 0, 0)
    val total = votes.homeWin + votes.draw + votes.awayWin
    val cells = listOf(Triple(match.homeTeam.name, odds.homeWin, votes.homeWin), Triple("Draw", odds.draw, votes.draw), Triple(match.awayTeam.name, odds.awayWin, votes.awayWin))
    Card(spacing = Tokens.Spacing.sm) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            SectionTitle("Prediction Odds")
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (odds.locked) Icon(AppIcon.lock, null, tint = c.mutedForeground, modifier = Modifier.size(11.dp))
                Muted("$total vote${if (total != 1) "s" else ""}", size = Tokens.FontSize.xs)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
            cells.forEach { (label, value, count) ->
                val pct = if (total > 0) Math.round(count.toDouble() / total * 100).toInt() else null
                val shape = RoundedCornerShape(Tokens.Radius.sm)
                Column(
                    Modifier.weight(1f).background(c.cardElevated, shape).border(Hairline, c.border, shape).padding(vertical = Tokens.Spacing.sm, horizontal = Tokens.Spacing.xs),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Muted(label, size = 10.sp, align = TextAlign.Center, maxLines = 1)
                    Text("%.2f".format(value), color = c.foreground, style = appFont(Tokens.FontSize.md, W.Bold, mono = true))
                    Muted("${pct?.let { "$it%" } ?: "—"} · ${count}v", size = 10.sp, align = TextAlign.Center)
                }
            }
        }
    }
}

@Composable
private fun NavButton(match: AdjacentMatch?, prev: Boolean, onClick: (String) -> Unit, modifier: Modifier) {
    val c = palette
    if (match == null) { Box(modifier.height(36.dp)); return }
    val shape = RoundedCornerShape(Tokens.Radius.md)
    Row(
        modifier.height(36.dp).clip(shape).background(c.cardElevated, shape).border(Hairline, c.border, shape)
            .clickable(role = Role.Button) { onClick(match.id) }
            .semantics { contentDescription = "${if (prev) "Previous" else "Next"} match: ${match.homeTeamName} vs ${match.awayTeamName}" }
            .padding(horizontal = Tokens.Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = if (prev) Arrangement.Start else Arrangement.End,
    ) {
        if (prev) Icon(AppIcon.chevronLeft, null, tint = c.mutedForeground, modifier = Modifier.size(16.dp))
        Text("${match.homeTeamName} v ${match.awayTeamName}", color = c.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.xs), modifier = Modifier.weight(1f, fill = false))
        if (!prev) Icon(AppIcon.chevronRight, null, tint = c.mutedForeground, modifier = Modifier.size(16.dp))
    }
}
