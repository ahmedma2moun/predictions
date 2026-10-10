import Observation
import OSLog
import SwiftUI

private let groupLog = Logger(subsystem: "com.maamoun.footballpredictions", category: "group-comparison")

private struct GroupComparisonPayload: Sendable {
    let predictions: [GroupPredictionEntry]?
    let standing: LiveGroupStanding?
}

@MainActor
@Observable
final class GroupComparisonViewModel {
    private let app: AppContainer
    private let matchId: String
    private let groupsRemote = RemoteData<[LeaderboardGroup]>()
    private let comparison = RemoteData<GroupComparisonPayload>()
    var selectedGroupId: String?

    init(app: AppContainer, matchId: String) {
        self.app = app
        self.matchId = matchId
    }

    /// Default group first, then by name (this card's own ordering).
    var groups: [LeaderboardGroup] {
        (groupsRemote.data ?? []).sorted {
            if $0.isDefault != $1.isDefault { return $0.isDefault }
            return $0.name.localizedCompare($1.name) == .orderedAscending
        }
    }
    var isLoading: Bool { comparison.isLoading }
    fileprivate var predictions: [GroupPredictionEntry] { (comparison.data?.predictions ?? []).filter(\.predicted) }
    fileprivate var standing: LiveGroupStanding? { comparison.data?.standing }

    func loadGroups() async {
        guard let token = app.token else { return }
        await groupsRemote.run {
            do {
                return try await app.api.request("/api/mobile/groups", token: token)
            } catch {
                if !isCancellation(error) { groupLog.error("groups request failed: \(String(describing: error), privacy: .public)") }
                throw error
            }
        }
        if selectedGroupId == nil { selectedGroupId = groups.first?.id }
    }

    func loadComparison(hasResult: Bool, liveScore: ScorePair?) async {
        guard let token = app.token, let groupId = selectedGroupId else { return }
        let matchId = matchId
        await comparison.run {
            let encodedGroup = groupId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? groupId
            let query: String = {
                if !hasResult, let liveScore {
                    return "groupId=\(encodedGroup)&liveHomeScore=\(liveScore.home)&liveAwayScore=\(liveScore.away)"
                }
                return "groupId=\(encodedGroup)"
            }()
            async let predictions: [GroupPredictionEntry]? = Self.orNil("group-predictions") {
                try await app.api.request("/api/mobile/matches/\(matchId)/group-predictions?\(query)", token: token)
            }
            async let standing: LiveGroupStanding? = Self.orNil("leaderboard/live") {
                try await app.api.request("/api/mobile/leaderboard/live?groupId=\(encodedGroup)", token: token)
            }
            return GroupComparisonPayload(predictions: await predictions, standing: await standing)
        }
    }

    /// A failed side request just leaves that part of the card empty — but is logged, not swallowed.
    private static func orNil<T: Sendable>(_ what: String, _ call: () async throws -> T) async -> T? {
        do { return try await call() } catch {
            if !isCancellation(error) { groupLog.error("\(what, privacy: .public) request failed: \(String(describing: error), privacy: .public)") }
            return nil
        }
    }

    fileprivate func standingEntry(for userId: String) -> LiveStandingEntry? {
        standing?.standings.first { $0.userId == userId }
    }

    fileprivate var sortedPredictions: [GroupPredictionEntry] {
        guard standing != nil else { return predictions }
        return predictions.sorted {
            (standingEntry(for: $0.userId)?.rank ?? .max) < (standingEntry(for: $1.userId)?.rank ?? .max)
        }
    }
}

/// Per-group live standing + this match's predictions, side by side.
struct GroupComparisonCard: View {
    @Environment(\.palette) private var c
    @State private var vm: GroupComparisonViewModel
    let isAdmin: Bool
    let locked: Bool
    let hasResult: Bool
    let isKnockout: Bool
    let liveScore: ScorePair?

    init(app: AppContainer, matchId: String, isAdmin: Bool, locked: Bool, hasResult: Bool, isKnockout: Bool, liveScore: ScorePair?) {
        _vm = State(initialValue: GroupComparisonViewModel(app: app, matchId: matchId))
        self.isAdmin = isAdmin
        self.locked = locked
        self.hasResult = hasResult
        self.isKnockout = isKnockout
        self.liveScore = liveScore
    }

    private var visible: Bool { locked || isAdmin }

    private struct LoadKey: Equatable {
        let groupId: String?
        let hasResult: Bool
        let liveScore: ScorePair?
    }

