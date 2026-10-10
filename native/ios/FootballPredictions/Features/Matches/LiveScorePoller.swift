import Foundation
import Observation
import UIKit

struct LiveScore: Equatable, Sendable {
    let status: MatchStatus
    let homeScore: Int?
    let awayScore: Int?
}

/// Polls `GET matches/{id}/live` every 60 s while the owning view is visible (`.task` cancels it).
/// Mirrors `useLiveMatchScore`: skips fetches while backgrounded, keeps the last score on transient
/// errors, stops on 400/401/403/404 and once the match leaves live/scheduled.
@MainActor
@Observable
final class LiveScorePoller {
    private(set) var score: LiveScore?
    private let app: AppContainer
    private let match: MatchListItem
    static let interval: Duration = .seconds(60)

    init(app: AppContainer, match: MatchListItem) {
        self.app = app
        self.match = match
    }

    /// Current best-known score: polled value, else the match's own result.
    var displayed: LiveScore? {
        if let score { return score }
        if let result = match.result {
            return LiveScore(status: match.status, homeScore: result.homeScore, awayScore: result.awayScore)
        }
        return nil
    }

    func run() async {
        guard let token = app.token, match.externalId != nil, match.status == .live else { return }
        while !Task.isCancelled {
            var shouldPoll = true
            if UIApplication.shared.applicationState == .active {
                do {
                    let data: LiveScoreResponse = try await app.api.request(
                        "/api/mobile/matches/\(match.id)/live", token: token
                    )
                    if Task.isCancelled { return }
                    if let home = data.homeScore, let away = data.awayScore {
                        score = LiveScore(status: data.status, homeScore: home, awayScore: away)
                    }
                    shouldPoll = data.status == .live || data.status == .scheduled
                } catch {
                    if isCancellation(error) { return }
                    if let api = error as? ApiError, [400, 401, 403, 404].contains(api.status) {
                        shouldPoll = false
                    }
                }
            }
            guard shouldPoll else { return }
            try? await Task.sleep(for: Self.interval)
        }
    }
}
