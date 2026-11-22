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
    /// 登录成功、但这台设备上的学习记录属于另一个账号:先停在这里等用户选(并入 / 不并入 / 取消登录),什么都不上传。
    private(set) var pendingSwitch: PendingSwitch?

    var signedIn: Bool { token != nil }

    /// 这台设备上的学习记录属于哪个账号(上次跟哪个账号同步过):账号 id 与昵称。登出、注销都不清——
    /// 下次有人用别的账号登录时据此先问一句。从没登录过的设备是 nil:第一次登录照旧直接并入(不登录先用、登录后接上)。
    private(set) var dataOwnerID: String? = UserDefaults.standard.string(forKey: "desk.owner.id")
    private(set) var dataOwnerName: String? = UserDefaults.standard.string(forKey: "desk.owner.name")

    struct PendingSwitch: Identifiable {
        let id = UUID()
        let token: String
        let user: DeskUser
        let previousName: String?
    }

    enum SwitchChoice { case merge, discard, cancel }

    init() {
        token = Keychain.read()
        if token != nil, let d = UserDefaults.standard.data(forKey: "desk.user"), let u = try? JSONDecoder().decode(DeskUser.self, from: d) { user = u }
        if token == nil { UserDefaults.standard.removeObject(forKey: "desk.user") }
        // 老版本没记归属:正登录着的,本机数据就算这个账号的
        if dataOwnerID == nil, token != nil, let u = user { setOwner(u) }
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

    /// 每次点「通过 Apple 登录」现生成一个随机 nonce:请求里放它的 SHA-256(十六进制),苹果把这个哈希写进 identityToken 的
    /// nonce 声明;登录时把原始 nonce 一并发给服务端,服务端核「sha256(nonce) == 令牌里的 nonce」,截获的令牌就没法重放。
    static func newAppleNonce() -> (raw: String, hashed: String) {
        let raw = randomURLSafe(32)
        return (raw, sha256Hex(raw))
    }

    nonisolated static func sha256Hex(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    func signInWithApple(_ cred: ASAuthorizationAppleIDCredential, nonce: String?) async throws {
        guard let d = cred.identityToken, let idt = String(data: d, encoding: .utf8) else { throw API.Failure(status: 400, message: "没拿到 Apple 的身份凭证") }
        var body: [String: Any] = ["identityToken": idt]
        if let nonce { body["nonce"] = nonce }      // 原始 nonce(服务端日后据此核令牌里的哈希;现在的服务端忽略未知字段)
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
        // 本机的记录是上一个(别的)账号的:先别存令牌、别同步,等用户选
        if Self.needsAsk(owner: dataOwnerID, incoming: u.id, hasLocalData: LocalData.hasAny) {
            pendingSwitch = PendingSwitch(token: t, user: u, previousName: dataOwnerName)
            return
        }
        commit(t, u)
    }

    /// 要不要先问:本机记录有主、主不是这次登录的账号、且本机确有记录。没主(从没登录过)或没记录都直接并入。
    nonisolated static func needsAsk(owner: String?, incoming: String, hasLocalData: Bool) -> Bool {
        guard let owner, hasLocalData else { return false }
        return owner != incoming
    }

    /// 换账号时用户的选择。
    func resolveSwitch(_ c: SwitchChoice) async {
        guard let p = pendingSwitch else { return }
        switch c {
        case .merge:
            pendingSwitch = nil
            commit(p.token, p.user)
        case .discard:
            pendingSwitch = nil
            LocalData.wipe()
            commit(p.token, p.user)
        case .cancel:
            // 退回未登录:服务端刚建的会话删掉(连不上就算了,令牌本机没存),本机数据原样不动
            pendingSwitch = nil
            _ = try? await API.call("POST", "auth/logout", token: p.token, timeout: 8)
        }
    }

    private func commit(_ t: String, _ u: DeskUser) {
        Keychain.save(t)
        token = t
        setUser(u)
        setOwner(u)
        SyncEngine.shared.didLogin()
    }

    private func setUser(_ u: DeskUser) {
        user = u
        if let d = try? JSONEncoder().encode(u) { UserDefaults.standard.set(d, forKey: "desk.user") }
        if dataOwnerID == u.id, dataOwnerName != u.displayName { setOwner(u) }
    }

    private func setOwner(_ u: DeskUser) {
        dataOwnerID = u.id
        dataOwnerName = u.email ?? u.displayName
        UserDefaults.standard.set(u.id, forKey: "desk.owner.id")
        UserDefaults.standard.set(dataOwnerName, forKey: "desk.owner.name")
    }

    #if DEBUG
    /// 调试:DESK_FAKESWITCH=1 不连后端,直接弹出「换账号」的选择(假令牌;选并入 / 不并入只走本机那一半,不登录)。
    func debugFakeSwitch() {
        let u = DeskUser(["id": "debug-other", "displayName": "另一个读者", "email": "other@example.test"])!
        pendingSwitch = PendingSwitch(token: "debug", user: u, previousName: dataOwnerName ?? "reader@example.test")
    }
    #endif

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

/// 本机的学习记录(会跟着账号同步的那几样):划线批注、时长、学完、各书位置、每周目标。书桌上摆哪几本、内容包不算。
@MainActor
enum LocalData {
    static var hasAny: Bool {
        HighlightStore.shared.items.contains { !$0.deleted } || !ReadDaysStore.shared.days.isEmpty
            || FinishedStore.shared.hasAny || !ProgressStore.shared.pos.isEmpty || DeskSettings.shared.isGoalSet
    }

    /// 「不并入」:全部清掉(不可恢复),登录后由云端那一份补上。
    static func wipe() {
        HighlightStore.shared.resetAll()
        ReadDaysStore.shared.resetAll()
        FinishedStore.shared.resetAll()
        ProgressStore.shared.resetAll()
        DeskSettings.shared.resetAll()
        Stats.shared.recompute()
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
