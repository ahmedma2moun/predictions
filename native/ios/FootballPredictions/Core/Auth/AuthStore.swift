import Foundation
import Observation

/// JWT + user persisted in the Keychain (`fp_token`, `fp_user` — same keys as the RN app).
@MainActor
@Observable
final class AuthStore {
    static let tokenKey = "fp_token"
    static let userKey = "fp_user"

    private(set) var token: String?
    private(set) var user: AuthUser?
    private(set) var isLoading = true

    private let api: ApiClient
    private let storage: SecureStorage
    /// Called with the JWT *before* local state is cleared (unregisters the push token).
    var onBeforeSignOut: ((String) async -> Void)?

    init(api: ApiClient, storage: SecureStorage = KeychainStorage()) {
        self.api = api
        self.storage = storage
        restore()
    }

    private func restore() {
        token = storage.get(Self.tokenKey)
        if let json = storage.get(Self.userKey), let data = json.data(using: .utf8) {
            user = try? JSONDecoder().decode(AuthUser.self, from: data)
        }
        isLoading = false
    }

    #if DEBUG
    func setMockSession(token: String, user: AuthUser) {
        self.token = token
        self.user = user
        isLoading = false
    }
    #endif

    func signIn(email: String, password: String) async throws {
        let response: LoginResponse = try await api.request(
            "/api/mobile/auth/login",
            method: .post,
            body: LoginRequest(email: email, password: password)
        )
        storage.set(response.token, for: Self.tokenKey)
        if let data = try? JSONEncoder().encode(response.user), let json = String(data: data, encoding: .utf8) {
            storage.set(json, for: Self.userKey)
        }
        token = response.token
        user = response.user
        isLoading = false
    }

    /// Sign-out order: unregister push token -> clear secure storage -> back to Login.
    func signOut() async {
        if let current = token {
            await onBeforeSignOut?(current)
        }
        storage.remove(Self.tokenKey)
        storage.remove(Self.userKey)
        token = nil
        user = nil
        isLoading = false
    }
}
