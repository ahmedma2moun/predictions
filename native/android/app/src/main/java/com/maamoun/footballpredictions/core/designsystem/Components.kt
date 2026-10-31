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
import androidx.compose.foundation.layout.width
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

// Shared components — names and props mirror the iOS Components.swift.

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

// ── Toast ────────────────────────────────────────────────────────────────────
/** Transient confirmation chip; the host screen positions it and controls its lifetime. */
@Composable
fun Toast(text: String, modifier: Modifier = Modifier) {
    val c = palette
    val shape = RoundedCornerShape(Tokens.Radius.pill)
    Row(
        modifier = modifier.clip(shape).background(c.cardElevated, shape).border(1.dp, c.border, shape)
            .padding(horizontal = Tokens.Spacing.lg, vertical = Tokens.Spacing.sm)
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(AppIcon.checkmark, null, tint = c.primary, modifier = Modifier.size(14.dp))
        Text(text, color = c.foreground, style = appFont(Tokens.FontSize.sm, W.Semibold), maxLines = 1)
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

// ── Haptics ──────────────────────────────────────────────────────────────────
/** Event haptics shared by screens (the iOS equivalents are `.sensoryFeedback` modifiers). */
object AppHaptics {
    /** A goal changed a live score: the strongest standard tick. */
    fun goal(view: android.view.View) {
        view.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
    }

    /** An unpredicted match is within 5 minutes of locking. */
    fun deadlineWarning(view: android.view.View) {
        val constant = if (android.os.Build.VERSION.SDK_INT >= 30) android.view.HapticFeedbackConstants.REJECT
        else android.view.HapticFeedbackConstants.LONG_PRESS
        view.performHapticFeedback(constant)
    }
}

// ── Misc ─────────────────────────────────────────────────────────────────────
@Composable
fun CenteredSpinner(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().background(palette.background), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = palette.primary)
    }
}

// ── Skeleton loading ─────────────────────────────────────────────────────────
/** A placeholder block with a moving highlight (the animator-duration scale freezes it when animations are off). */
@Composable
fun SkeletonBox(modifier: Modifier = Modifier, width: Dp? = null, height: Dp, radius: Dp = Tokens.Radius.sm) {
    val c = palette
    val shift by androidx.compose.animation.core.rememberInfiniteTransition(label = "skeleton").animateFloat(
        initialValue = -0.6f, targetValue = 1f,
        animationSpec = androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(1300, easing = androidx.compose.animation.core.LinearEasing)),
        label = "skeleton-shift",
    )
    val shape = RoundedCornerShape(radius)
    androidx.compose.foundation.layout.Box(
        (if (width != null) modifier.width(width) else modifier.fillMaxWidth()).height(height).clip(shape).background(c.cardElevated)
            .drawWithContent {
                drawContent()
                val w = size.width
                val start = shift * w
                drawRect(
                    brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
                        colors = listOf(Color.Transparent, c.foreground.copy(alpha = 0.10f), Color.Transparent),
                        startX = start, endX = start + w * 0.6f,
                    ),
                )
            },
    )
}

enum class SkeletonKind { Matches, Rows, Cards }

/** Screen-level loading placeholder shaped like the content it stands in for (replaces `CenteredSpinner` on list screens). */
@Composable
fun LoadingSkeleton(kind: SkeletonKind) {
    val c = palette
    Column(
        Modifier.fillMaxSize().background(c.background).padding(Tokens.Spacing.lg)
            .semantics(mergeDescendants = true) { contentDescription = "Loading" },
        verticalArrangement = Arrangement.spacedBy(Tokens.Spacing.md),
    ) {
        when (kind) {
            SkeletonKind.Matches -> {
                SkeletonBox(width = 90.dp, height = 12.dp)
                repeat(3) {
                    Card(spacing = Tokens.Spacing.md) {
                        SkeletonBox(width = 150.dp, height = 10.dp)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { SkeletonBox(width = 36.dp, height = 36.dp, radius = Tokens.Radius.pill); SkeletonBox(width = 70.dp, height = 12.dp) }
                            SkeletonBox(width = 56.dp, height = 24.dp, radius = Tokens.Radius.md)
                            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) { SkeletonBox(width = 36.dp, height = 36.dp, radius = Tokens.Radius.pill); SkeletonBox(width = 70.dp, height = 12.dp) }
                        }
                        SkeletonBox(width = 110.dp, height = 10.dp)
                    }
                }
            }
            SkeletonKind.Rows -> Card(spacing = Tokens.Spacing.md) {
                repeat(7) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Tokens.Spacing.md), verticalAlignment = Alignment.CenterVertically) {
                        SkeletonBox(width = 20.dp, height = 14.dp)
                        SkeletonBox(width = 34.dp, height = 34.dp, radius = Tokens.Radius.pill)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) { SkeletonBox(width = 110.dp, height = 12.dp); SkeletonBox(width = 150.dp, height = 10.dp) }
                        SkeletonBox(width = 44.dp, height = 22.dp, radius = Tokens.Radius.pill)
                    }
                }
            }
            SkeletonKind.Cards -> repeat(3) {
                Card(spacing = Tokens.Spacing.md) {
                    SkeletonBox(width = 140.dp, height = 16.dp)
                    SkeletonBox(height = 12.dp)
                    SkeletonBox(width = 220.dp, height = 12.dp)
                }
            }
        }
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

/** "📍 Emirates Stadium" — the match venue, shown on the match card and match detail. */
@Composable
fun VenueLabel(venue: String, modifier: Modifier = Modifier) {
    val c = palette
    Row(
        modifier.clearAndSetSemantics { contentDescription = "Venue: $venue" },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(AppIcon.pin, null, tint = c.mutedForeground, modifier = Modifier.size(10.dp))
        Text(venue, color = c.mutedForeground, maxLines = 1, overflow = TextOverflow.Ellipsis, style = appFont(10.5.sp))
    }
}
