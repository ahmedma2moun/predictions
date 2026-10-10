package com.maamoun.footballpredictions.features.matchdetail

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Card
import com.maamoun.footballpredictions.core.designsystem.Divider
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.SectionTitle
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.GroupPredictionEntry
import com.maamoun.footballpredictions.core.networking.dto.LeaderboardGroup
import com.maamoun.footballpredictions.core.networking.dto.LiveGroupStanding
import com.maamoun.footballpredictions.core.networking.dto.LiveMovement
import com.maamoun.footballpredictions.core.networking.dto.LiveStandingEntry
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.net.URLEncoder

private data class GroupComparisonPayload(val predictions: List<GroupPredictionEntry>?, val standing: LiveGroupStanding?)

/** A failed request leaves that part of the card empty — but is logged, not swallowed. */
private suspend fun <T> requestOrNull(what: String, block: suspend () -> T): T? =
    try { block() } catch (e: CancellationException) { throw e } catch (e: Exception) {
        Log.w("GroupComparison", "$what request failed", e)
        null
    }

/** Per-group live standing + this match's predictions, side by side. */
@Composable
fun GroupComparisonCard(
    app: AppContainer, matchId: String, isAdmin: Boolean, locked: Boolean, hasResult: Boolean,
    isKnockout: Boolean, liveScore: ScorePair?,
) {
    val c = palette
    val visible = locked || isAdmin
    var groups by remember { mutableStateOf<List<LeaderboardGroup>>(emptyList()) }
    var selectedGroupId by remember { mutableStateOf<String?>(null) }
    var payload by remember { mutableStateOf<GroupComparisonPayload?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(visible) {
        if (!visible) return@LaunchedEffect
        val token = app.token ?: return@LaunchedEffect
        val raw = requestOrNull("groups") { app.api.request<List<LeaderboardGroup>>("/api/mobile/groups", token = token) } ?: emptyList()
        // Default group first, then by name (this card's own ordering).
        groups = raw.sortedWith(compareBy<LeaderboardGroup> { !it.isDefault }.thenBy { it.name.lowercase() })
        if (selectedGroupId == null) selectedGroupId = groups.firstOrNull()?.id
    }
    LaunchedEffect(selectedGroupId, hasResult, liveScore, visible) {
        val groupId = selectedGroupId ?: return@LaunchedEffect
        val token = app.token ?: return@LaunchedEffect
        if (!visible) return@LaunchedEffect
        loading = true
        val encoded = URLEncoder.encode(groupId, "UTF-8")
        val query = if (!hasResult && liveScore != null) "groupId=$encoded&liveHomeScore=${liveScore.home}&liveAwayScore=${liveScore.away}" else "groupId=$encoded"
        payload = coroutineScope {
            val p = async { requestOrNull("group-predictions") { app.api.request<List<GroupPredictionEntry>>("/api/mobile/matches/$matchId/group-predictions?$query", token = token) } }
            val s = async { requestOrNull("leaderboard/live") { app.api.request<LiveGroupStanding>("/api/mobile/leaderboard/live?groupId=$encoded", token = token) } }
            GroupComparisonPayload(p.await(), s.await())
        }
        loading = false
    }

    if (!visible || groups.isEmpty()) return
    val standing = payload?.standing
    val predicted = payload?.predictions?.filter { it.predicted } ?: emptyList()
    fun entryFor(userId: String) = standing?.standings?.firstOrNull { it.userId == userId }
    val sorted = if (standing == null) predicted else predicted.sortedBy { entryFor(it.userId)?.rank ?: Int.MAX_VALUE }

    Card(spacing = Tokens.Spacing.sm) {
        Column(verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
            SectionTitle("Group Comparison")
            if (groups.size > 1) {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.xs)) {
                    groups.forEach { g ->
                        val selected = selectedGroupId == g.id
                        Text(
                            g.name, color = if (selected) c.primaryForeground else c.mutedForeground,
                            style = appFont(Tokens.FontSize.xs, W.Medium),
                            modifier = Modifier.clip(CircleShape).background(if (selected) c.primary else androidx.compose.ui.graphics.Color.Transparent, CircleShape)
                                .border(1.dp, if (selected) c.primary else c.border, CircleShape)
                                .clickable { selectedGroupId = g.id }.padding(horizontal = Tokens.Spacing.md, vertical = Tokens.Spacing.xs),
                        )
                    }
                }
            }
        }
        if (loading) {
            Row(Modifier.fillMaxWidth().padding(vertical = Tokens.Spacing.sm), horizontalArrangement = Arrangement.Center) {
                CircularProgressIndicator(color = c.primary, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
            }
        } else if (predicted.isEmpty()) {
            Muted("No predictions in this group.", modifier = Modifier.fillMaxWidth().padding(vertical = Tokens.Spacing.md), align = androidx.compose.ui.text.style.TextAlign.Center)
        } else {
            Column {
                sorted.forEachIndexed { i, p ->
                    if (i > 0) Divider()
                    val s = entryFor(p.userId)
                    val points = p.pointsAwarded ?: 0
                    Row(Modifier.fillMaxWidth().padding(vertical = Tokens.Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
                        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (s != null) {
                                Text("#${s.rank}", color = c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Bold, mono = true), modifier = Modifier.width(24.dp))
                                Row(Modifier.width(26.dp), horizontalArrangement = Arrangement.Center) { StandingMovement(s) }
                            }
                            Text(p.userName ?: "Unknown", color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(Tokens.FontSize.sm, W.Medium))
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
                            Text("${p.homeScore ?: ""} – ${p.awayScore ?: ""}", color = c.foreground, style = appFont(Tokens.FontSize.sm, mono = true))
                            if (p.isLive) Text(if (points > 0) "+$points live" else "0 live", color = c.live, style = appFont(Tokens.FontSize.xs, W.Semibold))
                            if (!isKnockout && !p.isLive && hasResult) {
                                Text(if (points > 0) "+$points" else "0", color = if (points > 0) c.warning else c.mutedForeground, style = appFont(Tokens.FontSize.xs, W.Semibold))
                            }
                            if (s != null) Text("${s.liveTotalPoints} pts", color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Bold, mono = true))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StandingMovement(entry: LiveStandingEntry) {
    val c = palette
    when (entry.movement) {
        LiveMovement.UP -> Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(AppIcon.arrowUp, null, tint = c.success, modifier = Modifier.size(12.dp))
            Text("${entry.previousRank - entry.rank}", color = c.success, style = appFont(10.sp, W.Bold, mono = true))
        }
        LiveMovement.DOWN -> Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(AppIcon.arrowDown, null, tint = c.destructive, modifier = Modifier.size(12.dp))
            Text("${entry.rank - entry.previousRank}", color = c.destructive, style = appFont(10.sp, W.Bold, mono = true))
        }
        LiveMovement.SAME -> Icon(AppIcon.remove, null, tint = c.mutedForeground, modifier = Modifier.size(12.dp))
    }
}
