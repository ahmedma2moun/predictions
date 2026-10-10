package com.maamoun.footballpredictions.core.designsystem

import android.content.Context
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemePref(val raw: String) {
    LIGHT("light"), DARK("dark"), SYSTEM("system");

    companion object { fun from(raw: String?) = entries.firstOrNull { it.raw == raw } }
}

/**
 * Dark/light "Scoreboard" palettes with a persisted `light / dark / system` preference (default dark).
 * Storage key matches the RN app (`fp_theme_mode`).
 */
class ThemeStore(context: Context) {
    private val prefs = context.getSharedPreferences("fp_prefs", Context.MODE_PRIVATE)
    private val _pref = MutableStateFlow(ThemePref.from(prefs.getString(KEY, null)) ?: ThemePref.DARK)
    val pref: StateFlow<ThemePref> = _pref.asStateFlow()

    fun setPref(value: ThemePref) {
        _pref.value = value
        prefs.edit().putString(KEY, value.raw).apply()
    }

    /** Flips between light and dark (resolving `system` first). */
    fun toggle(currentlyDark: Boolean) = setPref(if (currentlyDark) ThemePref.LIGHT else ThemePref.DARK)

    companion object { const val KEY = "fp_theme_mode" }
}

val LocalPalette = staticCompositionLocalOf { Tokens.dark }
val LocalIsDark = staticCompositionLocalOf { true }

@Composable
fun resolveDark(pref: ThemePref): Boolean = when (pref) {
    ThemePref.DARK -> true
    ThemePref.LIGHT -> false
    ThemePref.SYSTEM -> isSystemInDarkTheme()
}

/** Wraps Material 3 so stock components (switches, dialogs, pull-to-refresh) pick up the brand palette. */
@Composable
fun FpTheme(dark: Boolean, content: @Composable () -> Unit) {
    val p = if (dark) Tokens.dark else Tokens.light
    val scheme = if (dark) {
        darkColorScheme(
            primary = p.primary, onPrimary = p.primaryForeground, background = p.background, onBackground = p.foreground,
            surface = p.card, onSurface = p.foreground, surfaceVariant = p.cardElevated, onSurfaceVariant = p.mutedForeground,
            error = p.destructive, outline = p.border, surfaceContainer = p.card, surfaceContainerHigh = p.cardElevated,
        )
    } else {
        lightColorScheme(
            primary = p.primary, onPrimary = p.primaryForeground, background = p.background, onBackground = p.foreground,
            surface = p.card, onSurface = p.foreground, surfaceVariant = p.cardElevated, onSurfaceVariant = p.mutedForeground,
            error = p.destructive, outline = p.border, surfaceContainer = p.card, surfaceContainerHigh = p.cardElevated,
        )
    }
    CompositionLocalProvider(LocalPalette provides p, LocalIsDark provides dark) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}

val palette: Palette @Composable get() = LocalPalette.current
