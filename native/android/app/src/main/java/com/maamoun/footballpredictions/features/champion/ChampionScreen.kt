package com.maamoun.footballpredictions.features.champion

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppNav
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.CenteredSpinner
import com.maamoun.footballpredictions.core.designsystem.Divider
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.RemoteImage
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.ChampionBonusAllowedTeam
import com.maamoun.footballpredictions.core.networking.dto.ChampionBonusRevealPick
import com.maamoun.footballpredictions.core.networking.dto.ChampionBonusRevealTeam
import com.maamoun.footballpredictions.core.networking.dto.ChampionBonusState
import com.maamoun.footballpredictions.core.util.formatDeviceDate
import com.maamoun.footballpredictions.core.util.formatKickoff
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChampionScreen(app: AppContainer, nav: AppNav) {
    val vm = appViewModel { ChampionBonusViewModel(app) }
    val c = palette
    val state by vm.remote.state.collectAsStateCompat()
    val haptic = LocalHapticFeedback.current
    val current = state.data

    LaunchedEffect(Unit) { vm.load() }
    LaunchedEffect((current as? ChampionBonusState.Open)?.myPick?.teamId) { if ((current as? ChampionBonusState.Open)?.myPick != null) haptic.performHapticFeedback(HapticFeedbackType.LongPress) }

    Column(Modifier.fillMaxSize().background(c.background)) {
        CenterAlignedTopAppBar(
            title = { Text("Champion", color = c.foreground, style = appFont(Tokens.FontSize.lg, W.Bold)) },
            navigationIcon = {
                Box(Modifier.padding(start = Tokens.Spacing.sm).size(40.dp).clip(CircleShape).clickable(role = Role.Button, onClick = nav::back).semantics { contentDescription = "Back" }, contentAlignment = Alignment.Center) {
                    Icon(AppIcon.chevronLeft, null, tint = c.foreground)
                }
            },
            colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = c.background),
        )
        Divider()
        when {
            state.isLoading && current == null && state.error == null -> CenteredSpinner()
            state.error != null -> EmptyState("⚠️", "Failed to load") { Muted(state.error!!, align = TextAlign.Center) }
            current == null || current is ChampionBonusState.Disabled -> EmptyState("👑", "Champion Bonus isn't running right now") {
                Text(
                    buildAnnotatedString {
                        append("Each season the admin picks one league and a subset of its teams. Pick one as your champion — once locked, every game they play doubles the bonus:\n")
                        pushStyle(SpanStyle(color = c.foreground, fontWeight = W.Semibold)); append("Win 1 = 2 pts · Win 2 = 4 · Win 3 = 8 …"); pop()
                        append("\nDraws and losses still double the next stake — it's a gamble!")
                    },
                    color = c.mutedForeground, style = appFont(Tokens.FontSize.sm, align = TextAlign.Center).copy(lineHeight = 20.sp),
                )
            }
            current is ChampionBonusState.Open -> OpenView(vm, current, state.isRefreshing)
            current is ChampionBonusState.Locked -> LockedView(app, vm, current, state.isRefreshing)
        }
    }
}

@Composable
private fun EmptyState(emoji: String, title: String, content: @Composable () -> Unit) {
    val c = palette
    Column(Modifier.fillMaxSize().padding(horizontal = Tokens.Spacing.xl), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm, Alignment.CenterVertically)) {
        Text(emoji, fontSize = 40.sp)
        Text(title, color = c.foreground, style = appFont(Tokens.FontSize.lg, W.Bold, align = TextAlign.Center))
        content()
    }
}

