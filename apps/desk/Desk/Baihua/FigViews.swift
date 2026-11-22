import SwiftUI

/// 图解排版要用到的:这本书的两个主色、题头插画(金句卡做底)、可用宽度。
struct FigContext {
    var accent: Color
    var accent2: Color
    var book: BookInfo?
    var chapter: Int
    var width: CGFloat
    /// 宽版:并排放得下(iPad、手机横放的大屏)。
    var wide: Bool { width >= 540 }
}

/// 一个图解块:有结构化数据就排成卡片,图注在卡片下;没有数据只留图注(不画空框)。
struct FigBlockView: View {
    let cap: String
    let fig: Fig?
    let ctx: FigContext

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let fig {
                FigCard(fig: fig, ctx: ctx)
                if !cap.isEmpty {
                    Text(cap).font(.system(size: 13)).lineSpacing(4).foregroundStyle(Ink.faint)
                        .padding(.horizontal, 6)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else if !cap.isEmpty {
                // 还没转好的图:只留一句图注,安静地放着
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Image(systemName: "square.on.square.dashed").font(.system(size: 11, weight: .semibold)).foregroundStyle(ctx.accent.opacity(0.55))
                    Text(cap).font(.system(size: 13)).lineSpacing(4).foregroundStyle(Ink.faint)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 4)
            }
        }
        .modifier(FigAppear())
    }
}

/// 滚进视野时轻轻浮上来(开了「减弱动态效果」就直接显示)。
struct FigAppear: ViewModifier {
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    func body(content: Content) -> some View {
        content
            .opacity(shown || reduce ? 1 : 0)
            .offset(y: shown || reduce ? 0 : 16)
            .onAppear { if !shown { withAnimation(.easeOut(duration: 0.5).delay(0.05)) { shown = true } } }
    }
}

/// 卡片外壳:图题在上、正文、底下的总结行。金句卡自己一套。
struct FigCard: View {
    let fig: Fig
    let ctx: FigContext

    var body: some View {
        if fig.kind == .quote {
            FigQuoteCard(fig: fig, ctx: ctx)
        } else {
            VStack(alignment: .leading, spacing: 16) {
                if let t = fig.title {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        RoundedRectangle(cornerRadius: 1.5).fill(ctx.accent).frame(width: 3, height: 15).offset(y: 2)
                        Text(t).font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true)
                    }
                }
                content
                if !fig.foot.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(fig.foot.enumerated()), id: \.offset) { _, f in
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("◆").font(.system(size: 8)).foregroundStyle(ctx.accent2)
                                Text(f).font(.system(size: 14, weight: .medium)).lineSpacing(3).foregroundStyle(Ink.soft).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(.top, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { DashedRule().stroke(Ink.line, style: StrokeStyle(lineWidth: 1, dash: [3, 4])).frame(height: 1) }
                }
            }
            .padding(.horizontal, ctx.wide ? 24 : 16).padding(.vertical, ctx.wide ? 22 : 18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 18)
                    .fill(Ink.card)
                    .overlay(RoundedRectangle(cornerRadius: 18).fill(LinearGradient(colors: [ctx.accent.opacity(0.06), .clear], startPoint: .top, endPoint: .center)))
            )
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(ctx.accent.opacity(0.16), lineWidth: 1))
            .shadow(color: .black.opacity(0.04), radius: 10, y: 3)
        }
    }

    @ViewBuilder private var content: some View {
        switch fig.kind {
        case .quote: EmptyView()
        case .cols: FigCols(cols: fig.cols, ctx: ctx)
        case .rows: FigRows(items: fig.items, ctx: ctx)
        case .flow: FigFlow(steps: fig.items, result: fig.result, loop: fig.loop, ctx: ctx)
        case .tree: FigTree(root: fig.root, branches: fig.items, ctx: ctx)
        case .timeline: FigTimeline(points: fig.items, ctx: ctx)
        case .table: FigTable(heads: fig.heads, rows: fig.rows, ctx: ctx)
        case .gua: FigGuaView(guas: fig.guas, yao: fig.yao, ctx: ctx)
        case .ring: FigRing(center: fig.center, items: fig.items, ctx: ctx)
        case .notes: FigNotes(lines: fig.lines, ctx: ctx)
        }
    }
}

