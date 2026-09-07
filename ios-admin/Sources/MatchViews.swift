import SwiftUI

struct MatchesView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var page = 1
    @State private var selected: Set<String> = []
    @State private var search = ""
    @State private var action: String?
    @State private var deleting = false
    private var path: String { "/api/admin/matches?page=\(page)" }
    var body: some View {
        List {
            StatusRows(data: data)
            Section("Manage fixtures") {
                NavigationLink("Create custom match") { CustomMatchView() }
                NavigationLink("Fetch selected teams’ fixtures") { FixtureSelectionView() }
                Button("Fetch this week’s fixtures") { action = "fetch" }
                Button("Fetch next month’s fixtures") { action = "fetch-next-month" }
                Button("Fetch results") { action = "fetch-results" }
            }.disabled(data.busy)
            Section("Matches") {
                ForEach(data.value["matches"].array.filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) }, id: \.id) { match in
                    HStack {
                        Button {
                            if selected.contains(match.id) { selected.remove(match.id) } else { selected.insert(match.id) }
                        } label: { Image(systemName: selected.contains(match.id) ? "checkmark.circle.fill" : "circle") }
                            .buttonStyle(.borderless).accessibilityLabel("Select \(match.title)")
                        NavigationLink { List { DetailRows(value: match) }.navigationTitle("Match details") } label: { RecordRow(value: match) }
                    }
                }
                if data.value["matches"].array.isEmpty && !data.busy { Text("No matches to display.").foregroundStyle(.secondary) }
            }
            Section {
                HStack {
                    Button("Previous") { page -= 1; selected.removeAll() }.disabled(page <= 1 || data.busy)
                    Spacer(); Text("Page \(page)").foregroundStyle(.secondary); Spacer()
                    Button("Next") { page += 1; selected.removeAll() }.disabled(page * 50 >= (Int(data.value["total"].text) ?? 0) || data.busy)
                }.buttonStyle(.borderless)
                if !selected.isEmpty { Button("Delete \(selected.count) selected matches", role: .destructive) { deleting = true }.disabled(data.busy) }
            }
        }.navigationTitle("Matches").searchable(text: $search, prompt: "Search this page")
        .task(id: page) { await data.load(api, path) }.refreshable { await data.load(api, path) }
        .confirmationDialog("Run \(action == "fetch-results" ? "result update and scoring" : "fixture import")?", isPresented: Binding(get: { action != nil }, set: { if !$0 { action = nil } }), titleVisibility: .visible) {
            if let action { Button("Continue") { Task { await data.perform(api, "/api/admin/matches", body: ["action": .string(action)], reload: path) } } }
        } message: { Text("This updates the shared game and may send the website’s configured notifications.") }
        .confirmationDialog("Delete \(selected.count) matches and their predictions? This cannot be undone.", isPresented: $deleting, titleVisibility: .visible) {
            Button("Delete matches", role: .destructive) { Task {
                if await data.perform(api, "/api/admin/matches", method: "DELETE", body: ["ids": .array(selected.sorted().map(Value.string))], reload: path) { selected.removeAll() }
            } }
        }
    }
}

struct CustomMatchView: View {
    @EnvironmentObject private var api: AdminAPI
    @Environment(\.dismiss) private var dismiss
    @StateObject private var data = Resource()
    @State private var home = ""
    @State private var away = ""
    @State private var kickoff = Date().addingTimeInterval(3600)
    var body: some View {
        Form {
            StatusRows(data: data)
            TextField("Home team", text: $home)
            TextField("Away team", text: $away)
            DatePicker("Kickoff", selection: $kickoff)
            Button("Create match") { Task {
                if await data.perform(api, "/api/admin/matches", body: ["action": .string("create-custom"), "homeTeamName": .string(home), "awayTeamName": .string(away), "kickoffTime": .string(kickoff.ISO8601Format())]) { dismiss() }
            } }.disabled(data.busy || home.trimmingCharacters(in: .whitespaces).isEmpty || away.trimmingCharacters(in: .whitespaces).isEmpty)
        }.navigationTitle("Custom match")
    }
}

