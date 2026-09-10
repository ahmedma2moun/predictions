import SwiftUI

struct UpcomingMatchesView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    private let path = "/api/mobile/admin/upcoming"
    private var days: [Date] {
        Array(Set(data.value.array.compactMap { parseDate($0["kickoffTime"].text) }
            .map { Calendar.current.startOfDay(for: $0) })).sorted()
    }
    var body: some View {
        List {
            StatusRows(data: data)
            if data.value != .null && data.value.array.isEmpty && data.error == nil {
                ContentUnavailableView("No upcoming matches", systemImage: "soccerball", description: Text("Upcoming matches will appear here when available."))
            }
            ForEach(days, id: \.self) { day in
                Section(day.formatted(.dateTime.weekday(.wide).day().month())) {
                    ForEach(data.value.array.filter {
                        guard let date = parseDate($0["kickoffTime"].text) else { return false }
                        return Calendar.current.isDate(date, inSameDayAs: day)
                    }, id: \.id) { match in
                        NavigationLink { UpcomingMatchDetail(matchID: match.id) } label: {
                            UpcomingMatchCard(match: match)
                        }.listRowSeparator(.hidden)
                    }
                }
            }
            if data.error != nil { Button("Retry") { Task { await data.load(api, path) } } }
        }
        .navigationTitle("Upcoming Matches")
        .task { await data.load(api, path) }
        .refreshable { await data.load(api, path) }
    }
}

struct UpcomingMatchCard: View {
    let match: Value
    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text(competition).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                TimelineView(.periodic(from: .now, by: 30)) { context in
                    Text(status(at: context.date)).font(.caption.bold())
                        .foregroundStyle(match["status"].text == "live" ? .red : .green)
                }
            }
            HStack(alignment: .center, spacing: 12) {
                team("home")
                Text(match["result"] == .null ? "VS" : "\(match["result"]["homeScore"].text)–\(match["result"]["awayScore"].text)")
                    .font(.title3.bold().monospacedDigit())
                team("away")
            }
            if let kickoff = parseDate(match["kickoffTime"].text) {
                HStack {
                    Text(kickoff, format: .dateTime.day().month().hour().minute())
                    Spacer()
                    TimelineView(.periodic(from: .now, by: 30)) { context in
                        if kickoff > context.date {
                            Text("Starts \(kickoff, style: .relative)")
                        }
                    }
                }.font(.caption).foregroundStyle(.secondary)
            }
        }.padding(.vertical, 10)
    }
    private var competition: String {
        var parts: [String] = []
        if match["matchday"] != .null { parts.append("MATCHDAY \(match["matchday"].text)") }
        else if !match["stage"].text.isEmpty { parts.append(match["stage"].text.replacingOccurrences(of: "_", with: " ")) }
        if !match["leagueName"].text.isEmpty { parts.append(match["leagueName"].text) }
        if match["leg"] != .null { parts.append("Leg \(match["leg"].text)") }
        return parts.isEmpty ? "MATCH" : parts.joined(separator: " · ").uppercased()
    }
    private func status(at now: Date) -> String {
        if match["status"].text != "scheduled" { return match["status"].text.uppercased() }
        return (parseDate(match["kickoffTime"].text) ?? .distantPast) <= now ? "LOCKED" : "OPEN"
    }
    private func team(_ side: String) -> some View {
        VStack(spacing: 6) {
            AsyncImage(url: URL(string: match["\(side)Team"]["logo"].text)) { image in
                image.resizable().scaledToFit()
            } placeholder: { Image(systemName: "shield").foregroundStyle(.secondary) }
                .frame(width: 40, height: 40).accessibilityHidden(true)
            Text(match["\(side)Team"]["name"].text).font(.subheadline.weight(.semibold)).multilineTextAlignment(.center)
            if match["\(side)Standing"] != .null {
                Text("#\(match["\(side)Standing"]["position"].text) · \(match["\(side)Standing"]["points"].text) pts")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }.frame(maxWidth: .infinity)
    }
}

