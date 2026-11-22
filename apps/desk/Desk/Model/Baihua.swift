import Foundation
import Observation
import CoreGraphics

// 白话深读包(public/desk/v1/<id>.baihua.<hash>.json,格式见 docs/desk-baihua-spec.md)。
// 一律宽松解码:不认识的块跳过、不认识的图解按「只留文字」(notes)显示,坏一处不连累整章。

/// 清单里一本书的白话包信息。
struct BaihuaInfo: Codable, Hashable {
    var file: String
    var bytes: Int
    var chapters: Int
    var figs: Int?
    var figsDone: Int?
}

/// 任意 JSON 值:图解的字段形态多变(字符串 / 数组 / 对象混用),先整个吃进来再按需取。
indirect enum JSONValue: Decodable, Hashable {
    case string(String), number(Double), bool(Bool), array([JSONValue]), object([String: JSONValue]), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let a = try? c.decode([JSONValue].self) { self = .array(a) }
        else if let o = try? c.decode([String: JSONValue].self) { self = .object(o) }
        else { self = .null }
    }

    subscript(_ k: String) -> JSONValue? { if case .object(let o) = self { return o[k] } else { return nil } }
    var string: String? {
        switch self {
        case .string(let s): return s
        case .number(let n): return n == n.rounded() ? String(Int(n)) : String(n)
        default: return nil
        }
    }
    var array: [JSONValue]? { if case .array(let a) = self { return a } else { return nil } }
    var bool: Bool { if case .bool(let b) = self { return b } else { return false } }
    /// 字符串,或字符串数组(取其中的字符串)。
    var strings: [String] {
        if let s = string { return s.isEmpty ? [] : [s] }
        return (array ?? []).flatMap { $0.string.map { [$0] } ?? $0.allStrings }
    }
    /// 里面所有的字(兜底显示用),按出现次序。
    var allStrings: [String] {
        switch self {
        case .string(let s): return s.isEmpty ? [] : [s]
        case .array(let a): return a.flatMap(\.allStrings)
        case .object(let o):
            // 常见字段按版面上的次序先取,其余按键名排
            let order = ["title", "head", "mark", "when", "label", "name", "text", "body", "gloss", "source", "center"]
            let skip: Set<String> = ["kind", "form", "at", "accent", "ordered", "loop"]
            var out: [String] = []
            for k in order { if let v = o[k] { out += v.allStrings } }
            for k in o.keys.sorted() where !order.contains(k) && !skip.contains(k) { out += o[k]!.allStrings }
            return out
        default: return []
        }
    }
}

// MARK: 图解

/// 图解里的一条:一行字,或「小标题 + 说明」。各 kind 共用(mark 序号、when 时间、at 方位、children 下一层)。
struct FigItem: Hashable {
    var head: String = ""
    var body: [String] = []
    var mark: String?
    var when: String?
    var at: String?
    var accent = false
    var children: [FigItem] = []

    init(head: String = "", body: [String] = [], mark: String? = nil, when: String? = nil, at: String? = nil, accent: Bool = false, children: [FigItem] = []) {
        self.head = head; self.body = body; self.mark = mark; self.when = when; self.at = at; self.accent = accent; self.children = children
    }

    init?(_ v: JSONValue) {
        if let s = v.string { guard !s.isEmpty else { return nil }; head = s; return }
        guard case .object = v else { return nil }
        head = (v["head"] ?? v["label"] ?? v["text"] ?? v["name"])?.string ?? ""
        body = v["body"]?.strings ?? []
        if v["head"] != nil || v["label"] != nil, let t = v["text"]?.string, !t.isEmpty, t != head { body.insert(t, at: 0) }
        mark = v["mark"]?.string
        when = v["when"]?.string
        at = v["at"]?.string
        accent = v["accent"]?.bool ?? false
        children = (v["children"]?.array ?? v["items"]?.array ?? []).compactMap(FigItem.init)
        if head.isEmpty && body.isEmpty {
            let all = v.allStrings
            guard !all.isEmpty else { return nil }
            head = all[0]; body = Array(all.dropFirst())
        }
    }

    static func list(_ v: JSONValue?) -> [FigItem] { (v?.array ?? []).compactMap(FigItem.init) }
}

