import Foundation
import Security

/// Secure key/value storage backed by the Keychain (replaces `expo-secure-store`).
protocol SecureStorage: Sendable {
    func get(_ key: String) -> String?
    func set(_ value: String, for key: String)
    func remove(_ key: String)
}

struct KeychainStorage: SecureStorage {
    private let service = "com.maamoun.footballpredictions"

    private func baseQuery(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }

    func get(_ key: String) -> String? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func set(_ value: String, for key: String) {
        remove(key)
        var query = baseQuery(key)
        query[kSecValueData as String] = Data(value.utf8)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(query as CFDictionary, nil)
    }

    func remove(_ key: String) {
        SecItemDelete(baseQuery(key) as CFDictionary)
    }
}

/// In-memory storage for tests/previews.
final class MemoryStorage: SecureStorage, @unchecked Sendable {
    private var values: [String: String] = [:]
    private let lock = NSLock()
    func get(_ key: String) -> String? { lock.withLock { values[key] } }
    func set(_ value: String, for key: String) { lock.withLock { values[key] = value } }
    func remove(_ key: String) { lock.withLock { _ = values.removeValue(forKey: key) } }
}
