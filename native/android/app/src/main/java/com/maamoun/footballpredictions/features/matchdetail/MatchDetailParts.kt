package com.maamoun.footballpredictions.features.matchdetail

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
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
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.RemoteImage
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.FormResult
import com.maamoun.footballpredictions.core.networking.dto.EventSide
import com.maamoun.footballpredictions.core.networking.dto.MatchEvent
import com.maamoun.footballpredictions.core.networking.dto.MatchEventType
import com.maamoun.footballpredictions.core.networking.dto.Standing
import com.maamoun.footballpredictions.core.networking.dto.TeamFormMatch
import com.maamoun.footballpredictions.core.util.ordinal

/** Team crest, name, league position and the − / + score stepper. */
@Composable
fun TeamColumn(name: String, logo: String?, position: Int?, value: Int, onChange: (Int) -> Unit, disabled: Boolean, modifier: Modifier = Modifier) {
    val c = palette
    val haptic = LocalHapticFeedback.current
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
        RemoteImage(logo, 56.dp, contentDescription = name)
        Text(name, color = c.foreground, maxLines = 2, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.sm, W.Semibold, align = TextAlign.Center))
        if (position != null) Muted(ordinal(position), size = Tokens.FontSize.xs)
        Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
            StepButton(AppIcon.remove, enabled = !disabled && value > 0, label = "Decrease $name score") {
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove); onChange(maxOf(0, value - 1))
            }
            AnimatedContent(value, label = "score") { v ->
                Text(
                    "$v", color = c.foreground, style = appFont(Tokens.FontSize.xxl, W.Bold, align = TextAlign.Center),
                    modifier = Modifier.width(40.dp).semantics { contentDescription = "$name predicted score $v" },
                )
            }
            StepButton(AppIcon.add, enabled = !disabled, label = "Increase $name score") {
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove); onChange(value + 1)
            }
        }
    }
}

@Composable
private fun StepButton(icon: androidx.compose.ui.graphics.vector.ImageVector, enabled: Boolean, label: String, onClick: () -> Unit) {
    val c = palette
    Box(
        Modifier.size(40.dp).alpha(if (enabled) 1f else 0.4f).clip(CircleShape).background(c.cardElevated, CircleShape)
            .border(1.dp, c.border, CircleShape).clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { Icon(icon, null, tint = c.foreground, modifier = Modifier.size(18.dp)) }
}

@Composable
fun TeamFormColumn(teamName: String?, matches: List<TeamFormMatch>, modifier: Modifier = Modifier) {
    val c = palette
    Column(modifier, verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
        Text(teamName ?: "—", color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.xs, W.Medium))
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            matches.forEach { m ->
                val (bg, fg) = when (m.result) {
                    FormResult.W -> c.primary.copy(alpha = 0.15f) to c.primary
                    FormResult.L -> Tokens.Fixed.formLossFill to Tokens.Fixed.formLoss
                    else -> c.cardElevated to c.mutedForeground
                }
                Box(Modifier.size(20.dp).background(bg, RoundedCornerShape(Tokens.Radius.sm)), contentAlignment = Alignment.Center) {
                    Text(m.result?.name ?: "–", color = fg, style = appFont(Tokens.FontSize.xxs, W.Bold))
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
            matches.forEach { m ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        m.opponentLogo?.let { RemoteImage(it, 14.dp, cornerRadius = 2.dp) }
                        Muted("${if (m.isHome) "vs" else "@"} ${m.opponentName}", size = Tokens.FontSize.xs, maxLines = 1)
                    }
                    Text("${m.teamScore ?: "–"}-${m.opponentScore ?: "–"}", color = c.foreground, style = appFont(Tokens.FontSize.xs, W.Semibold))
                }
            }
            if (matches.isEmpty()) Muted("No recent games", size = Tokens.FontSize.xs)
        }
    }
}

// ── Match events ─────────────────────────────────────────────────────────────

data class DisplayMatchEvent(val event: MatchEvent, val icons: List<String>, val ownGoal: Boolean)

