import SwiftUI

struct SeasonsView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    var body: some View {
        List {
            StatusRows(data: data)
            NavigationLink { CreateSeasonView() } label: { Label("Create season", systemImage: "plus") }
            ForEach(data.value.array, id: \.id) { season in
                NavigationLink { SeasonDetail(season: season) } label: { RecordRow(value: season) }
            }
        }.navigationTitle("Seasons").task { await data.load(api, "/api/admin/seasons") }.refreshable { await data.load(api, "/api/admin/seasons") }
    }
}

struct CreateSeasonView: View {
    @EnvironmentObject private var api: AdminAPI
    @Environment(\.dismiss) private var dismiss
    @StateObject private var data = Resource()
    @State private var name = ""
    @State private var description = ""
    @State private var date = Date()
    var body: some View {
        Form {
            StatusRows(data: data)
            TextField("Season name", text: $name)
            TextField("Description (optional)", text: $description, axis: .vertical)
            DatePicker("Start date", selection: $date, displayedComponents: .date)
            Button("Create draft") { Task {
                if await data.perform(api, "/api/admin/seasons", body: ["name": .string(name), "description": .string(description), "startDate": .string(date.ISO8601Format()), "oddsEnabled": .bool(false)]) { dismiss() }
            } }.disabled(data.busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
        }.navigationTitle("New season")
    }
}

struct SeasonDetail: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    let season: Value
    @State private var current: Value = .null
    @State private var action: String?
    private var record: Value { current == .null ? season : current }
    private var path: String { "/api/admin/seasons/\(season.id)" }
    var body: some View {
        List {
            StatusRows(data: data)
            Section { DetailRows(value: record) }
            Section("Manage season") {
                NavigationLink("Champion preview") { RemoteDetail(title: "Champion preview", path: path + "/preview") }
                if record["status"].text != "ENDED" { NavigationLink("Champion bonus") { ChampionBonusView(seasonID: season.id) } }
                if record["status"].text == "DRAFT" { Button("Activate season") { action = "activate" } }
                if record["status"].text == "ACTIVE" {
                    Button("Assign unassigned matches") { action = "retro-assign" }
                    NavigationLink("End season") { EndSeasonView(seasonID: season.id) }
                }
            }.disabled(data.busy)
        }.navigationTitle(record.title)
        .task {
            await data.load(api, "/api/admin/seasons")
            current = data.value.array.first { $0.id == season.id } ?? season
        }
        .confirmationDialog(action == "activate" ? "Activate this season?" : "Assign eligible matches to this season?", isPresented: Binding(get: { action != nil }, set: { if !$0 { action = nil } }), titleVisibility: .visible) {
            if let action { Button("Continue") { Task {
                if await data.perform(api, path + "/" + action, reload: "/api/admin/seasons") {
                    current = data.value.array.first { $0.id == season.id } ?? record
                }
            } } }
        }
    }
}

struct EndSeasonView: View {
    @EnvironmentObject private var api: AdminAPI
    @Environment(\.dismiss) private var dismiss
    @StateObject private var data = Resource()
    let seasonID: String
    @State private var confirm = false
    var body: some View {
        List {
            StatusRows(data: data)
            Section("Champion preview") { DetailRows(value: data.value) }
            Section {
                Text("Ending the season freezes its standings, awards champion badges, and sends notifications to users.")
                Button("End season", role: .destructive) { confirm = true }.disabled(data.busy || data.value == .null || data.error != nil)
            }
        }.navigationTitle("End season")
        .task { await data.load(api, "/api/admin/seasons/\(seasonID)/preview") }
        .refreshable { await data.load(api, "/api/admin/seasons/\(seasonID)/preview") }
        .confirmationDialog("End this season? This cannot be undone.", isPresented: $confirm, titleVisibility: .visible) {
            Button("End season", role: .destructive) { Task { if await data.perform(api, "/api/admin/seasons/\(seasonID)/end") { dismiss() } } }
        }
    }
}

struct ChampionBonusView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    let seasonID: String
    @State private var league = ""
    @State private var teams: Set<String> = []
    @State private var action: String?
    private var path: String { "/api/admin/seasons/\(seasonID)/champion-bonus" }
    var body: some View {
        Form {
            StatusRows(data: data)
            if data.value["enabled"].flag {
                Section("Current bonus") { DetailRows(value: data.value) }
            }
            if data.value != .null && data.value["status"].text != "LOCKED" {
                Section("Setup") {
                    if data.value["enabled"].flag { LabeledContent("League", value: data.value["league"]["name"].text) }
                    else { LeaguePicker(selection: $league, activeOnly: false) }
                }
                Section("Select at least two teams") { TeamSelection(leagueID: league, selected: $teams, activeOnly: false).id(league) }
                Button(data.value["enabled"].flag ? "Save allowed teams" : "Enable champion bonus") { action = "save" }
                    .disabled(data.busy || teams.count < 2 || league.isEmpty)
            }
            if data.value["enabled"].flag {
                if data.value["status"].text == "OPEN" { Button("Lock picks and reveal") { action = "lock" }.disabled(data.busy) }
                Button("Cancel champion bonus", role: .destructive) { action = "cancel" }.disabled(data.busy)
            }
        }.navigationTitle("Champion bonus")
        .task { await data.load(api, path); syncSelection() }
        .refreshable { await data.load(api, path); syncSelection() }
        .onChange(of: league) { old, _ in if !old.isEmpty && !data.value["enabled"].flag { teams.removeAll() } }
        .confirmationDialog(action == "cancel" ? "Cancel the bonus and remove its picks and points?" : action == "lock" ? "Lock picks and reveal everyone’s choices?" : "Save champion bonus configuration?", isPresented: Binding(get: { action != nil }, set: { if !$0 { action = nil } }), titleVisibility: .visible) {
            if let action { Button("Confirm", role: action == "cancel" ? .destructive : nil) { Task {
                if action == "save" {
                    await data.perform(api, path, method: data.value["enabled"].flag ? "PATCH" : "POST", body: ["leagueId": .number(Double(league) ?? 0), "teamIds": .array(teams.sorted().compactMap { Double($0).map(Value.number) })], reload: path)
                } else {
                    await data.perform(api, action == "lock" ? path + "/lock" : path, method: action == "lock" ? "POST" : "DELETE", reload: path)
                }
                syncSelection()
            } } }
        }
    }
    private func syncSelection() {
        league = data.value["league"]["id"].text
        teams = Set(data.value["allowedTeams"].array.map { $0["teamId"].text })
    }
}
