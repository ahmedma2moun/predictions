package com.maamoun.footballpredictions.features.myscore

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Card
import com.maamoun.footballpredictions.core.designsystem.Divider
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.AccuracyStats
import com.maamoun.footballpredictions.core.networking.dto.ChampionBonusState
import com.maamoun.footballpredictions.core.networking.dto.MatchDetail
import com.maamoun.footballpredictions.core.networking.dto.MatchStatus
import com.maamoun.footballpredictions.core.networking.dto.OtherPrediction
import com.maamoun.footballpredictions.core.networking.dto.PredictionHistoryItem
import com.maamoun.footballpredictions.core.util.formatKickoff
import com.maamoun.footballpredictions.core.util.formatNumber
import com.maamoun.footballpredictions.features.matchdetail.ScoringBreakdown
import kotlinx.coroutines.launch

@Composable
fun AccuracyStatsCard(stats: AccuracyStats, weekPoints: Int, recentPoints: List<Int>) {
    val c = palette
    Card(padding = 0.dp) {
        Column(Modifier.fillMaxWidth().padding(Tokens.Spacing.lg).padding(bottom = Tokens.Spacing.xs)) {
            Text("THIS WEEK", color = c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Bold, letterSpacing = 0.8.sp))
            Row(Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xs), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
                Row(Modifier.weight(1f), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("$weekPoints", color = c.primary, style = appFont(44.sp, W.Bold, mono = true, letterSpacing = (-1).sp).copy(lineHeight = 48.sp))
                    Text("pts", color = c.mutedForeground, style = appFont(Tokens.FontSize.md), modifier = Modifier.padding(bottom = 8.dp))
                }
                if (recentPoints.isNotEmpty()) {
                    Row(Modifier.widthIn(max = 140.dp).weight(1f).height(36.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        recentPoints.takeLast(10).forEach { pts ->
                            val color = when { pts >= 6 -> c.primary; pts > 0 -> c.primary.copy(alpha = 0.33f); else -> c.border }
                            Box(Modifier.weight(1f).height(36.dp).background(color, RoundedCornerShape(2.dp)))
                        }
                    }
                }
            }
        }
        Divider()
        Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min)) {
            StatCell("${formatNumber(stats.correctWinnerPct)}%", "Outcome", c.foreground, Modifier.weight(1f))
            Box(Modifier.width(Hairline).fillMaxHeight().padding(vertical = Tokens.Spacing.sm).background(c.border))
            StatCell("${formatNumber(stats.exactScorePct)}%", "Exact", c.primary, Modifier.weight(1f))
            Box(Modifier.width(Hairline).fillMaxHeight().padding(vertical = Tokens.Spacing.sm).background(c.border))
            StatCell(if (stats.currentStreak > 0) "${stats.currentStreak}" else "—", "Streak", c.warning, Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatCell(value: String, label: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier) {
    Column(modifier.padding(vertical = 14.dp, horizontal = Tokens.Spacing.md), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(value, color = color, style = appFont(Tokens.FontSize.xl, W.Bold, mono = true))
        Text(label, color = palette.mutedForeground, style = appFont(Tokens.FontSize.xs))
    }
}

@Composable
fun PredictionCard(app: AppContainer, pred: PredictionHistoryItem) {
    val c = palette
    val match = pred.match
    val isFinished = match.status == MatchStatus.FINISHED
    val isLocked = match.status != MatchStatus.SCHEDULED
    val isExact = isFinished && match.result != null && pred.homeScore == match.result.homeScore && pred.awayScore == match.result.awayScore
    var open by remember { mutableStateOf(false) }
    var others by remember { mutableStateOf<List<OtherPrediction>?>(null) }
    var loadingOthers by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun toggle() {
        scope.launch {
            if (!open && others == null) {
                val token = app.token
                if (token != null) {
                    loadingOthers = true
                    others = try {
                        app.api.request<MatchDetail>("/api/mobile/matches/${match.id}", token = token).allPredictions ?: emptyList()
                    } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) { emptyList() }
                    loadingOthers = false
                }
            }
            open = !open
        }
    }

    Card(padding = 0.dp, spacing = Tokens.Spacing.xs) {
        Column(Modifier.padding(horizontal = Tokens.Spacing.lg, vertical = Tokens.Spacing.md), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
            Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.md), verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(formatKickoff(match.kickoffDate), color = c.mutedForeground, style = appFont(Tokens.FontSize.xs))
                    Text(
                        buildAnnotatedString {
                            append(match.homeTeam.name)
                            pushStyle(SpanStyle(color = c.mutedForeground, fontWeight = FontWeight.Normal)); append(" vs "); pop()
                            append(match.awayTeam.name)
                        },
                        color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(13.5.sp, W.Semibold),
                    )
                    Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
                        if (isFinished && match.result != null) {
                            ScoreCell("PICK", "${pred.homeScore}–${pred.awayScore}", dim = true)
                            ScoreCell("FINAL", "${match.result.homeScore}–${match.result.awayScore}", dim = false)
                        } else ScoreCell("YOUR PICK", "${pred.homeScore}–${pred.awayScore}", dim = true)
                    }
                }
                if (isFinished) {
                    val pts = pred.pointsAwarded
                    val valueColor = if (isExact) c.primary else if (pts > 0) c.warning else c.mutedForeground
                    val shape = RoundedCornerShape(Tokens.Radius.md)
                    Column(
                        Modifier.width(72.dp).background(if (isExact) c.primarySoft else c.cardElevated, shape)
                            .border(1.dp, if (isExact) c.primarySoftBorder else c.border, shape).padding(vertical = 10.dp, horizontal = Tokens.Spacing.sm),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(if (pts > 0) "+$pts" else "0", color = valueColor, style = appFont(22.sp, W.Bold, mono = true))
                        Text(if (isExact) "EXACT" else "pts", color = valueColor, style = appFont(9.5.sp, W.Bold, letterSpacing = 0.5.sp))
                        pred.scoringBreakdown?.takeIf { it.isNotEmpty() }?.let { ScoringBreakdown(it, pred.oddsBonus) }
                    }
                }
            }
            if (isLocked) {
                Divider(Modifier.padding(top = Tokens.Spacing.xs))
                Row(
                    Modifier.fillMaxWidth().clickable { toggle() }.padding(top = Tokens.Spacing.sm),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (loadingOthers) CircularProgressIndicator(Modifier.size(16.dp), color = c.mutedForeground, strokeWidth = 2.dp)
                    else {
                        Text("${if (open) "Hide" else "Show"} all predictions", color = c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Medium))
                        Icon(if (open) AppIcon.chevronUp else AppIcon.chevronDown, null, tint = c.mutedForeground, modifier = Modifier.size(14.dp))
                    }
                }
            }
            val list = others
            if (open && list != null) {
                if (list.isEmpty()) Muted("No other predictions.", size = Tokens.FontSize.xs, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                else Column(Modifier.padding(top = Tokens.Spacing.xs), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    list.forEach { o ->
                        Row(
                            Modifier.fillMaxWidth().background(c.cardElevated, RoundedCornerShape(Tokens.Radius.sm)).padding(vertical = 6.dp, horizontal = Tokens.Spacing.sm),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
                        ) {
                            Text(o.userName, color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.xs, W.Medium), modifier = Modifier.weight(1f))
                            Text("${o.homeScore}–${o.awayScore}", color = c.foreground, style = appFont(Tokens.FontSize.xs, mono = true))
                            if (isFinished) {
                                Text("+${o.pointsAwarded}", color = if (o.pointsAwarded > 0) c.warning else c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Semibold))
                                o.scoringBreakdown?.takeIf { it.isNotEmpty() }?.let { ScoringBreakdown(it, o.oddsBonus) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScoreCell(label: String, score: String, dim: Boolean) {
    val c = palette
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = c.mutedForeground, style = appFont(10.sp, W.Bold, letterSpacing = 0.6.sp))
        Text(score, color = if (dim) c.mutedForeground else c.foreground, style = appFont(12.5.sp, if (dim) W.Regular else W.Bold, mono = true))
    }
}

@Composable
fun ChampionBonusMyScoreCard(state: ChampionBonusState?, onOpen: () -> Unit) {
    val c = palette
    @Composable fun tile(fill: androidx.compose.ui.graphics.Color, border: androidx.compose.ui.graphics.Color, content: @Composable () -> Unit) {
        val shape = RoundedCornerShape(Tokens.Radius.md)
        Column(Modifier.fillMaxWidth().clip(shape).background(fill, shape).border(1.dp, border, shape).clickable(onClick = onOpen).padding(Tokens.Spacing.md), verticalArrangement = Arrangement.spacedBy(2.dp)) { content() }
    }
    when (state) {
        null, ChampionBonusState.Disabled -> {}
        is ChampionBonusState.Open -> tile(Tokens.Fixed.championTint, c.warning) {
            Text("👑 Champion Bonus", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold))
            Muted(if (state.myPick != null) "You've picked your champion" else "Pick your champion before picks lock", size = Tokens.FontSize.xs)
        }
        is ChampionBonusState.Locked -> {
            val team = state.myPick?.let { state.teams[it.teamId] }
            if (team == null) tile(c.card, c.border) { Muted("👑 Champion Bonus — you didn't pick a champion this round") }
            else {
                val wins = team.awards.count { it.isWin }
                tile(Tokens.Fixed.championTint, c.warning) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("👑 Champion Bonus (${team.name})", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold), modifier = Modifier.weight(1f))
                        Text("+${team.totalPoints} pts", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Bold, mono = true))
                    }
                    Muted("${team.awards.size} game${if (team.awards.size != 1) "s" else ""} played · $wins win${if (wins != 1) "s" else ""} · next win = ${team.nextWinPoints} pts", size = Tokens.FontSize.xs)
                }
            }
        }
    }
}
