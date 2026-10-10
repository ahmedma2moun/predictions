package com.maamoun.footballpredictions.features.login

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.maamoun.footballpredictions.app.AppContainer
import com.maamoun.footballpredictions.core.networking.ApiError
import kotlinx.coroutines.launch

class LoginViewModel(private val app: AppContainer) : ViewModel() {
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var isLoading by mutableStateOf(false)
        private set

    fun submit() {
        val trimmed = email.trim()
        if (trimmed.isEmpty() || password.isEmpty()) {
            app.alerts.show("Missing info", "Email and password are required.")
            return
        }
        viewModelScope.launch {
            isLoading = true
            try {
                app.auth.signIn(trimmed, password)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                app.alerts.show("Sign in failed", (e as? ApiError)?.message ?: "Invalid email or password")
            } finally {
                isLoading = false
            }
        }
    }
}
