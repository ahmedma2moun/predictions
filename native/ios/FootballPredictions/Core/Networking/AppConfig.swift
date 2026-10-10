import Foundation

enum AppConfig {
    /// Prod `https://predictions-virid.vercel.app`; Debug builds talk to the local dev server
    /// (simulator `localhost`), matching the RN app's `__DEV__` behaviour.
    static var apiBaseURL: URL {
        #if DEBUG
        // `-fp-api http://localhost:3055` on the launch line overrides the dev server (e.g. the mock server).
        UserDefaults.standard.string(forKey: "fp-api").flatMap(URL.init(string:)) ?? URL(string: "http://localhost:3000")!
        #else
        URL(string: "https://predictions-virid.vercel.app")!
        #endif
    }

    static let platform = "ios"

    /// Mirrors `mobile/src/constants/featureFlags.ts`. The odds explainer UI is deferred (see PARITY.md).
    static let oddsFeatureEnabled = false
}
