import Foundation
import Observation

enum ClubSection: String, CaseIterable {
    case week, feed, rival, rewards, recap

    var label: String {
        switch self {
        case .week: return "Weekly cup"
        case .feed: return "Activity"
        case .rival: return "My rival"
        case .rewards: return "Challenges"
        case .recap: return "My recap"
        }
    }
}

@MainActor
@Observable
final class ClubViewModel {
    private let app: AppContainer
    private let remote = RemoteData<GameHub>()

    var groupId: Int? { didSet { weekKey = "" } }
    var seasonId: Int? { didSet { weekKey = "" } }
    var weekKey = ""
    var section: ClubSection = .week
    private(set) var busy = false
    var notice = ""

    init(app: AppContainer) { self.app = app }

    var hub: GameHub? { remote.data }
    var isLoading: Bool { remote.isLoading }
    var isRefreshing: Bool { remote.isRefreshing }
    var error: String? { remote.error }

    struct QueryKey: Equatable { let groupId: Int?; let seasonId: Int? }
    var queryKey: QueryKey { QueryKey(groupId: groupId, seasonId: seasonId) }

    var selectedWeek: WeekCompetition? {
        guard let hub else { return nil }
        return hub.weeks.first { $0.key == weekKey } ?? hub.weeks.first { $0.key == hub.currentWeekKey } ?? hub.weeks.first
    }

    private var query: String {
        var parts: [String] = []
        if let groupId { parts.append("groupId=\(groupId)") }
        if let seasonId { parts.append("seasonId=\(seasonId)") }
        return parts.joined(separator: "&")
    }

    func load() async {
        guard let token = app.token else { return }
        let q = query
        await remote.run { try await app.api.request("/api/mobile/game?\(q)", token: token) }
    }

    func refresh() async {
        guard let token = app.token else { return }
        let q = query
        await remote.run(isRefresh: true) { try await app.api.request("/api/mobile/game?\(q)", token: token) }
    }

    func act(_ action: GameActionRequest.Action) async {
        guard let token = app.token, let hub, !busy else { return }
        busy = true
        notice = ""
        do {
            try await app.api.send(
                "/api/mobile/game", method: .post,
                body: GameActionRequest(action: action, groupId: hub.groupId, seasonId: hub.seasonId),
                token: token
            )
            await refresh()
        } catch {
            notice = userMessage(for: error, fallback: "Please try again")
        }
        busy = false
    }

    func winnerNames(_ week: WeekCompetition) -> String {
        week.standings.filter { week.winnerIds.contains($0.userId) }.map(\.name).joined(separator: " & ")
    }
}
