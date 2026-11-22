import Foundation
import Observation

/// 一天在一章读了多久:与网站 readDays 同一形状。sec 活跃秒数 · n 读了几次 · at 最后改动 · c 当天在这一章读过的原文字数。
struct ReadDay: Codable, Equatable {
    var sec: Int = 0
    var n: Int = 0
    var at: Date = Date()
    var c: Int = 0
}

/// 学习时长日聚合。键与网站一致:`YYYY-MM-DD|corpus|slug|ch|dev`(日期按本地时区)。别的设备的记录也存着(统计用,M4)。
/// Application Support/readDays.json,每次改动立即落盘。
@MainActor
@Observable
final class ReadDaysStore {
    static let shared = ReadDaysStore()
    private(set) var days: [String: ReadDay] = [:]
    @ObservationIgnored private(set) var dirty = DirtySet()
    /// 今天已计过字数的段(`slug|ch|seg`),同一天同一段不重复计。只留当天。
    @ObservationIgnored private var counted: [String: Set<String>] = [:]
    /// 本机设备号:16 位十六进制,第一次用时生成,存着不变。
    let dev: String

    private static let keepDays = 400
    private static let maxKeys = 2500

    private let file: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d.appendingPathComponent("readDays.json")
    }()
    private struct FileV1: Codable { var v = 1; var days: [String: ReadDay]; var dirty: DirtySet; var counted: [String: Set<String>] }
    private static let encoder: JSONEncoder = { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; e.outputFormatting = [.sortedKeys, .prettyPrinted]; return e }()
    private static let decoder: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()

    init() {
        if let d = UserDefaults.standard.string(forKey: "desk.dev"), d.count == 16 { dev = d }
        else {
            var bytes = [UInt8](repeating: 0, count: 8)
            _ = SecRandomCopyBytes(kSecRandomDefault, 8, &bytes)
            dev = bytes.map { String(format: "%02x", $0) }.joined()
            UserDefaults.standard.set(dev, forKey: "desk.dev")
        }
        if let d = try? Data(contentsOf: file), let f = try? Self.decoder.decode(FileV1.self, from: d) {
            days = f.days; dirty = f.dirty; counted = f.counted
        }
    }

    static func day(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// 某一章累计秒数(全部日子、全部设备),直接扫日聚合;阅读页每拍判断「学过」用。
    func totalSec(_ src: Src) -> Int {
        let needle = "|\(src.corpus)|\(src.slug)|\(src.ch)|"
        var n = 0
        for (k, e) in days where k.dropFirst(10).hasPrefix(needle) { n += e.sec }
        return n
    }

    func key(_ src: Src, at d: Date = Date()) -> String { "\(Self.day(d))|\(src.corpus)|\(src.slug)|\(src.ch)|\(dev)" }

    /// 记一段时长。final = 一次阅读结清(次数 +1);false = 中途先存一笔(防闪退丢)。
    func addTime(_ src: Src, sec: Int, final: Bool, day: Date) {
        guard sec > 0 || final else { return }
        let k = key(src, at: day)
        var e = days[k] ?? ReadDay()
        e.sec += max(0, sec)
        if final { e.n += 1 }
        e.at = Date()
        days[k] = e
        changed(k)
    }

    /// 一页显示满 3 秒:把这页各段的原文字数计入(当天已计过的段跳过)。
    func addChars(_ src: Src, segs: [(seg: Int, chars: Int)]) {
        let today = Self.day(Date())
        var seen = counted[today] ?? []
        var add = 0
        for s in segs {
            let id = "\(src.slug)|\(src.ch)|\(s.seg)"
            if seen.insert(id).inserted { add += s.chars }
        }
        counted = [today: seen]
        guard add > 0 else { write(); return }
        let k = key(src)
        var e = days[k] ?? ReadDay()
        e.c += add
        e.at = Date()
        days[k] = e
        changed(k)
    }

    private func changed(_ k: String) {
        dirty.mark(k)
        prune()
        write()
        SyncEngine.shared.noteChange()
    }

    private func prune() {
        let floor = Self.day(Date().addingTimeInterval(-Double(Self.keepDays) * 86400))
        for k in days.keys where k.prefix(10) < floor { days[k] = nil }
        if days.count > Self.maxKeys {
            for k in days.keys.sorted().prefix(days.count - Self.maxKeys) { days[k] = nil }
        }
    }

    private func write() {
        if let d = try? Self.encoder.encode(FileV1(days: days, dirty: dirty, counted: counted)) { try? d.write(to: file, options: .atomic) }
    }

    // MARK: 云同步

    func wire(_ k: String) -> [String: Any]? {
        guard let e = days[k] else { return nil }
        return ["sec": e.sec, "n": e.n, "at": API.iso(e.at), "c": e.c]
    }
    func markAllDirty() { for k in days.keys { dirty.mark(k) }; write() }
    func clearDirty(_ snap: [String: Int]) { dirty.clear(snap); write() }

    /// 删书时连记录一起删:这本书各章的时长与字数清零(不删键:云端按并集合并,删键会被拉回来;清零的记录推上去,别的设备也跟着清零)。
    func zero(corpus: String, slug: String) {
        let needle = "|\(corpus)|\(slug)|"
        var any = false
        for (k, e) in days where k.dropFirst(10).hasPrefix(needle) && (e.sec > 0 || e.c > 0 || e.n > 0) {
            days[k] = ReadDay(sec: 0, n: 0, at: Date(), c: 0)
            dirty.mark(k); any = true
        }
        if any { write(); SyncEngine.shared.noteChange() }
    }
    /// 换账号时选了「不并入」:本机的时长记录全部清掉(设备号不变)。
    func resetAll() { days = [:]; dirty.removeAll(); counted = [:]; write() }

    #if DEBUG
    /// 调试入口用:整批写入(键已带日期与设备号),只写本机、不标脏(不推上云)。
    func seedDemo(_ map: [String: ReadDay]) {
        for (k, v) in map { days[k] = v }
        write()
    }
    #endif

    func applyRemote(_ map: [String: Any]) {
        var changed = false
        for (k, raw) in map {
            guard let r = raw as? [String: Any], r["deleted"] as? Bool != true, let at = API.date(r["at"]) else { continue }
            if let cur = days[k], cur.at >= at { continue }
            days[k] = ReadDay(sec: (r["sec"] as? NSNumber)?.intValue ?? 0, n: (r["n"] as? NSNumber)?.intValue ?? 0, at: at, c: (r["c"] as? NSNumber)?.intValue ?? 0)
            changed = true
        }
        if changed { prune(); write() }
    }
}

