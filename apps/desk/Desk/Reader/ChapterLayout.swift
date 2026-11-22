import UIKit

extension NSAttributedString.Key {
    /// 这段文字属于第几段(0 起);章题等不属于任何段的为 -1。续读、划线都靠它把屏上的字对回段号。
    static let deskSeg = NSAttributedString.Key("desk.seg")
    /// 带注释的字词:值是 "段下标:注释下标"。
    static let deskNote = NSAttributedString.Key("desk.note")
    /// 展开的译文段:值是段后留白的高度(画底色时要扣掉)。
    static let deskTrans = NSAttributedString.Key("desk.trans")
    /// 正文本身(不含爻题、条号等前缀和段尾换行):值是层名,"o" 原文 · "t" 译文。划线的偏移按它算。
    static let deskLayer = NSAttributedString.Key("desk.layer")
    /// 划线:值是划线 id。只是文字属性,不影响排版(加删划线不重新分页)。
    static let deskHL = NSAttributedString.Key("desk.hl")
}

/// 给展开的译文画一块带左侧色条的圆角底色(TextKit 自带的背景色只能画直角、贴字)。
final class DeskLayoutManager: NSLayoutManager {
    var tint: UIColor = .systemTeal
    /// 划线 id → (颜色, 有无批注)。画底色时按 storage 上的 .deskHL 查这里。
    var hlStyle: [String: (color: Int, note: Bool)] = [:]
    /// 正在闪的范围与当前透明度(跳转后让落点闪两下)。
    var flashRange: NSRange?
    var flashAlpha: CGFloat = 0

