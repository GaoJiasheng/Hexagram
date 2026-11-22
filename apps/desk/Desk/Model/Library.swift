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
    var loadError: String?
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

    init() {
        shelf = UserDefaults.standard.stringArray(forKey: "desk.shelf") ?? []
        if let d = try? Data(contentsOf: manifestFile), let m = try? JSONDecoder().decode(Manifest.self, from: d) { manifest = m }
    }

    func book(_ id: String) -> BookInfo? { manifest?.books.first { $0.id == id } }
    var shelfBooks: [BookInfo] { shelf.compactMap { book($0) } }
    var otherBooks: [BookInfo] { (manifest?.books ?? []).filter { !shelf.contains($0.id) } }

    /// 拉最新清单;拉不到就用上次存下的(离线可用)。
    func refresh() async {
        do {
            let (data, _) = try await URLSession.shared.data(from: Self.base.appendingPathComponent("manifest.json"))
            let m = try JSONDecoder().decode(Manifest.self, from: data)
            manifest = m
            try? data.write(to: manifestFile, options: .atomic)
            loadError = nil
        } catch {
            if manifest == nil { loadError = "书目取不到,检查一下网络" }
        }
    }

    func isDownloaded(_ b: BookInfo) -> Bool { FileManager.default.fileExists(atPath: dir.appendingPathComponent(b.file).path) }

    /// 加到书桌:下载这本书的内容包(已有就不再下)。
    func add(_ b: BookInfo) async {
        guard !downloading.contains(b.id) else { return }
        downloading.insert(b.id)
        defer { downloading.remove(b.id) }
        if !isDownloaded(b) {
            do {
                let (data, _) = try await URLSession.shared.data(from: Self.base.appendingPathComponent(b.file))
                _ = try JSONDecoder().decode(BookPack.self, from: data)   // 坏包不落盘
                try data.write(to: dir.appendingPathComponent(b.file), options: .atomic)
            } catch { loadError = "《\(b.title)》没下下来,稍后再试"; return }
        }
        if !shelf.contains(b.id) { shelf.append(b.id); UserDefaults.standard.set(shelf, forKey: "desk.shelf") }
    }

    /// 从书桌收起:只是拿走,进度与内容包都留着。
    func remove(_ id: String) {
        shelf.removeAll { $0 == id }
        UserDefaults.standard.set(shelf, forKey: "desk.shelf")
    }

    func pack(_ b: BookInfo) -> BookPack? {
        if let p = packs[b.id], p.version == b.version { return p }
        guard let d = try? Data(contentsOf: dir.appendingPathComponent(b.file)), let p = try? JSONDecoder().decode(BookPack.self, from: d) else { return nil }
        packs[b.id] = p
        return p
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

    init() {
        if let d = UserDefaults.standard.data(forKey: "desk.readPos"), let p = try? JSONDecoder().decode([String: ReadPos].self, from: d) { pos = p }
    }

    func set(_ book: String, ch: Int, seg: Int) {
        let next = ReadPos(ch: ch, seg: seg, at: Date())
        if let old = pos[book], old.ch == ch, old.seg == seg { return }
        pos[book] = next
        if let d = try? JSONEncoder().encode(pos) { UserDefaults.standard.set(d, forKey: "desk.readPos") }   // 每次翻页立即落盘
    }
}