struct UpcomingMatchDetail: View {
    @EnvironmentObject private var api: AdminAPI
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var data = Resource()
    @StateObject private var form = Resource()
    @StateObject private var live = Resource()
    let matchID: String
    private var path: String { "/api/mobile/admin/upcoming/\(matchID)" }
    private var match: Value { data.value }
    var body: some View {
        List {
            StatusRows(data: data)
            if match != .null {
                Section { UpcomingMatchCard(match: match)
                    if !match["venue"].text.isEmpty { Label(match["venue"].text, systemImage: "mappin.and.ellipse").font(.caption) }
                    if match["result"]["penaltyHomeScore"] != .null {
                        Text("Penalties: \(match["result"]["penaltyHomeScore"].text)–\(match["result"]["penaltyAwayScore"].text)")
                    }
                }
                if live.value["homeScore"] != .null && live.value["awayScore"] != .null {
                    Section(live.value["status"].text == "finished" ? "Final score" : "Live score") {
                        Text("\(live.value["homeScore"].text) – \(live.value["awayScore"].text)").font(.title.bold().monospacedDigit()).frame(maxWidth: .infinity)
                    }
                }
                StatusRows(data: live)
                if !live.value["events"].array.isEmpty {
                    Section("Match events") {
                        ForEach(Array(live.value["events"].array.enumerated()), id: \.offset) { _, event in
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(event["time"]["elapsed"].text)′ · \(event["player"]["name"].text)").font(.subheadline.bold())
                                Text("\(event["team"]["name"].text) · \(event["type"].text) · \(event["detail"].text)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                if match["externalId"] != .null {
                    Section("Recent form · last 5 matches") {
                        StatusRows(data: form)
                        formRows("home"); formRows("away")
                    }
                    if !match["isKnockout"].flag {
                        Section("League standings") { standingRows("home"); standingRows("away") }
                    }
                }
                Section("Predictions (\(match["predictions"].array.count))") {
                    if match["predictions"].array.isEmpty { Text("No predictions yet.").foregroundStyle(.secondary) }
                    ForEach(Array(match["predictions"].array.enumerated()), id: \.offset) { _, prediction in
                        NavigationLink { List { DetailRows(value: prediction) }.navigationTitle(prediction["userName"].text) } label: {
                            HStack {
                                Text(prediction["userName"].text)
                                Spacer()
                                Text("\(prediction["homeScore"].text)–\(prediction["awayScore"].text)").monospacedDigit()
                                if prediction["pointsAwarded"] != .null { Text("\(prediction["pointsAwarded"].text) pts").foregroundStyle(.green) }
                            }.font(.subheadline)
                        }
                    }
                }
                Section {
                    NavigationLink(match["result"] == .null ? "Add result" : "Edit result and recalculate") {
                        ResultEditor(match: resultEditorMatch)
                    }
                }
            }
            if data.error != nil { Button("Retry") { Task { await reload() } } }
        }
        .navigationTitle("Match details").navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(60)) } catch { return }
                if match["externalId"] != .null,
                   let kickoff = parseDate(match["kickoffTime"].text), kickoff <= Date(),
                   ["scheduled", "live"].contains(match["status"].text) {
                    await live.load(api, path + "?section=live")
                    if live.value["status"].text == "finished" { await data.load(api, path) }
                }
            }
        }
        .refreshable { await reload() }
    }
    private func reload() async {
        await data.load(api, path)
        guard data.error == nil, match["externalId"] != .null else { return }
        async let loadForm: () = form.load(api, path + "?section=form")
        if let kickoff = parseDate(match["kickoffTime"].text), kickoff <= Date() {
            await live.load(api, path + "?section=live")
        }
        await loadForm
    }
    private var resultEditorMatch: Value {
        var value = match.object
        for key in ["homeScore", "awayScore", "penaltyHomeScore", "penaltyAwayScore"] {
            value["result" + key.prefix(1).uppercased() + key.dropFirst()] = match["result"][key]
        }
        if match["result"] == .null { value["resultHomeScore"] = .number(0); value["resultAwayScore"] = .number(0) }
        return .object(value)
    }
    @ViewBuilder private func formRows(_ side: String) -> some View {
        Text(match["\(side)Team"]["name"].text).font(.headline)
        ForEach(Array(form.value[side].array.enumerated()), id: \.offset) { _, game in
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(game["result"].text).bold().foregroundStyle(game["result"].text == "W" ? .green : .secondary)
                    Text("\(game["isHome"].flag ? "vs" : "at") \(game["opponentName"].text)")
                    Spacer()
                    Text("\(game["teamScore"].text)–\(game["opponentScore"].text)").monospacedDigit()
                }
                Text("\(parseDate(game["date"].text)?.formatted(date: .abbreviated, time: .omitted) ?? "") · \(game["competition"].text)")
                    .font(.caption).foregroundStyle(.secondary)
            }.font(.subheadline)
        }
        if form.value[side].array.isEmpty && !form.busy { Text("Recent form unavailable.").font(.caption).foregroundStyle(.secondary) }
    }
    @ViewBuilder private func standingRows(_ side: String) -> some View {
        let standing = match["\(side)Standing"]
        VStack(alignment: .leading, spacing: 6) {
            Text(match["\(side)Team"]["name"].text).font(.headline)
            if standing == .null { Text("Standings unavailable.").foregroundStyle(.secondary) }
            else {
                Text("#\(standing["position"].text) · \(standing["points"].text) pts · GD \(standing["goalDifference"].text)")
                Text("Played \(standing["played"].text) · W \(standing["won"].text) · D \(standing["drawn"].text) · L \(standing["lost"].text)").font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

struct MatchesView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var page = 1
    @State private var selected: Set<String> = []
    @State private var search = ""
    @State private var action: String?
    @State private var deleting = false
    private var path: String { "/api/admin/matches?page=\(page)" }
    private var visibleMatches: [Value] {
        data.value["matches"].array
            .filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) }
            .sorted { (parseDate($0["kickoffTime"].text) ?? .distantPast) > (parseDate($1["kickoffTime"].text) ?? .distantPast) }
    }
    private var visibleIDs: Set<String> { Set(visibleMatches.map(\.id)) }
    private var allVisibleSelected: Bool { !visibleIDs.isEmpty && visibleIDs.isSubset(of: selected) }
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
                if !visibleMatches.isEmpty {
                    Button(allVisibleSelected ? "Deselect visible matches" : "Select all visible matches") {
                        if allVisibleSelected { selected.subtract(visibleIDs) }
                        else { selected.formUnion(visibleIDs) }
                    }.disabled(data.busy)
                }
                ForEach(visibleMatches, id: \.id) { match in
                    HStack {
                        Button {
                            if selected.contains(match.id) { selected.remove(match.id) } else { selected.insert(match.id) }
                        } label: { Image(systemName: selected.contains(match.id) ? "checkmark.circle.fill" : "circle") }
                            .buttonStyle(.borderless).accessibilityLabel("Select \(match.title)")
                        NavigationLink { List { DetailRows(value: match) }.navigationTitle("Match details") } label: {
                            VStack(alignment: .leading, spacing: 5) {
                                RecordRow(value: match)
                                if match["externalId"] == .null {
                                    Text("Custom match").font(.caption).foregroundStyle(.secondary)
                                }
                                if match["result"] != .null {
                                    Text("Result: \(match["result"]["homeScore"].text)–\(match["result"]["awayScore"].text)")
                                        .font(.subheadline.monospacedDigit())
                                }
                            }
                        }
                    }
                }
                if visibleMatches.isEmpty && !data.busy { Text(search.isEmpty ? "No matches to display." : "No matches found on this page.").foregroundStyle(.secondary) }
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
        .task(id: page) { await data.load(api, path); reconcileSelection() }
        .refreshable { await data.load(api, path); reconcileSelection() }
        .onChange(of: data.value) { _, _ in reconcileSelection() }
        .confirmationDialog("Run \(action == "fetch-results" ? "result update and scoring" : "fixture import")?", isPresented: Binding(get: { action != nil }, set: { if !$0 { action = nil } }), titleVisibility: .visible) {
            if let action { Button("Continue") { Task { await data.perform(api, "/api/admin/matches", body: ["action": .string(action)], reload: path) } } }
        } message: { Text("This updates the shared game and may send the website’s configured notifications.") }
        .confirmationDialog("Delete \(selected.count) matches and their predictions? This cannot be undone.", isPresented: $deleting, titleVisibility: .visible) {
            Button("Delete matches", role: .destructive) { Task {
                if await data.perform(api, "/api/admin/matches", method: "DELETE", body: ["ids": .array(selected.sorted().map(Value.string))], reload: path) { selected.removeAll() }
            } }
        }
    }
    private func reconcileSelection() {
        selected.formIntersection(Set(data.value["matches"].array.map(\.id)))
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
