import SwiftUI

/// 学完:整屏庆祝。题图铺开 → 书名落定 → 盖印 → 账单逐项数上来。
struct FinishScreen: View {
    let book: BookInfo
    let stats: FinishStats
    /// 已学完的书再看一遍账单(不是刚点的「学完」)。
    var replay = false
    /// 「回到书桌」:从阅读器来时连阅读器一起收起;没给就只收起本页。
    var onDone: (() -> Void)? = nil
    @State private var burst: Date?
    @Environment(\.dismiss) private var dismiss
    @State private var stage = 0
    @Environment(\.horizontalSizeClass) private var hSize
    private var pad: Bool { hSize == .regular }
    private var k: CGFloat { pad ? 1.45 : 1 }

    var body: some View {
        ZStack {
            book.theme.paperColor.ignoresSafeArea()
            GeometryReader { geo in
                BookArt(book: book, kind: .banner)
                    .frame(width: geo.size.width, height: geo.size.height * (pad ? 0.56 : 0.48))
                    .clipped()
                    .mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .top, endPoint: .bottom))
                    .scaleEffect(stage >= 1 ? 1 : 1.12, anchor: .top)
                    .opacity(stage >= 1 ? 1 : 0)
            }
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer().frame(minHeight: pad ? 260 : 150)
                ZStack(alignment: .topTrailing) {
                    VStack(spacing: 10 * k) {
                        Text("学完了").font(.system(size: 14 * k, weight: .semibold)).kerning(6).foregroundStyle(book.theme.accentColor)
                        Text(book.title).font(Fonts.song(pad ? 68 : 46, bold: true)).foregroundStyle(Ink.text)
                        Text("\(book.sizeLabel) · \(book.chars) 字").font(.system(size: 14 * k)).foregroundStyle(Ink.soft)
                    }
                    .padding(.horizontal, pad ? 110 : 54)
                    .opacity(stage >= 2 ? 1 : 0)
                    .offset(y: stage >= 2 ? 0 : 14)

                    Seal(text: "学完")
                        .frame(width: pad ? 96 : 66, height: pad ? 96 : 66)
                        .background { if let t = burst { InkBurst(start: t, accent: book.theme.accentColor).frame(width: pad ? 520 : 360, height: pad ? 520 : 360).allowsHitTesting(false) } }
                        .rotationEffect(.degrees(-9))
                        .scaleEffect(stage >= 3 ? 1 : 2.4)
                        .opacity(stage >= 3 ? 1 : 0)
                        .offset(x: pad ? 6 : 12, y: pad ? -26 : -18)
                }

                VStack(spacing: 14 * k) {
                    HStack(alignment: .top, spacing: 0) {
                        bill([("\(stats.days)", "天")], "学了")
                        divider
                        bill(Fmt.durParts(stats.sec), "共读")
                        divider
                        bill([Fmt.chars(stats.chars)], "读过")
                        divider
                        bill([("\(stats.marks)", "处")], stats.notes > 0 ? "划线 · 批注 \(stats.notes)" : "划线")
                    }
                    if let line = spanLine {
                        Text(line).font(Fonts.song(15 * k)).foregroundStyle(Ink.soft)
                    }
                }
                .padding(.vertical, 22 * k).padding(.horizontal, 8)
                .background(Ink.card, in: RoundedRectangle(cornerRadius: 22 * k))
                .shadow(color: .black.opacity(0.06), radius: 18, y: 8)
                .padding(.horizontal, 24)
                .padding(.top, 36 * k)
                .opacity(stage >= 4 ? 1 : 0)
                .offset(y: stage >= 4 ? 0 : 20)

                if stats.sample {
                    Text("示例数字(这本书还没有学习记录)").font(.system(size: 11 * k)).foregroundStyle(Ink.faint).padding(.top, 8).opacity(stage >= 4 ? 1 : 0)
                }

