import SwiftUI
import AuthenticationServices

/// 书桌右上角的账号入口:未登录显示「登录」,已登录是带昵称首字的圆形头像。
struct AccountButton: View {
    var scale: CGFloat = 1
    let open: () -> Void
    private var account: AccountStore { .shared }
    var body: some View {
        Button(action: open) {
            if let u = account.user {
                Text(u.initial).font(Fonts.song(17 * scale, bold: true)).foregroundStyle(.white)
                    .frame(width: 38 * scale, height: 38 * scale)
                    .background(Ink.cinnabar.gradient, in: Circle())
                    .overlay(alignment: .bottomTrailing) {
                        if SyncEngine.shared.failing {
                            Circle().fill(Ink.faint).frame(width: 10 * scale, height: 10 * scale).overlay(Circle().stroke(Ink.paper, lineWidth: 2))
                        }
                    }
            } else {
                Text("登录").font(.system(size: 15 * scale, weight: .semibold)).foregroundStyle(Ink.cinnabar)
                    .padding(.horizontal, 16 * scale).padding(.vertical, 8 * scale)
                    .background(Ink.cinnabar.opacity(0.1), in: Capsule())
            }
        }
        .accessibilityLabel(account.user == nil ? "登录" : "账号:\(account.user!.displayName)")
    }
}

/// 账号面板。未登录:邮箱登录 / 注册 / 忘记密码,下面 Apple、Google;已登录:昵称、邮箱、同步状态、登出、注销。
struct AccountSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showAbout = false
    @State private var showImport = false
    private var account: AccountStore { .shared }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    StatsLinkRow()
                    if account.user != nil { SignedInView() } else { SignInView() }
                    VStack(spacing: 10) {
                        CustomImportLinkRow()
                        AboutLinkRow()
                    }
                    .padding(.top, 8)
                }
                .frame(maxWidth: 440)
                .padding(.horizontal, 24).padding(.vertical, 20)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Ink.paper.ignoresSafeArea())
            .navigationTitle(account.user == nil ? "登录观象" : "我的账号").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
            .navigationDestination(isPresented: $showAbout) { AboutScreen() }
            .navigationDestination(isPresented: $showImport) { CustomImportScreen() }
        }
        .presentationDetents([.large])
        #if DEBUG
        .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "about" { try? await Task.sleep(nanoseconds: 500_000_000); showAbout = true } }
        .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "import" { try? await Task.sleep(nanoseconds: 500_000_000); showImport = true } }
        #endif
        .interactiveDismissDisabled(account.pendingSwitch != nil)
        .sheet(item: Binding(get: { account.pendingSwitch }, set: { _ in })) { p in
            AccountSwitchSheet(pending: p)
        }
        #if DEBUG
        .task { if ProcessInfo.processInfo.environment["DESK_FAKESWITCH"] == "1" { try? await Task.sleep(nanoseconds: 600_000_000); account.debugFakeSwitch() } }
        #endif
    }
}

