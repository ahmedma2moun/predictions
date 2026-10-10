import XCTest
@testable import FootballPredictions

/// Decodes every file in `native/contract/fixtures` into its DTO. The Android suite does the same with
/// the same file list, so a wire-format change must be reflected on both platforms.
final class FixtureDecodingTests: XCTestCase {
    private func data(_ name: String) throws -> Data {
        let dir = Bundle(for: Self.self).resourceURL!.appendingPathComponent("fixtures")
        return try Data(contentsOf: dir.appendingPathComponent("\(name).json"))
    }

    private func decode<T: Decodable>(_ type: T.Type, _ name: String, file: StaticString = #filePath, line: UInt = #line) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data(name))
        } catch {
            XCTFail("Failed to decode \(name) as \(T.self): \(error)", file: file, line: line)
            throw error
        }
    }

    /// Every fixture name must be listed here (and in the Android test). Keep alphabetical.
    static let covered: Set<String> = [
        "auth-login", "champion-bonus-disabled", "champion-bonus-locked", "champion-bonus-open", "error",
        "game-hub", "game-hub-empty", "groups", "leaderboard", "leaderboard-live", "leaderboard-user-predictions",
        "leagues", "match-detail", "match-detail-finished", "match-form", "match-group-predictions", "match-live",
        "match-live-minimal", "matches-list", "prediction-save-response", "predictions-history", "predictions-stats",
        "reminders", "reminders-save-response", "season-detail", "seasons", "slip", "slip-save-response", "success",
    ]

    func testEveryFixtureHasADecodingTest() throws {
        let dir = Bundle(for: Self.self).resourceURL!.appendingPathComponent("fixtures")
        let names = try FileManager.default.contentsOfDirectory(atPath: dir.path)
            .filter { $0.hasSuffix(".json") }.map { String($0.dropLast(5)) }
        XCTAssertEqual(Set(names), Self.covered, "Fixture list out of sync with FixtureDecodingTests.covered")
    }

    func testAuthLogin() throws {
        let r = try decode(LoginResponse.self, "auth-login")
        XCTAssertEqual(r.user.id, "7")
        XCTAssertEqual(r.user.role, "user")
    }

    func testMatchesList() throws {
        let items = try decode([MatchListItem].self, "matches-list")
        XCTAssertEqual(items.count, 4)
        XCTAssertEqual(items[0].id, "100")           // string ids
        XCTAssertEqual(items[0].status, .live)
        XCTAssertEqual(items[0].result?.homeScore, 1)
        XCTAssertEqual(items[1].prediction?.predictedWinner, .home)
        XCTAssertEqual(items[2].leg, 1)
        XCTAssertNil(items[2].homeStanding)
        XCTAssertNil(items[3].externalId)
        XCTAssertNil(items[3].homeTeam.logo)
        XCTAssertNotEqual(items[0].kickoffDate, .distantFuture)
    }

    func testMatchDetail() throws {
        let d = try decode(MatchDetail.self, "match-detail")
        XCTAssertEqual(d.id, "101")
        XCTAssertEqual(d.homeStanding?.form, "WWDWW")
        XCTAssertEqual(d.prevMatch?.id, "100")
        XCTAssertEqual(d.odds?.votes?.homeWin, 5)
        XCTAssertEqual(d.allPredictions?.count, 2)
        XCTAssertEqual(d.allPredictions?.first?.oddsBonus?.finalScore, 5)
        let f = try decode(MatchDetail.self, "match-detail-finished")
        XCTAssertEqual(f.result?.penaltyHomeScore, 4)
        XCTAssertTrue(f.isKnockout)
        XCTAssertNil(f.allPredictions)
    }

    func testMatchFormAndLive() throws {
        let form = try decode(MatchForm.self, "match-form")
        XCTAssertEqual(form.home.count, 3)
        XCTAssertEqual(form.home[0].result, .W)
        XCTAssertNil(form.away[0].result)
        XCTAssertNil(form.away[0].teamScore)
        let live = try decode(LiveScoreResponse.self, "match-live")
        XCTAssertEqual(live.status, .live)
        XCTAssertEqual(live.events?.count, 4)
        let minimal = try decode(LiveScoreResponse.self, "match-live-minimal")
        XCTAssertNil(minimal.homeScore)
        XCTAssertEqual(minimal.events, [])
    }

    func testGroupPredictions() throws {
        let rows = try decode([GroupPredictionEntry].self, "match-group-predictions")
        XCTAssertEqual(rows.count, 2)
        XCTAssertFalse(rows[1].predicted)
        XCTAssertNil(rows[1].userName)
    }

    func testLeaderboard() throws {
        let rows = try decode([LeaderboardEntry].self, "leaderboard")
        XCTAssertEqual(rows.count, 4)
        XCTAssertTrue(rows[0].isGroupChampion)
        XCTAssertEqual(rows[1].championBonusPoints, 6)
        let live = try decode(LiveGroupStanding.self, "leaderboard-live")
        XCTAssertEqual(live.standings.map(\.movement), [.up, .same, .down])
        XCTAssertNil(live.standings[1].name)
        let preds = try decode([LeaderboardUserPrediction].self, "leaderboard-user-predictions")
        XCTAssertEqual(preds[0].scoringBreakdown?.count, 2)
    }

    func testGroupsAndLeagues() throws {
        XCTAssertEqual(try decode([LeaderboardGroup].self, "groups").count, 2)
        let leagues = try decode([LeaderboardLeague].self, "leagues")
        XCTAssertEqual(leagues[0].externalId, 2021)
    }

    func testPredictions() throws {
        let items = try decode([PredictionHistoryItem].self, "predictions-history")
        XCTAssertEqual(items[0].pointsAwarded, 8)
        XCTAssertEqual(items[0].outcomeOdds, 1.5)
        XCTAssertNil(items[1].predictedWinner)
        let stats = try decode(AccuracyStats.self, "predictions-stats")
        XCTAssertEqual(stats.totalFinished, 20)
        _ = try decode(EmptyShape.self, "prediction-save-response")
    }

    func testSeasons() throws {
        let seasons = try decode([Season].self, "seasons")
        XCTAssertEqual(seasons.map(\.status), ["ACTIVE", "ENDED"])
        let detail = try decode(SeasonWithStandings.self, "season-detail")
        XCTAssertEqual(detail.standings.count, 3)
        XCTAssertNil(detail.standings[1].userName)
        XCTAssertEqual(detail.standings[2].groupId, 3)
    }

    func testChampionBonus() throws {
        XCTAssertEqual(try decode(ChampionBonusState.self, "champion-bonus-disabled"), .disabled)
        guard case .open(let open) = try decode(ChampionBonusState.self, "champion-bonus-open") else { return XCTFail("expected open") }
        XCTAssertEqual(open.allowedTeams.count, 2)
        XCTAssertEqual(open.myPick?.teamId, "11")
        guard case .locked(let locked) = try decode(ChampionBonusState.self, "champion-bonus-locked") else { return XCTFail("expected locked") }
        XCTAssertEqual(locked.teams["11"]?.awards.count, 2)
        XCTAssertEqual(locked.picks.count, 2)
        XCTAssertNil(locked.picks[1].name)
    }

    func testGameHub() throws {
        let hub = try decode(GameHub.self, "game-hub")
        XCTAssertEqual(hub.userId, 7)                    // numeric ids
        XCTAssertEqual(hub.weeks[1].winnerIds, [7])
        XCTAssertEqual(hub.feed[0].matchId, 55)
        XCTAssertNil(hub.feed[1].matchId)
        XCTAssertEqual(hub.rival?.gap, -22)
        XCTAssertEqual(hub.recap?.bestPrediction?.points, 8)
        let empty = try decode(GameHub.self, "game-hub-empty")
        XCTAssertNil(empty.groupId)
        XCTAssertNil(empty.rival)
    }

    func testSlipAndReminders() throws {
        let slip = try decode(SlipData.self, "slip")
        XCTAssertEqual(slip.matches[0].id, 101)
        XCTAssertNil(slip.matches[1].homeScore)
        XCTAssertTrue(slip.matches[2].locked)
        let saved = try decode(SlipSaveResponse.self, "slip-save-response")
        XCTAssertEqual(saved.results[1].error, "Match is locked")
        let reminders = try decode(RemindersData.self, "reminders")
        XCTAssertEqual(reminders.leagues[0].teams.count, 3)
        XCTAssertEqual(reminders.selections[0].teams.count, 2)
        XCTAssertEqual(try decode(ReminderSaveShape.self, "reminders-save-response").selections.count, 1)
    }

    func testErrorAndSuccessShapes() throws {
        struct ErrorBody: Decodable { let error: String }
        struct SuccessBody: Decodable { let success: Bool }
        XCTAssertEqual(try decode(ErrorBody.self, "error").error, "Match is locked")
        XCTAssertTrue(try decode(SuccessBody.self, "success").success)
    }
}

private struct EmptyShape: Decodable { let success: Bool }
private struct ReminderSaveShape: Decodable { let selections: [ReminderLeague] }
