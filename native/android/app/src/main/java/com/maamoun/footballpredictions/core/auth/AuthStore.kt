package com.maamoun.footballpredictions.core.auth

import com.maamoun.footballpredictions.core.networking.ApiClient
import com.maamoun.footballpredictions.core.networking.AppJson
import com.maamoun.footballpredictions.core.networking.HttpMethod
import com.maamoun.footballpredictions.core.networking.dto.AuthUser
import com.maamoun.footballpredictions.core.networking.dto.LoginRequest
import com.maamoun.footballpredictions.core.networking.dto.LoginResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AuthState(val token: String? = null, val user: AuthUser? = null, val isLoading: Boolean = true)

/** JWT + user persisted in secure storage (`fp_token`, `fp_user` — same keys as the RN app). */
class AuthStore(private val api: ApiClient, private val storage: SecureStorage) {
    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    /** Called with the JWT *before* local state is cleared (unregisters the push token). */
    var onBeforeSignOut: (suspend (String) -> Unit)? = null

    val token: String? get() = _state.value.token
    val user: AuthUser? get() = _state.value.user

    init { restore() }

    private fun restore() {
        val token = storage.get(TOKEN_KEY)
        val user = storage.get(USER_KEY)?.let { runCatching { AppJson.decodeFromString<AuthUser>(it) }.getOrNull() }
        _state.value = AuthState(token, user, isLoading = false)
    }

    suspend fun signIn(email: String, password: String) {
        val response: LoginResponse = api.request("/api/mobile/auth/login", HttpMethod.POST, LoginRequest(email, password))
        storage.set(TOKEN_KEY, response.token)
        storage.set(USER_KEY, AppJson.encodeToString(AuthUser.serializer(), response.user))
        _state.value = AuthState(response.token, response.user, isLoading = false)
    }

    /** Sign-out order: unregister push token -> clear secure storage -> back to Login. */
    suspend fun signOut() {
        token?.let { onBeforeSignOut?.invoke(it) }
        storage.remove(TOKEN_KEY)
        storage.remove(USER_KEY)
        _state.value = AuthState(null, null, isLoading = false)
    }

    /** Debug-only (mock server / screenshots). */
    fun setMockSession(token: String, user: AuthUser) { _state.value = AuthState(token, user, false) }

    companion object {
        const val TOKEN_KEY = "fp_token"
        const val USER_KEY = "fp_user"
    }
}
