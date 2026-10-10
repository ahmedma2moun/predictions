import Foundation
import Observation

struct MatchSection: Identifiable, Equatable {
    let id: String   // local calendar-day key
    let title: String
    var matches: [MatchListItem]
}

@MainActor
@Observable
final class MatchesViewModel {
    private let app: AppContainer
    private let remote = RemoteData<[MatchListItem]>()
    private var hasAppeared = false

    init(app: AppContainer) { self.app = app }

    var matches: [MatchListItem] { remote.data ?? [] }
    var isLoading: Bool { remote.isLoading }
    var error: String? { remote.error }

    var openCount: Int {
        matches.filter { !isMatchLocked($0.kickoffDate) && $0.status == .scheduled }.count
    }

    var subtitle: String? {
        guard !matches.isEmpty else { return nil }
        return "\(matches.count) fixture\(matches.count != 1 ? "s" : "") · \(openCount) still open"
    }

    /// Matches arrive sorted by kickoff ascending, so grouping consecutively preserves order.
    var sections: [MatchSection] {
        var result: [MatchSection] = []
        for match in matches {
            let key = getMatchDayKey(match.kickoffDate)
            if let last = result.last, last.id == key {
                result[result.count - 1].matches.append(match)
            } else {
                result.append(MatchSection(id: key, title: formatMatchDayHeader(match.kickoffDate), matches: [match]))
            }
        }
        return result
    }

    func load() async {
        await remote.run { try await fetch() }
    }

    func refresh() async {
        await remote.run(isRefresh: true) { try await fetch() }
    }

    /// First appearance loads; every later appearance refetches (RN `useFocusEffect`).
    func onAppear() async {
        if hasAppeared {
            await refresh()
        } else {
            hasAppeared = true
            await load()
        }
    }

    private func fetch() async throws -> [MatchListItem] {
        guard let token = app.token else { return [] }
        async let scheduled: [MatchListItem] = app.api.request("/api/mobile/matches?status=scheduled", token: token)
        async let live: [MatchListItem] = app.api.request("/api/mobile/matches?status=live", token: token)
        let all = try await live + scheduled
        return all.sorted { $0.kickoffDate < $1.kickoffDate }
    }
}
