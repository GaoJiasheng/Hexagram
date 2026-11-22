import Foundation
import Observation
import UIKit

enum ArtKind: Hashable {
    case cover          // 竖版封面(书目列表、「我的书」小卡)
    case banner         // 横版题图(书桌大卡片、学完页)
    case head(Int)      // 某章题头图(阅读页底部)

    var fileName: String {
        switch self {
        case .cover: "cover.jpg"
        case .banner: "banner.jpg"
        case .head(let n): "head-\(n).jpg"
        }
    }
}

/// 插画:随清单下发(BookInfo.art 说哪些图存在),按需下载、落盘缓存。
/// 取图顺序:内存 → 磁盘(Application Support/art/<书>/)→ 清单说有才起后台下载,下完 version += 1 让界面重画。
/// 下载失败静默,下次取图时再试。清单里该书的 art.v 变了就清掉该书的磁盘缓存。
@MainActor
@Observable
final class ArtStore {
    static let shared = ArtStore()

    /// 每下完一张图加一;界面读它即可在图到了以后自动刷新。
    private(set) var version = 0

    @ObservationIgnored private let memory = NSCache<NSString, UIImage>()
    @ObservationIgnored private var inflight: Set<String> = []
    @ObservationIgnored private var checkedV: [String: String] = [:]   // 本次运行已核过指纹的书 → v

    private let root: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("art", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()

    init() { memory.countLimit = 24 }

    /// 清单里有没有这张图(不管下没下到本机)。
    func has(_ book: BookInfo, _ kind: ArtKind) -> Bool {
        guard let a = book.art else { return false }
        switch kind {
        case .cover: return a.cover
        case .banner: return a.banner
        case .head(let n): return a.heads.contains(n)
        }
    }

    func image(_ book: BookInfo, _ kind: ArtKind) -> UIImage? {
        _ = version   // 让调用方的视图观察到 version
        guard has(book, kind), let art = book.art else { return nil }
        let dir = bookDir(book.id, v: art.v)
        let key = "\(book.id)/\(art.v)/\(kind.fileName)" as NSString
        if let img = memory.object(forKey: key) { return img }
        let file = dir.appendingPathComponent(kind.fileName)
        if let d = try? Data(contentsOf: file), let img = UIImage(data: d) {
            memory.setObject(img, forKey: key)
            return img
        }
        fetch(book.id, v: art.v, kind: kind, to: file)
        return nil
    }

    /// 提前拉这些章的题头图(清单里没有的跳过,已在本机的不再下)。
    func prefetch(_ book: BookInfo, chapters: [Int]) {
        guard let art = book.art else { return }
        let dir = bookDir(book.id, v: art.v)
        for n in chapters where art.heads.contains(n) {
            let kind = ArtKind.head(n)
            let file = dir.appendingPathComponent(kind.fileName)
            if !FileManager.default.fileExists(atPath: file.path) { fetch(book.id, v: art.v, kind: kind, to: file) }
        }
    }

    /// 该书的缓存目录;目录里 .v 记的指纹与清单不同就整目录清掉重建。
    private func bookDir(_ id: String, v: String) -> URL {
        let dir = root.appendingPathComponent(id, isDirectory: true)
        if checkedV[id] == v { return dir }
        let mark = dir.appendingPathComponent(".v")
        let old = try? String(contentsOf: mark, encoding: .utf8)
        if old != v {
            try? FileManager.default.removeItem(at: dir)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try? v.write(to: mark, atomically: true, encoding: .utf8)
        }
        checkedV[id] = v
        return dir
    }

    private func fetch(_ id: String, v: String, kind: ArtKind, to file: URL) {
        let tag = "\(id)/\(v)/\(kind.fileName)"
        guard !inflight.contains(tag) else { return }
        inflight.insert(tag)
        let url = Library.base.appendingPathComponent("art/\(id)/\(kind.fileName)")
        Task {
            defer { inflight.remove(tag) }
            guard let (data, resp) = try? await URLSession.shared.data(from: url),
                  (resp as? HTTPURLResponse)?.statusCode == 200,
                  UIImage(data: data) != nil else { return }          // 失败静默,下次再试
            guard checkedV[id] == v else { return }                  // 下载途中清单换了批图,丢掉
            try? data.write(to: file, options: .atomic)
            version += 1
        }
    }
}
