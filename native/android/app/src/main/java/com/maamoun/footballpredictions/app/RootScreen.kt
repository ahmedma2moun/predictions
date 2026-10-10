package com.maamoun.footballpredictions.app

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.maamoun.footballpredictions.core.designsystem.AppIcon
import com.maamoun.footballpredictions.core.designsystem.FpTheme
import com.maamoun.footballpredictions.core.designsystem.Hairline
import com.maamoun.footballpredictions.core.designsystem.Tokens
import com.maamoun.footballpredictions.core.designsystem.W
import com.maamoun.footballpredictions.core.designsystem.appFont
import com.maamoun.footballpredictions.core.designsystem.palette
import com.maamoun.footballpredictions.core.designsystem.resolveDark
import com.maamoun.footballpredictions.features.champion.ChampionScreen
import com.maamoun.footballpredictions.features.club.ClubScreen
import com.maamoun.footballpredictions.features.leaderboard.LeaderboardScreen
import com.maamoun.footballpredictions.features.login.LoginScreen
import com.maamoun.footballpredictions.features.matchdetail.MatchDetailScreen
import com.maamoun.footballpredictions.features.matches.MatchesScreen
import com.maamoun.footballpredictions.features.myscore.MyScoreScreen
import com.maamoun.footballpredictions.features.reminders.RemindersScreen
import com.maamoun.footballpredictions.features.seasons.SeasonsScreen
import com.maamoun.footballpredictions.features.slip.SlipScreen
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.sp

private fun AppTab.icon(): ImageVector = when (this) {
    AppTab.Matches -> AppIcon.tabMatches
    AppTab.MyScore -> AppIcon.tabMyScore
    AppTab.Leaders -> AppIcon.tabLeaders
    AppTab.Club -> AppIcon.tabClub
    AppTab.Reminders -> AppIcon.tabReminders
    AppTab.Seasons -> AppIcon.tabSeasons
}

/** Auth gate + nav host + tab bar + app-level alert/notification wiring. */
@Composable
fun RootScreen(app: AppContainer) {
    val pref by app.theme.pref.collectAsStateCompat()
    FpTheme(dark = resolveDark(pref)) {
        val c = palette
        val auth by app.auth.state.collectAsStateCompat()
        val controller = rememberNavController()
        val nav = remember(controller) { AppNav(controller) }
        val start = remember { if (app.auth.token != null) Routes.MATCHES else Routes.LOGIN }
        val backStack by controller.currentBackStackEntryAsState()
        val route = backStack?.destination?.route

        // Auth gate: signed out -> Login (clearing the stack); signed in on Login -> Matches.
        LaunchedEffect(auth.token) {
            if (auth.token == null && route != Routes.LOGIN) {
                controller.navigate(Routes.LOGIN) { popUpTo(0) { inclusive = true } }
            } else if (auth.token != null && route == Routes.LOGIN) {
                controller.navigate(Routes.MATCHES) { popUpTo(0) { inclusive = true } }
            }
        }

        // Push registration + notification routing (foreground, background and cold start).
        val pending by app.pendingDestination.collectAsStateCompat()
        LaunchedEffect(auth.token) { auth.token?.let { if (it != "mock-token") app.push.register(it) } }
        LaunchedEffect(auth.token, pending, route) {
            val destination = pending
            if (auth.token != null && destination != null && route != null && route != Routes.LOGIN) {
                app.consumeDestination()
                nav.open(destination)
            }
        }
        LaunchedEffect(auth.token, route) { DebugLaunch.applyOnce(nav, route, auth.token) }

        Scaffold(
            containerColor = c.background,
            bottomBar = {
                if (route in tabRoutes || route == Routes.CHAMPION) {
                    NavigationBar(
                        containerColor = if (com.maamoun.footballpredictions.core.designsystem.LocalIsDark.current)
                            Tokens.Fixed.tabBarDark else Tokens.Fixed.tabBarLight,
                        tonalElevation = androidx.compose.ui.unit.Dp.Hairline,
                    ) {
                        AppTab.entries.forEach { tab ->
                            val selected = route == tab.route || (route == Routes.CHAMPION && tab == AppTab.MyScore)
                            NavigationBarItem(
                                selected = selected,
                                onClick = { nav.openTab(tab.route) },
                                icon = { Icon(tab.icon(), contentDescription = null) },
                                label = { Text(tab.title, style = appFont(Tokens.FontSize.xs, W.Medium), maxLines = 1) },
                                alwaysShowLabel = true,
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = c.primary, selectedTextColor = c.primary,
                                    unselectedIconColor = c.mutedForeground, unselectedTextColor = c.mutedForeground,
                                    indicatorColor = c.primarySoft,
                                ),
                            )
                        }
                    }
                }
            },
        ) { inner ->
            NavHost(
                navController = controller,
                startDestination = start,
                modifier = Modifier.fillMaxSize().background(c.background).padding(bottom = inner.calculateBottomPadding()),
                enterTransition = { fadeIn(tween(160)) },
                exitTransition = { fadeOut(tween(160)) },
                popEnterTransition = { fadeIn(tween(160)) },
                popExitTransition = { fadeOut(tween(160)) },
            ) {
                composable(Routes.LOGIN) { LoginScreen(app) }
                composable(Routes.MATCHES) { MatchesScreen(app, nav) }
                composable(Routes.MY_SCORE) { MyScoreScreen(app, nav) }
                composable(Routes.LEADERS) { LeaderboardScreen(app) }
                composable(Routes.CLUB) { ClubScreen(app, nav) }
                composable(Routes.REMINDERS) { RemindersScreen(app) }
                composable(Routes.SEASONS) { SeasonsScreen(app) }
                composable(Routes.CHAMPION) { ChampionScreen(app, nav) }
                composable(Routes.SLIP) { SlipScreen(app, nav) }
                composable(Routes.MATCH_DETAIL, arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                    MatchDetailScreen(app, nav, entry.arguments?.getString("id").orEmpty())
                }
            }
        }

        AlertHost(app)
    }
}

@Composable
private fun AlertHost(app: AppContainer) {
    val alert by app.alerts.current.collectAsStateCompat()
    val c = palette
    alert?.let { current ->
        AlertDialog(
            onDismissRequest = app.alerts::dismiss,
            containerColor = c.card,
            title = { Text(current.title, color = c.foreground) },
            text = current.message?.let { { Text(it, color = c.mutedForeground) } },
            confirmButton = { TextButton(onClick = app.alerts::dismiss) { Text("OK", color = c.primary) } },
        )
    }
}
