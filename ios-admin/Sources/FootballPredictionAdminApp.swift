import SwiftUI

@main struct FootballPredictionAdminApp: App {
    @StateObject private var api = AdminAPI()
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            Group {
                if api.restoring { ProgressView("Checking admin access…") }
                else if api.signedIn { AdminHome() }
                else { LoginView() }
            }
            .environmentObject(api)
            .tint(.green)
            .task { await api.restore() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active && api.signedIn { Task { await api.restore() } }
            }
            .overlay {
                if scenePhase != .active {
                    Color(.systemBackground).ignoresSafeArea()
                        .overlay { Label("Football Prediction Admin", systemImage: "lock.shield.fill").font(.title2) }
                }
            }
        }
    }
}

struct LoginView: View {
    @EnvironmentObject private var api: AdminAPI
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "soccerball").font(.system(size: 48)).foregroundStyle(.green)
                        Text("Football Prediction Admin").font(.largeTitle.bold())
                        Text("Manage your football prediction game.").foregroundStyle(.secondary)
                    }.padding(.vertical)
                }.listRowBackground(Color.clear)
                Section("Admin sign in") {
                    TextField("Email", text: $email).keyboardType(.emailAddress)
                        .textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Password", text: $password).textContentType(.password)
                    Button {
                        busy = true; error = nil
                        Task {
                            defer { busy = false }
                            do { try await api.login(email: email, password: password); password = "" }
                            catch { self.error = error.localizedDescription }
                        }
                    } label: {
                        HStack { Text("Sign in"); Spacer(); if busy { ProgressView() } else { Image(systemName: "arrow.right") } }
                    }.disabled(busy || email.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty)
                }
                if let message = error ?? api.sessionError { Section { Text(message).foregroundStyle(.red) } }
                Section { Label("Access is limited to existing admin accounts.", systemImage: "lock.shield").foregroundStyle(.secondary) }
            }
        }
    }
}

enum AdminSection: String, CaseIterable, Identifiable {
    case seasons = "Seasons", leagues = "Leagues", teams = "Teams", matches = "Matches", results = "Results"
    case users = "Users", groups = "Groups", scoring = "Scoring", notifications = "Notifications"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .seasons: "trophy"
        case .leagues: "flag.2.crossed"
        case .teams: "shield"
        case .matches: "soccerball"
        case .results: "checkmark.seal"
        case .users: "person.2"
        case .groups: "person.3"
        case .scoring: "sum"
        case .notifications: "bell"
        }
    }
}

struct AdminHome: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var confirmChampions = false
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Welcome, \(api.user["name"].text)").font(.title2.bold())
                    Text("Your game, under control.").foregroundStyle(.secondary)
                }
                StatusRows(data: data)
                Section("Overview") {
                    ForEach([("totalUsers", "Total users"), ("activeLeagues", "Active leagues"),
                             ("upcomingMatches", "Upcoming matches"), ("predictionsToday", "Predictions today")], id: \.0) { key, title in
                        LabeledContent(title, value: data.value[key].text.isEmpty ? "—" : data.value[key].text)
                    }
                }
                Section("Manage") {
                    ForEach(AdminSection.allCases) { section in
                        NavigationLink(value: section) { Label(section.rawValue, systemImage: section.icon) }
                    }
                }
                Section("Badges") {
                    Button("Calculate group champions") { confirmChampions = true }.disabled(data.busy)
                    Text("Award the all-time champion badge to the top scorer in each group.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Admin")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") { api.signOut() } } }
            .navigationDestination(for: AdminSection.self) { section in
                switch section {
                case .seasons: SeasonsView()
                case .leagues: LeaguesView()
                case .teams: TeamsView()
                case .matches: MatchesView()
                case .results: ResultsView()
                case .users: UsersView()
                case .groups: GroupsView()
                case .scoring: ScoringView()
                case .notifications: NotificationsView()
                }
            }
            .task { await data.load(api, "/api/admin/dashboard") }
            .refreshable { await data.load(api, "/api/admin/dashboard") }
            .confirmationDialog("Award all-time group champion badges?", isPresented: $confirmChampions, titleVisibility: .visible) {
                Button("Calculate champions") { Task { await data.perform(api, "/api/admin/calculate-champions") } }
            }
        }
    }
}