struct FigCol: Hashable {
    var head: String
    var lines: [FigItem]
    var accent: Bool
}

struct FigGua: Hashable {
    var name: String
    var form: String        // hex 六画 · tri 三画
    var head: String?
    var lines: [String]
    var accent: Bool
    /// 卦画(自下而上);卦名对不上返回 nil(只显示字)。
    var binary: String? {
        if form == "tri" { return GuaTable.trigrams[name] ?? GuaTable.hexagrams[name] }
        return GuaTable.hexagrams[name] ?? GuaTable.trigrams[name]
    }
}

/// 一张结构化图解。kind 不认识或必有字段缺了,一律退成 notes(把能找到的字都列出来)。
struct Fig: Hashable {
    enum Kind: String { case quote, cols, rows, flow, tree, timeline, table, gua, ring, notes }
    var kind: Kind
    var title: String?
    var foot: [String] = []
    // quote
    var text = "", gloss: String?, source: String?
    // cols
    var cols: [FigCol] = []
    // rows / ring:items;flow:steps(放在 items 里)+ result + loop;timeline:points(放在 items 里)
    var items: [FigItem] = []
    var result: FigItem?
    var loop = false
    // tree
    var root: FigItem?
    // table
    var heads: [String] = []
    var rows: [[String]] = []
    // gua
    var guas: [FigGua] = []
    var yao: [FigItem] = []
    // ring
    var center: String?
    // notes
    var lines: [String] = []

    init(kind: Kind) { self.kind = kind }

    init(_ v: JSONValue) {
        guard let k = Kind(rawValue: v["kind"]?.string ?? "") else { self = Fig.fallback(v); return }
        self.kind = k
        title = v["title"]?.string.flatMap { $0.isEmpty ? nil : $0 }
        foot = v["foot"]?.strings ?? []
        switch k {
        case .quote:
            text = v["text"]?.string ?? ""
            gloss = v["gloss"]?.string; source = v["source"]?.string
        case .cols:
            cols = (v["cols"]?.array ?? []).compactMap { c in
                let lines = FigItem.list(c["lines"] ?? c["items"])
                let head = c["head"]?.string ?? c["title"]?.string ?? ""
                guard !head.isEmpty || !lines.isEmpty else { return nil }
                return FigCol(head: head, lines: lines, accent: c["accent"]?.bool ?? false)
            }
        case .rows: items = FigItem.list(v["items"] ?? v["rows"])
        case .flow:
            items = FigItem.list(v["steps"] ?? v["items"])
            result = v["result"].flatMap(FigItem.init)
            loop = v["loop"]?.bool ?? false
        case .tree:
            root = v["root"].flatMap(FigItem.init)
            items = FigItem.list(v["branches"] ?? v["items"])
        case .timeline: items = FigItem.list(v["points"] ?? v["items"])
        case .table:
            heads = v["heads"]?.strings ?? []
            rows = (v["rows"]?.array ?? []).map { r in (r.array ?? [r]).map { $0.string ?? $0.allStrings.joined(separator: " ") } }
        case .gua:
            guas = (v["guas"]?.array ?? []).compactMap { g in
                guard let n = g["name"]?.string, !n.isEmpty else { return nil }
                return FigGua(name: n, form: g["form"]?.string ?? (n.count == 1 && GuaTable.hexagrams[n] == nil ? "tri" : "hex"),
                              head: g["head"]?.string, lines: g["lines"]?.strings ?? [], accent: g["accent"]?.bool ?? false)
            }
            yao = FigItem.list(v["yao"])
        case .ring:
            items = FigItem.list(v["items"])
            center = v["center"]?.string
        case .notes: lines = v["lines"]?.strings ?? []
        }
        if !isUsable { self = Fig.fallback(v) }
    }

    /// 必有的内容齐不齐;不齐的退成 notes。
    private var isUsable: Bool {
        switch kind {
        case .quote: return !text.isEmpty
        case .cols: return cols.count >= 2
        case .rows, .timeline, .ring: return !items.isEmpty
        case .flow: return !items.isEmpty
        case .tree: return !items.isEmpty
        case .table: return !rows.isEmpty
        case .gua: return !guas.isEmpty || !yao.isEmpty
        case .notes: return !lines.isEmpty || title != nil
        }
    }

