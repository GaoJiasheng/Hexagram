import Foundation
import Observation
import UIKit

/// 书房书目里的一本(GET /api/desk/shelf,只有管理员能拿到非空的列表)。
struct ShelfItem: Codable, Identifiable, Hashable {
    var id: String
    var revision: Int
    var kind: String?
    var title: String
    var subtitle: String?
    var authors: [String]?
    var summary: String?
    var category: String?
    var tags: [String]?
    var unit: String?
    var chapters: Int?
    var chars: Int?
    var bytes: Int?
    var sha256: String?
    var theme: ShelfTheme?
    var cover: String?
    var banner: String?
    var package: String?
    var updatedAt: String?

    var categoryLabel: String { (category ?? "").isEmpty ? "其他" : category! }
    var kindLabel: String { switch kind { case "book": "现代书"; case "collection": "文集"; default: "典籍" } }
    var accent: BookTheme {
        let d = DeskbookInstaller.defaultTheme
        return BookTheme(accent: theme?.accent ?? d.accent, accent2: theme?.accent2 ?? d.accent2, paper: theme?.paper ?? d.paper)
    }
}

/// 书目里的主题色:三个都可缺(book.json 的 theme 本来就可缺)。
struct ShelfTheme: Codable, Hashable {
    var accent: String?
    var accent2: String?
    var paper: String?
}

/// 书房:管理员的私人书库(对象存储里的书包)。未登录、非管理员:书目接口回空列表,这里什么都不显示,书桌上任何地方都不提书房。
/// 是不是管理员只看「这个账号上次拉到过非空的书目」;拉成功且为空 → 不是;连不上 → 照上次的。
@MainActor
@Observable
final class ShelfStore {
    static let shared = ShelfStore()

    private(set) var items: [ShelfItem] = []
    /// 确认过是管理员的账号 id(本机记着,离线时照旧显示书房)。
    private(set) var adminID: String?
    private(set) var loading = false
    /// 下载进度:书 id → 0…1。
    private(set) var progress: [String: Double] = [:]
    private(set) var failed: [String: String] = [:]
    @ObservationIgnored private var tasks: [String: Task<Void, Never>] = [:]
    @ObservationIgnored private let covers = NSCache<NSString, UIImage>()
    private(set) var coverVersion = 0
    @ObservationIgnored private var coverInflight: Set<String> = []

    private let dir: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("shelf", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    private var listFile: URL { dir.appendingPathComponent("list.json") }

    init() {
        adminID = UserDefaults.standard.string(forKey: "desk.shelf.admin")
        if let d = try? Data(contentsOf: listFile), let x = try? JSONDecoder().decode([ShelfItem].self, from: d) { items = x }
    }

    /// 现在登录着的是管理员。
    var isAdmin: Bool {
        guard let a = adminID, AccountStore.shared.signedIn, let u = AccountStore.shared.user else { return false }
        return a == u.id
    }

    /// 书房里看得见的书目(非管理员一律空)。
    var visibleItems: [ShelfItem] { isAdmin ? items : [] }

    func item(_ id: String) -> ShelfItem? { visibleItems.first { $0.id == id } }

    /// 本机装着的这本是不是旧版。
    func updateAvailable(_ id: String) -> Bool {
        guard let it = item(id), let local = DeskbookStore.shared.info(id) else { return false }
        return it.revision > (local.revision ?? 0)
    }

    /// 拉书目。登出 / 换号时清掉。
    func refresh() async {
        guard let t = AccountStore.shared.token, let u = AccountStore.shared.user else { clear(); return }
        loading = true
        defer { loading = false }
        do {
            var req = URLRequest(url: API.base.appendingPathComponent("desk/shelf"))
            req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
            req.setValue("native", forHTTPHeaderField: "X-Client")
            req.timeoutInterval = 20
            let (data, resp) = try await Library.session.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
                #if DEBUG
                NSLog("DESKSHELF status %d", (resp as? HTTPURLResponse)?.statusCode ?? 0)
                #endif
                return
            }
            // 一条坏了不连累整个书目:逐条解
            struct Loose: Decodable { var items: [JSONValue] }
            let raw = try JSONDecoder().decode(Loose.self, from: data).items
            let list: [ShelfItem] = raw.compactMap { v in
                guard let d = try? JSONSerialization.data(withJSONObject: v.any) else { return nil }
                return try? JSONDecoder().decode(ShelfItem.self, from: d)
            }
            #if DEBUG
            NSLog("DESKSHELF got %d/%d items (status ok)", list.count, raw.count)
            #endif
            if list.isEmpty {
                clear()
            } else {
                items = list
                adminID = u.id
                UserDefaults.standard.set(u.id, forKey: "desk.shelf.admin")
                if let d = try? JSONEncoder().encode(list) { try? d.write(to: listFile, options: .atomic) }
            }
        } catch {
            #if DEBUG
            NSLog("DESKSHELF fail %@", "\(error)")
            #endif
        }     // 连不上:照上次的
    }

