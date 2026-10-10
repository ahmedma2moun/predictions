import SwiftUI

/// Six visible tabs; each owns a `NavigationStack` so notification routing can switch tab + push.
struct MainTabView: View {
    let app: AppContainer
    @Environment(\.palette) private var c

    var body: some View {
        @Bindable var router = app.router
        TabView(selection: $router.selectedTab) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                TabStack(app: app, tab: tab)
                    .tabItem { Label(tab.title, systemImage: tab.icon) }
                    .tag(tab)
            }
        }
        .tint(c.primary)
    }
}

private struct TabStack: View {
    let app: AppContainer
    let tab: AppTab
    @Environment(\.palette) private var c

    var body: some View {
        NavigationStack(path: Binding(
            get: { app.router.path(for: tab) },
            set: { app.router.setPath($0, for: tab) }
        )) {
            root
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .matchDetail(let id):
                        MatchDetailScreen(app: app, matchId: id, tab: tab)
                            .id(id) // per-match state resets when stepping prev/next
                            .toolbar(.hidden, for: .tabBar)
                    case .slip:
                        SlipScreen(app: app, tab: tab)
                            .toolbar(.hidden, for: .tabBar)
                    case .champion:
                        ChampionScreen(app: app)
                    }
                }
        }
        .background(c.background)
    }

    @ViewBuilder private var root: some View {
        switch tab {
        case .matches: MatchesScreen(app: app, tab: tab)
        case .myScore: MyScoreScreen(app: app, tab: tab)
        case .leaders: LeaderboardScreen(app: app)
        case .club: ClubScreen(app: app, tab: tab)
        case .reminders: RemindersScreen(app: app)
        case .seasons: SeasonsScreen(app: app)
        }
    }
}
