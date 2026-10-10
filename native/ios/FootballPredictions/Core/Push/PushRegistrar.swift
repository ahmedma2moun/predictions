import FirebaseCore
import FirebaseMessaging
import Foundation
import OSLog
import UIKit
import UserNotifications

/// Visible in Console.app on TestFlight/release builds (unlike `print`).
let pushLog = Logger(subsystem: "com.maamoun.footballpredictions", category: "push")

/// Registers the FCM token with the backend (`POST/DELETE /api/mobile/devices`).
/// Safe to call repeatedly — the backend upserts on token.
@MainActor
final class PushRegistrar {
    private static let lastTokenKey = "fp_last_fcm_token"
    private let api: ApiClient
    private let storage: SecureStorage
    private var registeredFor: String?
    private var inFlight = false

    init(api: ApiClient, storage: SecureStorage = KeychainStorage()) {
        self.api = api
        self.storage = storage
    }

    /// Asks permission, fetches the FCM token and registers it. Returns the token or nil if skipped.
    @discardableResult
    func register(jwt: String) async -> String? {
        guard registeredFor != jwt, !inFlight else { return nil }
        #if DEBUG
        if jwt == "mock-token" { return nil }
        #endif
        inFlight = true
        defer { inFlight = false }

        let center = UNUserNotificationCenter.current()
        let granted: Bool
        do {
            granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            pushLog.error("notification permission request failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
        guard granted else {
            pushLog.notice("notification permission denied — not registering")
            return nil
        }
        UIApplication.shared.registerForRemoteNotifications()

        guard let fcmToken = await fetchFcmToken() else { return nil }

        do {
            try await api.send(
                "/api/mobile/devices",
                method: .post,
                body: DeviceRegistrationRequest(fcmToken: fcmToken, platform: AppConfig.platform),
                token: jwt
            )
            storage.set(fcmToken, for: Self.lastTokenKey)
            registeredFor = jwt   // only after success, so a failed attempt is retried next time
            pushLog.notice("device registered with backend")
        } catch {
            pushLog.error("device registration failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
        return fcmToken
    }

    /// `registerForRemoteNotifications()` is asynchronous: until APNs hands over its device token (see AppDelegate)
    /// FCM can't mint a token, so retry for a few seconds instead of failing once.
    private func fetchFcmToken() async -> String? {
        for attempt in 1...5 {
            do {
                let token = try await Messaging.messaging().token()
                if !token.isEmpty { return token }
            } catch {
                pushLog.error("FCM token attempt \(attempt) failed: \(error.localizedDescription, privacy: .public)")
            }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
        }
        return nil
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