    override func drawBackground(forGlyphRange glyphsToShow: NSRange, at origin: CGPoint) {
        super.drawBackground(forGlyphRange: glyphsToShow, at: origin)
        guard let ts = textStorage else { return }
        let chars = characterRange(forGlyphRange: glyphsToShow, actualGlyphRange: nil)
        defer {
            drawHighlights(ts, chars: chars, glyphsToShow: glyphsToShow, origin: origin)
            if let f = flashRange, flashAlpha > 0.01 {
                let r = NSIntersectionRange(f, chars)
                if r.length > 0 {
                    for b in lineBoxes(ts, glyphs: glyphRange(forCharacterRange: r, actualCharacterRange: nil), origin: origin) {
                        tint.withAlphaComponent(flashAlpha).setFill()
                        UIBezierPath(roundedRect: b.insetBy(dx: -3, dy: -1), cornerRadius: 5).fill()
                    }
                }
            }
        }
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

    /// 划线:每行一块圆角淡色底,高度贴着字(按字体的上下沿算,不含行距);带批注的在末行右上角点一个小圆点。
    private func drawHighlights(_ ts: NSTextStorage, chars: NSRange, glyphsToShow: NSRange, origin: CGPoint) {
        guard !hlStyle.isEmpty else { return }
        ts.enumerateAttribute(.deskHL, in: chars) { v, r, _ in
            guard let id = v as? String, let st = hlStyle[id] else { return }
            let full = glyphRange(forCharacterRange: r, actualCharacterRange: nil)
            let g = NSIntersectionRange(full, glyphsToShow)
            guard g.length > 0 else { return }
            let boxes = lineBoxes(ts, glyphs: g, origin: origin)
            HLColor.fill(st.color).setFill()
            for b in boxes { UIBezierPath(roundedRect: b.insetBy(dx: -2, dy: 0), cornerRadius: 4).fill() }
            // 一条划线可能被同一 id 拆成几段属性(中间夹着注释词),只在真正的末尾画标记
            var tail = NSRange()
            _ = ts.attribute(.deskHL, at: NSMaxRange(r) - 1, longestEffectiveRange: &tail, in: NSRange(location: 0, length: ts.length))
            if st.note, NSMaxRange(g) == NSMaxRange(full), NSMaxRange(r) == NSMaxRange(tail), let last = boxes.last {
                let d: CGFloat = 7
                HLColor.mark(st.color).setFill()
                UIBezierPath(ovalIn: CGRect(x: last.maxX - d * 0.2, y: last.minY - d * 0.55, width: d, height: d)).fill()
            }
        }
    }

    /// 一段字形逐行的外框(只到字的上下沿)。
    func lineBoxes(_ ts: NSTextStorage, glyphs g: NSRange, origin: CGPoint) -> [CGRect] {
        var out: [CGRect] = []
        enumerateLineFragments(forGlyphRange: g) { rect, _, container, lineRange, _ in
            let sub = NSIntersectionRange(lineRange, g)
            guard sub.length > 0 else { return }
            // 行尾的换行符不算
            var s = sub
            let lastChar = self.characterIndexForGlyph(at: NSMaxRange(s) - 1)
            if lastChar < ts.length, (ts.string as NSString).character(at: lastChar) == 10 { s.length -= 1 }
            guard s.length > 0 else { return }
            var b = self.boundingRect(forGlyphRange: s, in: container)
            let font = ts.attribute(.font, at: self.characterIndexForGlyph(at: s.location), effectiveRange: nil) as? UIFont ?? .systemFont(ofSize: 17)
            let base = rect.minY + self.location(forGlyphAt: s.location).y
            b.origin.y = base - font.ascender - 1
            b.size.height = font.ascender - font.descender + 2
            out.append(b.offsetBy(dx: origin.x, dy: origin.y))
        }
        return out
    }
}

struct ReaderStyle: Equatable {
    var fontSize: CGFloat = 21
    var showTranslation = false       // 全部展开译文
    var revealed: Set<Int> = []       // 单独点开译文的段
    var bookID = ""
    var template = ""                 // duanzhang 短章 · yulu 语录 · gua 卦 · pianzhang 篇章
    var pageWidth: CGFloat = 0
    var pageHeight: CGFloat = 0
    var accent: UIColor = .systemTeal
    var text = UIColor.inkText
    var soft = UIColor.inkSoft
    var faint = UIColor.inkFaint
}

/// 一章的排版与分页:整章排成一条文字流,按栏的大小切进一个个文字容器(TextKit 1 的多容器分页)。
/// 每栏一个容器;一页 = 连续 `columns` 个容器(手机与竖屏 1 栏,iPad 横屏 2 栏,像摊开的书,文字从左栏流到右栏)。
/// 一段太长会自然跨页;每页记得自己从哪一段开始,换字号、换设备、转屏后按段号落回同一处。
final class ChapterLayout {
    let chapter: Chapter
    let storage: NSTextStorage
    let manager = DeskLayoutManager()
    /// 每栏一个容器(第 p 页是下标 p*columns ..< (p+1)*columns,最后一页可能不满)。
    private(set) var containers: [NSTextContainer] = []
    /// 每栏一个文本框,分页时就建好、屏上显示的也是它——文本框一接上文字容器就会影响排版(行高、容器大小),
    /// 所以「算分页」和「显示」必须用同一套对象,否则屏上每页排进去的行数会和算出来的对不上。
    private(set) var textViews: [UITextView] = []
    private(set) var firstSeg: [Int] = []     // 每页(第一栏)第一个字所属的段
    let accent: UIColor
    /// 一页几栏(1 或 2)、每栏宽、栏间中缝。整页宽 = columns × columnWidth + (columns-1) × gutter。
    let columns: Int
    let columnWidth: CGFloat
    let gutter: CGFloat

    init(chapter: Chapter, unit: String, pageSize: CGSize, columns: Int = 1, gutter: CGFloat = 56, style: ReaderStyle, highlights: [Highlight] = []) {
        self.chapter = chapter
        accent = style.accent
        self.columns = max(1, columns)
        self.gutter = self.columns > 1 ? gutter : 0
        columnWidth = floor((pageSize.width - self.gutter * CGFloat(self.columns - 1)) / CGFloat(self.columns))
        let colSize = CGSize(width: columnWidth, height: pageSize.height)
        var style = style
        style.pageWidth = colSize.width
        style.pageHeight = colSize.height
        manager.tint = style.accent
        storage = NSTextStorage(attributedString: Self.typeset(chapter, unit: unit, style: style))
        storage.addLayoutManager(manager)
        indexLayers()
        applyHighlights(highlights)
        paginate(colSize)
        // 一段(连同它展开的译文)尽量不拆到两栏:排完看哪一段正好跨在栏缝上(左栏→右栏、右栏→下一页左栏、
        // 单栏时就是页缝),只要它不算长,就把那一栏的文字区截短到这一段的上沿,让它整段落到下一栏,再重排。
        // 用排版器自己的结果判断,不靠估算;特别长的段(超过大半栏)照旧自然跨栏。
        var rounds = 0
        while rounds < 400, let cut = straddle(colSize) {
            cuts[cut.page] = cut.height
            paginate(colSize)
            rounds += 1
        }
        // 页首字所属的段:按页(每页第一栏)取
        firstSeg = stride(from: 0, to: containers.count, by: self.columns).map { colFirstSeg[$0] }
        pageChars = (0..<pageCount).map { p in
            let cols = columnIndices(ofPage: p)
            let a = manager.glyphRange(for: containers[cols.lowerBound]), b = manager.glyphRange(for: containers[cols.upperBound - 1])
            let c0 = manager.characterRange(forGlyphRange: a, actualGlyphRange: nil).location
            let c1 = NSMaxRange(manager.characterRange(forGlyphRange: b, actualGlyphRange: nil))
            return NSRange(location: c0, length: c1 - c0)
        }
    }

