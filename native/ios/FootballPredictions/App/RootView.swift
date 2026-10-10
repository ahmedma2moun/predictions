import SwiftUI

/// Auth gate: Login when signed out, tab shell when signed in. Hosts the theme, alerts and push wiring.
struct RootView: View {
    let app: AppContainer
    @Environment(\.colorScheme) private var systemScheme

    var body: some View {
        let c = app.theme.colors
        Group {
            if app.auth.isLoading {
                c.background.ignoresSafeArea()
            } else if app.auth.token == nil {
                LoginScreen(app: app)
                    .transition(.opacity)
            } else {
                MainTabView(app: app)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: app.auth.token)
        .environment(\.palette, c)
        .preferredColorScheme(app.theme.preferredColorScheme)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .tint(c.primary)
        .background(c.background.ignoresSafeArea())
        .onChange(of: systemScheme, initial: true) { _, scheme in
            if app.theme.pref == .system { app.theme.systemScheme = scheme }
        }
        .onChange(of: app.theme.pref) { _, pref in
            if pref == .system { app.theme.systemScheme = systemScheme }
        }
        .task(id: app.auth.token) {
            guard let token = app.auth.token else { return }
            await app.push.register(jwt: token)
            if let pending = app.router.pendingDestination {
                app.router.pendingDestination = nil
                app.router.open(pending)
            }
        }
        .onAppear {
            AppDelegate.onNotificationTap = { destination in
                if app.auth.token != nil {
                    app.router.open(destination)
                } else {
                    app.router.pendingDestination = destination
                }
            }
        }
        .onChange(of: app.auth.token) { _, token in
            if token == nil { app.router.reset() }
        }
        .alert(
            app.alerts.current?.title ?? "",
            isPresented: Binding(
                get: { app.alerts.current != nil },
                set: { if !$0 { app.alerts.current = nil } }
            ),
            presenting: app.alerts.current
        ) { _ in
            Button("OK", role: .cancel) {}
        } message: { alert in
            if let message = alert.message { Text(message) }
        }
    }
}
