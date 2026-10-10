import XCTest
@testable import FootballPredictions

final class EventMergeTests: XCTestCase {
    private func e(_ type: MatchEventType, _ detail: String, _ minute: Int, _ team: EventSide = .home, _ player: String = "P") -> MatchEvent {
        MatchEvent(type: type, detail: detail, minute: minute, team: team, player: player, assistPlayer: nil)
    }

    func testYellowThenRedSamePlayerMinuteMerges() {
        let merged = mergeMatchEvents([e(.card, "Yellow Card", 55), e(.card, "Red Card", 55)])
        XCTAssertEqual(merged.count, 1)
        XCTAssertEqual(merged[0].icons, ["🟨", "🟥"])
    }

    func testDifferentPlayersDoNotMerge() {
        let merged = mergeMatchEvents([e(.card, "Yellow Card", 55, .home, "A"), e(.card, "Red Card", 55, .home, "B")])
        XCTAssertEqual(merged.count, 2)
    }

    func testOwnGoalAndOrdering() {
        let merged = mergeMatchEvents([e(.goal, "Own Goal", 40), e(.goal, "Normal Goal", 10)])
        XCTAssertEqual(merged.map(\.event.minute), [10, 40])
        XCTAssertFalse(merged[0].ownGoal)
        XCTAssertTrue(merged[1].ownGoal)
        XCTAssertEqual(merged[0].icons, ["⚽"])
    }
}
