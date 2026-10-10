import Foundation

enum HTTPMethod: String, Sendable {
    case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE"
}

struct EmptyResponse: Decodable, Sendable {}

/// `URLSession` wrapper equivalent to `mobile/src/api/client.ts`:
/// Bearer token, JSON body, `{ error }` body -> `ApiError(message, status)`.
struct ApiClient: Sendable {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func request<T: Decodable & Sendable>(
        _ path: String,
        method: HTTPMethod = .get,
        body: (any Encodable & Sendable)? = nil,
        token: String? = nil
    ) async throws -> T {
        guard let url = URL(string: baseURL.absoluteString + path) else {
            throw ApiError(message: "Invalid URL", status: 0)
        }
        var req = URLRequest(url: url)
        req.httpMethod = method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        if let token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        if !(200..<300).contains(status) {
            throw ApiError(message: Self.errorMessage(from: data) ?? "Request failed (\(status))", status: status)
        }
        if data.isEmpty, let empty = EmptyResponse() as? T { return empty }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw ApiError(message: "Unexpected response from server", status: status)
        }
    }

    /// Fire-and-forget variant for endpoints whose body we ignore.
    func send(
        _ path: String,
        method: HTTPMethod,
        body: (any Encodable & Sendable)? = nil,
        token: String? = nil
    ) async throws {
        let _: EmptyResponse = try await request(path, method: method, body: body, token: token)
    }

    private static func errorMessage(from data: Data) -> String? {
        guard
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let message = object["error"] as? String
        else { return nil }
        return message
    }
}
