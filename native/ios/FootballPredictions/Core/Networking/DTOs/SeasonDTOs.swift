import Foundation

struct Season: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let status: String
    let startDate: String
    let startedAt: String?
    let endedAt: String?
}

struct SeasonStandingEntry: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let rank: Int
    let totalPoints: Int
    let groupId: Int?
    let groupName: String?
    let userId: String
    let userName: String?
}

struct SeasonWithStandings: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let status: String
    let startDate: String
    let startedAt: String?
    let endedAt: String?
    let standings: [SeasonStandingEntry]
}
