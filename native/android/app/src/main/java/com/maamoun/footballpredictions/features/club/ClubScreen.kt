package com.maamoun.footballpredictions.features.club

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.app.AppHeader
import com.maamoun.footballpredictions.app.AppNav
import com.maamoun.footballpredictions.app.appViewModel
import com.maamoun.footballpredictions.app.collectAsStateCompat
import com.maamoun.footballpredictions.core.designsystem.AppButton
import com.maamoun.footballpredictions.core.designsystem.AppButtonVariant
import com.maamoun.footballpredictions.core.designsystem.Card
import com.maamoun.footballpredictions.core.designsystem.CenteredSpinner
import com.maamoun.footballpredictions.core.designsystem.Divider
import com.maamoun.footballpredictions.core.designsystem.ErrorCard
import com.maamoun.footballpredictions.core.designsystem.Heading
import com.maamoun.footballpredictions.core.designsystem.Muted
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.networking.dto.GameHub
import com.maamoun.footballpredictions.core.util.formatCairoDate
import com.maamoun.footballpredictions.core.util.formatNumber
import com.maamoun.footballpredictions.core.util.parseIsoInstant
import kotlinx.coroutines.launch
import java.time.Instant
import kotlin.math.abs

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClubScreen(app: AppContainer, nav: AppNav) {
    val vm = appViewModel { ClubViewModel(app) }
    val c = palette
    val state by vm.remote.state.collectAsStateCompat()
    val scope = rememberCoroutineScope()
    val hub = state.data
    val controlsDisabled = vm.busy || state.isRefreshing

    LaunchedEffect(vm.queryKey) { vm.load() }

    Column(Modifier.fillMaxSize().background(c.background)) {
        AppHeader(app, "The Club", "A fresh crown every week")
        if (state.isLoading && hub == null && state.error == null) {
            CenteredSpinner()
        } else {
            PullToRefreshBox(isRefreshing = state.isRefreshing, onRefresh = { scope.launch { vm.refresh() } }, modifier = Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Tokens.Spacing.lg), verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.lg)) {
                    AppButton("Make your picks →", onClick = nav::openSlip, fullWidth = true)
                    state.error?.let { ErrorCard(it) { scope.launch { vm.refresh() } } }
                    if (vm.notice.isNotEmpty()) Text(vm.notice, color = c.destructive, style = appFont(Tokens.FontSize.md))
                    if (hub != null) Body(app, nav, vm, hub, controlsDisabled)
                }
            }
        }
    }
}

@Composable
private fun ChipRow(items: List<Pair<Int, String>>, selected: Int?, disabled: Boolean, onSelect: (Int) -> Unit) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
        items.forEach { (id, name) ->
            AppButton(name, onClick = { onSelect(id) }, variant = if (selected == id) AppButtonVariant.Primary else AppButtonVariant.Outline, enabled = !disabled)
        }
    }
}