struct DashedRule: Shape {
    func path(in r: CGRect) -> Path { Path { p in p.move(to: CGPoint(x: 0, y: r.midY)); p.addLine(to: CGPoint(x: r.width, y: r.midY)) } }
}

/// 一条的字:小标题(朱色强调的用主色)+ 说明若干行。
struct FigItemText: View {
    let item: FigItem
    let ctx: FigContext
    var headSize: CGFloat = 15
    var center = false
    var headColor: Color? = nil
    var body: some View {
        VStack(alignment: center ? .center : .leading, spacing: 4) {
            if !item.head.isEmpty {
                Text(item.head).font(.system(size: headSize, weight: .semibold))
                    .foregroundStyle(headColor ?? (item.accent ? ctx.accent : Ink.text))
            }
            ForEach(Array(item.body.enumerated()), id: \.offset) { _, b in
                Text(b).font(.system(size: max(13, headSize - 1.5))).lineSpacing(3).foregroundStyle(Ink.soft)
            }
        }
        .multilineTextAlignment(center ? .center : .leading)
        .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: 金句卡

/// 本章题头插画做底、柔光压住,大字宋体排原句;释义与出处在下。
struct FigQuoteCard: View {
    let fig: Fig
    let ctx: FigContext
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let img = ctx.book.flatMap { ArtStore.shared.image($0, .head(ctx.chapter)) }
        VStack(spacing: 14) {
            Text("“").font(Fonts.song(44, bold: true)).foregroundStyle(ctx.accent.opacity(0.55)).frame(height: 26).offset(y: 6)
            if let t = fig.title { Text(t).font(.system(size: 12, weight: .semibold)).kerning(2).foregroundStyle(ctx.accent) }
            Text(fig.text)
                .font(Fonts.song(ctx.wide ? 30 : 25, bold: true)).lineSpacing(8).kerning(1)
                .foregroundStyle(Ink.text).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let g = fig.gloss {
                Text(g).font(.system(size: 15)).lineSpacing(4).foregroundStyle(Ink.soft).multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let s = fig.source {
                Text("—— " + s).font(Fonts.song(13)).foregroundStyle(ctx.accent).padding(.top, 2)
            }
            ForEach(Array(fig.foot.enumerated()), id: \.offset) { _, f in
                Text(f).font(.system(size: 13)).foregroundStyle(Ink.soft).multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, ctx.wide ? 48 : 26).padding(.top, 26).padding(.bottom, 34)
        .frame(maxWidth: .infinity, minHeight: ctx.wide ? 300 : 240)
        .background {
            ZStack {
                ctx.book?.theme.paperColor ?? Ink.paper
                if let img {
                    Image(uiImage: img).resizable().scaledToFill()
                        .opacity(scheme == .dark ? 0.5 : 0.85)
                        .blur(radius: 1)
                }
                // 柔光:四周淡、中间更淡,字压得住
                RadialGradient(colors: [(ctx.book?.theme.paperColor ?? Ink.paper).opacity(scheme == .dark ? 0.84 : 0.72), (ctx.book?.theme.paperColor ?? Ink.paper).opacity(scheme == .dark ? 0.55 : 0.32)],
                               center: .center, startRadius: 20, endRadius: 420)
                LinearGradient(colors: [ctx.accent.opacity(0.10), .clear, ctx.accent2.opacity(0.10)], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(ctx.accent.opacity(0.22), lineWidth: 1))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(ctx.accent.opacity(0.14), lineWidth: 0.8).padding(7))
        .shadow(color: .black.opacity(0.06), radius: 14, y: 5)
    }
}

// MARK: 并列 / 对比

struct FigCols: View {
    let cols: [FigCol]
    let ctx: FigContext
    var body: some View {
        let side = ctx.wide || (cols.count == 2 && ctx.width >= 420 && maxLen <= 14)
        if side {
            HStack(alignment: .top, spacing: 12) {
                ForEach(Array(cols.enumerated()), id: \.offset) { i, c in panel(c, i, stretch: true) }
            }
            .fixedSize(horizontal: false, vertical: true)
        } else {
            VStack(spacing: 10) {
                ForEach(Array(cols.enumerated()), id: \.offset) { i, c in
                    panel(c, i)
                    if cols.count == 2 && i == 0 {
                        Text("对 照").font(.system(size: 11, weight: .semibold)).kerning(2).foregroundStyle(Ink.faint)
                    }
                }
            }
        }
    }

    private var maxLen: Int { cols.flatMap { $0.lines.map { ($0.head + $0.body.joined()).count } }.max() ?? 0 }

    private func tint(_ i: Int) -> Color { i % 2 == 0 ? ctx.accent : ctx.accent2 }

    private func panel(_ c: FigCol, _ i: Int, stretch: Bool = false) -> some View {
        let t = tint(i)
        return VStack(alignment: .leading, spacing: 0) {
            Text(c.head)
                .font(Fonts.song(16, bold: true)).foregroundStyle(c.accent ? .white : t)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14).padding(.vertical, 11)
                .background(c.accent ? t : t.opacity(0.12))
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(c.lines.enumerated()), id: \.offset) { _, l in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Circle().fill(l.accent ? t : t.opacity(0.35)).frame(width: 5, height: 5).offset(y: -2)
                        FigItemText(item: l, ctx: ctx, headSize: 15, headColor: l.accent ? t : (l.body.isEmpty ? Ink.text : Ink.text))
                    }
                }
            }
            .padding(14)
        }
        .frame(maxWidth: .infinity, maxHeight: stretch ? .infinity : nil, alignment: .topLeading)   // 并排时各栏等高
        .background(t.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(t.opacity(0.28), lineWidth: 1))
    }
}

