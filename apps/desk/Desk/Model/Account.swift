import Foundation
import Observation
import AuthenticationServices
import CryptoKit
import UIKit

/// 观象账号(与网站同一套)。不登录也能用;登录后进度、划线跟着账号走。
struct DeskUser: Codable, Equatable {
    var id: String
    var displayName: String
    var email: String?
    var emailVerified: Bool
    var avatarSeed: String?

    init?(_ d: [String: Any]?) {
        guard let d, let id = d["id"] as? String else { return nil }
        self.id = id
        displayName = (d["displayName"] as? String) ?? "读者"
        email = d["email"] as? String
        emailVerified = d["emailVerified"] as? Bool ?? false
        avatarSeed = d["avatarSeed"] as? String
    }

    /// 头像上的那个字:昵称首字。
    var initial: String { String(displayName.trimmingCharacters(in: .whitespaces).first ?? "读").uppercased() }
}

@MainActor
@Observable
final class AccountStore {
    static let shared = AccountStore()

    private(set) var user: DeskUser?
    private(set) var token: String?
    var busy = false

    var signedIn: Bool { token != nil }

    init() {
        token = Keychain.read()
        if token != nil, let d = UserDefaults.standard.data(forKey: "desk.user"), let u = try? JSONDecoder().decode(DeskUser.self, from: d) { user = u }
        if token == nil { UserDefaults.standard.removeObject(forKey: "desk.user") }
    }

    /// 启动时:用存着的令牌取 /me。服务端说没这个会话就清掉令牌;连不上就先照旧(离线也显示上次的账号)。
    func bootstrap() async {
        guard let t = token else { return }
        do {
            let r = try await API.call("GET", "me", token: t)
            if let u = DeskUser(r["user"] as? [String: Any]) { setUser(u) } else { dropSession() }
        } catch let e as API.Failure where e.status == 401 {
            dropSession()
        } catch {}
    }

    // MARK: 邮箱

    func login(email: String, password: String) async throws {
        let r = try await run { try await API.call("POST", "auth/login", body: ["email": email, "password": password]) }
        try finish(r)
    }

    /// 注册;回 verifySent(验证码是否已发出)。
    func register(email: String, password: String, password2: String) async throws -> Bool {
        let r = try await run { try await API.call("POST", "auth/register", body: ["email": email, "password": password, "password2": password2]) }
        try finish(r)
        return r["verifySent"] as? Bool ?? false
    }

    func verifyEmail(code: String) async throws {
        let t = try need()
        let r = try await run { try await API.call("POST", "auth/email/verify", body: ["code": code], token: t) }
        if let u = DeskUser(r["user"] as? [String: Any]) { setUser(u) }
    }

    func resendVerify() async throws {
        let t = try need()
        try await run { try await API.call("POST", "auth/code/send", body: ["purpose": "verify"], token: t) }
    }

    func sendResetCode(email: String) async throws {
        try await run { try await API.call("POST", "auth/code/send", body: ["purpose": "reset", "email": email]) }
    }

    func resetPassword(email: String, code: String, password: String, password2: String) async throws {
        let r = try await run { try await API.call("POST", "auth/password/reset", body: ["email": email, "code": code, "password": password, "password2": password2]) }
        try finish(r)
    }

    // MARK: Apple

    func signInWithApple(_ cred: ASAuthorizationAppleIDCredential) async throws {
        guard let d = cred.identityToken, let idt = String(data: d, encoding: .utf8) else { throw API.Failure(status: 400, message: "没拿到 Apple 的身份凭证") }
        var body: [String: Any] = ["identityToken": idt]
        if let n = cred.fullName {
            let s = PersonNameComponentsFormatter.localizedString(from: n, style: .default).trimmingCharacters(in: .whitespaces)
            if !s.isEmpty { body["displayName"] = s }
        }
        let r = try await run { try await API.call("POST", "auth/apple", body: body) }
        try finish(r)
    }

    // MARK: Google(ASWebAuthenticationSession + PKCE)

