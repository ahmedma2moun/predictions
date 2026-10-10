package com.maamoun.footballpredictions.features.seasons

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppHeader
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Avatar
import com.maamoun.footballpredictions.core.designsystem.CenteredSpinner
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.medalColors
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.LeaderboardEntry
import com.maamoun.footballpredictions.core.networking.dto.Season
import com.maamoun.footballpredictions.core.networking.dto.SeasonWithStandings
import com.maamoun.footballpredictions.core.util.RemoteData
import com.maamoun.footballpredictions.core.util.formatLongDate
import com.maamoun.footballpredictions.core.util.parseIsoInstant
import kotlinx.coroutines.launch

data class SeasonEntry(val userId: String, val name: String, val avatarUrl: String?, val totalPoints: Int)
data class EndedSeason(val season: Season, val overallStandings: List<SeasonEntry>)
data class SeasonsData(val activeSeason: Season?, val activeLeaderboard: List<SeasonEntry>, val endedSeasons: List<EndedSeason>)

class SeasonsViewModel(private val app: AppContainer) : ViewModel() {
    val remote = RemoteData<SeasonsData>()
    val myId: String? get() = app.auth.user?.id

    suspend fun load() = run(false)
    suspend fun refresh() = run(true)

    private suspend fun run(isRefresh: Boolean) = remote.run(isRefresh) { fetch() }

