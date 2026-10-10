package com.maamoun.footballpredictions.core.designsystem

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.maamoun.footballpredictions.R

/** Hairline border width (`StyleSheet.hairlineWidth`). */
val Hairline = 0.5.dp

/** Bundled JetBrains Mono (400, 700). Used for scores, ranks and points. */
val MonoFamily = FontFamily(
    Font(R.font.jetbrains_mono_regular, FontWeight.Normal),
    Font(R.font.jetbrains_mono_bold, FontWeight.Bold),
)

/** System sans (or mono) at a design-token size; sp sizes scale with the user's font-size setting. */
fun appFont(
    size: TextUnit,
    weight: FontWeight = FontWeight.Normal,
    mono: Boolean = false,
    letterSpacing: TextUnit = TextUnit.Unspecified,
    align: TextAlign = TextAlign.Unspecified,
): TextStyle = TextStyle(
    fontSize = size,
    fontWeight = if (mono && weight > FontWeight.Medium) FontWeight.Bold else weight,
    fontFamily = if (mono) MonoFamily else FontFamily.Default,
    letterSpacing = letterSpacing,
    textAlign = align,
    fontFeatureSettings = if (mono) "tnum" else null,
)

object W {
    val Regular = FontWeight.Normal
    val Medium = FontWeight.Medium
    val Semibold = FontWeight.SemiBold
    val Bold = FontWeight.Bold
    val Heavy = FontWeight.ExtraBold
}
