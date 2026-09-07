import Foundation
import Security
import SwiftUI

// The existing admin endpoints use both numeric and string IDs.
enum Value: Codable, Equatable {
    case object([String: Value]), array([Value]), string(String), number(Double), bool(Bool), null
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([Value].self) { self = .array(v) }
        else { self = .object(try c.decode([String: Value].self)) }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
    subscript(_ key: String) -> Value { object[key] ?? .null }
    var object: [String: Value] { if case .object(let v) = self { return v }; return [:] }
    var array: [Value] { if case .array(let v) = self { return v }; return [] }
    var text: String {
        switch self {
        case .string(let v): return v
        case .number(let v): return v.formatted(.number.grouping(.never))
        case .bool(let v): return v ? "Yes" : "No"
        default: return ""
        }
    }
    var flag: Bool { self == .bool(true) }
    var id: String { self["_id"].text.isEmpty ? self["id"].text : self["_id"].text }
    var title: String {
        for key in ["name", "userName", "teamName", "ruleName"] where !self[key].text.isEmpty { return self[key].text }
        let home = self["homeTeamName"].text.isEmpty ? self["homeTeam"]["name"].text : self["homeTeamName"].text
        let away = self["awayTeamName"].text.isEmpty ? self["awayTeam"]["name"].text : self["awayTeamName"].text
        return home.isEmpty ? "Details" : "\(home) vs \(away)"
    }
}

struct AdminError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

enum Keychain {
    static let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.maamoun.footballpredictionadmin", kSecAttrAccount as String: "admin-session"]
    static func read() -> String? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func save(_ token: String) throws {
        clear()
        var q = query
        q[kSecValueData as String] = Data(token.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else {
            throw AdminError(message: "Could not securely save your session. Please try again.")
        }
    }
    static func clear() { SecItemDelete(query as CFDictionary) }
}

@MainActor final class AdminAPI: ObservableObject {
    @Published var signedIn = false
    @Published var restoring = true
    @Published var sessionError: String?
    @Published var user: Value = .null
    private var token = Keychain.read()
    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL? = nil, session: URLSession? = nil) {
        self.baseURL = baseURL ?? URL(string: Bundle.main.object(forInfoDictionaryKey: "AdminAPIBaseURL") as? String
            ?? "https://predictions-virid.vercel.app")!
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 90
        config.httpCookieStorage = nil
        config.urlCache = nil
        self.session = session ?? URLSession(configuration: config)
    }
    func request(_ path: String, method: String = "GET", body: [String: Value]? = nil) async throws -> Value {
        guard path.hasPrefix("/api/admin/") || path.hasPrefix("/api/mobile/admin/") else {
            throw AdminError(message: "This operation is unavailable in the admin app.")
        }
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL,
              url.host == baseURL.host else { throw AdminError(message: "Invalid server address") }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let isLogin = path == "/api/mobile/admin/auth/login"
        if !isLogin, let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(Value.object(body))
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AdminError(message: "Invalid server response") }
        let value = (try? JSONDecoder().decode(Value.self, from: data)) ?? .null
        if !isLogin && (http.statusCode == 401 || http.statusCode == 403) {
            signOut()
            sessionError = "Your session expired or admin access was removed. Please sign in again."
        }
        guard (200..<300).contains(http.statusCode) else {
            throw AdminError(message: value["error"].text.isEmpty ? "The server could not complete this request (\(http.statusCode))." : value["error"].text)
        }
        guard value != .null else { throw AdminError(message: "Unexpected response. Check that the admin backend is deployed.") }
        return value
    }
    func login(email: String, password: String) async throws {
        let result = try await request("/api/mobile/admin/auth/login", method: "POST", body: ["email": .string(email), "password": .string(password)])
        guard result["user"]["role"].text == "admin", !result["token"].text.isEmpty else {
            throw AdminError(message: "Only admin accounts can use this app.")
        }
        try Keychain.save(result["token"].text)
        token = result["token"].text
        user = result["user"]
        sessionError = nil
        signedIn = true
    }
    func restore() async {
        defer { restoring = false }
        guard token != nil else { return }
        do {
            user = try await request("/api/mobile/admin/session")["user"]
            signedIn = user["role"].text == "admin"
        } catch { sessionError = error.localizedDescription }
    }
    func signOut() {
        Keychain.clear()
        token = nil
        user = .null
        signedIn = false
    }
}

@MainActor final class Resource: ObservableObject {
    @Published var value: Value = .null
    @Published var busy = false
    @Published var error: String?
    @Published var notice: String?
    private var loadID = UUID()
    func load(_ api: AdminAPI, _ path: String) async {
        let id = UUID()
        loadID = id
        busy = true; error = nil
        defer { if loadID == id { busy = false } }
        do {
            let result = try await api.request(path)
            if loadID == id { value = result }
        } catch {
            if loadID == id && !Task.isCancelled { self.error = error.localizedDescription }
        }
    }
    @discardableResult
    func perform(_ api: AdminAPI, _ path: String, method: String = "POST", body: [String: Value]? = nil,
                 reload: String? = nil, replace: Bool = false) async -> Bool {
        guard !busy else { return false }
        busy = true; error = nil; notice = nil
        defer { busy = false }
        do {
            let result = try await api.request(path, method: method, body: body)
            if replace { value = result }
            let counts = [("inserted", "matches added"), ("skipped", "already existed"),
                          ("updated", "updated"), ("scored", "scored"), ("deleted", "deleted"),
                          ("retroAssigned", "matches assigned"), ("usersTargeted", "users targeted"),
                          ("tokensTargeted", "devices targeted")]
                .compactMap { key, label in result[key].text.isEmpty ? nil : "\(result[key].text) \(label)" }
            notice = result["message"].text.isEmpty
                ? (counts.isEmpty ? "Completed successfully." : counts.joined(separator: ", ") + ".")
                : result["message"].text + (counts.isEmpty ? "" : " " + counts.joined(separator: ", ") + ".")
            // A refresh failure must not suggest that an already-applied mutation failed.
            if let reload {
                do { value = try await api.request(reload) }
                catch { self.error = "Saved, but refresh failed: \(error.localizedDescription)" }
            }
            return true
        } catch { self.error = error.localizedDescription; return false }
    }
}
