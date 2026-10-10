import Foundation
import Observation

struct SlipDraft: Equatable {
    var home: String
    var away: String
}

@MainActor
@Observable
final class SlipViewModel {
    private let app: AppContainer
    private let remote = RemoteData<SlipData>()

    var drafts: [Int: SlipDraft] = [:]
    private(set) var errors: [Int: String] = [:]
    private(set) var busy = false
    private(set) var notice = ""
    var missingOnly = false
    private(set) var now = Date()

    init(app: AppContainer) { self.app = app }

    var data: SlipData? { remote.data }
    var isLoading: Bool { remote.isLoading }
    var error: String? { remote.error }

    func isLocked(_ m: SlipMatch) -> Bool { m.locked || m.kickoffDate <= now }

    var remaining: Int {
        data?.matches.filter { !isLocked($0) && $0.homeScore == nil }.count ?? 0
    }

    var visibleMatches: [SlipMatch] {
        (data?.matches ?? []).filter { !missingOnly || (!isLocked($0) && $0.homeScore == nil) }
    }

    var canSave: Bool { data?.matches.contains { drafts[$0.id] != nil && !isLocked($0) } ?? false }

    func draft(for m: SlipMatch) -> SlipDraft {
        drafts[m.id] ?? SlipDraft(home: m.homeScore.map(String.init) ?? "", away: m.awayScore.map(String.init) ?? "")
    }

    func edit(_ m: SlipMatch, home: String? = nil, away: String? = nil) {
        var d = draft(for: m)
        if let home { d.home = String(home.filter(\.isNumber).prefix(2)) }
        if let away { d.away = String(away.filter(\.isNumber).prefix(2)) }
        drafts[m.id] = d
    }

    func status(for m: SlipMatch) -> String {
        if isLocked(m) { return "Locked" }
        if drafts[m.id] != nil { return "Unsaved" }
        return m.homeScore == nil ? "Open" : "✓ Saved"
    }

    func load() async {
        guard let token = app.token else { return }
        await remote.run { try await app.api.request("/api/mobile/predictions/slip", token: token) }
    }

    /// Keeps lock state accurate while the screen is open (1 s tick, cancelled with the view).
    func tick() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1))
            now = Date()
        }
    }

    private func isValidScore(_ s: String) -> Bool {
        (1...2).contains(s.count) && s.allSatisfy(\.isASCII) && s.allSatisfy(\.isNumber)
    }

    func save() async {
        guard let data, !busy, let token = app.token else { return }
        let pending = data.matches.filter { drafts[$0.id] != nil && !isLocked($0) }
        guard !pending.isEmpty else { return }

        var invalid: [Int: String] = [:]
        for m in pending {
            let d = drafts[m.id]!
            if !isValidScore(d.home) || !isValidScore(d.away) { invalid[m.id] = "Enter both scores, from 0 to 99." }
        }
        errors = invalid
        if !invalid.isEmpty {
            notice = "Check your scores. Nothing has been saved."
            return
        }

        busy = true
        notice = ""
        var results: [SlipResult] = []
        do {
            var index = 0
            while index < pending.count {
                let chunk = pending[index..<min(index + 50, pending.count)]
                let body = SlipSaveRequest(predictions: chunk.map {
                    SlipPredictionInput(matchId: $0.id, homeScore: Int(drafts[$0.id]!.home)!, awayScore: Int(drafts[$0.id]!.away)!)
                })
                let response: SlipSaveResponse = try await app.api.request(
                    "/api/mobile/predictions/slip", method: .post, body: body, token: token)
                results.append(contentsOf: response.results)
                index += 50
            }
            let failed = results.contains { !$0.saved }
            notice = "\(results.filter(\.saved).count) predictions saved.\(failed ? " Check the matches that could not be saved." : "")"
        } catch {
            notice = "\(userMessage(for: error, fallback: "Save failed")). Unsaved entries are still here; retry to confirm them."
        }
        let saved = Set(results.filter(\.saved).map(\.matchId))
        drafts = drafts.filter { !saved.contains($0.key) }
        errors = Dictionary(uniqueKeysWithValues: results.filter { !$0.saved }.map { ($0.matchId, $0.error ?? "Try again") })
        busy = false
        await load()
    }
}
