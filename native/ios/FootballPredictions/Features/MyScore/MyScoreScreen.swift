import SwiftUI

struct MyScoreScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    let tab: AppTab
    @State private var vm: MyScoreViewModel
    @State private var champion: ChampionBonusViewModel

    init(app: AppContainer, tab: AppTab) {
        self.app = app
        self.tab = tab
        _vm = State(initialValue: MyScoreViewModel(app: app))
        _champion = State(initialValue: ChampionBonusViewModel(app: app))
    }

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(app: app, title: "My Score", subtitle: "\(vm.totalPoints) pts total")
            if vm.isLoading && vm.predictions.isEmpty && vm.error == nil {
                CenteredSpinner()
            } else {
                list
            }
        }
        .background(c.background)
        .task {
            async let a: Void = vm.load()
            async let b: Void = champion.load()
            _ = await (a, b)
        }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: Tokens.Spacing.md) {
                VStack(spacing: Tokens.Spacing.md) {
                    if let stats = vm.stats, stats.totalFinished > 0 {
                        AccuracyStatsCard(stats: stats, weekPoints: vm.weekPoints, recentPoints: vm.recentPoints)
                    }
                    weekNav
                    ChampionBonusMyScoreCard(state: champion.state) { app.router.push(.champion, on: tab) }
                }
                .padding(.bottom, Tokens.Spacing.sm)

                if vm.page.isEmpty {
                    Muted(vm.error ?? (vm.predictions.isEmpty
                        ? "No predictions yet. Go predict some matches!"
                        : "No scored predictions for this week."))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, Tokens.Spacing.xl)
                }
                ForEach(vm.page) { PredictionCard(app: app, pred: $0) }
                if vm.remainingCount > 0 {
                    Button { vm.showMore() } label: {
                        Text("Show more (\(vm.remainingCount) remaining)")
                            .appFont(Tokens.FontSize.sm).foregroundStyle(c.mutedForeground)
                            .frame(maxWidth: .infinity).padding(.vertical, Tokens.Spacing.md)
                    }
                    .buttonStyle(PressableStyle(pressedOpacity: 0.6))
                }
            }
            .padding(Tokens.Spacing.lg)
        }
        .refreshable {
            async let a: Void = vm.refresh()
            async let b: Void = champion.refresh()
            _ = await (a, b)
        }
    }

    private var weekNav: some View {
        HStack {
            navButton(AppIcon.chevronLeft, label: "Previous week") { vm.weekOffset -= 1 }
            Spacer()
            Text(vm.weekLabel).appFont(Tokens.FontSize.sm, .semibold).monospacedDigit().foregroundStyle(c.foreground)
            Spacer()
            navButton(AppIcon.chevronRight, label: "Next week") { vm.weekOffset += 1 }
        }
    }

    private func navButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundStyle(c.foreground)
                .frame(width: 32, height: 32)
                .background(c.cardElevated, in: Circle())
                .overlay(Circle().stroke(c.border, lineWidth: hairline))
                .contentShape(Circle().inset(by: -6))
        }
        .buttonStyle(PressableStyle(pressedOpacity: 0.6))
        .accessibilityLabel(label)
    }
}