    static func fallback(_ v: JSONValue) -> Fig {
        var f = Fig(kind: .notes)
        f.title = v["title"]?.string
        f.foot = v["foot"]?.strings ?? []
        if case .object(var o) = v { o["title"] = nil; o["foot"] = nil; f.lines = JSONValue.object(o).allStrings } else { f.lines = v.allStrings }
        return f
    }
}

// MARK: 块

/// 书包里图片 / 视频块的媒体(路径已换成本机文件)。
struct BHMedia: Hashable {
    var url: URL
    var poster: URL?
    var alt: String
    var cap: String?
    var w: CGFloat
    var h: CGFloat
    var sec: Double?
    var loop: Bool
    var sound: Bool
    /// 宽高比(宽 / 高);尺寸缺了按 4:3。
    var aspect: CGFloat { w > 0 && h > 0 ? w / h : 4.0 / 3.0 }
}

/// 提纲(outline)的一项:一段字,下面可再挂几项,最多四层。id 是在树里的位置(「0.2.1」),展开收起按它记。
struct BHNode: Hashable, Identifiable {
    var id: String
    var x: String
    var children: [BHNode]

    static func list(_ v: JSONValue?, prefix: String = "", depth: Int = 1) -> [BHNode] {
        guard depth <= 4 else { return [] }
        return (v?.array ?? []).enumerated().compactMap { i, n in
            let id = prefix.isEmpty ? "\(i)" : "\(prefix).\(i)"
            if let s = n.string { return s.isEmpty ? nil : BHNode(id: id, x: BHText.importMarks(s), children: []) }
            guard let x = n["x"]?.string, !x.isEmpty else { return nil }
            return BHNode(id: id, x: BHText.importMarks(x), children: list(n["children"], prefix: id, depth: depth + 1))
        }
    }

    var depth: Int { 1 + (children.map(\.depth).max() ?? 0) }
    var allIDs: [String] { [id] + children.flatMap(\.allIDs) }
}

/// 解码书包文章用:媒体相对这本书的目录找;文字里的 `等宽`、[链接](https://…) 记号换成内部记号。
struct BHDecodeContext {
    var base: URL
    func media(_ p: String?) -> URL? {
        guard let p = DBRules.mediaPath(p) else { return nil }
        let u = base.appendingPathComponent(p)
        return FileManager.default.fileExists(atPath: u.path) ? u : nil
    }
}

enum BHBlock: Hashable {
    case lead(String), h2(String), h3(String), p(String)
    case quote(o: String?, tr: String?)
    case cite(x: String, by: String?)          // 书包的引文:引的话 + 出处
    case callout(tone: String, label: String?, items: [String])
    case pull(String)
    case steps([String])
    case list(ordered: Bool, items: [String])
    case outline([BHNode])
    case refs([String])
    case fig(cap: String, fig: Fig?)
    case img(BHMedia)
    case video(BHMedia)
    case code(String, lang: String?)
    case divider

