import Foundation

#if DEBUG
/// Debug-only launch arguments for running against `native/contract/mock-server.mjs` and taking screenshots:
///   -fp-mock-session            start signed in with a fake session
///   -fp-open <tab>[:<route>]    tab = matches|myScore|leaders|club|reminders|seasons; route = slip|champion|match=<id>
///   -fp-theme light|dark
enum DebugLaunch {
    @MainActor static func apply(to app: AppContainer) {
        let args = ProcessInfo.processInfo.arguments
        func value(after flag: String) -> String? {
            guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
            return args[i + 1]
        }
        if args.contains("-fp-mock-session") {
            app.auth.debugInstallMockSession()
        }
        if let theme = value(after: "-fp-theme"), let pref = ThemePref(rawValue: theme) {
            app.theme.setPref(pref)
        }
        if let spec = value(after: "-fp-open") {
            let parts = spec.split(separator: ":", maxSplits: 1).map(String.init)
            let tabs: [String: AppTab] = ["matches": .matches, "myScore": .myScore, "leaders": .leaders,
                                          "club": .club, "reminders": .reminders, "seasons": .seasons]
            if let tab = tabs[parts[0]] {
                app.router.selectedTab = tab
                if parts.count > 1 {
                    switch parts[1] {
                    case "slip": app.router.setPath([.slip], for: tab)
                    case "champion": app.router.setPath([.champion], for: tab)
                    default:
                        if parts[1].hasPrefix("match=") { app.router.setPath([.matchDetail(String(parts[1].dropFirst(6)))], for: tab) }
                    }
                }
            }
        }
    }
}

extension AuthStore {
    func debugInstallMockSession() {
        setMockSession(token: "mock-token", user: AuthUser(id: "7", name: "Sample User", email: "sample@example.com", role: "user"))
    }
}
#endif
