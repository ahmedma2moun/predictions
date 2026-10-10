import Foundation

/// Mirrors RN `ApiError(message, status)`. `message` is the server's `error` string,
/// falling back to `Request failed (<status>)`.
struct ApiError: Error, LocalizedError, Equatable, Sendable {
    let message: String
    let status: Int

    var errorDescription: String? { message }
}

/// Turns any thrown error into the string the UI shows.
func userMessage(for error: Error, fallback: String = "Something went wrong") -> String {
    if let api = error as? ApiError { return api.message }
    let text = (error as NSError).localizedDescription
    return text.isEmpty ? fallback : text
}

/// True for task/URL cancellation, which must never surface as an error.
func isCancellation(_ error: Error) -> Bool {
    if error is CancellationError { return true }
    if let url = error as? URLError, url.code == .cancelled { return true }
    return false
}
