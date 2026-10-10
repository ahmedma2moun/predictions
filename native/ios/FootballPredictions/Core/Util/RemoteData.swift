import Foundation
import Observation

/// Generic loading state — the equivalent of RN `useRemoteData`: loading / refreshing / error,
/// cancellation handled by the owning SwiftUI `.task`, `refresh()` keeps existing data on screen.
@MainActor
@Observable
final class RemoteData<T: Sendable> {
    private(set) var data: T?
    private(set) var isLoading = true
    private(set) var isRefreshing = false
    private(set) var error: String?

    /// Runs `fetch`. Pass `isRefresh: true` for pull-to-refresh so the spinner state is not replaced.
    func run(isRefresh: Bool = false, _ fetch: () async throws -> T) async {
        if isRefresh { isRefreshing = true } else { isLoading = true }
        error = nil
        do {
            let value = try await fetch()
            if Task.isCancelled { return }
            data = value
        } catch {
            if isCancellation(error) || Task.isCancelled { return }
            self.error = userMessage(for: error)
        }
        isLoading = false
        isRefreshing = false
    }

    func reset() {
        data = nil
        isLoading = true
        isRefreshing = false
        error = nil
    }
}
