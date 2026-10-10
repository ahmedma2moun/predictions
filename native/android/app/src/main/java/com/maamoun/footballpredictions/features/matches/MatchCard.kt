package com.maamoun.footballpredictions.features.matches

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.LiveDot
import com.maamoun.footballpredictions.core.designsystem.Pill
import com.maamoun.footballpredictions.core.designsystem.PillTone
import com.maamoun.footballpredictions.core.designsystem.RemoteImage
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.MatchListItem
import com.maamoun.footballpredictions.core.networking.dto.MatchStatus
import com.maamoun.footballpredictions.core.networking.dto.Standing
import com.maamoun.footballpredictions.core.networking.dto.Team
import com.maamoun.footballpredictions.core.util.countdownLabel
import com.maamoun.footballpredictions.core.util.formatKickoff
import com.maamoun.footballpredictions.core.util.formatStage
import com.maamoun.footballpredictions.core.util.isKnockoutStage
import com.maamoun.footballpredictions.core.util.isMatchLocked
import kotlinx.coroutines.delay
import java.time.Instant

@Composable
fun MatchCard(app: AppContainer, match: MatchListItem, onClick: () -> Unit) {
    val c = palette
    val poller = remember(match.id, match.status) { LiveScorePoller(app, match) }
    LaunchedEffect(match.id, match.status) { poller.run() }

    val liveScore = poller.displayed
    val locked = isMatchLocked(match.kickoffDate)
    val isFinished = match.status == MatchStatus.FINISHED || liveScore?.status == MatchStatus.FINISHED
    val isLive = match.status == MatchStatus.LIVE && !isFinished
    val showLiveScore = match.status == MatchStatus.LIVE
    val suffix = match.leagueName?.let { " · ${it.uppercase()}" } ?: ""
    val competitionLabel = when {
        isKnockoutStage(match.stage) -> "${formatStage(match.stage!!)}${match.leg?.let { " · Leg $it" } ?: ""}$suffix"
        match.matchday != null -> "Matchday ${match.matchday}$suffix"
        else -> match.leagueName ?: "–"
    }
    val shape = RoundedCornerShape(Tokens.Radius.lg)

    Column(Modifier.fillMaxWidth().clip(shape).background(c.card, shape).border(Hairline, c.border, shape).clickable(onClick = onClick)) {
        // Top strip
        Row(
            Modifier.fillMaxWidth().background(if (isLive) Tokens.Fixed.liveStripTint else Color.Transparent)
                .padding(horizontal = Tokens.Spacing.lg, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
        ) {
            Text(
                competitionLabel.uppercase(), color = c.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = appFont(10.5.sp, W.Bold, letterSpacing = 0.8.sp), modifier = Modifier.weight(1f),
            )
            when {
                isLive -> Pill("LIVE", tone = PillTone.Live, icon = { LiveDot() })
                locked && !isFinished -> Pill("LOCKED", tone = PillTone.Ghost)
                isFinished -> Pill("FT", tone = PillTone.Ghost)
                match.prediction != null -> Pill("PICKED", tone = PillTone.Brand)
            }
        }
        Box(Modifier.fillMaxWidth().size(Hairline).background(c.border))

        // Body
        Row(
            Modifier.fillMaxWidth().padding(start = Tokens.Spacing.lg, end = Tokens.Spacing.lg, top = 14.dp, bottom = 16.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.md),
        ) {
            TeamSide(match.homeTeam, match.homeStanding, end = false, modifier = Modifier.weight(1f))
            ScoreChip(match, liveScore, showLiveScore, isFinished)
            TeamSide(match.awayTeam, match.awayStanding, end = true, modifier = Modifier.weight(1f))
        }

        // Footer
        Row(
            Modifier.fillMaxWidth().drawBehind {
                drawLine(c.border, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f)))
            }.padding(start = Tokens.Spacing.lg, end = Tokens.Spacing.lg, top = 12.dp, bottom = 14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(formatKickoff(match.kickoffDate), color = c.mutedForeground, style = appFont(11.5.sp))
            FooterRight(match, locked)
        }
    }
}