@Composable
private fun Body(app: AppContainer, nav: AppNav, vm: ClubViewModel, hub: GameHub, disabled: Boolean) {
    val c = palette
    val scope = rememberCoroutineScope()
    Muted("Group")
    ChipRow(hub.groups.map { it.id to it.name }, hub.groupId, disabled) { vm.selectGroup(it) }
    Muted("Season")
    ChipRow(hub.seasons.map { it.id to it.name }, hub.seasonId, disabled) { vm.selectSeason(it) }
    if (hub.seasonId == null) Muted("Your club opens when the first season starts.")
    if (hub.groupId == null) Muted("Ask an admin to add you to a group for weekly crowns and activity.")

    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
        ClubSection.entries.forEach { s ->
            AppButton(s.label, onClick = { vm.section = s }, variant = if (vm.section == s) AppButtonVariant.Primary else AppButtonVariant.Outline)
        }
    }

    when (vm.section) {
        ClubSection.Week -> Card(spacing = 14.dp) {
            Heading("The weekly cup")
            Muted("Friday–Thursday, Cairo time. Prediction points only; exact scores break ties. Equal leaders share the crown.")
            val week = vm.selectedWeek(hub)
            if (week == null) Muted("No group competition yet.") else {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
                    hub.weeks.forEach { w ->
                        AppButton(w.key + if (w.winnerIds.isEmpty()) "" else " 🏆", onClick = { vm.weekKey = w.key },
                            variant = if (week.key == w.key) AppButtonVariant.Primary else AppButtonVariant.Outline)
                    }
                }
                Heading(
                    when {
                        week.winnerIds.isNotEmpty() -> "🏆 ${vm.winnerNames(week)}"
                        week.state == "awaiting_results" -> "Waiting for final results"
                        week.state == "complete" -> "No crown this week"
                        else -> "The crown is still up for grabs"
                    },
                )
                Muted("${week.matchCount} matches · ${if (week.state == "complete") "Completed" else "Provisional"}")
                week.standings.forEach { p ->
                    Column {
                        Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.md)) {
                            Text("${p.rank}", color = c.primary, style = appFont(Tokens.FontSize.md), modifier = Modifier.width(24.dp))
                            Column(Modifier.weight(1f)) {
                                Text(p.name + if (p.userId == hub.userId) " (you)" else "", color = c.foreground, style = appFont(Tokens.FontSize.md, W.Semibold))
                                p.title?.let { Text(it, color = c.primary, style = appFont(12.sp)) }
                                Muted("${p.exact} exact scores")
                            }
                            Heading("${p.points}")
                        }
                        Divider()
                    }
                }
                Heading("Previous winners")
                if (hub.weeks.none { it.winnerIds.isNotEmpty() }) Muted("The first crown is waiting to be won.")
                hub.weeks.filter { it.winnerIds.isNotEmpty() }.forEach { w ->
                    AppButton("🏆 ${w.key} · ${vm.winnerNames(w)}", onClick = { vm.weekKey = w.key }, variant = AppButtonVariant.Outline)
                }
            }
        }

        ClubSection.Feed -> {
            Heading("Around the group")
            Muted("Exact scores, prediction-points lead changes, and weekly winners. Picks appear only after scoring.")
            if (hub.feed.isEmpty()) Muted("The story starts with your first scored match.")
            hub.feed.forEach { e ->
                Card(spacing = 12.dp) {
                    Text(e.text, color = c.foreground, style = appFont(16.sp))
                    Muted(formatCairoDate(parseIsoInstant(e.at) ?: Instant.now()))
                    e.matchId?.let { AppButton("View match", onClick = { nav.openMatch(it.toString()) }, variant = AppButtonVariant.Ghost) }
                    Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
                        e.reactions.forEach { r ->
                            AppButton(
                                "${r.emoji} ${if (r.count > 0) r.count.toString() else ""}", onClick = { scope.launch { vm.react(e.key, if (r.mine) null else r.emoji) } },
                                variant = if (r.mine) AppButtonVariant.Primary else AppButtonVariant.Outline, enabled = !disabled,
                                modifier = Modifier.semantics { contentDescription = "React ${r.emoji}, ${r.count} reactions"; selected = r.mine },
                            )
                        }
                    }
                }
            }
        }

        ClubSection.Rival -> Card(spacing = 14.dp) {
            Heading("Make it personal")
            Muted("Choose a friend from this group. Match wins compare scored games you both predicted this season.")
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
                AppButton("No rival", onClick = { scope.launch { vm.setRival(null) } }, variant = AppButtonVariant.Outline, enabled = !disabled)
                hub.players.filter { it.id != hub.userId }.forEach { p ->
                    AppButton(p.name, onClick = { scope.launch { vm.setRival(p.id) } },
                        variant = if (hub.rival?.userId == p.id) AppButtonVariant.Primary else AppButtonVariant.Outline, enabled = !disabled)
                }
            }
            hub.rival?.let { r ->
                Heading(if (r.gap == 0) "All square" else "${abs(r.gap)} points ${if (r.gap > 0) "ahead" else "behind"}")
                Text("You: ${r.myPoints} points · ${formatNumber(r.myAccuracy)}% correct outcomes", color = c.foreground)
                Text("${r.name}: ${r.theirPoints} points · ${formatNumber(r.theirAccuracy)}% correct outcomes", color = c.foreground)
                Muted("${r.wins} wins · ${r.losses} losses · ${r.draws} draws")
            }
        }

        ClubSection.Rewards -> {
            Heading("Earn your reputation")
            Muted("Cosmetic titles, never extra points. Progress uses this season; claimed titles stay yours.")
            hub.equippedTitle?.let { AppButton("Remove title: $it", onClick = { scope.launch { vm.setTitle(null) } }, variant = AppButtonVariant.Outline, enabled = !disabled) }
            hub.challenges.forEach { ch ->
                Card(spacing = 12.dp) {
                    Heading("${if (ch.unlocked) "🏅 " else ""}${ch.name}")
                    Muted(ch.description)
                    LinearProgressIndicator(
                        progress = { (ch.progress.toFloat() / maxOf(ch.target, 1)).coerceIn(0f, 1f) },
                        color = c.primary, trackColor = c.border, modifier = Modifier.fillMaxWidth().height(8.dp)
                            .semantics { contentDescription = "Progress ${ch.progress} of ${ch.target}" },
                    )
                    Muted("${ch.progress}/${ch.target} · Unlock “${ch.title}”")
                    AppButton(
                        if (hub.equippedTitle == ch.title) "Equipped" else if (ch.unlocked) "Equip title" else "Keep playing",
                        onClick = { scope.launch { vm.setTitle(ch.key) } }, enabled = !disabled && ch.unlocked && hub.equippedTitle != ch.title,
                    )
                }
            }
        }

        ClubSection.Recap -> {
            val recap = hub.recap
            if (recap == null) Muted("Your recap appears once a season starts.") else {
                val context = LocalContext.current
                Card(spacing = 16.dp) {
                    Muted("${recap.seasonName} · ${if (recap.final) "Final recap" else "Season so far"}")
                    Heading(recap.name)
                    Text("${recap.totalPoints} pts", color = c.primary, style = appFont(48.sp, W.Bold))
                    Heading(recap.rank?.let { "#$it overall" } ?: "Unranked")
                    Muted("${recap.exactScores} exact scores · ${formatNumber(recap.accuracy)}% correct outcomes")
                    Muted("${recap.weeklyWins} group weekly crowns · best streak: ${recap.longestStreak}")
                    Muted("Biggest weekly improvement: ${recap.biggestComeback} places")
                    recap.bestPrediction?.let { best ->
                        AppButton("Best pick: ${best.label} · ${best.score} · ${best.points} pts", onClick = { nav.openMatch(best.matchId.toString()) }, variant = AppButtonVariant.Outline)
                    }
                    AppButton("Share recap", onClick = {
                        val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, recap.shareText) }
                        context.startActivity(Intent.createChooser(send, null))
                    })
                }
            }
        }
    }
}