                Spacer(minLength: 28)
                Button { if let onDone { onDone() } else { dismiss() } } label: {
                    Text(replay ? "收起账单" : "回到书桌").font(Fonts.song(18 * k, bold: true)).frame(maxWidth: pad ? 420 : 360).padding(.vertical, 16 * k)
                        .background(book.theme.accentColor, in: RoundedRectangle(cornerRadius: 16 * k)).foregroundStyle(.white)
                }
                .padding(.horizontal, 24).padding(.bottom, 28)
                .opacity(stage >= 4 ? 1 : 0)
            }
            .frame(maxWidth: pad ? 640 : 560)
        }
        .task {
            withAnimation(.easeOut(duration: 0.9)) { stage = 1 }
            try? await Task.sleep(for: .milliseconds(500))
            withAnimation(.spring(duration: 0.6)) { stage = 2 }
            try? await Task.sleep(for: .milliseconds(550))
            withAnimation(.spring(duration: 0.35, bounce: 0.45)) { stage = 3 }
            try? await Task.sleep(for: .milliseconds(120))   // 印落到纸上那一下,墨晕散开
            burst = Date()
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            try? await Task.sleep(for: .milliseconds(140))
            UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.7)
            try? await Task.sleep(for: .milliseconds(400))
            withAnimation(.spring(duration: 0.6)) { stage = 4 }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    /// 「从 3 月 2 日到 4 月 18 日」;同一天就「4 月 18 日这一天」。跨年带年份。
    private var spanLine: String? {
        guard let a = stats.from else { return nil }
        let b = stats.to ?? Date()
        let c = Calendar.current
        if c.isDate(a, inSameDayAs: b) { return "\(Fmt.md(b))这一天" }
        let cross = c.component(.year, from: a) != c.component(.year, from: b)
        return cross ? "从 \(Fmt.ymd(a))到 \(Fmt.ymd(b))" : "从 \(Fmt.md(a))到 \(Fmt.md(b))"
    }

    private var divider: some View { Rectangle().fill(Ink.line).frame(width: 1, height: 40 * k).padding(.top, 4) }

    private func bill(_ parts: [(String, String)], _ label: String) -> some View {
        VStack(spacing: 4 * k) {
            HStack(alignment: .firstTextBaseline, spacing: 1) {
                ForEach(Array(parts.enumerated()), id: \.offset) { _, p in
                    Text(p.0).font(Fonts.num(pad ? 34 : (parts.count > 1 ? 20 : 24))).foregroundStyle(Ink.text)
                    Text(p.1).font(.system(size: (parts.count > 1 ? 10 : 12) * k, weight: .medium)).foregroundStyle(Ink.soft)
                }
            }
            .lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.system(size: 12 * k)).foregroundStyle(Ink.soft).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 4)
    }
}

/// 印落下时的一圈墨晕 + 一撮金粉:2 秒内散尽。纯 Canvas,随 TimelineView 逐帧画,不占布局。
struct InkBurst: View {
    let start: Date
    let accent: Color
    private static let n = 30
    #if DEBUG
    /// DESK_BURST_HOLD=0.6:定格在第 0.6 秒(出图看粒子用)。
    static let hold: Double? = ProcessInfo.processInfo.environment["DESK_BURST_HOLD"].flatMap(Double.init)
    #else
    static let hold: Double? = nil
    #endif
    /// 每粒的方向、速度、大小、颜色下标:固定伪随机,每次一样。
    private static let seeds: [(a: Double, v: Double, r: Double, c: Int, d: Double)] = (0..<n).map { i in
        let x = Double((i * 7919 + 13) % 997) / 997, y = Double((i * 104729 + 7) % 991) / 991
        return (a: Double(i) / Double(n) * 2 * .pi + x * 0.5, v: 0.55 + y * 0.45, r: 1.6 + x * 2.6, c: i % 3, d: y * 0.15)
    }
    var body: some View {
        TimelineView(.animation) { ctx in
            let t = Self.hold ?? ctx.date.timeIntervalSince(start)
            Canvas { g, size in
                guard t < 2.1 else { return }
                let c = CGPoint(x: size.width / 2, y: size.height / 2)
                let R = min(size.width, size.height) / 2
                // 墨晕:两道圈,先快后慢地洇开、变淡
                for (k, delay) in [(0, 0.0), (1, 0.12)] {
                    let p = max(0, min(1, (t - delay) / 1.1))
                    guard p > 0 else { continue }
                    let e = 1 - pow(1 - p, 3)
                    let r = R * (0.2 + 0.55 * e) * (k == 0 ? 1 : 0.8)
                    let rect = CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)
                    g.stroke(Path(ellipseIn: rect), with: .color(Ink.cinnabar.opacity((1 - p) * (k == 0 ? 0.35 : 0.22))), lineWidth: (k == 0 ? 10 : 4) * (1 - p) + 1)
                    if k == 0 { g.fill(Path(ellipseIn: rect), with: .color(Ink.cinnabar.opacity((1 - p) * 0.06))) }
                }
                // 金粉:放射、减速、略往下坠,边走边淡
                let colors: [Color] = [Color(hex: "#D9A441"), accent, Ink.cinnabar]
                for s in Self.seeds {
                    let tt = t - s.d
                    guard tt > 0 else { continue }
                    let p = min(1, tt / 1.7)
                    let e = 1 - pow(1 - p, 2.4)
                    let dist = R * 0.92 * s.v * e
                    let x = c.x + cos(s.a) * dist
                    let y = c.y + sin(s.a) * dist + 26 * p * p
                    let r = s.r * (1 - 0.6 * p)
                    g.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(colors[s.c].opacity((1 - p) * 0.95)))
                }
            }
        }
    }
}

/// 一方朱印。字号、圆角随印的大小走(学完页大印、书卡角上的小印同一个)。
struct Seal: View {
    let text: String
    var body: some View {
        GeometryReader { g in
            let side = min(g.size.width, g.size.height)
            ZStack {
                RoundedRectangle(cornerRadius: side * 0.14).fill(Ink.cinnabar)
                RoundedRectangle(cornerRadius: side * 0.09).stroke(.white.opacity(0.75), lineWidth: max(0.8, side * 0.018)).padding(side * 0.06)
                VStack(spacing: -side * 0.03) {
                    ForEach(Array(text.enumerated()), id: \.offset) { _, c in Text(String(c)).font(Fonts.song(side / 3, bold: true)) }
                }
                .foregroundStyle(.white)
            }
            .frame(width: g.size.width, height: g.size.height)
        }
    }
}
