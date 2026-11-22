import SwiftUI

/// 目录:题图 + 书名 + 全书进度打头;「上次读到」一键回去;按章号或篇名筛;按书自己的分部(道经 / 德经、内篇 / 外篇 / 杂篇……)
/// 分组,组头吸顶。每章一行:章号(书自己的单位)、题名、学过的印、有无划线 / 批注、有无白话深读、读了几分钟。
/// 周易:上经 / 下经六十四卦排成卦画方阵,十翼照常列表。iPhone 是表单,iPad 横屏是右侧的侧栏(见 ReaderScreen)。
struct TOCSheet: View {
    let model: ReaderModel
    /// iPad 横屏的侧栏形态:没有表单的拖柄,右上角给一个收起。
    var panel = false
    let pick: (Int) -> Void
    var close: () -> Void = {}
    @State private var query = ""
    @FocusState private var searching: Bool
    @Environment(\.dismiss) private var dismiss
    private var stats: Stats { .shared }
    private var book: BookInfo { model.book }
    private var accent: Color { book.theme.accentColor }

    /// 一次算好的每章标记(划线数、批注数、有无白话、时长),行里只查表。
    private struct Marks { var hl = 0; var notes = 0; var deep = false; var sec = 0 }

    private var parts: [BookPart] {
        book.parts.isEmpty ? [BookPart(title: "", from: 1, to: model.pack.chapters.count, note: nil)] : book.parts
    }

