import SwiftUI

struct MatchDetailScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    @State private var vm: MatchDetailViewModel

    init(app: AppContainer, matchId: String, tab: AppTab) {
        self.app = app
        _vm = State(initialValue: MatchDetailViewModel(app: app, matchId: matchId, tab: tab))
    }

    var body: some View {
        Group {
            if vm.isLoading {
                CenteredSpinner()
            } else if let match = vm.match {
                content(match)
            } else {
                Text("Match not found")
                    .foregroundStyle(c.foreground)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(c.background)
            }
        }
        .background(c.background)
        .navigationTitle(vm.matchdayTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(c.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await vm.load() }
        .task(id: vm.match?.id) { await vm.pollLive() }
        .onChange(of: vm.error) { _, error in
            if let error { app.alerts.show("Failed to load match", message: error) }
        }
        .sensoryFeedback(.success, trigger: vm.saveCount)
    }

    private func content(_ match: MatchDetail) -> some View {
        ScrollView {
            VStack(spacing: Tokens.Spacing.md) {
                heroCard(match)
                oddsCard(match)
                eventsCard
                formCard(match)
                standingsCard(match)
                GroupComparisonCard(
                    app: app, matchId: match.id, isAdmin: match.isAdmin, locked: vm.locked,
                    hasResult: match.result != nil, isKnockout: vm.knockout, liveScore: vm.liveScore
                )
            }
            .padding(Tokens.Spacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .top, spacing: 0) {
            if match.prevMatch != nil || match.nextMatch != nil {
                HStack(spacing: Tokens.Spacing.sm) {
                    navButton(match.prevMatch, direction: .prev)
                    navButton(match.nextMatch, direction: .next)
                }
                .padding(.horizontal, Tokens.Spacing.lg)
                .padding(.vertical, Tokens.Spacing.sm)
                .background(c.background)
                .overlay(alignment: .bottom) { Rectangle().fill(c.border).frame(height: hairline) }
            }
        }
    }

    // MARK: Hero

    private func heroCard(_ match: MatchDetail) -> some View {
        Card(padding: 0) {
            HStack {
                Text(formatKickoff(match.kickoffDate).uppercased())
                    .appFont(Tokens.FontSize.xs, .semibold).tracking(0.8).foregroundStyle(c.mutedForeground)
                Spacer()
                if match.status == .live {
                    Pill("LIVE", tone: .live)
                } else if vm.locked {
                    Pill("LOCKED", tone: .ghost)
                } else {
                    Pill("OPEN", tone: .amber, icon: AnyView(
                        Image(systemName: AppIcon.clock).font(.system(size: 9)).foregroundStyle(c.warning)))
                }
            }
            .padding(Tokens.Spacing.lg)
            .padding(.bottom, -Tokens.Spacing.xs)

            HStack(spacing: Tokens.Spacing.md) {
                TeamColumn(name: match.homeTeam.name, logo: match.homeTeam.logo,
                           position: vm.knockout ? nil : match.homeStanding?.position,
                           value: $vm.home, disabled: !vm.canPredict)
                Text("–").appFont(Tokens.FontSize.xl, .bold, mono: true).foregroundStyle(c.mutedForeground)
                TeamColumn(name: match.awayTeam.name, logo: match.awayTeam.logo,
                           position: vm.knockout ? nil : match.awayStanding?.position,
                           value: $vm.away, disabled: !vm.canPredict)
            }
            .padding(.horizontal, Tokens.Spacing.lg)
            .padding(.bottom, Tokens.Spacing.lg)

            if vm.canPredict {
                (Text("Your call: ") + Text(vm.winnerLabel).fontWeight(.semibold).foregroundStyle(c.foreground))
                    .appFont(Tokens.FontSize.sm).foregroundStyle(c.mutedForeground)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Tokens.Spacing.lg)
                    .padding(.bottom, Tokens.Spacing.sm)
            }

            if let live = vm.liveScore {
                VStack(spacing: 4) {
                    HStack(spacing: 6) {
                        Circle().fill(Tokens.Fixed.liveDot).frame(width: 6, height: 6)
                        Text("LIVE SCORE").appFont(10, .bold).tracking(1).foregroundStyle(c.live)
                    }
                    Text("\(live.home) – \(live.away)")
                        .appFont(Tokens.FontSize.xxl, .bold, mono: true).foregroundStyle(c.foreground)
                        .contentTransition(.numericText())
                }
                .frame(maxWidth: .infinity)
                .padding(Tokens.Spacing.md)
                .background(Tokens.Fixed.liveBoxFill, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(Tokens.Fixed.liveBoxBorder, lineWidth: 1))
                .padding(Tokens.Spacing.lg)
                .padding(.top, -Tokens.Spacing.lg)
            }

            if let result = match.result {
                VStack(spacing: 2) {
                    Muted("Final Result", size: Tokens.FontSize.xs)
                    Text("\(result.homeScore) – \(result.awayScore)")
                        .appFont(Tokens.FontSize.xxl, .bold, mono: true).foregroundStyle(c.foreground)
                    if let ph = result.penaltyHomeScore {
                        Muted("Penalties: \(ph) – \(result.penaltyAwayScore.map(String.init) ?? "")", size: Tokens.FontSize.xs)
                    }
                    if !match.isAdmin && !vm.knockout, let prediction = match.prediction {
                        Text("+\(prediction.pointsAwarded) pts")
                            .appFont(Tokens.FontSize.sm, .bold).foregroundStyle(c.warning).padding(.top, 4)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(Tokens.Spacing.md)
                .background(c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(c.border, lineWidth: 1))
                .padding(Tokens.Spacing.lg)
                .padding(.top, -Tokens.Spacing.lg)
            }

            if vm.canPredict {
                AppButton(title: match.prediction != nil ? "Update Prediction" : "Save Prediction",
                          loading: vm.saving, fullWidth: true) {
                    Task { await vm.submit() }
                }
                .frame(height: 48)
                .padding(.horizontal, Tokens.Spacing.lg)
                .padding(.bottom, Tokens.Spacing.lg)
            } else if !match.isAdmin && vm.locked && match.result == nil {
                Muted("Predictions are locked for this match")
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, Tokens.Spacing.lg)
            }
        }
    }

    // MARK: Cards

    @ViewBuilder private func oddsCard(_ match: MatchDetail) -> some View {
        if (vm.locked || match.isAdmin), let odds = match.odds {
            let votes = odds.votes ?? MatchOdds.Votes(homeWin: 0, draw: 0, awayWin: 0)
            let total = votes.homeWin + votes.draw + votes.awayWin
            let cells: [(String, Double, Int)] = [
                (match.homeTeam.name, odds.homeWin, votes.homeWin),
                ("Draw", odds.draw, votes.draw),
                (match.awayTeam.name, odds.awayWin, votes.awayWin),
            ]
            Card(spacing: Tokens.Spacing.sm) {
                HStack {
                    SectionTitle("Prediction Odds")
                    Spacer()
                    HStack(spacing: 4) {
                        if odds.locked {
                            Image(systemName: AppIcon.lock).font(.system(size: 10)).foregroundStyle(c.mutedForeground)
                        }
                        Muted("\(total) vote\(total != 1 ? "s" : "")", size: Tokens.FontSize.xs)
                    }
                }
                HStack(spacing: Tokens.Spacing.sm) {
                    ForEach(Array(cells.enumerated()), id: \.offset) { _, cell in
                        let pct = total > 0 ? Int((Double(cell.2) / Double(total) * 100).rounded()) : nil
                        VStack(spacing: 2) {
                            Muted(cell.0, size: 10).lineLimit(1)
                            Text(String(format: "%.2f", cell.1))
                                .appFont(Tokens.FontSize.md, .bold, mono: true).foregroundStyle(c.foreground)
                            Muted("\(pct.map { "\($0)%" } ?? "—") · \(cell.2)v", size: 10)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Tokens.Spacing.sm)
                        .padding(.horizontal, Tokens.Spacing.xs)
                        .background(c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
                        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm).stroke(c.border, lineWidth: hairline))
                    }
                }
            }
        }
    }

    @ViewBuilder private var eventsCard: some View {
        if let events = vm.matchEvents, !events.isEmpty {
            Card(spacing: Tokens.Spacing.xs) {
                SectionTitle("Match Events")
                VStack(spacing: 0) {
                    ForEach(Array(mergeMatchEvents(events).enumerated()), id: \.offset) { _, item in
                        MatchEventRow(item: item)
                    }
                }
            }
        }
    }

    @ViewBuilder private func formCard(_ match: MatchDetail) -> some View {
        let home = vm.form?.home ?? []
        let away = vm.form?.away ?? []
        if !home.isEmpty || !away.isEmpty {
            Card(spacing: Tokens.Spacing.md) {
                SectionTitle("Recent Form")
                HStack(alignment: .top, spacing: Tokens.Spacing.md) {
                    TeamFormColumn(teamName: match.homeTeam.name, matches: home)
                    TeamFormColumn(teamName: match.awayTeam.name, matches: away)
                }
            }
        }
    }

    @ViewBuilder private func standingsCard(_ match: MatchDetail) -> some View {
        if !vm.knockout && (match.homeStanding != nil || match.awayStanding != nil) {
            Card(spacing: Tokens.Spacing.sm) {
                SectionTitle("League Standings")
                StandingsRow(label: match.homeTeam.name, standing: match.homeStanding)
                StandingsRow(label: match.awayTeam.name, standing: match.awayStanding)
            }
        }
    }

    // MARK: Prev / next

    private enum Direction { case prev, next }

    @ViewBuilder private func navButton(_ match: AdjacentMatch?, direction: Direction) -> some View {
        if let match {
            let isPrev = direction == .prev
            Button { vm.goToMatch(match.id) } label: {
                HStack(spacing: 4) {
                    if isPrev { Image(systemName: AppIcon.chevronLeft).font(.system(size: 12, weight: .semibold)) }
                    Text("\(match.homeTeamName) v \(match.awayTeamName)")
                        .appFont(Tokens.FontSize.xs).lineLimit(1)
                    if !isPrev { Image(systemName: AppIcon.chevronRight).font(.system(size: 12, weight: .semibold)) }
                }
                .foregroundStyle(c.mutedForeground)
                .padding(.horizontal, Tokens.Spacing.sm)
                .frame(maxWidth: .infinity, minHeight: 36, alignment: isPrev ? .leading : .trailing)
                .background(c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(c.border, lineWidth: hairline))
            }
            .buttonStyle(PressableStyle(pressedOpacity: 0.6))
            .accessibilityLabel("\(isPrev ? "Previous" : "Next") match: \(match.homeTeamName) vs \(match.awayTeamName)")
        } else {
            Color.clear.frame(maxWidth: .infinity, minHeight: 36)
        }
    }
}
