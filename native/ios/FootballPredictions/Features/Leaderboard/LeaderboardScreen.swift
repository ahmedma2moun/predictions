import SwiftUI

struct LeaderboardScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    @State private var vm: LeaderboardViewModel

    init(app: AppContainer) {
        self.app = app
        _vm = State(initialValue: LeaderboardViewModel(app: app))
    }

    private var showPodium: Bool { vm.entries.count >= 3 && vm.isCurrentPeriod }

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(app: app, title: "Leaders", subtitle: vm.subtitle)
            if vm.isLoading && vm.entries.isEmpty && vm.error == nil {
                CenteredSpinner()
            } else {
                list
            }
        }
        .background(c.background)
        .task { await vm.loadStatic() }
        .task(id: vm.queryKey) { await vm.loadEntries() }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: Tokens.Spacing.xs) {
                VStack(spacing: Tokens.Spacing.md) {
                    LeaderboardFilters(vm: vm)
                    if showPodium { Podium(entries: vm.entries) }
                }
                .padding(.bottom, Tokens.Spacing.xs)

                if vm.entries.isEmpty { emptyState }
                ForEach(Array(vm.entries.enumerated()), id: \.element.userId) { index, entry in
                    LeaderboardRow(
                        item: entry, index: index, myId: vm.myId, isCurrentPeriod: vm.isCurrentPeriod,
                        isExpanded: vm.expandedUserId == entry.userId, expandedLoading: vm.expandedLoading,
                        expandedData: vm.expandedUserId == entry.userId ? vm.expandedData : nil,
                        showMedal: showPodium && index < 3, championTeamName: vm.championTeamByUser[entry.userId]
                    ) {
                        Task { await vm.toggleExpand(entry.userId) }
                    }
                }
            }
            .padding(.horizontal, Tokens.Spacing.lg)
            .padding(.top, Tokens.Spacing.sm)
            .padding(.bottom, Tokens.Spacing.lg)
            .opacity(vm.isLoading ? 0.6 : 1)
        }
        .refreshable { await vm.refresh() }
    }

    @ViewBuilder private var emptyState: some View {
        if vm.isLoading {
            ProgressView().tint(c.primary).frame(maxWidth: .infinity).padding(.top, Tokens.Spacing.xl)
        } else if let error = vm.error {
            emptyBlock(icon: AppIcon.alert, title: "Failed to load", message: error)
        } else if vm.offSeason {
            emptyBlock(icon: AppIcon.tabLeaders, title: "Season has ended",
                       message: "The leaderboard is cleared. Check the Seasons tab to see final standings.")
        } else {
            Muted("No predictions yet").frame(maxWidth: .infinity).padding(.top, Tokens.Spacing.xl)
        }
    }

    private func emptyBlock(icon: String, title: String, message: String) -> some View {
        VStack(spacing: Tokens.Spacing.sm) {
            Image(systemName: icon).font(.system(size: 32)).foregroundStyle(c.mutedForeground)
            Text(title).appFont(15, .semibold).foregroundStyle(c.foreground)
            Muted(message).multilineTextAlignment(.center).padding(.horizontal, Tokens.Spacing.xl)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Tokens.Spacing.xxl)
    }
}
