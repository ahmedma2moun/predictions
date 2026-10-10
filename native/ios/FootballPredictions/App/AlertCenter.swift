import Observation
import SwiftUI

struct AppAlert: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String?
}

/// App-level alert host, so an alert survives the screen that raised it being replaced
/// (RN `Alert.alert` is likewise independent of the current screen).
@MainActor
@Observable
final class AlertCenter {
    var current: AppAlert?

    func show(_ title: String, message: String? = nil) {
        current = AppAlert(title: title, message: message)
    }
}
