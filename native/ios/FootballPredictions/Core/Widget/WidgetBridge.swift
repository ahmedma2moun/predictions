import Foundation
import WidgetKit

/// Keeps the widget snapshot in step with what the app has loaded. Fire-and-forget: widgets are best-effort.
enum WidgetBridge {
    /// Soonest scheduled match that has not kicked off, as the widget shows it.
    static func nextMatch(from matches: [MatchListItem], now: Date = Date()) -> WidgetMatch? {
        let open = matches
            .filter { $0.status == .scheduled && !isMatchLocked($0.kickoffDate, now: now) }
            .min { $0.kickoffDate < $1.kickoffDate }
        guard let m = open else { return nil }
        return WidgetMatch(
            id: m.id, home: m.homeTeam.name, away: m.awayTeam.name,
            kickoff: m.kickoffDate, kickoffLabel: formatKickoff(m.kickoffDate),
            competition: m.leagueName,
            prediction: m.prediction.map { "\($0.homeScore)–\($0.awayScore)" }
        )
    }

    static func update(matches: [MatchListItem], now: Date = Date()) {
        var snapshot = WidgetSnapshot.load()
        snapshot.signedIn = true
        snapshot.next = nextMatch(from: matches, now: now)
        snapshot.missingPicks = countMissingPicks(matches, now: now)
        snapshot.updatedAt = now
        write(snapshot)
    }

    /// Call only for the unfiltered all-time board, so the number means one thing.
    static func update(rank: Int, points: Int, players: Int) {
        var snapshot = WidgetSnapshot.load()
        snapshot.signedIn = true
        snapshot.rank = rank
        snapshot.points = points
        snapshot.players = players
        write(snapshot)
    }

    static func clear() { write(.signedOut) }

    private static func write(_ snapshot: WidgetSnapshot) {
        let previous = WidgetSnapshot.load()
        guard previous.next != snapshot.next || previous.missingPicks != snapshot.missingPicks
            || previous.rank != snapshot.rank || previous.points != snapshot.points
            || previous.players != snapshot.players || previous.signedIn != snapshot.signedIn else { return }
        snapshot.save()
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// `footballpredictions://match/42` -> `.matchDetail("42")`; unknown links open Matches.
    static func destination(for url: URL) -> NotificationDestination? {
        guard url.scheme == WidgetLink.scheme else { return nil }
        switch url.host {
        case "match":
            let id = url.pathComponents.dropFirst().first ?? ""
            return id.isEmpty ? .matches : .matchDetail(id)
        case "slip": return .slip
        case "leaders": return .leaders
        default: return .matches
        }
    }
}
