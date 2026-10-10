import SwiftUI

struct ClubScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    let tab: AppTab
    @State private var vm: ClubViewModel

    init(app: AppContainer, tab: AppTab) {
        self.app = app
        self.tab = tab
        _vm = State(initialValue: ClubViewModel(app: app))
    }

    private var controlsDisabled: Bool { vm.busy || vm.isRefreshing }

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(app: app, title: "The Club", subtitle: "A fresh crown every week")
            if vm.isLoading && vm.hub == nil && vm.error == nil {
                CenteredSpinner()
            } else {
                content
            }
        }
        .background(c.background)
        .task(id: vm.queryKey) { await vm.load() }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tokens.Spacing.lg) {
                AppButton(title: "Make your picks →", fullWidth: true) { app.router.push(.slip, on: tab) }
                if let error = vm.error { ErrorCard(message: error) { Task { await vm.refresh() } } }
                if !vm.notice.isEmpty {
                    Text(vm.notice).appFont(Tokens.FontSize.md).foregroundStyle(c.destructive)
                        .accessibilityAddTraits(.updatesFrequently)
                }
                if let hub = vm.hub { body(hub) }
            }
            .padding(Tokens.Spacing.lg)
        }
        .refreshable { await vm.refresh() }
    }

    @ViewBuilder private func body(_ hub: GameHub) -> some View {
        Muted("Group")
        chipRow(hub.groups.map { ($0.id, $0.name) }, selected: hub.groupId) { vm.groupId = $0 }
        Muted("Season")
        chipRow(hub.seasons.map { ($0.id, $0.name) }, selected: hub.seasonId) { vm.seasonId = $0 }
        if hub.seasonId == nil { Muted("Your club opens when the first season starts.") }
        if hub.groupId == nil { Muted("Ask an admin to add you to a group for weekly crowns and activity.") }

        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Tokens.Spacing.sm) {
                ForEach(ClubSection.allCases, id: \.self) { section in
                    AppButton(title: section.label, variant: vm.section == section ? .primary : .outline) { vm.section = section }
                }
            }
        }
        switch vm.section {
        case .week: weekSection(hub)
        case .feed: feedSection(hub)
        case .rival: rivalSection(hub)
        case .rewards: rewardsSection(hub)
        case .recap: recapSection(hub)
        }
    }

    private func chipRow(_ items: [(Int, String)], selected: Int?, onSelect: @escaping (Int) -> Void) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Tokens.Spacing.sm) {
                ForEach(items, id: \.0) { item in
                    AppButton(title: item.1, variant: selected == item.0 ? .primary : .outline) { onSelect(item.0) }
                        .disabled(controlsDisabled)
                }
            }
        }
    }

    // MARK: Weekly cup

    @ViewBuilder private func weekSection(_ hub: GameHub) -> some View {
        Card(spacing: 14) {
            Heading("The weekly cup")
            Muted("Friday–Thursday, Cairo time. Prediction points only; exact scores break ties. Equal leaders share the crown.")
            if let week = vm.selectedWeek {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Tokens.Spacing.sm) {
                        ForEach(hub.weeks) { w in
                            AppButton(title: w.key + (w.winnerIds.isEmpty ? "" : " 🏆"), variant: week.key == w.key ? .primary : .outline) {
                                vm.weekKey = w.key
                            }
                        }
                    }
                }
                Heading(!week.winnerIds.isEmpty ? "🏆 \(vm.winnerNames(week))"
                        : week.state == "awaiting_results" ? "Waiting for final results"
                        : week.state == "complete" ? "No crown this week" : "The crown is still up for grabs")
                Muted("\(week.matchCount) matches · \(week.state == "complete" ? "Completed" : "Provisional")")
                ForEach(week.standings) { p in
                    HStack(spacing: Tokens.Spacing.md) {
                        Text("\(p.rank)").appFont(Tokens.FontSize.md).foregroundStyle(c.primary).frame(width: 24, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name + (p.userId == hub.userId ? " (you)" : ""))
                                .appFont(Tokens.FontSize.md, .semibold).foregroundStyle(c.foreground)
                            if let title = p.title { Text(title).appFont(12).foregroundStyle(c.primary) }
                            Muted("\(p.exact) exact scores")
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Heading("\(p.points)")
                    }
                    .padding(.vertical, 10)
                    .overlay(alignment: .bottom) { Rectangle().fill(c.border).frame(height: 1) }
                }
                Heading("Previous winners")
                if !hub.weeks.contains(where: { !$0.winnerIds.isEmpty }) { Muted("The first crown is waiting to be won.") }
                ForEach(hub.weeks.filter { !$0.winnerIds.isEmpty }) { w in
                    AppButton(title: "🏆 \(w.key) · \(vm.winnerNames(w))", variant: .outline) { vm.weekKey = w.key }
                }
            } else {
                Muted("No group competition yet.")
            }
        }
    }

    // MARK: Activity

    @ViewBuilder private func feedSection(_ hub: GameHub) -> some View {
        Heading("Around the group")
        Muted("Exact scores, prediction-points lead changes, and weekly winners. Picks appear only after scoring.")
        if hub.feed.isEmpty { Muted("The story starts with your first scored match.") }
        ForEach(hub.feed) { e in
            Card(spacing: 12) {
                Text(e.text).appFont(16).foregroundStyle(c.foreground)
                Muted(formatCairoDate(e.atDate))
                if let matchId = e.matchId {
                    AppButton(title: "View match", variant: .ghost) { app.router.push(.matchDetail(String(matchId)), on: tab) }
                }
                HStack(spacing: Tokens.Spacing.sm) {
                    ForEach(e.reactions) { r in
                        AppButton(title: "\(r.emoji) \(r.count > 0 ? String(r.count) : "")", variant: r.mine ? .primary : .outline) {
                            Task { await vm.act(.reaction(eventKey: e.key, emoji: r.mine ? nil : r.emoji)) }
                        }
                        .disabled(controlsDisabled)
                        .accessibilityLabel("React \(r.emoji), \(r.count) reactions")
                        .accessibilityAddTraits(r.mine ? .isSelected : [])
                    }
                }
            }
        }
    }

    // MARK: Rival

    @ViewBuilder private func rivalSection(_ hub: GameHub) -> some View {
        Card(spacing: 14) {
            Heading("Make it personal")
            Muted("Choose a friend from this group. Match wins compare scored games you both predicted this season.")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Tokens.Spacing.sm) {
                    AppButton(title: "No rival", variant: .outline) { Task { await vm.act(.rival(rivalId: nil)) } }
                        .disabled(controlsDisabled)
                    ForEach(hub.players.filter { $0.id != hub.userId }) { p in
                        AppButton(title: p.name, variant: hub.rival?.userId == p.id ? .primary : .outline) {
                            Task { await vm.act(.rival(rivalId: p.id)) }
                        }
                        .disabled(controlsDisabled)
                    }
                }
            }
            if let rival = hub.rival {
                Heading(rival.gap == 0 ? "All square" : "\(abs(rival.gap)) points \(rival.gap > 0 ? "ahead" : "behind")")
                Text("You: \(rival.myPoints) points · \(formatNumber(rival.myAccuracy))% correct outcomes").foregroundStyle(c.foreground)
                Text("\(rival.name): \(rival.theirPoints) points · \(formatNumber(rival.theirAccuracy))% correct outcomes").foregroundStyle(c.foreground)
                Muted("\(rival.wins) wins · \(rival.losses) losses · \(rival.draws) draws")
            }
        }
    }

    // MARK: Challenges

    @ViewBuilder private func rewardsSection(_ hub: GameHub) -> some View {
        Heading("Earn your reputation")
        Muted("Cosmetic titles, never extra points. Progress uses this season; claimed titles stay yours.")
        if let title = hub.equippedTitle {
            AppButton(title: "Remove title: \(title)", variant: .outline) { Task { await vm.act(.title(key: nil)) } }
                .disabled(controlsDisabled)
        }
        ForEach(hub.challenges) { ch in
            Card(spacing: 12) {
                Heading("\(ch.unlocked ? "🏅 " : "")\(ch.name)")
                Muted(ch.description)
                ProgressView(value: min(1, Double(ch.progress) / Double(max(ch.target, 1))))
                    .tint(c.primary)
                    .accessibilityLabel("Progress \(ch.progress) of \(ch.target)")
                Muted("\(ch.progress)/\(ch.target) · Unlock “\(ch.title)”")
                AppButton(title: hub.equippedTitle == ch.title ? "Equipped" : (ch.unlocked ? "Equip title" : "Keep playing")) {
                    Task { await vm.act(.title(key: ch.key)) }
                }
                .disabled(controlsDisabled || !ch.unlocked || hub.equippedTitle == ch.title)
            }
        }
    }

    // MARK: Recap

    @ViewBuilder private func recapSection(_ hub: GameHub) -> some View {
        if let recap = hub.recap {
            Card(spacing: 16) {
                Muted("\(recap.seasonName) · \(recap.final ? "Final recap" : "Season so far")")
                Heading(recap.name)
                Text("\(recap.totalPoints) pts").appFont(48, .bold).foregroundStyle(c.primary)
                Heading(recap.rank.map { "#\($0) overall" } ?? "Unranked")
                Muted("\(recap.exactScores) exact scores · \(formatNumber(recap.accuracy))% correct outcomes")
                Muted("\(recap.weeklyWins) group weekly crowns · best streak: \(recap.longestStreak)")
                Muted("Biggest weekly improvement: \(recap.biggestComeback) places")
                if let best = recap.bestPrediction {
                    AppButton(title: "Best pick: \(best.label) · \(best.score) · \(best.points) pts", variant: .outline) {
                        app.router.push(.matchDetail(String(best.matchId)), on: tab)
                    }
                }
                ShareLink(item: recap.shareText) {
                    Text("Share recap").appFont(Tokens.FontSize.md, .semibold).foregroundStyle(c.primaryForeground)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(c.primary, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
                }
            }
        } else {
            Muted("Your recap appears once a season starts.")
        }
    }
}