    /// 每页覆盖的字(storage 下标,含两栏)。
    private(set) var pageChars: [NSRange] = []
    /// 每段每层正文在 storage 里的范围:键 "o3" / "t3"。
    private var layerRanges: [String: NSRange] = [:]
    /// 每段第一个字(含前缀)在 storage 里的下标。
    private var segStart: [Int: Int] = [:]

    private func indexLayers() {
        let all = NSRange(location: 0, length: storage.length)
        storage.enumerateAttribute(.deskLayer, in: all) { v, r, _ in
            guard let l = v as? String, let s = storage.attribute(.deskSeg, at: r.location, effectiveRange: nil) as? Int else { return }
            layerRanges["\(l)\(s)"] = r
        }
        storage.enumerateAttribute(.deskSeg, in: all) { v, r, _ in
            guard let s = v as? Int, s >= 0, segStart[s] == nil else { return }
            segStart[s] = r.location
        }
    }

    // MARK: 划线

    /// 一个选区(storage 下标)拆成「每段每层一条」;只落在章题、条号、换行上的部分不算。
    func pieces(in sel: NSRange) -> [HLPiece] {
        var out: [HLPiece] = []
        storage.enumerateAttribute(.deskLayer, in: NSIntersectionRange(sel, NSRange(location: 0, length: storage.length))) { v, r, _ in
            guard let l = v as? String, let seg = storage.attribute(.deskSeg, at: r.location, effectiveRange: nil) as? Int,
                  let lr = layerRanges["\(l)\(seg)"], let text = chapter.text(seg: seg, layer: l) else { return }
            let a = text.charOffset(utf16: r.location - lr.location), b = text.charOffset(utf16: NSMaxRange(r) - lr.location)
            guard b > a, let t = text.chars(a, b), !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
            // 同一段同一层被注释词等切成几截的,并成一条
            if let last = out.last, last.seg == seg, last.layer == l, last.end == a { out[out.count - 1].end = b; out[out.count - 1].text += t }
            else { out.append(HLPiece(seg: seg, layer: l, start: a, end: b, text: t)) }
        }
        return out
    }

    /// 某段某层第 start…end 个字在 storage 里的范围。
    func range(seg: Int, layer: String, start: Int, end: Int) -> NSRange? {
        guard let lr = layerRanges["\(layer)\(seg)"], let text = chapter.text(seg: seg, layer: layer) else { return nil }
        let a = text.utf16Offset(char: start), b = text.utf16Offset(char: end)
        guard b > a, b <= lr.length else { return nil }
        return NSRange(location: lr.location + a, length: b - a)
    }

    func range(of h: Highlight) -> NSRange? {
        guard let p = chapter.locate(h) else { return nil }
        return range(seg: h.seg, layer: h.layer, start: p.start, end: p.end)
    }

    /// 把这一章的划线画上:只改文字属性、不动排版,然后让相关文本框重绘。
    func applyHighlights(_ hs: [Highlight]) {
        let all = NSRange(location: 0, length: storage.length)
        var dirty: [NSRange] = []
        storage.enumerateAttribute(.deskHL, in: all) { v, r, _ in if v != nil { dirty.append(r) } }
        storage.beginEditing()
        storage.removeAttribute(.deskHL, range: all)
        var styles: [String: (color: Int, note: Bool)] = [:]
        for h in hs.sorted(by: { $0.at < $1.at }) {      // 重叠的,后改的盖在上面
            guard let r = range(of: h) else { continue }
            storage.addAttribute(.deskHL, value: h.id, range: r)
            styles[h.id] = (h.color, h.hasNote)
            dirty.append(r)
        }
        storage.endEditing()
        manager.hlStyle = styles
        for r in dirty { manager.invalidateDisplay(forCharacterRange: r) }
    }

