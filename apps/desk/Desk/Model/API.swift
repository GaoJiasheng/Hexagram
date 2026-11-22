import Foundation
import Security

/// 观象服务端接口(与网站同一套 /api)。所有请求带 `X-Client: native`;登录后带 `Authorization: Bearer`。
/// 服务端的错误信息多是中文,原样透给界面;少数英文的(「login required」之类)在这里换成中文。
enum API {
    #if DEBUG
    /// 调试连本机起的后端(`npx wrangler pages dev dist --port 8788`);可用环境变量 DESK_API 改。调试版绝不连线上。
    static let base = URL(string: ProcessInfo.processInfo.environment["DESK_API"] ?? "http://localhost:8788/api")!
    #else
    static let base = URL(string: "https://hexa.gavin.pub/api")!
    #endif

    struct Failure: Error, LocalizedError {
        var status: Int       // 0 = 没连上
        var message: String
        var errorDescription: String? { message }
        var offline: Bool { status == 0 }
    }

    /// 最近一次连不上时的底层错误(只给调试日志用)。
    nonisolated(unsafe) static var lastNetError = ""

    private static let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 20
        c.httpCookieStorage = nil          // 原生通道只认 Bearer,不留服务端种的 cookie
        c.httpShouldSetCookies = false
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    /// 发一个 JSON 请求,回 JSON 对象(204 回空字典)。非 2xx 抛 Failure(带服务端的中文说明)。
    @discardableResult
    static func call(_ method: String, _ path: String, body: [String: Any]? = nil, token: String? = nil, timeout: TimeInterval = 20) async throws -> [String: Any] {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = method
        req.timeoutInterval = timeout
        req.setValue("native", forHTTPHeaderField: "X-Client")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(for: req) }
        catch let e as URLError where e.code == .networkConnectionLost {
            // 复用的长连接被对端关了(本机后端常见):换条连接重发一次
            do { (data, resp) = try await session.data(for: req) }
            catch { throw Failure(status: 0, message: "连不上服务器,检查一下网络") }
        }
        catch { lastNetError = (error as? URLError).map { "URLError \($0.code.rawValue)" } ?? "\(error)"; throw Failure(status: 0, message: "连不上服务器,检查一下网络") }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200..<300).contains(status) else {
            throw Failure(status: status, message: humanize(obj["error"] as? String, status: status))
        }
        return obj
    }

    private static func humanize(_ s: String?, status: Int) -> String {
        guard let s, !s.isEmpty else { return status >= 500 ? "服务暂时不可用,稍后再试" : "请求没成功(\(status))" }
        // 有中文的直接用
        if s.unicodeScalars.contains(where: { (0x4E00...0x9FFF).contains($0.value) }) { return s }
        switch s {
        case "login required": return "登录已失效,请重新登录"
        case "service unavailable": return "服务暂时不可用,稍后再试"
        case "request body too large": return "内容太大,传不上去"
        case "invalid JSON body": return "请求格式不对"
        case "invalid verifier", "invalid code_challenge": return "登录校验没通过,请重试"
        default: return status >= 500 ? "服务暂时不可用,稍后再试" : "请求没成功:\(s)"
        }
    }

    /// 线上传的时间:带毫秒的 ISO 8601(与网站 `new Date().toISOString()` 一致)。读时两种都认。
    static func iso(_ d: Date) -> String { isoMS.string(from: d) }
    static func date(_ v: Any?) -> Date? {
        guard let s = v as? String else { return nil }
        return isoMS.date(from: s) ?? isoPlain.date(from: s)
    }
    nonisolated(unsafe) private static let isoMS: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    nonisolated(unsafe) private static let isoPlain: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f }()
}

/// 会话令牌只放钥匙串(本机、解锁后可读、不随备份到别的设备)。
enum Keychain {
    private static let service = "pub.gavin.hexa.desk.session"

    static func read() -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: "token", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }

    static func save(_ token: String) {
        delete()
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: "token", kSecValueData as String: Data(token.utf8),
                                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        SecItemAdd(q as CFDictionary, nil)
    }

    static func delete() {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "token"]
        SecItemDelete(q as CFDictionary)
    }
}

/// 有改动待推的条目:键 → 改动序号。推之前记下快照,推成功后只清掉快照之后没再改过的(推的路上又改了的留着下一轮)。
struct DirtySet: Codable {
    private(set) var stamps: [String: Int] = [:]
    private var counter = 0
    var isEmpty: Bool { stamps.isEmpty }
    var keys: Set<String> { Set(stamps.keys) }
    mutating func mark(_ k: String) { counter += 1; stamps[k] = counter }
    mutating func clear(_ snap: [String: Int]) { for (k, v) in snap where stamps[k] == v { stamps[k] = nil } }
    mutating func removeAll() { stamps.removeAll() }
}
