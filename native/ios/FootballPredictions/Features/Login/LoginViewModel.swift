import Observation

@MainActor
@Observable
final class LoginViewModel {
    var email = ""
    var password = ""
    private(set) var isLoading = false
    private let app: AppContainer

    init(app: AppContainer) { self.app = app }

    func submit() async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !password.isEmpty else {
            app.alerts.show("Missing info", message: "Email and password are required.")
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            try await app.auth.signIn(email: trimmed, password: password)
        } catch {
            let message = (error as? ApiError)?.message ?? "Invalid email or password"
            app.alerts.show("Sign in failed", message: message)
        }
    }
}