/// 换账号:这台设备上的学习记录属于上一个账号,这次登录的是另一个。选之前什么都不上传;不能划掉,只能三选一。
struct AccountSwitchSheet: View {
    let pending: AccountStore.PendingSwitch
    @State private var confirmDiscard = false
    @State private var working = false
    private var account: AccountStore { .shared }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Image(systemName: "person.2.badge.gearshape").font(.system(size: 30, weight: .medium)).foregroundStyle(Ink.cinnabar)
                    .accessibilityHidden(true)
                Text("这台设备上留着上一个账号的学习记录").font(Fonts.song(22, bold: true)).foregroundStyle(Ink.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text(intro).font(.system(size: 15)).foregroundStyle(Ink.soft).lineSpacing(5).fixedSize(horizontal: false, vertical: true)

                choice("并入现在这个账号", "本机的划线、批注、学习时长、进度并进「\(who(pending.user))」,以后跟着这个账号走。", icon: "arrow.triangle.merge", primary: true) {
                    Task { working = true; await account.resolveSwitch(.merge); working = false }
                }
                choice("不并入", "本机改用这个账号云端的记录;本机现在这一份会被丢弃。", icon: "icloud.and.arrow.down") {
                    confirmDiscard = true
                }
                choice("取消登录", "退回未登录,本机的记录原样不动。", icon: "xmark.circle") {
                    Task { working = true; await account.resolveSwitch(.cancel); working = false }
                }
            }
            .frame(maxWidth: 460, alignment: .leading)
            .padding(.horizontal, 24).padding(.vertical, 28)
            .frame(maxWidth: .infinity)
        }
        .background(Ink.paper.ignoresSafeArea())
        .disabled(working)
        .interactiveDismissDisabled(true)
        .presentationDetents([.large])
        .confirmationDialog("丢弃本机这一份记录?", isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button("丢弃本机记录,用云端的", role: .destructive) {
                Task { working = true; await account.resolveSwitch(.discard); working = false }
            }
            Button("再想想", role: .cancel) {}
        } message: {
            Text("本机的划线、批注、学习时长、学完记录与各书进度会全部删掉,不能恢复。上一个账号云端的那份不受影响。")
        }
    }

    private var intro: String {
        let prev = pending.previousName.map { "「\($0)」" } ?? "上一个账号"
        return "这台设备上的记录上次是跟\(prev)同步的,这次登录的是「\(who(pending.user))」。选好之前,什么都不会上传。"
    }

    private func who(_ u: DeskUser) -> String { u.email ?? u.displayName }

    private func choice(_ title: String, _ sub: String, icon: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: icon).font(.system(size: 18, weight: .semibold)).frame(width: 26)
                    .foregroundStyle(primary ? .white : Ink.cinnabar)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 17, weight: .semibold)).foregroundStyle(primary ? .white : Ink.text)
                    Text(sub).font(.system(size: 13)).foregroundStyle(primary ? .white.opacity(0.85) : Ink.soft)
                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(primary ? AnyShapeStyle(Ink.cinnabar) : AnyShapeStyle(Ink.card), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(primary ? .clear : Ink.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// 账号面板顶上一行:去统计页(本周已学 · 连续周数)。
private struct StatsLinkRow: View {
    private var stats: Stats { .shared }
    var body: some View {
        NavigationLink { StatsScreen() } label: {
            HStack(spacing: 14) {
                WeekRing(progress: Double(stats.thisWeekSec) / Double(max(stats.goalSec, 1)), size: 40, line: 5)
                VStack(alignment: .leading, spacing: 3) {
                    Text("学习统计").font(.system(size: 16, weight: .semibold)).foregroundStyle(Ink.text)
                    Text("本周 \(Fmt.dur(stats.thisWeekSec)) / \(Fmt.dur(stats.goalSec))" + (stats.streakWeeks > 0 ? " · 连续 \(stats.streakWeeks) 周" : ""))
                        .font(.system(size: 13)).foregroundStyle(Ink.soft)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Ink.faint)
            }
            .padding(16)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
    }
}

// MARK: 未登录

private struct SignInView: View {
    enum Mode { case login, register, forgot }
    @State private var mode: Mode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var password2 = ""
    @State private var code = ""
    @State private var codeSent = false
    @State private var error: String?
    @State private var info: String?
    /// 这一次 Apple 登录请求用的原始 nonce(按一次按钮换一个)。
    @State private var appleNonce: String?
    @Environment(\.colorScheme) private var scheme
    private var account: AccountStore { .shared }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("不登录也能用,登录后进度与划线会跟着账号走。和观象网站是同一个账号。")
                .font(.system(size: 14)).foregroundStyle(Ink.soft).lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            if mode != .forgot {
                Picker("", selection: $mode) {
                    Text("登录").tag(Mode.login)
                    Text("注册").tag(Mode.register)
                }
                .pickerStyle(.segmented)
            } else {
                HStack {
                    Button { mode = .login; error = nil; info = nil } label: { Label("返回登录", systemImage: "chevron.left") }
                        .font(.system(size: 14, weight: .medium)).foregroundStyle(Ink.cinnabar)
                    Spacer()
                }
                Text("找回密码").font(Fonts.song(20, bold: true)).foregroundStyle(Ink.text)
                Text("先发验证码到注册邮箱,再设新密码。").font(.system(size: 13)).foregroundStyle(Ink.soft)
            }

            VStack(spacing: 12) {
                field("邮箱", text: $email, kind: .email)
                switch mode {
                case .login:
                    field("密码", text: $password, kind: .password)
                case .register:
                    field("密码(8 位以上)", text: $password, kind: .newPassword)
                    field("再输一遍密码", text: $password2, kind: .newPassword)
                case .forgot:
                    if codeSent {
                        field("邮件里的 6 位验证码", text: $code, kind: .code)
                        field("新密码(8 位以上)", text: $password, kind: .newPassword)
                        field("再输一遍新密码", text: $password2, kind: .newPassword)
                    }
                }
            }

            if let error { Text(error).font(.system(size: 13)).foregroundStyle(Ink.cinnabar).fixedSize(horizontal: false, vertical: true) }
            if let info { Text(info).font(.system(size: 13)).foregroundStyle(Ink.soft).fixedSize(horizontal: false, vertical: true) }

            Button { Task { await submit() } } label: {
                HStack {
                    if account.busy { ProgressView().tint(.white) }
                    Text(primaryTitle).font(.system(size: 17, weight: .semibold))
                }
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(Ink.cinnabar, in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(.white)
            }
            .disabled(account.busy)

            if mode == .login {
                Button("忘记密码?") { mode = .forgot; error = nil; info = nil; codeSent = false; password = ""; password2 = "" }
                    .font(.system(size: 14)).foregroundStyle(Ink.soft)
                    .frame(maxWidth: .infinity)
            }
            if mode == .forgot && codeSent {
                Button("重发验证码") { Task { await sendCode() } }.font(.system(size: 14)).foregroundStyle(Ink.soft).frame(maxWidth: .infinity)
            }

            if mode != .forgot {
                HStack(spacing: 12) {
                    Rectangle().fill(Ink.line).frame(height: 1)
                    Text("或").font(.system(size: 13)).foregroundStyle(Ink.faint)
                    Rectangle().fill(Ink.line).frame(height: 1)
                }
                .padding(.vertical, 4)

                SignInWithAppleButton(.signIn) { req in
                    req.requestedScopes = [.fullName, .email]
                    let n = AccountStore.newAppleNonce()
                    appleNonce = n.raw
                    req.nonce = n.hashed
                } onCompletion: { result in
                    Task { await apple(result) }
                }
                .signInWithAppleButtonStyle(scheme == .dark ? .white : .black)
                .frame(height: 50)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .accessibilityLabel("通过 Apple 登录")

                Button { Task { await google() } } label: {
                    HStack(spacing: 10) {
                        Text("G").font(.system(size: 19, weight: .bold, design: .rounded)).foregroundStyle(Ink.cinnabar)
                        Text("用 Google 登录").font(.system(size: 17, weight: .medium)).foregroundStyle(Ink.text)
                    }
                    .frame(maxWidth: .infinity).frame(height: 50)
                    .background(Ink.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Ink.line, lineWidth: 1))
                }
                .disabled(account.busy)
            }
        }
        .onChange(of: mode) { _, _ in error = nil; info = nil }
        #if DEBUG
        .onAppear {   // 调试:DESK_EMAIL / DESK_PW 预填(模拟器里打字不稳)
            let env = ProcessInfo.processInfo.environment
            if let e = env["DESK_EMAIL"], email.isEmpty { email = e }
            if let p = env["DESK_PW"], password.isEmpty { password = p; password2 = p }
            if env["DESK_MODE"] == "register" { mode = .register }
        }
        #endif
    }

    private var primaryTitle: String {
        switch mode {
        case .login: return "登录"
        case .register: return "注册"
        case .forgot: return codeSent ? "设置新密码并登录" : "发验证码"
        }
    }

    private func submit() async {
        error = nil; info = nil
        let e = email.trimmingCharacters(in: .whitespaces)
        guard !e.isEmpty else { error = "请输入邮箱"; return }
        do {
            switch mode {
            case .login:
                try await account.login(email: e, password: password)
            case .register:
                let sent = try await account.register(email: e, password: password, password2: password2)
                PendingVerify.shared.justRegistered = sent
            case .forgot:
                if !codeSent { await sendCode(); return }
                try await account.resetPassword(email: e, code: code.trimmingCharacters(in: .whitespaces), password: password, password2: password2)
            }
            password = ""; password2 = ""; code = ""
        } catch { show(error) }
    }

    private func sendCode() async {
        error = nil
        do {
            try await account.sendResetCode(email: email.trimmingCharacters(in: .whitespaces))
            codeSent = true
            info = "如果这个邮箱注册过观象,验证码已经发过去了(10 分钟内有效)。"
        } catch { show(error) }
    }

    private func apple(_ result: Result<ASAuthorization, Error>) async {
        error = nil
        switch result {
        case .success(let auth):
            guard let cred = auth.credential as? ASAuthorizationAppleIDCredential else { error = "Apple 登录没成功"; return }
            do { try await account.signInWithApple(cred, nonce: appleNonce) } catch { show(error) }
            appleNonce = nil
        case .failure(let e):
            if (e as? ASAuthorizationError)?.code == .canceled { return }
            error = "Apple 登录没成功:\(e.localizedDescription)"
        }
    }

    private func google() async {
        error = nil
        do { try await account.signInWithGoogle() } catch { show(error) }
    }

    private func show(_ e: Error) {
        if let f = e as? API.Failure { if f.status != -1 { error = f.message } } else { error = e.localizedDescription }
    }

    enum Kind { case email, password, newPassword, code }
    private func field(_ title: String, text: Binding<String>, kind: Kind) -> some View {
        Group {
            switch kind {
            case .password, .newPassword:
                SecureField(title, text: text).textContentType(kind == .password ? .password : .newPassword)
            case .email:
                TextField(title, text: text).textContentType(.username).keyboardType(.emailAddress)
            case .code:
                TextField(title, text: text).textContentType(.oneTimeCode).keyboardType(.numberPad)
            }
        }
        .textInputAutocapitalization(.never).autocorrectionDisabled()
        .font(.system(size: 17))
        .padding(.horizontal, 14).frame(height: 50)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Ink.line, lineWidth: 1))
    }
}

