import XCTest
@testable import FootballPredictions

final class StubURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) -> (Int, Data))?
    nonisolated(unsafe) static var lastRequest: URLRequest?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var req = request
        if req.httpBody == nil, let stream = req.httpBodyStream {
            stream.open()
            var data = Data()
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 1024)
            while stream.hasBytesAvailable {
                let n = stream.read(buffer, maxLength: 1024)
                if n <= 0 { break }
                data.append(buffer, count: n)
            }
            buffer.deallocate()
            req.httpBody = data
        }
        Self.lastRequest = req
        let (status, body) = Self.handler?(req) ?? (500, Data())
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class ApiClientTests: XCTestCase {
    private var client: ApiClient!

    override func setUp() {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        client = ApiClient(baseURL: URL(string: "https://example.test")!, session: URLSession(configuration: config))
    }

    func testSendsBearerTokenAndDecodes() async throws {
        StubURLProtocol.handler = { _ in (200, Data(#"{"success":true}"#.utf8)) }
        struct R: Decodable { let success: Bool }
        let r: R = try await client.request("/api/mobile/x?y=1", token: "tok")
        XCTAssertTrue(r.success)
        XCTAssertEqual(StubURLProtocol.lastRequest?.url?.absoluteString, "https://example.test/api/mobile/x?y=1")
        XCTAssertEqual(StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer tok")
        XCTAssertEqual(StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Accept"), "application/json")
    }

    func testErrorBodySurfacesServerMessage() async {
        StubURLProtocol.handler = { _ in (403, Data(#"{"error":"Match is locked"}"#.utf8)) }
        do {
            let _: EmptyResponse = try await client.request("/x", method: .post, body: LoginRequest(email: "a", password: "b"))
            XCTFail("expected throw")
        } catch let error as ApiError {
            XCTAssertEqual(error.message, "Match is locked")
            XCTAssertEqual(error.status, 403)
        } catch { XCTFail("wrong error \(error)") }
    }

    func testFallbackMessageWhenBodyHasNoError() async {
        StubURLProtocol.handler = { _ in (502, Data("<html>bad gateway</html>".utf8)) }
        do {
            try await client.send("/x", method: .get)
            XCTFail("expected throw")
        } catch let error as ApiError {
            XCTAssertEqual(error.message, "Request failed (502)")
        } catch { XCTFail("wrong error \(error)") }
    }

    func testPostEncodesJSONBody() async throws {
        StubURLProtocol.handler = { _ in (200, Data(#"{"success":true}"#.utf8)) }
        try await client.send("/api/mobile/devices", method: .post,
                              body: DeviceRegistrationRequest(fcmToken: "abc", platform: "ios"), token: "t")
        let body = try XCTUnwrap(StubURLProtocol.lastRequest?.httpBody)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(json, ["fcmToken": "abc", "platform": "ios"])
        XCTAssertEqual(StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func testEmptyBodyDecodesAsEmptyResponse() async throws {
        StubURLProtocol.handler = { _ in (204, Data()) }
        try await client.send("/x", method: .delete)
    }
}

@MainActor
final class AuthStoreTests: XCTestCase {
    func testSignInPersistsAndSignOutClearsAfterPushUnregister() async throws {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        let api = ApiClient(baseURL: URL(string: "https://example.test")!, session: URLSession(configuration: config))
        StubURLProtocol.handler = { _ in
            let body = try! Data(contentsOf: Bundle(for: FixtureDecodingTests.self).resourceURL!.appendingPathComponent("fixtures/auth-login.json"))
            return (200, body)
        }
        let storage = MemoryStorage()
        let store = AuthStore(api: api, storage: storage)
        XCTAssertNil(store.token)

        var order: [String] = []
        store.onBeforeSignOut = { jwt in order.append("unregister:\(jwt)") }

        try await store.signIn(email: "sample@example.com", password: "pw")
        XCTAssertEqual(store.user?.name, "Sample User")
        XCTAssertNotNil(storage.get(AuthStore.tokenKey))

        // A fresh store restores the session from storage.
        let restored = AuthStore(api: api, storage: storage)
        XCTAssertEqual(restored.token, store.token)

        await store.signOut()
        order.append("cleared:\(storage.get(AuthStore.tokenKey) == nil)")
        XCTAssertEqual(order, ["unregister:\(restored.token!)", "cleared:true"])
        XCTAssertNil(store.token)
    }
}
