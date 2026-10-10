import Foundation

/// Unknown server values decode to `.scheduled` rather than failing the whole payload.
enum MatchStatus: String, Codable, Equatable, Sendable {
    case scheduled, live, finished, postponed, cancelled

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = MatchStatus(rawValue: raw) ?? .scheduled
    }
}

enum PredictedWinner: String, Codable, Equatable, Sendable {
    case home, away, draw
}

struct Team: Codable, Equatable, Sendable {
    let name: String
    let logo: String?
}

struct MatchResult: Codable, Equatable, Sendable {
    let homeScore: Int
    let awayScore: Int
    let penaltyHomeScore: Int?
    let penaltyAwayScore: Int?
}

struct PredictionSummary: Codable, Equatable, Sendable {
    let homeScore: Int
    let awayScore: Int
    let predictedWinner: PredictedWinner?
    let pointsAwarded: Int
}

struct Standing: Codable, Equatable, Sendable {
    let position: Int
    let points: Int
    let played: Int?
    let won: Int?
    let drawn: Int?
    let lost: Int?
    let goalDifference: Int?
    let form: String?
}

struct MatchListItem: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let externalId: Int?
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
    let prediction: PredictionSummary?
    let homeStanding: Standing?
    let awayStanding: Standing?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case externalId, kickoffTime, status, leagueId, leagueName, matchday, stage, leg, venue
        case homeTeam, awayTeam, result, prediction, homeStanding, awayStanding
    }

    var kickoffDate: Date { parseISODate(kickoffTime) ?? .distantFuture }
}

struct AdjacentMatch: Codable, Equatable, Sendable {
    let id: String
    let homeTeamName: String
    let awayTeamName: String

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case homeTeamName, awayTeamName
    }
}

struct MatchOdds: Codable, Equatable, Sendable {
    struct Votes: Codable, Equatable, Sendable {
        let homeWin: Int
        let draw: Int
        let awayWin: Int
    }
    let homeWin: Double
    let draw: Double
    let awayWin: Double
    let locked: Bool
    let votes: Votes?
}

struct ScoringRuleBreakdown: Codable, Equatable, Sendable {
    let key: String
    let name: String
    let points: Int
    let awarded: Bool
}

struct OddsBonus: Codable, Equatable, Sendable {
    let outcomeOdds: Double
    let baseScore: Int
    let finalScore: Int
}

struct MatchOddsFactors: Codable, Equatable, Sendable {
    let homeWin: Double
    let draw: Double
    let awayWin: Double
}

struct OtherPrediction: Codable, Equatable, Sendable {
    let userId: String
    let userName: String
    let homeScore: Int
    let awayScore: Int
    let pointsAwarded: Int
    let scoringBreakdown: [ScoringRuleBreakdown]?
    let oddsBonus: OddsBonus?
}

/// `MatchListItem` plus detail-only fields (flattened — no inheritance on the wire).
struct MatchDetail: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let externalId: Int?
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
    let prediction: PredictionSummary?
    let homeStanding: Standing?
    let awayStanding: Standing?
    let isAdmin: Bool
    let prevMatch: AdjacentMatch?
    let nextMatch: AdjacentMatch?
    let isKnockout: Bool
    let resultPenaltyHomeScore: Int?
    let resultPenaltyAwayScore: Int?
    let odds: MatchOdds?
    let allPredictions: [OtherPrediction]?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case externalId, kickoffTime, status, leagueId, leagueName, matchday, stage, leg, venue
        case homeTeam, awayTeam, result, prediction, homeStanding, awayStanding
        case isAdmin, prevMatch, nextMatch, isKnockout, resultPenaltyHomeScore, resultPenaltyAwayScore
        case odds, allPredictions
    }

    var kickoffDate: Date { parseISODate(kickoffTime) ?? .distantFuture }
}

enum FormResult: String, Codable, Equatable, Sendable {
    case W, D, L
}

struct TeamFormMatch: Codable, Equatable, Sendable {
    let date: String
    let opponentName: String
    let opponentLogo: String?
    let isHome: Bool
    let teamScore: Int?
    let opponentScore: Int?
    let penaltyTeamScore: Int?
    let penaltyOpponentScore: Int?
    let result: FormResult?
    let competition: String
    let status: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = try c.decode(String.self, forKey: .date)
        opponentName = try c.decode(String.self, forKey: .opponentName)
        opponentLogo = try c.decodeIfPresent(String.self, forKey: .opponentLogo)
        isHome = try c.decode(Bool.self, forKey: .isHome)
        teamScore = try c.decodeIfPresent(Int.self, forKey: .teamScore)
        opponentScore = try c.decodeIfPresent(Int.self, forKey: .opponentScore)
        penaltyTeamScore = try c.decodeIfPresent(Int.self, forKey: .penaltyTeamScore)
        penaltyOpponentScore = try c.decodeIfPresent(Int.self, forKey: .penaltyOpponentScore)
        // Unknown result strings are treated as "no result" instead of failing the payload.
        result = (try? c.decodeIfPresent(String.self, forKey: .result)).flatMap { FormResult(rawValue: $0) }
        competition = try c.decode(String.self, forKey: .competition)
        status = try c.decode(String.self, forKey: .status)
    }

    enum CodingKeys: String, CodingKey {
        case date, opponentName, opponentLogo, isHome, teamScore, opponentScore
        case penaltyTeamScore, penaltyOpponentScore, result, competition, status
    }
}

struct MatchForm: Codable, Equatable, Sendable {
    let home: [TeamFormMatch]
    let away: [TeamFormMatch]
}

enum MatchEventType: String, Codable, Equatable, Sendable {
    case goal, card
}

enum EventSide: String, Codable, Equatable, Sendable {
    case home, away
}

struct MatchEvent: Codable, Equatable, Sendable {
    let type: MatchEventType
    let detail: String
    let minute: Int
    let team: EventSide
    let player: String
    let assistPlayer: String?
}

/// `GET /api/mobile/matches/{id}/live`. Fields are nullable because the upstream feed can omit them.
struct LiveScoreResponse: Codable, Equatable, Sendable {
    let status: MatchStatus
    let homeScore: Int?
    let awayScore: Int?
    let events: [MatchEvent]?
}

struct SavePredictionRequest: Encodable, Sendable {
    let matchId: String
    let homeScore: Int
    let awayScore: Int
}
