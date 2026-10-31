package com.maamoun.footballpredictions.widget

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.maamoun.footballpredictions.app.MainActivity
import com.maamoun.footballpredictions.core.designsystem.Palette
import com.maamoun.footballpredictions.core.designsystem.Tokens
import java.time.Instant

private val Small = DpSize(110.dp, 110.dp)
private val Wide = DpSize(250.dp, 110.dp)

/** Next match, rank and missing picks. Reads the snapshot the app wrote; the iOS twin is `NextMatchWidget`. */
class NextMatchWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(Small, Wide))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = WidgetBridge.load(context)
        provideContent { GlanceTheme { Content(context, snapshot) } }
    }
}

class NextMatchWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NextMatchWidget()
}

private fun color(pick: (Palette) -> Color) = ColorProvider(day = pick(Tokens.light), night = pick(Tokens.dark))

private fun open(context: Context, extras: Map<String, String>): Action =
    actionStartActivity(Intent(context, MainActivity::class.java).apply { extras.forEach { (k, v) -> putExtra(k, v) } })

@Composable
private fun Content(context: Context, snapshot: WidgetSnapshot) {
    val wide = LocalSize.current.width >= Wide.width
    val now = Instant.now()
    val next = snapshot.next.takeIf { snapshot.signedIn }
    val tap = when {
        next != null -> WidgetLink.match(next.id)
        else -> WidgetLink.matches
    }
    Row(
        GlanceModifier.fillMaxSize().background(color { it.card }).padding(14.dp).clickable(open(context, tap)),
        verticalAlignment = Alignment.Top,
    ) {
        Column(GlanceModifier.defaultWeight()) { MatchColumn(snapshot, next, now) }
        if (wide) {
            Spacer(GlanceModifier.width(10.dp))
            Box(GlanceModifier.width(1.dp).fillMaxSize().background(color { it.border })) {}
            Spacer(GlanceModifier.width(14.dp))
            Column(GlanceModifier.width(110.dp)) { StandingColumn(context, snapshot) }
        }
    }
}

@Composable
private fun label(text: String) = Text(
    text, style = TextStyle(color = color { it.mutedForeground }, fontSize = 9.5.sp, fontWeight = FontWeight.Bold),
)

@Composable
private fun MatchColumn(snapshot: WidgetSnapshot, next: WidgetMatch?, now: Instant) {
    when {
        !snapshot.signedIn -> {
            label("PREDICTIONS")
            Text("Sign in to start predicting", style = TextStyle(color = color { it.foreground }, fontSize = 14.sp, fontWeight = FontWeight.Medium))
        }
        next == null -> {
            label("PREDICTIONS")
            Text("No upcoming matches", style = TextStyle(color = color { it.foreground }, fontSize = 14.sp, fontWeight = FontWeight.Medium))
        }
        else -> {
            val locked = snapshot.isLocked(next, now)
            label(if (locked) "LOCKED" else "NEXT MATCH")
            Spacer(GlanceModifier.height(4.dp))
            Text(next.home, maxLines = 1, style = TextStyle(color = color { it.foreground }, fontSize = 17.sp, fontWeight = FontWeight.Bold))
            Text("v ${next.away}", maxLines = 1, style = TextStyle(color = color { it.mutedForeground }, fontSize = 14.sp, fontWeight = FontWeight.Medium))
            Spacer(GlanceModifier.height(8.dp))
            // Absolute time, not a countdown: a widget only redraws every ~30 min, so "in 2h" would go stale.
            Text(
                if (locked) "Kicked off" else "Locks at kickoff",
                style = TextStyle(color = color { if (locked) it.mutedForeground else it.warning }, fontSize = 12.sp, fontWeight = FontWeight.Medium),
            )
            Text(next.kickoffLabel, maxLines = 1, style = TextStyle(color = color { it.mutedForeground }, fontSize = 10.sp))
            Spacer(GlanceModifier.height(6.dp))
            val picked = next.prediction
            val text = picked?.let { "Picked $it" } ?: if (locked) "No pick" else "Predict now"
            Box(GlanceModifier.cornerRadius(99.dp).background(color { it.primarySoft }).padding(horizontal = 8.dp, vertical = 3.dp)) {
                Text(
                    text,
                    style = TextStyle(
                        color = color { if (picked != null) it.success else if (locked) it.mutedForeground else it.primary },
                        fontSize = 10.5.sp, fontWeight = FontWeight.Bold,
                    ),
                )
            }
        }
    }
}

@Composable
private fun StandingColumn(context: Context, snapshot: WidgetSnapshot) {
    label("YOUR RANK")
    if (snapshot.rank != null) {
        Text("#${snapshot.rank}", style = TextStyle(color = color { it.primary }, fontSize = 30.sp, fontWeight = FontWeight.Bold))
        Text(
            listOfNotNull(snapshot.players?.let { "of $it" }, snapshot.points?.let { "$it pts" }).joinToString(" · "),
            maxLines = 2, style = TextStyle(color = color { it.mutedForeground }, fontSize = 10.sp),
        )
    } else {
        Text("—", style = TextStyle(color = color { it.mutedForeground }, fontSize = 30.sp, fontWeight = FontWeight.Bold))
        Text("Open Leaders to set", style = TextStyle(color = color { it.mutedForeground }, fontSize = 10.sp))
    }
    Spacer(GlanceModifier.height(8.dp))
    if (snapshot.signedIn) {
        val missing = snapshot.missingPicks
        Text(
            if (missing > 0) "$missing need a pick" else "All picks in",
            modifier = GlanceModifier.fillMaxWidth().clickable(open(context, if (missing > 0) WidgetLink.slip else WidgetLink.leaders)),
            style = TextStyle(color = color { if (missing > 0) it.primary else it.success }, fontSize = 10.5.sp, fontWeight = FontWeight.Bold),
        )
    }
}
