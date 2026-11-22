import UIKit

extension NSAttributedString.Key {
    /// 这段文字属于第几段(0 起);章题等不属于任何段的为 -1。续读、划线都靠它把屏上的字对回段号。
    static let deskSeg = NSAttributedString.Key("desk.seg")
    /// 带注释的字词:值是 "段下标:注释下标"。
    static let deskNote = NSAttributedString.Key("desk.note")
    /// 展开的译文段:值是段后留白的高度(画底色时要扣掉)。
    static let deskTrans = NSAttributedString.Key("desk.trans")
}

/// 给展开的译文画一块带左侧色条的圆角底色(TextKit 自带的背景色只能画直角、贴字)。
final class DeskLayoutManager: NSLayoutManager {
    var tint: UIColor = .systemTeal
    override func drawBackground(forGlyphRange glyphsToShow: NSRange, at origin: CGPoint) {
        super.drawBackground(forGlyphRange: glyphsToShow, at: origin)
        guard let ts = textStorage else { return }
        let chars = characterRange(forGlyphRange: glyphsToShow, actualGlyphRange: nil)
        ts.enumerateAttribute(.deskTrans, in: chars) { v, r, _ in
            guard let gap = v as? CGFloat else { return }
            let g = NSIntersectionRange(glyphRange(forCharacterRange: r, actualCharacterRange: nil), glyphsToShow)
            guard g.length > 0 else { return }
            var box = CGRect.null
            enumerateLineFragments(forGlyphRange: g) { lf, _, _, _, _ in box = box.union(lf) }
            guard !box.isNull else { return }
            let endsHere = NSMaxRange(g) == NSMaxRange(self.glyphRange(forCharacterRange: r, actualCharacterRange: nil))
            box.size.height -= endsHere ? gap : 0
            box = box.offsetBy(dx: origin.x, dy: origin.y)
            tint.withAlphaComponent(0.09).setFill()
            UIBezierPath(roundedRect: box, cornerRadius: 12).fill()
            tint.withAlphaComponent(0.75).setFill()
            UIBezierPath(roundedRect: CGRect(x: box.minX, y: box.minY + 10, width: 3.5, height: max(box.height - 20, 4)), cornerRadius: 2).fill()
        }
    }
}

struct ReaderStyle: Equatable {
    var fontSize: CGFloat = 21
    var showTranslation = false       // 全部展开译文
    var revealed: Set<Int> = []       // 单独点开译文的段
    var bookID = ""
    var pageWidth: CGFloat = 0
    var pageHeight: CGFloat = 0
    var accent: UIColor = .systemTeal
    var text = UIColor.inkText
    var soft = UIColor.inkSoft
    var faint = UIColor.inkFaint
}

/// 一章的排版与分页:整章排成一条文字流,按页面大小切进一个个文字容器(TextKit 1 的多容器分页)。
/// 一段太长会自然跨页;每页记得自己从哪一段开始,换字号、换设备后按段号落回同一处。
final class ChapterLayout {
    let chapter: Chapter
    let storage: NSTextStorage
    let manager = DeskLayoutManager()
    private(set) var containers: [NSTextContainer] = []
    private(set) var firstSeg: [Int] = []     // 每页第一个字所属的段
    let accent: UIColor

    init(chapter: Chapter, unit: String, pageSize: CGSize, style: ReaderStyle) {
        self.chapter = chapter
        accent = style.accent
        var style = style
        style.pageWidth = pageSize.width
        style.pageHeight = pageSize.height
        manager.tint = style.accent
        storage = NSTextStorage(attributedString: Self.typeset(chapter, unit: unit, style: style))
        storage.addLayoutManager(manager)
        let total = manager.numberOfGlyphs
        var laid = 0
        while laid < total && containers.count < 2000 {
            let c = NSTextContainer(size: pageSize)
            c.lineFragmentPadding = 0
            manager.addTextContainer(c)
            let r = manager.glyphRange(for: c)
            if r.length == 0 { manager.removeTextContainer(at: manager.textContainers.count - 1); break }
            containers.append(c)
            laid = NSMaxRange(r)
            firstSeg.append(seg(atGlyph: r.location, upTo: NSMaxRange(r)))
        }
    }

    var pageCount: Int { containers.count }

    private func seg(atGlyph g: Int, upTo end: Int) -> Int {
        var i = manager.characterIndexForGlyph(at: g)
        let stop = min(manager.characterIndexForGlyph(at: max(g, end - 1)), storage.length - 1)
        while i <= stop {   // 页首若是章题,往后找到第一段正文
            if let s = storage.attribute(.deskSeg, at: i, effectiveRange: nil) as? Int, s >= 0 { return s }
            i += 1
        }
        return 0
    }

