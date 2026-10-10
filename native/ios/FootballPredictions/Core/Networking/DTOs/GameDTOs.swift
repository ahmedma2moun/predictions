import Foundation

// Club / Slip payloads use NUMERIC ids on the wire (unlike the rest of the API).
// Source of truth: src/lib/game/types.ts

struct GamePlayer: Codable, Equatable, Identifiable, Sendable {
    let id: Int
    let name: String
    let title: String?
}

struct GameGroupRef: Codable, Equatable, Identifiable, Sendable {
    let id: Int
    let name: String
}

struct GameSeasonRef: Codable, Equatable, Identifiable, Sendable {
    let id: Int
    let name: String
    let status: String
}

struct WeekRow: Codable, Equatable, Identifiable, Sendable {
    let userId: Int
    let name: String
    let points: Int
    let exact: Int
    let predicted: Int
    let rank: Int
    let title: String?

    var id: Int { userId }
}

struct WeekCompetition: Codable, Equatable, Identifiable, Sendable {
    let key: String
    let end: String
    let state: String
    let matchCount: Int
    let standings: [WeekRow]
    let winnerIds: [Int]

    var id: String { key }
}

struct GameEventReaction: Codable, Equatable, Identifiable, Sendable {
    let emoji: String
    let count: Int
    let mine: Bool

    var id: String { emoji }
}

struct GameEvent: Codable, Equatable, Identifiable, Sendable {
    let key: String
    let at: String
    let kind: String
    let text: String
    let matchId: Int?
    let reactions: [GameEventReaction]

    var id: String { key }
    var atDate: Date { parseISODate(at) ?? Date() }
}

struct Challenge: Codable, Equatable, Identifiable, Sendable {
    let key: String
    let name: String
    let description: String
    let title: String
    let progress: Int
    let target: Int
    let unlocked: Bool

    var id: String { key }
}

struct UnlockedTitle: Codable, Equatable, Sendable {
    let key: String
    let title: String
}

struct GameRival: Codable, Equatable, Sendable {
    let userId: Int
    let name: String
    let myPoints: Int
    let theirPoints: Int
    let gap: Int
    let wins: Int
    let losses: Int
    let draws: Int
    let myAccuracy: Double
    let theirAccuracy: Double
}

struct BestPrediction: Codable, Equatable, Sendable {
    let matchId: Int
    let label: String
    let score: String
    let points: Int
}

struct PlayerRecap: Codable, Equatable, Sendable {
    let name: String
    let seasonName: String
    let final: Bool
    let rank: Int?
    let totalPoints: Int
    let predictions: Int
    let exactScores: Int
    let accuracy: Double
    let longestStreak: Int
    let weeklyWins: Int
    let biggestComeback: Int
    let bestPrediction: BestPrediction?
    let shareText: String
}

struct GameHub: Codable, Equatable, Sendable {
    let currentWeekKey: String
    let userId: Int
    let groups: [GameGroupRef]
    let groupId: Int?
    let seasons: [GameSeasonRef]
    let seasonId: Int?
    let players: [GamePlayer]
    let weeks: [WeekCompetition]
    let feed: [GameEvent]
    let challenges: [Challenge]
    let equippedTitle: String?
    let unlockedTitles: [UnlockedTitle]
    let rival: GameRival?
    let recap: PlayerRecap?
}

/// POST /api/mobile/game body. Optional fields are encoded as explicit `null`
/// where the server distinguishes "clear" from "absent" (rival, title, emoji).
struct GameActionRequest: Encodable, Sendable {
    enum Action {
        case reaction(eventKey: String, emoji: String?)
        case rival(rivalId: Int?)
        case title(key: String?)
    }
    let action: Action
    let groupId: Int?
    let seasonId: Int?

    private enum Keys: String, CodingKey {
        case action, eventKey, emoji, rivalId, key, groupId, seasonId
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Keys.self)
        switch action {
        case let .reaction(eventKey, emoji):
            try c.encode("reaction", forKey: .action)
            try c.encode(eventKey, forKey: .eventKey)
            if let emoji { try c.encode(emoji, forKey: .emoji) } else { try c.encodeNil(forKey: .emoji) }
        case let .rival(rivalId):
            try c.encode("rival", forKey: .action)
            if let rivalId { try c.encode(rivalId, forKey: .rivalId) } else { try c.encodeNil(forKey: .rivalId) }
        case let .title(key):
            try c.encode("title", forKey: .action)
            if let key { try c.encode(key, forKey: .key) } else { try c.encodeNil(forKey: .key) }
        }
        if let groupId { try c.encode(groupId, forKey: .groupId) } else { try c.encodeNil(forKey: .groupId) }
        if let seasonId { try c.encode(seasonId, forKey: .seasonId) } else { try c.encodeNil(forKey: .seasonId) }
    }
}

struct SlipMatch: Codable, Equatable, Identifiable, Sendable {
    let id: Int
    let homeTeamName: String
    let awayTeamName: String
    let kickoffTime: String
    let league: String
    let homeScore: Int?
    let awayScore: Int?
    let locked: Bool

    var kickoffDate: Date { parseISODate(kickoffTime) ?? .distantFuture }
}

struct SlipData: Codable, Equatable, Sendable {
    let matches: [SlipMatch]
    let remaining: Int
    let from: String
    let to: String
}

struct SlipResult: Codable, Equatable, Sendable {
    let matchId: Int
    let saved: Bool
    let error: String?
}

struct SlipSaveResponse: Codable, Equatable, Sendable {
    let results: [SlipResult]
}

struct SlipPredictionInput: Encodable, Sendable {
    let matchId: Int
    let homeScore: Int
    let awayScore: Int
}

struct SlipSaveRequest: Encodable, Sendable {
    let predictions: [SlipPredictionInput]
}
