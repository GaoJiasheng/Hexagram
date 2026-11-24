import SwiftUI
import UIKit

/// 目录里点了什么:一章(0 = 全书总览),或本篇的一个小节(块下标)。
enum TOCPick { case chapter(Int), section(Int) }

extension BookInfo {
    /// 观书式的书:有全书总览或思想脑图的现代书——首页分「总纲 / 分章」两层,目录把总纲单列在顶上。
    @MainActor func isHub(_ pack: BookPack?) -> Bool {
        isArticleBook && !isCollection && (pack?.overview != nil || mindmapNodes != nil)
    }
}

/// 每一章挂在脑图哪一支的颜色(与脑图上那一支同色);脑图没提到的章没有。
@MainActor
enum ChapterBranch {
    static func colors(_ book: BookInfo, _ pack: BookPack) -> [Int: Color] {
        guard let t = MindMapStore.tree(book) else { return [:] }
        var out: [Int: Color] = [:]
        for c in pack.chapters { if let b = t.branch(forChapter: c.no) { out[c.no] = MindPalette.hueColor(book.theme, branches: t.branches, branch: b) } }
        return out
    }
}

/// 全书总览读到哪了:滚到第几块 / 共几块、时长;读过 = 满三分钟或读到了末尾。
@MainActor
struct OverviewProgress {
    var fraction: Double
    var started: Bool
    var done: Bool
    var minutes: Int
    init(_ book: BookInfo, _ o: Chapter) {
        let art = DeskbookStore.shared.article(book.id, 0)
        let n = art?.blocks.count ?? 1
        let at = BaihuaPos.get(book.id, 0) ?? 0
        let sec = Stats.shared.sec(o.src)
        fraction = min(1, Double(at) / Double(max(n - 1, 1)))
        started = sec > 0 || at > 0
        done = sec >= Stats.learnedSec || fraction >= 0.9
        minutes = o.meta?.minutes ?? max(1, (art?.charCount ?? o.meta?.chars ?? 0) / 450)      // 与文章题头同一个算法
    }
}

/// 书包一章的一行:目录与书的首页共用。书按章号排;文集不排号,列作者、日期、分钟与一句话。
/// rich(观书式的书):号前一道分支色、概要一行、分钟。
struct DeskbookChapterRow: View {
    let book: BookInfo
    let c: Chapter
    var current = false
    var marks = 0
    var branch: Color? = nil
    var rich = false
    private var accent: Color { book.theme.accentColor }
    private var minutes: Int { c.meta?.minutes ?? max(1, (c.meta?.chars ?? 0) / 450) }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if !book.isCollection {
                HStack(alignment: .top, spacing: 7) {
                    if rich {
                        Capsule().fill(branch ?? Ink.line).frame(width: 3.5, height: 18).padding(.top, 1)
                            .accessibilityHidden(true)
                    }
                    Text(Numerals.chinese(c.no)).font(Fonts.num(13, weight: current ? .bold : .medium))
                        .foregroundStyle(current ? accent : Ink.faint)
                        .padding(.top, 2)
                }
                .frame(width: rich ? 40 : 38, alignment: .leading)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(c.title).font(Fonts.song(17, bold: current || book.isCollection)).foregroundStyle(Ink.text)
                    .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                if book.isCollection {
                    Text(([c.meta?.author, c.meta?.date].compactMap { $0 } + ["\(minutes) 分钟"]).joined(separator: " · "))
                        .font(.system(size: 12)).foregroundStyle(Ink.faint)
                }
                if let line = (rich ? c.meta?.summary : nil) ?? c.meta?.subtitle ?? c.meta?.idea, !line.isEmpty {
                    Text(line).font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(2).multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if rich {
                    HStack(spacing: 8) {
                        Text("\(minutes) 分钟").font(.system(size: 11.5)).foregroundStyle(Ink.faint)
                        if current { Text("正在读").font(.system(size: 11, weight: .semibold)).foregroundStyle(accent) }
                    }
                } else if current { Text("正在读").font(.system(size: 11, weight: .semibold)).foregroundStyle(accent) }
            }
            Spacer(minLength: 6)
            if marks > 0 {
                HStack(spacing: 2) {
                    Image(systemName: "highlighter").font(.system(size: 11, weight: .medium))
                    Text("\(marks)").font(Fonts.num(11, weight: .semibold))
                }
                .foregroundStyle(HLColor.markColor(0)).padding(.top, 3)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(marks) 条划线")
            }
            ChapterMark(sec: Stats.shared.sec(c.src), color: accent).padding(.top, 1)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// 总纲的一行(目录顶上的总览 / 脑图):图标、题名、一行小字、右边状态。
private struct HubRow: View {
    let icon: String
    let title: String
    let sub: String
    var state: String? = nil
    var done = false
    var current = false
    let accent: Color
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 16, weight: .semibold)).foregroundStyle(accent).frame(width: 38, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text).lineLimit(2)
                Text(sub).font(.system(size: 12)).foregroundStyle(Ink.faint).lineLimit(1)
                if current { Text("正在读").font(.system(size: 11, weight: .semibold)).foregroundStyle(accent) }
            }
            Spacer(minLength: 6)
            if done {
                Image(systemName: "checkmark").font(.system(size: 10, weight: .heavy)).foregroundStyle(.white)
                    .frame(width: 20, height: 20).background(accent, in: RoundedRectangle(cornerRadius: 5)).accessibilityLabel("读过")
            } else if let state { Text(state).font(.system(size: 12)).foregroundStyle(Ink.faint) }
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(Ink.faint)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// 书 / 文集的目录:书头(题图、进度、声明)→(观书式的书)总纲:总览、脑图 → 本篇小节 → 全书各章(按分部)。
struct ArticleTOCSheet: View {
    let book: BookInfo
    let pack: BookPack
    let current: Int
    var sections: [(index: Int, title: String)] = []
    var currentSection: Int?
    /// 阅读页里的目录:观书式的书把总纲(总览 / 脑图)钉在最上面,与章分开
    var pinnedHub = false
    /// 有思想脑图的书:目录最上面一行打开它
    var openMap: (() -> Void)? = nil
    let pick: (TOCPick) -> Void
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss
    private var accent: Color { book.theme.accentColor }
    private var hub: Bool { pinnedHub && book.isHub(pack) }