    /// 登出、或拉到空列表:书房整个不显示(本机已加的书房的书,文件留着,换回管理员账号又能看到)。
    func clear() {
        items = []
        adminID = nil
        UserDefaults.standard.removeObject(forKey: "desk.shelf.admin")
        try? FileManager.default.removeItem(at: listFile)
        for (_, t) in tasks { t.cancel() }
        tasks = [:]; progress = [:]
    }

    /// 书删了:半截的下载也清掉。
    func forgetLocal(_ id: String) {
        for n in (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [] where n.hasPrefix("\(id)-r") { try? FileManager.default.removeItem(at: dir.appendingPathComponent(n)) }
    }

    private func url(_ path: String?) -> URL? {
        guard let path, path.hasPrefix("/api/") else { return nil }
        return URL(string: path, relativeTo: API.base)?.absoluteURL
    }

    // MARK: 封面

    func cover(_ it: ShelfItem) -> UIImage? {
        _ = coverVersion
        guard let path = it.cover ?? it.banner else { return nil }
        let key = "\(it.id)-r\(it.revision)" as NSString
        if let img = covers.object(forKey: key) { return img }
        let file = dir.appendingPathComponent("\(it.id)-r\(it.revision).cover")
        if let img = Downsample.image(file, maxPixel: 300) { covers.setObject(img, forKey: key); return img }
        guard !coverInflight.contains(it.id), let u = url(path), let t = AccountStore.shared.token else { return nil }
        coverInflight.insert(it.id)
        Task {
            defer { coverInflight.remove(it.id) }
            var req = URLRequest(url: u)
            req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
            guard let (d, r) = try? await Library.session.data(for: req), (r as? HTTPURLResponse)?.statusCode == 200, UIImage(data: d) != nil else { return }
            try? d.write(to: file, options: .atomic)
            coverVersion += 1
        }
        return nil
    }

    // MARK: 下载

    var downloading: Set<String> { Set(progress.keys) }

    /// 下载 → 核 sha256 → 装进书桌(同 id 旧版就地换新,进度与划线照旧)→ 放上书桌。断了下次接着下(Range)。
    func download(_ it: ShelfItem) {
        guard tasks[it.id] == nil, let u = url(it.package) else { return }
        failed[it.id] = nil
        progress[it.id] = 0
        let part = dir.appendingPathComponent("\(it.id)-r\(it.revision).part")
        tasks[it.id] = Task {
            defer { tasks[it.id] = nil; progress[it.id] = nil }
            do {
                guard let t = AccountStore.shared.token else { throw DeskbookError("登录已失效,请重新登录") }
                let dl = RangeDownloader(url: u, token: t, file: part, etag: it.sha256.map { "\"\($0)\"" })
                try await dl.run { p in Task { @MainActor in if self.progress[it.id] != nil { self.progress[it.id] = p } } }
                let sha = try await Task.detached { try DeskbookInstaller.sha256(part) }.value
                if let want = it.sha256, want.lowercased() != sha {
                    try? FileManager.default.removeItem(at: part)
                    throw DeskbookError("下载下来的书包校验没通过,已删掉。请重试。")
                }
                let info = try await DeskbookStore.shared.install(part, origin: .shelf, sha256: sha, keepPackage: false)
                try? FileManager.default.removeItem(at: part)
                Library.shared.putOnShelf(info.id)
            } catch is CancellationError {
            } catch {
                failed[it.id] = (error as? LocalizedError)?.errorDescription ?? "没下下来"
            }
        }
    }
}

/// 按区间续传的下载:本机有半截就带 Range 接着下(If-Range 核 ETag,包换了新版就整包重下)。进度回调 0…1。
final class RangeDownloader: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    private let url: URL
    private let token: String
    private let file: URL
    private let etag: String?
    private var handle: FileHandle?
    private var have: Int64 = 0
    private var total: Int64 = 0
    private var onProgress: ((Double) -> Void)?
    private var cont: CheckedContinuation<Void, Error>?
    private var failure: Error?

