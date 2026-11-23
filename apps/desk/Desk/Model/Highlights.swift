import Foundation
import Observation
import SwiftUI
import UIKit

/// 一条划线(批注挂在划线上)。只落在一段、一层之内;跨段或跨层的选区拆成几条。
/// 坐标两套都存:观象站内的 corpus / slug / ch(与网站同一套,日后云同步与网站显示用),书桌里的 book / no(跳转用)。
/// start / end 是在该段该层文字里的偏移,按 Swift `String` 的字符数算,不含爻题、条号等前缀;
/// text 存被划的原字——原文日后订正改了字,靠它重新定位。
struct Highlight: Codable, Identifiable, Hashable {
    var id: String
    var book: String
    var corpus: String
    var slug: String
    var ch: Int
    var no: Int
    var layer: String        // "o" 原文 · "t" 译文 · "b" 白话(白话深读以后才有)
    var seg: Int
    var start: Int
    var end: Int
    var text: String
    var color: Int           // 0…3
    var note: String?
    var at: Date
    var deleted: Bool = false   // 墓碑:删除不真删,留给云同步合并

    var hasNote: Bool { !(note ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    /// 白话里的划线:章级白话的层是 "b",细粒度白话(一首 / 一条一篇)是 "b:<篇键>"。
    var isBaihua: Bool { layer == "b" || layer.hasPrefix("b:") }
    var baihuaSub: String? { layer.hasPrefix("b:") ? String(layer.dropFirst(2)) : nil }
}

/// 划线里的一段:在第几段、哪一层、从第几个字到第几个字(字符数)、是哪几个字。
struct HLPiece: Hashable {
    var seg: Int
    var layer: String
    var start: Int
    var end: Int
    var text: String
}

/// 划线记录:Application Support/highlights.json,每次改动立即落盘。
@MainActor
@Observable
final class HighlightStore {
    static let shared = HighlightStore()
    private(set) var items: [Highlight] = []
    /// 每改一次加一;阅读页据此把划线重新画到已排好的章上。
    private(set) var version = 0

    private let file: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d.appendingPathComponent("highlights.json")
    }()

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; e.outputFormatting = [.sortedKeys]; return e
    }()
    private static let decoder: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()

    /// 本机改过、还没推上云的记录 id(见 SyncEngine)。
    @ObservationIgnored private(set) var dirty = DirtySet()

    init() {
        if let d = try? Data(contentsOf: file), let f = try? Self.decoder.decode(FileV1.self, from: d) { items = f.items; dirty = f.dirty ?? DirtySet() }
    }

    private struct FileV1: Codable { var v = 1; var items: [Highlight]; var dirty: DirtySet? }

    private func save(changed ids: [String] = []) {
        version += 1
        for i in ids { dirty.mark(i) }
        write()
        if !ids.isEmpty { SyncEngine.shared.noteChange() }
    }

    private func write() {
        if let d = try? Self.encoder.encode(FileV1(items: items, dirty: dirty)) { try? d.write(to: file, options: .atomic) }
    }

    // MARK: 云同步

    /// 推上去的形状(与服务端 highlights 键一致):活的记录全字段,删了的只给墓碑。
    func wire(_ id: String) -> [String: Any]? {
        guard let h = items.first(where: { $0.id == id }) else { return nil }
        if h.deleted { return ["deleted": true, "at": API.iso(h.at)] }
        var d: [String: Any] = ["book": h.book, "corpus": h.corpus, "slug": h.slug, "ch": h.ch, "no": h.no, "layer": h.layer,
                                "seg": h.seg, "start": h.start, "end": h.end, "text": h.text, "color": h.color, "at": API.iso(h.at)]
        if let n = h.note { d["note"] = n }
        return d
    }

    func markAllDirty() { for h in items { dirty.mark(h.id) }; write() }
    func clearDirty(_ snap: [String: Int]) { dirty.clear(snap); write() }

