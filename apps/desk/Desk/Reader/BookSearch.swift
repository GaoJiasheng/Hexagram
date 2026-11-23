import SwiftUI

/// 查本书的一处命中。
struct FindHit: Identifiable, Hashable, Sendable {
    var id: String { "\(book)/\(ch)/\(layer)\(seg)/\(start)" }
    var book: String
    var ch: Int
    var chLabel: String
    var seg: Int
    var layer: String       // "o" 原文 · "t" 译文
    var start: Int          // 命中在该段该层里的字符偏移
    var end: Int
    var snippet: String     // 含命中词的那一句
    var hitStart: Int       // 命中在 snippet 里的字符偏移
    var hitEnd: Int

    var spot: Spot { Spot(ch: ch, seg: seg, layer: layer, start: start, end: end) }
}

enum BookSearch {
    /// 「第八章 · 上善若水」;卦与十翼只用题名。
    static func chapterLabel(_ c: Chapter, unit: String) -> String {
        if c.gua != nil || c.kind == "text" || c.no == 0 { return c.title }      // 第 0 章是书包的全书总览,不排号
        let head = "第 \(Numerals.chinese(c.no)) \(unit)"
        return c.title.isEmpty ? head : "\(head) · \(c.title)"
    }

    /// 在一本书的内容包里找全部出现处(原文、译文都找)。纯计算,放后台跑。
    nonisolated static func run(book: String, unit: String, pack: BookPack, query q: String) -> [FindHit] {
        guard !q.isEmpty else { return [] }
        var out: [FindHit] = []
        for c in pack.chapters {
            let label = chapterLabel(c, unit: unit)
            for (i, s) in c.segs.enumerated() {
                for (layer, text) in [("o", s.o), ("t", s.t ?? "")] where !text.isEmpty {
                    let ns = text as NSString
                    var from = 0
                    while from < ns.length {
                        let r = ns.range(of: q, options: .literal, range: NSRange(location: from, length: ns.length - from))
                        if r.location == NSNotFound { break }
                        out.append(hit(book: book, c: c, label: label, seg: i, layer: layer, text: text, ns: ns, r: r))
                        from = NSMaxRange(r)
                        if out.count >= 5000 { return out }      // 单字查全书也不过几千处;再多就截住
                    }
                }
            }
        }
        return out
    }

    private static let stops: Set<unichar> = Set("。！？；\n!?;".utf16)

    private static func hit(book: String, c: Chapter, label: String, seg: Int, layer: String, text: String, ns: NSString, r: NSRange) -> FindHit {
        // 那一句:往前找到上一个句末标点,往后找到下一个(含)。太长就只取命中前后各二十来个字。
        var a = r.location, b = NSMaxRange(r)
        while a > 0, !stops.contains(ns.character(at: a - 1)) { a -= 1 }
        while b < ns.length, !stops.contains(ns.character(at: b)) { b += 1 }
        if b < ns.length { b += 1 }
        var pre = "", post = ""
        if r.location - a > 24 { a = r.location - 22; pre = "…" }
        if b - NSMaxRange(r) > 30 { b = NSMaxRange(r) + 28; post = "…" }
        // 不切在代理对中间
        if a > 0, a < ns.length, UTF16.isTrailSurrogate(ns.character(at: a)) { a -= 1 }
        if b < ns.length, b > 0, UTF16.isLeadSurrogate(ns.character(at: b - 1)) { b += 1 }
        let before = ns.substring(with: NSRange(location: a, length: r.location - a))
        let word = ns.substring(with: r)
        let after = ns.substring(with: NSRange(location: NSMaxRange(r), length: b - NSMaxRange(r)))
        let snippet = (pre + before + word + after).trimmingCharacters(in: .newlines)
        let hs = (pre + before).count
        return FindHit(book: book, ch: c.no, chLabel: label, seg: seg, layer: layer,
                       start: text.charOffset(utf16: r.location), end: text.charOffset(utf16: NSMaxRange(r)),
                       snippet: snippet, hitStart: hs, hitEnd: hs + word.count)
    }
}

/// 「查本书」结果:顶上写「《书名》里共 N 处」,可切原文 / 译文;可打开「书桌上的书都查」。
struct FindSheet: View {
    let query: String
    let book: BookInfo
    let pack: BookPack
    let pick: (FindHit) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var allDesk = false
    @State private var layer = "all"
    @State private var groups: [BookHits] = []
    @State private var busy = true
    @State private var folded: Set<String> = []     // 书桌都查时,收起的书

    struct BookHits: Identifiable {
        var id: String { info.id }
        var info: BookInfo
        var hits: [FindHit]
    }