    private suspend fun fetch(): SeasonsData {
        val token = app.token ?: return SeasonsData(null, emptyList(), emptyList())
        val seasons: List<Season> = app.api.request("/api/mobile/seasons", token = token)
        val active = seasons.firstOrNull { it.status == "ACTIVE" }
        val ended = seasons.filter { it.status == "ENDED" }
        val leaderboard: List<LeaderboardEntry> = if (active != null) app.api.request("/api/mobile/leaderboard?period=all", token = token) else emptyList()
        val details = ended.map { app.api.request<SeasonWithStandings>("/api/mobile/seasons/${it.id}", token = token) }
        return SeasonsData(
            active,
            leaderboard.map { SeasonEntry(it.userId, it.name, it.avatarUrl, it.totalPoints) },
            details.map { d ->
                EndedSeason(
                    Season(d.id, d.name, d.description, d.status, d.startDate, d.startedAt, d.endedAt),
                    d.standings.filter { it.groupId == null }.sortedBy { it.rank }.map { SeasonEntry(it.userId, it.userName ?: "Unknown", null, it.totalPoints) },
                )
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SeasonsScreen(app: AppContainer) {
    val vm = appViewModel { SeasonsViewModel(app) }
    val c = palette
    val state by vm.remote.state.collectAsStateCompat()
    val scope = rememberCoroutineScope()
    val data = state.data

    LaunchedEffect(Unit) { vm.load() }

    Column(Modifier.fillMaxSize().background(c.background)) {
        AppHeader(app, "Seasons")
        if (state.isLoading && data == null) {
            CenteredSpinner()
        } else {
            val active = data?.activeSeason
            val ended = data?.endedSeasons ?: emptyList()
            PullToRefreshBox(isRefreshing = state.isRefreshing, onRefresh = { scope.launch { vm.refresh() } }, modifier = Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Tokens.Spacing.lg), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xl)) {
                    if (active != null) {
                        Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
                                Text(active.name, color = c.foreground, style = appFont(Tokens.FontSize.lg, W.Bold))
                                Text("In Progress", color = c.success, style = appFont(Tokens.FontSize.xxs, W.Semibold),
                                    modifier = Modifier.background(Tokens.Fixed.successBadgeFill, CircleShape).border(1.dp, Tokens.Fixed.successBadgeBorder, CircleShape).padding(horizontal = Tokens.Spacing.sm, vertical = 2.dp))
                            }
                            StandingsList(data?.activeLeaderboard ?: emptyList(), vm.myId)
                        }
                    }
                    if (ended.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
                            Text("Past Seasons", color = c.foreground, style = appFont(Tokens.FontSize.lg, W.Bold))
                            ended.forEach { EndedSeasonCard(it, vm.myId) }
                        }
                    }
                    if (active == null && ended.isEmpty()) {
                        Column(Modifier.fillMaxWidth().padding(top = Tokens.Spacing.xxl * 2), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
                            Icon(AppIcon.tabLeaders, null, tint = c.mutedForeground, modifier = Modifier.size(40.dp))
                            Text("No seasons yet", color = c.foreground, style = appFont(Tokens.FontSize.md, W.Semibold))
                            Muted("Check back when a season is started by the admin.", align = TextAlign.Center)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StandingsList(entries: List<SeasonEntry>, myId: String?) {
    if (entries.isEmpty()) {
        Muted("No predictions scored yet.", align = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = Tokens.Spacing.lg))
        return
    }
    val showPodium = entries.size >= 3
    val compact = if (showPodium) entries.drop(3) else entries
    Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
        if (showPodium) SeasonPodium(entries, myId)
        compact.forEachIndexed { idx, e -> SeasonRow(if (showPodium) idx + 4 else idx + 1, e, e.userId == myId) }
    }
}

@Composable
private fun SeasonPodium(entries: List<SeasonEntry>, myId: String?) {
    val c = palette
    val order = listOf(entries[1], entries[0], entries[2])
    val ranks = listOf(2, 1, 3)
    Row(Modifier.fillMaxWidth().padding(horizontal = Tokens.Spacing.sm).padding(bottom = Tokens.Spacing.md), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
        order.forEachIndexed { i, entry ->
            val rank = ranks[i]
            val medal = medalColors(rank)
            Column(Modifier.weight(if (rank == 1) 1.2f else 1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Avatar(entry.name, entry.avatarUrl, size = if (rank == 1) 48.dp else 40.dp)
                Text(entry.name.split(" ").first(), color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.xs, W.Semibold, align = TextAlign.Center))
                Text("${entry.totalPoints}", color = if (entry.userId == myId) c.primary else c.foreground, style = appFont(15.sp, W.Bold, mono = true))
                val tower = RoundedCornerShape(topStart = Tokens.Radius.md, topEnd = Tokens.Radius.md)
                Box(Modifier.fillMaxWidth().height(medal.height).background(medal.fill, tower).border(1.dp, medal.border, tower), contentAlignment = Alignment.Center) {
                    Text("$rank", color = medal.color, style = appFont(20.sp, W.Heavy))
                }
            }
        }
    }
}

@Composable
private fun SeasonRow(rank: Int, entry: SeasonEntry, isMe: Boolean) {
    val c = palette
    val shape = RoundedCornerShape(Tokens.Radius.md)
    Row(
        Modifier.fillMaxWidth().background(if (isMe) c.primarySoft else c.card, shape).border(Hairline, if (isMe) c.primarySoftBorder else c.border, shape).padding(vertical = 11.dp, horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
    ) {
        Box(Modifier.width(26.dp), contentAlignment = Alignment.Center) {
            Text("$rank", color = if (isMe) c.primary else c.mutedForeground, style = appFont(Tokens.FontSize.sm, W.Bold, mono = true))
        }
        Avatar(entry.name, entry.avatarUrl, size = 28.dp)
        Text(entry.name, color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.sm, W.Semibold), modifier = Modifier.weight(1f))
        if (isMe) Text("YOU", color = c.primary, style = appFont(Tokens.FontSize.xxs, W.Bold, letterSpacing = 0.5.sp))
        Text("${entry.totalPoints}", color = if (isMe) c.primary else c.foreground, style = appFont(14.sp, W.Bold, mono = true))
    }
}

@Composable
private fun EndedSeasonCard(item: EndedSeason, myId: String?) {
    val c = palette
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(Tokens.Radius.md)
    val start = parseIsoInstant(item.season.startDate)?.let(::formatLongDate) ?: item.season.startDate
    val range = item.season.endedAt?.let { parseIsoInstant(it) }?.let { "$start → ${formatLongDate(it)}" } ?: start
    Column(Modifier.fillMaxWidth().background(c.card, shape).border(Hairline, c.border, shape).padding(Tokens.Spacing.md), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
        Row(Modifier.fillMaxWidth().clickable { open = !open }, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(item.season.name, color = c.foreground, style = appFont(Tokens.FontSize.md, W.Semibold))
                item.season.description?.takeIf { it.isNotEmpty() }?.let { Muted(it, size = Tokens.FontSize.xs) }
                Muted(range, size = Tokens.FontSize.xxs)
            }
            Icon(if (open) AppIcon.chevronUp else AppIcon.chevronDown, null, tint = c.mutedForeground, modifier = Modifier.size(18.dp))
        }
        if (open) StandingsList(item.overallStandings, myId)
    }
}