// MARK: 列举 / 层次

struct FigRows: View {
    let items: [FigItem]
    let ctx: FigContext
    /// 条条都标了朱色 = 没有哪条特别强调:不逐条加底。
    private var allHot: Bool { items.count > 1 && items.allSatisfy(\.accent) }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                HStack(alignment: .top, spacing: 12) {
                    if let m = it.mark, !m.isEmpty {
                        Text(m).font(Fonts.song(m.count > 2 ? 12 : 15, bold: true)).foregroundStyle(it.accent ? .white : ctx.accent)
                            .lineLimit(2).minimumScaleFactor(0.7)
                            .frame(minWidth: 30, minHeight: 30).padding(.horizontal, m.count > 2 ? 6 : 0)
                            .background(it.accent ? ctx.accent : ctx.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                    } else {
                        Circle().fill(it.accent ? ctx.accent : ctx.accent.opacity(0.4)).frame(width: 7, height: 7).padding(.top, 7).padding(.horizontal, 2)
                    }
                    FigItemText(item: it, ctx: ctx, headSize: 15.5).padding(.top, it.mark == nil ? 0 : 4)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 10).padding(.horizontal, it.accent && !allHot ? 10 : 0)
                .background(it.accent && !allHot ? ctx.accent.opacity(0.07) : .clear, in: RoundedRectangle(cornerRadius: 10))
                if i < items.count - 1 { Rectangle().fill(Ink.line).frame(height: 1).padding(.leading, it.mark == nil ? 20 : 42) }
            }
        }
    }
}

// MARK: 流程 / 推理链 / 循环

private struct FlowAnchors: PreferenceKey {
    static var defaultValue: [Int: Anchor<CGRect>] = [:]
    static func reduce(value: inout [Int: Anchor<CGRect>], nextValue: () -> [Int: Anchor<CGRect>]) { value.merge(nextValue()) { $1 } }
}

struct FigFlow: View {
    let steps: [FigItem]
    let result: FigItem?
    let loop: Bool
    let ctx: FigContext

    /// 宽版、步子少、字短:横着走;其余竖着走。
    private var horizontal: Bool {
        ctx.wide && !loop && steps.count <= 4 && steps.allSatisfy { $0.head.count <= 12 && $0.body.joined().count <= 26 }
    }

