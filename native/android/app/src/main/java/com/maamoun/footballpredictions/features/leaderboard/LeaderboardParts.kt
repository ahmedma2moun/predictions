package com.maamoun.footballpredictions.features.leaderboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Avatar
import com.maamoun.footballpredictions.core.designsystem.Card
import com.maamoun.footballpredictions.core.designsystem.Divider
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.IconButton
import com.maamoun.footballpredictions.core.designsystem.MonoFamily
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.medalColors
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.LeaderboardEntry
import com.maamoun.footballpredictions.core.networking.dto.LeaderboardUserPrediction
import com.maamoun.footballpredictions.core.util.formatKickoff
import com.maamoun.footballpredictions.features.matchdetail.ScoringBreakdown

private val medals = listOf("🥇", "🥈", "🥉")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LeaderboardFilters(vm: LeaderboardViewModel) {
    val c = palette
    val haptic = LocalHapticFeedback.current
    Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
        if (vm.groups.size > 1) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
                vm.groups.forEach { g ->
                    val active = g.id == vm.groupId
                    Text(
                        g.name, color = if (active) c.primaryForeground else c.mutedForeground,
                        style = appFont(Tokens.FontSize.sm, if (active) W.Semibold else W.Medium),
                        modifier = Modifier.clip(CircleShape).background(if (active) c.primary else c.card, CircleShape)
                            .border(1.dp, if (active) c.primary else c.border, CircleShape)
                            .clickable { vm.groupId = g.id }.padding(horizontal = Tokens.Spacing.md, vertical = 6.dp),
                    )
                }
            }
        }
        if (vm.leagues.isNotEmpty()) LeagueSelect(vm)

        // Period segmented control
        val shell = RoundedCornerShape(Tokens.Radius.md)
        Row(Modifier.fillMaxWidth().background(c.cardElevated, shell).border(Hairline, c.border, shell).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Period.entries.forEach { p ->
                val active = vm.period == p
                Box(
                    Modifier.weight(1f).clip(RoundedCornerShape(Tokens.Radius.sm)).background(if (active) c.primary else Color.Transparent, RoundedCornerShape(Tokens.Radius.sm))
                        .clickable(role = Role.Tab) { haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove); vm.period = p }.padding(vertical = Tokens.Spacing.sm),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(p.label, color = if (active) c.primaryForeground else c.mutedForeground, style = appFont(Tokens.FontSize.sm, if (active) W.Semibold else W.Medium))
                }
            }
        }
        if (vm.period == Period.Week) OffsetNav(vm.weekLabel, { vm.weekOffset-- }, { vm.weekOffset++ })
        if (vm.period == Period.Month) OffsetNav(vm.monthLabel, { vm.monthOffset-- }, { vm.monthOffset++ })
    }
}

@Composable
private fun OffsetNav(label: String, prev: () -> Unit, next: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        IconButton(AppIcon.chevronLeft, "Previous", prev, diameter = 32.dp, iconSize = 16.dp)
        Text(label, color = palette.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold))
        IconButton(AppIcon.chevronRight, "Next", next, diameter = 32.dp, iconSize = 16.dp)
    }
}

@Composable
private fun LeagueSelect(vm: LeaderboardViewModel) {
    val c = palette
    val label = when (vm.selectedLeagues.size) {
        0 -> "All Tournaments"
        1 -> vm.leagues.firstOrNull { it.externalId.toString() == vm.selectedLeagues[0] }?.name ?: "1 selected"
        else -> "${vm.selectedLeagues.size} tournaments"
    }
    val shape = RoundedCornerShape(Tokens.Radius.md)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            Modifier.fillMaxWidth().clip(shape).background(c.card, shape).border(1.dp, if (vm.leagueDropdownOpen) c.primary else c.border, shape)
                .clickable { vm.leagueDropdownOpen = !vm.leagueDropdownOpen }.padding(horizontal = Tokens.Spacing.md, vertical = 10.dp)
                .semantics { contentDescription = "Tournaments: $label" },
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
        ) {
            Text(label, color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.sm), modifier = Modifier.weight(1f))
            Icon(if (vm.leagueDropdownOpen) AppIcon.chevronUp else AppIcon.chevronDown, null, tint = c.mutedForeground, modifier = Modifier.size(16.dp))
        }
        if (vm.leagueDropdownOpen) {
            Card(padding = 0.dp) {
                CheckboxRow("All Tournaments", vm.selectedLeagues.isEmpty(), bold = vm.selectedLeagues.isEmpty()) { vm.selectedLeagues = emptyList() }
                Divider()
                vm.leagues.forEach { league ->
                    val value = league.externalId.toString()
                    val checked = value in vm.selectedLeagues
                    CheckboxRow(league.name, checked, bold = false) {
                        vm.selectedLeagues = if (checked) vm.selectedLeagues - value else vm.selectedLeagues + value
                    }
                }
            }
        }
    }
}

