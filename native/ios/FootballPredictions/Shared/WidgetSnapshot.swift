import Foundation

/// What the home-screen widgets show. The app writes it to the shared App Group container whenever it loads
/// matches or the leaderboard; the widget extension only reads it (no network, no token in the extension).
/// Compiled into both the app and the widget extension. The Android twin is `widget/WidgetSnapshot.kt`.
struct WidgetMatch: Codable, Equatable {
    let id: String
    let home: String
    let away: String
    let kickoff: Date
    /// Pre-formatted in the app's display time zone (CLT), e.g. "Sat 17 Oct, 14:00".
    let kickoffLabel: String
    let competition: String?
    /// "2–1" when the user already predicted this match.
    let prediction: String?
}

struct WidgetSnapshot: Codable, Equatable {
    var signedIn: Bool
    /// Soonest scheduled, still-open match (predicted or not).
    var next: WidgetMatch?
    /// Upcoming open matches without a prediction (same number as the Matches tab badge).
    var missingPicks: Int
    /// All-time leaderboard standing, only set after the user has viewed the unfiltered all-time board.
    var rank: Int?
    var points: Int?
    var players: Int?
    var updatedAt: Date

    static let signedOut = WidgetSnapshot(signedIn: false, next: nil, missingPicks: 0, rank: nil, points: nil, players: nil, updatedAt: .distantPast)

    static let sample = WidgetSnapshot(
        signedIn: true,
        next: WidgetMatch(id: "1", home: "Arsenal", away: "Chelsea", kickoff: Date().addingTimeInterval(2 * 3600 + 14 * 60),
                          kickoffLabel: "Sat 17 Oct, 21:00", competition: "Premier League", prediction: nil),
        missingPicks: 3, rank: 3, points: 48, players: 12, updatedAt: Date()
    )

    /// A match is locked from kickoff on (same rule as `isMatchLocked`).
    func isLocked(_ match: WidgetMatch, at now: Date) -> Bool { now >= match.kickoff }

    // MARK: Storage

    static let appGroup = "group.com.maamoun.footballpredictions"
    private static let key = "fp_widget_snapshot"

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder(); e.dateEncodingStrategy = .secondsSince1970; return e
    }()
    private static let decoder: JSONDecoder = {
        let d = JSONDecoder(); d.dateDecodingStrategy = .secondsSince1970; return d
    }()

    static func load(defaults: UserDefaults? = UserDefaults(suiteName: appGroup)) -> WidgetSnapshot {
        guard let data = defaults?.data(forKey: key), let value = try? decoder.decode(WidgetSnapshot.self, from: data) else {
            return .signedOut
        }
        return value
    }

    func save(defaults: UserDefaults? = UserDefaults(suiteName: WidgetSnapshot.appGroup)) {
        if let data = try? WidgetSnapshot.encoder.encode(self) { defaults?.set(data, forKey: WidgetSnapshot.key) }
    }
}

/// Deep links opened from a widget tap. The app maps them to a `NotificationDestination`.
enum WidgetLink {
    static let scheme = "footballpredictions"
    static func match(_ id: String) -> URL { URL(string: "\(scheme)://match/\(id)")! }
    static let matches = URL(string: "\(scheme)://matches")!
    static let slip = URL(string: "\(scheme)://slip")!
    static let leaders = URL(string: "\(scheme)://leaders")!
}
