import XCTest
import SwiftUI
@testable import FootballPredictionAdmin

final class StubProtocol: URLProtocol {
    static var status = 200
    static var response = "{}"
    static var onRequest: ((URLRequest) -> Void)?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.onRequest?(request)
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: Self.status, httpVersion: nil,
            headerFields: ["Content-Type": "application/json"])!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.response.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@MainActor final class AdminAPITests: XCTestCase {
    func testLeaguePickerLoadsWhenTeamsSectionAppears() async {
        StubProtocol.status = 200
        StubProtocol.response = #"[{"_id":"42","name":"Premier League","isActive":true}]"#
        let requested = expectation(description: "Visible league picker requests leagues")
        StubProtocol.onRequest = { request in
            if request.url?.path == "/api/admin/leagues" { requested.fulfill() }
        }
        let controller = UIHostingController(rootView:
            NavigationStack { List { Section { LeaguePicker(selection: .constant("")) } } }
                .environmentObject(api()))
        let window = UIWindow(windowScene: UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first!)
        window.frame = window.windowScene!.screen.bounds
        window.rootViewController = controller
        window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil; StubProtocol.onRequest = nil }
        await fulfillment(of: [requested], timeout: 3)
    }

    func testTeamSelectionLoadsWhenSectionAppears() async {
        StubProtocol.status = 200
        StubProtocol.response = "[]"
        let requested = expectation(description: "Visible team selection requests its league teams")
        StubProtocol.onRequest = { request in
            if request.url?.path == "/api/admin/teams", request.url?.query == "leagueId=42" { requested.fulfill() }
        }
        let controller = UIHostingController(rootView:
            NavigationStack { Form { Section { TeamSelection(leagueID: "42", selected: .constant([])) } } }
                .environmentObject(api()))
        let window = UIWindow(windowScene: UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first!)
        window.frame = window.windowScene!.screen.bounds
        window.rootViewController = controller
        window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil; StubProtocol.onRequest = nil }
        await fulfillment(of: [requested], timeout: 3)
    }

    private func api() -> AdminAPI {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return AdminAPI(baseURL: URL(string: "https://admin-test.invalid")!, session: URLSession(configuration: config))
    }
    func testMixedIDsAndBooleanDecoding() throws {
        let value = try JSONDecoder().decode(Value.self, from: Data(#"[{"id":42,"isActive":true},{"_id":"43","points":1.5}]"#.utf8))
        XCTAssertEqual(value.array[0].id, "42")
        XCTAssertTrue(value.array[0]["isActive"].flag)
        XCTAssertEqual(value.array[1].id, "43")
        XCTAssertEqual(value.array[1]["points"].text, "1.5")
    }
    func testInvalidLoginNeverEntersAdminUI() async {
        StubProtocol.status = 401
        StubProtocol.response = #"{"error":"Sign in with a valid admin account."}"#
        let api = api()
        do { try await api.login(email: "player@example.com", password: "wrong"); XCTFail("Login should fail") }
        catch { XCTAssertEqual(error.localizedDescription, "Sign in with a valid admin account.") }
        XCTAssertFalse(api.signedIn)
    }
    func testPlayerResponseIsRejectedEvenWithHTTP200() async {
        StubProtocol.status = 200
        StubProtocol.response = #"{"token":"player-token","user":{"role":"user"}}"#
        let api = api()
        do { try await api.login(email: "player@example.com", password: "password"); XCTFail("Player must be rejected") }
        catch { XCTAssertFalse(api.signedIn) }
    }
    func testForbiddenClearsSession() async {
        StubProtocol.status = 403
        StubProtocol.response = #"{"error":"Forbidden"}"#
        let api = api()
        api.signedIn = true
        do { _ = try await api.request("/api/admin/users"); XCTFail("Must fail") }
        catch { XCTAssertFalse(api.signedIn); XCTAssertNotNil(api.sessionError) }
    }
    func testPlayerEndpointsAreNotAvailable() async {
        let api = api()
        do { _ = try await api.request("/api/mobile/predictions"); XCTFail("Must reject player route") }
        catch { XCTAssertEqual(error.localizedDescription, "This operation is unavailable in the admin app.") }
    }
    func testHTMLResponseDoesNotAppearSuccessful() async {
        StubProtocol.status = 200
        StubProtocol.response = "<html>Sign in</html>"
        do { _ = try await api().request("/api/admin/dashboard"); XCTFail("Must reject HTML") }
        catch { XCTAssertTrue(error.localizedDescription.contains("Unexpected response")) }
    }
    func testFailedMutationSurfacesServerError() async {
        StubProtocol.status = 400
        StubProtocol.response = #"{"error":"Cannot delete the default group"}"#
        let data = Resource()
        let success = await data.perform(api(), "/api/admin/groups/1", method: "DELETE")
        XCTAssertFalse(success)
        XCTAssertEqual(data.error, "Cannot delete the default group")
        XCTAssertFalse(data.busy)
    }
    func testDatesSupportBothServerFormats() {
        XCTAssertNotNil(parseDate("2026-09-07T12:00:00.000Z"))
        XCTAssertNotNil(parseDate("2026-09-07T12:00:00Z"))
    }
}
