import Foundation
import Observation

/// 一本书内容包的轻量摘要:各章坐标与字数、总览坐标、学完的键。统计、书桌的进度条、同步找坐标只要这些,
/// 不必把整本书(原文、译文、注释,大的一本好几 MB)读进内存。
/// 第一次用到时从内容包算一遍(算完包就放掉,不进 Library 的缓存),按书 id + 版本存盘(Application Support/packSummaries.json)。
struct PackSummary: Codable, Equatable {
    var version: String
    /// 各章坐标,下标 = 章号 − 1
    var srcs: [Src]
    /// 各章字数(典籍是原文字数,文章书是文章字数)
    var chars: [Int]
    /// 书包的全书总览(第 0 章)
    var overview: Src?
    /// 学完的键(corpus:slug,一本书有几个 slug 就几条)
    var keys: [String]

    @MainActor init(_ p: BookPack) {
        version = p.version
        srcs = p.chapters.map(\.src)
        chars = p.chapters.map { $0.segs.isEmpty ? ($0.meta?.chars ?? 0) : $0.segs.reduce(0) { $0 + ReaderModel.charCount($1.o) } }
        overview = p.overview?.src
        keys = FinishedStore.keys(p)
    }

    var count: Int { srcs.count }
    /// 章号 → 坐标(0 = 总览)
    func src(_ no: Int) -> Src? { no == 0 ? overview : srcs[safe: no - 1] }
    /// 坐标 → 章号(总览为 0)
    func no(of s: Src) -> Int? { s == overview ? 0 : srcs.firstIndex(of: s).map { $0 + 1 } }
}

@MainActor
final class PackSummaries {
    static let shared = PackSummaries()
    private var map: [String: PackSummary]
    private var dirty = false
    private let file: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return d.appendingPathComponent("packSummaries.json")
    }()

    init() {
        map = (try? Data(contentsOf: file)).flatMap { try? JSONDecoder().decode([String: PackSummary].self, from: $0) } ?? [:]
    }

    /// 这本书的摘要;本机没有内容包(没下)为 nil。版本对不上就重算。
    func of(_ b: BookInfo) -> PackSummary? {
        if let s = map[b.id], s.version == b.version { return s }
        // 书包的版本号只在 info 里(r<revision>);官方典籍是清单里的内容哈希
        guard let p = Library.shared.peekPack(b) else { return nil }
        let s = PackSummary(p)
        map[b.id] = s
        scheduleSave()
        return s
    }

    /// 装上新版 / 删书时丢掉旧摘要。
    func forget(_ id: String) { if map.removeValue(forKey: id) != nil { scheduleSave() } }

    private func scheduleSave() {
        guard !dirty else { return }
        dirty = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
            guard let self else { return }
            self.dirty = false
            if let d = try? JSONEncoder().encode(self.map) { try? d.write(to: self.file, options: .atomic) }
        }
    }
}

/// 本进程占用的内存(phys_footprint,与 Xcode 内存表、系统杀后台时看的是同一个数)。
enum MemoryFootprint {
    static func bytes() -> Int {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
        let r = withUnsafeMutablePointer(to: &info) { $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count) } }
        return r == KERN_SUCCESS ? Int(info.phys_footprint) : 0
    }
}
