package com.maamoun.footballpredictions.core.designsystem

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

// Shared components — names and props mirror mobile/src/components/ui.tsx (and the iOS Components.swift).

// ── Card ─────────────────────────────────────────────────────────────────────
@Composable
fun Card(
    modifier: Modifier = Modifier,
    padding: Dp = Tokens.Spacing.lg,
    spacing: Dp = 0.dp,
    content: @Composable () -> Unit,
) {
    val c = palette
    val shape = RoundedCornerShape(Tokens.Radius.lg)
    Column(
        modifier = modifier.fillMaxWidth().clip(shape).background(c.card, shape).border(Hairline, c.border, shape).padding(padding),
        verticalArrangement = Arrangement.spacedBy(spacing),
    ) { content() }
}

// ── Typography ───────────────────────────────────────────────────────────────
@Composable
fun Muted(text: String, modifier: Modifier = Modifier, size: TextUnit = Tokens.FontSize.sm, align: TextAlign = TextAlign.Unspecified, maxLines: Int = Int.MAX_VALUE) =
    Text(text, modifier, color = palette.mutedForeground, style = appFont(size, align = align), maxLines = maxLines, overflow = TextOverflow.Ellipsis)

@Composable
fun Heading(text: String, modifier: Modifier = Modifier) =
    Text(text, modifier, color = palette.foreground, style = appFont(Tokens.FontSize.xl, W.Bold))

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) =
    Text(text, modifier, color = palette.foreground, style = appFont(Tokens.FontSize.sm, W.Bold))

// ── Button ───────────────────────────────────────────────────────────────────
enum class AppButtonVariant { Primary, Outline, Ghost, Destructive }

@Composable
fun AppButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: AppButtonVariant = AppButtonVariant.Primary,
    loading: Boolean = false,
    enabled: Boolean = true,
    fullWidth: Boolean = false,
) {
    val c = palette
    val (bg, fg, border) = when (variant) {
        AppButtonVariant.Primary -> Triple(c.primary, c.primaryForeground, c.primary)
        AppButtonVariant.Outline -> Triple(Color.Transparent, c.foreground, c.border)
        AppButtonVariant.Ghost -> Triple(Color.Transparent, c.foreground, Color.Transparent)
        AppButtonVariant.Destructive -> Triple(c.destructive, Color.White, c.destructive)
    }
    val shape = RoundedCornerShape(Tokens.Radius.md)
    val active = enabled && !loading
    Box(
        modifier = modifier
            .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
            .heightIn(min = 44.dp)
            .alpha(if (active) 1f else 0.5f)
            .clip(shape)
            .background(bg, shape)
            .border(1.dp, border, shape)
            .clickable(enabled = active, role = Role.Button, onClick = onClick)
            .padding(horizontal = Tokens.Spacing.lg, vertical = Tokens.Spacing.md),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(color = fg, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
        } else {
            Text(title, color = fg, style = appFont(Tokens.FontSize.md, W.Semibold, align = TextAlign.Center))
        }
    }
}

// ── Pill ─────────────────────────────────────────────────────────────────────
enum class PillTone { Brand, Live, Amber, Neutral, Ghost }

