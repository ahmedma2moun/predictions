import SwiftUI

struct LeaguesView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var search = ""
    @State private var deactivating: Value?
    var body: some View {
        List {
            StatusRows(data: data)
            Button("Fetch available leagues") { Task { await data.perform(api, "/api/admin/leagues", body: ["action": .string("fetch")], replace: true) } }.disabled(data.busy)
            ForEach(data.value.array.filter { search.isEmpty || ($0.title + $0["country"].text).localizedCaseInsensitiveContains(search) }, id: \.["externalId"].text) { league in
                Toggle(isOn: Binding(get: { league["isActive"].flag }, set: { enabled in
                    if !enabled { deactivating = league } else { update(league, true) }
                })) { RecordRow(value: league) }.disabled(data.busy)
            }
            if data.value.array.isEmpty && !data.busy { Text("Fetch available leagues to get started.").foregroundStyle(.secondary) }
        }.navigationTitle("Leagues").searchable(text: $search)
        .task { await data.load(api, "/api/admin/leagues") }.refreshable { await data.load(api, "/api/admin/leagues") }
        .confirmationDialog("Disable \(deactivating?.title ?? "league") and its teams?", isPresented: Binding(get: { deactivating != nil }, set: { if !$0 { deactivating = nil } }), titleVisibility: .visible) {
            if let league = deactivating { Button("Disable league", role: .destructive) { update(league, false) } }
        }
    }
    private func update(_ league: Value, _ enabled: Bool) {
        var body = league.object; body["isActive"] = .bool(enabled)
        Task {
            if await data.perform(api, "/api/admin/leagues", method: "PATCH", body: body) {
                data.value = .array(data.value.array.map { item in
                    guard item["externalId"] == league["externalId"] else { return item }
                    var row = item.object; row["isActive"] = .bool(enabled); return .object(row)
                })
            }
        }
    }
}

struct TeamsView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var league = ""
    @State private var search = ""
    var body: some View {
        List {
            Section { LeaguePicker(selection: $league) }
            StatusRows(data: data)
            if !league.isEmpty {
                Button("Fetch league teams") { Task { await data.perform(api, "/api/admin/teams", body: ["leagueId": .string(league)], replace: true) } }.disabled(data.busy)
                ForEach(data.value.array.filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) }, id: \.["externalId"].text) { team in
                    Section(team.title) {
                        Toggle("Active", isOn: binding(team, "isActive"))
                        Toggle("Reminders enabled", isOn: binding(team, "reminderEnabled"))
                    }.disabled(data.busy)
                }
            }
        }.navigationTitle("Teams").searchable(text: $search)
        .task(id: league) { data.value = .null; if !league.isEmpty { await data.load(api, "/api/admin/teams?leagueId=\(league)") } }
        .refreshable { if !league.isEmpty { await data.load(api, "/api/admin/teams?leagueId=\(league)") } }
    }
    private func binding(_ team: Value, _ key: String) -> Binding<Bool> {
        Binding(get: { team[key].flag }, set: { enabled in
            var body: [String: Value] = ["externalId": team["externalId"], "name": team["name"], "logo": team["logo"], "leagueId": .string(league), key: .bool(enabled)]
            body["externalLeagueId"] = team["externalLeagueId"]
            Task {
                if await data.perform(api, "/api/admin/teams", method: "PATCH", body: body) {
                    data.value = .array(data.value.array.map { item in
                        guard item["externalId"] == team["externalId"] else { return item }
                        var row = item.object; row[key] = .bool(enabled); return .object(row)
                    })
                }
            }
        })
    }
}

struct ScoringView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var recalculate = false
    var body: some View {
        List {
            StatusRows(data: data)
            ForEach(data.value.array, id: \.id) { rule in
                NavigationLink { RuleEditor(rule: rule) } label: {
                    VStack(alignment: .leading) {
                        Text(rule.title).font(.headline)
                        Text("\(rule["points"].text) points · \(rule["isActive"].flag ? "Active" : "Inactive")").foregroundStyle(.secondary)
                    }
                }
            }
            Section {
                Button("Recalculate all scores") { recalculate = true }.disabled(data.busy)
                Text("Apply current scoring rules to all finished predictions and rebuild the active season’s champion bonuses.").font(.footnote).foregroundStyle(.secondary)
            }
        }.navigationTitle("Scoring")
        .task { await data.load(api, "/api/admin/scoring-rules") }.refreshable { await data.load(api, "/api/admin/scoring-rules") }
        .confirmationDialog("Recalculate all scores using the current rules?", isPresented: $recalculate, titleVisibility: .visible) {
            Button("Recalculate") { Task { await data.perform(api, "/api/admin/recalculate") } }
        }
    }
}

struct RuleEditor: View {
    @EnvironmentObject private var api: AdminAPI
    @Environment(\.dismiss) private var dismiss
    @StateObject private var data = Resource()
    let rule: Value
    @State private var points = ""
    @State private var active = true
    var body: some View {
        Form {
            StatusRows(data: data)
            Text(rule["description"].text)
            TextField("Points", text: $points).keyboardType(.numbersAndPunctuation)
            Toggle("Active", isOn: $active)
            Button("Save rule") { Task {
                guard let points = Double(points), points.isFinite else { return }
                if await data.perform(api, "/api/admin/scoring-rules", method: "PATCH", body: ["id": .string(rule.id), "points": .number(points), "isActive": .bool(active)]) { dismiss() }
            } }.disabled(data.busy || Double(points) == nil)
        }.navigationTitle(rule.title).onAppear { points = rule["points"].text; active = rule["isActive"].flag }
    }
}