@Composable
private fun CheckboxRow(label: String, checked: Boolean, bold: Boolean, onClick: () -> Unit) {
    val c = palette
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Checkbox, onClick = onClick).padding(horizontal = Tokens.Spacing.md, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
    ) {
        Box(
            Modifier.size(16.dp).background(if (checked) c.primary else Color.Transparent, RoundedCornerShape(4.dp)).border(1.dp, if (checked) c.primary else c.border, RoundedCornerShape(4.dp)),
            contentAlignment = Alignment.Center,
        ) { if (checked) Icon(AppIcon.checkmark, null, tint = c.primaryForeground, modifier = Modifier.size(12.dp)) }
        Text(label, color = c.foreground, style = appFont(Tokens.FontSize.sm, if (bold) W.Semibold else W.Regular))
    }
}

@Composable
fun LeaderboardRow(
    item: LeaderboardEntry, index: Int, myId: String?, isCurrentPeriod: Boolean, isExpanded: Boolean, expandedLoading: Boolean,
    expandedData: List<LeaderboardUserPrediction>?, showMedal: Boolean, championTeamName: String?, onToggle: () -> Unit,
) {
    val c = palette
    val isMe = myId == item.userId
    val shape = RoundedCornerShape(Tokens.Radius.md)
    Column(Modifier.fillMaxWidth().clip(shape).background(if (isMe) c.primarySoft else c.card, shape).border(Hairline, if (isMe) c.primarySoftBorder else c.border, shape)) {
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(vertical = 11.dp, horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
        ) {
            Box(Modifier.width(26.dp), contentAlignment = Alignment.Center) {
                if (showMedal && index < 3) Text(medals[index], fontSize = 16.sp)
                else Text("${index + 1}", color = if (isMe) c.primary else c.mutedForeground, style = appFont(Tokens.FontSize.sm, W.Bold, mono = true))
            }
            Avatar(item.name, item.avatarUrl, size = 32.dp)
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(item.name, color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.sm, W.Semibold), modifier = Modifier.weight(1f, fill = false))
                if (isMe) Text("· YOU", color = c.primary, style = appFont(Tokens.FontSize.xxs, W.Bold, letterSpacing = 0.5.sp))
                BadgeStrip(item.badges, item.isGroupChampion, item.exactScoreCount, item.longestStreak, isCurrentPeriod)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("${item.totalPoints}", color = if (isMe) c.primary else c.foreground, style = appFont(14.sp, W.Bold, mono = true))
                if (item.championBonusPoints > 0) {
                    Text("👑+${item.championBonusPoints}", color = c.warning, style = appFont(10.sp, W.Bold, mono = true),
                        modifier = Modifier.background(Tokens.Fixed.championChip, CircleShape).padding(horizontal = 6.dp, vertical = 2.dp))
                }
            }
            Icon(if (isExpanded) AppIcon.chevronUp else AppIcon.chevronDown, null, tint = c.mutedForeground, modifier = Modifier.size(14.dp))
        }
        if (isExpanded) {
            Divider()
            Column(Modifier.padding(Tokens.Spacing.md), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
                if (item.championBonusPoints > 0) {
                    Row(
                        Modifier.fillMaxWidth().background(Tokens.Fixed.championTint, RoundedCornerShape(Tokens.Radius.sm)).padding(horizontal = Tokens.Spacing.sm, vertical = Tokens.Spacing.xs + 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("👑 Champion Bonus${championTeamName?.let { " ($it)" } ?: ""}", color = c.foreground, style = appFont(Tokens.FontSize.xs, W.Semibold), modifier = Modifier.weight(1f))
                        Text("+${item.championBonusPoints}", color = c.warning, style = appFont(Tokens.FontSize.xs, W.Bold, mono = true))
                    }
                }
                when {
                    expandedLoading -> Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(24.dp), color = c.primary, strokeWidth = 2.dp) }
                    !expandedData.isNullOrEmpty() -> expandedData.forEach { UserPredRow(it) }
                    else -> Muted("No scored predictions in this period.", size = Tokens.FontSize.xs, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
private fun UserPredRow(p: LeaderboardUserPrediction) {
    val c = palette
    Column(
        Modifier.fillMaxWidth().background(c.cardElevated, RoundedCornerShape(Tokens.Radius.sm)).padding(horizontal = Tokens.Spacing.sm, vertical = Tokens.Spacing.xs + 2.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
            Text(
                buildAnnotatedString {
                    append(p.homeTeamName)
                    pushStyle(SpanStyle(color = c.mutedForeground, fontWeight = FontWeight.Normal)); append(" vs "); pop()
                    append(p.awayTeamName)
                },
                color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.xs, W.Semibold), modifier = Modifier.weight(1f),
            )
            Text("+${p.pointsAwarded} pts", color = if (p.pointsAwarded > 0) c.warning else c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Semibold))
            p.scoringBreakdown?.takeIf { it.isNotEmpty() }?.let { ScoringBreakdown(it, p.oddsBonus) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
            Muted(formatKickoff(p.kickoffDate), size = Tokens.FontSize.xs)
            Text(buildAnnotatedString {
                append("Pick: "); pushStyle(SpanStyle(color = c.foreground, fontFamily = MonoFamily)); append("${p.homeScore}–${p.awayScore}"); pop()
            }, color = c.mutedForeground, style = appFont(Tokens.FontSize.xs))
            Text(buildAnnotatedString {
                append("Result: "); pushStyle(SpanStyle(color = c.foreground, fontFamily = MonoFamily)); append("${p.result.homeScore}–${p.result.awayScore}"); pop()
            }, color = c.mutedForeground, style = appFont(Tokens.FontSize.xs))
        }
    }
}

@Composable
private fun BadgeStrip(badges: List<String>, isGroupChampion: Boolean, exactScoreCount: Int, longestStreak: Int, isCurrentPeriod: Boolean) {
    val c = palette
    var open by remember { mutableStateOf(false) }
    val hasExact = "first_exact_score" in badges
    val hasRoll = "on_a_roll" in badges
    val showPopover = isCurrentPeriod && (hasExact || hasRoll)
    if (!isGroupChampion && !showPopover) return
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
        if (isGroupChampion) Icon(AppIcon.trophyFilled, "Group champion", tint = c.gold, modifier = Modifier.size(12.dp))
        if (showPopover) {
            Box(Modifier.size(24.dp).clickable(role = Role.Button) { open = true }.semantics { contentDescription = "View badges" }, contentAlignment = Alignment.Center) {
                Icon(AppIcon.medal, null, tint = c.mutedForeground, modifier = Modifier.size(14.dp))
            }
        }
    }
    if (open) {
        AlertDialog(
            onDismissRequest = { open = false }, containerColor = c.card,
            title = { Text("Badges", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (hasExact) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("🎯 Exact Score", color = c.foreground, style = appFont(Tokens.FontSize.xs))
                        Text("×$exactScoreCount", color = c.mutedForeground, style = appFont(Tokens.FontSize.xs, mono = true))
                    }
                    if (hasRoll) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("🔥 On a Roll", color = c.foreground, style = appFont(Tokens.FontSize.xs))
                        Text("longest: $longestStreak", color = c.mutedForeground, style = appFont(Tokens.FontSize.xs))
                    }
                }
            },
            confirmButton = { TextButton(onClick = { open = false }) { Text("OK", color = c.primary) } },
        )
    }
}

