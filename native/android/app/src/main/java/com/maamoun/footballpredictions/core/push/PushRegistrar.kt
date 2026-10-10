package com.maamoun.footballpredictions.core.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.maamoun.footballpredictions.core.auth.SecureStorage
import com.maamoun.footballpredictions.core.networking.ApiClient
import com.maamoun.footballpredictions.core.networking.AppConfig
import com.maamoun.footballpredictions.core.networking.HttpMethod
import com.maamoun.footballpredictions.core.networking.dto.DeviceRegistrationRequest
import com.maamoun.footballpredictions.core.networking.dto.DeviceUnregisterRequest
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

const val DEFAULT_CHANNEL_ID = "default"

/** Creates the `default` channel (HIGH importance, accent #10b981) like the RN app. */
fun ensureNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(DEFAULT_CHANNEL_ID, "Default", NotificationManager.IMPORTANCE_HIGH).apply {
        vibrationPattern = longArrayOf(0, 250, 250, 250)
        lightColor = Color.parseColor("#10B981")
        enableLights(true)
    }
    manager.createNotificationChannel(channel)
}

/**
 * Registers the FCM token with the backend (`POST/DELETE /api/mobile/devices`).
 * Safe to call repeatedly — the backend upserts on token.
 */
class PushRegistrar(
    private val context: Context,
    private val api: ApiClient,
    private val storage: SecureStorage,
    /** Asks the OS for POST_NOTIFICATIONS (Android 13+). Provided by MainActivity. */
    var requestPermission: suspend () -> Boolean = { false },
) {
    private var registeredFor: String? = null

    private fun hasPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    suspend fun register(jwt: String): String? {
        if (registeredFor == jwt) return null
        registeredFor = jwt
        ensureNotificationChannel(context)
        if (!hasPermission() && !requestPermission()) return null

        val token = try { fetchToken() } catch (e: Exception) { Log.w("push", "failed to get FCM token", e); null }
        if (token.isNullOrEmpty()) return null
        return try {
            api.send("/api/mobile/devices", HttpMethod.POST, DeviceRegistrationRequest(token, AppConfig.PLATFORM), jwt)
            storage.set(LAST_TOKEN_KEY, token)
            token
        } catch (e: Exception) {
            Log.w("push", "device registration failed", e)
            null
        }
    }

    /** Best-effort token removal on sign-out; the server expires stale tokens anyway. */
    suspend fun unregister(jwt: String) {
        val token = storage.get(LAST_TOKEN_KEY)
        registeredFor = null
        storage.remove(LAST_TOKEN_KEY)
        if (token == null) return
        runCatching { api.send("/api/mobile/devices", HttpMethod.DELETE, DeviceUnregisterRequest(token), jwt) }
    }

    private suspend fun fetchToken(): String? = suspendCancellableCoroutine { cont ->
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { if (cont.isActive) cont.resume(it) }
            .addOnFailureListener { if (cont.isActive) cont.resume(null) }
    }

    private companion object { const val LAST_TOKEN_KEY = "fp_last_fcm_token" }
}
