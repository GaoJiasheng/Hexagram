import SwiftUI
import UIKit

/// 目录里点了什么:一章,或本篇的一个小节(块下标)。
enum TOCPick { case chapter(Int), section(Int) }

/// 书包一章的一行:目录与书的首页共用。书按章号排;文集不排号,列作者、日期、分钟与一句话。
struct DeskbookChapterRow: View {
    let book: BookInfo
    let c: Chapter
    var current = false
    var marks = 0
    private var accent: Color { book.theme.accentColor }
    private var minutes: Int { c.meta?.minutes ?? max(1, (c.meta?.chars ?? 0) / 450) }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if !book.isCollection {
                Text(Numerals.chinese(c.no)).font(Fonts.num(13, weight: current ? .bold : .medium))
                    .foregroundStyle(current ? accent : Ink.faint)
                    .frame(width: 38, alignment: .leading).padding(.top, 2)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(c.title).font(Fonts.song(17, bold: current || book.isCollection)).foregroundStyle(Ink.text)
                    .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                if book.isCollection {
                    Text(([c.meta?.author, c.meta?.date].compactMap { $0 } + ["\(minutes) 分钟"]).joined(separator: " · "))
                        .font(.system(size: 12)).foregroundStyle(Ink.faint)
                }
                if let line = c.meta?.subtitle ?? c.meta?.idea, !line.isEmpty {
                    Text(line).font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(2).multilineTextAlignment(.leading)
                }
                if current { Text("正在读").font(.system(size: 11, weight: .semibold)).foregroundStyle(accent) }
            }
            Spacer(minLength: 6)
            if marks > 0 {
                HStack(spacing: 2) {
                    Image(systemName: "highlighter").font(.system(size: 11, weight: .medium))
                    Text("\(marks)").font(Fonts.num(11, weight: .semibold))
                }
                .foregroundStyle(HLColor.markColor(0)).padding(.top, 3)
            }
            ChapterMark(sec: Stats.shared.sec(c.src), color: accent).padding(.top, 1)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// 书 / 文集的目录:书头(题图、进度、声明)→ 本篇小节 → 全书各章(按分部)。
struct ArticleTOCSheet: View {
    let book: BookInfo
    let pack: BookPack
    let current: Int
    var sections: [(index: Int, title: String)] = []
    var currentSection: Int?
    /// 有思想脑图的书:目录最上面一行打开它
    var openMap: (() -> Void)? = nil
    let pick: (TOCPick) -> Void
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss
    private var accent: Color { book.theme.accentColor }

    private var parts: [BookPart] {
        book.parts.isEmpty ? [BookPart(title: "", from: 1, to: pack.chapters.count, note: nil)] : book.parts
    }

