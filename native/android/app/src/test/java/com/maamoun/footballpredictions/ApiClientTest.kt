package com.maamoun.footballpredictions

import com.maamoun.footballpredictions.core.auth.AuthStore
import com.maamoun.footballpredictions.core.auth.MemoryStorage
import com.maamoun.footballpredictions.core.networking.ApiClient
import com.maamoun.footballpredictions.core.networking.ApiError
import com.maamoun.footballpredictions.core.networking.HttpMethod
import com.maamoun.footballpredictions.core.networking.dto.DeviceRegistrationRequest
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class ApiClientTest {
    private lateinit var server: MockWebServer
    private lateinit var client: ApiClient

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        client = ApiClient(baseUrl = { server.url("").toString().trimEnd('/') })
    }

    @After fun tearDown() = server.shutdown()

    @Serializable private data class Ok(val success: Boolean)

    @Test fun sendsBearerTokenAndDecodes() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"success":true}"""))
        val r: Ok = client.request("/api/mobile/x?y=1", token = "tok")
        assertTrue(r.success)
        val req = server.takeRequest()
        assertEquals("/api/mobile/x?y=1", req.path)
        assertEquals("Bearer tok", req.getHeader("Authorization"))
        assertEquals("application/json", req.getHeader("Accept"))
    }

    @Test fun errorBodySurfacesServerMessage() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Match is locked"}"""))
        try {
            client.send("/x", HttpMethod.POST, DeviceRegistrationRequest("a", "b"))
            fail("expected throw")
        } catch (e: ApiError) {
            assertEquals("Match is locked", e.message)
            assertEquals(403, e.status)
        }
    }

    @Test fun fallbackMessageWhenBodyHasNoError() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(502).setBody("<html>bad gateway</html>"))
        try {
            client.send("/x", HttpMethod.GET)
            fail("expected throw")
        } catch (e: ApiError) {
            assertEquals("Request failed (502)", e.message)
        }
    }

    @Test fun postEncodesJsonBody() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"success":true}"""))
        client.send("/api/mobile/devices", HttpMethod.POST, DeviceRegistrationRequest("abc", "android"), "t")
        val req = server.takeRequest()
        assertEquals("POST", req.method)
        assertEquals("""{"fcmToken":"abc","platform":"android"}""", req.body.readUtf8())
        assertTrue(req.getHeader("Content-Type")!!.startsWith("application/json"))
    }

    @Test fun emptyBodyIsAccepted() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(204))
        client.send("/x", HttpMethod.DELETE)
        Unit
    }

    @Test fun authStoreSignInPersistsAndSignOutClearsAfterPushUnregister() = runBlocking {
        val body = javaClass.classLoader!!.getResource("fixtures/auth-login.json")!!.readText()
        server.enqueue(MockResponse().setBody(body))
        val storage = MemoryStorage()
        val store = AuthStore(client, storage)
        assertNull(store.token)

        val order = mutableListOf<String>()
        store.onBeforeSignOut = { jwt -> order += "unregister:$jwt" }
        store.signIn("sample@example.com", "pw")
        assertEquals("Sample User", store.user?.name)
        assertNotNull(storage.get(AuthStore.TOKEN_KEY))

        val restored = AuthStore(client, storage)
        assertEquals(store.token, restored.token)

        store.signOut()
        order += "cleared:${storage.get(AuthStore.TOKEN_KEY) == null}"
        assertEquals(listOf("unregister:${restored.token}", "cleared:true"), order)
        assertNull(store.token)
    }
}
