import Foundation

/// 学习时长时钟(口径同网站 readClock.js):阅读器在前台、且 60 秒内有过操作(翻页、点按、滚动)才计时;
/// 单次连续最多记 1800 秒;换章、退到后台、离开阅读器时结清(次数 +1)。中途每满 120 秒先存一笔,防闪退丢。
/// 写进 ReadDaysStore 的日聚合;字数另由阅读器按「一页显示满 3 秒」计入。
@MainActor
final class ReadClock {
    static let idle: TimeInterval = 60
    static let cap: Double = 1800
    static let tick: TimeInterval = 5
    static let partial: Double = 120
    static let minSec: Double = 5

    /// 正在走的那一个(退到后台推同步前先让它结清)。
    static weak var active: ReadClock?

    private struct Session {
        var src: Src
        var day: Date
        var sec: Double = 0
        var flushed: Double = 0
        var lastTick: Date
        var lastActivity: Date
    }
    private var s: Session?
    private var timer: Timer?
    /// 每拍(5 秒)走完之后调一次:阅读器据此判断这一章是不是刚满 3 分钟。
    var tickHandler: (() -> Void)?

    /// 正在计的这一章,和还没存进日聚合的秒数(已存的在 ReadDaysStore 里)。
    var src: Src? { s?.src }
    var unflushed: Int { s.map { Int(($0.sec - $0.flushed).rounded()) } ?? 0 }

    /// 开始(或换到)一章。同一章重复调用无事。
    func start(_ src: Src) {
        if let cur = s, cur.src == src { touch(); return }
        settle()
        let now = Date()
        s = Session(src: src, day: now, lastTick: now, lastActivity: now)
        Self.active = self
        if timer == nil {
            let t = Timer(timeInterval: Self.tick, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.onTick() } }
            RunLoop.main.add(t, forMode: .common)
            timer = t
        }
    }

    /// 有操作(翻页、点按、长按选字、开面板)。
    func touch() {
        guard s != nil else { return }
        advance(Date())
        s?.lastActivity = Date()
    }

    /// 结清这一段:记进日聚合,次数 +1。
    func settle() {
        guard var cur = s else { return }
        s = nil
        advance(&cur, Date())
        let delta = (cur.sec - cur.flushed).rounded()
        if delta >= Self.minSec || cur.flushed > 0 {
            ReadDaysStore.shared.addTime(cur.src, sec: Int(max(0, delta)), final: true, day: cur.day)
        }
    }

    /// 离开阅读器:结清并停表。
    func stop() {
        settle()
        timer?.invalidate(); timer = nil
        if Self.active === self { Self.active = nil }
    }

    var isRunning: Bool { s != nil }

    /// 把还没存的秒数先存一笔(不结清、次数不加)。
    func flushNow() {
        advance(Date())
        guard var cur = s else { return }
        let delta = (cur.sec - cur.flushed).rounded()
        guard delta > 0 else { return }
        cur.flushed += delta
        s = cur
        ReadDaysStore.shared.addTime(cur.src, sec: Int(delta), final: false, day: cur.day)
    }

    private func onTick() {
        guard s != nil else { return }
        advance(Date())
        // 过了零点:结清昨天那一段,同一章另起今天的
        if let cur = s, ReadDaysStore.day(cur.day) != ReadDaysStore.day(Date()) { let src = cur.src; settle(); start(src); return }
        if var cur = s, cur.sec - cur.flushed >= Self.partial {
            let delta = (cur.sec - cur.flushed).rounded()
            cur.flushed += delta
            s = cur
            ReadDaysStore.shared.addTime(cur.src, sec: Int(delta), final: false, day: cur.day)
        }
        tickHandler?()
    }

    private func advance(_ now: Date) {
        guard var cur = s else { return }
        advance(&cur, now)
        s = cur
    }

    private func advance(_ cur: inout Session, _ now: Date) {
        if now.timeIntervalSince(cur.lastActivity) <= Self.idle {
            cur.sec = min(Self.cap, cur.sec + max(0, now.timeIntervalSince(cur.lastTick)))
        }
        cur.lastTick = now
    }
}
