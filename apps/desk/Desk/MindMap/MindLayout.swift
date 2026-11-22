import UIKit
import SwiftUI

// 思想脑图的排版与画法(画布与导出图共用一套):
// · 字:每层一档字号与最宽行宽,长句折行;折成几行后再收窄到「行数不变的最窄宽度」,免得末行只剩一两个字。
// · 位置:从左往右的整齐树(tidy tree)。子树按「盒子轮廓」上下贴紧:后一棵兄弟子树往下挪到与前面所有盒子
//   (节点框 + 收放钮 + 连线扇面)都不相交为止——节点高低不一、展开到哪一层都不会叠。
// · 颜色:一级分支各一个色相(从这本书的主色出发、在色环上错开),越往深越淡。

/// 每层的样式。
struct MindStyle {
    var size: CGFloat
    var bold: Bool
    var maxText: CGFloat
    var padH: CGFloat
    var padV: CGFloat
    var radius: CGFloat
    var lineSpacing: CGFloat

    static func of(_ depth: Int) -> MindStyle {
        switch depth {
        case 0: return MindStyle(size: 21, bold: true, maxText: 230, padH: 18, padV: 13, radius: 14, lineSpacing: 3)
        case 1: return MindStyle(size: 16.5, bold: true, maxText: 210, padH: 14, padV: 10, radius: 11, lineSpacing: 3)
        case 2: return MindStyle(size: 15, bold: false, maxText: 228, padH: 12, padV: 8, radius: 9, lineSpacing: 2.5)
        default: return MindStyle(size: 14, bold: false, maxText: 240, padH: 10, padV: 7, radius: 7, lineSpacing: 2)
        }
    }

    /// 与父节点之间的横向距离(连线的长度)
    static func hgap(_ depth: Int) -> CGFloat { depth == 0 ? 64 : 46 }
    /// 兄弟子树之间最少隔开多少
    static func vgap(_ childDepth: Int) -> CGFloat { childDepth == 1 ? 24 : childDepth == 2 ? 13 : 9 }
    /// 有子项的节点右缘挂一个收放钮
    static let bubbleR: CGFloat = 10
    static let bubbleGap: CGFloat = 3
}

enum MindFonts {
    static func font(_ s: MindStyle) -> UIFont { Fonts.uiSong(s.size, bold: s.bold) }
    static func attributed(_ text: String, depth: Int, color: UIColor) -> NSAttributedString {
        let st = MindStyle.of(depth)
        let ps = NSMutableParagraphStyle()
        ps.lineSpacing = st.lineSpacing
        ps.lineBreakMode = .byWordWrapping
        ps.lineBreakStrategy = .standard
        return NSAttributedString(string: text, attributes: [.font: font(st), .foregroundColor: color, .paragraphStyle: ps, .kern: 0.2])
    }
}

/// 量好的字:每个节点一份(与展开与否无关,只量一次)。
struct MindMetrics {
    /// 字块大小(不含内边距)
    var text: [CGSize]
    /// 节点框大小(含内边距)
    var box: [CGSize]

