import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @StateObject private var users = Resource()
    @StateObject private var matches = Resource()
    @StateObject private var devices = Resource()
    @State private var recipient = "all"
    @State private var title = ""
    @State private var message = ""
    @State private var type = "admin_test"
    @State private var pushMatch = ""
    @State private var liveMatch = ""
    @State private var delayedUser = ""
    @State private var action: String?
    private var needsMatch: Bool { ["goal", "match_reminder"].contains(type) }
    private var types: [(String, String)] { [
        ("admin_test", "Admin test"), ("new_matches", "New matches"),
        ("match_reminder", "Match reminder"), ("goal", "Live goal"),
        ("results", "Results"), ("result_correction", "Result correction"),
        ("season_end", "Season ended"), ("prediction_reminder", "Prediction reminder"),
        ("daily_reminder", "Daily reminder"), ("champion_bonus_enabled", "Champion bonus enabled"),
        ("champion_bonus_locked", "Champion bonus locked"), ("champion_bonus_win", "Champion bonus win"),
        ("champion_bonus_cancelled", "Champion bonus cancelled"), ("qstash_pipeline_test", "Delivery pipeline test")
    ] }
    var body: some View {
        Form {
            StatusRows(data: data)
            StatusRows(data: users)
            StatusRows(data: matches)
            Section("Push notification") {
                Picker("Recipient", selection: $recipient) {
                    Text("All users with registered devices").tag("all")
                    ForEach(users.value.array, id: \.id) { user in Text("\(user.title) · \(user["email"].text)").tag(user.id) }
                }
                if recipient != "all" {
                    StatusRows(data: devices)
                    LabeledContent("Registered devices", value: devices.value["count"].text)
                    NavigationLink("Device details") { List { DetailRows(value: devices.value) }.navigationTitle("Devices") }
                }
                Picker("Type", selection: $type) { ForEach(types, id: \.0) { value, label in Text(label).tag(value) } }
                if needsMatch { matchPicker("Match", selection: $pushMatch) }
                TextField("Title", text: $title)
                TextField("Message", text: $message, axis: .vertical)
                Button("Send notification") { action = "push" }
                    .disabled(data.busy || title.trimmingCharacters(in: .whitespaces).isEmpty || message.trimmingCharacters(in: .whitespaces).isEmpty || (needsMatch && pushMatch.isEmpty) || (recipient != "all" && (devices.busy || devices.value["count"].text == "0" || devices.error != nil)))
            }
            Section("Live goal test") {
                Text("Check the selected match for a score change. Predictors may receive a live goal notification.").font(.footnote).foregroundStyle(.secondary)
                matchPicker("Match", selection: $liveMatch)
                Button("Run live goal test") { action = "live" }.disabled(data.busy || liveMatch.isEmpty)
            }
            Section("Delayed notification test") {
                Text("Schedule a test push through the notification delivery service.").font(.footnote).foregroundStyle(.secondary)
                Picker("Recipient", selection: $delayedUser) {
                    Text("Select a user").tag("")
                    ForEach(users.value.array, id: \.id) { user in Text("\(user.title) · \(user["email"].text)").tag(user.id) }
                }
                Button("Schedule test notification") { action = "delayed" }.disabled(data.busy || delayedUser.isEmpty)
            }
        }.navigationTitle("Notifications")
        .task { await users.load(api, "/api/admin/users"); await matches.load(api, "/api/admin/live-goals/matches") }
        .refreshable { await users.load(api, "/api/admin/users"); await matches.load(api, "/api/admin/live-goals/matches") }
        .task(id: recipient) {
            devices.value = .null
            if recipient != "all" { await devices.load(api, "/api/admin/notifications/devices?userId=\(recipient)") }
        }
        .confirmationDialog(action == "push" ? "Send this notification?" : "Run this notification test?", isPresented: Binding(get: { action != nil }, set: { if !$0 { action = nil } }), titleVisibility: .visible) {
            if let action { Button(action == "push" ? "Send notification" : "Run test") { send(action) } }
        } message: {
            if action == "push" {
                Text("To: \(recipient == "all" ? "all users with registered devices" : users.value.array.first { $0.id == recipient }?.title ?? "selected user")\n\(title)\n\(message)")
            } else { Text("This can send a real notification to users.") }
        }
    }
    private func matchPicker(_ title: String, selection: Binding<String>) -> some View {
        Picker(title, selection: selection) {
            Text("Select a match").tag("")
            ForEach(matches.value["matches"].array, id: \.id) { match in Text("\(match.title) · \(match["status"].text)").tag(match.id) }
        }
    }
    private func send(_ action: String) {
        Task {
            switch action {
            case "push":
                var body: [String: Value] = ["title": .string(title), "text": .string(message), "type": .string(type)]
                if recipient == "all" { body["allUsers"] = .bool(true) }
                else { body["userIds"] = .array([.string(recipient)]) }
                if needsMatch { body["matchId"] = .string(pushMatch) }
                await data.perform(api, "/api/admin/test-notification", body: body)
            case "live": await data.perform(api, "/api/admin/live-goals/test", body: ["matchId": .string(liveMatch)])
            default: await data.perform(api, "/api/admin/qstash-test", body: ["userId": .string(delayedUser)])
            }
        }
    }
}
