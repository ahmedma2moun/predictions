import Foundation
import Observation

/// Champion Bonus state, shared by the Champion screen and the My Score card
/// (the RN `useChampionBonus` hook).
@MainActor
@Observable
final class ChampionBonusViewModel {
    private let app: AppContainer
    private let remote = RemoteData<ChampionBonusState>()
    private(set) var picking: String?
    private(set) var pickError: String?

    init(app: AppContainer) { self.app = app }

    var state: ChampionBonusState? { remote.data }
    var isLoading: Bool { remote.isLoading }
    var isRefreshing: Bool { remote.isRefreshing }
    var error: String? { remote.error }

    func load() async {
        guard let token = app.token else { return }
        await remote.run { try await app.api.request("/api/mobile/champion-bonus", token: token) }
    }

    func refresh() async {
        guard let token = app.token else { return }
        await remote.run(isRefresh: true) { try await app.api.request("/api/mobile/champion-bonus", token: token) }
    }

    func pick(teamId: String) async {
        guard let token = app.token else { return }
        picking = teamId
        pickError = nil
        do {
            try await app.api.send(
                "/api/mobile/champion-bonus/pick",
                method: .post,
                body: PickChampionRequest(teamId: Int(teamId) ?? 0),
                token: token
            )
            await refresh()
        } catch {
            pickError = userMessage(for: error, fallback: "Failed to pick")
        }
        picking = nil
    }
}