    var body: some View {
        if horizontal {
            VStack(spacing: 12) {
                HStack(alignment: .center, spacing: 6) {
                    ForEach(Array(steps.enumerated()), id: \.offset) { i, s in
                        node(s, i, fill: true).frame(maxWidth: .infinity)
                        if i < steps.count - 1 { Image(systemName: "arrow.right").font(.system(size: 13, weight: .bold)).foregroundStyle(ctx.accent.opacity(0.7)) }
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
                if let r = result {
                    Image(systemName: "arrow.down").font(.system(size: 14, weight: .bold)).foregroundStyle(ctx.accent)
                    resultNode(r)
                }
            }
        } else {
            VStack(spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.offset) { i, s in
                    node(s, i).frame(maxWidth: .infinity)
                        .anchorPreference(key: FlowAnchors.self, value: .bounds) { [i: $0] }
                    if i < steps.count - 1 || result != nil {
                        VStack(spacing: 0) {
                            Rectangle().fill(ctx.accent.opacity(0.35)).frame(width: 1.5, height: 10)
                            Image(systemName: i == steps.count - 1 ? "chevron.down.2" : "chevron.down").font(.system(size: 11, weight: .bold)).foregroundStyle(ctx.accent.opacity(0.75))
                        }
                        .frame(height: 26)
                    }
                }
                if let r = result { resultNode(r).padding(.top, 2) }
            }
            .padding(.trailing, loop ? 40 : 0)
            .overlayPreferenceValue(FlowAnchors.self) { anchors in
                if loop, steps.count > 1, let a = anchors[0], let b = anchors[steps.count - 1] {
                    GeometryReader { g in
                        let ra = g[a], rb = g[b]
                        let x = g.size.width - 12
                        Path { p in
                            p.move(to: CGPoint(x: rb.maxX + 2, y: rb.midY))
                            p.addLine(to: CGPoint(x: x - 10, y: rb.midY))
                            p.addQuadCurve(to: CGPoint(x: x, y: rb.midY - 10), control: CGPoint(x: x, y: rb.midY))
                            p.addLine(to: CGPoint(x: x, y: ra.midY + 10))
                            p.addQuadCurve(to: CGPoint(x: x - 10, y: ra.midY), control: CGPoint(x: x, y: ra.midY))
                            p.addLine(to: CGPoint(x: ra.maxX + 8, y: ra.midY))
                        }
                        .stroke(ctx.accent2, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, dash: [5, 4]))
                        Path { p in   // 箭头指回第一步
                            p.move(to: CGPoint(x: ra.maxX + 9, y: ra.midY - 5)); p.addLine(to: CGPoint(x: ra.maxX + 2, y: ra.midY)); p.addLine(to: CGPoint(x: ra.maxX + 9, y: ra.midY + 5))
                        }
                        .stroke(ctx.accent2, style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
                        Image(systemName: "arrow.triangle.2.circlepath").font(.system(size: 12, weight: .bold)).foregroundStyle(ctx.accent2)
                            .frame(width: 24, height: 24).background(Ink.card, in: Circle()).overlay(Circle().stroke(ctx.accent2.opacity(0.5), lineWidth: 1))
                            .position(x: x, y: (ra.midY + rb.midY) / 2)
                    }
                }
            }
        }
    }

    /// 小标题自带序号(①、1.)的:序号挪进圆标,字里不再重复一遍。
    private func split(_ s: FigItem, _ i: Int) -> (mark: String, item: FigItem) {
        if let m = s.mark, !m.isEmpty { return (m, s) }
        let circled = Array("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳")
        if let f = s.head.first, let k = circled.firstIndex(of: f) {
            var t = s; t.head = String(s.head.dropFirst()).trimmingCharacters(in: .whitespaces); return ("\(k + 1)", t)
        }
        return ("\(i + 1)", s)
    }

    private func node(_ raw: FigItem, _ i: Int, fill: Bool = false) -> some View {
        let (mark, s) = split(raw, i)
        return HStack(alignment: .top, spacing: 10) {
            Text(mark).font(Fonts.num(12, weight: .bold)).foregroundStyle(s.accent ? .white : ctx.accent)
                .frame(width: 22, height: 22).background(s.accent ? ctx.accent : ctx.accent.opacity(0.13), in: Circle())
            FigItemText(item: s, ctx: ctx, headSize: 15)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .frame(maxHeight: fill ? .infinity : nil, alignment: .top)   // 横排时各格等高
        .background(Ink.paper.opacity(0.6), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(s.accent ? ctx.accent : ctx.accent.opacity(0.25), lineWidth: s.accent ? 1.5 : 1))
    }

    private func resultNode(_ r: FigItem) -> some View {
        VStack(spacing: 4) {
            Text(r.head).font(Fonts.song(17, bold: true)).foregroundStyle(.white).multilineTextAlignment(.center)
            ForEach(Array(r.body.enumerated()), id: \.offset) { _, b in
                Text(b).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.88)).multilineTextAlignment(.center)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 18).padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .background(LinearGradient(colors: [ctx.accent, ctx.accent.opacity(0.82)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 14))
        .padding(.trailing, loop ? -40 : 0)
    }
}

// MARK: 结构树

struct FigTree: View {
    let root: FigItem?
    let branches: [FigItem]
    let ctx: FigContext

    var body: some View {
        if ctx.wide && branches.count <= 4 { wideTree } else { narrowTree }
    }

    private func rootBox(_ r: FigItem) -> some View {
        VStack(spacing: 4) {
            Text(r.head).font(Fonts.song(17, bold: true)).foregroundStyle(.white).multilineTextAlignment(.center)
            ForEach(Array(r.body.enumerated()), id: \.offset) { _, b in Text(b).font(.system(size: 13)).foregroundStyle(.white.opacity(0.88)).multilineTextAlignment(.center) }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(ctx.accent, in: RoundedRectangle(cornerRadius: 12))
    }

    private func branchBox(_ b: FigItem, center: Bool, stretch: Bool = false) -> some View {
        VStack(alignment: center ? .center : .leading, spacing: 8) {
            FigItemText(item: b, ctx: ctx, headSize: 15.5, center: center, headColor: b.accent ? ctx.accent : Ink.text)
            if !b.children.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(b.children.enumerated()), id: \.offset) { _, c in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("·").foregroundStyle(ctx.accent2)
                            FigItemText(item: c, ctx: ctx, headSize: 13.5)
                        }
                    }
                }
                .padding(.top, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { Rectangle().fill(Ink.line).frame(height: 1) }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: stretch ? .infinity : nil, alignment: center ? .top : .leading)
        .background(b.accent ? ctx.accent.opacity(0.08) : ctx.accent2.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(b.accent ? ctx.accent.opacity(0.6) : ctx.accent2.opacity(0.3), lineWidth: 1))
    }

    private var wideTree: some View {
        let n = branches.count
        let gap: CGFloat = 12
        return VStack(spacing: 0) {
            if let r = root {
                rootBox(r)
                Rectangle().fill(ctx.accent.opacity(0.5)).frame(width: 1.5, height: 16)
            }
            // 横梁 + 每支一根竖线
            GeometryReader { g in
                let cw = (g.size.width - gap * CGFloat(n - 1)) / CGFloat(n)
                Path { p in
                    let y: CGFloat = 0.75
                    if root != nil && n > 1 { p.move(to: CGPoint(x: cw / 2, y: y)); p.addLine(to: CGPoint(x: g.size.width - cw / 2, y: y)) }
                    for i in 0..<n { let x = CGFloat(i) * (cw + gap) + cw / 2; p.move(to: CGPoint(x: x, y: 0)); p.addLine(to: CGPoint(x: x, y: 14)) }
                }
                .stroke(ctx.accent.opacity(0.5), lineWidth: 1.5)
            }
            .frame(height: root == nil ? 0 : 14)
            .opacity(root == nil ? 0 : 1)
            HStack(alignment: .top, spacing: gap) {
                ForEach(Array(branches.enumerated()), id: \.offset) { _, b in branchBox(b, center: true, stretch: true) }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var narrowTree: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let r = root { rootBox(r).frame(maxWidth: .infinity, alignment: .leading) }
            ForEach(Array(branches.enumerated()), id: \.offset) { i, b in
                HStack(alignment: .top, spacing: 0) {
                    // 树枝:竖线到底(最后一支只到一半)+ 横出的一笔
                    ZStack(alignment: .topLeading) {
                        Rectangle().fill(ctx.accent.opacity(0.45)).frame(width: 1.5)
                            .frame(maxHeight: i == branches.count - 1 ? 30 : .infinity, alignment: .top)
                        Rectangle().fill(ctx.accent.opacity(0.45)).frame(width: 14, height: 1.5).offset(y: 29)
                    }
                    .frame(width: 22, alignment: .leading)
                    .padding(.leading, root == nil ? 0 : 16)
                    branchBox(b, center: false).padding(.top, 8)
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: 时间线

struct FigTimeline: View {
    let points: [FigItem]
    let ctx: FigContext
    var body: some View {
        let hasWhen = points.contains { !($0.when ?? "").isEmpty }
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(points.enumerated()), id: \.offset) { i, p in
                HStack(alignment: .top, spacing: 12) {
                    if hasWhen {
                        Text(p.when ?? "").font(Fonts.song(13, bold: true)).foregroundStyle(p.accent ? ctx.accent : ctx.accent.opacity(0.85))
                            .multilineTextAlignment(.trailing)
                            .frame(width: ctx.wide ? 92 : 64, alignment: .trailing)
                            .padding(.top, 2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    // 轨道:点 + 上下的线
                    ZStack(alignment: .top) {
                        VStack(spacing: 0) {
                            Rectangle().fill(i == 0 ? .clear : ctx.accent.opacity(0.3)).frame(width: 2, height: 8)
                            Rectangle().fill(i == points.count - 1 ? .clear : ctx.accent.opacity(0.3)).frame(width: 2)
                        }
                        Circle().fill(p.accent ? ctx.accent : Ink.card).frame(width: p.accent ? 13 : 11, height: p.accent ? 13 : 11)
                            .overlay(Circle().stroke(ctx.accent, lineWidth: 2))
                            .padding(.top, p.accent ? 3 : 4)
                    }
                    .frame(width: 14)
                    FigItemText(item: p, ctx: ctx, headSize: 15)
                        .padding(.bottom, 18)
                    Spacer(minLength: 0)
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: 表格

struct FigTable: View {
    let heads: [String]
    let rows: [[String]]
    let ctx: FigContext
    var body: some View {
        let n = max(heads.count, rows.map(\.count).max() ?? 0)
        let grid = Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
            if !heads.isEmpty {
                GridRow {
                    ForEach(0..<n, id: \.self) { j in
                        cell(heads[safe: j] ?? "", font: .system(size: 13.5, weight: .semibold), color: ctx.accent)
                    }
                }
                .background(ctx.accent.opacity(0.11))
            }
            ForEach(Array(rows.enumerated()), id: \.offset) { i, r in
                GridRow {
                    ForEach(0..<n, id: \.self) { j in
                        cell(r[safe: j] ?? "", font: j == 0 ? Fonts.song(15, bold: true) : .system(size: 14.5), color: j == 0 ? Ink.text : Ink.soft)
                    }
                }
                .background(i % 2 == 1 ? ctx.accent.opacity(0.035) : .clear)
                .overlay(alignment: .top) { if i > 0 || !heads.isEmpty { Rectangle().fill(Ink.line).frame(height: 1) } }
            }
        }
        // 放得下就铺满;放不下(窄屏、列多)才横着滑
        ViewThatFits(in: .horizontal) {
            grid
            ScrollView(.horizontal, showsIndicators: false) { grid.fixedSize() }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ctx.accent.opacity(0.22), lineWidth: 1))
    }

    private func cell(_ s: String, font: Font, color: Color) -> some View {
        Text(s).font(font).foregroundStyle(color).lineSpacing(2)
            .padding(.horizontal, 12).padding(.vertical, 9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: 卦画

/// 卦画(或单独一爻):画成模板图,颜色由外面给。
struct GuaGlyph: View {
    let binary: String
    var width: CGFloat = 56
    var lineHeight: CGFloat = 7
    var body: some View {
        let n = max(binary.count, 1)
        let h = lineHeight * CGFloat(n * 2 - 1)
        Image(uiImage: Hexagram.image(binary: binary, size: CGSize(width: width, height: h), color: .black).withRenderingMode(.alwaysTemplate))
            .resizable().frame(width: width, height: h)
    }
}

struct FigGuaView: View {
    let guas: [FigGua]
    let yao: [FigItem]
    let ctx: FigContext

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // 只画一个六画卦、逐爻有标注:大卦画,每一爻旁边写爻题与字(上爻在前)
            if let g = guas.first, guas.count <= 1, yao.count == 6, let bin = g.binary, bin.count == 6 {
                yaoView(g, Array(bin))
            } else {
                if !guas.isEmpty { guaRow }
                if !yao.isEmpty { FigRows(items: yao.map { FigItem(head: $0.head, body: $0.body, mark: nil, accent: $0.accent) }, ctx: ctx) }
            }
        }
    }

    private func yaoView(_ g: FigGua, _ bits: [Character]) -> some View {
        let lineW: CGFloat = ctx.wide ? 150 : 92
        // 六爻全标朱色(原图整幅都是朱字)等于没有强调:线照样上主色,不再逐行加底
        let all = yao.allSatisfy(\.accent)
        // 爻题短(「上九」)放左边一栏;长的(「上六——收尾·过头」)与字排在一起
        let shortLabels = yao.allSatisfy { $0.head.count <= 3 }
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(0..<6, id: \.self) { i in
                let y = yao[i]
                let hot = y.accent && !all
                HStack(alignment: .center, spacing: 14) {
                    if shortLabels {
                        Text(y.head).font(Fonts.song(15, bold: true)).foregroundStyle(y.accent ? ctx.accent : Ink.soft)
                            .frame(width: 44, alignment: .trailing)
                    }
                    GuaGlyph(binary: String(bits[5 - i]), width: lineW, lineHeight: ctx.wide ? 15 : 12)
                        .foregroundStyle(y.accent ? ctx.accent : Ink.text.opacity(0.82))
                        .shadow(color: hot ? ctx.accent.opacity(0.35) : .clear, radius: 6)
                    VStack(alignment: .leading, spacing: 2) {
                        if !shortLabels {
                            Text(y.head).font(Fonts.song(14.5, bold: true)).foregroundStyle(y.accent ? ctx.accent : Ink.text)
                        }
                        ForEach(Array(y.body.enumerated()), id: \.offset) { _, b in
                            Text(b).font(.system(size: 14.5, weight: hot ? .semibold : .regular)).foregroundStyle(hot ? ctx.accent : Ink.text)
                        }
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 8).padding(.horizontal, 6)
                .background(hot ? ctx.accent.opacity(0.08) : .clear, in: RoundedRectangle(cornerRadius: 10))
            }
            if g.head != nil || !g.lines.isEmpty {
                FigItemText(item: FigItem(head: g.head ?? "", body: g.lines), ctx: ctx).padding(.top, 10)
            }
        }
    }

    @ViewBuilder private var guaRow: some View {
        let detailed = guas.contains { $0.head != nil || !$0.lines.isEmpty }
        if ctx.wide || !detailed {
            HStack(alignment: .top, spacing: 12) {
                ForEach(Array(guas.enumerated()), id: \.offset) { _, g in tile(g, vertical: true).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top) }
            }
            .fixedSize(horizontal: false, vertical: true)
        } else {
            VStack(spacing: 10) { ForEach(Array(guas.enumerated()), id: \.offset) { _, g in tile(g, vertical: false) } }
        }
    }

    private func tile(_ g: FigGua, vertical: Bool) -> some View {
        let glyph = VStack(spacing: 8) {
            if let b = g.binary {
                GuaGlyph(binary: b, width: g.form == "tri" ? 50 : 56, lineHeight: g.form == "tri" ? 8 : 6)
                    .foregroundStyle(g.accent ? ctx.accent : Ink.text.opacity(0.85))
            }
            Text(g.name).font(Fonts.song(17, bold: true)).foregroundStyle(g.accent ? ctx.accent : Ink.text)
        }
        let words = VStack(alignment: vertical ? .center : .leading, spacing: 4) {
            if let h = g.head { Text(h).font(.system(size: 14, weight: .semibold)).foregroundStyle(ctx.accent) }
            ForEach(Array(g.lines.enumerated()), id: \.offset) { _, l in Text(l).font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(Ink.soft) }
        }
        .multilineTextAlignment(vertical ? .center : .leading)
        .fixedSize(horizontal: false, vertical: true)
        return Group {
            if vertical { VStack(spacing: 10) { glyph; words } }
            else { HStack(alignment: .center, spacing: 16) { glyph.frame(width: 64); words; Spacer(minLength: 0) } }
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(g.accent ? ctx.accent.opacity(0.08) : ctx.accent.opacity(0.03), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ctx.accent.opacity(g.accent ? 0.5 : 0.18), lineWidth: 1))
    }
}

// MARK: 方位 / 环

struct FigRing: View {
    let center: String?
    let items: [FigItem]
    let ctx: FigContext

    /// 古图上南下北、左东右西:正上方是南,顺时针依次西南、西、西北、北、东北、东、东南。
    static let order = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]
    static let names = ["S": "南", "SW": "西南", "W": "西", "NW": "西北", "N": "北", "NE": "东北", "E": "东", "SE": "东南"]

    private var sorted: [FigItem] {
        let placed = items.filter { Self.order.contains($0.at ?? "") }.sorted { Self.order.firstIndex(of: $0.at!)! < Self.order.firstIndex(of: $1.at!)! }
        return placed + items.filter { !Self.order.contains($0.at ?? "") }
    }

    var body: some View {
        if ctx.width >= 460 && items.allSatisfy({ Self.order.contains($0.at ?? "") }) { ring } else { list }
    }

    private var ring: some View {
        let side = min(ctx.width - 40, 520)
        let r = side / 2 - 58
        return ZStack {
            Circle().stroke(ctx.accent.opacity(0.25), lineWidth: 1.5).frame(width: r * 2, height: r * 2)
            Circle().stroke(ctx.accent.opacity(0.12), style: StrokeStyle(lineWidth: 1, dash: [3, 5])).frame(width: r * 1.2, height: r * 1.2)
            ForEach(0..<8, id: \.self) { k in
                let a = Angle.degrees(-90 + Double(k) * 45).radians
                Path { p in
                    p.move(to: CGPoint(x: side / 2 + cos(a) * r * 0.6, y: side / 2 + sin(a) * r * 0.6))
                    p.addLine(to: CGPoint(x: side / 2 + cos(a) * r, y: side / 2 + sin(a) * r))
                }
                .stroke(ctx.accent.opacity(0.15), lineWidth: 1)
            }
            if let c = center {
                Text(c).font(Fonts.song(15, bold: true)).foregroundStyle(ctx.accent).multilineTextAlignment(.center)
                    .frame(width: r * 1.05)
            }
            ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                let k = Self.order.firstIndex(of: it.at ?? "S") ?? 0
                let a = Angle.degrees(-90 + Double(k) * 45).radians
                node(it)
                    .position(x: side / 2 + cos(a) * r, y: side / 2 + sin(a) * r)
            }
        }
        .frame(width: side, height: side)
        .frame(maxWidth: .infinity)
    }

    private func node(_ it: FigItem) -> some View {
        VStack(spacing: 2) {
            Text(Self.names[it.at ?? ""] ?? "").font(.system(size: 10, weight: .semibold)).foregroundStyle(Ink.faint)
            Text(it.head).font(Fonts.song(17, bold: true)).foregroundStyle(it.accent ? .white : ctx.accent)
            ForEach(Array(it.body.enumerated()), id: \.offset) { _, b in
                Text(b).font(.system(size: 11.5)).foregroundStyle(it.accent ? .white.opacity(0.9) : Ink.soft).multilineTextAlignment(.center)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 8).padding(.vertical, 6)
        .frame(width: 98)
        .background(it.accent ? ctx.accent : Ink.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ctx.accent.opacity(0.35), lineWidth: 1))
    }

    private var list: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let c = center {
                Text(c).font(Fonts.song(15, bold: true)).foregroundStyle(ctx.accent)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(ctx.accent.opacity(0.1), in: Capsule())
            }
            ForEach(Array(sorted.enumerated()), id: \.offset) { _, it in
                HStack(alignment: .top, spacing: 12) {
                    Text(Self.names[it.at ?? ""] ?? "·").font(.system(size: 12, weight: .bold)).foregroundStyle(it.accent ? .white : ctx.accent)
                        .frame(width: 40, height: 26)
                        .background(it.accent ? ctx.accent : ctx.accent.opacity(0.12), in: Capsule())
                    FigItemText(item: it, ctx: ctx, headSize: 15.5)
                    Spacer(minLength: 0)
                }
            }
        }
    }
}

// MARK: 兜底

struct FigNotes: View {
    let lines: [String]
    let ctx: FigContext
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, l in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Circle().fill(ctx.accent.opacity(0.5)).frame(width: 5, height: 5).offset(y: -2)
                    Text(l).font(.system(size: 15)).lineSpacing(3).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}
