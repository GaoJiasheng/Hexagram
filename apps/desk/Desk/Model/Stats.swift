import Foundation
import Observation

/// 一段时间里的统计:时长(秒)、读过的字数、学习天数、划线数、批注数,另按书拆开。
struct WindowStats: Equatable {
    var sec = 0
    var chars = 0
    var days = 0
    var marks = 0
    var notes = 0
    var books: [BookRow] = []
    var isEmpty: Bool { sec == 0 && chars == 0 && marks == 0 }

    struct BookRow: Equatable, Identifiable {
        var id: String          // 书 id;不在书桌书目里的篇目(网站上读的别的书)合成一行 "_other"
        var sec: Int
        var chars: Int
        var marks: Int
    }
}

enum StatsWindow: String, CaseIterable, Identifiable {
    case today, week, month, all
    var id: String { rawValue }
    var label: String {
        switch self { case .today: "今天"; case .week: "本周"; case .month: "30 天"; case .all: "全部" }
    }
}

/// 学完一本书的账单。
struct FinishStats: Equatable {
    var days: Int
    var sec: Int
    var chars: Int
    var marks: Int
    var notes: Int
    var from: Date?
    var to: Date?
    var sample = false
    static let sample = FinishStats(days: 23, sec: 412 * 60, chars: 6446, marks: 37, notes: 9,
                                    from: Calendar.current.date(byAdding: .day, value: -40, to: Date()), to: Date(), sample: true)
}

/// 统计的计算层。数据源:日聚合(ReadDaysStore)、划线(HighlightStore)、学完(FinishedStore)、书目与内容包(Library)。
/// 源数据一变(自动观察)就在下一拍整体重算一次、存成快照;界面只读快照,不在 body 里扫原始数据。
/// 口径:
/// - 学过:某一章(按站内坐标 Src)累计活跃秒数 ≥ 180,跨天、跨设备合计。
/// - 书:日聚合的 corpus/slug/ch 用本机已下载内容包里各章的 `Chapter.src` 归到书桌的书与章;归不上的(网站上读的别的书)只进总数和「其他」一行。
/// - 周:周一起。连续周数:从上周往回数连续达标的周,本周已达标再加一。过去的周按那一周生效的目标判(本机留目标改动史)。
@MainActor
@Observable
final class Stats {
    static let shared = Stats()
    static let learnedSec = 180

    struct Agg: Equatable { var sec = 0; var chars = 0 }
    private struct BookIndex { var srcNo: [Src: Int]; var chapterChars: [Int] }

    /// 每章累计秒数(全部天、全部设备)。
    private(set) var secBySrc: [Src: Int] = [:]
    /// 每天合计。键 YYYY-MM-DD。
    private(set) var perDay: [String: Agg] = [:]
    /// 每本书每天。书 id → 日 → 合计;"_other" 是归不上书的。
    private(set) var perBookDay: [String: [String: Agg]] = [:]
    /// 划线:(日, 书, 有无批注)。只算活的。
    @ObservationIgnored private var marks: [(day: String, book: String, note: Bool)] = []
    @ObservationIgnored private var books: [String: BookIndex] = [:]
    @ObservationIgnored private var windowCache: [StatsWindow: WindowStats] = [:]
    @ObservationIgnored private var pending = false
    /// 每重算一次加一。
    private(set) var rev = 0

    init() {
        recompute()
        observe()
    }

    private func observe() {
        withObservationTracking {
            _ = ReadDaysStore.shared.days
            _ = HighlightStore.shared.version
            _ = FinishedStore.shared.recs
            _ = Library.shared.manifest
            _ = Library.shared.shelf
            _ = DeskbookStore.shared.version
            _ = ShelfStore.shared.adminID
            _ = DeskSettings.shared.deskGoal
        } onChange: { [weak self] in
            Task { @MainActor in self?.schedule() }
        }
    }

