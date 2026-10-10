import Foundation
import Observation

enum Period: String, CaseIterable, Sendable {
    case week, month, all

    var label: String {
        switch self {
        case .week: return "Week"
        case .month: return "Month"
        case .all: return "All Time"
        }
    }
}

@MainActor
@Observable
final class LeaderboardViewModel {
    private let app: AppContainer
    private let entriesRemote = RemoteData<[LeaderboardEntry]>()
    private var expandedCache: [String: [LeaderboardUserPrediction]] = [:]
    private var expandedCacheOrder: [String] = []

    var period: Period = .all
    var weekOffset = 0
    var monthOffset = 0

    private(set) var groups: [LeaderboardGroup] = []
    var groupId: String?
    private(set) var groupsReady = false

    private(set) var leagues: [LeaderboardLeague] = []
    var selectedLeagues: [String] = []
    var leagueDropdownOpen = false

    private(set) var expandedUserId: String?
    private(set) var expandedLoading = false
    private(set) var expandedData: [LeaderboardUserPrediction]?

    private(set) var championTeamByUser: [String: String] = [:]
    private(set) var offSeason = false

    init(app: AppContainer) { self.app = app }

    // MARK: Derived

    var myId: String? { app.auth.user?.id }
    var entries: [LeaderboardEntry] { entriesRemote.data ?? [] }
    var isLoading: Bool { entriesRemote.isLoading || !groupsReady }
    var isRefreshing: Bool { entriesRemote.isRefreshing }
    var error: String? { entriesRemote.error }

    var weekLabel: String { computeWeekLabel(offset: weekOffset) }
    var monthLabel: String { computeMonthLabel(offset: monthOffset) }

    var dateRange: DateBounds? {
        switch period {
        case .week: return getWeekBounds(offset: weekOffset)
        case .month: return getMonthBounds(offset: monthOffset)
        case .all: return nil
        }
    }

    var isCurrentPeriod: Bool { dateRange.map { $0.to > Date() } ?? true }

    var subtitle: String? {
        guard !entries.isEmpty else { return nil }
        let players = "\(entries.count) player\(entries.count != 1 ? "s" : "")"
        if let name = groups.first(where: { $0.id == groupId })?.name { return "\(name) · \(players)" }
        return players
    }

    /// Identity of the current query; the screen re-fetches (and collapses any expanded row) when it changes.
    struct QueryKey: Equatable {
        let ready: Bool
        let period: Period
        let weekOffset: Int
        let monthOffset: Int
        let groupId: String?
        let leagues: [String]
    }

    var queryKey: QueryKey {
        QueryKey(ready: groupsReady, period: period, weekOffset: weekOffset, monthOffset: monthOffset,
                 groupId: groupId, leagues: selectedLeagues)
    }

    // MARK: Loading

    /// Groups, leagues, champion picks and season status (fire-once).
    func loadStatic() async {
        guard let token = app.token else { return }
        async let groupsTask: Void = loadGroups(token)
        async let leaguesTask: Void = loadLeagues(token)
        async let championTask: Void = loadChampion(token)
        async let seasonsTask: Void = loadSeasons(token)
        _ = await (groupsTask, leaguesTask, championTask, seasonsTask)
    }

    private func loadGroups(_ token: String) async {
        if let data: [LeaderboardGroup] = try? await app.api.request("/api/mobile/groups", token: token) {
            groups = data.filter { !$0.isDefault } + data.filter(\.isDefault)
            groupId = groups.first?.id
        }
        groupsReady = true
    }

    private func loadLeagues(_ token: String) async {
        leagues = (try? await app.api.request("/api/mobile/leagues", token: token)) ?? []
    }

    private func loadChampion(_ token: String) async {
        if let state: ChampionBonusState = try? await app.api.request("/api/mobile/champion-bonus", token: token),
           case .locked(let locked) = state {
            championTeamByUser = Dictionary(locked.picks.map { ($0.userId, $0.teamName) }, uniquingKeysWith: { first, _ in first })
        }
    }

    private func loadSeasons(_ token: String) async {
        if let seasons: [Season] = try? await app.api.request("/api/mobile/seasons", token: token) {
            offSeason = !seasons.contains { $0.status == "ACTIVE" }
        }
    }

    func loadEntries() async {
        collapse()
        guard groupsReady else { return }
        await entriesRemote.run { try await fetchEntries() }
    }

    func refresh() async {
        guard groupsReady else { return }
        await entriesRemote.run(isRefresh: true) { try await fetchEntries() }
    }

    private func rangeQuery() -> String {
        guard let range = dateRange else { return "" }
        return "&from=\(encode(isoString(range.from)))&to=\(encode(isoString(range.to)))"
    }

    private func encode(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? s
    }

    private func fetchEntries() async throws -> [LeaderboardEntry] {
        guard let token = app.token else { return [] }
        var url = "/api/mobile/leaderboard?_=1" + rangeQuery()
        if let groupId { url += "&groupId=\(encode(groupId))" }
        for id in selectedLeagues { url += "&leagueId=\(encode(id))" }
        return try await app.api.request(url, token: token)
    }

    // MARK: Expansion

    private func collapse() {
        expandedUserId = nil
        expandedData = nil
    }

    func toggleExpand(_ userId: String) async {
        if expandedUserId == userId { collapse(); return }
        guard let token = app.token else { return }

        let range = dateRange
        let key = [
            userId,
            range.map { isoString($0.from) } ?? "",
            range.map { isoString($0.to) } ?? "",
            selectedLeagues.sorted().joined(separator: ","),
        ].joined(separator: ":")

        expandedUserId = userId
        if let cached = expandedCache[key] {
            expandedData = cached
            return
        }
        expandedLoading = true
        expandedData = nil

        var url = "/api/mobile/leaderboard/user-predictions?userId=\(encode(userId))" + rangeQuery()
        for id in selectedLeagues { url += "&leagueId=\(encode(id))" }

        do {
            let data: [LeaderboardUserPrediction] = try await app.api.request(url, token: token)
            if expandedCacheOrder.count >= 20, let oldest = expandedCacheOrder.first {
                expandedCache.removeValue(forKey: oldest)
                expandedCacheOrder.removeFirst()
            }
            expandedCache[key] = data
            expandedCacheOrder.append(key)
            if expandedUserId == userId { expandedData = data }
        } catch {
            if expandedUserId == userId { expandedData = [] }
        }
        expandedLoading = false
    }
}
