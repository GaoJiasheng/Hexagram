import SwiftUI

@main
struct DeskApp: App {
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            Root()
                .tint(Ink.cinnabar)
                .environment(\.locale, Locale(identifier: "zh_CN"))
                .task {
                    // 启动:用存着的令牌认一下账号,再拉一次
                    await AccountStore.shared.bootstrap()
                    #if DEBUG
                    if let g = ProcessInfo.processInfo.environment["DESK_GOAL"], let m = Int(g) { DeskSettings.shared.setGoal(m) }
                    #endif
                    SyncEngine.shared.appActive()
                }
        }
        .onChange(of: phase) { _, p in
            switch p {
            case .active: SyncEngine.shared.appActive()
            case .background: SyncEngine.shared.appBackground()
            default: break
            }
        }
    }
}

/// 调试用(出样张):环境变量 DESK_DEMO=seed 自动把两本书放上书桌;=reader 直接进《道德经》第八章;=finish 直接看「学完」页。
private struct Root: View {
    #if DEBUG
    @State private var ready = false
    private let demo = ProcessInfo.processInfo.environment["DESK_DEMO"] ?? ""
    private func env(_ k: String, _ d: String) -> String { ProcessInfo.processInfo.environment[k] ?? d }
    var body: some View {
        Group {
            if demo.isEmpty { DeskHome() }
            else if !ready { Ink.paper.ignoresSafeArea() }
            else if demo == "finish", let b = Library.shared.book(env("DESK_BOOK", "daodejing")) {
                // 有真实记录用真实的;没有就用示例数字(页面上标「示例」)
                let st = Stats.shared.finishStats(b)
                FinishScreen(book: b, stats: st.sec > 0 ? st : .sample)
            }
            else if demo == "reader", let b = Library.shared.book(env("DESK_BOOK", "daodejing")), let p = Library.shared.pack(b) {
                ReaderScreen(model: ReaderModel(book: b, pack: p, start: ReadPos(ch: Int(env("DESK_CH", "8")) ?? 8, seg: Int(env("DESK_SEG", "0")) ?? 0, at: Date()), reveal: [0]))
            } else { DeskHome() }
        }
        .task {
            if env("DESK_STATS", "") == "1" { await StatsSeed.run() }
            guard !demo.isEmpty else { return }
            await Library.shared.refresh()
            for id in ["daodejing", "lunyu", env("DESK_BOOK", "daodejing")] { if let b = Library.shared.book(id) { await Library.shared.add(b) } }
            if env("DESK_HL", "") == "1" { seedHighlights() }
            ready = true
        }
    }

    /// DESK_HL=1:在 DESK_BOOK 第 DESK_CH 章造几条划线(四色各一、一条带批注、一条在译文上),固定 id,重复启动不累积。
    private func seedHighlights() {
        guard let b = Library.shared.book(env("DESK_BOOK", "daodejing")), let p = Library.shared.pack(b) else { return }
        let no = Int(env("DESK_CH", "8")) ?? 8
        guard p.chapters.indices.contains(no - 1) else { return }
        let c = p.chapters[no - 1]
        func make(_ k: Int, seg: Int, layer: String, _ a: Int, _ len: Int, color: Int, note: String? = nil) {
            guard let t = c.text(seg: seg, layer: layer), let s = t.chars(a, min(a + len, t.count)), !s.isEmpty else { return }
            HighlightStore.shared.upsertDemo(Highlight(id: "demo-\(b.id)-\(no)-\(k)", book: b.id, corpus: c.src.corpus, slug: c.src.slug, ch: c.src.ch, no: no,
                                                       layer: layer, seg: seg, start: a, end: a + s.count, text: s, color: color, note: note, at: Date()))
        }
        let last = c.segs.count - 1
        make(0, seg: 0, layer: "o", 5, 5, color: 0, note: "水的三样:利、不争、处下。下一句「故几于道」就落在这里。")
        make(1, seg: 0, layer: "t", 0, 8, color: 3)
        make(2, seg: last, layer: "o", 0, 3, color: 1)
        make(3, seg: last, layer: "o", 12, 3, color: 2)
        make(4, seg: last, layer: "o", 28, 4, color: 3, note: "不争,所以无过失。")
    }
    #else
    var body: some View { DeskHome() }
    #endif
}