    private func schedule() {
        observe()
        guard !pending else { return }
        pending = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            guard let self else { return }
            self.pending = false
            self.recompute()
        }
    }

    // MARK: 重算

    func recompute() {
        // 书的索引:本机已下载的内容包
        var idx: [String: BookIndex] = [:]
        var bookOf: [Src: String] = [:]
        for b in Library.shared.allBooks {
            guard let p = Library.shared.pack(b) else { continue }
            var m: [Src: Int] = [:]
            var cc: [Int] = []
            for c in p.chapters {
                m[c.src] = c.no
                bookOf[c.src] = b.id
                cc.append(c.segs.isEmpty ? (c.meta?.chars ?? 0) : c.segs.reduce(0) { $0 + ReaderModel.charCount($1.o) })
            }
            // 全书总览(第 0 章)的时长归这本书,但不进「学过几章」
            if let o = p.overview { bookOf[o.src] = b.id }
            idx[b.id] = BookIndex(srcNo: m, chapterChars: cc)
        }
        books = idx

        var bySrc: [Src: Int] = [:]
        var day: [String: Agg] = [:]
        var bookDay: [String: [String: Agg]] = [:]
        for (k, e) in ReadDaysStore.shared.days {
            let parts = k.split(separator: "|", omittingEmptySubsequences: false)
            guard parts.count >= 4, let ch = Int(parts[3]) else { continue }
            let d = String(parts[0])
            let src = Src(corpus: String(parts[1]), slug: String(parts[2]), ch: ch)
            bySrc[src, default: 0] += e.sec
            day[d, default: Agg()].sec += e.sec
            day[d, default: Agg()].chars += e.c
            let b = bookOf[src] ?? "_other"
            bookDay[b, default: [:]][d, default: Agg()].sec += e.sec
            bookDay[b, default: [:]][d, default: Agg()].chars += e.c
        }
        secBySrc = bySrc
        perDay = day.filter { $0.value.sec > 0 || $0.value.chars > 0 }
        perBookDay = bookDay
        marks = HighlightStore.shared.items.filter { !$0.deleted }.map { (ReadDaysStore.day($0.at), $0.book, $0.hasNote) }
        windowCache = [:]
        rev += 1
    }

    // MARK: 日期

    static func dayString(_ d: Date) -> String { ReadDaysStore.day(d) }
    static var cal: Calendar { var c = Calendar(identifier: .gregorian); c.firstWeekday = 2; c.timeZone = .current; return c }
    static func monday(of d: Date) -> Date {
        let c = cal
        let start = c.startOfDay(for: d)
        let wd = c.component(.weekday, from: start)        // 1 = 周日
        return c.date(byAdding: .day, value: -((wd + 5) % 7), to: start)!
    }
    static func add(_ days: Int, to d: Date) -> Date { cal.date(byAdding: .day, value: days, to: d)! }
    /// 把 YYYY-MM-DD 读回日期(本地零点)。
    static func date(_ s: String) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }

    private func range(_ w: StatsWindow, now: Date = Date()) -> (String, String) {
        let today = Self.dayString(now)
        switch w {
        case .today: return (today, today)
        case .week: return (Self.dayString(Self.monday(of: now)), today)
        case .month: return (Self.dayString(Self.add(-29, to: now)), today)
        case .all: return ("0000", "9999")
        }
    }

    // MARK: 查询

    func window(_ w: StatsWindow) -> WindowStats {
        if let c = windowCache[w] { return c }
        let (lo, hi) = range(w)
        var s = WindowStats()
        for (d, a) in perDay where d >= lo && d <= hi {
            s.sec += a.sec; s.chars += a.chars
            if a.sec > 0 { s.days += 1 }
        }
        var bookMarks: [String: Int] = [:]
        for m in marks where m.day >= lo && m.day <= hi {
            s.marks += 1
            if m.note { s.notes += 1 }
            bookMarks[books[m.book] == nil ? "_other" : m.book, default: 0] += 1
        }
        var rows: [String: WindowStats.BookRow] = [:]
        for (b, days) in perBookDay {
            var r = WindowStats.BookRow(id: b, sec: 0, chars: 0, marks: 0)
            for (d, a) in days where d >= lo && d <= hi { r.sec += a.sec; r.chars += a.chars }
            if r.sec > 0 || r.chars > 0 { rows[b] = r }
        }
        for (b, n) in bookMarks { rows[b, default: .init(id: b, sec: 0, chars: 0, marks: 0)].marks = n }
        s.books = rows.values.sorted { ($0.id == "_other" ? 1 : 0, -$0.sec, $0.id) < ($1.id == "_other" ? 1 : 0, -$1.sec, $1.id) }
        windowCache[w] = s
        return s
    }

    /// 某一章累计秒数。
    func sec(_ src: Src) -> Int { secBySrc[src] ?? 0 }
    func learned(_ src: Src) -> Bool { sec(src) >= Self.learnedSec }

    /// 一本书学过了几章。
    func learnedCount(_ book: String) -> Int {
        guard let b = books[book] else { return 0 }
        return b.srcNo.keys.reduce(0) { $0 + (learned($1) ? 1 : 0) }
    }

    /// 某章原文字数(书内序号 1 起)。
    func chapterChars(_ book: String, _ no: Int) -> Int { books[book]?.chapterChars[safe: no - 1] ?? 0 }

    /// 这本书最近一次读的日子(日聚合里)。
    func lastDay(_ book: String) -> String? { perBookDay[book]?.filter { $0.value.sec > 0 }.keys.max() }

    // MARK: 每周

    var goalSec: Int { DeskSettings.shared.deskGoal * 60 }

    func weekSec(monday: Date) -> Int {
        (0..<7).reduce(0) { $0 + (perDay[Self.dayString(Self.add($1, to: monday))]?.sec ?? 0) }
    }

    var thisWeekSec: Int { weekSec(monday: Self.monday(of: Date())) }

    /// 本周周一到周日哪几天学过(下标 0 = 周一)。
    var thisWeekDays: [Bool] {
        let m = Self.monday(of: Date())
        return (0..<7).map { (perDay[Self.dayString(Self.add($0, to: m))]?.sec ?? 0) > 0 }
    }

    /// 某一周(周一)要达到的秒数:按那一周生效的目标(DeskSettings 的本机改动史),不按现在的目标。
    func goalSec(monday: Date) -> Int { DeskSettings.shared.goal(weekEnding: Self.dayString(Self.add(6, to: monday))) * 60 }

    /// 连续达成的周数:从上周往回数,连续达标(每周按当周的目标判);本周已达标也算上。
    var streakWeeks: Int {
        guard goalSec > 0 else { return 0 }
        let first = perDay.keys.min().flatMap(Self.date) ?? Date()
        var m = Self.add(-7, to: Self.monday(of: Date()))
        var n = 0
        while m >= Self.monday(of: first), weekSec(monday: m) >= max(goalSec(monday: m), 60) { n += 1; m = Self.add(-7, to: m) }
        if thisWeekSec >= goalSec { n += 1 }
        return n
    }

    /// 总学习天数(有时长的天)。
    var totalDays: Int { perDay.values.filter { $0.sec > 0 }.count }

    // MARK: 热力图

    /// 近一年:从 52 周前那个周一到本周日,一列一周(周一在上)。值是当天秒数,未来的日子为 -1。
    func heat(now: Date = Date()) -> [[Int]] {
        let today = Self.dayString(now)
        let start = Self.add(-52 * 7, to: Self.monday(of: now))
        return (0..<53).map { w in
            (0..<7).map { d in
                let s = Self.dayString(Self.add(w * 7 + d, to: start))
                return s > today ? -1 : (perDay[s]?.sec ?? 0)
            }
        }
    }
    func heatStart(now: Date = Date()) -> Date { Self.add(-52 * 7, to: Self.monday(of: now)) }

    // MARK: 学完

    /// 学完的书(书桌书目里的)与日期,新的在前。
    func finishedBooks() -> [(book: BookInfo, at: Date)] {
        let fin = FinishedStore.shared
        return Library.shared.allBooks.compactMap { b -> (BookInfo, Date)? in
            guard let p = Library.shared.pack(b), fin.isFinished(p) else { return nil }
            let at = FinishedStore.keys(p).compactMap { fin.recs[$0]?.at }.max() ?? Date()
            return (b, at)
        }
        .sorted { $0.1 > $1.1 }
    }

    func finishStats(_ b: BookInfo) -> FinishStats {
        let days = perBookDay[b.id] ?? [:]
        let lived = days.filter { $0.value.sec > 0 }
        let ms = marks.filter { $0.book == b.id }
        var to: Date? = nil
        if let p = Library.shared.pack(b) { to = FinishedStore.keys(p).compactMap { FinishedStore.shared.recs[$0]?.at }.max() }
        return FinishStats(days: lived.count, sec: days.values.reduce(0) { $0 + $1.sec }, chars: days.values.reduce(0) { $0 + $1.chars },
                           marks: ms.count, notes: ms.filter(\.note).count,
                           from: lived.keys.min().flatMap(Self.date), to: to ?? lived.keys.max().flatMap(Self.date))
    }
}