    var body: some View {
        VStack(spacing: 0) {
            if visible && !vm.groups.isEmpty { card }
            // The load tasks need a view that always exists: SwiftUI never runs `.task` on an empty view, and
            // the card itself stays hidden until the groups it would load have arrived.
            Color.clear.frame(height: 0)
                .task(id: visible) { if visible { await vm.loadGroups() } }
                .task(id: LoadKey(groupId: vm.selectedGroupId, hasResult: hasResult, liveScore: liveScore)) {
                    if visible { await vm.loadComparison(hasResult: hasResult, liveScore: liveScore) }
                }
        }
    }

    private var card: some View {
        Card(spacing: Tokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                SectionTitle("Group Comparison")
                if vm.groups.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Tokens.Spacing.xs) {
                            ForEach(vm.groups) { group in
                                let selected = vm.selectedGroupId == group.id
                                Button { vm.selectedGroupId = group.id } label: {
                                    Text(group.name)
                                        .appFont(Tokens.FontSize.xs, .medium)
                                        .foregroundStyle(selected ? c.primaryForeground : c.mutedForeground)
                                        .padding(.horizontal, Tokens.Spacing.md)
                                        .padding(.vertical, Tokens.Spacing.xs)
                                        .background(selected ? c.primary : .clear, in: Capsule())
                                        .overlay(Capsule().stroke(selected ? c.primary : c.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            if vm.isLoading {
                ProgressView().tint(c.primary).frame(maxWidth: .infinity).padding(.vertical, Tokens.Spacing.sm)
            } else if vm.predictions.isEmpty {
                Muted("No predictions in this group.").frame(maxWidth: .infinity).padding(.vertical, Tokens.Spacing.md)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(vm.sortedPredictions.enumerated()), id: \.element.userId) { index, p in
                        row(p, first: index == 0)
                    }
                }
            }
        }
    }

    private func row(_ p: GroupPredictionEntry, first: Bool) -> some View {
        let s = vm.standingEntry(for: p.userId)
        let points = p.pointsAwarded ?? 0
        return HStack {
            HStack(spacing: 6) {
                if let s {
                    Text("#\(s.rank)").appFont(Tokens.FontSize.xs, .bold, mono: true).foregroundStyle(c.mutedForeground).frame(width: 24, alignment: .leading)
                    StandingMovement(entry: s).frame(width: 26)
                }
                Text(p.userName ?? "Unknown").appFont(Tokens.FontSize.sm, .medium).foregroundStyle(c.foreground).lineLimit(1)
            }
            Spacer(minLength: 4)
            HStack(spacing: Tokens.Spacing.sm) {
                Text("\(p.homeScore.map(String.init) ?? "") – \(p.awayScore.map(String.init) ?? "")")
                    .appFont(Tokens.FontSize.sm, mono: true).foregroundStyle(c.foreground)
                if p.isLive {
                    Text(points > 0 ? "+\(points) live" : "0 live")
                        .appFont(Tokens.FontSize.xs, .semibold).foregroundStyle(c.live)
                }
                if !isKnockout && !p.isLive && hasResult {
                    Text(points > 0 ? "+\(points)" : "0")
                        .appFont(Tokens.FontSize.xs, .semibold)
                        .foregroundStyle(points > 0 ? c.warning : c.mutedForeground)
                }
                if let s {
                    Text("\(s.liveTotalPoints) pts").appFont(Tokens.FontSize.sm, .bold, mono: true).foregroundStyle(c.foreground)
                }
            }
        }
        .padding(.vertical, Tokens.Spacing.sm)
        .overlay(alignment: .top) {
            if !first { Rectangle().fill(c.border).frame(height: hairline) }
        }
    }
}

private struct StandingMovement: View {
    @Environment(\.palette) private var c
    let entry: LiveStandingEntry

    var body: some View {
        switch entry.movement {
        case .up:
            HStack(spacing: 0) {
                Image(systemName: AppIcon.arrowUp).font(.system(size: 10, weight: .bold))
                Text("\(entry.previousRank - entry.rank)").appFont(10, .bold, mono: true)
            }.foregroundStyle(c.success)
        case .down:
            HStack(spacing: 0) {
                Image(systemName: AppIcon.arrowDown).font(.system(size: 10, weight: .bold))
                Text("\(entry.rank - entry.previousRank)").appFont(10, .bold, mono: true)
            }.foregroundStyle(c.destructive)
        case .same:
            Image(systemName: AppIcon.remove).font(.system(size: 10)).foregroundStyle(c.mutedForeground)
        }
    }
}