    /// ctx 为 nil:官方白话包(只有十种块、只认 ** 记号);有 ctx:书包文章(另认六种块与 `等宽`、链接)。
    init?(_ v: JSONValue, ctx: BHDecodeContext? = nil) {
        let mark: (String) -> String = { ctx == nil ? $0 : BHText.importMarks($0) }
        let x = mark(v["x"]?.string ?? "")
        let items = (v["items"]?.strings ?? []).map(mark)
        switch v["t"]?.string ?? "" {
        case "lead": guard !x.isEmpty else { return nil }; self = .lead(x)
        case "h2": guard !x.isEmpty else { return nil }; self = .h2(x)
        case "h3": guard !x.isEmpty else { return nil }; self = .h3(x)
        case "p": guard !x.isEmpty else { return nil }; self = .p(x)
        case "quote":
            let o = v["o"]?.string, tr = v["tr"]?.string.map(mark)
            if !(o ?? "").isEmpty || !(tr ?? "").isEmpty { self = .quote(o: o, tr: tr); return }
            guard ctx != nil, !x.isEmpty else { return nil }
            let by = v["by"]?.string
            self = .cite(x: x, by: (by ?? "").isEmpty ? nil : by)
        case "callout":
            let its = items.isEmpty ? (x.isEmpty ? [] : [x]) : items
            guard !its.isEmpty else { return nil }
            self = .callout(tone: v["tone"]?.string ?? "note", label: v["label"]?.string, items: its)
        case "pull": guard !x.isEmpty else { return nil }; self = .pull(x)
        case "steps": guard !items.isEmpty else { return nil }; self = .steps(items)
        case "list": guard !items.isEmpty else { return nil }; self = .list(ordered: v["ordered"]?.bool ?? false, items: items)
        case "refs": guard !items.isEmpty else { return nil }; self = .refs(items)
        case "outline":
            let n = BHNode.list(v["items"])
            guard !n.isEmpty else { return nil }
            self = .outline(n)
        case "fig":
            let f = v["fig"].flatMap { f -> Fig? in if case .object = f { return Fig(f) } else { return nil } }
            let cap = v["cap"]?.string ?? ""
            guard f != nil || !cap.isEmpty else { return nil }
            self = .fig(cap: cap, fig: f)
        case "img", "video":
            guard let ctx, let url = ctx.media(v["src"]?.string) else { return nil }
            let isVideo = v["t"]?.string == "video"
            guard isVideo == (url.pathExtension == "mp4") else { return nil }
            let num: (String) -> CGFloat = { k in CGFloat(Double(v[k]?.string ?? "") ?? 0) }
            let cap = v["cap"]?.string
            let m = BHMedia(url: url, poster: ctx.media(v["poster"]?.string).flatMap { $0.pathExtension == "mp4" ? nil : $0 },
                            alt: v["alt"]?.string ?? (cap ?? ""), cap: (cap ?? "").isEmpty ? nil : cap,
                            w: num("w"), h: num("h"), sec: Double(v["sec"]?.string ?? ""),
                            loop: v["loop"].map { if case .bool(let b) = $0 { return b } else { return true } } ?? true,
                            sound: v["sound"]?.bool ?? false)
            self = isVideo ? .video(m) : .img(m)
        case "code":
            let raw = v["x"]?.string ?? ""
            guard ctx != nil, !raw.isEmpty else { return nil }
            let lang = v["lang"]?.string
            self = .code(raw, lang: (lang ?? "").isEmpty ? nil : lang)
        case "divider": guard ctx != nil else { return nil }; self = .divider
        default: return nil
        }
    }

    /// 可划线的块(导语、正文段)的字:去掉 ** 记号之后的。
    var markable: String? {
        switch self {
        case .lead(let x), .p(let x): return BHText.plain(x)
        default: return nil
        }
    }
}

struct BHHero: Hashable {
    var badge: String?
    var headline: String?
    var tagline: String?
}

/// 一章白话。块下标就是划线的「段号」(layer "b" 的 seg)。
struct BHChapter: Hashable {
    var no: Int
    var title: String
    var subtitle: String?
    var idea: String?
    var hero: BHHero?
    var blocks: [BHBlock]

    /// 小标题:(块下标, 文字)
    var sections: [(index: Int, title: String)] {
        blocks.enumerated().compactMap { i, b in if case .h2(let x) = b { return (i, BHText.plain(x)) } else { return nil } }
    }

    /// 第 i 块所在的小节标题(之前最近的 h2)。
    func section(of i: Int) -> String? { sections.last { $0.index <= i }?.title }

    /// 白话划线在这一章里还对不对得上:先核原块原偏移;不对就在原块里按字找;再不对(白话改过、块挪了位)到全章可划的块里找第一处。
    func locate(_ h: Highlight) -> (seg: Int, start: Int, end: Int)? {
        if blocks.indices.contains(h.seg), let s = blocks[h.seg].markable {
            if s.chars(h.start, h.end) == h.text { return (h.seg, h.start, h.end) }
            if !h.text.isEmpty, let r = s.range(of: h.text) {
                let a = s.distance(from: s.startIndex, to: r.lowerBound); return (h.seg, a, a + h.text.count)
            }
        }
        guard !h.text.isEmpty else { return nil }
        for (i, b) in blocks.enumerated() {
            if let s = b.markable, let r = s.range(of: h.text) {
                let a = s.distance(from: s.startIndex, to: r.lowerBound); return (i, a, a + h.text.count)
            }
        }
        return nil
    }
}

