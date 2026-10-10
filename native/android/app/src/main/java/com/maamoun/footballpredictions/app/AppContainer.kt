package com.maamoun.footballpredictions.app

import android.content.Context
import com.maamoun.footballpredictions.core.auth.AuthStore
import com.maamoun.footballpredictions.core.auth.KeystoreSecureStorage
import com.maamoun.footballpredictions.core.auth.SecureStorage
import com.maamoun.footballpredictions.core.designsystem.ThemeStore
import com.maamoun.footballpredictions.core.networking.ApiClient
import com.maamoun.footballpredictions.core.push.NotificationDestination
import com.maamoun.footballpredictions.core.push.PushRegistrar
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AppAlert(val title: String, val message: String? = null, val id: Long = System.nanoTime())

/**
 * App-level alert host, so an alert survives the screen that raised it being replaced
 * (RN `Alert.alert` is likewise independent of the current screen).
 */
class AlertCenter {
    private val _current = MutableStateFlow<AppAlert?>(null)
    val current: StateFlow<AppAlert?> = _current.asStateFlow()
    fun show(title: String, message: String? = null) { _current.value = AppAlert(title, message) }
    fun dismiss() { _current.value = null }
}

/** Plain composition root — screens/view models receive it through their constructors. */
class AppContainer(context: Context, storage: SecureStorage = KeystoreSecureStorage(context)) {
    val api = ApiClient()
    val auth = AuthStore(api, storage)
    val theme = ThemeStore(context)
    val alerts = AlertCenter()
    val push = PushRegistrar(context, api, storage)

    /** Notification taps that arrive before sign-in are replayed once a session exists. */
    private val _pending = MutableStateFlow<NotificationDestination?>(null)
    val pendingDestination: StateFlow<NotificationDestination?> = _pending.asStateFlow()

    init { auth.onBeforeSignOut = { jwt -> push.unregister(jwt) } }

    fun postDestination(destination: NotificationDestination) { _pending.value = destination }
    fun consumeDestination() { _pending.value = null }

    /** Bearer token for the signed-in user. Screens are only shown while signed in. */
    val token: String? get() = auth.token
}
