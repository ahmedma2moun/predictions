import Foundation
import Observation

/// Plain composition root — screens receive it through their initialisers.
@MainActor
@Observable
final class AppContainer {
    let api: ApiClient
    let auth: AuthStore
    let theme: ThemeStore
    let router: AppRouter
    let alerts: AlertCenter
    let push: PushRegistrar
    /// Upcoming matches without a prediction; shown as the Matches tab badge. Set by `MatchesViewModel`.
    var missingPicks = 0

    init(api: ApiClient = ApiClient(), storage: SecureStorage = KeychainStorage()) {
        self.api = api
        self.auth = AuthStore(api: api, storage: storage)
        self.theme = ThemeStore()
        self.router = AppRouter()
        self.alerts = AlertCenter()
        self.push = PushRegistrar(api: api, storage: storage)
        let push = self.push
        auth.onBeforeSignOut = { [weak self] jwt in
            await push.unregister(jwt: jwt)
            await MainActor.run { WidgetBridge.clear() }
            await MainActor.run { self?.missingPicks = 0 }
        }
    }

    /// Bearer token for the signed-in user. Screens are only shown while signed in.
    var token: String? { auth.token }
}
