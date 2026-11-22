import SwiftUI

/// 账号面板底部一行:去「关于」。
struct AboutLinkRow: View {
    var body: some View {
        NavigationLink { AboutScreen() } label: {
            HStack(spacing: 12) {
                Image(systemName: "info.circle").font(.system(size: 17, weight: .medium)).foregroundStyle(Ink.soft)
                    .accessibilityHidden(true)
                Text("关于观象 · 书桌").font(.system(size: 15, weight: .medium)).foregroundStyle(Ink.text)
                Spacer(minLength: 0)
                Text("隐私 · 联系 · 注销").font(.system(size: 12)).foregroundStyle(Ink.faint)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Ink.faint)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}

/// 关于:版本、内容来源、隐私政策、联系、字体许可、注销账号入口。
struct AboutScreen: View {
    @State private var askDelete = false
    @State private var showOFL = false
    private var account: AccountStore { .shared }

    static let privacyURL = URL(string: "https://hexa.gavin.pub/privacy")!
    static let siteURL = URL(string: "https://hexa.gavin.pub")!
    static let contact = "hexa@gavin.pub"

    private var version: String {
        let i = Bundle.main.infoDictionary ?? [:]
        let v = i["CFBundleShortVersionString"] as? String ?? "—"
        let b = i["CFBundleVersion"] as? String ?? "—"
        return "版本 \(v)(\(b))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("观象 · 书桌").font(Fonts.song(26, bold: true)).foregroundStyle(Ink.text)
                    Text(version).font(Fonts.num(13, weight: .medium)).foregroundStyle(Ink.soft)
                }
                section {
                    Text("内容来自观象 hexa.gavin.pub:原文取通行本,逐段译注、详注与白话深读都出自观象的研读底本。")
                        .font(.system(size: 15)).foregroundStyle(Ink.text).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                    Link(destination: Self.siteURL) { row("观象网站", "hexa.gavin.pub", icon: "globe") }
                }
                section {
                    Link(destination: Self.privacyURL) { row("隐私政策", "不追踪;登录后才同步", icon: "hand.raised") }
                    Divider().overlay(Ink.line)
                    Link(destination: URL(string: "mailto:\(Self.contact)")!) { row("联系我们", Self.contact, icon: "envelope") }
                }
                section {
                    Text("账号").font(.system(size: 12, weight: .semibold)).kerning(2).foregroundStyle(Ink.soft)
                    if let u = account.user {
                        Button { askDelete = true } label: { row("注销账号", "删除账号与云端记录,不可恢复", icon: "person.crop.circle.badge.xmark", tint: Ink.cinnabar) }
                            .buttonStyle(.plain)
                            .sheet(isPresented: $askDelete) { DeleteAccountSheet(user: u) }
                    } else {
                        Text("登录后,可以在「我的账号」底部或这里注销账号。不登录时,所有记录只存在这台设备上,删掉 App 即全部清除。")
                            .font(.system(size: 14)).foregroundStyle(Ink.soft).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                    }
                }
                section {
                    Text("字体").font(.system(size: 12, weight: .semibold)).kerning(2).foregroundStyle(Ink.soft)
                    Text("正文与标题用思源宋体(Noto Serif SC),依 SIL Open Font License 1.1 随 App 分发(按本 App 用到的字做了子集)。")
                        .font(.system(size: 14)).foregroundStyle(Ink.text).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                    if Self.oflText != nil {
                        Button { showOFL = true } label: { row("查看许可全文", "SIL OFL 1.1", icon: "doc.text") }.buttonStyle(.plain)
                    }
                }
                Text("© 2026 观象").font(.system(size: 12)).foregroundStyle(Ink.faint).frame(maxWidth: .infinity)
            }
            .frame(maxWidth: 560, alignment: .leading)
            .padding(.horizontal, 24).padding(.vertical, 20)
            .frame(maxWidth: .infinity)
        }
        .background(Ink.paper.ignoresSafeArea())
        .navigationTitle("关于").navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showOFL) {
            NavigationStack {
                ScrollView { Text(Self.oflText ?? "").font(.system(size: 13, design: .monospaced)).padding(20).frame(maxWidth: .infinity, alignment: .leading) }
                    .navigationTitle("SIL Open Font License 1.1").navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    static var oflText: String? {
        Bundle.main.url(forResource: "OFL", withExtension: "txt").flatMap { try? String(contentsOf: $0, encoding: .utf8) }
    }

    private func section<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 14) { c() }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
    }

    private func row(_ title: String, _ sub: String, icon: String, tint: Color = Ink.text) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 16, weight: .medium)).foregroundStyle(tint == Ink.text ? Ink.soft : tint).frame(width: 22)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(tint)
                Text(sub).font(.system(size: 12)).foregroundStyle(Ink.faint)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Ink.faint).accessibilityHidden(true)
        }
        .contentShape(Rectangle())
    }
}