    init(url: URL, token: String, file: URL, etag: String?) {
        self.url = url; self.token = token; self.file = file; self.etag = etag
    }

    func run(progress: @escaping (Double) -> Void) async throws {
        onProgress = progress
        let fm = FileManager.default
        if !fm.fileExists(atPath: file.path) { fm.createFile(atPath: file.path, contents: nil) }
        have = (try? fm.attributesOfItem(atPath: file.path)[.size] as? Int64) ?? 0
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("native", forHTTPHeaderField: "X-Client")
        if have > 0 {
            req.setValue("bytes=\(have)-", forHTTPHeaderField: "Range")
            if let etag { req.setValue(etag, forHTTPHeaderField: "If-Range") }
        }
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.waitsForConnectivity = false
        let session = URLSession(configuration: cfg, delegate: self, delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        let task = session.dataTask(with: req)
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
                cont = c
                task.resume()
            }
        } onCancel: { task.cancel() }
    }

    func urlSession(_ s: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        let r = response as? HTTPURLResponse
        switch r?.statusCode ?? 0 {
        case 206:
            total = parseTotal(r) ?? (have + response.expectedContentLength)
        case 200:
            have = 0
            try? FileManager.default.removeItem(at: file)
            FileManager.default.createFile(atPath: file.path, contents: nil)
            total = response.expectedContentLength
        case 416:
            // 已经下全了(或服务器上的包变小了):交给上层核 sha256
            failure = nil
            completionHandler(.cancel)
            finish(nil)
            return
        case 401, 404:
            failure = DeskbookError(r?.statusCode == 401 ? "登录已失效,请重新登录" : "书房里已经没有这本书了")
            completionHandler(.cancel); finish(failure); return
        default:
            failure = DeskbookError("下载没成功(\(r?.statusCode ?? 0))")
            completionHandler(.cancel); finish(failure); return
        }
        handle = try? FileHandle(forWritingTo: file)
        _ = try? handle?.seekToEnd()
        completionHandler(.allow)
    }

    private func parseTotal(_ r: HTTPURLResponse?) -> Int64? {
        guard let cr = r?.value(forHTTPHeaderField: "Content-Range"), let slash = cr.lastIndex(of: "/") else { return nil }
        return Int64(cr[cr.index(after: slash)...])
    }

    func urlSession(_ s: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        do { try handle?.write(contentsOf: data) } catch { failure = DeskbookError("写不进本机存储(空间不够?)"); dataTask.cancel(); return }
        have += Int64(data.count)
        if total > 0 { onProgress?(min(1, Double(have) / Double(total))) }
        if have > Int64(DBRules.totalBytes) { failure = DeskbookError("书包超过 300 MB"); dataTask.cancel() }
    }

    func urlSession(_ s: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        try? handle?.close(); handle = nil
        if let failure { finish(failure); return }
        if let e = error as? URLError, e.code == .cancelled { finish(CancellationError()); return }
        if error != nil { finish(DeskbookError("网络断了,下次接着下")); return }
        finish(nil)
    }

    private func finish(_ e: Error?) {
        guard let c = cont else { return }
        cont = nil
        if let e { c.resume(throwing: e) } else { c.resume() }
    }
}

extension JSONValue {
    /// 换回 Foundation 的对象(再交给 JSONDecoder 用)。
    var any: Any {
        switch self {
        case .string(let s): return s
        case .number(let n): return n
        case .bool(let b): return b
        case .array(let a): return a.map(\.any)
        case .object(let o): return o.mapValues(\.any)
        case .null: return NSNull()
        }
    }
}
