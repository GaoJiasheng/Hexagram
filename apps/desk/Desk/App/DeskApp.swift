import SwiftUI

@main
struct DeskApp: App {
    var body: some Scene {
        WindowGroup {
            Root()
                .tint(Ink.cinnabar)
                .environment(\.locale, Locale(identifier: "zh_CN"))
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
            else if demo == "finish", let b = Library.shared.book("daodejing") { FinishScreen(book: b, stats: .sample) }
            else if demo == "reader", let b = Library.shared.book(env("DESK_BOOK", "daodejing")), let p = Library.shared.pack(b) {
                ReaderScreen(model: ReaderModel(book: b, pack: p, start: ReadPos(ch: Int(env("DESK_CH", "8")) ?? 8, seg: Int(env("DESK_SEG", "0")) ?? 0, at: Date()), reveal: [0]))
            } else { DeskHome() }
        }
        .task {
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
