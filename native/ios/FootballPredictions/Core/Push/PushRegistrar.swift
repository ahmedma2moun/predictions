import FirebaseCore
import FirebaseMessaging
import Foundation
import UIKit
import UserNotifications

/// Registers the FCM token with the backend (`POST/DELETE /api/mobile/devices`).
/// Safe to call repeatedly — the backend upserts on token.
@MainActor
final class PushRegistrar {
    private static let lastTokenKey = "fp_last_fcm_token"
    private let api: ApiClient
    private let storage: SecureStorage
    private var registeredFor: String?

    init(api: ApiClient, storage: SecureStorage = KeychainStorage()) {
        self.api = api
        self.storage = storage
    }

    /// Asks permission, fetches the FCM token and registers it. Returns the token or nil if skipped.
    @discardableResult
    func register(jwt: String) async -> String? {
        guard registeredFor != jwt else { return nil }
        #if DEBUG
        if jwt == "mock-token" { return nil }
        #endif
        registeredFor = jwt

        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        guard granted else { return nil }
        UIApplication.shared.registerForRemoteNotifications()

        let fcmToken: String
        do {
            fcmToken = try await Messaging.messaging().token()
        } catch {
            print("[push] failed to get FCM token: \(error)")
            return nil
        }
        guard !fcmToken.isEmpty else { return nil }

        do {
            try await api.send(
                "/api/mobile/devices",
                method: .post,
                body: DeviceRegistrationRequest(fcmToken: fcmToken, platform: AppConfig.platform),
                token: jwt
            )
            storage.set(fcmToken, for: Self.lastTokenKey)
        } catch {
            print("[push] device registration failed: \(error)")
            return nil
        }
        return fcmToken
    }

    /// Best-effort token removal on sign-out; the server expires stale tokens anyway.
    func unregister(jwt: String) async {
        defer {
            storage.remove(Self.lastTokenKey)
            registeredFor = nil
        }
        guard let fcmToken = storage.get(Self.lastTokenKey) else { return }
        try? await api.send(
            "/api/mobile/devices",
            method: .delete,
            body: DeviceUnregisterRequest(fcmToken: fcmToken),
            token: jwt
        )
    }
}