extension BHChapter {
    /// 书包章文件里的 article(书 / 文集的正文,典籍的深读)。没有可显示的块返回 nil。
    static func article(no: Int, chapterTitle: String, chapterSubtitle: String?, _ a: JSONValue?, base: URL) -> BHChapter? {
        guard let a, case .object = a else { return nil }
        let ctx = BHDecodeContext(base: base)
        let blocks = (a["blocks"]?.array ?? []).compactMap { BHBlock($0, ctx: ctx) }
        guard !blocks.isEmpty else { return nil }
        let t = a["title"]?.string ?? ""
        let sub = a["subtitle"]?.string ?? ""
        let title = t.isEmpty ? chapterTitle : t
        let subtitle = sub.isEmpty ? chapterSubtitle : sub
        return BHChapter(no: no, title: title, subtitle: subtitle == title ? nil : subtitle,
                         idea: a["idea"]?.string, hero: nil, blocks: blocks)
    }
}

struct BHFile {
    var id: String
    var chapters: [Int: BHChapter]

    init(data: Data) throws {
        let root = try JSONDecoder().decode(JSONValue.self, from: data)
        guard case .object(let chs)? = root["chapters"] else { throw CocoaError(.coderReadCorrupt) }
        id = root["id"]?.string ?? ""
        var out: [Int: BHChapter] = [:]
        for (k, v) in chs {
            guard let no = Int(k) else { continue }
            let blocks = (v["blocks"]?.array ?? []).compactMap { BHBlock($0) }
            let hero = v["hero"].flatMap { h -> BHHero? in
                guard case .object = h else { return nil }
                return BHHero(badge: h["badge"]?.string, headline: h["headline"]?.string, tagline: h["tagline"]?.string)
            }
            out[no] = BHChapter(no: no, title: v["title"]?.string ?? "", subtitle: v["subtitle"]?.string, idea: v["idea"]?.string, hero: hero, blocks: blocks)
        }
        chapters = out
    }
}

/// 行内的一段字:加粗、等宽、链接。
struct BHRun: Hashable {
    var text: String
    var bold = false
    var code = false
    var link: URL?
}

/// 白话文字里的行内记号。官方白话只有 `**加粗**`;书包文章另有 `等宽` 与 [文字](https://…),
/// 解码时换成私用区的内部记号(U+E000…E004,正文里不会出现),这样排版、划线偏移、去记号都走同一套。
enum BHText {
    static let codeOpen: Character = "\u{E000}", codeClose: Character = "\u{E001}"
    static let linkOpen: Character = "\u{E002}", linkMid: Character = "\u{E003}", linkClose: Character = "\u{E004}"

    /// 去掉记号的纯文字(划线偏移按它算)。
    static func plain(_ s: String) -> String { runs(s).map(\.text).joined() }

    /// 拆成若干段。`**` 不成对时,落单的最后那个按字面留着(与此前一致)。
    static func runs(_ s: String) -> [BHRun] {
        let hasInner = s.unicodeScalars.contains { (0xE000...0xE004).contains($0.value) }
        guard hasInner || s.contains("**") else { return [BHRun(text: s)] }
        let cs = Array(s)
        // 等宽段里的 ** 不算记号
        var stars = 0
        var inCode = false
        var i = 0
        while i < cs.count {
            if cs[i] == codeOpen { inCode = true } else if cs[i] == codeClose { inCode = false }
            else if !inCode, cs[i] == "*", i + 1 < cs.count, cs[i + 1] == "*" { stars += 1; i += 2; continue }
            i += 1
        }
        let paired = stars % 2 == 0
        var out: [BHRun] = []
        var buf = ""
        var bold = false
        var seen = 0
        func flush() { if !buf.isEmpty { out.append(BHRun(text: buf, bold: bold)); buf = "" } }
        i = 0
        while i < cs.count {
            let c = cs[i]
            if c == codeOpen, let j = cs[(i + 1)...].firstIndex(of: codeClose) {
                flush()
                let t = String(cs[(i + 1)..<j])
                if !t.isEmpty { out.append(BHRun(text: t, bold: bold, code: true)) }
                i = j + 1; continue
            }
            if c == linkOpen, let m = cs[(i + 1)...].firstIndex(of: linkMid), let e = cs[(m + 1)...].firstIndex(of: linkClose) {
                flush()
                let t = String(cs[(i + 1)..<m]), u = String(cs[(m + 1)..<e])
                if !t.isEmpty { out.append(BHRun(text: t, bold: bold, link: URL(string: u))) }
                i = e + 1; continue
            }
            if c == "*", i + 1 < cs.count, cs[i + 1] == "*" {
                seen += 1
                if !paired && seen == stars { buf += "**" } else { flush(); bold.toggle() }
                i += 2; continue
            }
            if (0xE000...0xE004).contains(c.unicodeScalars.first!.value) { i += 1; continue }   // 落单的内部记号不显示
            buf.append(c)
            i += 1
        }
        flush()
        return out
    }

