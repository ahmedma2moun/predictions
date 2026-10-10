package com.maamoun.footballpredictions.core.util

import com.maamoun.footballpredictions.core.networking.isCancellation
import com.maamoun.footballpredictions.core.networking.userMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

data class RemoteState<T>(
    val data: T? = null,
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
)

/**
 * Generic loading state — the equivalent of RN `useRemoteData`: loading / refreshing / error;
 * cancellation propagates from the caller's coroutine, `isRefresh` keeps existing data on screen.
 */
class RemoteData<T> {
    private val _state = MutableStateFlow(RemoteState<T>())
    val state: StateFlow<RemoteState<T>> = _state.asStateFlow()

    val value: RemoteState<T> get() = _state.value

    suspend fun run(isRefresh: Boolean = false, fetch: suspend () -> T) {
        _state.update { it.copy(isRefreshing = isRefresh, isLoading = if (isRefresh) it.isLoading else true, error = null) }
        try {
            val result = fetch()
            currentCoroutineContext().ensureActive()
            _state.value = RemoteState(data = result, isLoading = false, isRefreshing = false, error = null)
        } catch (e: Throwable) {
            if (isCancellation(e)) throw e
            _state.update { it.copy(isLoading = false, isRefreshing = false, error = userMessage(e)) }
        }
    }

    fun reset() { _state.value = RemoteState() }
}
