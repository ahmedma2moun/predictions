import Foundation

/// Where a tapped push notification should take the user.
enum NotificationDestination: Equatable {
    case matches
    case myScore
    case club
    case slip
    case matchDetail(String)
}

/// Maps a push `data.type` (+ `data.matchId`) to a destination.
/// Behaviour is taken from `mobile/src/notifications/route-for-notification.ts` (code, not its stale comment).
enum NotificationRouter {
    static func destination(for data: [AnyHashable: Any]?) -> NotificationDestination {
        let type = data?["type"] as? String
        let matchId = (data?["matchId"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? (data?["matchId"] as? NSNumber).map { $0.stringValue }

        switch type {
        case "results", "result_correction":
            return .myScore
        case "season_end":
            return .club
        case "goal", "match_started", "match_reminder":
            return matchId.map { .matchDetail($0) } ?? .matches
        case "new_matches", "prediction_reminder", "daily_reminder":
            return .slip
        default:
            return .matches
        }
    }
}