@Composable
fun Podium(entries: List<LeaderboardEntry>, highlightMe: String? = null, scoreSize: androidx.compose.ui.unit.TextUnit = 16.sp) {
    if (entries.size < 3) return
    val c = palette
    val order = listOf(entries[1], entries[0], entries[2])
    val ranks = listOf(2, 1, 3)
    Row(Modifier.fillMaxWidth().padding(horizontal = Tokens.Spacing.sm).padding(bottom = Tokens.Spacing.md), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        order.forEachIndexed { i, entry ->
            val rank = ranks[i]
            val medal = medalColors(rank)
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Avatar(entry.name, entry.avatarUrl, size = if (rank == 1) 48.dp else 40.dp)
                Text(entry.name.split(" ").first(), color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(11.5.sp, W.Semibold, align = TextAlign.Center))
                Text("${entry.totalPoints}", color = if (highlightMe == entry.userId) c.primary else c.foreground, style = appFont(scoreSize, W.Bold, mono = true))
                val tower = RoundedCornerShape(topStart = Tokens.Radius.md, topEnd = Tokens.Radius.md)
                Box(Modifier.fillMaxWidth().height(medal.height).background(medal.fill, tower).border(1.dp, medal.border, tower), contentAlignment = Alignment.Center) {
                    Text("$rank", color = medal.color, style = appFont(20.sp, W.Heavy))
                }
            }
        }
    }
}