    /// 某个字上的划线 id。
    func highlightID(atCharacter i: Int) -> String? {
        guard i >= 0, i < storage.length else { return nil }
        return storage.attribute(.deskHL, at: i, effectiveRange: nil) as? String
    }

    private var flashTimer: Timer?
    /// 让一段字闪两下(改底色透明度)。用定时器不用 CADisplayLink / rAF,后台也照常走完。
    func flash(_ r: NSRange) {
        flashTimer?.invalidate()
        manager.flashRange = r
        let t0 = Date()
        let dur = 1.3
        flashTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] t in
            guard let self else { t.invalidate(); return }
            let x = Date().timeIntervalSince(t0) / dur
            if x >= 1 {
                t.invalidate(); self.manager.flashAlpha = 0; self.manager.flashRange = nil
            } else {
                self.manager.flashAlpha = CGFloat(sin(x * .pi * 4 - .pi / 2) * 0.5 + 0.5) * 0.4   // 两起两落
            }
            self.manager.invalidateDisplay(forCharacterRange: r)
        }
    }

    /// 第 p 页上出现的各段(原文或译文有字落在这页就算),按段序。
    func segs(onPage p: Int) -> [Int] {
        guard pageChars.indices.contains(p) else { return [] }
        var out: [Int] = []
        storage.enumerateAttribute(.deskSeg, in: pageChars[p]) { v, _, _ in
            if let s = v as? Int, s >= 0, !out.contains(s) { out.append(s) }
        }
        return out
    }

    /// 第几个字落在第几页。
    func page(forCharacter i: Int) -> Int {
        pageChars.firstIndex { NSMaxRange($0) > i } ?? max(pageCount - 1, 0)
    }

    private var cuts: [Int: CGFloat] = [:]      // 栏(容器下标)→ 截短后的高度
    private var colFirstSeg: [Int] = []         // 每栏第一个字所属的段

    /// 第几栏(容器下标)文字区的高度。文本框必须照这个高度摆——它会把自己的大小写回文字容器,摆高了被截短的那一栏又会多排进一行。
    func height(ofColumn i: Int, full: CGFloat) -> CGFloat { cuts[i] ?? full }

    /// 第 p 页的栏(容器下标),最后一页可能只有左栏。
    func columnIndices(ofPage p: Int) -> Range<Int> {
        let a = p * columns
        return a..<min(a + columns, containers.count)
    }

    private func paginate(_ pageSize: CGSize) {
        while !manager.textContainers.isEmpty { manager.removeTextContainer(at: manager.textContainers.count - 1) }
        textViews.forEach { $0.removeFromSuperview() }
        containers.removeAll(); colFirstSeg.removeAll(); textViews.removeAll()
        let total = manager.numberOfGlyphs
        var laid = 0
        while laid < total && containers.count < 2000 {
            let c = NSTextContainer(size: CGSize(width: pageSize.width, height: cuts[containers.count] ?? pageSize.height))
            c.lineFragmentPadding = 0
            manager.addTextContainer(c)
            let tv = TightTextView(frame: CGRect(origin: .zero, size: c.size), textContainer: c)
            tv.isEditable = false
            tv.isScrollEnabled = false
            tv.isSelectable = true
            tv.backgroundColor = .clear
            tv.textContainerInset = .zero
            tv.contentInsetAdjustmentBehavior = .never
            // 注释词的样子:字色不变,只在下面加一道主题色的点线
            tv.linkTextAttributes = [.foregroundColor: UIColor.inkText,
                                     .underlineStyle: NSUnderlineStyle.single.rawValue | NSUnderlineStyle.patternDot.rawValue,
                                     .underlineColor: accent]
            c.lineFragmentPadding = 0
            c.size = CGSize(width: pageSize.width, height: cuts[containers.count] ?? pageSize.height)
            let r = manager.glyphRange(for: c)
            if r.length == 0 { manager.removeTextContainer(at: manager.textContainers.count - 1); break }
            containers.append(c)
            textViews.append(tv)
            laid = NSMaxRange(r)
            colFirstSeg.append(seg(atGlyph: r.location, upTo: NSMaxRange(r)))
        }
    }

    /// 找第一处「同一段被栏缝切开」且这段不长的地方,返回(第几栏, 这一段在该栏的上沿);没有就返回 nil。
    private func straddle(_ pageSize: CGSize) -> (page: Int, height: CGFloat)? {
        guard containers.count > 1 else { return nil }
        for p in 0..<(containers.count - 1) where cuts[p] == nil {
            let a = manager.glyphRange(for: containers[p]), b = manager.glyphRange(for: containers[p + 1])
            guard a.length > 0, b.length > 0 else { continue }
            let lastChar = manager.characterIndexForGlyph(at: NSMaxRange(a) - 1)
            let nextChar = manager.characterIndexForGlyph(at: b.location)
            var range = NSRange()
            guard let s1 = storage.attribute(.deskSeg, at: lastChar, longestEffectiveRange: &range, in: NSRange(location: 0, length: storage.length)) as? Int,
                  s1 >= 0, NSLocationInRange(nextChar, range) else { continue }
            let g = manager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
            guard g.location > a.location else { continue }             // 这一段从页首就开始了,本身比一页长,拆是应该的
            let top = manager.lineFragmentRect(forGlyphAt: g.location, effectiveRange: nil).minY
            let h1 = manager.boundingRect(forGlyphRange: NSIntersectionRange(g, a), in: containers[p]).height
            let h2 = manager.boundingRect(forGlyphRange: NSIntersectionRange(g, b), in: containers[p + 1]).height
            if top > pageSize.height * 0.25, h1 + h2 <= pageSize.height * 0.7 { return (p, ceil(top) + 1) }   // 向上取整再留一点:取小了上一段的最后一行也会被挤走
        }
        return nil
    }

    var pageCount: Int { (containers.count + columns - 1) / columns }

    private func seg(atGlyph g: Int, upTo end: Int) -> Int {
        var i = manager.characterIndexForGlyph(at: g)
        let stop = min(manager.characterIndexForGlyph(at: max(g, end - 1)), storage.length - 1)
        while i <= stop {   // 页首若是章题,往后找到第一段正文
            if let s = storage.attribute(.deskSeg, at: i, effectiveRange: nil) as? Int, s >= 0 { return s }
            i += 1
        }
        return 0
    }

    /// 某一段落在第几页(续读用):这一段开始的那一页(第一张含该段文字的页),不是「最后一张以它开头的页」。
    func page(forSeg seg: Int) -> Int {
        if let c = segStart[seg] { return page(forCharacter: c) }
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
        // 章题:小字序号 + 大字题名。卦:序号后带「下卦 · 上卦」,题名前画卦画;十翼的篇章不标序号。
        let cap = NSMutableParagraphStyle(); cap.paragraphSpacing = 6
        let capAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: max(13, style.fontSize * 0.5), weight: .semibold), .foregroundColor: style.accent, .kern: 4, .paragraphStyle: cap, .deskSeg: -1]
        if let g = ch.gua {
            out.append(NSAttributedString(string: "第 \(Numerals.chinese(ch.no)) 卦 · \(g.lower)下\(g.upper)上\n", attributes: capAttrs))
        } else if ch.kind != "text" {
            out.append(NSAttributedString(string: "第 \(Numerals.chinese(ch.no)) \(unit)\n", attributes: capAttrs))
        }
        if !ch.title.isEmpty {
            let ts = NSMutableParagraphStyle(); ts.paragraphSpacing = style.fontSize * 1.3
            let titleFont = Fonts.uiSong(style.fontSize * 1.5, bold: true)
            let line = NSMutableAttributedString()
            if let g = ch.gua {
                let side = titleFont.capHeight * 1.25
                let att = NSTextAttachment()
                att.image = Hexagram.image(binary: g.binary, side: side, color: style.accent)
                att.bounds = CGRect(x: 0, y: -side * 0.1, width: side, height: side)
                line.append(NSAttributedString(attachment: att))
                line.append(NSAttributedString(string: "  "))
            }
            line.append(NSAttributedString(string: ch.title + "\n"))
            line.addAttributes([.font: titleFont, .foregroundColor: style.text, .paragraphStyle: ts, .deskSeg: -1], range: NSRange(location: 0, length: line.length))
            out.append(line)
        }
        let gap = style.fontSize * 1.0                  // 段与段之间
        let tsy = NSMutableParagraphStyle()             // 译文块:左右缩进留出底色的边
        tsy.lineSpacing = style.fontSize * 0.3
        tsy.paragraphSpacingBefore = 12
        tsy.paragraphSpacing = 12 + gap
        tsy.firstLineHeadIndent = 18; tsy.headIndent = 18; tsy.tailIndent = -14
        for (i, s) in ch.segs.enumerated() {
            let block = NSMutableAttributedString()
            let open = (style.showTranslation || style.revealed.contains(i)) && !(s.t ?? "").isEmpty
            let os = NSMutableParagraphStyle()
            os.lineSpacing = style.fontSize * 0.5
            os.paragraphSpacing = open ? style.fontSize * 0.45 : gap
            // 爻题(初九、六二…用九)排在爻辞前面,用主题色;彖、象的原文自带「彖曰」「象曰」,不另标
            // 语录体(论语)每条前面标条号,小一号、主题色,方便「某篇第几条」这样指认
            let isLine = s.line != nil && s.label != nil && s.label != "象"
            let tag = isLine ? s.label! + "　" : (style.template == "yulu" ? "\(i + 1)  " : "")
            let para = NSMutableAttributedString(string: tag + s.o + "\n", attributes: [
                .font: Fonts.uiSong(style.fontSize), .foregroundColor: style.text, .paragraphStyle: os, .kern: 0.6, .deskSeg: i])
            let lead = (tag as NSString).length
            para.addAttribute(.deskLayer, value: "o", range: NSRange(location: lead, length: (s.o as NSString).length))
            if lead > 0, isLine {
                para.addAttributes([.font: Fonts.uiSong(style.fontSize, bold: true), .foregroundColor: style.accent], range: NSRange(location: 0, length: lead))
            } else if lead > 0 {
                para.addAttributes([.font: UIFont.systemFont(ofSize: style.fontSize * 0.5, weight: .semibold).rounded, .foregroundColor: style.accent,
                                    .baselineOffset: style.fontSize * 0.28, .kern: 0], range: NSRange(location: 0, length: lead))
            }
            for (j, n) in (s.n ?? []).enumerated() {
                var r = (s.o as NSString).range(of: n.k)
                guard r.location != NSNotFound else { continue }
                r.location += lead
                // 带注释的字词做成「链接」:系统文本框对链接的点按最可靠(自己加点按手势会被选字手势吃掉)
                para.addAttributes([.deskNote: "\(i):\(j)", .link: URL(string: "desk-note://n/\(i)/\(j)")!], range: r)
            }
            block.append(para)
            if open, let t = s.t {
                let tb = NSMutableAttributedString(string: t + "\n", attributes: [
                    .font: UIFont.systemFont(ofSize: max(15, style.fontSize * 0.62)), .foregroundColor: style.soft, .paragraphStyle: tsy, .deskSeg: i, .deskTrans: gap])
                tb.addAttribute(.deskLayer, value: "t", range: NSRange(location: 0, length: (t as NSString).length))
                block.append(tb)
            }
            out.append(block)
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

/// 卦画:六爻自下而上(binary 下标 0 是初爻),阳爻一横、阴爻断开。
enum Hexagram {
    static func image(binary: String, side: CGFloat, color: UIColor) -> UIImage {
        image(binary: binary, size: CGSize(width: side, height: side), color: color)
    }

    /// 任意爻数(六画卦、三画卦、单独一爻)、任意宽高:n 横 n-1 空等分高度。白话图解的卦画也用它(画成模板图,由界面上色)。
    static func image(binary: String, size: CGSize, color: UIColor) -> UIImage {
        let bits = Array(binary)
        let n = max(bits.count, 1)
        return UIGraphicsImageRenderer(size: size).image { _ in
            color.setFill()
            let h = size.height / CGFloat(n * 2 - 1)
            let side = size.width
            for (i, b) in bits.enumerated() {
                let y = size.height - h * CGFloat(i * 2 + 1)
                if b == "1" {
                    UIBezierPath(roundedRect: CGRect(x: 0, y: y, width: side, height: h), cornerRadius: h * 0.25).fill()
                } else {
                    let w = side * 0.42
                    UIBezierPath(roundedRect: CGRect(x: 0, y: y, width: w, height: h), cornerRadius: h * 0.25).fill()
                    UIBezierPath(roundedRect: CGRect(x: side - w, y: y, width: w, height: h), cornerRadius: h * 0.25).fill()
                }
            }
        }
    }
}

extension UIFont {
    /// 同字号的圆体(数字用)
    var rounded: UIFont {
        guard let d = fontDescriptor.withDesign(.rounded) else { return self }
        return UIFont(descriptor: d, size: pointSize)
    }
}



