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
                ReaderScreen(model: ReaderModel(book: b, pack: p, start: ReadPos(ch: Int(env("DESK_CH", "8")) ?? 8, seg: 0, at: Date()), reveal: [0]))
            } else { DeskHome() }
        }
        .task {
            guard !demo.isEmpty else { return }
            await Library.shared.refresh()
            for id in ["daodejing", "lunyu", env("DESK_BOOK", "daodejing")] { if let b = Library.shared.book(id) { await Library.shared.add(b) } }
            ready = true
        }
    }
    #else
    var body: some View { DeskHome() }
    #endif
}
