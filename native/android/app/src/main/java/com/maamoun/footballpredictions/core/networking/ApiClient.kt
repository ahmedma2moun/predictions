package com.maamoun.footballpredictions.core.networking

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.serializer
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

enum class HttpMethod { GET, POST, PUT, PATCH, DELETE }

val AppJson = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
    encodeDefaults = true
}

/**
 * OkHttp wrapper equivalent to `mobile/src/api/client.ts`:
 * Bearer token, JSON body, `{ error }` body -> `ApiError(message, status)`.
 * Coroutine cancellation cancels the in-flight call.
 */
class ApiClient(
    val baseUrl: () -> String = { AppConfig.apiBaseUrl },
    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build(),
) {
    suspend inline fun <reified T> request(
        path: String,
        method: HttpMethod = HttpMethod.GET,
        token: String? = null,
    ): T = execute(path, method, null, token, serializer<T>())

    suspend inline fun <reified B, reified T> request(
        path: String,
        method: HttpMethod,
        body: B,
        token: String? = null,
    ): T = execute(path, method, AppJson.encodeToString(serializer<B>(), body), token, serializer<T>())

    /** Fire-and-forget variant for endpoints whose body we ignore. */
    suspend inline fun <reified B> send(path: String, method: HttpMethod, body: B, token: String? = null) {
        executeRaw(path, method, AppJson.encodeToString(serializer<B>(), body), token)
    }

    suspend fun send(path: String, method: HttpMethod, token: String? = null) {
        executeRaw(path, method, null, token)
    }

    suspend fun <T> execute(path: String, method: HttpMethod, json: String?, token: String?, serializer: KSerializer<T>): T {
        val (status, text) = executeRaw(path, method, json, token)
        return try {
            AppJson.decodeFromString(serializer, text)
        } catch (e: Exception) {
            throw ApiError("Unexpected response from server", status)
        }
    }

    suspend fun executeRaw(path: String, method: HttpMethod, json: String?, token: String?): Pair<Int, String> {
        val builder = Request.Builder().url(baseUrl() + path).header("Accept", "application/json")
        if (!token.isNullOrEmpty()) builder.header("Authorization", "Bearer $token")
        val body = json?.toRequestBody("application/json".toMediaType())
        builder.method(method.name, body ?: if (method == HttpMethod.GET) null else ByteArray(0).toRequestBody(null))
        val response = client.newCall(builder.build()).await()
        return response.use {
            val text = it.body?.string().orEmpty()
            if (!it.isSuccessful) throw ApiError(errorMessage(text) ?: "Request failed (${it.code})", it.code)
            it.code to text.ifEmpty { "{}" }
        }
    }

    private fun errorMessage(text: String): String? = try {
        ((AppJson.parseToJsonElement(text) as? JsonObject)?.get("error") as? JsonPrimitive)?.takeIf { it.isString }?.content
    } catch (_: Exception) {
        null
    }
}

private suspend fun Call.await(): Response = withContext(Dispatchers.IO) {
    suspendCancellableCoroutine { cont ->
        enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { if (!cont.isCancelled) cont.resumeWithException(e) }
            override fun onResponse(call: Call, response: Response) { cont.resume(response) }
        })
        cont.invokeOnCancellation { runCatching { cancel() } }
    }
}
