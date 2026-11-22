import Foundation
import Observation

/// 书目与内容包:拉清单、按书下载、读本机缓存。订了哪些书只存本机(不跨设备同步)。
@MainActor
@Observable
final class Library {
    static let shared = Library()

    var manifest: Manifest?
    var shelf: [String] = []                 // 我订的书(按加入次序)
    var downloading: Set<String> = []
    /// 下载失败的书(书目里那一行显示「没下下来 · 重试」)。
    var failed: Set<String> = []
    var loadError: String?
    /// 正在拉书目(没有缓存的书目时,书目页显示转圈而不是空白)。
    var refreshing = false
    @ObservationIgnored private var packs: [String: BookPack] = [:]

    #if DEBUG
    /// 调试时从本机起的静态服务取内容包:cd <仓库>/public && python3 -m http.server 8765
    static let base = URL(string: ProcessInfo.processInfo.environment["DESK_BASE"] ?? "http://localhost:8765/desk/v1/")!
    #else
    static let base = URL(string: "https://hexa.gavin.pub/desk/v1/")!
    #endif

    private let dir: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("packs", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    private var manifestFile: URL { dir.appendingPathComponent("manifest.json") }

    /// 随 App 带的内容包(构建时从 public/desk/v1 拷进来,见 project.yml 的 preBuildScripts):第一次打开没网也能读六部典籍。
    static let bundled: URL? = Bundle.main.url(forResource: "BundledPacks", withExtension: nil)

    init() {
        shelf = UserDefaults.standard.stringArray(forKey: "desk.shelf") ?? []
        let cached = (try? Data(contentsOf: manifestFile)).flatMap { try? JSONDecoder().decode(Manifest.self, from: $0) }
        let bundledM = Self.bundled.flatMap { try? Data(contentsOf: $0.appendingPathComponent("manifest.json")) }.flatMap { try? JSONDecoder().decode(Manifest.self, from: $0) }
        // 本机存着上次从网上拉的清单就用它;除非 App 更新后随包带的那份更新(打包时间晚于上次拉清单)
        let fetchedAt = UserDefaults.standard.object(forKey: "desk.manifest.at") as? Date ?? .distantPast
        if let c = cached, !(bundledM != nil && Self.bundledAt > fetchedAt) { manifest = c } else { manifest = bundledM ?? cached }
    }

    /// 随 App 带的那批内容包是什么时候打的(bundled.json 的 at,秒)。
    private static var bundledAt: Date {
        guard let u = bundled?.appendingPathComponent("bundled.json"), let d = try? Data(contentsOf: u),
              let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let t = (o["at"] as? NSNumber)?.doubleValue else { return .distantPast }
        return Date(timeIntervalSince1970: t)
    }

    /// 官方典籍 + 本机装着的书包(书房的书只在管理员登录时算进来)。
    var allBooks: [BookInfo] { (manifest?.books ?? []) + DeskbookStore.shared.all.filter(Self.visible) }
    static func visible(_ b: BookInfo) -> Bool { b.origin != .shelf || ShelfStore.shared.isAdmin }
    func isOfficial(_ id: String) -> Bool { manifest?.books.contains { $0.id == id } ?? false || ["daodejing", "lunyu", "sunzi", "guiguzi", "zhuangzi", "yijing"].contains(id) }

    func book(_ id: String) -> BookInfo? {
        if let b = manifest?.books.first(where: { $0.id == id }) { return b }
        return DeskbookStore.shared.info(id).flatMap { Self.visible($0) ? $0 : nil }
    }
    var shelfBooks: [BookInfo] { shelf.compactMap { book($0) } }
    var otherBooks: [BookInfo] { (manifest?.books ?? []).filter { !shelf.contains($0.id) } }

    /// 拉最新清单;拉不到就用上次存下的(离线可用)。
    func refresh() async {
        refreshing = true
        defer { refreshing = false }
        do {
            let (data, resp) = try await Self.session.data(from: Self.base.appendingPathComponent("manifest.json"))
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let m = try JSONDecoder().decode(Manifest.self, from: data)
            manifest = m
            try? data.write(to: manifestFile, options: .atomic)
            UserDefaults.standard.set(Date(), forKey: "desk.manifest.at")
            loadError = nil
        } catch {
            if manifest == nil { loadError = "书目取不到。检查一下网络,或者稍后再试。" }
        }
    }

    /// 取书目与内容包用:连不上时 20 秒内报错(不让转圈一直转下去),不等网络恢复。
    static let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 20
        c.timeoutIntervalForResource = 120
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    func isDownloaded(_ b: BookInfo) -> Bool {
        if b.isDeskbook { return DeskbookStore.shared.info(b.id) != nil }
        return FileManager.default.fileExists(atPath: dir.appendingPathComponent(b.file).path) || bundledFile(b) != nil
    }

    private func bundledFile(_ b: BookInfo) -> URL? {
        guard let u = Self.bundled?.appendingPathComponent(b.file), FileManager.default.fileExists(atPath: u.path) else { return nil }
        return u
    }

    /// 放上书桌(已在书桌上不动)。
    func putOnShelf(_ id: String) {
        guard !shelf.contains(id) else { return }
        shelf.append(id); UserDefaults.standard.set(shelf, forKey: "desk.shelf")
    }

    /// 加到书桌:下载这本书的内容包(已有就不再下)。书包已在本机,直接放上去。
    func add(_ b: BookInfo) async {
        if b.isDeskbook { putOnShelf(b.id); return }
        guard !downloading.contains(b.id) else { return }
        downloading.insert(b.id)
        failed.remove(b.id)
        defer { downloading.remove(b.id) }
        if !isDownloaded(b) {
            do {
                let (data, resp) = try await Self.session.data(from: Self.base.appendingPathComponent(b.file))
                guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
                _ = try JSONDecoder().decode(BookPack.self, from: data)   // 坏包不落盘
                try data.write(to: dir.appendingPathComponent(b.file), options: .atomic)
            } catch { failed.insert(b.id); return }
        }
        if !shelf.contains(b.id) { shelf.append(b.id); UserDefaults.standard.set(shelf, forKey: "desk.shelf") }
        Task { await BaihuaStore.shared.prefetch(b) }     // 白话深读包随书拉;没拉到不碍事,第一次打开时再补
    }

    /// 从书桌收起:只是拿走,进度与内容包都留着。
    func remove(_ id: String) {
        shelf.removeAll { $0 == id }
        UserDefaults.standard.set(shelf, forKey: "desk.shelf")
    }

    func pack(_ b: BookInfo) -> BookPack? {
        if b.isDeskbook { return DeskbookStore.shared.pack(b.id) }
        if let p = packs[b.id], p.version == b.version { return p }
        // 清单上的那份:下载过的 → 随 App 带的 → 本机上一版(清单换了新包而新包还没下:先用旧的,后台补下)
        let want = dir.appendingPathComponent(b.file)
        var url: URL? = FileManager.default.fileExists(atPath: want.path) ? want : bundledFile(b)
        if url == nil {
            let older = ((try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [])
                .filter { $0.hasPrefix("\(b.id).") && !$0.hasPrefix("\(b.id).baihua.") && $0.hasSuffix(".json") }
            url = older.first.map { dir.appendingPathComponent($0) }
            if url != nil, !downloading.contains(b.id) { Task { await self.refreshPack(b) } }
        }
        guard let url, let d = try? Data(contentsOf: url), let p = try? JSONDecoder().decode(BookPack.self, from: d) else { return nil }
        packs[b.id] = p
        return p
    }

    /// 后台补下清单上的新包(下好才换,换完重读)。
    private func refreshPack(_ b: BookInfo) async {
        guard !downloading.contains(b.id) else { return }
        downloading.insert(b.id)
        defer { downloading.remove(b.id) }
        guard let (data, resp) = try? await Self.session.data(from: Self.base.appendingPathComponent(b.file)),
              (resp as? HTTPURLResponse)?.statusCode == 200, (try? JSONDecoder().decode(BookPack.self, from: data)) != nil else { return }
        try? data.write(to: dir.appendingPathComponent(b.file), options: .atomic)
        packs[b.id] = nil
    }
}

/// 续读位置:书 → 章(书内序号)、段(0 起)。M0 先存本机;M3 接云同步(与网站的 readPos 同坐标)。
struct ReadPos: Codable, Equatable {
    var ch: Int
    var seg: Int
    var at: Date
}

@MainActor
@Observable
final class ProgressStore {
    static let shared = ProgressStore()
    private(set) var pos: [String: ReadPos] = [:]
    /// 本机改过、还没推上云的书(见 SyncEngine)。
    @ObservationIgnored private(set) var dirty = DirtySet()

    init() {
        if let d = UserDefaults.standard.data(forKey: "desk.readPos"), let p = try? JSONDecoder().decode([String: ReadPos].self, from: d) { pos = p }
        if let d = UserDefaults.standard.data(forKey: "desk.readPos.dirty"), let x = try? JSONDecoder().decode(DirtySet.self, from: d) { dirty = x }
    }

    func set(_ book: String, ch: Int, seg: Int) {
        let next = ReadPos(ch: ch, seg: seg, at: Date())
        if let old = pos[book], old.ch == ch, old.seg == seg { return }
        pos[book] = next
        dirty.mark(book)
        save()   // 每次翻页立即落盘
        SyncEngine.shared.localMoved(book, ch: ch, seg: seg)
        SyncEngine.shared.noteChange()
    }

    /// 云端来的位置(本机这本书还没有位置时直接用;有位置时只提示、不在这里改)。不算本机改动。
    func adoptRemote(_ book: String, ch: Int, seg: Int, at: Date) {
        pos[book] = ReadPos(ch: ch, seg: seg, at: at)
        save()
    }

    /// 删书时连记录一起删:只清本机这本书的位置(云端那条留着;书不在,同步时找不到就不管)。
    func forget(_ book: String) { pos[book] = nil; save() }

    /// 换账号时选了「不并入」:本机各书的位置清掉,登录后从云端取。
    func resetAll() { pos = [:]; dirty.removeAll(); save() }

    func markAllDirty(_ books: some Sequence<String>) { for b in books where pos[b] != nil { dirty.mark(b) }; save() }
    func clearDirty(_ snap: [String: Int]) { dirty.clear(snap); save() }

    private func save() {
        if let d = try? JSONEncoder().encode(pos) { UserDefaults.standard.set(d, forKey: "desk.readPos") }
        if let d = try? JSONEncoder().encode(dirty) { UserDefaults.standard.set(d, forKey: "desk.readPos.dirty") }
    }
}
