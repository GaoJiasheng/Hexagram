import Foundation
import Observation
import CryptoKit

// 书包(.deskbook,格式见 docs/deskbook-standard.md)在书桌里的样子:
// 导入时解开放进 Application Support/deskbooks/<id>/(章文件、媒体原样,另写一份 index.json 目录),
// 之后读书只开需要的那一章、那一张图;300 MB 的包也不整个进内存。
// 进了书桌,书包与官方典籍是同一套 BookInfo + BookPack:阅读器、文章页、目录、统计、划线都不分来路。
// 坐标:官方典籍沿用站内的 corpus / slug / ch;书包一律 {corpus: "deskbook", slug: 书的 id, ch: 章号}。

/// 导入前给确认卡片看的:书目信息、封面、大小、指纹。
struct DeskbookPreview: Identifiable {
    var id: String { "\(book.id)#\(book.revision ?? 0)#\(sha256)" }
    var book: BookInfo
    var fileBytes: Int
    var unpackedBytes: Int
    var mediaFiles: Int
    var sha256: String
    var cover: Data?
    var generator: String?
    var ignored: [String]
}

enum DeskbookInstaller {
    static let corpus = "deskbook"
    static let defaultTheme = BookTheme(accent: "#3F6E8C", accent2: "#C7673F", paper: "#F7F5EE")

    /// 标准 §6 的两句声明。
    static let disclaimerText: [String: String] = [
        "medical": "本书为知识研习\u{FF0C}不构成医疗建议\u{FF1B}身体不适请就医",
        "divination": "本书为文化与文献研习\u{FF0C}不作预测与决断依据",
    ]

    struct ChapterRef {
        var no: Int
        var file: String
        var title: String
        var subtitle: String?
        var minutes: Int?
        var author: String?
        var date: String?
        var head: String?
    }