    private static let linkRE = try! NSRegularExpression(pattern: "\\[([^\\[\\]\\n]+)\\]\\((https://[^\\s()]+)\\)")

    /// 书包文字 → 内部记号:`等宽`(成对、不跨行)与 [文字](https://…)(只认 https;别的照字面)。
    static func importMarks(_ raw: String) -> String {
        var s = raw.unicodeScalars.filter { !(0xE000...0xE004).contains($0.value) }.map(String.init).joined()
        guard s.contains("`") || s.contains("](") else { return s }
        // 先切出等宽段(里面不再认链接),其余段里换链接
        var parts: [(String, Bool)] = []
        var cur = ""
        var it = s.startIndex
        while it < s.endIndex {
            let c = s[it]
            if c == "`", let j = s[s.index(after: it)...].firstIndex(where: { $0 == "`" || $0 == "\n" }), s[j] == "`", j > s.index(after: it) {
                parts.append((cur, false)); cur = ""
                parts.append((String(s[s.index(after: it)..<j]), true))
                it = s.index(after: j); continue
            }
            cur.append(c)
            it = s.index(after: it)
        }
        parts.append((cur, false))
        s = parts.map { p, code in
            if code { return String(codeOpen) + p + String(codeClose) }
            let ns = p as NSString
            return linkRE.stringByReplacingMatches(in: p, range: NSRange(location: 0, length: ns.length),
                                                   withTemplate: "\u{E002}$1\u{E003}$2\u{E004}")
        }.joined()
        return s
    }
}

// MARK: 下载与缓存

/// 白话包:随书下载(加到书桌时一并拉),没有就第一次打开时补拉。
/// 清单换了新包而新包还没下到:先用本机上次那份,新的下好、解得开才替换(旧文件随即删掉)。
@MainActor
@Observable
final class BaihuaStore {
    static let shared = BaihuaStore()

    /// 每载入一本加一;界面读它,包到了自动刷新。
    private(set) var version = 0
    @ObservationIgnored private var loading: Set<String> = []
    /// 最近一次没取到白话包的书(白话深读页据此给「没取到 · 重试」,不一直转圈)。
    private(set) var failed: Set<String> = []
    @ObservationIgnored private var files: [String: (name: String, file: BHFile)] = [:]

