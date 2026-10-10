import Foundation

struct PredictionHistoryMatch: Codable, Equatable, Sendable {
    let id: String
    let kickoffTime: String
    let status: MatchStatus
    let leagueId: String?
    let leagueName: String?
    let matchday: Int?
    let stage: String?
    let leg: Int?
    let venue: String?
    let homeTeam: Team
    let awayTeam: Team
    let result: MatchResult?
    let odds: MatchOdds?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case kickoffTime, status, leagueId, leagueName, matchday, stage, leg, venue
        case homeTeam, awayTeam, result, odds
    }

    var kickoffDate: Date { parseISODate(kickoffTime) ?? .distantFuture }
}

struct PredictionHistoryItem: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let userId: String
    let matchId: String
    let homeScore: Int
    let awayScore: Int
    let predictedWinner: PredictedWinner?
    let pointsAwarded: Int
    let baseScore: Int
    let outcomeOdds: Double
    let createdAt: String
    let updatedAt: String
    let scoringBreakdown: [ScoringRuleBreakdown]?
    let oddsBonus: OddsBonus?
    let match: PredictionHistoryMatch
}

struct AccuracyStats: Codable, Equatable, Sendable {
    let totalPoints: Int
    let overallAccuracy: Double
    let exactScorePct: Double
    let correctWinnerPct: Double
    let bestLeagueName: String?
    let bestLeagueLogo: String?
    let currentStreak: Int
    let totalFinished: Int
}

struct GroupPredictionEntry: Codable, Equatable, Sendable {
    let userId: String
    let userName: String?
    let homeScore: Int?
    let awayScore: Int?
    let pointsAwarded: Int?
    let scoringBreakdown: [ScoringRuleBreakdown]?
    let predicted: Bool
    let isLive: Bool
}