@Composable
fun Pill(text: String, modifier: Modifier = Modifier, tone: PillTone = PillTone.Neutral, icon: (@Composable () -> Unit)? = null) {
    val c = palette
    val (bg, fg, border) = when (tone) {
        PillTone.Brand -> Triple(c.primarySoft, c.primary, c.primarySoftBorder)
        PillTone.Live -> Triple(c.live.copy(alpha = 0.14f), c.live, c.live.copy(alpha = 0.35f))
        PillTone.Amber -> Triple(c.warning.copy(alpha = 0.14f), c.warning, c.warning.copy(alpha = 0.35f))
        PillTone.Neutral -> Triple(c.cardElevated, c.mutedForeground, c.border)
        PillTone.Ghost -> Triple(Color.Transparent, c.mutedForeground, c.border)
    }
    val shape = RoundedCornerShape(Tokens.Radius.sm)
    Row(
        modifier = modifier.clip(shape).background(bg, shape).border(1.dp, border, shape).padding(horizontal = 8.dp, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.invoke()
        Text(text, color = fg, style = appFont(Tokens.FontSize.xs, W.Bold, letterSpacing = 0.5.sp), maxLines = 1)
    }
}

// ── LiveDot ──────────────────────────────────────────────────────────────────
@Composable
fun LiveDot() {
    val c = palette
    val transition = rememberInfiniteTransition(label = "live")
    val scale by transition.animateFloat(1f, 1.6f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "scale")
    val alpha by transition.animateFloat(0.6f, 0f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "alpha")
    Box(Modifier.size(8.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.size(8.dp).scale(scale).alpha(alpha).background(c.live, CircleShape))
        Box(Modifier.size(5.dp).background(c.live, CircleShape))
    }
}

// ── IconButton ───────────────────────────────────────────────────────────────
@Composable
fun IconButton(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    diameter: Dp = 36.dp,
    iconSize: Dp = 20.dp,
    background: Color = palette.cardElevated,
    tint: Color = palette.foreground,
) {
    Box(
        modifier = modifier.size(diameter).clip(CircleShape).background(background, CircleShape)
            .border(Hairline, palette.border, CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(iconSize)) }
}

// ── Images / avatars ─────────────────────────────────────────────────────────
@Composable
fun RemoteImage(url: String?, size: Dp, modifier: Modifier = Modifier, cornerRadius: Dp = Tokens.Radius.md, contentDescription: String? = null) {
    val c = palette
    if (url != null) {
        AsyncImage(
            model = url,
            contentDescription = contentDescription,
            contentScale = ContentScale.Fit,
            modifier = modifier.size(size),
        )
    } else {
        Box(modifier.size(size).background(c.accent, RoundedCornerShape(cornerRadius)))
    }
}

@Composable
fun Avatar(name: String, url: String?, modifier: Modifier = Modifier, size: Dp = 32.dp) {
    val c = palette
    if (url != null) {
        AsyncImage(model = url, contentDescription = name, contentScale = ContentScale.Crop, modifier = modifier.size(size).clip(CircleShape))
    } else {
        Box(modifier.size(size).background(c.accent, CircleShape), contentAlignment = Alignment.Center) {
            Text(name.take(2).uppercase(), color = c.foreground, style = appFont(Tokens.FontSize.xs, W.Semibold))
        }
    }
}

// ── Misc ─────────────────────────────────────────────────────────────────────
@Composable
fun CenteredSpinner(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().background(palette.background), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = palette.primary)
    }
}

@Composable
fun ErrorCard(message: String, onRetry: (() -> Unit)? = null) {
    Card(spacing = Tokens.Spacing.sm) {
        Muted(message)
        if (onRetry != null) AppButton("Try again", onRetry)
    }
}

/** Medal tower colours shared by the Leaders and Seasons podiums. */
data class MedalColors(val color: Color, val fill: Color, val border: Color, val height: Dp)

fun medalColors(rank: Int): MedalColors = when (rank) {
    1 -> MedalColors(Tokens.Fixed.medalGold, Tokens.Fixed.medalGoldFill, Tokens.Fixed.medalGoldBorder, 86.dp)
    2 -> MedalColors(Tokens.Fixed.medalSilver, Tokens.Fixed.medalSilverFill, Tokens.Fixed.medalSilverBorder, 62.dp)
    else -> MedalColors(Tokens.Fixed.medalBronze, Tokens.Fixed.medalBronzeFill, Tokens.Fixed.medalBronzeBorder, 48.dp)
}

/** Thin top/bottom divider used in cards and headers. */
@Composable
fun Divider(modifier: Modifier = Modifier, color: Color = palette.border) {
    Box(modifier.fillMaxWidth().height(Hairline).background(color))
}
