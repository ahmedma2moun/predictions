import Foundation

struct AuthUser: Codable, Equatable, Sendable {
    let id: String
    let name: String
    let email: String
    let role: String
}

struct LoginResponse: Codable, Equatable, Sendable {
    let token: String
    let user: AuthUser
}

struct LoginRequest: Encodable, Sendable {
    let email: String
    let password: String
}
