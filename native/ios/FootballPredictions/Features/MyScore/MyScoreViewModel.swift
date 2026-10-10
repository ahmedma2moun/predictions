import Foundation
import Observation

@MainActor
@Observable
final class MyScoreViewModel {
    static let pageSize = 20

    private let app: AppContainer
    private let predictionsRemote = RemoteData<[PredictionHistoryItem]>()
    private let statsRemote = RemoteData<AccuracyStats>()
    var weekOffset = 0 { didSet { visibleCount = Self.pageSize } }
    var visibleCount = MyScoreViewModel.pageSize

    init(app: AppContainer) { self.app = app }

    var predictions: [PredictionHistoryItem] { predictionsRemote.data ?? [] }
    var stats: AccuracyStats? { statsRemote.data }
    var isLoading: Bool { predictionsRemote.isLoading }
    var error: String? { predictionsRemote.error }

    var totalPoints: Int { predictions.reduce(0) { $0 + $1.pointsAwarded } }
    var weekLabel: String { computeWeekLabel(offset: weekOffset) }

    private var weekPredictions: [PredictionHistoryItem] {
        let bounds = getWeekBounds(offset: weekOffset)
        return predictions.filter { p in
            guard p.match.result != nil else { return false }
            let t = p.match.kickoffDate
            return t >= bounds.from && t < bounds.to
        }
    }

    /// Scored predictions in the selected week, newest first.
    var sorted: [PredictionHistoryItem] { weekPredictions.sorted { $0.match.kickoffDate > $1.match.kickoffDate } }
    var weekPoints: Int { weekPredictions.reduce(0) { $0 + $1.pointsAwarded } }
    var page: [PredictionHistoryItem] { Array(sorted.prefix(visibleCount)) }
    var remainingCount: Int { max(0, sorted.count - visibleCount) }

    /// Last 10 scored predictions across all time, oldest first (sparkline).
    var recentPoints: [Int] {
        predictions.filter { $0.match.result != nil }
            .sorted { $0.match.kickoffDate > $1.match.kickoffDate }
            .prefix(10).reversed().map(\.pointsAwarded)
    }

    func load() async {
        async let a: Void = loadPredictions(isRefresh: false)
        async let b: Void = loadStats(isRefresh: false)
        _ = await (a, b)
    }

    func refresh() async {
        async let a: Void = loadPredictions(isRefresh: true)
        async let b: Void = loadStats(isRefresh: true)
        _ = await (a, b)
    }

    func showMore() { visibleCount += Self.pageSize }

    private func loadPredictions(isRefresh: Bool) async {
        guard let token = app.token else { return }
        await predictionsRemote.run(isRefresh: isRefresh) {
            try await app.api.request("/api/mobile/predictions", token: token)
        }
    }

    private func loadStats(isRefresh: Bool) async {
        guard let token = app.token else { return }
        await statsRemote.run(isRefresh: isRefresh) {
            try await app.api.request("/api/mobile/predictions/stats", token: token)
        }
    }
}
