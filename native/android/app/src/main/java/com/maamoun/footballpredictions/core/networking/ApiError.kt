package com.maamoun.footballpredictions.core.networking

import kotlinx.coroutines.CancellationException

/** Mirrors RN `ApiError(message, status)`. */
class ApiError(override val message: String, val status: Int) : Exception(message)

/** Turns any thrown error into the string the UI shows. */
fun userMessage(error: Throwable, fallback: String = "Something went wrong"): String =
    (error as? ApiError)?.message ?: error.message?.takeIf { it.isNotBlank() } ?: fallback

fun isCancellation(error: Throwable): Boolean = error is CancellationException
