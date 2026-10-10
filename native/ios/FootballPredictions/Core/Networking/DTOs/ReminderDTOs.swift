import Foundation

struct ReminderTeam: Codable, Equatable, Identifiable, Sendable {
    let teamLeagueId: Int
    let name: String

    var id: Int { teamLeagueId }
}

struct ReminderLeague: Codable, Equatable, Identifiable, Sendable {
    let id: Int
    let name: String
    let teams: [ReminderTeam]
}

struct RemindersData: Codable, Equatable, Sendable {
    let leagues: [ReminderLeague]
    let selections: [ReminderLeague]
}

struct ReminderSelectionsRequest: Encodable, Sendable {
    let selections: [Int]
}

struct DeviceRegistrationRequest: Encodable, Sendable {
    let fcmToken: String
    let platform: String
}

struct DeviceUnregisterRequest: Encodable, Sendable {
    let fcmToken: String
}
