package com.maamoun.footballpredictions.app

import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import com.maamoun.footballpredictions.core.push.NotificationDestination

/** Routes. Tabs: Matches · My Score · Leaders · Club · Reminders · Seasons. */
object Routes {
    const val LOGIN = "login"
    const val MATCHES = "matches"
    const val MY_SCORE = "myscore"
    const val LEADERS = "leaders"
    const val CLUB = "club"
    const val REMINDERS = "reminders"
    const val SEASONS = "seasons"
    const val CHAMPION = "champion" // "hidden tab": routable, not in the bar
    const val SLIP = "slip"
    const val MATCH_DETAIL = "match/{id}"
    fun matchDetail(id: String) = "match/$id"
}

enum class AppTab(val route: String, val title: String) {
    Matches(Routes.MATCHES, "Matches"),
    MyScore(Routes.MY_SCORE, "My Score"),
    Leaders(Routes.LEADERS, "Leaders"),
    Club(Routes.CLUB, "Club"),
    Reminders(Routes.REMINDERS, "Reminders"),
    Seasons(Routes.SEASONS, "Seasons"),
}

val tabRoutes = AppTab.entries.map { it.route }.toSet()

/** Thin wrapper over the NavController so screens/view models never touch route strings. */
class AppNav(val controller: NavHostController) {
    fun openTab(route: String) {
        controller.navigate(route) {
            popUpTo(controller.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    fun openMatch(id: String) = controller.navigate(Routes.matchDetail(id))
    fun openSlip() = controller.navigate(Routes.SLIP)
    fun openChampion() = controller.navigate(Routes.CHAMPION)
    fun back() { controller.popBackStack() }

    /** Replace (not push) so Back still returns to the list — used for prev/next match stepping. */
    fun replaceMatch(id: String) {
        controller.navigate(Routes.matchDetail(id)) {
            popUpTo(Routes.MATCH_DETAIL) { inclusive = true }
        }
    }

    fun open(destination: NotificationDestination) {
        when (destination) {
            NotificationDestination.Matches -> openTab(Routes.MATCHES)
            NotificationDestination.MyScore -> openTab(Routes.MY_SCORE)
            NotificationDestination.Club -> openTab(Routes.CLUB)
            NotificationDestination.Slip -> { openTab(Routes.MATCHES); openSlip() }
            is NotificationDestination.MatchDetail -> { openTab(Routes.MATCHES); openMatch(destination.id) }
        }
    }
}