@Composable
private fun Banner(fill: androidx.compose.ui.graphics.Color, border: androidx.compose.ui.graphics.Color, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(Tokens.Radius.md)
    Column(Modifier.fillMaxWidth().background(fill, shape).border(1.dp, border, shape).padding(Tokens.Spacing.md), verticalArrangement = Arrangement.spacedBy(2.dp)) { content() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OpenView(vm: ChampionBonusViewModel, open: ChampionBonusState.Open, refreshing: Boolean) {
    val c = palette
    val scope = rememberCoroutineScope()
    var confirmTeam by remember { mutableStateOf<ChampionBonusAllowedTeam?>(null) }
    val myTeam = open.myPick?.let { pick -> open.allowedTeams.firstOrNull { it.teamId == pick.teamId } }

    PullToRefreshBox(isRefreshing = refreshing, onRefresh = { scope.launch { vm.refresh() } }, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Tokens.Spacing.lg), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
            Text(open.league.name, color = c.mutedForeground, style = appFont(Tokens.FontSize.sm))
            Banner(Tokens.Fixed.championTint, c.warning) {
                Text("👑 Picks are open — the admin can lock at any time", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold))
                Muted("${open.pickCount} player${if (open.pickCount != 1) "s have" else " has"} picked.${myTeam?.let { " You picked ${it.name}." } ?: ""}", size = Tokens.FontSize.xs)
                vm.pickError?.let { Text(it, color = c.destructive, style = appFont(Tokens.FontSize.xs), modifier = Modifier.padding(top = 6.dp)) }
            }
            open.allowedTeams.chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
                    row.forEach { team ->
                        TeamCard(team, open.myPick?.teamId == team.teamId, vm.picking == team.teamId, Modifier.weight(1f)) {
                            when {
                                open.myPick != null && open.myPick.teamId != team.teamId -> confirmTeam = team
                                open.myPick == null -> scope.launch { vm.pick(team.teamId) }
                            }
                        }
                    }
                    repeat(3 - row.size) { Box(Modifier.weight(1f)) }
                }
            }
        }
    }

    confirmTeam?.let { team ->
        AlertDialog(
            onDismissRequest = { confirmTeam = null }, containerColor = c.card,
            title = { Text("Switch champion?", color = c.foreground) },
            text = { Text("Switch from ${myTeam?.name ?: ""} to ${team.name}? You can change again anytime before picks lock.", color = c.mutedForeground) },
            confirmButton = { TextButton(onClick = { confirmTeam = null; scope.launch { vm.pick(team.teamId) } }) { Text("Switch", color = c.warning) } },
            dismissButton = { TextButton(onClick = { confirmTeam = null }) { Text("Cancel", color = c.foreground) } },
        )
    }
}

@Composable
private fun TeamCard(team: ChampionBonusAllowedTeam, isPicked: Boolean, isPicking: Boolean, modifier: Modifier, onPress: () -> Unit) {
    val c = palette
    val shape = RoundedCornerShape(Tokens.Radius.md)
    Column(
        modifier.alpha(if (isPicking) 0.6f else 1f).clip(shape).background(if (isPicked) Tokens.Fixed.championTint else c.card, shape)
            .border(2.dp, if (isPicked) c.warning else c.border, shape).clickable(enabled = !isPicking, role = Role.Button, onClick = onPress)
            .semantics { contentDescription = team.name; selected = isPicked }.padding(vertical = Tokens.Spacing.md, horizontal = Tokens.Spacing.sm),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs),
    ) {
        Box {
            if (team.logo != null) RemoteImage(team.logo, 48.dp)
            else Box(Modifier.size(48.dp).background(c.cardElevated, CircleShape), contentAlignment = Alignment.Center) {
                Text(team.name.take(2).uppercase(), color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Bold))
            }
            if (isPicked) Box(Modifier.align(Alignment.TopEnd).size(18.dp).background(c.warning, CircleShape), contentAlignment = Alignment.Center) {
                Icon(AppIcon.checkmark, null, tint = c.background, modifier = Modifier.size(11.dp))
            }
        }
        Text(team.name, color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.xs, W.Semibold))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LockedView(app: AppContainer, vm: ChampionBonusViewModel, locked: ChampionBonusState.Locked, refreshing: Boolean) {
    val c = palette
    val scope = rememberCoroutineScope()
    var expandedUserId by remember { mutableStateOf<String?>(null) }
    val myTeam = locked.myPick?.let { locked.teams[it.teamId] }

    PullToRefreshBox(isRefreshing = refreshing, onRefresh = { scope.launch { vm.refresh() } }, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Tokens.Spacing.lg), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
            Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md), modifier = Modifier.padding(bottom = Tokens.Spacing.sm)) {
                Text(locked.league.name, color = c.mutedForeground, style = appFont(Tokens.FontSize.sm))
                Banner(c.cardElevated, c.border) {
                    Text("🔒 Locked ${formatDeviceDate(locked.lockedDate)}", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold))
                    Muted("A postponed match finishing late can renumber later games — the ledger rebuilds in kickoff order.", size = Tokens.FontSize.xs)
                }
                if (myTeam != null) {
                    Banner(Tokens.Fixed.championTint, c.warning) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Your champion: ${myTeam.name}", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold), modifier = Modifier.weight(1f))
                            Text("+${myTeam.totalPoints}", color = c.foreground, style = appFont(18.sp, W.Bold, mono = true))
                        }
                        Muted("${myTeam.awards.size} game${if (myTeam.awards.size != 1) "s" else ""} played · next win = ${myTeam.nextWinPoints} pts", size = Tokens.FontSize.xs)
                    }
                } else {
                    Muted("You didn't pick a champion this round — but you can still browse everyone else's below.", align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                }
            }
            if (locked.picks.isEmpty()) Muted("No one picked a champion this round.", align = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xl))
            locked.picks.forEach { pick ->
                RevealRow(pick, locked.teams[pick.teamId], pick.userId == app.auth.user?.id, expandedUserId == pick.userId) {
                    expandedUserId = if (expandedUserId == pick.userId) null else pick.userId
                }
            }
        }
    }
}

