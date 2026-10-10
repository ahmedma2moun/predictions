import XCTest
@testable import FootballPredictions

final class FormattingTests: XCTestCase {
    func testOrdinal() {
        XCTAssertEqual(ordinal(1), "1st")
        XCTAssertEqual(ordinal(2), "2nd")
        XCTAssertEqual(ordinal(3), "3rd")
        XCTAssertEqual(ordinal(4), "4th")
        XCTAssertEqual(ordinal(11), "11th")
        XCTAssertEqual(ordinal(12), "12th")
        XCTAssertEqual(ordinal(13), "13th")
        XCTAssertEqual(ordinal(21), "21st")
        XCTAssertEqual(ordinal(102), "102nd")
        XCTAssertEqual(ordinal(111), "111th")
    }

    func testStageLabels() {
        XCTAssertEqual(formatStage("QUARTER_FINALS"), "Quarter Final")
        XCTAssertEqual(formatStage("LAST_16"), "LAST 16")
        XCTAssertTrue(isKnockoutStage("QUARTER_FINALS"))
        XCTAssertFalse(isKnockoutStage("REGULAR_SEASON"))
        XCTAssertFalse(isKnockoutStage("GROUP_STAGE"))
        XCTAssertFalse(isKnockoutStage(nil))
    }

    func testWinner() {
        XCTAssertEqual(getWinner(home: 2, away: 1), .home)
        XCTAssertEqual(getWinner(home: 0, away: 1), .away)
        XCTAssertEqual(getWinner(home: 1, away: 1), .draw)
    }

    func testFormatNumber() {
        XCTAssertEqual(formatNumber(60), "60")
        XCTAssertEqual(formatNumber(33.3), "33.3")
        XCTAssertEqual(formatNumber(0), "0")
    }

    func testISOParsing() {
        XCTAssertNotNil(parseISODate("2026-10-17T14:00:00.000Z"))
        XCTAssertNotNil(parseISODate("2026-10-17T14:00:00Z"))
        XCTAssertNil(parseISODate("not a date"))
    }

    func testCountdown() {
        let now = Date()
        XCTAssertNil(countdownLabel(until: now.addingTimeInterval(-5), now: now))
        XCTAssertEqual(countdownLabel(until: now.addingTimeInterval(30), now: now), "< 1m to predict")
        XCTAssertEqual(countdownLabel(until: now.addingTimeInterval(61 * 60 + 30), now: now), "1h 1m to predict")
        XCTAssertEqual(countdownLabel(until: now.addingTimeInterval(25 * 3600), now: now), "1d 1h to predict")
        XCTAssertEqual(countdownLabel(until: now.addingTimeInterval(48 * 3600 + 30), now: now), "2d to predict")
        XCTAssertEqual(countdownLabel(until: now.addingTimeInterval(12 * 60 + 5), now: now), "12m to predict")
    }

    func testMatchDayHeader() {
        let now = Date()
        XCTAssertEqual(formatMatchDayHeader(now, now: now), "Today")
        XCTAssertEqual(formatMatchDayHeader(now.addingTimeInterval(86_400), now: now), "Tomorrow")
        XCTAssertEqual(formatMatchDayHeader(now.addingTimeInterval(-86_400), now: now), "Yesterday")
    }

    func testWeekBoundsStartOnFriday() {
        var cal = Calendar.current
        cal.firstWeekday = 1
        for offset in [-2, 0, 1] {
            let bounds = getWeekBounds(offset: offset)
            XCTAssertEqual(cal.component(.weekday, from: bounds.from), 6) // Friday
            XCTAssertEqual(cal.dateComponents([.day], from: bounds.from, to: bounds.to).day, 7)
        }
        let now = getWeekBounds(offset: 0)
        XCTAssertTrue(now.from <= Date() && Date() < now.to)
    }

    func testMonthBounds() {
        let b = getMonthBounds(offset: 0)
        XCTAssertEqual(Calendar.current.component(.day, from: b.from), 1)
        XCTAssertTrue(b.from <= Date() && Date() < b.to)
    }
}
