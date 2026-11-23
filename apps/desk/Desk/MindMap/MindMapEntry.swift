import SwiftUI

/// 书的首页上的「思想脑图」卡:左边一句说明与数字,下面一张活的缩略图(根 + 一级 + 二级的枝杈)。
/// 给了 walk 就多一个「走读」:打开就从根一个节点一个节点走过去。
struct MindMapCard: View {
    let book: BookInfo
    let tree: MindTree
    let open: () -> Void
    var walk: (() -> Void)? = nil
    private var accent: Color { book.theme.accentColor }

    var body: some View {
        let pack = Library.shared.pack(book)
        let chs = tree.chapters(inSubtree: 0)
        let learned = chs.filter { ch in pack?.chapters[safe: ch - 1].map { Stats.shared.learned($0.src) } ?? false }.count
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Image(systemName: "point.3.connected.trianglepath.dotted").font(.system(size: 12, weight: .bold)).accessibilityHidden(true)
                        Text("思想脑图").font(.system(size: 12.5, weight: .bold)).kerning(2)
                    }
                    .foregroundStyle(accent)
                    Text("全书的骨架一张图看完").font(Fonts.song(19, bold: true)).foregroundStyle(Ink.text)
                    Text("\(tree.branches) 条主线 · \(tree.count) 个节点" + (chs.isEmpty ? "" : " · 学过 \(learned) / \(chs.count) \(book.unit)"))
                        .font(.system(size: 12.5)).foregroundStyle(Ink.soft)
                }
                Spacer(minLength: 6)
                if walk == nil { pill("打开", icon: "arrow.up.left.and.arrow.down.right", filled: true) }
            }
            MindPreview(book: book, tree: tree)
                .frame(height: MindPreview.height(tree))
                .accessibilityHidden(true)
            if let walk {
                HStack(spacing: 10) {
                    Button(action: walk) { pill("走读", icon: "figure.walk", filled: true) }
                        .buttonStyle(.plain)
                        .accessibilityHint("从书名起,一个节点一个节点走一遍")
                    Button(action: open) { pill("自己看", icon: "arrow.up.left.and.arrow.down.right", filled: false) }
                        .buttonStyle(.plain)
                    Spacer(minLength: 0)
                }
            }
            if let n = book.mindmapNote { Text(n).font(.system(size: 11.5)).foregroundStyle(Ink.faint) }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(accent.opacity(0.28), lineWidth: 1))
        .shadow(color: accent.opacity(0.1), radius: 10, y: 4)
        .contentShape(RoundedRectangle(cornerRadius: 18))
        .onTapGesture(perform: open)
        .accessibilityElement(children: walk == nil ? .ignore : .contain)
        .accessibilityLabel("思想脑图,\(tree.branches) 条主线,\(tree.count) 个节点")
        .accessibilityAddTraits(walk == nil ? .isButton : [])
        .accessibilityAction(named: "全屏打开", open)
    }

    private func pill(_ t: String, icon: String, filled: Bool) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.system(size: 11, weight: .bold))
            Text(t).font(.system(size: 14, weight: .semibold))
        }
        .foregroundStyle(filled ? .white : accent)
        .padding(.horizontal, 14).padding(.vertical, 8)
        .background(filled ? accent : accent.opacity(0.1), in: Capsule())
        .contentShape(Capsule())
    }
}

/// 缩略图:根在左,一级分支一行一条(带题名),二级用细枝表示有几项。不是缩小的整图,是一眼认得出骨架的示意。
struct MindPreview: View {
    let book: BookInfo
    let tree: MindTree
    @Environment(\.colorScheme) private var scheme

    static func height(_ t: MindTree) -> CGFloat { min(max(CGFloat(t.branches) * 21 + 12, 120), 300) }