    @ObservationIgnored private var webSession: ASWebAuthenticationSession?
    @ObservationIgnored private let anchor = WebAnchor()

    func signInWithGoogle() async throws {
        let verifier = Self.randomURLSafe(48)       // 64 位
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
        var comps = URLComponents(url: API.base.appendingPathComponent("auth/google/start"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "native", value: "1"), URLQueryItem(name: "code_challenge", value: challenge)]
        let start = comps.url!
        busy = true
        defer { busy = false }
        let callback: URL = try await withCheckedThrowingContinuation { cont in
            let s = ASWebAuthenticationSession(url: start, callbackURLScheme: "guanxiangdesk") { url, err in
                if let url { cont.resume(returning: url); return }
                if let e = err as? ASWebAuthenticationSessionError, e.code == .canceledLogin { cont.resume(throwing: API.Failure(status: -1, message: "")); return }
                cont.resume(throwing: API.Failure(status: 0, message: "Google 登录没打开,稍后再试"))
            }
            s.presentationContextProvider = anchor
            s.prefersEphemeralWebBrowserSession = true
            webSession = s
            if !s.start() { cont.resume(throwing: API.Failure(status: 0, message: "Google 登录没打开,稍后再试")) }
        }
        webSession = nil
        let q = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if let err = q.first(where: { $0.name == "error" })?.value {
            if err == "cancelled" { throw API.Failure(status: -1, message: "") }
            throw API.Failure(status: 400, message: err == "unavailable" ? "登录服务暂时不可用,稍后再试" : "Google 登录没成功,请重试")
        }
        guard let code = q.first(where: { $0.name == "code" })?.value else { throw API.Failure(status: 400, message: "Google 登录没成功,请重试") }
        let r = try await API.call("POST", "auth/native/exchange", body: ["code": code, "verifier": verifier])
        try finish(r)
    }

    // MARK: 登出 / 注销

    /// 登出:服务端删会话(连不上也照样在本机登出)。本机数据全留着。
    func logout() async {
        if let t = token { _ = try? await API.call("POST", "auth/logout", token: t, timeout: 8) }
        dropSession()
    }

    /// 注销账号:confirm 是本账号邮箱;没有邮箱的账号是「注销账号」四个字。
    func deleteAccount(confirm: String) async throws {
        let t = try need()
        try await run { try await API.call("DELETE", "me", body: ["confirm": confirm], token: t) }
        dropSession()
    }

    // MARK: 内部

    private func need() throws -> String {
        guard let t = token else { throw API.Failure(status: 401, message: "登录已失效,请重新登录") }
        return t
    }

    private func run(_ f: () async throws -> [String: Any]) async throws -> [String: Any] {
        busy = true
        defer { busy = false }
        return try await f()
    }

    private func finish(_ r: [String: Any]) throws {
        guard let t = r["token"] as? String, !t.isEmpty, let u = DeskUser(r["user"] as? [String: Any]) else {
            throw API.Failure(status: 500, message: "服务端没有回登录凭证")
        }
        Keychain.save(t)
        token = t
        setUser(u)
        SyncEngine.shared.didLogin()
    }

    private func setUser(_ u: DeskUser) {
        user = u
        if let d = try? JSONEncoder().encode(u) { UserDefaults.standard.set(d, forKey: "desk.user") }
    }

    /// 本机丢掉会话(登出、注销、令牌失效)。
    func dropSession() {
        Keychain.delete()
        token = nil
        user = nil
        UserDefaults.standard.removeObject(forKey: "desk.user")
        SyncEngine.shared.didLogout()
    }

    private static func randomURLSafe(_ n: Int) -> String {
        var b = [UInt8](repeating: 0, count: n)
        _ = SecRandomCopyBytes(kSecRandomDefault, n, &b)
        return Data(b).base64URL
    }
}

/// ASWebAuthenticationSession 要一个窗口来挂浮层。
final class WebAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? scenes.first.map { UIWindow(windowScene: $0) } ?? UIWindow()
        }
    }
}

extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
