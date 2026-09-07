import SwiftUI

struct StatusRows: View {
    @ObservedObject var data: Resource
    var body: some View {
        if data.busy { ProgressView("Loading…") }
        if let error = data.error { Text(error).foregroundStyle(.red).accessibilityLabel("Error: \(error)") }
        if let notice = data.notice { Text(notice).foregroundStyle(.green) }
    }
}

struct RecordRow: View {
    let value: Value
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(value.title).font(.headline)
            let subtitle = [value["email"].text, value["country"].text, value["status"].text, value["role"].text].filter { !$0.isEmpty }.joined(separator: " · ")
            if !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(.secondary) }
            if let date = parseDate(value["kickoffTime"].text) { Text(date, format: .dateTime.day().month().hour().minute()).font(.caption).foregroundStyle(.secondary) }
        }.padding(.vertical, 3)
    }
}

func parseDate(_ value: String) -> Date? {
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return parser.date(from: value) ?? ISO8601DateFormatter().date(from: value)
}

// Native, drill-down presentation for nested score breakdowns, previews and diagnostics.
// No web content or editable JSON is used.
struct DetailRows: View {
    let value: Value
    var body: some View {
        ForEach(value.object.keys.sorted(), id: \.self) { key in
            let item = value[key]
            if !["password", "token", "logo", "avatarUrl", "_id"].contains(key), item != .null {
                if case .object = item {
                    NavigationLink(label(key)) { List { DetailRows(value: item) }.navigationTitle(label(key)) }
                } else if case .array = item {
                    NavigationLink { List {
                        ForEach(Array(item.array.enumerated()), id: \.offset) { index, row in
                            if row.object.isEmpty { Text(row.text) }
                            else { Section(row.title == "Details" ? "Item \(index + 1)" : row.title) { DetailRows(value: row) } }
                        }
                    }.navigationTitle(label(key)) } label: { LabeledContent(label(key), value: "\(item.array.count)") }
                } else {
                    LabeledContent(label(key), value: parseDate(item.text)?.formatted(date: .abbreviated, time: .shortened) ?? item.text)
                }
            }
        }
    }
    private func label(_ key: String) -> String {
        key.replacingOccurrences(of: "([a-z])([A-Z])", with: "$1 $2", options: .regularExpression)
            .replacingOccurrences(of: "_", with: " ").capitalized
    }
}

struct RemoteDetail: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    let title: String
    let path: String
    var body: some View {
        List { StatusRows(data: data); DetailRows(value: data.value) }
            .navigationTitle(title).task { await data.load(api, path) }.refreshable { await data.load(api, path) }
    }
}

struct LeaguePicker: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @Binding var selection: String
    var activeOnly = true
    var body: some View {
        Picker("League", selection: $selection) {
            Text("Select a league").tag("")
            ForEach(data.value.array.filter { !activeOnly || $0["isActive"].flag }, id: \.id) { league in Text(league.title).tag(league.id) }
        }
        StatusRows(data: data)
        if data.error != nil { Button("Retry leagues") { Task { await data.load(api, "/api/admin/leagues") } } }
        EmptyView().task { await data.load(api, "/api/admin/leagues") }
    }
}

struct TeamSelection: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    let leagueID: String
    @Binding var selected: Set<String>
    var activeOnly = true
    var body: some View {
        StatusRows(data: data)
        ForEach(data.value.array.filter { !$0.id.isEmpty && (!activeOnly || $0["isActive"].flag) }, id: \.id) { team in
            Toggle(team.title, isOn: Binding(get: { selected.contains(team.id) }, set: { on in
                if on { selected.insert(team.id) } else { selected.remove(team.id) }
            }))
        }
        if !leagueID.isEmpty && data.value.array.isEmpty && !data.busy { Text("No teams. Enable teams in Teams first.").foregroundStyle(.secondary) }
        if data.error != nil { Button("Retry teams") { Task { await data.load(api, "/api/admin/teams?leagueId=\(leagueID)") } } }
        EmptyView().task(id: leagueID) {
            if !leagueID.isEmpty { await data.load(api, "/api/admin/teams?leagueId=\(leagueID)") }
        }
    }
}