/// 时长与字数的写法。
enum Fmt {
    /// 不足 1 小时「42 分」,以上「3 小时 20 分」(整点「3 小时」)。不足 1 分钟按 1 分(有时长时)。
    static func dur(_ sec: Int) -> String {
        let m = sec <= 0 ? 0 : max(1, Int((Double(sec) / 60).rounded()))
        if m < 60 { return "\(m) 分" }
        let h = m / 60, r = m % 60
        return r == 0 ? "\(h) 小时" : "\(h) 小时 \(r) 分"
    }
    /// 数字与单位分开(大数字排版用):("3", "小时", "20", "分")。
    static func durParts(_ sec: Int) -> [(String, String)] {
        let m = sec <= 0 ? 0 : max(1, Int((Double(sec) / 60).rounded()))
        if m < 60 { return [("\(m)", "分")] }
        let h = m / 60, r = m % 60
        return r == 0 ? [("\(h)", "小时")] : [("\(h)", "小时"), ("\(r)", "分")]
    }
    /// 过万写「1.2 万」。
    static func chars(_ n: Int) -> (String, String) {
        if n >= 10000 {
            let v = Double(n) / 10000
            let s = v >= 100 ? String(Int(v.rounded())) : String(format: "%.1f", v).replacingOccurrences(of: ".0", with: "")
            return (s, "万字")
        }
        return ("\(n)", "字")
    }
    static func charsText(_ n: Int) -> String { let p = chars(n); return p.0 + " " + p.1 }
    static func md(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return "\(c.month ?? 0) 月 \(c.day ?? 0) 日"
    }
    static func ymd(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return "\(c.year ?? 0) 年 \(c.month ?? 0) 月 \(c.day ?? 0) 日"
    }
}