    private var accent: Color { book.theme.accentColor }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(summary).font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text)
                        Picker("层", selection: $layer) {
                            Text("全部").tag("all")
                            Text("原文 \(String(count("o")))").tag("o")
                            Text("译文 \(String(count("t")))").tag("t")
                        }
                        .pickerStyle(.segmented)
                        Toggle("书桌上的书都查", isOn: $allDesk).font(.system(size: 15)).tint(accent)
                    }
                    .padding(.vertical, 4)
                }
                if busy {
                    Section { HStack { Spacer(); ProgressView(); Spacer() } }
                }
                ForEach(groups) { g in
                    let hits = g.hits.filter { layer == "all" || $0.layer == layer }
                    let open = !allDesk || !folded.contains(g.id)
                    if allDesk && !hits.isEmpty {
                        Section {
                            EmptyView()
                        } header: {
                            Button {
                                withAnimation { if folded.contains(g.id) { folded.remove(g.id) } else { folded.insert(g.id) } }
                            } label: {
                                HStack {
                                    Text("《\(g.info.title)》 \(String(hits.count)) 处").font(Fonts.song(16, bold: true)).foregroundStyle(g.info.theme.accentColor)
                                    Spacer()
                                    Image(systemName: open ? "chevron.down" : "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Ink.faint)
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .textCase(nil)
                        }
                    }
                    ForEach(open ? chapterGroups(hits) : [], id: \.0) { ch, rows in
                        Section {
                            ForEach(rows) { h in
                                Button { pick(h) } label: { row(h, accent: g.info.theme.accentColor) }
                            }
                        } header: {
                            HStack {
                                Text(rows[0].chLabel).font(Fonts.song(14, bold: true)).foregroundStyle(Ink.soft)
                                Spacer()
                                Text("\(rows.count)").font(Fonts.num(12)).foregroundStyle(Ink.faint)
                            }
                            .textCase(nil)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("查「\(query)」").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
            .task(id: allDesk) { await search() }
        }
    }

    private var total: Int { groups.reduce(0) { $0 + $1.hits.count } }
    private func count(_ l: String) -> Int { groups.reduce(0) { $0 + $1.hits.filter { $0.layer == l }.count } }

    private var summary: String {
        if busy && groups.isEmpty { return "正在查…" }
        let n = layer == "all" ? total : count(layer)
        if allDesk {
            let books = groups.filter { !$0.hits.isEmpty }.count
            return n == 0 ? "书桌上的书里没有「\(query)」" : "书桌上 \(books) 本书里共 \(n) 处"
        }
        return n == 0 ? "《\(book.title)》里没有「\(query)」" : "《\(book.title)》里共 \(n) 处"
    }

    private func chapterGroups(_ hits: [FindHit]) -> [(Int, [FindHit])] {
        var order: [Int] = [], map: [Int: [FindHit]] = [:]
        for h in hits {
            if map[h.ch] == nil { order.append(h.ch) }
            map[h.ch, default: []].append(h)
        }
        // 组内原文在前(原文为主),再按段序
        return order.map { ($0, map[$0]!.sorted { ($0.layer, $0.seg, $0.start) < ($1.layer, $1.seg, $1.start) }) }
    }

    private func row(_ h: FindHit, accent: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(h.layer == "o" ? "原文" : "译文")
                .font(.system(size: 11, weight: .semibold))
                .padding(.horizontal, 6).padding(.vertical, 2)
                .foregroundStyle(h.layer == "o" ? accent : Ink.soft)
                .background((h.layer == "o" ? accent : Ink.faint).opacity(0.12), in: Capsule())
            Text(snippet(h, accent: accent))
                .font(h.layer == "o" ? Fonts.song(16) : .system(size: 15))
                .foregroundStyle(h.layer == "o" ? Ink.text : Ink.soft)
                .lineSpacing(4)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }

    private func snippet(_ h: FindHit, accent: Color) -> AttributedString {
        var a = AttributedString(h.snippet)
        let s = h.snippet
        if let i = s.index(s.startIndex, offsetBy: h.hitStart, limitedBy: s.endIndex),
           let j = s.index(s.startIndex, offsetBy: h.hitEnd, limitedBy: s.endIndex),
           let lo = AttributedString.Index(i, within: a), let hi = AttributedString.Index(j, within: a) {
            a[lo..<hi].foregroundColor = accent
            a[lo..<hi].inlinePresentationIntent = .stronglyEmphasized
        }
        return a
    }

    private func search() async {
        busy = true
        let q = query
        var books: [(BookInfo, BookPack)] = [(book, pack)]
        if allDesk {
            for b in Library.shared.shelfBooks where b.id != book.id && Library.shared.isDownloaded(b) {
                if let p = Library.shared.pack(b) { books.append((b, p)) }
            }
        }
        let jobs = books.map { ($0.0.id, $0.0.unit, $0.1) }
        let found = await Task.detached(priority: .userInitiated) {
            jobs.map { BookSearch.run(book: $0.0, unit: $0.1, pack: $0.2, query: q) }
        }.value
        groups = zip(books, found).map { BookHits(info: $0.0.0, hits: $0.1) }
        busy = false
    }
}