    private static func str(_ v: JSONValue?) -> String? {
        guard case .string(let s)? = v else { return nil }
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private static func int(_ v: JSONValue?) -> Int? {
        guard case .number(let n)? = v, n == n.rounded(), abs(n) < 1e9 else { return nil }
        return Int(n)
    }

    private static func hex(_ v: JSONValue?) -> String? {
        guard let s = str(v), s.count == 7, s.hasPrefix("#"), s.dropFirst().allSatisfy(\.isHexDigit) else { return nil }
        return s
    }

    /// 读 book.json:结构上的硬伤直接拒收(说清是哪一处),边角宽松(不认识的字段不管)。
    static func parseBook(_ data: Data, zip: ZipReader, origin: BookOrigin) throws -> (BookInfo, [ChapterRef], String?) {
        guard let root = try? JSONDecoder().decode(JSONValue.self, from: data), case .object = root else {
            throw DeskbookError("book.json 不是合法的 JSON")
        }
        guard str(root["format"]) == "deskbook" else { throw DeskbookError("不是书包:book.json 的 format 不是 deskbook") }
        guard let ver = int(root["version"]), ver >= 1 else { throw DeskbookError("book.json 缺少格式版本 version") }
        if ver > DBRules.formatVersion {
            throw DeskbookError("这本书包用的是更新的格式(第 \(ver) 版),这个版本的书桌读不了。请升级 App 再导入。")
        }
        guard let id = str(root["id"]), id.range(of: "^[a-z0-9][a-z0-9-]{2,63}$", options: .regularExpression) != nil else {
            throw DeskbookError("book.json 的 id 不合规(只许小写字母、数字、-,3–64 个字符)")
        }
        guard let rev = int(root["revision"]), rev >= 1 else { throw DeskbookError("book.json 的 revision 应为正整数") }
        guard let kind = str(root["kind"]), ["classic", "book", "collection"].contains(kind) else {
            throw DeskbookError("book.json 的 kind 应为 classic / book / collection")
        }
        guard let title = str(root["title"]) else { throw DeskbookError("book.json 缺少书名 title") }
        guard let list = root["chapters"]?.array, !list.isEmpty else { throw DeskbookError("book.json 里没有章(chapters)") }
        if list.count > DBRules.chapters { throw DeskbookError("章数超过 \(DBRules.chapters)") }
        var refs: [ChapterRef] = []
        for (i, c) in list.enumerated() {
            guard case .object = c else { throw DeskbookError("chapters 第 \(i + 1) 项不是对象") }
            guard int(c["no"]) == i + 1 else { throw DeskbookError("chapters 的 no 要从 1 起连续(第 \(i + 1) 项不对)") }
            guard let f = str(c["file"]), DBRules.classify(f) == .chapter, zip.entries[f] != nil else {
                throw DeskbookError("第 \(i + 1) 章的文件「\(str(c["file"]) ?? "")」不在书包里")
            }
            let head = DBRules.mediaPath(str(c["head"])).flatMap { zip.entries[$0] != nil && DBRules.classify($0) == .image ? $0 : nil }
            refs.append(ChapterRef(no: i + 1, file: f, title: str(c["title"]) ?? "第 \(i + 1) \(kind == "collection" ? "篇" : "章")",
                                   subtitle: str(c["subtitle"]), minutes: int(c["minutes"]).flatMap { $0 > 0 ? $0 : nil },
                                   author: str(c["author"]), date: str(c["date"]), head: head))
        }
        let image: (JSONValue?) -> String? = { v in
            DBRules.mediaPath(str(v)).flatMap { zip.entries[$0] != nil && DBRules.classify($0) == .image ? $0 : nil }
        }
        let cover = image(root["cover"]), banner = image(root["banner"])
        let t = root["theme"]
        let theme = BookTheme(accent: hex(t?["accent"]) ?? defaultTheme.accent, accent2: hex(t?["accent2"]) ?? defaultTheme.accent2,
                              paper: hex(t?["paper"]) ?? defaultTheme.paper)
        // 分部:须连续覆盖全部章,不合就不分(宽松)
        var parts: [BookPart] = (root["parts"]?.array ?? []).compactMap { p in
            guard let from = int(p["from"]), let to = int(p["to"]), from <= to else { return nil }
            return BookPart(title: str(p["title"]) ?? "", from: from, to: to, note: str(p["note"]))
        }
        var next = 1
        for p in parts { if p.from != next { next = -1; break }; next = p.to + 1 }
        if next != refs.count + 1 { parts = [] }
        // 声明
        var dis: [String] = []
        switch root["disclaimer"] {
        case .string(let s)?: dis = [s]
        case .array(let a)?: dis = a.compactMap(\.string)
        default: break
        }
        dis = dis.compactMap { d in
            let t = d.trimmingCharacters(in: .whitespacesAndNewlines)
            if t.isEmpty { return nil }
            return disclaimerText[t] ?? String(t.prefix(120))
        }
        // 来源一句话
        let src = root["source"]
        var line: String?
        let of = src?["of"]
        let ofTitle = str(of?["title"]), ofAuthor = str(of?["author"])
        let ofLabel = ofTitle.map { "《\($0)》" + (ofAuthor.map { "(\($0))" } ?? "") }
        switch str(src?["type"]) {
        case "original": line = "原创"
        case "digest": line = ofLabel.map { "对\($0)的消化讲解" } ?? "对别人的书的消化讲解"
        case "public-domain": line = "公版原文"
        case "licensed": line = ofLabel.map { "已获授权:\($0)" } ?? "已获授权"
        default: line = nil
        }
        if let n = str(src?["note"]) { line = (line.map { $0 + " · " } ?? "") + n }
        let authors = (root["authors"]?.array ?? []).compactMap { str($0) }
        let unit = str(root["unit"]) ?? (kind == "collection" ? "篇" : "章")
        let heads = refs.compactMap { $0.head == nil ? nil : $0.no }
        let info = BookInfo(id: id, title: title, alias: str(root["subtitle"]) ?? "", era: str(root["category"]) ?? "",
                            attribution: authors.joined(separator: "、"), brief: str(root["summary"]) ?? "", howto: "",
                            template: kind == "classic" ? "deskbook" : "article", unit: String(unit.prefix(4)), chapters: refs.count,
                            summary: nil, segs: 0, chars: 0, parts: parts, theme: theme, version: "r\(rev)", file: "", bytes: Int(zip.fileSize),
                            art: (cover != nil || banner != nil || !heads.isEmpty) ? ArtInfo(cover: cover != nil, banner: banner != nil || cover != nil, heads: heads, v: "r\(rev)") : nil,
                            baihua: nil,
                            origin: origin, kind: kind, subtitle: str(root["subtitle"]), authors: authors, category: str(root["category"]).map { String($0.prefix(24)) },
                            tags: (root["tags"]?.array ?? []).compactMap { str($0) }.prefix(8).map { $0 }, disclaimers: dis, revision: rev,
                            sourceLine: line, about: str(root["description"]), cover: cover, banner: banner)
        return (info, refs, str(root["generator"]))
    }

    /// 整个文件的 SHA-256(边读边算,十六进制小写)。
    static func sha256(_ url: URL) throws -> String {
        guard let h = try? FileHandle(forReadingFrom: url) else { throw DeskbookError("文件打不开") }
        defer { try? h.close() }
        var hasher = SHA256()
        while let d = try h.read(upToCount: 1 << 20), !d.isEmpty { hasher.update(data: d) }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    /// 导入前看一眼:只读中央目录、book.json 与封面,另算指纹。
    static func inspect(_ url: URL, origin: BookOrigin = .imported) throws -> DeskbookPreview {
        let zip = try ZipReader(url: url)
        guard zip.entries["book.json"] != nil else { throw DeskbookError("不是书包:里面没有 book.json") }
        let (info, _, gen) = try parseBook(try zip.data("book.json"), zip: zip, origin: origin)
        let cover = info.cover.flatMap { try? zip.data($0) }
        return DeskbookPreview(book: info, fileBytes: Int(zip.fileSize), unpackedBytes: Int(zip.unpackedBytes),
                               mediaFiles: zip.entries.keys.filter { $0.hasPrefix("media/") }.count,
                               sha256: try sha256(url), cover: cover, generator: gen, ignored: zip.ignored)
    }

    /// 文章的字数(去掉记号与空白):估读时长、统计字数用。
    static func articleChars(_ a: JSONValue?) -> Int {
        var n = 0
        func add(_ s: String?) { if let s { n += BHText.plain(BHText.importMarks(s)).filter { !$0.isWhitespace }.count } }
        for b in a?["blocks"]?.array ?? [] {
            switch b["t"]?.string ?? "" {
            case "img", "video", "fig", "divider", "code": continue
            case "outline":
                func walk(_ v: JSONValue?) { for x in v?.array ?? [] { add(x.string ?? x["x"]?.string); walk(x["children"]) } }
                walk(b["items"])
            default:
                add(b["x"]?.string); add(b["o"]?.string); add(b["tr"]?.string)
                for i in b["items"]?.array ?? [] { add(i.string) }
            }
        }
        return n
    }

    /// 原文字数:只数字,不数标点与空白(与阅读器 ReaderModel.charCount 同一口径)。
    static func textChars(_ s: String) -> Int {
        s.unicodeScalars.reduce(0) { n, u in
            CharacterSet.punctuationCharacters.contains(u) || CharacterSet.symbols.contains(u) || CharacterSet.whitespacesAndNewlines.contains(u) ? n : n + 1
        }
    }

    /// 解开到 dir:章文件、媒体逐个解到文件,再逐章读一遍建目录(index.json)。任何一章结构不对就整包拒收。
    static func unpack(_ url: URL, into dir: URL, origin: BookOrigin) throws -> (BookInfo, BookPack, articles: Int) {
        let fm = FileManager.default
        let zip = try ZipReader(url: url)
        guard zip.entries["book.json"] != nil else { throw DeskbookError("不是书包:里面没有 book.json") }
        let bookData = try zip.data("book.json")
        var (info, refs, _) = try parseBook(bookData, zip: zip, origin: origin)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        try bookData.write(to: dir.appendingPathComponent("book.json"))
        // 解开:章文件与媒体
        for name in zip.entries.keys.sorted() where name != "book.json" {
            let to = dir.appendingPathComponent(name)
            try fm.createDirectory(at: to.deletingLastPathComponent(), withIntermediateDirectories: true)
            try zip.extract(name, to: to)
        }
        // 逐章建目录
        var chapters: [Chapter] = []
        var segTotal = 0, charTotal = 0, articles = 0
        for r in refs {
            let where_ = "第 \(r.no) 章(\(r.file))"
            guard let d = try? Data(contentsOf: dir.appendingPathComponent(r.file)),
                  let v = try? JSONDecoder().decode(JSONValue.self, from: d), case .object = v else {
                throw DeskbookError("\(where_)不是合法的 JSON")
            }
            var segs: [Seg] = []
            if info.kind == "classic" {
                guard let arr = v["segs"]?.array, !arr.isEmpty else { throw DeskbookError("\(where_):典籍的章要有原文分段 segs") }
                for (k, s) in arr.enumerated() {
                    guard let o = s["o"]?.string, !o.isEmpty else { throw DeskbookError("\(where_)第 \(k + 1) 段没有原文 o") }
                    let notes: [Note] = (s["n"]?.array ?? []).compactMap { n in
                        guard let key = n["k"]?.string, !key.isEmpty, o.contains(key), let def = n["d"]?.string, !def.isEmpty else { return nil }
                        return Note(k: key, d: def, r: str(n["r"]), x: str(n["x"]))
                    }
                    segs.append(Seg(o: o, t: str(s["t"]), n: notes.isEmpty ? nil : notes, label: str(s["label"]), line: nil))
                }
            }
            let a = v["article"]
            let hasArticle = BHChapter.article(no: r.no, chapterTitle: r.title, chapterSubtitle: r.subtitle, a, base: dir) != nil
            if info.isArticleBook && !hasArticle { throw DeskbookError("\(where_):没有可读的文章(article.blocks)") }
            if hasArticle { articles += 1 }
            let chars = info.kind == "classic" ? segs.reduce(0) { $0 + textChars($1.o) } : articleChars(a)
            segTotal += segs.count
            charTotal += chars
            let yanyi = (v["yanyi"]?.array ?? []).compactMap { str($0) }
            let meta = ChapterMeta(subtitle: r.subtitle, author: r.author, date: r.date, minutes: r.minutes, head: r.head,
                                   chars: chars, idea: str(a?["idea"]), article: hasArticle)
            chapters.append(Chapter(no: r.no, title: r.title, src: Src(corpus: corpus, slug: info.id, ch: r.no),
                                    kind: info.isCollection ? "text" : nil, gua: nil, segs: segs, yanyi: yanyi.isEmpty ? nil : yanyi, meta: meta))
        }
        info.segs = segTotal
        info.chars = charTotal
        refs.removeAll()
        let pack = BookPack(id: info.id, version: info.version, chapters: chapters)
        try JSONEncoder().encode(pack).write(to: dir.appendingPathComponent("index.json"), options: .atomic)
        return (info, pack, articles)
    }
}

/// 本机装着的书包(书房下来的、自己导入的)。
@MainActor
@Observable
final class DeskbookStore {
    static let shared = DeskbookStore()

    struct Installed: Codable {
        var info: BookInfo
        var sha256: String
        var fileBytes: Int
        var installedAt: Date
        var hasPackage: Bool
        var articles: Int
    }

    private(set) var installed: [String: Installed] = [:]
    /// 装上 / 删掉 / 更新一本加一。
    private(set) var version = 0
    @ObservationIgnored private var packs: [String: BookPack] = [:]
    @ObservationIgnored private var articleCache: [String: BHChapter] = [:]
    @ObservationIgnored private var articleOrder: [String] = []

    let root: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("deskbooks", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()

    init() {
        let fm = FileManager.default
        let dec = JSONDecoder(); dec.dateDecodingStrategy = .iso8601
        for name in (try? fm.contentsOfDirectory(atPath: root.path)) ?? [] {
            // 上次没装完的临时目录:清掉
            if name.hasPrefix(".") { try? fm.removeItem(at: root.appendingPathComponent(name)); continue }
            let m = root.appendingPathComponent(name).appendingPathComponent("meta.json")
            if let d = try? Data(contentsOf: m), let x = try? dec.decode(Installed.self, from: d), x.info.id == name { installed[name] = x }
        }
    }

    func dir(_ id: String) -> URL { root.appendingPathComponent(id, isDirectory: true) }
    func info(_ id: String) -> BookInfo? { installed[id]?.info }
    func record(_ id: String) -> Installed? { installed[id] }
    var all: [BookInfo] { installed.values.map(\.info).sorted { $0.title < $1.title } }
    func hasArticles(_ id: String) -> Bool { (installed[id]?.articles ?? 0) > 0 }

    func pack(_ id: String) -> BookPack? {
        guard let rec = installed[id] else { return nil }
        if let p = packs[id], p.version == rec.info.version { return p }
        guard let d = try? Data(contentsOf: dir(id).appendingPathComponent("index.json")), let p = try? JSONDecoder().decode(BookPack.self, from: d) else { return nil }
        packs[id] = p
        return p
    }

    /// 一章的文章(读章文件、只留最近十几章在内存里)。
    func article(_ id: String, _ no: Int) -> BHChapter? {
        guard let rec = installed[id], let c = pack(id)?.chapters[safe: no - 1], c.meta?.article == true else { return nil }
        let key = "\(id)|\(rec.info.version)|\(no)"
        if let a = articleCache[key] { return a }
        let file = dir(id).appendingPathComponent(String(format: "chapters/%03d.json", no))
        // book.json 里写的文件名不一定是补零三位:按 index 里的次序找不到就到 book.json 里查
        let url = FileManager.default.fileExists(atPath: file.path) ? file : chapterFile(id, no)
        guard let url, let d = try? Data(contentsOf: url), let v = try? JSONDecoder().decode(JSONValue.self, from: d),
              let a = BHChapter.article(no: no, chapterTitle: c.title, chapterSubtitle: c.meta?.subtitle, v["article"], base: dir(id)) else { return nil }
        articleCache[key] = a
        articleOrder.append(key)
        if articleOrder.count > 16 { articleCache[articleOrder.removeFirst()] = nil }
        return a
    }

    private func chapterFile(_ id: String, _ no: Int) -> URL? {
        guard let d = try? Data(contentsOf: dir(id).appendingPathComponent("book.json")), let v = try? JSONDecoder().decode(JSONValue.self, from: d),
              let f = v["chapters"]?.array?[safe: no - 1]?["file"]?.string, DBRules.classify(f) == .chapter else { return nil }
        return dir(id).appendingPathComponent(f)
    }

    /// 包内的媒体 → 本机文件(路径不合规或文件不在返回 nil)。
    func media(_ id: String, _ path: String?) -> URL? {
        guard installed[id] != nil, let p = DBRules.mediaPath(path) else { return nil }
        let u = dir(id).appendingPathComponent(p)
        return FileManager.default.fileExists(atPath: u.path) ? u : nil
    }

    /// 原样的书包(自己导入的才留着,用来再分享出去)。
    func packageURL(_ id: String) -> URL? {
        guard installed[id]?.hasPackage == true else { return nil }
        let u = dir(id).appendingPathComponent("package.deskbook")
        return FileManager.default.fileExists(atPath: u.path) ? u : nil
    }

    /// 装一本:解开到临时目录 → 建目录 → 换进正式位置(同 id 的旧版整个换掉;进度、划线按 id 记,不受影响)。
    @discardableResult
    func install(_ pkg: URL, origin: BookOrigin, sha256 known: String? = nil, keepPackage: Bool) async throws -> BookInfo {
        let tmp = root.appendingPathComponent(".incoming-\(UUID().uuidString)", isDirectory: true)
        let fm = FileManager.default
        do {
            let (info, pack, articles, sha) = try await Task.detached(priority: .userInitiated) { () throws -> (BookInfo, BookPack, Int, String) in
                let sha = try known ?? DeskbookInstaller.sha256(pkg)
                let r = try DeskbookInstaller.unpack(pkg, into: tmp, origin: origin)
                if keepPackage { try FileManager.default.copyItem(at: pkg, to: tmp.appendingPathComponent("package.deskbook")) }
                return (r.0, r.1, r.articles, sha)
            }.value
            if Library.shared.isOfficial(info.id) { throw DeskbookError("这本书包的 id「\(info.id)」与官方典籍重名,书桌不收。请换一个 id(自己做的书以 u- 开头)。") }
            let size = (try? fm.attributesOfItem(atPath: pkg.path)[.size] as? Int) ?? info.bytes
            let rec = Installed(info: info, sha256: sha, fileBytes: size, installedAt: Date(), hasPackage: keepPackage, articles: articles)
            let enc = JSONEncoder(); enc.dateEncodingStrategy = .iso8601
            try enc.encode(rec).write(to: tmp.appendingPathComponent("meta.json"), options: .atomic)
            let final = dir(info.id)
            if fm.fileExists(atPath: final.path) {
                let old = root.appendingPathComponent(".old-\(UUID().uuidString)")
                try fm.moveItem(at: final, to: old)
                try fm.moveItem(at: tmp, to: final)
                try? fm.removeItem(at: old)
            } else {
                try fm.moveItem(at: tmp, to: final)
            }
            installed[info.id] = rec
            packs[info.id] = pack
            articleCache = articleCache.filter { !$0.key.hasPrefix("\(info.id)|") }
            articleOrder.removeAll { $0.hasPrefix("\(info.id)|") }
            ArtStore.shared.forget(info.id)
            version += 1
            return info
        } catch {
            try? fm.removeItem(at: tmp)
            throw error
        }
    }

    /// 删掉一本:书的文件全删;records = true 时连阅读记录(进度、时长、划线、学完)一起删(划线走墓碑,同步到云端)。
    func remove(_ id: String, records: Bool) {
        guard let rec = installed[id] else { return }
        try? FileManager.default.removeItem(at: dir(id))
        installed[id] = nil
        packs[id] = nil
        Library.shared.remove(id)
        if records {
            for h in HighlightStore.shared.alive(book: id) { HighlightStore.shared.delete(h.id) }
            ProgressStore.shared.forget(id)
            BaihuaPos.clear(id)
            ReadDaysStore.shared.zero(corpus: DeskbookInstaller.corpus, slug: id)
            FinishedStore.shared.unmark("\(DeskbookInstaller.corpus):\(id)")
        }
        if rec.info.origin == .shelf { ShelfStore.shared.forgetLocal(id) }
        ArtStore.shared.forget(id)
        version += 1
    }
}
