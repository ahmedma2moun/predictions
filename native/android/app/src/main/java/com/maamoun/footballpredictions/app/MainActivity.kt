package com.maamoun.footballpredictions.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.maamoun.footballpredictions.BuildConfig
import com.maamoun.footballpredictions.core.designsystem.ThemePref
import com.maamoun.footballpredictions.core.networking.AppConfig
import com.maamoun.footballpredictions.core.networking.dto.AuthUser
import com.maamoun.footballpredictions.core.push.NotificationRouter
import kotlinx.coroutines.CompletableDeferred

class MainActivity : ComponentActivity() {
    private lateinit var container: AppContainer
    private var permissionResult: CompletableDeferred<Boolean>? = null

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> permissionResult?.complete(granted) }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        container = (application as FootballPredictionsApplication).container

        container.push.requestPermission = {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                CompletableDeferred<Boolean>().also {
                    permissionResult = it
                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }.await()
            } else true
        }

        applyDebugExtras(intent)
        handleNotificationIntent(intent)
        setContent { RootScreen(container) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyDebugExtras(intent)
        handleNotificationIntent(intent)
    }

    /** Tap on a notification (foreground, background or cold start) arrives as intent extras. */
    private fun handleNotificationIntent(intent: Intent?) {
        val extras = intent?.extras ?: return
        if (!extras.containsKey("type")) return
        val data = extras.keySet().mapNotNull { key -> extras.get(key)?.toString()?.let { key to it } }.toMap()
        container.postDestination(NotificationRouter.destination(data))
    }

    /**
     * Debug-only extras for the mock server / screenshots (`adb shell am start -n … --es fp_open matches:slip`):
     * fp_mock_session, fp_api, fp_theme, fp_open.
     */
    private fun applyDebugExtras(intent: Intent?) {
        if (!BuildConfig.DEBUG || intent == null) return
        intent.getStringExtra("fp_api")?.let { AppConfig.debugOverride = it }
        intent.getStringExtra("fp_theme")?.let { ThemePref.from(it)?.let(container.theme::setPref) }
        if (intent.getBooleanExtra("fp_mock_session", false)) {
            container.auth.setMockSession("mock-token", AuthUser("7", "Sample User", "sample@example.com", "user"))
        }
        intent.getStringExtra("fp_open")?.let { DebugOpen.request = it }
    }
}

/** Debug-only deep link requested via `fp_open` (`tab[:slip|champion|match=<id>]`). */
object DebugOpen { @Volatile var request: String? = null }
