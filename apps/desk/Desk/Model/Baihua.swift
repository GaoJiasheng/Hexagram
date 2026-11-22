import Foundation
import Observation

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

enum BHBlock: Hashable {
    case lead(String), h2(String), p(String)
    case quote(o: String?, tr: String?)
    case callout(tone: String, label: String?, items: [String])
    case pull(String)
    case steps([String])
    case list(ordered: Bool, items: [String])
    case refs([String])
    case fig(cap: String, fig: Fig?)

    init?(_ v: JSONValue) {
        let x = v["x"]?.string ?? ""
        switch v["t"]?.string ?? "" {
        case "lead": guard !x.isEmpty else { return nil }; self = .lead(x)
        case "h2": guard !x.isEmpty else { return nil }; self = .h2(x)
        case "p": guard !x.isEmpty else { return nil }; self = .p(x)
        case "quote":
            let o = v["o"]?.string, tr = v["tr"]?.string
            guard !(o ?? "").isEmpty || !(tr ?? "").isEmpty else { return nil }
            self = .quote(o: o, tr: tr)
        case "callout":
            let items = v["items"]?.strings ?? (x.isEmpty ? [] : [x])
            guard !items.isEmpty else { return nil }
            self = .callout(tone: v["tone"]?.string ?? "note", label: v["label"]?.string, items: items)
        case "pull": guard !x.isEmpty else { return nil }; self = .pull(x)
        case "steps": let i = v["items"]?.strings ?? []; guard !i.isEmpty else { return nil }; self = .steps(i)
        case "list": let i = v["items"]?.strings ?? []; guard !i.isEmpty else { return nil }; self = .list(ordered: v["ordered"]?.bool ?? false, items: i)
        case "refs": let i = v["items"]?.strings ?? []; guard !i.isEmpty else { return nil }; self = .refs(i)
        case "fig":
            let f = v["fig"].flatMap { f -> Fig? in if case .object = f { return Fig(f) } else { return nil } }
            let cap = v["cap"]?.string ?? ""
            guard f != nil || !cap.isEmpty else { return nil }
            self = .fig(cap: cap, fig: f)
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
            let blocks = (v["blocks"]?.array ?? []).compactMap(BHBlock.init)
            let hero = v["hero"].flatMap { h -> BHHero? in
                guard case .object = h else { return nil }
                return BHHero(badge: h["badge"]?.string, headline: h["headline"]?.string, tagline: h["tagline"]?.string)
            }
            out[no] = BHChapter(no: no, title: v["title"]?.string ?? "", subtitle: v["subtitle"]?.string, idea: v["idea"]?.string, hero: hero, blocks: blocks)
        }
        chapters = out
    }
}

/// 白话文字里的 **加粗** 记号。
enum BHText {
    /// 去掉记号的纯文字(划线偏移按它算)。
    static func plain(_ s: String) -> String { runs(s).map(\.text).joined() }

    /// 拆成 (字, 是否加粗) 若干段。记号不成对时,落单的那个按字面留着。
    static func runs(_ s: String) -> [(text: String, bold: Bool)] {
        let parts = s.components(separatedBy: "**")
        guard parts.count > 1 else { return [(s, false)] }
        var out: [(String, Bool)] = []
        let paired = parts.count % 2 == 1
        for (i, p) in parts.enumerated() {
            if !paired && i == parts.count - 1 { out.append(("**" + p, false)); continue }
            if !p.isEmpty { out.append((p, i % 2 == 1)) }
        }
        return out
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
    @ObservationIgnored private var files: [String: (name: String, file: BHFile)] = [:]

    private let dir: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("packs", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()

    private func lastGood(_ id: String) -> String? { UserDefaults.standard.string(forKey: "desk.baihua.\(id)") }

    /// 这本书有没有白话(清单说有就算,不管下没下)。
    func offered(_ b: BookInfo) -> Bool { b.baihua != nil }

    /// 内存里有的那一份(没载入返回 nil,并在后台载入)。
    func file(_ b: BookInfo) -> BHFile? {
        _ = version
        if let f = files[b.id] { if f.name != b.baihua?.file { Task { await ensure(b) } }; return f.file }
        Task { await ensure(b) }
        return nil
    }

    func chapter(_ b: BookInfo, _ no: Int) -> BHChapter? { file(b)?.chapters[no] }
    func has(_ b: BookInfo, _ no: Int) -> Bool { chapter(b, no) != nil }

    /// 确保这本书的白话在内存里:本机有就读,清单上的新包没有就下。
    func ensure(_ b: BookInfo) async {
        guard let info = b.baihua, !loading.contains(b.id) else { return }
        if files[b.id]?.name == info.file { return }
        loading.insert(b.id)
        defer { loading.remove(b.id) }
        let want = dir.appendingPathComponent(info.file)
        // 1) 清单上的那份已在本机
        if let f = await Self.read(want) { adopt(b.id, info.file, f); return }
        // 2) 先把上次那份顶上,再去下新的
        if files[b.id] == nil, let old = lastGood(b.id), old != info.file, let f = await Self.read(dir.appendingPathComponent(old)) { adopt(b.id, old, f) }
        if let f = await download(info.file) { adopt(b.id, info.file, f) }
    }

    /// 加到书桌时顺手拉(失败不算加书失败,打开时再补)。
    func prefetch(_ b: BookInfo) async {
        guard let info = b.baihua, !FileManager.default.fileExists(atPath: dir.appendingPathComponent(info.file).path) else { return }
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
        guard let (data, resp) = try? await URLSession.shared.data(from: Library.base.appendingPathComponent(name)),
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
    static func set(_ book: String, _ no: Int, _ block: Int) {
        guard map["\(book)|\(no)"] != block else { return }
        map["\(book)|\(no)"] = block
        UserDefaults.standard.set(map, forKey: "desk.baihuaPos")
    }
}