#if DEBUG
/// DESK_STATS=1:造一批统计数据出图用——近 60 天的随机时长与字数(固定种子,每次一样)、几条划线、读完的孙子记学完。
/// 写进本机日聚合(设备号 de00…01,不标脏、不推云);重复启动是覆盖同一批键,不累积。
@MainActor
enum StatsSeed {
    static func run() async {
        let lib = Library.shared
        await lib.refresh()
        let ids = ["daodejing", "lunyu", "sunzi", "zhuangzi"]
        for id in ids { if let b = lib.book(id) { await lib.add(b) } }
        var rng: UInt64 = 0x9E3779B97F4A7C15
        func rand() -> Double { rng = rng &* 6364136223846793005 &+ 1442695040888963407; return Double(rng >> 11) / Double(1 << 53) }
        let dev = "de00000000000001"
        var map: [String: ReadDay] = [:]
        var ptr: [String: Int] = [:]
        var lastDay: [String: Date] = [:]
        let packs = ids.compactMap { id in lib.book(id).flatMap { b in lib.pack(b).map { (id, $0) } } }
        func add(_ id: String, _ p: BookPack, day: Date, sec: Int) {
            let no = ptr[id, default: 1]
            guard no <= p.chapters.count else { return }
            let c = p.chapters[no - 1]
            let chars = c.segs.reduce(0) { $0 + ReaderModel.charCount($1.o) }
            let k = "\(ReadDaysStore.day(day))|\(c.src.corpus)|\(c.src.slug)|\(c.src.ch)|\(dev)"
            var e = map[k] ?? ReadDay(at: day)
            e.sec += sec; e.n += 1; e.c = min(chars, e.c + Int(Double(chars) * min(1, Double(sec) / 300)))
            map[k] = e
            lastDay[id] = day
            if sec >= 180 || rand() < 0.3 { ptr[id] = no + 1 }
        }
        for back in stride(from: 59, through: 0, by: -1) {
            let day = Calendar.current.date(byAdding: .day, value: -back, to: Calendar.current.startOfDay(for: Date()))!.addingTimeInterval(20 * 3600)
            if back > 0 && rand() < 0.32 { continue }
            for (id, p) in packs {
                // 孙子在 50→12 天前读完;其余三本随手翻
                if id == "sunzi" { if back >= 12 && back <= 50 && rand() < 0.5 { add(id, p, day: day, sec: 300 + Int(rand() * 600)) } ; continue }
                if rand() < (id == "daodejing" ? 0.7 : 0.35) {
                    let n = 1 + Int(rand() * 2.5)
                    for _ in 0..<n { add(id, p, day: day, sec: rand() < 0.2 ? 60 + Int(rand() * 100) : 200 + Int(rand() * 1100)) }
                }
            }
        }
        ReadDaysStore.shared.seedDemo(map)
        for (id, p) in packs {
            let no = min(ptr[id, default: 1], p.chapters.count)
            if ProgressStore.shared.pos[id] == nil { ProgressStore.shared.set(id, ch: no, seg: 0) }
            if id == "sunzi", ptr[id, default: 1] > p.chapters.count, let d = lastDay[id] { FinishedStore.shared.seedDemo(p, at: d) }
            // 每本几条划线,散在不同的日子
            for j in 0..<(id == "daodejing" ? 5 : 2) {
                let c = p.chapters[min(j * 3, p.chapters.count - 1)]
                guard let t = c.segs.first?.o, let s = t.chars(0, min(4, t.count)) else { continue }
                let at = Date().addingTimeInterval(-Double(j * 6 + 1) * 86400)
                HighlightStore.shared.upsertDemo(Highlight(id: "seed-\(id)-\(j)", book: id, corpus: c.src.corpus, slug: c.src.slug, ch: c.src.ch, no: c.no,
                                                           layer: "o", seg: 0, start: 0, end: s.count, text: s, color: j % 4, note: j % 2 == 0 ? "种子批注" : nil, at: at))
            }
        }
        Stats.shared.recompute()
    }
}
#endif