    var body: some View {
        let marks = computeMarks()
        VStack(spacing: 0) {
        // 表单顶上留出拖柄那一条,吸顶的分部组头停在它下面,不被拖柄和圆角压住
        if !panel { Color.clear.frame(height: 18) }
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                    header(marks)
                    shortcuts(proxy)
                    let q = query.trimmingCharacters(in: .whitespaces)
                    ForEach(parts, id: \.self) { p in
                        let chs = model.pack.chapters.filter { $0.no >= p.from && $0.no <= p.to && matches($0, q) }
                        if !chs.isEmpty {
                            Section {
                                if chs.allSatisfy({ $0.gua != nil }) { guaGrid(chs, marks) }
                                else { ForEach(chs) { c in row(c, part: p, marks[c.no] ?? Marks()) } }
                            } header: { partHeader(p, chs: chs, filtered: !q.isEmpty) }
                        }
                    }
                    if !q.isEmpty, !model.pack.chapters.contains(where: { matches($0, q) }) {
                        Text("没有找到「\(q)」").font(.system(size: 15)).foregroundStyle(Ink.soft)
                            .frame(maxWidth: .infinity).padding(.vertical, 40)
                    }
                    Color.clear.frame(height: 30)
                }
            }
            .scrollDismissesKeyboard(.immediately)
            .onAppear {
                // 打开就把正在读的那一章滚到中间(LazyVStack 要等一拍才排出目标行)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { proxy.scrollTo(model.current.ch, anchor: .center) }
            }
        }
        }
        .background(Ink.paper)
        .presentationDetents(panel ? [.large] : [.fraction(0.62), .large])
        .presentationDragIndicator(panel ? .hidden : .visible)
        .presentationBackground(Ink.paper)
    }

    private var closeButton: some View {
        Button { if panel { close() } else { dismiss() } } label: {
            Image(systemName: "xmark").font(.system(size: 13, weight: .bold)).foregroundStyle(Ink.text)
                .frame(width: 32, height: 32).background(.ultraThinMaterial, in: Circle())
        }
        .accessibilityLabel("收起目录")
        .padding(14)
    }

    // MARK: 头

    private func header(_ marks: [Int: Marks]) -> some View {
        let n = model.pack.chapters.count
        let learned = stats.learnedCount(book.id)
        let total = marks.values.reduce(0) { $0 + $1.sec }
        return ZStack(alignment: .bottomLeading) {
            BookArt(book: book, kind: .banner)
                .frame(height: 168).frame(maxWidth: .infinity).clipped()
                .overlay(LinearGradient(stops: [.init(color: Ink.paper.opacity(0), location: 0.15), .init(color: Ink.paper.opacity(0.75), location: 0.6),
                                                .init(color: Ink.paper, location: 1)], startPoint: .top, endPoint: .bottom))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("目录").font(.system(size: 12, weight: .semibold)).kerning(3).foregroundStyle(accent)
                    Text(book.title).font(Fonts.song(28, bold: true)).foregroundStyle(Ink.text)
                }
                HStack(spacing: 10) {
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(accent.opacity(0.16))
                            Capsule().fill(accent).frame(width: max(6, g.size.width * CGFloat(learned) / CGFloat(max(n, 1))))
                        }
                    }
                    .frame(width: 96, height: 5)
                    Text("学过 \(learned) / \(n)" + (mixed ? "" : " \(book.unit)")).font(Fonts.num(13, weight: .semibold)).foregroundStyle(Ink.text)
                    if total > 0 {
                        Text("·").foregroundStyle(Ink.faint)
                        Text("共读 \(Fmt.dur(total))").font(Fonts.num(13, weight: .medium)).foregroundStyle(Ink.soft)
                    }
                }
                .accessibilityElement(children: .combine)
                if deepEverywhere {
                    Label(mixed ? "每一篇都有白话深读" : "每\(book.unit)都有白话深读", systemImage: "book.pages").font(.system(size: 12)).foregroundStyle(Ink.soft)
                }
                DisclaimerBanner(lines: book.disclaimers ?? [], compact: true)
            }
            .padding(.horizontal, 20).padding(.bottom, 6)
        }
        .overlay(alignment: .topTrailing) { closeButton }
    }

    // MARK: 上次读到 + 筛选

    @ViewBuilder private func shortcuts(_ proxy: ScrollViewProxy) -> some View {
        VStack(spacing: 10) {
            if let l = model.lastRead, l.ch != model.current.ch, model.pack.chapters.indices.contains(l.ch - 1) {
                shortcut(icon: "arrow.uturn.backward", label: "上次读到", chapter: model.chapter(l.ch)) {
                    model.returnToLastRead(); if panel { close() } else { dismiss() }
                }
            } else {
                shortcut(icon: "bookmark.fill", label: "正在读", chapter: model.chapter(model.current.ch)) {
                    withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo(model.current.ch, anchor: .center) }
                }
            }
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").font(.system(size: 14, weight: .medium)).foregroundStyle(Ink.faint)
                TextField("章号或篇名", text: $query)
                    .font(.system(size: 16)).focused($searching)
                    .submitLabel(.search).autocorrectionDisabled()
                if !query.isEmpty {
                    Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Ink.faint) }
                        .accessibilityLabel("清除")
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Ink.line, lineWidth: 1))
        }
        .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 12)
    }

    private func shortcut(icon: String, label: String, chapter c: Chapter, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 32, height: 32).background(accent, in: RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(.system(size: 12, weight: .medium)).foregroundStyle(Ink.soft)
                    Text(chapterLabel(c)).font(Fonts.song(16, bold: true)).foregroundStyle(Ink.text).lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Ink.faint)
            }
            .padding(10)
            .background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }

    private func chapterLabel(_ c: Chapter) -> String {
        if c.kind == "text" { return c.title }
        if let g = c.gua { return "第 \(Numerals.chinese(c.no)) 卦 · \(g.fullName.isEmpty ? c.title : g.fullName)" }
        return "第 \(Numerals.chinese(c.no)) \(book.unit) · \(c.title)"
    }

    /// 筛选:章号(阿拉伯或中文数字)或篇名里有这几个字。
    private func matches(_ c: Chapter, _ q: String) -> Bool {
        guard !q.isEmpty else { return true }
        if let n = Int(q) { return c.no == n }
        if c.title.contains(q) || (c.gua?.name.contains(q) ?? false) { return true }
        return Numerals.chinese(c.no) == q.replacingOccurrences(of: "第", with: "").replacingOccurrences(of: book.unit, with: "")
    }

    // MARK: 分部组头

    private func partHeader(_ p: BookPart, chs: [Chapter], filtered: Bool) -> some View {
        let learned = chs.filter { stats.learned($0.src) }.count
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            if !p.title.isEmpty {
                Text(p.title).font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text)
                if !filtered, p.to > p.from {
                    Text(rangeLabel(p)).font(.system(size: 12)).foregroundStyle(Ink.faint)
                }
            } else {
                Text("全书").font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text)
            }
            Spacer()
            if !filtered { Text("学过 \(learned)/\(chs.count)").font(Fonts.num(12, weight: .medium)).foregroundStyle(learned == chs.count ? accent : Ink.faint) }
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 8)
        .frame(maxWidth: .infinity)
        .background(Ink.paper)
        .overlay(alignment: .bottom) { Rectangle().fill(Ink.line).frame(height: 0.5) }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private func rangeLabel(_ p: BookPart) -> String {
        let first = model.chapter(p.from), last = model.chapter(p.to)
        if first.kind == "text" { return "\(p.to - p.from + 1) 篇" }
        if first.gua != nil { return "\(first.gua!.name)至\(last.gua?.name ?? "") · \(p.to - p.from + 1) 卦" }
        return "第\(Numerals.chinese(p.from))至\(Numerals.chinese(p.to))\(book.unit)"
    }

    // MARK: 一行

    private func row(_ c: Chapter, part p: BookPart, _ m: Marks) -> some View {
        let current = c.no == model.current.ch
        // 十翼的篇章:题名里重复的部名(「系辞上 · 」)去掉
        var title = c.title
        if c.kind == "text", !p.title.isEmpty, title.hasPrefix(p.title + " · ") { title = String(title.dropFirst(p.title.count + 3)) }
        return Button { pick(c.no) } label: {
            HStack(spacing: 12) {
                Text(c.kind == "text" ? "" : Numerals.chinese(c.no))
                    .font(Fonts.num(13, weight: current ? .bold : .medium))
                    .foregroundStyle(current ? accent : Ink.faint)
                    .frame(width: 42, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(Fonts.song(17, bold: current)).foregroundStyle(Ink.text).lineLimit(1)
                    if current { Text("正在读").font(.system(size: 11, weight: .semibold)).foregroundStyle(accent) }
                }
                Spacer(minLength: 6)
                indicators(m)
                ChapterMark(sec: m.sec, color: accent)
            }
            .padding(.horizontal, 20).padding(.vertical, 11)
            .background(current ? accent.opacity(0.09) : .clear)
            .overlay(alignment: .leading) { if current { Rectangle().fill(accent).frame(width: 3) } }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .id(c.no)
        .accessibilityLabel(accessibility(c, title: title, m, current: current))
    }

    /// 行尾的小标记:划线条数(有批注换成批注图标)、白话深读、读了几分钟。都很淡,一眼扫过不吵。
    @ViewBuilder private func indicators(_ m: Marks) -> some View {
        HStack(spacing: 9) {
            if m.hl > 0 {
                HStack(spacing: 2) {
                    Image(systemName: m.notes > 0 ? "text.bubble" : "highlighter").font(.system(size: 11, weight: .medium))
                    Text("\(m.hl)").font(Fonts.num(11, weight: .semibold))
                }
                .foregroundStyle(HLColor.markColor(0))
            }
            if m.deep && !deepEverywhere { Image(systemName: "book.pages").font(.system(size: 11, weight: .medium)).foregroundStyle(Ink.faint) }
            if m.sec >= 60 && m.sec < Stats.learnedSec * 4 {
                Text("\(m.sec / 60)′").font(Fonts.num(11, weight: .medium)).foregroundStyle(Ink.faint)
            } else if m.sec >= Stats.learnedSec * 4 {
                Text("\(m.sec / 60)′").font(Fonts.num(11, weight: .medium)).foregroundStyle(Ink.soft)
            }
        }
    }

    private func accessibility(_ c: Chapter, title: String, _ m: Marks, current: Bool) -> String {
        var s = c.kind == "text" ? title : "第\(Numerals.chinese(c.no))\(book.unit),\(title)"
        if current { s += ",正在读" }
        if m.sec >= Stats.learnedSec { s += ",学过" }
        if m.hl > 0 { s += ",\(m.hl) 条划线" }
        if m.notes > 0 { s += ",有批注" }
        if m.deep { s += ",有白话深读" }
        return s
    }

    // MARK: 周易卦阵

    private func guaGrid(_ chs: [Chapter], _ marks: [Int: Marks]) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 66, maximum: 84), spacing: 8)], spacing: 8) {
            ForEach(chs) { c in guaCell(c, marks[c.no] ?? Marks()) }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
    }

    private func guaCell(_ c: Chapter, _ m: Marks) -> some View {
        let current = c.no == model.current.ch
        let learned = m.sec >= Stats.learnedSec
        let g = c.gua!
        return Button { pick(c.no) } label: {
            VStack(spacing: 5) {
                Image(uiImage: Hexagram.image(binary: g.binary, size: CGSize(width: 30, height: 26), color: .black))
                    .renderingMode(.template).foregroundStyle(current ? accent : Ink.text.opacity(learned ? 0.85 : 0.6))
                Text(g.name).font(Fonts.song(15, bold: current)).foregroundStyle(Ink.text)
                Text(Numerals.chinese(c.no)).font(Fonts.num(10, weight: .medium)).foregroundStyle(Ink.faint)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 9)
            .background(current ? accent.opacity(0.12) : learned ? accent.opacity(0.05) : Ink.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(current ? accent : Ink.line, lineWidth: current ? 1.5 : 0.5))
            .overlay(alignment: .topTrailing) {
                if learned {
                    Image(systemName: "checkmark").font(.system(size: 7, weight: .heavy)).foregroundStyle(.white)
                        .frame(width: 13, height: 13).background(accent, in: RoundedRectangle(cornerRadius: 3.5)).padding(5)
                } else if m.hl > 0 {
                    Circle().fill(HLColor.markColor(0)).frame(width: 6, height: 6).padding(7)
                }
            }
        }
        .buttonStyle(.plain)
        .id(c.no)
        .accessibilityLabel("第\(Numerals.chinese(c.no))卦,\(g.fullName)" + (current ? ",正在读" : "") + (learned ? ",学过" : "") + (m.hl > 0 ? ",有划线" : ""))
    }

    // MARK: 数据

    /// 每章都有白话深读时,行尾就不逐行标(只在头上说一句),免得满屏一样的图标。
    /// 周易这样卦与传混排的书:总数不带单位(九十九篇里有六十四卦)。
    private var mixed: Bool { model.pack.chapters.contains { $0.kind == "text" } }
    private var deepEverywhere: Bool { model.pack.chapters.allSatisfy { BaihuaStore.shared.has(book, $0.no) } }

    private func computeMarks() -> [Int: Marks] {
        var out: [Int: Marks] = [:]
        for h in HighlightStore.shared.alive(book: book.id) where !h.isBaihua {
            out[h.no, default: Marks()].hl += 1
            if h.hasNote { out[h.no, default: Marks()].notes += 1 }
        }
        for c in model.pack.chapters {
            out[c.no, default: Marks()].sec = stats.sec(c.src)
            out[c.no, default: Marks()].deep = BaihuaStore.shared.has(book, c.no)
        }
        return out
    }
}