/// 刚注册完:已登录面板顶上提示去邮箱收验证码。
@MainActor
@Observable
final class PendingVerify {
    static let shared = PendingVerify()
    var justRegistered = false
}

// MARK: 已登录

private struct SignedInView: View {
    @State private var code = ""
    @State private var error: String?
    @State private var info: String?
    @State private var askDelete = false
    private var account: AccountStore { .shared }
    private var sync: SyncEngine { .shared }

    var body: some View {
        if let u = account.user {
            VStack(alignment: .leading, spacing: 20) {
                HStack(spacing: 16) {
                    Text(u.initial).font(Fonts.song(28, bold: true)).foregroundStyle(.white)
                        .frame(width: 64, height: 64).background(Ink.cinnabar.gradient, in: Circle())
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(u.displayName).font(Fonts.song(22, bold: true)).foregroundStyle(Ink.text).lineLimit(1)
                        if let e = u.email {
                            HStack(spacing: 6) {
                                Text(e).font(.system(size: 14)).foregroundStyle(Ink.soft).lineLimit(1).truncationMode(.middle)
                                if !u.emailVerified {
                                    Text("未验证").font(.system(size: 11, weight: .semibold)).foregroundStyle(Ink.cinnabar)
                                        .padding(.horizontal, 6).padding(.vertical, 2).background(Ink.cinnabar.opacity(0.1), in: Capsule())
                                }
                            }
                        } else {
                            Text("未留邮箱").font(.system(size: 14)).foregroundStyle(Ink.faint)
                        }
                    }
                    Spacer(minLength: 0)
                }

                if !u.emailVerified, u.email != nil { verifyBox(u) }

                card {
                    HStack(spacing: 12) {
                        Image(systemName: sync.failing ? "icloud.slash" : "checkmark.icloud")
                            .font(.system(size: 20)).foregroundStyle(sync.failing ? Ink.faint : Ink.cinnabar)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 3) {
                            TimelineView(.periodic(from: .now, by: 20)) { ctx in
                                Text(sync.syncing && !sync.failing ? "正在同步…" : sync.statusText(now: ctx.date))
                                    .font(.system(size: 16, weight: .semibold)).foregroundStyle(Ink.text)
                            }
                            Text("进度、划线与批注、学习时长、学完的书跟着账号走;书桌上摆哪几本只存这台设备。")
                                .font(.system(size: 12)).foregroundStyle(Ink.soft).fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }
                    Button { sync.syncNow() } label: {
                        Label("立即同步", systemImage: "arrow.triangle.2.circlepath")
                            .font(.system(size: 15, weight: .semibold)).frame(maxWidth: .infinity).padding(.vertical, 11)
                            .background(Ink.cinnabar.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(Ink.cinnabar)
                    }
                    .disabled(sync.syncing)
                }

                Button { Task { await account.logout() } } label: {
                    Text("登出").font(.system(size: 16, weight: .medium)).frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(Ink.card, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Ink.line, lineWidth: 1))
                        .foregroundStyle(Ink.text)
                }
                Text("登出后,这台设备上的进度与划线照样留着。").font(.system(size: 12)).foregroundStyle(Ink.faint).frame(maxWidth: .infinity)

                Button { askDelete = true } label: {
                    Text("注销账号").font(.system(size: 14)).foregroundStyle(Ink.cinnabar).frame(maxWidth: .infinity)
                }
                .padding(.top, 12)
            }
            .sheet(isPresented: $askDelete) { DeleteAccountSheet(user: u) }
        }
    }

    private func verifyBox(_ u: DeskUser) -> some View {
        card {
            Text(PendingVerify.shared.justRegistered ? "注册好了。验证码已发到邮箱,填在这里完成验证:" : "邮箱还没验证。验证码发到邮箱,填在这里:")
                .font(.system(size: 14)).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                TextField("6 位验证码", text: $code).keyboardType(.numberPad).textContentType(.oneTimeCode)
                    .font(.system(size: 17)).padding(.horizontal, 12).frame(height: 46)
                    .background(Ink.paper, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Ink.line, lineWidth: 1))
                Button("验证") {
                    Task {
                        error = nil; info = nil
                        do { try await account.verifyEmail(code: code.trimmingCharacters(in: .whitespaces)); PendingVerify.shared.justRegistered = false; code = "" }
                        catch { self.error = (error as? API.Failure)?.message ?? error.localizedDescription }
                    }
                }
                .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                .padding(.horizontal, 18).frame(height: 46).background(Ink.cinnabar, in: RoundedRectangle(cornerRadius: 10))
                .disabled(account.busy)
            }
            HStack {
                Button("重发验证码") {
                    Task {
                        error = nil; info = nil
                        do { try await account.resendVerify(); info = "已重发,看一下邮箱。" }
                        catch { self.error = (error as? API.Failure)?.message ?? error.localizedDescription }
                    }
                }
                .font(.system(size: 13)).foregroundStyle(Ink.soft)
                Spacer()
                Text("不验证也能用").font(.system(size: 12)).foregroundStyle(Ink.faint)
            }
            if let error { Text(error).font(.system(size: 13)).foregroundStyle(Ink.cinnabar) }
            if let info { Text(info).font(.system(size: 13)).foregroundStyle(Ink.soft) }
        }
    }

    private func card<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 14) { c() }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
    }
}