@Composable
private fun RevealRow(pick: ChampionBonusRevealPick, team: ChampionBonusRevealTeam?, isMe: Boolean, isExpanded: Boolean, onToggle: () -> Unit) {
    val c = palette
    val shape = RoundedCornerShape(Tokens.Radius.md)
    Column(Modifier.fillMaxWidth().clip(shape).background(if (isMe) c.primarySoft else c.card, shape).border(Hairline, if (isMe) c.primarySoftBorder else c.border, shape)) {
        Row(Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(vertical = 11.dp, horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
            if (pick.teamLogo != null) RemoteImage(pick.teamLogo, 28.dp)
            else Box(Modifier.size(28.dp).background(c.cardElevated, CircleShape), contentAlignment = Alignment.Center) { Text(pick.teamName.take(2).uppercase(), color = c.foreground, style = appFont(Tokens.FontSize.xxs, W.Bold)) }
            Column(Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(pick.name ?: "User ${pick.userId}", color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.sm, W.Semibold), modifier = Modifier.weight(1f, fill = false))
                    if (isMe) Text("· YOU", color = c.primary, style = appFont(Tokens.FontSize.xxs, W.Bold, letterSpacing = 0.5.sp))
                }
                Muted(pick.teamName, size = Tokens.FontSize.xs, maxLines = 1)
            }
            Text("+${pick.totalBonus}", color = c.foreground, style = appFont(14.sp, W.Bold, mono = true))
            Icon(if (isExpanded) AppIcon.chevronUp else AppIcon.chevronDown, null, tint = c.mutedForeground, modifier = Modifier.size(14.dp))
        }
        if (isExpanded) {
            Divider()
            Column(Modifier.padding(Tokens.Spacing.md), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
                if (team == null || team.awards.isEmpty()) {
                    Muted("No games played yet since lock.", size = Tokens.FontSize.xs, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                } else {
                    team.awards.forEach { a ->
                        Row(
                            Modifier.fillMaxWidth().background(if (a.isWin) Tokens.Fixed.successTint else c.cardElevated, RoundedCornerShape(Tokens.Radius.sm)).padding(horizontal = Tokens.Spacing.sm, vertical = Tokens.Spacing.xs + 2.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
                        ) {
                            Text("Game ${a.gameNumber}", color = c.foreground, style = appFont(Tokens.FontSize.xs, W.Semibold), modifier = Modifier.width(56.dp))
                            Text("${if (a.homeAway == "home") "vs" else "@"} ${a.opponentName}${a.teamScore?.let { " · $it–${a.opponentScore ?: 0}" } ?: ""}", color = c.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.xs), modifier = Modifier.weight(1f))
                            Muted(formatKickoff(a.kickoffDate), size = Tokens.FontSize.xxs)
                            Text("+${a.points}", color = if (a.isWin) c.success else c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Bold, mono = true).copy(textDecoration = if (a.isWin) TextDecoration.None else TextDecoration.LineThrough))
                        }
                    }
                    Muted("Next win = ${team.nextWinPoints} pts", size = Tokens.FontSize.xxs, align = TextAlign.End, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}
