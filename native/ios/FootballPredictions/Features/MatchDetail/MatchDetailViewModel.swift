import Foundation
import Observation

struct ScorePair: Equatable, Sendable {
    let home: Int
    let away: Int
}

struct MatchDetailPayload: Sendable {
    let match: MatchDetail
    let form: MatchForm?
}

@MainActor
@Observable
final class MatchDetailViewModel {
    let matchId: String
    private let app: AppContainer
    private let tab: AppTab
    private let remote = RemoteData<MatchDetailPayload>()

    var home = 0
    var away = 0
    private(set) var saving = false
    private(set) var saveCount = 0
    private(set) var liveScore: ScorePair?
    private(set) var matchEvents: [MatchEvent]?

    init(app: AppContainer, matchId: String, tab: AppTab) {
        self.app = app
        self.matchId = matchId
        self.tab = tab
    }

    var match: MatchDetail? { remote.data?.match }
    var form: MatchForm? { remote.data?.form }
    var isLoading: Bool { remote.isLoading }
    var error: String? { remote.error }

    var locked: Bool { match.map { isMatchLocked($0.kickoffDate) } ?? false }
    var knockout: Bool { isKnockoutStage(match?.stage) }
    var canPredict: Bool { match.map { !$0.isAdmin && !locked } ?? false }

    var winnerLabel: String {
        guard let match else { return "Draw" }
        return home > away ? match.homeTeam.name : (away > home ? match.awayTeam.name : "Draw")
    }

    var matchdayTitle: String {
        guard let match else { return "" }
        let suffix = match.leagueName.map { " · \($0.uppercased())" } ?? ""
        if knockout, let stage = match.stage {
            return "\(formatStage(stage))\(match.leg.map { " · Leg \($0)" } ?? "")\(suffix)"
        }
        if let matchday = match.matchday { return "MD \(matchday)\(suffix)" }
        return match.leagueName?.uppercased() ?? formatMatchStatus(match.status).uppercased()
    }

    func load() async {
        guard let token = app.token else { return }
        let id = matchId
        await remote.run {
            async let detail: MatchDetail = app.api.request("/api/mobile/matches/\(id)", token: token)
            async let form: MatchForm? = try? await app.api.request("/api/mobile/matches/\(id)/form", token: token)
            return MatchDetailPayload(match: try await detail, form: await form)
        }
        if let prediction = match?.prediction {
            home = prediction.homeScore
            away = prediction.awayScore
        }
    }

    /// Live score + events: only for locked matches with an external id. Re-polls every 60 s while
    /// the match is `live`; any error ends polling (live data is best-effort).
    func pollLive() async {
        guard let token = app.token, let match, match.externalId != nil, locked else { return }
        while !Task.isCancelled {
            do {
                let live: LiveScoreResponse = try await app.api.request(
                    "/api/mobile/matches/\(matchId)/live", token: token
                )
                if Task.isCancelled { return }
                if let h = live.homeScore, let a = live.awayScore { liveScore = ScorePair(home: h, away: a) }
                if let events = live.events, !events.isEmpty { matchEvents = events }
                guard live.status == .live else { return }
            } catch {
                return
            }
            try? await Task.sleep(for: LiveScorePoller.interval)
        }
    }

    func submit() async {
        guard let token = app.token, let match else { return }
        saving = true
        defer { saving = false }
        do {
            try await app.api.send(
                "/api/mobile/predictions",
                method: .post,
                body: SavePredictionRequest(matchId: match.id, homeScore: home, awayScore: away),
                token: token
            )
            saveCount += 1
            app.alerts.show("Prediction saved")
            if let next = match.nextMatch {
                goToMatch(next.id)
            } else {
                pop()
            }
        } catch {
            let message = (error as? ApiError)?.message ?? "Failed to save prediction"
            app.alerts.show("Save failed", message: message)
        }
    }

    /// Replace (not push) so Back still returns to the matches list.
    func goToMatch(_ id: String) {
        app.router.replaceTop(with: .matchDetail(id), on: tab)
    }

    private func pop() {
        var path = app.router.path(for: tab)
        if !path.isEmpty { path.removeLast() }
        app.router.setPath(path, for: tab)
    }
}
