import Foundation

struct ChampionBonusLeague: Codable, Equatable, Sendable {
    let id: String
    let name: String
    let logo: String?
}

struct ChampionBonusAllowedTeam: Codable, Equatable, Identifiable, Sendable {
    let teamId: String
    let name: String
    let logo: String?

    var id: String { teamId }
}

struct ChampionBonusAwardTile: Codable, Equatable, Identifiable, Sendable {
    let matchId: String
    let gameNumber: Int
    let opponentName: String
    let homeAway: String
    let teamScore: Int?
    let opponentScore: Int?
    let kickoffTime: String
    let isWin: Bool
    let points: Int

    var id: String { matchId }
    var kickoffDate: Date { parseISODate(kickoffTime) ?? .distantFuture }
}

struct ChampionBonusRevealTeam: Codable, Equatable, Sendable {
    let teamId: String
    let name: String
    let logo: String?
    let awards: [ChampionBonusAwardTile]
    let totalPoints: Int
    let nextWinPoints: Int
}

struct ChampionBonusRevealPick: Codable, Equatable, Identifiable, Sendable {
    let userId: String
    let name: String?
    let avatarUrl: String?
    let teamId: String
    let teamName: String
    let teamLogo: String?
    let totalBonus: Int

    var id: String { userId }
}

struct ChampionBonusMyPick: Codable, Equatable, Sendable {
    let teamId: String
}

struct ChampionBonusOpen: Equatable, Sendable {
    let league: ChampionBonusLeague
    let allowedTeams: [ChampionBonusAllowedTeam]
    let pickCount: Int
    let myPick: ChampionBonusMyPick?
}

struct ChampionBonusLocked: Equatable, Sendable {
    let league: ChampionBonusLeague
    let lockedAt: String
    let myPick: ChampionBonusMyPick?
    let teams: [String: ChampionBonusRevealTeam]
    let picks: [ChampionBonusRevealPick]

    var lockedDate: Date { parseISODate(lockedAt) ?? Date() }
}

/// `{ enabled: false } | { enabled: true, status: 'OPEN' ... } | { enabled: true, status: 'LOCKED' ... }`
enum ChampionBonusState: Decodable, Equatable, Sendable {
    case disabled
    case open(ChampionBonusOpen)
    case locked(ChampionBonusLocked)

    private enum Keys: String, CodingKey {
        case enabled, status, league, allowedTeams, pickCount, myPick, lockedAt, teams, picks
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        guard try c.decode(Bool.self, forKey: .enabled) else {
            self = .disabled
            return
        }
        let status = try c.decode(String.self, forKey: .status)
        let league = try c.decode(ChampionBonusLeague.self, forKey: .league)
        let myPick = try c.decodeIfPresent(ChampionBonusMyPick.self, forKey: .myPick)
        if status == "LOCKED" {
            self = .locked(ChampionBonusLocked(
                league: league,
                lockedAt: try c.decode(String.self, forKey: .lockedAt),
                myPick: myPick,
                teams: try c.decode([String: ChampionBonusRevealTeam].self, forKey: .teams),
                picks: try c.decode([ChampionBonusRevealPick].self, forKey: .picks)
            ))
        } else {
            self = .open(ChampionBonusOpen(
                league: league,
                allowedTeams: try c.decode([ChampionBonusAllowedTeam].self, forKey: .allowedTeams),
                pickCount: try c.decode(Int.self, forKey: .pickCount),
                myPick: myPick
            ))
        }
    }
}

struct PickChampionRequest: Encodable, Sendable {
    let teamId: Int
}