    var body: some View {
        let marks = Dictionary(grouping: HighlightStore.shared.alive(book: book.id), by: \.no).mapValues(\.count)
        let q = query.trimmingCharacters(in: .whitespaces)
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(book.title).font(Fonts.song(22, bold: true)).foregroundStyle(Ink.text)
                        let learned = Stats.shared.learnedCount(book.id)
                        Text("学过 \(learned) / \(pack.chapters.count) \(book.unit)").font(Fonts.num(13, weight: .semibold)).foregroundStyle(Ink.soft)
                        DisclaimerBanner(lines: book.disclaimers ?? [], compact: true)
                    }
                    .padding(.vertical, 4)
                }
                if q.isEmpty, let openMap, let t = MindMapStore.tree(book) {
                    Section {
                        Button(action: openMap) {
                            HStack(spacing: 12) {
                                Image(systemName: "point.3.connected.trianglepath.dotted").font(.system(size: 16, weight: .semibold)).foregroundStyle(accent).frame(width: 38, alignment: .leading)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("思想脑图").font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text)
                                    Text("\(t.branches) 条主线 · \(t.count) 个节点").font(.system(size: 12)).foregroundStyle(Ink.faint)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(Ink.faint)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                if q.isEmpty, sections.count > 1 {
                    Section("本篇") {
                        ForEach(sections, id: \.index) { s in
                            Button { pick(.section(s.index)) } label: {
                                HStack {
                                    Text(s.title).font(Fonts.song(16)).foregroundStyle(Ink.text)
                                    Spacer()
                                    if s.index == currentSection { Image(systemName: "bookmark.fill").foregroundStyle(accent).accessibilityLabel("读到这里") }
                                }
                            }
                        }
                    }
                }
                ForEach(parts, id: \.self) { p in
                    let chs = pack.chapters.filter { $0.no >= p.from && $0.no <= p.to && (q.isEmpty || $0.title.contains(q) || ($0.meta?.author ?? "").contains(q) || Int(q) == $0.no) }
                    if !chs.isEmpty {
                        Section {
                            ForEach(chs) { c in
                                Button { pick(.chapter(c.no)) } label: { DeskbookChapterRow(book: book, c: c, current: c.no == current, marks: marks[c.no] ?? 0) }
                                    .buttonStyle(.plain)
                                    .listRowBackground(c.no == current ? accent.opacity(0.08) : nil)
                            }
                        } header: {
                            if !p.title.isEmpty { Text(p.title).font(Fonts.song(15, bold: true)).foregroundStyle(Ink.soft).textCase(nil) }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: book.isCollection ? "篇名或作者" : "章号或篇名")
            .navigationTitle("目录").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
        }
        .presentationDetents([.large])
    }
}

/// 书包的首页:封面、书名、作者、门类;声明;一段介绍与来源;开始读 / 接着读;全部章;分享、导出、删除。
/// 书房的与自己导入的书都走这里(第一次打开、书目里点一下、书桌上长按「这本书」)。
struct BookHomeScreen: View {
    let book: BookInfo
    /// 读:给章号就从那一章读起,nil = 接着上次(没有就从第一章)。
    var onRead: (Int?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var askRemove = false
    @State private var showMap = false
    @State private var library = Library.shared
    @Environment(\.horizontalSizeClass) private var hSize
    private var accent: Color { book.theme.accentColor }
    private var pack: BookPack? { library.pack(book) }
    private var rec: DeskbookStore.Installed? { DeskbookStore.shared.record(book.id) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    hero
                    VStack(alignment: .leading, spacing: 18) {
                        DisclaimerBanner(lines: book.disclaimers ?? [])
                        if !book.brief.isEmpty { Text(book.brief).font(Fonts.song(17)).foregroundStyle(Ink.text).lineSpacing(5).fixedSize(horizontal: false, vertical: true) }
                        if let a = book.about { Text(a).font(.system(size: 15)).foregroundStyle(Ink.soft).lineSpacing(5).fixedSize(horizontal: false, vertical: true) }
                        readButtons
                        facts
                        if let t = MindMapStore.tree(book) { MindMapCard(book: book, tree: t) { showMap = true } }
                        if let pack { chapters(pack) }
                        actions
                    }
                    .padding(.horizontal, 22)
                }
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 40)
            }
            .background(book.theme.paperColor.ignoresSafeArea())
            .ignoresSafeArea(edges: .top)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
            .toolbarBackground(.hidden, for: .navigationBar)
            .fullScreenCover(isPresented: $showMap) { MindMapScreen(book: book) }
            #if DEBUG
            .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "homemap" { try? await Task.sleep(nanoseconds: 900_000_000); showMap = true } }
            #endif
            .confirmationDialog("从这台设备上删掉《\(book.title)》?", isPresented: $askRemove, titleVisibility: .visible) {
                Button("删掉书,留着阅读记录") { DeskbookStore.shared.remove(book.id, records: false); dismiss() }
                Button("连阅读记录一起删", role: .destructive) { DeskbookStore.shared.remove(book.id, records: true); dismiss() }
                Button("取消", role: .cancel) {}
            } message: {
                Text(book.origin == .shelf
                     ? "书的文件从这台设备上删掉,书房里那份不动,随时可以再加。阅读记录(进度、时长、划线与批注)可以留着,再加回来时接上。"
                     : "书的文件从这台设备上删掉,要再读得重新导入。阅读记录(进度、时长、划线与批注)可以留着,再导入同一本时接上;连记录一起删的,划线会同时从账号里删掉。")
            }
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            BookArt(book: book, kind: .banner)
                .frame(height: hSize == .regular ? 340 : 290).frame(maxWidth: .infinity).clipped()
                .overlay(LinearGradient(stops: [.init(color: book.theme.paperColor.opacity(0), location: 0.25), .init(color: book.theme.paperColor.opacity(0.8), location: 0.72),
                                                .init(color: book.theme.paperColor, location: 1)], startPoint: .top, endPoint: .bottom))
                .accessibilityHidden(true)
            HStack(alignment: .bottom, spacing: 16) {
                if book.cover != nil {
                    BookArt(book: book, kind: .cover).frame(width: 86, height: 129).clipShape(RoundedRectangle(cornerRadius: 10))
                        .shadow(color: .black.opacity(0.18), radius: 10, y: 5)
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        tag(book.kindLabel)
                        if let c = book.category { tag(c) }
                        if let o = book.origin { tag(o == .shelf ? "书房" : "自己导入", faint: true) }
                    }
                    Text(book.title).font(Fonts.song(28, bold: true)).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true)
                    if let s = book.subtitle { Text(s).font(Fonts.song(16)).foregroundStyle(Ink.soft) }
                    if !book.attribution.isEmpty { Text(book.attribution).font(.system(size: 13)).foregroundStyle(Ink.soft) }
                }
            }
            .padding(.horizontal, 22).padding(.bottom, 2)
        }
    }

    private func tag(_ s: String, faint: Bool = false) -> some View {
        Text(s).font(.system(size: 11, weight: .semibold)).foregroundStyle(faint ? Ink.soft : accent)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background((faint ? Ink.line : accent.opacity(0.12)), in: Capsule())
    }

    @ViewBuilder private var readButtons: some View {
        let pos = ProgressStore.shared.pos[book.id]
        let on = library.shelf.contains(book.id)
        HStack(spacing: 12) {
            Button { onRead(nil) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pos == nil ? "开始读" : "接着读").font(Fonts.song(17, bold: true))
                    if let p = pos, let c = pack?.chapters[safe: p.ch - 1] {
                        Text(book.isCollection ? c.title : "第 \(Numerals.chinese(p.ch)) \(book.unit) · \(c.title)").font(.system(size: 12)).opacity(0.85).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 18).padding(.vertical, 13)
                .background(accent, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            Button {
                if on { library.remove(book.id) } else { library.putOnShelf(book.id) }
            } label: {
                Label(on ? "在书桌上" : "放上书桌", systemImage: on ? "checkmark" : "plus")
                    .font(.system(size: 15, weight: .semibold))
                    .padding(.horizontal, 16).padding(.vertical, 15)
                    .background(accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(accent)
            }
            .buttonStyle(.plain)
            .accessibilityHint(on ? "点一下从书桌收起" : "")
        }
    }

    private var facts: some View {
        VStack(alignment: .leading, spacing: 6) {
            let chars = book.chars
            Text("\(book.chapters) \(book.unit) · \(chars >= 10000 ? Fmt.charsText(chars) : "\(chars) 字")" + (rec.map { " · \(ByteCountFormatter.string(fromByteCount: Int64($0.fileBytes), countStyle: .file))" } ?? ""))
            if let s = book.sourceLine { Text("来源:\(s)") }
            if let r = book.revision { Text("第 \(r) 版" + (rec.map { " · \(Fmt.ymd($0.installedAt))加入" } ?? "")) }
            if book.origin == .imported { Label("自己导入:只存在这台设备上,不上传", systemImage: "lock.iphone").labelStyle(.titleAndIcon) }
        }
        .font(.system(size: 12.5)).foregroundStyle(Ink.faint)
    }

    private func chapters(_ pack: BookPack) -> some View {
        let marks = Dictionary(grouping: HighlightStore.shared.alive(book: book.id), by: \.no).mapValues(\.count)
        let cur = ProgressStore.shared.pos[book.id]?.ch
        let parts = book.parts.isEmpty ? [BookPart(title: "", from: 1, to: pack.chapters.count, note: nil)] : book.parts
        return VStack(alignment: .leading, spacing: 0) {
            Text(book.isCollection ? "文章" : "目录").font(Fonts.song(19, bold: true)).foregroundStyle(Ink.text).padding(.bottom, 8)
            ForEach(parts, id: \.self) { p in
                if !p.title.isEmpty {
                    Text(p.title).font(Fonts.song(15, bold: true)).foregroundStyle(Ink.soft).padding(.top, 14).padding(.bottom, 4)
                }
                ForEach(pack.chapters.filter { $0.no >= p.from && $0.no <= p.to }) { c in
                    Button { onRead(c.no) } label: { DeskbookChapterRow(book: book, c: c, current: c.no == cur, marks: marks[c.no] ?? 0).padding(.vertical, 11) }
                        .buttonStyle(.plain)
                        .overlay(alignment: .bottom) { Rectangle().fill(Ink.line).frame(height: 0.5) }
                }
            }
        }
        .padding(16)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
    }

    private var actions: some View {
        VStack(spacing: 0) {
            if DeskbookStore.shared.packageURL(book.id) != nil {
                actionRow("分享书包", "原样的 .deskbook,别人导进自己的书桌", icon: "square.and.arrow.up") { Share.package(book) }
                Divider().overlay(Ink.line)
            }
            actionRow("导出划线与批注", "Markdown,原文、译文、文章三层都在", icon: "doc.plaintext") { Share.markdown(book) }
            Divider().overlay(Ink.line)
            actionRow("从这台设备上删掉", book.origin == .shelf ? "书房里那份不动" : "要再读得重新导入", icon: "trash", tint: Ink.cinnabar) { askRemove = true }
        }
        .padding(.horizontal, 16)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
    }

    private func actionRow(_ title: String, _ sub: String, icon: String, tint: Color = Ink.text, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 16, weight: .medium)).foregroundStyle(tint == Ink.text ? Ink.soft : tint).frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(tint)
                    Text(sub).font(.system(size: 12)).foregroundStyle(Ink.faint)
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: 分享 · 导出

enum Share {
    /// 用系统的分享菜单(iPad 上从屏幕中间弹出)。
    @MainActor static func present(_ items: [Any]) {
        guard let top = UIApplication.topViewController() else { return }
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let pop = vc.popoverPresentationController {
            pop.sourceView = top.view
            pop.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        top.present(vc, animated: true)
    }

    static func safeName(_ s: String) -> String {
        String(s.map { "/\\:?*\"<>|".contains($0) ? "-" : $0 }.prefix(80))
    }

    /// 临时目录里的一个导出文件。
    static func tmp(_ name: String) -> URL {
        let d = FileManager.default.temporaryDirectory.appendingPathComponent("export-\(UUID().uuidString.prefix(8))", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d.appendingPathComponent(name)
    }

    /// 原样的书包(用书名做文件名;同一卷上先试硬链接,不白占一份空间)。
    @MainActor static func package(_ b: BookInfo) {
        guard let src = DeskbookStore.shared.packageURL(b.id) else { return }
        let to = tmp(safeName(b.title) + ".deskbook")
        if (try? FileManager.default.linkItem(at: src, to: to)) == nil { try? FileManager.default.copyItem(at: src, to: to) }
        present([to])
    }

    @MainActor static func markdown(_ b: BookInfo) {
        let to = tmp(safeName(b.title) + " · 划线与批注.md")
        try? MarkdownExport.make(b).write(to: to, atomically: true, encoding: .utf8)
        present([to])
    }
}

/// 一本书的划线与批注 → Markdown:按章,章内原文、译文、文章(白话 / 深读)三层分开,批注跟在划线下面。
enum MarkdownExport {
    @MainActor static func make(_ b: BookInfo) -> String {
        let pack = Library.shared.pack(b)
        let hs = HighlightStore.shared.alive(book: b.id)
        var out = "# 《\(b.title)》划线与批注\n\n"
        out += "\(Fmt.ymd(Date()))导出 · \(hs.count) 条划线 · \(hs.filter(\.hasNote).count) 条批注\n\n"
        if hs.isEmpty { out += "这本书还没有划线。\n"; return out }
        let layers: [(String, String)] = [("o", "原文"), ("t", "译文"), ("b", b.isArticleBook ? "正文" : b.deepLabel)]
        for (no, rows) in Dictionary(grouping: hs, by: \.no).sorted(by: { $0.key < $1.key }) {
            let c = pack?.chapters[safe: no - 1]
            let head = c.map { b.isCollection ? $0.title : BookSearch.chapterLabel($0, unit: b.unit) } ?? "第 \(no) \(b.unit)"
            out += "## \(head)\n\n"
            for (k, name) in layers {
                let r = rows.filter { k == "b" ? $0.isBaihua : $0.layer == k }.sorted { ($0.seg, $0.start) < ($1.seg, $1.start) }
                guard !r.isEmpty else { continue }
                if !b.isArticleBook { out += "### \(name)\n\n" }
                for h in r {
                    out += h.text.split(separator: "\n", omittingEmptySubsequences: false).map { "> " + $0 }.joined(separator: "\n") + "\n\n"
                    if let n = h.note, h.hasNote { out += n + "\n\n" }
                }
            }
        }
        return out
    }
}

extension UIApplication {
    /// 最上面那一层正在显示的控制器(从哪儿都能弹出导入卡片、分享菜单)。
    static func topViewController() -> UIViewController? {
        let scene = shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive } ?? shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var vc = scene?.windows.first { $0.isKeyWindow }?.rootViewController ?? scene?.windows.first?.rootViewController
        while let p = vc?.presentedViewController, !p.isBeingDismissed { vc = p }
        return vc
    }
}
