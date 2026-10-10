import XCTest
@testable import FootballPredictions

/// Mirrors `mobile/src/notifications/route-for-notification.ts` — and the Android `NotificationRouterTest`.
final class NotificationRouterTests: XCTestCase {
    private func route(_ data: [AnyHashable: Any]?) -> NotificationDestination { NotificationRouter.destination(for: data) }

    func testScoreNotificationsOpenMyScore() {
        XCTAssertEqual(route(["type": "results"]), .myScore)
        XCTAssertEqual(route(["type": "result_correction"]), .myScore)
    }

    func testSeasonEndOpensClub() { XCTAssertEqual(route(["type": "season_end"]), .club) }

    func testMatchNotificationsOpenDetailOrFallBack() {
        for type in ["goal", "match_started", "match_reminder"] {
            XCTAssertEqual(route(["type": type, "matchId": "42"]), .matchDetail("42"))
            XCTAssertEqual(route(["type": type]), .matches)
            XCTAssertEqual(route(["type": type, "matchId": ""]), .matches)
        }
    }

    func testReminderNotificationsOpenSlip() {
        for type in ["new_matches", "prediction_reminder", "daily_reminder"] {
            XCTAssertEqual(route(["type": type]), .slip)
        }
    }

    func testUnknownOrMissingOpensMatches() {
        XCTAssertEqual(route(["type": "wat"]), .matches)
        XCTAssertEqual(route([:]), .matches)
        XCTAssertEqual(route(nil), .matches)
    }
}