    /// 量全部节点。CoreText/TextKit 的量字可以在后台线程做。
    static func measure(_ tree: MindTree) -> MindMetrics {
        var text: [CGSize] = [], box: [CGSize] = []
        text.reserveCapacity(tree.count); box.reserveCapacity(tree.count)
        for n in tree.nodes {
            let st = MindStyle.of(n.depth)
            let a = MindFonts.attributed(n.label, depth: n.depth, color: .black)
            func size(_ w: CGFloat) -> CGSize {
                let r = a.boundingRect(with: CGSize(width: w, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
                return CGSize(width: ceil(r.width), height: ceil(r.height))
            }
            var s = size(st.maxText)
            let one = st.size * 1.6
            if s.height > one {
                // 折了行:找行数不变的最窄宽度(二分),各行长短匀一些
                var lo = st.maxText * 0.5, hi = st.maxText
                for _ in 0..<7 {
                    let mid = (lo + hi) / 2
                    if size(mid).height <= s.height + 0.5 { hi = mid } else { lo = mid }
                }
                s = size(hi)
                s.width = min(s.width, hi)
            }
            text.append(s)
            box.append(CGSize(width: s.width + st.padH * 2, height: s.height + st.padV * 2))
        }
        return MindMetrics(text: text, box: box)
    }
}

/// 一次排版的结果(世界坐标:根节点框的左缘中点在原点)。
struct MindLayout {
    var frames: [Int: CGRect] = [:]
    /// 先序里看得见的节点
    var order: [Int] = []
    var bounds: CGRect = .zero

    func shifted(_ d: CGPoint) -> MindLayout {
        var o = self
        for (k, r) in frames { o.frames[k] = r.offsetBy(dx: d.x, dy: d.y) }
        o.bounds = bounds.offsetBy(dx: d.x, dy: d.y)
        return o
    }

    /// 排一遍。open:展开着的节点(根总是展开)。
    static func make(_ tree: MindTree, _ m: MindMetrics, open: Set<Int>) -> MindLayout {
        // 子树在自己的局部坐标里排:节点框左上角 x = 0;返回各节点的框与用来防叠的盒子
        struct Sub { var frames: [(Int, CGRect)]; var boxes: [CGRect] }
        func isOpen(_ i: Int) -> Bool { i == 0 || open.contains(i) }
        func place(_ i: Int) -> Sub {
            let n = tree[i]
            let size = m.box[i]
            let hasKids = !n.children.isEmpty
            let bubbleW = hasKids ? MindStyle.bubbleGap + MindStyle.bubbleR * 2 : 0
            guard hasKids, isOpen(i) else {
                let r = CGRect(origin: .zero, size: size)
                return Sub(frames: [(i, r)], boxes: [CGRect(x: 0, y: 0, width: size.width + bubbleW, height: size.height)])
            }
            let dx = size.width + bubbleW + MindStyle.hgap(n.depth)
            var frames: [(Int, CGRect)] = []
            var boxes: [CGRect] = []
            var centers: [CGFloat] = []
            let gap = MindStyle.vgap(n.depth + 1)
            for c in n.children {
                var s = place(c)
                // 往下挪到与前面的盒子都不相交
                var dy: CGFloat = -.greatestFiniteMagnitude
                if boxes.isEmpty { dy = 0 } else {
                    for b in s.boxes {
                        let bx0 = b.minX + dx, bx1 = b.maxX + dx
                        for a in boxes where a.maxX > bx0 + 0.5 && a.minX < bx1 - 0.5 {
                            dy = max(dy, a.maxY + gap - b.minY)
                        }
                    }
                    if dy == -.greatestFiniteMagnitude {
                        // 一个都不在同一竖条里(不会发生:兄弟同列),就接在上一个下面
                        dy = (boxes.map(\.maxY).max() ?? 0) + gap - (s.boxes.map(\.minY).min() ?? 0)
                    }
                }
                s.frames = s.frames.map { ($0.0, $0.1.offsetBy(dx: dx, dy: dy)) }
                s.boxes = s.boxes.map { $0.offsetBy(dx: dx, dy: dy) }
                centers.append(s.frames[0].1.midY)
                frames += s.frames
                boxes += s.boxes
            }
            let cy = ((centers.first ?? 0) + (centers.last ?? 0)) / 2
            let r = CGRect(x: 0, y: cy - size.height / 2, width: size.width, height: size.height)
            // 自己的框(连收放钮)+ 连线扇面
            boxes.append(CGRect(x: 0, y: r.minY, width: size.width + bubbleW, height: size.height))
            if let lo = centers.min(), let hi = centers.max() {
                boxes.append(CGRect(x: size.width, y: min(lo, r.midY) - 2, width: dx - size.width, height: max(hi, r.midY) - min(lo, r.midY) + 4))
            }
            return Sub(frames: [(i, r)] + frames, boxes: boxes)
        }
        let s = place(0)
        var out = MindLayout()
        let root = s.frames[0].1
        let d = CGPoint(x: -root.minX, y: -root.midY)
        var b = CGRect.null
        for (k, r) in s.frames {
            let rr = r.offsetBy(dx: d.x, dy: d.y)
            out.frames[k] = rr
            b = b.union(rr)
        }
        // 先序 = 编号顺序
        out.order = out.frames.keys.sorted()
        out.bounds = b.insetBy(dx: -(MindStyle.bubbleR * 2 + 8), dy: -16)
        return out
    }
}

/// 配色:按明暗分别取(画布在 traitCollection 变了时重取)。
struct MindPalette {
    var paper: UIColor
    var card: UIColor
    var ink: UIColor
    var soft: UIColor
    var faint: UIColor
    var accent: UIColor
    var accent2: UIColor
    var hues: [UIColor]
    var dark: Bool

    func hue(_ branch: Int) -> UIColor { branch < 0 ? accent : hues[branch % max(hues.count, 1)] }

    /// SwiftUI 用:随明暗自己换的分支色
    static func hueColor(_ theme: BookTheme, branches: Int, branch: Int) -> Color {
        let l = make(theme, branches: branches, dark: false).hue(branch), d = make(theme, branches: branches, dark: true).hue(branch)
        return Color(UIColor { $0.userInterfaceStyle == .dark ? d : l })
    }

    static func make(_ theme: BookTheme, branches: Int, dark: Bool) -> MindPalette {
        let t = UITraitCollection(userInterfaceStyle: dark ? .dark : .light)
        let base = UIColor(hex: theme.accent)
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        base.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        let n = max(branches, 1)
        // 一级分支各占色环上的一段;相邻两支跳开约 0.38 圈,免得挨着的两支颜色相近
        var step = max(1, Int((Double(n) * 0.38).rounded()))
        func gcd(_ a: Int, _ b: Int) -> Int { b == 0 ? a : gcd(b, a % b) }
        while n > 2 && gcd(step, n) != 1 { step += 1 }
        let sat = min(max(s, 0.34), 0.52)
        var hues: [UIColor] = []
        for i in 0..<n {
            let j = n <= 2 ? i : (i * step) % n
            var hh = h + CGFloat(j) / CGFloat(n)
            hh -= floor(hh)
            // 黄绿一带看着亮,压暗一点,字与线才压得住纸色
            let yellow = hh > 0.09 && hh < 0.22
            let c = UIColor(hue: hh, saturation: yellow ? sat + 0.08 : sat, brightness: yellow ? 0.5 : 0.56, alpha: 1)
            hues.append(dark ? c.lifted(0.3) : c)
        }
        let a2 = UIColor(hex: theme.accent2)
        return MindPalette(paper: UIColor.pair(theme.paper, "#171513").resolvedColor(with: t),
                           card: UIColor.pair("#FFFFFF", "#24211E").resolvedColor(with: t),
                           ink: UIColor.inkText.resolvedColor(with: t), soft: UIColor.inkSoft.resolvedColor(with: t),
                           faint: UIColor.inkFaint.resolvedColor(with: t),
                           accent: theme.accentUI.resolvedColor(with: t),
                           accent2: dark ? a2.lifted(0.25) : a2, hues: hues, dark: dark)
    }
}

/// 一个节点画成什么样(状态):选中、搜索命中、学过、正在读、是不是「这一章」。
struct MindNodeLook: Equatable {
    var selected = false
    var match = false
    var learned = false
    var reading = false
    var focus = false
    var collapsedKids = 0      // 收着时显示的子项数;0 = 没有子项或展开着
    var hasKids = false
    var hasNote = false
    var progress: Double?      // 一级分支:这一支涉及的章学过了几成
}

/// 节点的画法。rect 是节点框(在 ctx 的坐标里);框外四周留了 MindPainter.margin 画选中圈与角标。
enum MindPainter {
    static let margin: CGFloat = 12

    static func drawNode(_ ctx: CGContext, tree: MindTree, id: Int, rect: CGRect, look: MindNodeLook, pal: MindPalette, metrics: MindMetrics) {
        let n = tree[id]
        let st = MindStyle.of(n.depth)
        let hue = pal.hue(n.branch)
        let path = UIBezierPath(roundedRect: rect, cornerRadius: st.radius)
        ctx.saveGState()
        UIGraphicsPushContext(ctx)
        defer { UIGraphicsPopContext(); ctx.restoreGState() }
        // 搜索命中:框外一圈暖黄的晕
        if look.match {
            let glow = UIBezierPath(roundedRect: rect.insetBy(dx: -5, dy: -5), cornerRadius: st.radius + 5)
            UIColor(hex: pal.dark ? "#8A6A1E" : "#F3D36B").withAlphaComponent(pal.dark ? 0.55 : 0.75).setFill()
            glow.fill()
        }
        // 底与边
        let textColor: UIColor
        switch n.depth {
        case 0:
            pal.accent.setFill(); path.fill()
            textColor = .white
        case 1:
            blend(hue, pal.card, pal.dark ? 0.26 : 0.13).setFill(); path.fill()
            hue.withAlphaComponent(0.9).setStroke(); path.lineWidth = 1.4; path.stroke()
            textColor = pal.ink
        case 2:
            blend(hue, pal.card, pal.dark ? 0.1 : 0.045).setFill(); path.fill()
            hue.withAlphaComponent(0.45).setStroke(); path.lineWidth = 1; path.stroke()
            textColor = pal.ink
        default:
            blend(hue, pal.paper, pal.dark ? 0.08 : 0.05).setFill(); path.fill()
            textColor = pal.soft
        }
        // 「这一章」:节点框内左侧一道竖条
        if look.focus && n.depth > 0 {
            let bar = UIBezierPath(roundedRect: CGRect(x: rect.minX + 3, y: rect.minY + 5, width: 3, height: rect.height - 10), cornerRadius: 1.5)
            hue.setFill(); bar.fill()
        }
        // 字
        let tr = CGRect(x: rect.minX + st.padH, y: rect.minY + st.padV, width: metrics.text[id].width + 1, height: metrics.text[id].height + 2)
        MindFonts.attributed(n.label, depth: n.depth, color: textColor).draw(with: tr, options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
        // 一级分支:框底一道细的进度(这一支涉及的章学过几成)
        if let p = look.progress, n.depth == 1 {
            let w = rect.width - st.radius * 2
            let y = rect.maxY - 3.2
            let bg = UIBezierPath(roundedRect: CGRect(x: rect.minX + st.radius, y: y, width: w, height: 2), cornerRadius: 1)
            hue.withAlphaComponent(0.18).setFill(); bg.fill()
            if p > 0 {
                let fg = UIBezierPath(roundedRect: CGRect(x: rect.minX + st.radius, y: y, width: max(2, w * p), height: 2), cornerRadius: 1)
                hue.setFill(); fg.fill()
            }
        }
        // 有展开说明:右下角一个小折角
        if look.hasNote && n.depth > 0 {
            let s: CGFloat = 7, k = st.radius * 0.3 + 1
            let c = CGPoint(x: rect.maxX - k, y: rect.maxY - k)
            let tri = UIBezierPath()
            tri.move(to: CGPoint(x: c.x - s, y: c.y)); tri.addLine(to: CGPoint(x: c.x, y: c.y - s)); tri.addLine(to: c); tri.close()
            hue.withAlphaComponent(0.55).setFill(); tri.fill()
        }
        // 选中:外圈
        if look.selected {
            let ring = UIBezierPath(roundedRect: rect.insetBy(dx: -4, dy: -4), cornerRadius: st.radius + 4)
            ring.lineWidth = 2.4
            (n.depth == 0 ? pal.accent2 : hue).setStroke(); ring.stroke()
        }
        // 角标:学过(右上角对勾)、正在读(左上角书签)
        if look.learned {
            let c = CGPoint(x: rect.maxX - 2, y: rect.minY + 2)
            let r: CGFloat = 7.5
            let dot = UIBezierPath(ovalIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
            (n.depth == 0 ? pal.accent2 : hue).setFill(); dot.fill()
            pal.card.setStroke(); dot.lineWidth = 1.5; dot.stroke()
            let ck = UIBezierPath()
            ck.move(to: CGPoint(x: c.x - 3.4, y: c.y + 0.2)); ck.addLine(to: CGPoint(x: c.x - 0.9, y: c.y + 2.7)); ck.addLine(to: CGPoint(x: c.x + 3.6, y: c.y - 2.6))
            UIColor.white.setStroke(); ck.lineWidth = 1.7; ck.lineCapStyle = .round; ck.lineJoinStyle = .round; ck.stroke()
        }
        if look.reading {
            let x = rect.minX + 10, y = rect.minY - 6
            let bm = UIBezierPath()
            bm.move(to: CGPoint(x: x, y: y)); bm.addLine(to: CGPoint(x: x + 10, y: y)); bm.addLine(to: CGPoint(x: x + 10, y: y + 14))
            bm.addLine(to: CGPoint(x: x + 5, y: y + 10.5)); bm.addLine(to: CGPoint(x: x, y: y + 14)); bm.close()
            UIColor(hex: pal.dark ? "#E0654A" : "#C8472F").setFill(); bm.fill()
        }
    }

    /// 收放钮:收着画实心圆 + 子项数,展开着画一个小空心圆(连线从它出去)。center 在 ctx 坐标里。
    static func drawBubble(_ ctx: CGContext, center c: CGPoint, collapsed: Int, hue: UIColor, pal: MindPalette) {
        UIGraphicsPushContext(ctx)
        if collapsed > 0 {
            let r = MindStyle.bubbleR
            let o = UIBezierPath(ovalIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
            hue.setFill(); o.fill()
            let s = NSAttributedString(string: "\(collapsed)", attributes: [.font: UIFont.systemFont(ofSize: collapsed > 99 ? 8.5 : 10.5, weight: .bold).rounded, .foregroundColor: UIColor.white])
            let sz = s.size()
            s.draw(at: CGPoint(x: c.x - sz.width / 2, y: c.y - sz.height / 2))
        } else {
            let r: CGFloat = 4.2
            let o = UIBezierPath(ovalIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
            pal.card.setFill(); o.fill()
            hue.setStroke(); o.lineWidth = 1.6; o.stroke()
        }
        UIGraphicsPopContext()
    }

    /// 父 → 子的一条连线(三次贝塞尔,横向起止)。
    static func link(from a: CGPoint, to b: CGPoint) -> CGPath {
        let p = CGMutablePath()
        p.move(to: a)
        let mx = (b.x - a.x) * 0.55
        p.addCurve(to: b, control1: CGPoint(x: a.x + mx, y: a.y), control2: CGPoint(x: b.x - mx, y: b.y))
        return p
    }

    static func linkWidth(_ childDepth: Int) -> CGFloat { childDepth == 1 ? 2.6 : childDepth == 2 ? 1.8 : 1.3 }

    /// 父节点连线的起点:收放钮右侧(没有钮时是框的右缘中点)。
    static func linkStart(_ parent: CGRect) -> CGPoint {
        CGPoint(x: parent.maxX + MindStyle.bubbleGap + 4.2 * 2, y: parent.midY)
    }
    static func bubbleCenter(_ r: CGRect, collapsed: Bool) -> CGPoint {
        CGPoint(x: r.maxX + MindStyle.bubbleGap + (collapsed ? MindStyle.bubbleR : 4.2), y: r.midY)
    }

    static func blend(_ a: UIColor, _ b: UIColor, _ t: CGFloat) -> UIColor {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0, r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        a.getRed(&r1, green: &g1, blue: &b1, alpha: &a1); b.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return UIColor(red: r2 + (r1 - r2) * t, green: g2 + (g1 - g2) * t, blue: b2 + (b1 - b2) * t, alpha: 1)
    }
}


/// 一棵树、一次排版的整图(导出分享用):纸色底、顶上书名与「思想脑图」,下面是展开着的整棵树。
enum MindExport {
    @MainActor static func image(tree: MindTree, metrics: MindMetrics, layout: MindLayout, looks: [Int: MindNodeLook], book: BookInfo, dark: Bool = false) -> UIImage {
        let pal = MindPalette.make(book.theme, branches: tree.branches, dark: dark)
        let pad: CGFloat = 56, head: CGFloat = 110
        let b = layout.bounds
        let size = CGSize(width: max(b.width + pad * 2, 640), height: b.height + pad * 2 + head)
        // 大图压一压倍率,最长边不过 9000 像素
        let scale = min(2.5, 9000 / max(size.width, size.height))
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = max(scale, 0.5)
        fmt.opaque = true
        return UIGraphicsImageRenderer(size: size, format: fmt).image { r in
            let ctx = r.cgContext
            pal.paper.setFill(); ctx.fill(CGRect(origin: .zero, size: size))
            // 题头
            let t = NSAttributedString(string: "《\(book.title)》", attributes: [.font: Fonts.uiSong(30, bold: true), .foregroundColor: pal.ink])
            t.draw(at: CGPoint(x: pad, y: pad - 6))
            let sub = NSAttributedString(string: "思想脑图 · \(layout.frames.count) / \(tree.count) 个节点" + (book.attribution.isEmpty ? "" : " · \(book.attribution)"),
                                         attributes: [.font: UIFont.systemFont(ofSize: 15, weight: .medium), .foregroundColor: pal.soft, .kern: 1])
            sub.draw(at: CGPoint(x: pad, y: pad + 40))
            pal.accent.withAlphaComponent(0.5).setFill()
            ctx.fill(CGRect(x: pad, y: pad + 72, width: 44, height: 2))
            ctx.translateBy(x: pad - b.minX, y: pad + head - b.minY)
            // 连线
            for id in layout.order where id != 0 {
                let n = tree[id]
                guard let r = layout.frames[id], let pr = layout.frames[n.parent] else { continue }
                ctx.addPath(MindPainter.link(from: MindPainter.linkStart(pr), to: CGPoint(x: r.minX, y: r.midY)))
                ctx.setStrokeColor(pal.hue(n.branch).withAlphaComponent(0.6).cgColor)
                ctx.setLineWidth(MindPainter.linkWidth(n.depth)); ctx.setLineCap(.round)
                ctx.strokePath()
            }
            for id in layout.order {
                guard let r = layout.frames[id] else { continue }
                var look = looks[id] ?? MindNodeLook()
                look.selected = false; look.match = false
                MindPainter.drawNode(ctx, tree: tree, id: id, rect: r, look: look, pal: pal, metrics: metrics)
                if look.hasKids { MindPainter.drawBubble(ctx, center: MindPainter.bubbleCenter(r, collapsed: look.collapsedKids > 0), collapsed: look.collapsedKids, hue: pal.hue(tree[id].branch), pal: pal) }
            }
        }
    }
}