private fun singleIcon(e: MatchEvent): Pair<String, Boolean> =
    if (e.type == MatchEventType.GOAL) "⚽" to e.detail.lowercase().contains("own")
    else (if (e.detail.lowercase().contains("red")) "🟥" else "🟨") to false

/**
 * A second-yellow dismissal arrives as two timeline entries (Yellow then Red, same player/minute/team).
 * Collapse that pair into one row showing both icons.
 */
fun mergeMatchEvents(events: List<MatchEvent>): List<DisplayMatchEvent> {
    val sorted = events.sortedBy { it.minute } // stable sort
    val used = mutableSetOf<Int>()
    val result = mutableListOf<DisplayMatchEvent>()
    sorted.forEachIndexed { i, e ->
        if (i in used) return@forEachIndexed
        if (e.type == MatchEventType.CARD && e.detail.lowercase().contains("yellow")) {
            val j = sorted.indices.firstOrNull { idx ->
                idx > i && idx !in used && sorted[idx].type == MatchEventType.CARD &&
                    sorted[idx].detail.lowercase().contains("red") && sorted[idx].player == e.player &&
                    sorted[idx].minute == e.minute && sorted[idx].team == e.team
            }
            if (j != null) {
                used += i; used += j
                result += DisplayMatchEvent(sorted[j], listOf("🟨", "🟥"), false)
                return@forEachIndexed
            }
        }
        used += i
        val (icon, own) = singleIcon(e)
        result += DisplayMatchEvent(e, listOf(icon), own)
    }
    return result
}

@Composable
fun MatchEventRow(item: DisplayMatchEvent) {
    val c = palette
    val isHome = item.event.team == EventSide.HOME
    @Composable fun icon() {
        Row(
            Modifier.heightIn(min = 20.dp).widthIn(min = 20.dp)
                .background(if (item.ownGoal) c.live.copy(alpha = 0.15f) else androidx.compose.ui.graphics.Color.Transparent, CircleShape)
                .padding(horizontal = if (item.icons.size > 1) 4.dp else 0.dp),
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) { item.icons.forEach { Text(it, fontSize = 11.sp) } }
    }
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
        Row(Modifier.weight(1f).alpha(if (isHome) 1f else 0f), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
            Text(item.event.player, color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.sm, align = TextAlign.End), modifier = Modifier.weight(1f, fill = false))
            icon()
        }
        Text("${item.event.minute}'", color = c.mutedForeground, style = appFont(Tokens.FontSize.xs, mono = true, align = TextAlign.Center), modifier = Modifier.width(32.dp))
        Row(Modifier.weight(1f).alpha(if (isHome) 0f else 1f), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            icon()
            Text(item.event.player, color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.sm), modifier = Modifier.weight(1f, fill = false))
        }
    }
}

@Composable
fun StandingsRow(label: String, standing: Standing?) {
    val c = palette
    if (standing == null) return
    val form = (standing.form ?: "").takeLast(5)
    Row(Modifier.fillMaxWidth().padding(vertical = Tokens.Spacing.xs), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
        Text(label, color = c.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.xs), modifier = Modifier.weight(1f))
        Text(ordinal(standing.position), color = c.foreground, style = appFont(Tokens.FontSize.xs, align = TextAlign.Center), modifier = Modifier.widthIn(min = 40.dp))
        Text("${standing.won ?: 0}W ${standing.drawn ?: 0}D ${standing.lost ?: 0}L", color = c.foreground, style = appFont(Tokens.FontSize.xs, align = TextAlign.Center))
        Text("${standing.points} pts", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold))
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            form.forEach { ch ->
                val bg = when (ch) { 'W' -> c.success; 'D' -> c.warning; else -> c.destructive }
                Box(Modifier.size(16.dp).background(bg, RoundedCornerShape(3.dp)), contentAlignment = Alignment.Center) {
                    Text(ch.toString(), color = androidx.compose.ui.graphics.Color.White, style = appFont(9.sp, W.Bold))
                }
            }
        }
    }
}
