import Foundation
import Observation

@MainActor
@Observable
final class RemindersViewModel {
    private let app: AppContainer
    private let remote = RemoteData<RemindersData>()
    var selected: Set<Int> = []
    private(set) var notice = ""
    private(set) var saving = false

    init(app: AppContainer) { self.app = app }

    var data: RemindersData? { remote.data }
    var isLoading: Bool { remote.isLoading }
    var error: String? { remote.error }
    var noticeIsSuccess: Bool { notice.contains("saved") }
    var noticeText: String { notice }

    func load() async {
        guard let token = app.token else { return }
        await remote.run { try await app.api.request("/api/mobile/reminders", token: token) }
        syncSelection()
    }

    func refresh() async {
        guard let token = app.token else { return }
        await remote.run(isRefresh: true) { try await app.api.request("/api/mobile/reminders", token: token) }
        syncSelection()
    }

    private func syncSelection() {
        if let data { selected = Set(data.selections.flatMap { $0.teams.map(\.teamLeagueId) }) }
    }

    func setSelected(_ teamLeagueId: Int, _ on: Bool) {
        if on { selected.insert(teamLeagueId) } else { selected.remove(teamLeagueId) }
    }

    func save() async {
        guard let token = app.token else { return }
        if let invalid = data?.leagues.first(where: { $0.teams.filter { selected.contains($0.teamLeagueId) }.count == 1 }) {
            notice = "Select at least two teams in \(invalid.name)"
            return
        }
        saving = true
        notice = ""
        do {
            try await app.api.send(
                "/api/mobile/reminders", method: .put,
                body: ReminderSelectionsRequest(selections: Array(selected).sorted()), token: token)
            notice = "Reminder preferences saved"
        } catch {
            notice = userMessage(for: error, fallback: "Could not save")
        }
        saving = false
    }
}
