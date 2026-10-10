import FirebaseCore
import FirebaseMessaging
import UIKit
import UserNotifications

/// Hosts Firebase setup and notification-tap delivery. Taps are forwarded to `onNotificationTap`,
/// which the app wires to `AppRouter.open(_:)`. Cold-start taps are buffered until a handler is set.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    @MainActor static var onNotificationTap: ((NotificationDestination) -> Void)? {
        didSet { flushPending() }
    }
    @MainActor private static var pending: NotificationDestination?

    @MainActor private static func flushPending() {
        guard let handler = onNotificationTap, let destination = pending else { return }
        pending = nil
        handler(destination)
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Hosted unit tests must not configure Firebase or request notification permission.
        if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil { return true }
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        pushLog.notice("APNs device token received")
    }

    // Without this a missing push entitlement / provisioning profile fails silently.
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        pushLog.error("APNs registration failed: \(error.localizedDescription, privacy: .public)")
    }

    // Foreground presentation: show banner + sound like the RN handler (`shouldShowBanner/List/Sound`).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    // Tap in foreground, background and cold start all arrive here.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let destination = NotificationRouter.destination(for: response.notification.request.content.userInfo)
        await MainActor.run {
            if let handler = Self.onNotificationTap {
                handler(destination)
            } else {
                Self.pending = destination
            }
        }
    }
}