    /// 某一段落在第几页(续读用)。
    func page(forSeg seg: Int) -> Int {
        var p = 0
        for (i, s) in firstSeg.enumerated() where s <= seg { p = i }
        return p
    }

    /// 屏上某个字属于第几段(点一段展开译文用);章题、插画返回 nil。
    func seg(atCharacter i: Int) -> Int? {
        guard i >= 0, i < storage.length, let s = storage.attribute(.deskSeg, at: i, effectiveRange: nil) as? Int, s >= 0 else { return nil }
        return s
    }

    func note(for url: URL) -> Note? {
        guard url.scheme == "desk-note" else { return nil }
        let parts = url.pathComponents.compactMap { Int($0) }
        guard parts.count == 2, chapter.segs.indices.contains(parts[0]), let ns = chapter.segs[parts[0]].n, ns.indices.contains(parts[1]) else { return nil }
        return ns[parts[1]]
    }

    static func typeset(_ ch: Chapter, unit: String, style: ReaderStyle) -> NSAttributedString {
        let out = NSMutableAttributedString()
        // 章题:小字序号 + 大字题名
        let cap = NSMutableParagraphStyle(); cap.paragraphSpacing = 6
        out.append(NSAttributedString(string: "第 \(Numerals.chinese(ch.no)) \(unit)\n", attributes: [
            .font: UIFont.systemFont(ofSize: max(13, style.fontSize * 0.5), weight: .semibold), .foregroundColor: style.accent, .kern: 4, .paragraphStyle: cap, .deskSeg: -1]))
        if !ch.title.isEmpty {
            let ts = NSMutableParagraphStyle(); ts.paragraphSpacing = style.fontSize * 1.3
            out.append(NSAttributedString(string: ch.title + "\n", attributes: [
                .font: Fonts.uiSong(style.fontSize * 1.5, bold: true), .foregroundColor: style.text, .paragraphStyle: ts, .deskSeg: -1]))
        }
        let gap = style.fontSize * 1.0                  // 段与段之间
        let tsy = NSMutableParagraphStyle()             // 译文块:左右缩进留出底色的边
        tsy.lineSpacing = style.fontSize * 0.3
        tsy.paragraphSpacingBefore = 12
        tsy.paragraphSpacing = 12 + gap
        tsy.firstLineHeadIndent = 18; tsy.headIndent = 18; tsy.tailIndent = -14
        for (i, s) in ch.segs.enumerated() {
            let open = (style.showTranslation || style.revealed.contains(i)) && !(s.t ?? "").isEmpty
            let os = NSMutableParagraphStyle()
            os.lineSpacing = style.fontSize * 0.5
            os.paragraphSpacing = open ? style.fontSize * 0.45 : gap
            let para = NSMutableAttributedString(string: s.o + "\n", attributes: [
                .font: Fonts.uiSong(style.fontSize), .foregroundColor: style.text, .paragraphStyle: os, .kern: 0.6, .deskSeg: i])
            for (j, n) in (s.n ?? []).enumerated() {
                let r = (s.o as NSString).range(of: n.k)
                guard r.location != NSNotFound else { continue }
                // 带注释的字词做成「链接」:系统文本框对链接的点按最可靠(自己加点按手势会被选字手势吃掉)
                para.addAttributes([.deskNote: "\(i):\(j)", .link: URL(string: "desk-note://n/\(i)/\(j)")!], range: r)
            }
            out.append(para)
            if open, let t = s.t {
                out.append(NSAttributedString(string: t + "\n", attributes: [
                    .font: UIFont.systemFont(ofSize: max(15, style.fontSize * 0.62)), .foregroundColor: style.soft, .paragraphStyle: tsy, .deskSeg: i, .deskTrans: gap]))
            }
        }
        return out
    }
}

enum Numerals {
    private static let d = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
    /// 1…999 的中文数字(章号用)。
    static func chinese(_ n: Int) -> String {
        guard n > 0, n < 1000 else { return String(n) }
        var s = ""
        let h = n / 100, t = (n / 10) % 10, o = n % 10
        if h > 0 { s += d[h] + "百" }
        if t > 0 { s += (t == 1 && h == 0 ? "" : d[t]) + "十" } else if h > 0 && o > 0 { s += "零" }
        if o > 0 { s += d[o] }
        return s
    }
}

extension UIImage {
    /// 裁成指定大小(居中铺满)并切圆角。
    func rounded(to size: CGSize, radius: CGFloat) -> UIImage {
        UIGraphicsImageRenderer(size: size).image { _ in
            UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: radius).addClip()
            let scale = max(size.width / self.size.width, size.height / self.size.height)
            let w = self.size.width * scale, h = self.size.height * scale
            draw(in: CGRect(x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h))
        }
    }
}