    private var parts: [BookPart] {
        book.parts.isEmpty ? [BookPart(title: "", from: 1, to: pack.chapters.count, note: nil)] : book.parts
    }

    var body: some View {
        let marks = Dictionary(grouping: HighlightStore.shared.alive(book: book.id), by: \.no).mapValues(\.count)
        let q = query.trimmingCharacters(in: .whitespaces)
        let colors = hub ? ChapterBranch.colors(book, pack) : [:]
        NavigationStack {
            ScrollViewReader { proxy in
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
                if hub, q.isEmpty {
                    Section {
                        if let o = pack.overview {
                            let st = OverviewProgress(book, o)
                            Button { pick(.chapter(0)) } label: {
                                HubRow(icon: "text.book.closed", title: o.title, sub: "全书总览 · 约 \(st.minutes) 分钟",
                                       state: st.started ? "读到 \(Int(st.fraction * 100))%" : nil, done: st.done, current: current == 0, accent: accent)
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(current == 0 ? accent.opacity(0.08) : nil)
                            .id("c0")
                            if current == 0 { sectionRows }
                        }
                        if let openMap, let t = MindMapStore.tree(book) {
                            Button(action: openMap) {
                                HubRow(icon: "point.3.connected.trianglepath.dotted", title: "思想脑图", sub: "\(t.branches) 条主线 · \(t.count) 个节点", accent: accent)
                            }
                            .buttonStyle(.plain)
                        }
                    } header: {
                        TOCHeader(title: "总纲", note: "全书这一层,不是哪一\(book.unit)")
                    }
                } else if q.isEmpty, let openMap, let t = MindMapStore.tree(book) {
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
                if !hub, q.isEmpty, sections.count > 1 {
                    Section {
                        ForEach(sections, id: \.index) { s in
                            Button { pick(.section(s.index)) } label: {
                                HStack {
                                    Text(s.title).font(Fonts.song(16)).foregroundStyle(Ink.text)
                                    Spacer()
                                    if s.index == currentSection { Image(systemName: "bookmark.fill").foregroundStyle(accent).accessibilityLabel("读到这里") }
                                }
                            }
                        }
                    } header: {
                        Text("本篇")
                    }
                }
                ForEach(Array(parts.enumerated()), id: \.element) { k, p in
                    let chs = pack.chapters.filter { $0.no >= p.from && $0.no <= p.to && (q.isEmpty || $0.title.contains(q) || ($0.meta?.author ?? "").contains(q) || ($0.meta?.summary ?? "").contains(q) || Int(q) == $0.no) }
                    if !chs.isEmpty {
                        Section {
                            ForEach(chs) { c in
                                Button { pick(.chapter(c.no)) } label: {
                                    DeskbookChapterRow(book: book, c: c, current: c.no == current, marks: marks[c.no] ?? 0, branch: colors[c.no], rich: hub)
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(c.no == current ? accent.opacity(0.08) : nil)
                                .id("c\(c.no)")
                                // 观书式的书:正读的这一章就地展开它的小节(目录是一棵树,不另起「本篇」一组把总纲与分章隔开)
                                if hub && q.isEmpty && c.no == current { sectionRows }
                            }
                        } header: {
                            if hub && k == 0 && q.isEmpty {
                                TOCHeader(title: "分章" + (p.title.isEmpty ? "" : " · \(p.title)"), note: "\(pack.chapters.count) \(book.unit)")
                            } else if !p.title.isEmpty {
                                Text(p.title).font(Fonts.song(15, bold: true)).foregroundStyle(Ink.soft).textCase(nil)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .onAppear { if hub && current > 2 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { proxy.scrollTo("c\(current)", anchor: .top) } } }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: book.isCollection ? "篇名或作者" : "章号或篇名")
            .navigationTitle("目录").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
        }
        .presentationDetents([.large])
    }
}

extension ArticleTOCSheet {
    /// 正读的这一篇的小节(挂在它那一行下面,缩进一级)。
    @ViewBuilder var sectionRows: some View {
        if sections.count > 1 {
            ForEach(sections, id: \.index) { s in
                Button { pick(.section(s.index)) } label: {
                    HStack(spacing: 10) {
                        Rectangle().fill(s.index == currentSection ? book.theme.accentColor : Ink.line).frame(width: 2, height: 18)
                        Text(s.title).font(Fonts.song(15)).foregroundStyle(s.index == currentSection ? book.theme.accentColor : Ink.soft).lineLimit(2)
                        Spacer()
                        if s.index == currentSection { Image(systemName: "bookmark.fill").font(.system(size: 12)).foregroundStyle(book.theme.accentColor).accessibilityLabel("读到这里") }
                    }
                    .padding(.leading, 50)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .listRowBackground(book.theme.accentColor.opacity(0.04))
                .listRowSeparator(.hidden)
            }
        }
    }
}

/// 目录分组的抬头:宋体题名 + 一句小字。
private struct TOCHeader: View {
    let title: String
    let note: String?
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title).font(Fonts.song(15, bold: true)).foregroundStyle(Ink.text)
            if let note { Text(note).font(.system(size: 12)).foregroundStyle(Ink.faint) }
        }
        .textCase(nil)
    }
}

private struct HomeMapOpen: Identifiable { let id = UUID(); let walk: Bool }

/// 书包的首页:封面、书名、作者、门类;声明;一段介绍与来源;开始读 / 接着读;全部章;分享、导出、删除。
/// 书房的与自己导入的书都走这里(第一次打开、书目里点一下、书桌上长按「这本书」)。
/// 观书式的书(有全书总览 / 思想脑图)分两层:「总纲」——一句话、总览、脑图,是读这本书的地图;「分章」——真正的目录。
/// 旁边是这本书的划线、用时、学完。宽屏(≥ 1000 点)左右两栏:左总纲,右分章。
struct BookHomeScreen: View {
    let book: BookInfo
    /// 读:给章号就从那一章读起,nil = 接着上次(没有就从第一章)。
    var onRead: (Int?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var askRemove = false
    /// 打开着的脑图(walk = 一打开就从根走读)
    @State private var mapOpen: HomeMapOpen?
    @State private var showMarks = false
    @State private var library = Library.shared
    @Environment(\.horizontalSizeClass) private var hSize
    private var accent: Color { book.theme.accentColor }
    private var pack: BookPack? { library.pack(book) }
    private var rec: DeskbookStore.Installed? { DeskbookStore.shared.record(book.id) }

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                let hub = book.isHub(pack)
                let wide = hub && geo.size.width >= 1000
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        hero
                        if hub, let pack {
                            hubBody(pack, wide: wide)
                        } else {
                            VStack(alignment: .leading, spacing: 18) {
                                DisclaimerBanner(lines: book.disclaimers ?? [])
                                if !book.brief.isEmpty { Text(book.brief).font(Fonts.song(17)).foregroundStyle(Ink.text).lineSpacing(5).fixedSize(horizontal: false, vertical: true) }
                                if let a = book.about { Text(a).font(.system(size: 15)).foregroundStyle(Ink.soft).lineSpacing(5).fixedSize(horizontal: false, vertical: true) }
                                readButtons
                                facts
                                if let t = MindMapStore.tree(book) { MindMapCard(book: book, tree: t) { mapOpen = HomeMapOpen(walk: false) } }
                                if let pack { chapters(pack) }
                                actions
                            }
                            .padding(.horizontal, 22)
                        }
                    }
                    .frame(maxWidth: wide ? 1120 : 720)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 40)
                }
                .background(book.theme.paperColor.ignoresSafeArea())
                .ignoresSafeArea(edges: .top)
            }
            .ignoresSafeArea(edges: .top)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
            .toolbarBackground(.hidden, for: .navigationBar)
            .fullScreenCover(item: $mapOpen) { m in MindMapScreen(book: book, walk: m.walk) }
            .sheet(isPresented: $showMarks) {
                if let pack { HighlightsSheet(book: book, pack: pack) { h in showMarks = false; DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onRead(h.no) } } }
            }
            #if DEBUG
            .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "homemap" { try? await Task.sleep(nanoseconds: 900_000_000); mapOpen = HomeMapOpen(walk: false) } }
            .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "homewalk" { try? await Task.sleep(nanoseconds: 900_000_000); mapOpen = HomeMapOpen(walk: true) } }
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
        // 观书式的书第一次读:从全书总览读起
        let fromOverview = pos == nil && pack?.overview != nil
        HStack(spacing: 12) {
            Button { onRead(fromOverview ? 0 : nil) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pos == nil ? (fromOverview ? "从总览读起" : "开始读") : "接着读").font(Fonts.song(17, bold: true))
                    if let p = pos, let c = pack?.chapter(p.ch) {
                        Text(book.isCollection || p.ch == 0 ? c.title : "第 \(Numerals.chinese(p.ch)) \(book.unit) · \(c.title)").font(.system(size: 12)).opacity(0.85).lineLimit(1)
                    } else if fromOverview, let o = pack?.overview {
                        Text(o.title).font(.system(size: 12)).opacity(0.85).lineLimit(1)
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

    // MARK: 观书式的书:总纲 / 分章

    @ViewBuilder private func hubBody(_ pack: BookPack, wide: Bool) -> some View {
        let tree = MindMapStore.tree(book)
        let colors = ChapterBranch.colors(book, pack)
        if wide {
            HStack(alignment: .top, spacing: 28) {
                VStack(alignment: .leading, spacing: 18) {
                    DisclaimerBanner(lines: book.disclaimers ?? [])
                    readButtons
                    zonggang(pack, tree: tree)
                    studyStrip(pack)
                    aboutBlock
                    actions
                }
                .frame(width: 470)
                fenzhang(pack, colors: colors)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 32)
        } else {
            VStack(alignment: .leading, spacing: 18) {
                DisclaimerBanner(lines: book.disclaimers ?? [])
                readButtons
                zonggang(pack, tree: tree)
                fenzhang(pack, colors: colors)
                studyStrip(pack)
                aboutBlock
                actions
            }
            .padding(.horizontal, 22)
        }
    }

    private func layerHead(_ title: String, note: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(title).font(Fonts.song(21, bold: true)).foregroundStyle(Ink.text)
            Text(note).font(.system(size: 12.5)).foregroundStyle(Ink.faint)
            Spacer(minLength: 0)
        }
    }

    /// 总纲:一句话 → 全书总览 → 思想脑图,一层书级的东西放在一块底色里。
    private func zonggang(_ pack: BookPack, tree: MindTree?) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            layerHead("总纲", note: "整本书这一层")
            pathHint(pack, tree: tree)
            if !book.brief.isEmpty {
                HStack(alignment: .top, spacing: 12) {
                    RoundedRectangle(cornerRadius: 2).fill(book.theme.accent2Color.opacity(0.75)).frame(width: 3)
                    Text(book.brief).font(Fonts.song(17)).foregroundStyle(Ink.text).lineSpacing(6)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, 2)
                .accessibilityLabel("一句话:\(book.brief)")
            }
            if let o = pack.overview { overviewCard(o) }
            if let tree {
                MindMapCard(book: book, tree: tree, open: { mapOpen = HomeMapOpen(walk: false) }, walk: { mapOpen = HomeMapOpen(walk: true) })
            }
        }
        .padding(16)
        .background(accent.opacity(0.045), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(accent.opacity(0.13), lineWidth: 1))
    }

    /// 读法:总览 → 脑图 → 分章,走过的一步打勾(不催,只标出来)。
    private func pathHint(_ pack: BookPack, tree: MindTree?) -> some View {
        let learned = Stats.shared.learnedCount(book.id)
        var steps: [(String, Bool)] = []
        if let o = pack.overview { steps.append(("总览", OverviewProgress(book, o).done)) }
        if tree != nil { steps.append(("脑图", MindMapUIState.load(book.id) != nil)) }
        steps.append(("分章 \(learned)/\(pack.chapters.count)", learned >= pack.chapters.count && !pack.chapters.isEmpty))
        return HStack(spacing: 6) {
            ForEach(Array(steps.enumerated()), id: \.offset) { i, st in
                if i > 0 { Image(systemName: "arrow.right").font(.system(size: 9, weight: .bold)).foregroundStyle(Ink.faint) }
                HStack(spacing: 5) {
                    ZStack {
                        Circle().stroke(accent.opacity(st.1 ? 0 : 0.45), lineWidth: 1.2)
                        if st.1 { Circle().fill(accent); Image(systemName: "checkmark").font(.system(size: 7, weight: .heavy)).foregroundStyle(.white) }
                        else { Text("\(i + 1)").font(Fonts.num(9, weight: .bold)).foregroundStyle(accent) }
                    }
                    .frame(width: 15, height: 15)
                    Text(st.0).font(.system(size: 12.5, weight: .medium)).foregroundStyle(st.1 ? Ink.soft : Ink.text)
                }
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("读法:" + steps.map { $0.0 + ($0.1 ? ",已读" : "") }.joined(separator: ",然后"))
    }

    /// 全书总览一张卡:题名、一句话、分钟、读到哪了。
    private func overviewCard(_ o: Chapter) -> some View {
        let st = OverviewProgress(book, o)
        return Button { onRead(0) } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 6) {
                            Image(systemName: "text.book.closed").font(.system(size: 12, weight: .bold))
                            Text("全书总览").font(.system(size: 12.5, weight: .bold)).kerning(2)
                        }
                        .foregroundStyle(accent)
                        Text(o.title).font(Fonts.song(19, bold: true)).foregroundStyle(Ink.text).multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        if let s = o.meta?.idea ?? o.meta?.subtitle, !s.isEmpty {
                            Text(s).font(.system(size: 13.5)).foregroundStyle(Ink.soft).lineSpacing(3).lineLimit(3).multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer(minLength: 6)
                    if let img = ArtStore.shared.image(book, .head(0)) {
                        Image(uiImage: img).resizable().scaledToFill().frame(width: 64, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityHidden(true)
                    }
                }
                HStack(spacing: 10) {
                    Text("约 \(st.minutes) 分钟").font(.system(size: 12.5)).foregroundStyle(Ink.faint)
                    if st.done {
                        Label("读过", systemImage: "checkmark").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(accent)
                    } else if st.started {
                        Text("读到 \(Int(st.fraction * 100))%").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(accent)
                    }
                    Spacer(minLength: 0)
                    HStack(spacing: 4) {
                        Text(st.done ? "再读一遍" : st.started ? "接着读" : "先读这篇").font(.system(size: 14, weight: .semibold))
                        Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(st.done ? accent : .white)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(st.done ? accent.opacity(0.1) : accent, in: Capsule())
                }
                if st.started && !st.done {
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(accent.opacity(0.12))
                            Capsule().fill(accent.opacity(0.85)).frame(width: max(4, g.size.width * st.fraction))
                        }
                    }
                    .frame(height: 3)
                    .accessibilityHidden(true)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.28), lineWidth: 1))
            .shadow(color: accent.opacity(0.1), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityHint("打开全书总览")
    }

    /// 分章:真正的目录。抬头带学过几章与一条章带(每章一格,脑图分支色,学过的实、没学的淡);接着读;各章一行。
    private func fenzhang(_ pack: BookPack, colors: [Int: Color]) -> some View {
        let marks = Dictionary(grouping: HighlightStore.shared.alive(book: book.id), by: \.no).mapValues(\.count)
        let pos = ProgressStore.shared.pos[book.id]
        let cur = pos?.ch
        let learned = Stats.shared.learnedCount(book.id)
        let parts = book.parts.isEmpty ? [BookPart(title: "", from: 1, to: pack.chapters.count, note: nil)] : book.parts
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("分章").font(Fonts.song(21, bold: true)).foregroundStyle(Ink.text)
                Text("\(pack.chapters.count) \(book.unit)").font(.system(size: 12.5)).foregroundStyle(Ink.faint)
                Spacer(minLength: 0)
                Text("学过 \(learned) / \(pack.chapters.count)").font(Fonts.num(13, weight: .semibold)).foregroundStyle(Ink.soft)
            }
            chapterBand(pack, colors: colors, current: cur).padding(.top, 12)
            if let p = pos, p.ch >= 1, let c = pack.chapter(p.ch) {
                Button { onRead(p.ch) } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "bookmark.fill").font(.system(size: 13)).foregroundStyle(accent)
                        Text("接着读 · 第 \(Numerals.chinese(p.ch)) \(book.unit) · \(c.title)").font(.system(size: 14, weight: .semibold)).foregroundStyle(Ink.text).lineLimit(1)
                        Spacer(minLength: 4)
                        Image(systemName: "arrow.right").font(.system(size: 12, weight: .bold)).foregroundStyle(accent)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
                    .contentShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .padding(.top, 12)
            }
            ForEach(parts, id: \.self) { p in
                if !p.title.isEmpty {
                    Text(p.title).font(Fonts.song(15, bold: true)).foregroundStyle(Ink.soft).padding(.top, 14).padding(.bottom, 4)
                }
                ForEach(pack.chapters.filter { $0.no >= p.from && $0.no <= p.to }) { c in
                    Button { onRead(c.no) } label: {
                        DeskbookChapterRow(book: book, c: c, current: c.no == cur, marks: marks[c.no] ?? 0, branch: colors[c.no], rich: true).padding(.vertical, 11)
                    }
                    .buttonStyle(.plain)
                    .overlay(alignment: .bottom) { Rectangle().fill(Ink.line).frame(height: 0.5) }
                }
            }
            .padding(.top, 6)
        }
        .padding(16)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
    }

    /// 章带:一章一格,颜色是它在脑图上的那一支;学过实色、读过一点半色、没读淡色;正在读的那一格下面一个点。
    private func chapterBand(_ pack: BookPack, colors: [Int: Color], current: Int?) -> some View {
        HStack(spacing: pack.chapters.count > 20 ? 2 : 3) {
            ForEach(pack.chapters) { c in
                let sec = Stats.shared.sec(c.src)
                let col = colors[c.no] ?? accent
                VStack(spacing: 3) {
                    RoundedRectangle(cornerRadius: 2).fill(col.opacity(sec >= Stats.learnedSec ? 0.95 : sec > 0 ? 0.5 : 0.18)).frame(height: 7)
                    Circle().fill(c.no == current ? Ink.text.opacity(0.7) : .clear).frame(width: 4, height: 4)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("学过 \(Stats.shared.learnedCount(book.id)) \(book.unit),共 \(pack.chapters.count) \(book.unit)")
    }

    /// 这本书的账:划线与批注(点开看全部)、用时、学完。
    private func studyStrip(_ pack: BookPack) -> some View {
        let hs = HighlightStore.shared.alive(book: book.id)
        let notes = hs.filter(\.hasNote).count
        let fs = Stats.shared.finishStats(book)
        let finished = FinishedStore.shared.isFinished(pack)
        let learned = Stats.shared.learnedCount(book.id)
        return HStack(alignment: .top, spacing: 10) {
            Button { if !hs.isEmpty { showMarks = true } } label: {
                statTile("划线", icon: "highlighter", value: "\(hs.count)", unit: "条",
                         sub: hs.isEmpty ? "长按正文划线" : notes > 0 ? "\(notes) 条批注 · 看全部" : "看全部", tappable: !hs.isEmpty)
            }
            .buttonStyle(.plain)
            .disabled(hs.isEmpty)
            let d = Fmt.durParts(fs.sec)
            statTile("用时", icon: "clock", value: d.map(\.0).joined(separator: " "), unit: d.last?.1 ?? "分",
                     sub: fs.days > 0 ? "\(fs.days) 天读过" : "还没开始", tappable: false, units: d)
            statTile("学完", icon: "checkmark.seal", value: finished ? "已" : "\(learned)", unit: finished ? "学完" : "/ \(pack.chapters.count)",
                     sub: finished ? (fs.to.map { Fmt.md($0) } ?? "") : "\(book.unit)学过", tappable: false, tint: finished ? Ink.cinnabar : nil)
        }
    }

    private func statTile(_ label: String, icon: String, value: String, unit: String, sub: String, tappable: Bool,
                          units: [(String, String)]? = nil, tint: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 10.5, weight: .bold))
                Text(label).font(.system(size: 11.5, weight: .semibold))
                if tappable { Spacer(minLength: 0); Image(systemName: "chevron.right").font(.system(size: 9, weight: .bold)) }
            }
            .foregroundStyle(Ink.faint)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                if let units {
                    ForEach(Array(units.enumerated()), id: \.offset) { _, u in
                        Text(u.0).font(Fonts.num(21, weight: .bold)).foregroundStyle(Ink.text)
                        Text(u.1).font(.system(size: 11.5, weight: .medium)).foregroundStyle(Ink.soft)
                    }
                } else {
                    Text(value).font(Fonts.num(21, weight: .bold)).foregroundStyle(tint ?? Ink.text)
                    Text(unit).font(.system(size: 11.5, weight: .medium)).foregroundStyle(tint ?? Ink.soft)
                }
            }
            .lineLimit(1).minimumScaleFactor(0.7)
            Text(sub).font(.system(size: 11.5)).foregroundStyle(Ink.faint).lineLimit(1).minimumScaleFactor(0.85)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 14))
        .contentShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(statSpoken(label, value: value, unit: unit, sub: sub, units: units))
    }

    private func statSpoken(_ label: String, value: String, unit: String, sub: String, units: [(String, String)]?) -> String {
        let amount: String
        if let units { amount = units.map { "\($0.0) \($0.1)" }.joined(separator: " ") } else { amount = "\(value) \(unit)" }
        return "\(label):\(amount),\(sub)"
    }

    @ViewBuilder private var aboutBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let a = book.about {
                Text("关于这本书").font(.system(size: 12.5, weight: .bold)).kerning(1.5).foregroundStyle(Ink.faint)
                Text(a).font(.system(size: 15)).foregroundStyle(Ink.soft).lineSpacing(5).fixedSize(horizontal: false, vertical: true)
            }
            facts
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
            let c = pack?.chapter(no)
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

// MARK: 书首页的弹出方式

extension View {
    /// 书的首页:手机上是页卡(sheet);iPad 上铺满全屏——页卡在 iPad 上只有七百来点宽,
    /// 观书类书的两栏中枢(左总纲、右分章,≥ 1000 点才出)在页卡里永远出不来。
    func bookHome<C: View>(item: Binding<BookInfo?>, @ViewBuilder content: @escaping (BookInfo) -> C) -> some View {
        modifier(BookHomePresenter(item: item, page: content))
    }
}

private struct BookHomePresenter<C: View>: ViewModifier {
    @Binding var item: BookInfo?
    let page: (BookInfo) -> C
    func body(content: Content) -> some View {
        if UIDevice.current.userInterfaceIdiom == .pad {
            content.fullScreenCover(item: $item, content: page)
        } else {
            content.sheet(item: $item, content: page)
        }
    }
}
