import Foundation
import Observation

struct SeasonEntry: Equatable, Identifiable, Sendable {
    let userId: String
    let name: String
    let avatarUrl: String?
    let totalPoints: Int

    var id: String { userId }
}

struct EndedSeason: Equatable, Identifiable, Sendable {
    let season: Season
    let overallStandings: [SeasonEntry]

    var id: String { season.id }
}

struct SeasonsData: Sendable {
    let activeSeason: Season?
    let activeLeaderboard: [SeasonEntry]
    let endedSeasons: [EndedSeason]
}

@MainActor
@Observable
final class SeasonsViewModel {
    private let app: AppContainer
    private let remote = RemoteData<SeasonsData>()

    init(app: AppContainer) { self.app = app }

    var data: SeasonsData? { remote.data }
    var isLoading: Bool { remote.isLoading }

    var myId: String? { app.auth.user?.id }

    func load() async { await remote.run { try await fetch() } }
    func refresh() async { await remote.run(isRefresh: true) { try await fetch() } }

    private func fetch() async throws -> SeasonsData {
        guard let token = app.token else { return SeasonsData(activeSeason: nil, activeLeaderboard: [], endedSeasons: []) }
        let seasons: [Season] = try await app.api.request("/api/mobile/seasons", token: token)
        let active = seasons.first { $0.status == "ACTIVE" }
        let ended = seasons.filter { $0.status == "ENDED" }

        let leaderboard: [LeaderboardEntry] = active != nil
            ? try await app.api.request("/api/mobile/leaderboard?period=all", token: token)
            : []

        var details: [SeasonWithStandings] = []
        for season in ended {
            details.append(try await app.api.request("/api/mobile/seasons/\(season.id)", token: token))
        }

        return SeasonsData(
            activeSeason: active,
            activeLeaderboard: leaderboard.map {
                SeasonEntry(userId: $0.userId, name: $0.name, avatarUrl: $0.avatarUrl, totalPoints: $0.totalPoints)
            },
            endedSeasons: details.map { detail in
                EndedSeason(
                    season: Season(id: detail.id, name: detail.name, description: detail.description, status: detail.status,
                                   startDate: detail.startDate, startedAt: detail.startedAt, endedAt: detail.endedAt),
                    overallStandings: detail.standings
                        .filter { $0.groupId == nil }
                        .sorted { $0.rank < $1.rank }
                        .map { SeasonEntry(userId: $0.userId, name: $0.userName ?? "Unknown", avatarUrl: nil, totalPoints: $0.totalPoints) }
                )
            }
        )
    }
}