/// 学完的书:键 `corpus:slug`(与网站 finished 键一致),一本书有几个 slug 就记几条。
@MainActor
@Observable
final class FinishedStore {
    static let shared = FinishedStore()
    struct Rec: Codable, Equatable { var at: Date; var deleted = false }
    private(set) var recs: [String: Rec] = [:]
    @ObservationIgnored private(set) var dirty = DirtySet()

    init() {
        let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601
        if let x = UserDefaults.standard.data(forKey: "desk.finished"), let r = try? d.decode([String: Rec].self, from: x) { recs = r }
        if let x = UserDefaults.standard.data(forKey: "desk.finished.dirty"), let r = try? JSONDecoder().decode(DirtySet.self, from: x) { dirty = r }
    }

    static func keys(_ pack: BookPack) -> [String] {
        var seen: [String] = []
        for c in pack.chapters { let k = "\(c.src.corpus):\(c.src.slug)"; if !seen.contains(k) { seen.append(k) } }
        return seen
    }

    func isFinished(_ pack: BookPack) -> Bool { Self.keys(pack).allSatisfy { recs[$0].map { !$0.deleted } ?? false } }

    func markFinished(_ pack: BookPack) {
        let now = Date()
        for k in Self.keys(pack) where recs[k].map({ $0.deleted }) ?? true { recs[k] = Rec(at: now); dirty.mark(k) }
        save()
        SyncEngine.shared.noteChange()
    }

    #if DEBUG
    func seedDemo(_ pack: BookPack, at: Date) { for k in Self.keys(pack) where recs[k] == nil { recs[k] = Rec(at: at) }; save() }
    #endif

    func wire(_ k: String) -> [String: Any]? {
        guard let r = recs[k] else { return nil }
        return r.deleted ? ["deleted": true, "at": API.iso(r.at)] : ["at": API.iso(r.at)]
    }
    func markAllDirty() { for k in recs.keys { dirty.mark(k) }; save() }
    func clearDirty(_ snap: [String: Int]) { dirty.clear(snap); save() }
    func resetAll() { recs = [:]; dirty.removeAll(); save() }
    /// 撤销学完(删书连记录一起删时):留墓碑,推上云。
    func unmark(_ k: String) {
        guard let r = recs[k], !r.deleted else { return }
        recs[k] = Rec(at: Date(), deleted: true); dirty.mark(k); save()
        SyncEngine.shared.noteChange()
    }
    var hasAny: Bool { recs.values.contains { !$0.deleted } }

    func applyRemote(_ map: [String: Any]) {
        var changed = false
        for (k, raw) in map {
            guard let r = raw as? [String: Any], let at = API.date(r["at"]) else { continue }
            if let cur = recs[k], cur.at >= at { continue }
            recs[k] = Rec(at: at, deleted: r["deleted"] as? Bool == true)
            changed = true
        }
        if changed { save() }
    }

