package com.maamoun.footballpredictions.core.networking

import com.maamoun.footballpredictions.BuildConfig

object AppConfig {
    /** Debug: emulator loopback to the dev server (RN `__DEV__`); Release: production. */
    val apiBaseUrl: String get() = debugOverride ?: BuildConfig.API_BASE_URL

    /** Debug-only override, set from an intent extra (see MainActivity) to point at the mock server. */
    @Volatile var debugOverride: String? = null

    const val PLATFORM = "android"

    /** Mirrors `mobile/src/constants/featureFlags.ts`; odds explainer UI is deferred (see PARITY.md). */
    const val ODDS_FEATURE_ENABLED = false
}