    var body: some View {
        Canvas { ctx, size in
            let pal = MindPalette.make(book.theme, branches: tree.branches, dark: scheme == .dark)
            let root = tree[0]
            let kids = root.children
            let n = max(kids.count, 1)
            let rowH = (size.height - 8) / CGFloat(n)
            // 根
            let rootW = min(size.width * 0.26, 118)
            let rootText = ctx.resolve(Text(root.label).font(Fonts.song(13, bold: true)).foregroundColor(.white))
            // 书名长的折两行
            let rootH: CGFloat = rootText.measure(in: CGSize(width: rootW - 16, height: 200)).height > 20 ? 52 : 34
            let rootR = CGRect(x: 0, y: size.height / 2 - rootH / 2, width: rootW, height: rootH)
            ctx.fill(Path(roundedRect: rootR, cornerRadius: 10), with: .color(Color(pal.accent)))
            ctx.draw(rootText, in: rootR.insetBy(dx: 8, dy: 7))
            let x1 = rootW + 26
            let labelW = min(size.width * 0.42, 210)
            for (i, k) in kids.enumerated() {
                let node = tree[k]
                let hue = Color(pal.hue(node.branch))
                let cy = 4 + rowH * (CGFloat(i) + 0.5)
                var link = Path()
                link.move(to: CGPoint(x: rootR.maxX, y: rootR.midY))
                link.addCurve(to: CGPoint(x: x1, y: cy), control1: CGPoint(x: rootR.maxX + 16, y: rootR.midY), control2: CGPoint(x: x1 - 16, y: cy))
                ctx.stroke(link, with: .color(hue.opacity(0.6)), lineWidth: 1.6)
                let r = CGRect(x: x1, y: cy - min(rowH * 0.42, 9), width: labelW, height: min(rowH * 0.84, 18))
                ctx.fill(Path(roundedRect: r, cornerRadius: 5), with: .color(hue.opacity(scheme == .dark ? 0.26 : 0.13)))
                ctx.fill(Path(roundedRect: CGRect(x: r.minX, y: r.minY, width: 3, height: r.height), cornerRadius: 1.5), with: .color(hue))
                let t = ctx.resolve(Text(node.label).font(.system(size: min(11.5, rowH * 0.58), weight: .semibold)).foregroundColor(Ink.text))
                ctx.draw(t, in: r.insetBy(dx: 7, dy: 1.5).offsetBy(dx: 1, dy: 0))
                // 二级:细枝,一项一根
                let m = node.children.count
                guard m > 0 else { continue }
                let x2 = r.maxX + 10, span = min(rowH * 0.8, CGFloat(m) * 4)
                let len = min(size.width - x2 - 4, 56)
                guard len > 8 else { continue }
                for j in 0..<m {
                    let y = m == 1 ? cy : cy - span / 2 + span * CGFloat(j) / CGFloat(m - 1)
                    var p = Path()
                    p.move(to: CGPoint(x: r.maxX, y: cy))
                    p.addCurve(to: CGPoint(x: x2 + 6, y: y), control1: CGPoint(x: r.maxX + 6, y: cy), control2: CGPoint(x: x2, y: y))
                    p.addLine(to: CGPoint(x: x2 + 6 + len * (0.55 + 0.45 * CGFloat((j * 7 + i * 3) % 5) / 4), y: y))
                    ctx.stroke(p, with: .color(hue.opacity(0.42)), lineWidth: 1)
                }
            }
        }
    }
}

/// 章末一行安静的链接:「这一章在全书里的位置」——打开脑图,聚焦到挂着这一章的节点。
struct ChapterInMapLink: View {
    let book: BookInfo
    let chapter: Int
    let action: () -> Void
    var body: some View {
        if let t = MindMapStore.tree(book), !t.nodes(forChapter: chapter).isEmpty {
            Button(action: action) {
                HStack(spacing: 8) {
                    Image(systemName: "point.3.connected.trianglepath.dotted").font(.system(size: 13, weight: .semibold))
                    Text("这一\(book.unit)在全书里的位置").font(.system(size: 14, weight: .medium))
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).opacity(0.6)
                }
                .foregroundStyle(Ink.soft)
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("在思想脑图里看这一章")
        }
    }
}
