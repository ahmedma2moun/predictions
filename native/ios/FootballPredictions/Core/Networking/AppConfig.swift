import Foundation

enum AppConfig {
    private static let production = URL(string: "https://predictions-virid.vercel.app")!

    /// Prod `https://predictions-virid.vercel.app`; Debug builds on the simulator talk to the local dev
    /// server (`localhost`), matching the RN app's `__DEV__` behaviour. Debug builds on a physical device
    /// can't reach the Mac's `localhost`, so they use production (live data).
    static var apiBaseURL: URL {
        #if DEBUG
        // `-fp-api http://localhost:3055` on the launch line overrides the default (e.g. the mock server).
        if let override = UserDefaults.standard.string(forKey: "fp-api").flatMap(URL.init(string:)) { return override }
        #if targetEnvironment(simulator)
        return URL(string: "http://localhost:3000")!
        #else
        return production
        #endif
        #else
        return production
        #endif
    }

    static let platform = "ios"

    /// Mirrors `mobile/src/constants/featureFlags.ts`. The odds explainer UI is deferred (see PARITY.md).
    static let oddsFeatureEnabled = false
}
