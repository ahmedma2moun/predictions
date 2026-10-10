import Foundation

struct LeaderboardEntry: Codable, Equatable, Identifiable, Sendable {
    let rank: Int
    let userId: String
    let name: String
    let avatarUrl: String?
    let totalPoints: Int
    let championBonusPoints: Int
    let predictionsCount: Int
    let accuracy: Double
    let currentStreak: Int
    let longestStreak: Int
    let badges: [String]
    let exactScoreCount: Int
    let isGroupChampion: Bool

    var id: String { userId }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        rank = try c.decode(Int.self, forKey: .rank)
        userId = try c.decode(String.self, forKey: .userId)
        name = try c.decode(String.self, forKey: .name)
        avatarUrl = try c.decodeIfPresent(String.self, forKey: .avatarUrl)
        totalPoints = try c.decode(Int.self, forKey: .totalPoints)
        // Older payloads omit these; the RN app treats them as zero/empty.
        championBonusPoints = try c.decodeIfPresent(Int.self, forKey: .championBonusPoints) ?? 0
        predictionsCount = try c.decodeIfPresent(Int.self, forKey: .predictionsCount) ?? 0
        accuracy = try c.decodeIfPresent(Double.self, forKey: .accuracy) ?? 0
        currentStreak = try c.decodeIfPresent(Int.self, forKey: .currentStreak) ?? 0
        longestStreak = try c.decodeIfPresent(Int.self, forKey: .longestStreak) ?? 0
        badges = try c.decodeIfPresent([String].self, forKey: .badges) ?? []
        exactScoreCount = try c.decodeIfPresent(Int.self, forKey: .exactScoreCount) ?? 0
        isGroupChampion = try c.decodeIfPresent(Bool.self, forKey: .isGroupChampion) ?? false
    }

    enum CodingKeys: String, CodingKey {
        case rank, userId, name, avatarUrl, totalPoints, championBonusPoints, predictionsCount
        case accuracy, currentStreak, longestStreak, badges, exactScoreCount, isGroupChampion
    }
}

struct LeaderboardGroup: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let name: String
    let isDefault: Bool
}

struct LeaderboardLeague: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let externalId: Int
    let name: String
    let country: String
    let logo: String?
}

struct LeaderboardUserPrediction: Codable, Equatable, Identifiable, Sendable {
    struct Result: Codable, Equatable, Sendable {
        let homeScore: Int
        let awayScore: Int
    }
    let matchId: String
    let kickoffTime: String
    let homeTeamName: String
    let awayTeamName: String
    let homeScore: Int
    let awayScore: Int
    let result: Result
    let pointsAwarded: Int
    let scoringBreakdown: [ScoringRuleBreakdown]?
    let oddsBonus: OddsBonus?
    let matchOdds: MatchOddsFactors?

    var id: String { matchId }
    var kickoffDate: Date { parseISODate(kickoffTime) ?? .distantFuture }
}

enum LiveMovement: String, Codable, Equatable, Sendable {
    case up, down, same

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = LiveMovement(rawValue: raw) ?? .same
    }
}

struct LiveStandingMatch: Codable, Equatable, Sendable {
    let matchId: String
    let homeTeamName: String
    let homeTeamLogo: String?
    let awayTeamName: String
    let awayTeamLogo: String?
    let homeScore: Int
    let awayScore: Int
    let status: String
    let kickoffTime: String
}

struct LiveStandingEntry: Codable, Equatable, Sendable {
    let userId: String
    let name: String?
    let avatarUrl: String?
    let previousRank: Int
    let rank: Int
    let movement: LiveMovement
    let points: Int
    let livePoints: Int
    let liveTotalPoints: Int
}

struct LiveGroupStanding: Codable, Equatable, Sendable {
    let hasLiveMatches: Bool
    let matches: [LiveStandingMatch]
    let standings: [LiveStandingEntry]
}