    /// 吃进云端来的整张表:逐条比 at,云端新的覆盖本机(含墓碑);本机没有的活记录加进来。改了就重绘。
    func applyRemote(_ map: [String: Any]) {
        var changed = false
        var index: [String: Int] = [:]
        for (i, h) in items.enumerated() { index[h.id] = i }
        for (id, raw) in map {
            guard let r = raw as? [String: Any], let at = API.date(r["at"]) else { continue }
            if let i = index[id] {
                guard at > items[i].at else { continue }
                if r["deleted"] as? Bool == true {
                    items[i].deleted = true; items[i].note = nil; items[i].at = at
                } else if let h = Self.parse(id, r, at) { items[i] = h } else { continue }
                changed = true
            } else if r["deleted"] as? Bool != true, let h = Self.parse(id, r, at) {
                items.append(h); index[id] = items.count - 1; changed = true
            }
        }
        if changed { version += 1; write() }
    }

    private static func parse(_ id: String, _ r: [String: Any], _ at: Date) -> Highlight? {
        func int(_ k: String) -> Int? { (r[k] as? NSNumber)?.intValue }
        guard let book = r["book"] as? String, let corpus = r["corpus"] as? String, let slug = r["slug"] as? String,
              let ch = int("ch"), let no = int("no"), let layer = r["layer"] as? String, let seg = int("seg"),
              let start = int("start"), let end = int("end"), let text = r["text"] as? String else { return nil }
        return Highlight(id: id, book: book, corpus: corpus, slug: slug, ch: ch, no: no, layer: layer, seg: seg, start: start, end: end,
                         text: text, color: int("color") ?? 0, note: r["note"] as? String, at: at)
    }

    func get(_ id: String) -> Highlight? { items.first { $0.id == id && !$0.deleted } }

    /// 这本书的(活的)划线,按章、段、层、起点排好。
    func alive(book: String) -> [Highlight] {
        items.filter { $0.book == book && !$0.deleted }
            .sorted { ($0.no, $0.seg, $0.layer, $0.start) < ($1.no, $1.seg, $1.layer, $1.start) }
    }

    func inChapter(book: String, no: Int) -> [Highlight] {
        items.filter { $0.book == book && $0.no == no && !$0.deleted }
    }

    @discardableResult
    func add(book: String, chapter: Chapter, pieces: [HLPiece], color: Int, note: String? = nil) -> [Highlight] {
        let now = Date()
        let made = pieces.enumerated().map { k, p in
            Highlight(id: UUID().uuidString, book: book, corpus: chapter.src.corpus, slug: chapter.src.slug, ch: chapter.src.ch, no: chapter.no,
                      layer: p.layer, seg: p.seg, start: p.start, end: p.end, text: p.text, color: color,
                      note: k == pieces.count - 1 ? note : nil, at: now)
        }
        items.append(contentsOf: made)
        save(changed: made.map(\.id))
        return made
    }

    func setColor(_ id: String, _ c: Int) { edit(id) { $0.color = c } }
    func setNote(_ id: String, _ n: String?) {
        let t = n?.trimmingCharacters(in: .whitespacesAndNewlines)
        edit(id) { $0.note = (t ?? "").isEmpty ? nil : t }
    }
    func delete(_ id: String) { edit(id) { $0.deleted = true; $0.note = nil } }
    /// 书包换了版式、章号挪位:划线搬到新章号(记新时间,同步时新者胜)。
    func relocate(_ id: String, ch: Int, no: Int) { edit(id) { $0.ch = ch; $0.no = no } }

