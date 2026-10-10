import Observation
import SwiftUI

/// Tab order: Matches · My Score · Leaders · Club · Reminders · Seasons.
enum AppTab: Int, CaseIterable, Hashable {
    case matches, myScore, leaders, club, reminders, seasons

    var title: String {
        switch self {
        case .matches: return "Matches"
        case .myScore: return "My Score"
        case .leaders: return "Leaders"
        case .club: return "Club"
        case .reminders: return "Reminders"
        case .seasons: return "Seasons"
        }
    }

    var icon: String {
        switch self {
        case .matches: return AppIcon.tabMatches
        case .myScore: return AppIcon.tabMyScore
        case .leaders: return AppIcon.tabLeaders
        case .club: return AppIcon.tabClub
        case .reminders: return AppIcon.tabReminders
        case .seasons: return AppIcon.tabSeasons
        }
    }
}

/// Screens pushed on top of a tab. `champion` is the "hidden tab": routable, not in the tab bar.
enum AppRoute: Hashable {
    case matchDetail(String)
    case slip
    case champion
}

@MainActor
@Observable
final class AppRouter {
    var selectedTab: AppTab = .matches
    private var paths: [AppTab: [AppRoute]] = [:]
    /// Notification taps that arrive before sign-in are replayed once a session exists.
    var pendingDestination: NotificationDestination?

    func path(for tab: AppTab) -> [AppRoute] { paths[tab] ?? [] }
    func setPath(_ path: [AppRoute], for tab: AppTab) { paths[tab] = path }

    func push(_ route: AppRoute, on tab: AppTab? = nil) {
        let target = tab ?? selectedTab
        paths[target, default: []].append(route)
    }

    /// Replace (not push) so Back still returns to the list — used for prev/next match stepping.
    func replaceTop(with route: AppRoute, on tab: AppTab) {
        var path = paths[tab] ?? []
        if path.isEmpty { path = [route] } else { path[path.count - 1] = route }
        paths[tab] = path
    }

    func open(_ destination: NotificationDestination) {
        switch destination {
        case .matches:
            go(.matches, [])
        case .myScore:
            go(.myScore, [])
        case .club:
            go(.club, [])
        case .slip:
            go(.matches, [.slip])
        case .matchDetail(let id):
            go(.matches, [.matchDetail(id)])
        }
    }

    func reset() {
        paths = [:]
        selectedTab = .matches
    }

    private func go(_ tab: AppTab, _ path: [AppRoute]) {
        selectedTab = tab
        paths[tab] = path
    }
}