@Composable
private fun ScoreChip(match: MatchListItem, liveScore: LiveScore?, showLiveScore: Boolean, isFinished: Boolean) {
    val c = palette
    val shape = RoundedCornerShape(Tokens.Radius.md)
    val scoreText = if (liveScore?.homeScore != null && liveScore.awayScore != null) "${liveScore.homeScore}–${liveScore.awayScore}" else "–"
    val fill = when { showLiveScore -> c.cardElevated; match.prediction != null -> c.primarySoft; else -> Color.Transparent }
    val borderColor = if (showLiveScore) c.live else c.primarySoftBorder
    val mod = Modifier.widthIn(min = 70.dp).clip(shape).background(fill, shape).let {
        if (showLiveScore || match.prediction != null) it.border(1.dp, borderColor, shape) else it
    }.padding(horizontal = 14.dp, vertical = 4.dp)
    Column(mod, horizontalAlignment = Alignment.CenterHorizontally) {
        when {
            showLiveScore -> {
                Text(if (isFinished) "FULL TIME" else "LIVE SCORE", color = c.live, style = appFont(9.sp, W.Bold, letterSpacing = 0.5.sp))
                AnimatedContent(scoreText, label = "score") { text ->
                    Text(text, color = c.live, style = appFont(20.sp, W.Bold, mono = true))
                }
            }
            match.prediction != null ->
                Text("${match.prediction.homeScore}–${match.prediction.awayScore}", color = c.primary, style = appFont(19.sp, W.Bold, mono = true))
            else -> Text("VS", color = c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Semibold, letterSpacing = 1.sp))
        }
    }
}

@Composable
private fun TeamSide(team: Team, standing: Standing?, end: Boolean, modifier: Modifier) {
    val c = palette
    Column(modifier, horizontalAlignment = if (end) Alignment.End else Alignment.Start, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        RemoteImage(team.logo, 36.dp, contentDescription = team.name)
        Text(
            team.name, color = c.foreground, maxLines = 2, overflow = TextOverflow.Ellipsis,
            style = appFont(Tokens.FontSize.sm, W.Semibold, align = if (end) TextAlign.End else TextAlign.Start),
        )
        if (standing != null) Text("#${standing.position} · ${standing.points}", color = c.mutedForeground, style = appFont(10.5.sp, mono = true))
    }
}

@Composable
private fun FooterRight(match: MatchListItem, locked: Boolean) {
    val c = palette
    when {
        match.status == MatchStatus.LIVE -> match.prediction?.let {
            Text(
                androidx.compose.ui.text.buildAnnotatedString {
                    append("Your pick: ")
                    pushStyle(androidx.compose.ui.text.SpanStyle(color = c.foreground, fontFamily = com.maamoun.footballpredictions.core.designsystem.MonoFamily))
                    append("${it.homeScore}–${it.awayScore}")
                    pop()
                },
                color = c.mutedForeground, style = appFont(Tokens.FontSize.xs),
            )
        }
        locked && match.status != MatchStatus.FINISHED ->
            Text(
                if (match.prediction != null) "Prediction submitted" else "No prediction submitted",
                color = c.mutedForeground, style = appFont(Tokens.FontSize.xs).copy(fontStyle = FontStyle.Italic),
            )
        else -> CountdownText(match.kickoffDate)
    }
}

/** "2h 5m to predict" — refreshed every 30 s and cleared at kickoff. */
@Composable
private fun CountdownText(kickoff: Instant) {
    val c = palette
    var label by remember(kickoff) { mutableStateOf(countdownLabel(kickoff)) }
    LaunchedEffect(kickoff) {
        label = countdownLabel(kickoff)
        while (label != null) {
            delay(30_000)
            label = countdownLabel(kickoff)
        }
    }
    label?.let {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(AppIcon.clock, null, tint = c.warning, modifier = Modifier.size(11.dp))
            Text(it, color = c.warning, style = appFont(Tokens.FontSize.xs, W.Semibold, mono = true))
        }
    }
}
