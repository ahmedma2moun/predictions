package com.maamoun.footballpredictions.app

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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.LocalIsDark
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import kotlinx.coroutines.launch

/** Tab-screen header: ⚽ mark, title/subtitle, theme toggle and avatar (sign out). */
@Composable
fun AppHeader(app: AppContainer, title: String, subtitle: String? = null) {
    val c = palette
    val dark = LocalIsDark.current
    val auth by app.auth.state.collectAsStateCompat()
    val scope = rememberCoroutineScope()
    var confirmSignOut by remember { mutableStateOf(false) }

    val initials = auth.user?.name?.takeIf { it.isNotEmpty() }
        ?.split(" ")?.mapNotNull { it.firstOrNull() }?.joinToString("")?.take(2)?.uppercase() ?: "??"

    Column(Modifier.fillMaxWidth().background(c.background)) {
        Row(
            Modifier.statusBarsPadding().padding(horizontal = Tokens.Spacing.lg).padding(top = Tokens.Spacing.sm, bottom = Tokens.Spacing.md),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
        ) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm)) {
                    Box(Modifier.size(32.dp).background(c.primary, RoundedCornerShape(Tokens.Radius.sm)), contentAlignment = Alignment.Center) {
                        Text("⚽", fontSize = 16.sp)
                    }
                    Text(
                        title, color = c.foreground, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        style = appFont(26.sp, W.Bold, letterSpacing = (-0.6).sp),
                        modifier = Modifier.semantics { heading() },
                    )
                }
                if (subtitle != null) Text(subtitle, color = c.mutedForeground, style = appFont(Tokens.FontSize.sm))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(34.dp).clip(CircleShape).background(c.cardElevated, CircleShape).border(Hairline, c.border, CircleShape)
                        .clickable(role = Role.Button) { app.theme.toggle(dark) }
                        .semantics { contentDescription = if (dark) "Switch to light mode" else "Switch to dark mode" },
                    contentAlignment = Alignment.Center,
                ) { Icon(if (dark) AppIcon.sun else AppIcon.moon, null, tint = c.foreground, modifier = Modifier.size(17.dp)) }
                Box(
                    Modifier.size(34.dp).clip(CircleShape).background(c.primarySoft, CircleShape).border(1.dp, c.primarySoftBorder, CircleShape)
                        .clickable(role = Role.Button) { confirmSignOut = true }
                        .semantics { contentDescription = "Sign out" },
                    contentAlignment = Alignment.Center,
                ) { Text(initials, color = c.primary, style = appFont(Tokens.FontSize.xs, W.Bold)) }
            }
        }
        Box(Modifier.fillMaxWidth().size(Hairline).background(c.border))
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            containerColor = c.card,
            title = { Text("Sign out of Football Predictions?", color = c.foreground) },
            confirmButton = {
                TextButton(onClick = { confirmSignOut = false; scope.launch { app.auth.signOut() } }) {
                    Text("Sign Out", color = c.destructive)
                }
            },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel", color = c.foreground) } },
        )
    }
}
