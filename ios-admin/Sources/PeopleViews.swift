import SwiftUI

struct UsersView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var search = ""
    @State private var creating = false
    var body: some View {
        List {
            StatusRows(data: data)
            ForEach(data.value.array.filter { search.isEmpty || ($0.title + $0["email"].text).localizedCaseInsensitiveContains(search) }, id: \.id) { user in
                NavigationLink { UserEditor(user: user) } label: { RecordRow(value: user) }
            }
            if data.value.array.isEmpty && !data.busy { Text("No users to display.").foregroundStyle(.secondary) }
        }
        .navigationTitle("Users").searchable(text: $search)
        .toolbar { Button("Add user", systemImage: "plus") { creating = true } }
        .sheet(isPresented: $creating, onDismiss: { Task { await data.load(api, "/api/admin/users") } }) { NavigationStack { UserEditor(user: nil) } }
        .task { await data.load(api, "/api/admin/users") }.refreshable { await data.load(api, "/api/admin/users") }
    }
}

struct UserEditor: View {
    @EnvironmentObject private var api: AdminAPI
    @Environment(\.dismiss) private var dismiss
    @StateObject private var data = Resource()
    let user: Value?
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var notificationEmail = ""
    @State private var role = "user"
    @State private var confirm = false
    var body: some View {
        Form {
            StatusRows(data: data)
            Section("Account") {
                TextField("Name", text: $name).textContentType(.name)
                TextField("Email", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress).autocorrectionDisabled().disabled(user != nil)
                Picker("Role", selection: $role) { Text("User").tag("user"); Text("Admin").tag("admin") }
                SecureField(user == nil ? "Password" : "New password (optional)", text: $password).textContentType(.newPassword)
                if user != nil {
                    TextField("Notification email", text: $notificationEmail).textInputAutocapitalization(.never).keyboardType(.emailAddress).autocorrectionDisabled()
                }
            }
            Button(user == nil ? "Create user" : "Save changes") { confirm = true }
                .disabled(data.busy || name.trimmingCharacters(in: .whitespaces).isEmpty || email.isEmpty || (user == nil && password.isEmpty))
        }
        .navigationTitle(user == nil ? "New user" : "Edit user")
        .toolbar { if user == nil { Button("Cancel") { dismiss() } } }
        .onAppear {
            guard let user else { return }
            name = user["name"].text; email = user["email"].text
            role = user["role"].text; notificationEmail = user["notificationEmail"].text
        }
        .confirmationDialog("\(user == nil ? "Create" : "Update") \(name) as \(role)?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Save") {
                var body: [String: Value] = ["name": .string(name), "email": .string(email), "role": .string(role)]
                if !password.isEmpty { body["password"] = .string(password) }
                if let user { body["id"] = .string(user.id); body["notificationEmail"] = .string(notificationEmail) }
                Task {
                    if await data.perform(api, "/api/admin/users", method: user == nil ? "POST" : "PATCH", body: body) { password = ""; dismiss() }
                }
            }
        } message: { Text(role == "admin" ? "This account will have full admin access." : "This account will have player access.") }
    }
}

struct RemindersView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var search = ""
    private var filtered: [Value] {
        data.value.array.filter { search.isEmpty || ($0.title + $0["userEmail"].text).localizedCaseInsensitiveContains(search) }
    }
    var body: some View {
        List {
            StatusRows(data: data)
            ForEach(filtered, id: \.id) { entry in
                Section {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.title).font(.headline)
                        Text(entry["userEmail"].text).font(.caption).foregroundStyle(.secondary)
                    }
                    ForEach(entry["teams"].array, id: \.id) { team in
                        LabeledContent(team.title, value: team["leagueName"].text)
                    }
                }
            }
            if filtered.isEmpty && !data.busy { Text("No users have enabled reminders yet.").foregroundStyle(.secondary) }
        }
        .navigationTitle("Reminders").searchable(text: $search)
        .task { await data.load(api, "/api/admin/reminders") }.refreshable { await data.load(api, "/api/admin/reminders") }
    }
}

struct GroupsView: View {
    @EnvironmentObject private var api: AdminAPI
    @StateObject private var data = Resource()
    @State private var name = ""
    var body: some View {
        List {
            StatusRows(data: data)
            Section("New group") {
                TextField("Group name", text: $name)
                Button("Create group") { Task {
                    if await data.perform(api, "/api/admin/groups", body: ["name": .string(name)], reload: "/api/admin/groups") { name = "" }
                } }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || data.busy)
            }
            Section("Groups") {
                ForEach(data.value.array, id: \.id) { group in
                    NavigationLink { GroupDetail(groupID: group.id) } label: {
                        VStack(alignment: .leading) {
                            Text(group.title)
                            Text("\(group["memberCount"].text) members\(group["isDefault"].flag ? " · Default" : "")").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }.navigationTitle("Groups").task { await data.load(api, "/api/admin/groups") }.refreshable { await data.load(api, "/api/admin/groups") }
    }
}

struct GroupDetail: View {
    @EnvironmentObject private var api: AdminAPI
    @Environment(\.dismiss) private var dismiss
    @StateObject private var data = Resource()
    @StateObject private var users = Resource()
    let groupID: String
    @State private var name = ""
    @State private var selectedUser = ""
    @State private var removing: Value?
    @State private var delete = false
    private var path: String { "/api/admin/groups/\(groupID)" }
    var body: some View {
        Form {
            StatusRows(data: data)
            Section("Group") {
                TextField("Name", text: $name)
                Button("Rename group") { Task { await data.perform(api, path, method: "PATCH", body: ["name": .string(name)], reload: path) } }
                    .disabled(data.busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            Section("Members") {
                ForEach(data.value["members"].array, id: \.id) { member in
                    HStack {
                        RecordRow(value: member)
                        Spacer()
                        if !data.value["isDefault"].flag {
                            Button("Remove", role: .destructive) { removing = member }.disabled(data.busy)
                        }
                    }
                }
            }
            Section("Add member") {
                StatusRows(data: users)
                Picker("User", selection: $selectedUser) {
                    Text("Select a user").tag("")
                    ForEach(users.value.array.filter { user in !data.value["members"].array.contains { $0.id == user.id } }, id: \.id) { user in
                        Text("\(user.title) · \(user["email"].text)").tag(user.id)
                    }
                }
                Button("Add member") { Task {
                    if await data.perform(api, path, method: "PATCH", body: ["action": .string("add-member"), "userId": .string(selectedUser)], reload: path) { selectedUser = "" }
                } }.disabled(selectedUser.isEmpty || data.busy)
            }
            if data.value != .null && !data.value["isDefault"].flag {
                Button("Delete group", role: .destructive) { delete = true }.disabled(data.busy)
            }
        }.navigationTitle(data.value.title)
        .task {
            await data.load(api, path); name = data.value["name"].text
            await users.load(api, "/api/admin/users")
        }
        .refreshable { await data.load(api, path); await users.load(api, "/api/admin/users") }
        .confirmationDialog("Remove \(removing?.title ?? "member") from this group?", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }), titleVisibility: .visible) {
            if let member = removing { Button("Remove member", role: .destructive) { Task {
                await data.perform(api, path, method: "PATCH", body: ["action": .string("remove-member"), "userId": .string(member.id)], reload: path)
            } } }
        }
        .confirmationDialog("Delete \(data.value.title)? Memberships will be removed.", isPresented: $delete, titleVisibility: .visible) {
            Button("Delete group", role: .destructive) { Task { if await data.perform(api, path, method: "DELETE") { dismiss() } } }
        }
    }
}