    private func save() {
        let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601
        if let x = try? e.encode(recs) { UserDefaults.standard.set(x, forKey: "desk.finished") }
        if let x = try? JSONEncoder().encode(dirty) { UserDefaults.standard.set(x, forKey: "desk.finished.dirty") }
    }
}

/// 书桌自己的设置:跟着账号走,写在网站 settings 里自己的字段上(其余字段是网站的,原样带回)。
/// 目前只有每周目标 deskGoal(分钟,默认 120);在统计页里设。
@MainActor
@Observable
final class DeskSettings {
    static let shared = DeskSettings()
    private(set) var deskGoal: Int
    @ObservationIgnored private(set) var at: Date
    @ObservationIgnored private(set) var dirty: Bool

    /// 目标的改动史(只存本机,不进同步的 settings):哪天起改成多少分钟。连续周数按「那一周生效的目标」判,
    /// 不拿现在的目标去量过去的周。第一次改目标时先补一条「此前一直是旧目标」(day = "0000-00-00")。
    struct GoalChange: Codable, Equatable { var day: String; var min: Int }
    @ObservationIgnored private(set) var history: [GoalChange]

    init() {
        let u = UserDefaults.standard
        deskGoal = u.object(forKey: "desk.goal") as? Int ?? 120
        at = u.object(forKey: "desk.goal.at") as? Date ?? .distantPast
        dirty = u.bool(forKey: "desk.goal.dirty")
        history = (u.data(forKey: "desk.goal.history")).flatMap { try? JSONDecoder().decode([GoalChange].self, from: $0) } ?? []
    }

    /// 某一周(给这一周的周日)生效的目标(分钟):这一周结束前最后一次改成的值;没有改动史就是现在的目标。
    func goal(weekEnding sunday: String) -> Int {
        history.last { $0.day <= sunday }?.min ?? history.first?.min ?? deskGoal
    }

    private func record(_ m: Int, from old: Int, on day: String) {
        if history.isEmpty { history.append(GoalChange(day: "0000-00-00", min: old)) }
        if let i = history.lastIndex(where: { $0.day <= day }), history[i].day == day { history[i].min = m }
        else { history.append(GoalChange(day: day, min: m)); history.sort { $0.day < $1.day } }
        if history.count > 200 { history.removeFirst(history.count - 200) }
    }

    /// 用户自己设过目标没有(没设过时首页卡上给「设定目标」入口)。
    var isGoalSet: Bool { at != .distantPast }

    /// 推上去时写进 settings 的字段。
    var fields: [String: Any] { ["deskGoal": deskGoal] }

    func setGoal(_ m: Int) {
        guard m != deskGoal || at == .distantPast else { return }
        if m != deskGoal { record(m, from: deskGoal, on: ReadDaysStore.day(Date())) }
        deskGoal = m; at = Date(); dirty = true
        save()
        SyncEngine.shared.noteChange()
    }

    func markDirty() { if at != .distantPast { dirty = true; save() } }
    func pushed(at stamp: Date) { if at <= stamp { dirty = false }; save() }

    /// 云端 settings 里有书桌的字段、且比本机新:用云端的。
    func applyRemote(_ settings: [String: Any], at cloudAt: Date) {
        guard !dirty, cloudAt > at, let g = (settings["deskGoal"] as? NSNumber)?.intValue, g > 0 else { return }
        if g != deskGoal { record(g, from: deskGoal, on: ReadDaysStore.day(cloudAt)) }
        deskGoal = g; at = cloudAt
        save()
    }

    /// 换账号时选了「不并入」:目标回到默认、改动史清空,登录后从云端取。
    func resetAll() { deskGoal = 120; at = .distantPast; dirty = false; history = []; save() }

    private func save() {
        let u = UserDefaults.standard
        u.set(deskGoal, forKey: "desk.goal"); u.set(at, forKey: "desk.goal.at"); u.set(dirty, forKey: "desk.goal.dirty")
        if let d = try? JSONEncoder().encode(history) { u.set(d, forKey: "desk.goal.history") }
    }

    #if DEBUG
    /// 调试:DESK_GOALHIST=2026-10-01:60,2026-11-10:300 直接写入改动史(测连续周数按当周目标判)。
    func seedHistory(_ spec: String) {
        history = spec.split(separator: ",").compactMap { p in
            let kv = p.split(separator: ":"); guard kv.count == 2, let m = Int(kv[1]) else { return nil }
            return GoalChange(day: String(kv[0]), min: m)
        }.sorted { $0.day < $1.day }
        if let last = history.last { deskGoal = last.min; if at == .distantPast { at = Date() } }
        save()
    }
    #endif
}