    private func edit(_ id: String, _ f: (inout Highlight) -> Void) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        f(&items[i])
        items[i].at = Date()
        save(changed: [id])
    }

    /// 换账号时选了「不并入」:本机的划线连同墓碑全部清掉(不推云,另一个账号的云端不受影响)。
    func resetAll() {
        items = []
        dirty.removeAll()
        version += 1
        write()
    }

    #if DEBUG
    /// 调试入口用:按固定 id 写入(重复启动不累积)。
    func upsertDemo(_ h: Highlight) {
        guard !items.contains(where: { $0.id == h.id }) else { return }   // 已有(含删过的墓碑)就不再动,免得重启后盖掉别处的删除
        items.append(h)
        save(changed: [h.id])
    }
    #endif
}

/// 划线四色:浅色 / 深色各一套,柔和的底色;mark 是批注小圆点等需要显一点的地方用的实色。
enum HLColor {
    static let names = ["黄", "绿", "蓝", "红"]
    private static let fills: [(String, String)] = [("#F6E2A0", "#5A4C25"), ("#D3E8C8", "#2F4630"), ("#D0E1F3", "#2B3E55"), ("#F3D2D0", "#553032")]
    private static let marks: [(String, String)] = [("#C99A1E", "#E2C060"), ("#5C9650", "#8FC583"), ("#4C7DB4", "#86B0DE"), ("#C25B5E", "#E79296")]

    static func fill(_ i: Int) -> UIColor { let p = fills[clamp(i)]; return .pair(p.0, p.1) }
    static func mark(_ i: Int) -> UIColor { let p = marks[clamp(i)]; return .pair(p.0, p.1) }
    static func fillColor(_ i: Int) -> Color { Color(fill(i)) }
    static func markColor(_ i: Int) -> Color { Color(mark(i)) }
    private static func clamp(_ i: Int) -> Int { min(max(i, 0), 3) }

    /// 菜单里用的小色点(UIMenu 的图标要实图)。
    static func dot(_ i: Int) -> UIImage {
        let side: CGFloat = 22
        let img = UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { _ in
            let r = CGRect(x: 2, y: 2, width: side - 4, height: side - 4)
            mark(i).resolvedColor(with: UITraitCollection.current).setFill()
            UIBezierPath(ovalIn: r).fill()
        }
        return img.withRenderingMode(.alwaysOriginal)
    }
}

extension String {
    /// UTF-16 偏移 → 字符数(划线的 start / end 按字符数存)。
    func charOffset(utf16 u: Int) -> Int {
        let i = String.Index(utf16Offset: min(max(u, 0), utf16.count), in: self)
        return distance(from: startIndex, to: i)
    }
    /// 字符数 → UTF-16 偏移。
    func utf16Offset(char c: Int) -> Int {
        (index(startIndex, offsetBy: max(c, 0), limitedBy: endIndex) ?? endIndex).utf16Offset(in: self)
    }
    /// 第 a…b 个字(字符数)。
    func chars(_ a: Int, _ b: Int) -> String? {
        guard a >= 0, b >= a, let i = index(startIndex, offsetBy: a, limitedBy: endIndex), let j = index(startIndex, offsetBy: b, limitedBy: endIndex) else { return nil }
        return String(self[i..<j])
    }
}

extension Chapter {
    /// 某段某层的文字("o" 原文 · "t" 译文)。
    func text(seg: Int, layer: String) -> String? {
        guard segs.indices.contains(seg) else { return nil }
        switch layer {
        case "o": return segs[seg].o
        case "t": return segs[seg].t
        default: return nil
        }
    }

    /// 划线在这一章里还对不对得上:先按存下的偏移核字,不对就按存下的字重新找(找第一处)。找不到返回 nil(「原文已改」)。
    func locate(_ h: Highlight) -> (start: Int, end: Int)? {
        guard let s = text(seg: h.seg, layer: h.layer) else { return nil }
        if s.chars(h.start, h.end) == h.text { return (h.start, h.end) }
        guard !h.text.isEmpty, let r = s.range(of: h.text) else { return nil }
        let a = s.distance(from: s.startIndex, to: r.lowerBound)
        return (a, a + h.text.count)
    }
}