struct FixtureSelectionView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var league = ""
    @State private var teams: Set<String> = []
    @State private var days = 7
    @State private var notify = true
    @State private var confirm = false
    var body: some View {
        Form {
            StatusRows(data: data)
            Section {
                LeaguePicker(selection: $league)
                Stepper("Next \(days) days", value: $days, in: 1...365)
                Toggle("Send notifications", isOn: $notify)
            }
            Section("Teams") { TeamSelection(leagueID: league, selected: $teams).id(league) }
            Button("Fetch fixtures") { confirm = true }.disabled(data.busy || league.isEmpty || teams.isEmpty)
        }.navigationTitle("Fetch fixtures").onChange(of: league) { _, _ in teams.removeAll() }
        .confirmationDialog("Import fixtures for \(teams.count) teams over \(days) days?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Fetch fixtures") { Task {
                await data.perform(api, "/api/admin/matches", body: ["action": .string("fetch-selective"), "leagueId": .string(league), "teamIds": .array(teams.sorted().compactMap { Double($0).map(Value.number) }), "days": .number(Double(days)), "sendNotifications": .bool(notify)])
            } }
        } message: { Text(notify ? "Notifications will be sent for new fixtures." : "Notifications are disabled for this import.") }
    }
}

struct ResultsView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var search = ""
    var body: some View {
        List {
            StatusRows(data: data)
            ForEach(data.value["matches"].array.filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) }, id: \.id) { match in
                NavigationLink { ResultEditor(match: match) } label: {
                    VStack(alignment: .leading) {
                        RecordRow(value: match)
                        Text("\(match["resultHomeScore"].text) – \(match["resultAwayScore"].text) · \(match["predictions"].array.count) predictions").font(.subheadline.monospacedDigit())
                    }
                }
            }
            Text("Latest 100 finished matches").font(.footnote).foregroundStyle(.secondary)
        }.navigationTitle("Results").searchable(text: $search)
        .task { await data.load(api, "/api/admin/results") }.refreshable { await data.load(api, "/api/admin/results") }
    }
}

struct ResultEditor: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    let match: Value
    @State private var home = ""
    @State private var away = ""
    @State private var penaltyHome = ""
    @State private var penaltyAway = ""
    @State private var confirm = false
    @State private var current: Value = .null
    private var valid: Bool {
        guard let h = Int(home), let a = Int(away), h >= 0, a >= 0 else { return false }
        if penaltyHome.isEmpty && penaltyAway.isEmpty { return true }
        guard let ph = Int(penaltyHome), let pa = Int(penaltyAway) else { return false }
        return ph >= 0 && pa >= 0
    }
    var body: some View {
        Form {
            StatusRows(data: data)
            Section(match.title) {
                TextField("Home score", text: $home).keyboardType(.numberPad)
                TextField("Away score", text: $away).keyboardType(.numberPad)
            }
            Section("Penalty shootout (optional)") {
                TextField("Home penalties", text: $penaltyHome).keyboardType(.numberPad)
                TextField("Away penalties", text: $penaltyAway).keyboardType(.numberPad)
            }
            Button("Save result and recalculate") { confirm = true }.disabled(!valid || data.busy)
            Section("Predictions and scoring") {
                ForEach(Array((current == .null ? match : current)["predictions"].array.enumerated()), id: \.offset) { _, prediction in
                    NavigationLink { List { DetailRows(value: prediction) }.navigationTitle(prediction.title) } label: {
                        LabeledContent(prediction.title, value: "\(prediction["pointsAwarded"].text) pts")
                    }
                }
            }
        }.navigationTitle("Edit result").onAppear {
            home = match["resultHomeScore"].text; away = match["resultAwayScore"].text
            penaltyHome = match["resultPenaltyHomeScore"].text; penaltyAway = match["resultPenaltyAwayScore"].text
        }
        .confirmationDialog("Save \(home)–\(away) for \(match.title)?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Save and recalculate") { Task {
                let body: [String: Value] = ["homeScore": .number(Double(home)!), "awayScore": .number(Double(away)!),
                    "penaltyHomeScore": Double(penaltyHome).map(Value.number) ?? .null,
                    "penaltyAwayScore": Double(penaltyAway).map(Value.number) ?? .null]
                if await data.perform(api, "/api/admin/results/\(match.id)", method: "PATCH", body: body, reload: "/api/admin/results") {
                    current = data.value["matches"].array.first { $0.id == match.id } ?? match
                }
            } }
        } message: { Text("Prediction scores will be updated for this match.") }
    }
}
