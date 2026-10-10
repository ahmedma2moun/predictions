import SwiftUI

@main
struct FootballPredictionsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var app = AppContainer()

    private var isRunningTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    var body: some Scene {
        WindowGroup {
            if isRunningTests {
                Color.clear
            } else {
                RootView(app: app)
                    .onAppear {
                        #if DEBUG
                        DebugLaunch.apply(to: app)
                        #endif
                    }
            }
        }
    }
}
