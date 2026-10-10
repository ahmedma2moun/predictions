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

    init(api: ApiClient = ApiClient(), storage: SecureStorage = KeychainStorage()) {
        self.api = api
        self.auth = AuthStore(api: api, storage: storage)
        self.theme = ThemeStore()
        self.router = AppRouter()
        self.alerts = AlertCenter()
        self.push = PushRegistrar(api: api, storage: storage)
        let push = self.push
        auth.onBeforeSignOut = { jwt in await push.unregister(jwt: jwt) }
    }

    /// Bearer token for the signed-in user. Screens are only shown while signed in.
    var token: String? { auth.token }
}
