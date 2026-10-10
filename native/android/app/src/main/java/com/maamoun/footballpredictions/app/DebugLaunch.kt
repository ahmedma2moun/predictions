package com.maamoun.footballpredictions.app

import com.maamoun.footballpredictions.BuildConfig

/** Debug-only: applies the `fp_open` intent extra (`tab[:slip|champion|match=<id>]`) once after sign-in. */
object DebugLaunch {
    fun applyOnce(nav: AppNav, route: String?, token: String?) {
        if (!BuildConfig.DEBUG || token == null || route == null || route == Routes.LOGIN) return
        val spec = DebugOpen.request ?: return
        DebugOpen.request = null
        val parts = spec.split(":", limit = 2)
        val tab = when (parts[0]) {
            "matches" -> Routes.MATCHES; "myScore" -> Routes.MY_SCORE; "leaders" -> Routes.LEADERS
            "club" -> Routes.CLUB; "reminders" -> Routes.REMINDERS; "seasons" -> Routes.SEASONS
            else -> return
        }
        nav.openTab(tab)
        when (val sub = parts.getOrNull(1)) {
            "slip" -> nav.openSlip()
            "champion" -> nav.openChampion()
            else -> if (sub != null && sub.startsWith("match=")) nav.openMatch(sub.removePrefix("match="))
        }
    }
}