/// 注销账号:抄一遍邮箱(没有邮箱的账号输入「注销账号」)再永久注销。「我的账号」与「关于」两处都能进(App 审核要求注销入口好找)。
struct DeleteAccountSheet: View {
    let user: DeskUser
    @Environment(\.dismiss) private var dismiss
    @State private var confirmText = ""
    @State private var deleteError: String?
    private var account: AccountStore { .shared }

    var body: some View {
        let u = user
        let want = u.email ?? "注销账号"
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("注销后,这个账号和云端的进度、划线、批注、学习时长都会删掉,网站上也登不进来了,不能恢复。这台设备上的数据还留着。")
                    .font(.system(size: 15)).foregroundStyle(Ink.text).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                Text(u.email != nil ? "确认的话,把本账号的邮箱抄一遍:" : "确认的话,输入「注销账号」四个字:")
                    .font(.system(size: 14)).foregroundStyle(Ink.soft)
                Text(want).font(.system(size: 15, weight: .semibold)).foregroundStyle(Ink.text).textSelection(.disabled)
                TextField(want, text: $confirmText)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(u.email != nil ? .emailAddress : .default)
                    .font(.system(size: 17)).padding(.horizontal, 14).frame(height: 50)
                    .background(Ink.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Ink.line, lineWidth: 1))
                if let deleteError { Text(deleteError).font(.system(size: 13)).foregroundStyle(Ink.cinnabar) }
                Button(role: .destructive) {
                    Task {
                        deleteError = nil
                        do { try await account.deleteAccount(confirm: confirmText.trimmingCharacters(in: .whitespaces)); dismiss() }
                        catch { deleteError = (error as? API.Failure)?.message ?? error.localizedDescription }
                    }
                } label: {
                    Text("永久注销").font(.system(size: 17, weight: .semibold)).frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Ink.cinnabar.opacity(confirmText.isEmpty ? 0.35 : 1), in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(.white)
                }
                .disabled(confirmText.isEmpty || account.busy)
                Spacer()
            }
            .frame(maxWidth: 440)
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(Ink.paper.ignoresSafeArea())
            .navigationTitle("注销账号").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}