    private let dir: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("packs", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()

    private func lastGood(_ id: String) -> String? { UserDefaults.standard.string(forKey: "desk.baihua.\(id)") }

    /// 这本书有没有白话(清单说有就算,不管下没下)。书包:有一章带文章就算。
    func offered(_ b: BookInfo) -> Bool { b.isDeskbook ? DeskbookStore.shared.hasArticles(b.id) : b.baihua != nil }

    /// 内存里有的那一份(没载入返回 nil,并在后台载入)。
    func file(_ b: BookInfo) -> BHFile? {
        _ = version
        if let f = files[b.id] { if f.name != b.baihua?.file { Task { await ensure(b) } }; return f.file }
        if !failed.contains(b.id) { Task { await ensure(b) } }     // 失败过的等用户点重试(或下次启动),免得每次重画都去连
        return nil
    }

    func chapter(_ b: BookInfo, _ no: Int) -> BHChapter? {
        if b.isDeskbook { return DeskbookStore.shared.article(b.id, no) }
        return file(b)?.chapters[no]
    }
    func has(_ b: BookInfo, _ no: Int) -> Bool { chapter(b, no) != nil }

    /// 确保这本书的白话在内存里:本机有就读,清单上的新包没有就下。
    func ensure(_ b: BookInfo) async {
        guard !b.isDeskbook else { return }        // 书包的文章在本机包里,打开时现读
        guard let info = b.baihua, !loading.contains(b.id) else { return }
        if files[b.id]?.name == info.file { return }
        loading.insert(b.id)
        defer { loading.remove(b.id) }
        let want = dir.appendingPathComponent(info.file)
        // 1) 清单上的那份已在本机
        if let f = await Self.read(want) { adopt(b.id, info.file, f); return }
        // 2) 先把上次那份顶上,再去下新的
        if files[b.id] == nil, let old = lastGood(b.id), old != info.file, let f = await Self.read(dir.appendingPathComponent(old)) { adopt(b.id, old, f) }
        if let f = await download(info.file) { if failed.contains(b.id) { failed.remove(b.id) }; adopt(b.id, info.file, f) }
        else if files[b.id] == nil, !failed.contains(b.id) { failed.insert(b.id) }
    }

    /// 重试(白话深读页的「重试」)。
    func retry(_ b: BookInfo) async { failed.remove(b.id); await ensure(b) }

    /// 加到书桌时顺手拉(失败不算加书失败,打开时再补)。
    func prefetch(_ b: BookInfo) async {
        guard !b.isDeskbook, let info = b.baihua, !FileManager.default.fileExists(atPath: dir.appendingPathComponent(info.file).path) else { return }
        if await download(info.file) != nil { UserDefaults.standard.set(info.file, forKey: "desk.baihua.\(b.id)"); cleanup(b.id, keep: info.file) }
    }

    private func adopt(_ id: String, _ name: String, _ f: BHFile) {
        files[id] = (name, f)
        if lastGood(id) != name { UserDefaults.standard.set(name, forKey: "desk.baihua.\(id)"); cleanup(id, keep: name) }
        version += 1
    }

    /// 删掉这本书别的(旧的)白话包。
    private func cleanup(_ id: String, keep: String) {
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: dir.path) else { return }
        for n in names where n.hasPrefix("\(id).baihua.") && n != keep { try? FileManager.default.removeItem(at: dir.appendingPathComponent(n)) }
    }

    private func download(_ name: String) async -> BHFile? {
        guard let (data, resp) = try? await Library.session.data(from: Library.base.appendingPathComponent(name)),
              (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        guard let f = await Self.decode(data) else { return nil }        // 坏包不落盘
        try? data.write(to: dir.appendingPathComponent(name), options: .atomic)
        return f
    }

    nonisolated private static func read(_ url: URL) async -> BHFile? {
        guard let d = try? Data(contentsOf: url) else { return nil }
        return await decode(d)
    }

    nonisolated private static func decode(_ d: Data) async -> BHFile? {
        await Task.detached(priority: .userInitiated) { try? BHFile(data: d) }.value
    }

    #if DEBUG
    /// 调试:把内存里的清掉(DESK_BHRELOAD=1 重新读包,测新旧替换)。
    func forget(_ id: String) { files[id] = nil; version += 1 }
    #endif
}

/// 白话深读的阅读位置:书 → 章 → 最上面那一块的下标。只存本机。
@MainActor
enum BaihuaPos {
    private static var map: [String: Int] = (UserDefaults.standard.dictionary(forKey: "desk.baihuaPos") as? [String: Int]) ?? [:]
    static func get(_ book: String, _ no: Int) -> Int? { map["\(book)|\(no)"] }
    static func clear(_ book: String) {
        map = map.filter { !$0.key.hasPrefix("\(book)|") }
        UserDefaults.standard.set(map, forKey: "desk.baihuaPos")
    }
    static func set(_ book: String, _ no: Int, _ block: Int) {
        guard map["\(book)|\(no)"] != block else { return }
        map["\(book)|\(no)"] = block
        UserDefaults.standard.set(map, forKey: "desk.baihuaPos")
    }
}
