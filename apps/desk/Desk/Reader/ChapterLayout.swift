import UIKit

extension NSAttributedString.Key {
    /// 这段文字属于第几段(0 起);章题等不属于任何段的为 -1。续读、划线都靠它把屏上的字对回段号。
    static let deskSeg = NSAttributedString.Key("desk.seg")
    /// 带注释的字词:值是 "段下标:注释下标"。
    static let deskNote = NSAttributedString.Key("desk.note")
    /// 展开的译文段:值是底色框底边在末行字下面留出的高度。
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
    /// 显示用的单页文本框(ColumnTextView)只装这一栏的字;判断「划线 / 译文块是不是在这里收尾」要回到整章的 storage 看。
    /// source 是整章的 storage,sourceOffset 是本栏第一个字在整章里的下标;为 nil 时就是整章自己。
    weak var source: NSTextStorage?
    var sourceOffset = 0

    /// 本地下标 i 处某属性在整章里的完整范围(换回本地下标;可能超出本地 storage 的两头)。
    private func fullRange(_ key: NSAttributedString.Key, at i: Int, local ts: NSTextStorage) -> NSRange {
        var r = NSRange()
        if let src = source, sourceOffset + i < src.length {
            _ = src.attribute(key, at: sourceOffset + i, longestEffectiveRange: &r, in: NSRange(location: 0, length: src.length))
            r.location -= sourceOffset
        } else {
            _ = ts.attribute(key, at: i, longestEffectiveRange: &r, in: NSRange(location: 0, length: ts.length))
        }
        return r
    }

    /// 只在这几个字上画底色(本地下标);单栏文本框里扩出来的上下文不画。nil 不限。
    var drawLimit: NSRange?

    override func drawBackground(forGlyphRange shown: NSRange, at origin: CGPoint) {
        super.drawBackground(forGlyphRange: shown, at: origin)
        guard let ts = textStorage else { return }
        var chars = characterRange(forGlyphRange: shown, actualGlyphRange: nil)
        var glyphsToShow = shown
        if let lim = drawLimit {
            chars = NSIntersectionRange(chars, lim)
            guard chars.length > 0 else { return }
            glyphsToShow = glyphRange(forCharacterRange: chars, actualCharacterRange: nil)
        }
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
        for b in transBoxes(ts, chars: chars, glyphsToShow: glyphsToShow) {
            let box = b.offsetBy(dx: origin.x, dy: origin.y)
            tint.withAlphaComponent(0.09).setFill()
            UIBezierPath(roundedRect: box, cornerRadius: 12).fill()
            tint.withAlphaComponent(0.75).setFill()
            UIBezierPath(roundedRect: CGRect(x: box.minX, y: box.minY + 10, width: 3.5, height: max(box.height - 20, 4)), cornerRadius: 2).fill()
        }
    }

    /// 展开译文的底色框(容器坐标,未加 origin)。chars / glyphsToShow:这次要画的字与字形。
    func transBoxes(_ ts: NSTextStorage, chars: NSRange, glyphsToShow: NSRange) -> [CGRect] {
        var out: [CGRect] = []
        ts.enumerateAttribute(.deskTrans, in: chars) { v, r, _ in
            guard let pad = v as? CGFloat else { return }
            let g = NSIntersectionRange(glyphRange(forCharacterRange: r, actualCharacterRange: nil), glyphsToShow)
            guard g.length > 0 else { return }
            var box = CGRect.null
            var lastUsed = CGRect.null
            enumerateLineFragments(forGlyphRange: g) { lf, used, _, _, _ in box = box.union(lf); lastUsed = used }
            guard !box.isNull else { return }
            // 只有译文真在这一栏收尾,底边才落在末行字下 pad 处;跨到下一栏的,这一栏照行框画满
            let endsHere = NSMaxRange(g) == NSMaxRange(self.glyphRange(forCharacterRange: r, actualCharacterRange: nil))
                && NSMaxRange(self.fullRange(.deskTrans, at: r.location, local: ts)) <= NSMaxRange(r)
            // 底边从末行的字(usedRect)往下量,不从行框往上扣段后留白:排版器在两种情况下不给末行带段后留白——
            // 文字流的最后一段(单栏文本框装的字正好止于这段译文),和栏底放不下留白时。照「行框 − 留白」扣,末行就被扣掉了。
            if endsHere, !lastUsed.isNull { box.size.height = lastUsed.maxY + pad - box.minY }
            out.append(box)
        }
        return out
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
            let tail = fullRange(.deskHL, at: NSMaxRange(r) - 1, local: ts)       // 跨栏的划线,标记画在它真正收尾的那一栏
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
            if lastChar < ts.length, [10, 0x2028].contains((ts.string as NSString).character(at: lastChar)) { s.length -= 1 }      // 换行、韵文断行符不算
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
    var face: ReadingFont = .song       // 正文字体(题名、爻题见 ReadingFont.uiBold)
    var showTranslation = false       // 全部展开译文
    var revealed: Set<Int> = []       // 单独点开译文的段
    var bookID = ""
    var template = ""                 // duanzhang 短章 · yulu 语录 · gua 卦 · pianzhang 篇章
    var verse = false                 // 韵文书:原文按句读断行、居中排(只有部分章是韵文的书看 chapter.verse)
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
@MainActor
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
        // 一遍走完:每接上一栏就看它和上一栏的栏缝,要截就把上一栏按截短的高度重排,再往下接(长章不再整章反复重排)
        paginate(colSize)
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
    /// 每段每层正文在 storage 里的范围:键 "o3" / "t3"。韵文段的范围里夹着排版插进去的断行符(U+2028),见 seps。
    private var layerRanges: [String: NSRange] = [:]
    /// 韵文段里断行符在该层范围内的位置(相对范围起点,utf16,升序)。没有断行的层不在表里。
    private var seps: [String: [Int]] = [:]

    /// 该层正文第 u 个 utf16 位置在 storage 范围里的相对位置。end:区间的末端(断行符不算进前一行)。
    private func local(_ key: String, _ u: Int, end: Bool) -> Int {
        guard let l = seps[key] else { return u }
        var shift = 0
        for (j, p) in l.enumerated() { let b = p - j; if end ? b < u : b <= u { shift += 1 } else { break } }
        return u + shift
    }
    /// storage 范围里的相对位置 → 正文的 utf16 位置(扣掉之前的断行符)。
    private func textU16(_ key: String, _ loc: Int) -> Int {
        guard let l = seps[key] else { return loc }
        return loc - l.filter { $0 < loc }.count
    }
    /// 每段第一个字(含前缀)在 storage 里的下标。
    private var segStart: [Int: Int] = [:]

    private func indexLayers() {
        let all = NSRange(location: 0, length: storage.length)
        storage.enumerateAttribute(.deskLayer, in: all) { v, r, _ in
            guard let l = v as? String, let s = storage.attribute(.deskSeg, at: r.location, effectiveRange: nil) as? Int else { return }
            layerRanges["\(l)\(s)"] = r
            let sub = (storage.string as NSString).substring(with: r) as NSString
            var at: [Int] = []
            for i in 0..<sub.length where sub.character(at: i) == 0x2028 { at.append(i) }
            if !at.isEmpty { seps["\(l)\(s)"] = at }
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
            let key = "\(l)\(seg)"
            let a = text.charOffset(utf16: textU16(key, r.location - lr.location)), b = text.charOffset(utf16: textU16(key, NSMaxRange(r) - lr.location))
            guard b > a, let t = text.chars(a, b), !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
            // 同一段同一层被注释词等切成几截的,并成一条
            if let last = out.last, last.seg == seg, last.layer == l, last.end == a { out[out.count - 1].end = b; out[out.count - 1].text += t }
            else { out.append(HLPiece(seg: seg, layer: l, start: a, end: b, text: t)) }
        }
        return out
    }

    /// 某段某层第 start…end 个字在 storage 里的范围。
    func range(seg: Int, layer: String, start: Int, end: Int) -> NSRange? {
        let key = "\(layer)\(seg)"
        guard let lr = layerRanges[key], let text = chapter.text(seg: seg, layer: layer) else { return nil }
        let a = local(key, text.utf16Offset(char: start), end: false), b = local(key, text.utf16Offset(char: end), end: true)
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
        for v in liveViews.allObjects { v.copyHighlights(from: storage, styles: styles) }
    }

    // MARK: 显示用的文本框

    /// 屏上正在显示的各栏文本框(弱引用):改划线、闪动时同步给它们。
    private let liveViews = NSHashTable<ColumnTextView>.weakObjects()

    /// 第 i 栏(容器下标)显示用的文本框:自己一份 storage + 自己的排版器 + 一个容器。
    /// 不直接显示分页用的那些文本框——UIKit 的选字只认「一个排版器只接一个容器」的文本框,
    /// 共用一个排版器、接了多个容器的文本框长按选不了字(真机上连第一页也不行)。
    /// 独立 storage 装的是「本栏的字向两头扩到整段」:断行、标点挤压都要看整段上下文(栏首若是接着上一栏的半段,
    /// 只拿后半段重排,「：「」这类相邻标点不再挤压,一行会少排一个字)。扩出来的上下文排在可见区之外,
    /// 由外面一层裁切框(ColumnClipView)挡住;纵向按整章排版里本栏第一行的位置对齐。DEBUG 下可逐行核对(DESK_VERIFY=1)。
    ///
    /// 例外:栏首若是接着上一栏的半段、而这一行以「这类前括号起头,整章分页在新容器的首行会按段首那样挤压括号,
    /// 比连着排多排进一两个字;带上半段上下文重排反而少排,往后的行跟着错位,挤不回来就多出一行、栏底末行被裁切框切掉(长译文跨栏时最常见)。
    /// 所以两种排法都试:先带整段上下文,逐行与整章分页对不上就改从本栏第一个字起排,取逐行一致的那一种。
    func makeColumnView(_ i: Int) -> ColumnTextView {
        let chars = manager.characterRange(forGlyphRange: manager.glyphRange(for: containers[i]), actualGlyphRange: nil)
        let ns = storage.string as NSString
        let head = ns.paragraphRange(for: NSRange(location: chars.location, length: 0))
        var v = columnView(i, from: head.location)
        if head.location < chars.location, !linesMatch(column: i, view: v) {
            let alt = columnView(i, from: chars.location)
            if linesMatch(column: i, view: alt) { v = alt }
        }
        #if DEBUG
        if ProcessInfo.processInfo.environment["DESK_VERIFY"] == "1" { verify(column: i, view: v) }
        #endif
        liveViews.add(v)
        return v
    }

    /// 第 i 栏的显示文本框,storage 从整章第 start 个字起、到本栏末字所在段的段尾止。
    func columnView(_ i: Int, from start: Int) -> ColumnTextView {
        let c = containers[i]
        let chars = manager.characterRange(forGlyphRange: manager.glyphRange(for: c), actualGlyphRange: nil)
        let ns = storage.string as NSString
        let tail = ns.paragraphRange(for: NSRange(location: max(NSMaxRange(chars) - 1, chars.location), length: 0))
        let span = NSRange(location: start, length: max(NSMaxRange(tail), NSMaxRange(chars)) - start)
        let sub = NSMutableAttributedString(attributedString: storage.attributedSubstring(from: span))
        let visible = NSRange(location: chars.location - span.location, length: chars.length)
        sub.removeAttribute(.link, range: NSRange(location: 0, length: sub.length))      // 见 typeset:显示时不要系统链接
        // 上下文只占位、不显示:字透明,去掉注释词的点线(下划线另有颜色,字透明了它还在)
        for r in [NSRange(location: 0, length: visible.location), NSRange(location: NSMaxRange(visible), length: sub.length - NSMaxRange(visible))] where r.length > 0 {
            sub.removeAttribute(.underlineStyle, range: r)
            sub.addAttribute(.foregroundColor, value: UIColor.clear, range: r)
        }
        let v = ColumnTextView(text: sub, offset: span.location, visible: visible, source: storage, width: c.size.width, tint: accent)
        v.layoutManagerD.hlStyle = manager.hlStyle
        // 纵向对齐:整章排版里本栏第一行的上沿 − 独立排版里同一行的上沿
        if chars.length > 0 {
            let sharedTop = manager.lineFragmentRect(forGlyphAt: manager.glyphRange(for: c).location, effectiveRange: nil).minY
            let lg = v.layoutManagerD.glyphIndexForCharacter(at: visible.location)
            v.dy = sharedTop - v.layoutManagerD.lineFragmentRect(forGlyphAt: lg, effectiveRange: nil).minY
        }
        return v
    }

    /// 显示文本框里本栏的各行,与整章分页第 i 栏逐行的字范围是否一样。
    func linesMatch(column i: Int, view v: ColumnTextView) -> Bool {
        var shared: [NSRange] = []
        manager.enumerateLineFragments(forGlyphRange: manager.glyphRange(for: containers[i])) { _, _, _, g, _ in
            shared.append(self.manager.characterRange(forGlyphRange: g, actualGlyphRange: nil))
        }
        let lm = v.layoutManagerD
        var local: [NSRange] = []
        lm.enumerateLineFragments(forGlyphRange: lm.glyphRange(forCharacterRange: v.visible, actualCharacterRange: nil)) { _, _, _, g, _ in
            var r = lm.characterRange(forGlyphRange: g, actualGlyphRange: nil); r.location += v.offset; local.append(r)
        }
        return shared == local
    }

    #if DEBUG
    /// 逐行核对独立排版与整章分页:本栏每一行的字范围、纵向位置都要一样。不一样就打日志。
    func verify(column i: Int, view v: ColumnTextView) {
        let c = containers[i]
        var shared: [(NSRange, CGFloat)] = []
        manager.enumerateLineFragments(forGlyphRange: manager.glyphRange(for: c)) { r, _, _, g, _ in
            shared.append((self.manager.characterRange(forGlyphRange: g, actualGlyphRange: nil), r.minY))
        }
        let lm = v.layoutManagerD
        var local: [(NSRange, CGFloat)] = []
        lm.enumerateLineFragments(forGlyphRange: lm.glyphRange(forCharacterRange: v.visible, actualCharacterRange: nil)) { r, _, _, g, _ in
            var cr = lm.characterRange(forGlyphRange: g, actualGlyphRange: nil); cr.location += v.offset
            local.append((cr, r.minY + v.dy))
        }
        var bad = shared.count != local.count ? 1 : 0
        var first = ""
        for (a, b) in zip(shared, local) {
            let same = a.0 == b.0 && abs(a.1 - b.1) <= 0.5
            if !same {
                bad += 1
                if first.isEmpty {
                    let ns = storage.string as NSString
                    first = "\(a.0)@\(a.1) vs \(b.0)@\(b.1) shared=[\(ns.substring(with: a.0))] local=[\(ns.substring(with: b.0))]"
                }
            }
        }
        DeskVerify.record(ok: bad == 0)
        if bad > 0 {
            NSLog("DESKVERIFY ch=%d col=%d lines %d/%d mismatch=%d first=%@", chapter.no, i, shared.count, local.count, bad, first)
        }
    }
    #endif

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
        for v in liveViews.allObjects { v.layoutManagerD.flashRange = NSRange(location: r.location - v.offset, length: r.length) }
        let t0 = Date()
        let dur = 1.3
        flashTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] t in
            guard let self else { t.invalidate(); return }
            let x = Date().timeIntervalSince(t0) / dur
            let views = self.liveViews.allObjects
            if x >= 1 {
                t.invalidate(); self.manager.flashAlpha = 0; self.manager.flashRange = nil
                for v in views { v.layoutManagerD.flashAlpha = 0; v.layoutManagerD.flashRange = nil }
            } else {
                self.manager.flashAlpha = CGFloat(sin(x * .pi * 4 - .pi / 2) * 0.5 + 0.5) * 0.4   // 两起两落
                for v in views { v.layoutManagerD.flashAlpha = self.manager.flashAlpha }
            }
            self.manager.invalidateDisplay(forCharacterRange: r)
            for v in views { v.layoutManagerD.invalidateDisplay(forCharacterRange: NSRange(location: 0, length: v.textStorage.length)) }
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
        // 撤掉最后一栏(栏缝要截时,连上一栏一起撤掉重排)
        func popLast() {
            manager.removeTextContainer(at: manager.textContainers.count - 1)
            containers.removeLast(); textViews.removeLast().removeFromSuperview(); colFirstSeg.removeLast()
            laid = containers.last.map { NSMaxRange(manager.glyphRange(for: $0)) } ?? 0
        }
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
            let p = containers.count - 2
            if p >= 0, cuts[p] == nil, let h = straddle(pageSize, at: p) {
                cuts[p] = h
                popLast(); popLast()        // 下一圈按截短的高度重排第 p 栏
            }
        }
    }

    /// 第 p 栏与第 p+1 栏之间的栏缝:同一段被切开且这段不长(或诗题落在栏底),返回第 p 栏该截到的高度(这一段的上沿);不用截返回 nil。
    private func straddle(_ pageSize: CGSize, at p: Int) -> CGFloat? {
        for p in [p] {
            let a = manager.glyphRange(for: containers[p]), b = manager.glyphRange(for: containers[p + 1])
            guard a.length > 0, b.length > 0 else { continue }
            let lastChar = manager.characterIndexForGlyph(at: NSMaxRange(a) - 1)
            let nextChar = manager.characterIndexForGlyph(at: b.location)
            var range = NSRange()
            guard let s1 = storage.attribute(.deskSeg, at: lastChar, longestEffectiveRange: &range, in: NSRange(location: 0, length: storage.length)) as? Int,
                  s1 >= 0 else { continue }
            // 诗题落在栏底、诗在下一栏:题目跟着诗走
            if !NSLocationInRange(nextChar, range), chapter.segs.indices.contains(s1), chapter.segs[s1].kind == "title" {
                let g = manager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
                guard g.location > a.location else { continue }
                let top = manager.lineFragmentRect(forGlyphAt: g.location, effectiveRange: nil).minY
                if top > pageSize.height * 0.25 { return ceil(top) + 1 }
                continue
            }
            guard NSLocationInRange(nextChar, range) else { continue }
            let g = manager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
            guard g.location > a.location else { continue }             // 这一段从页首就开始了,本身比一页长,拆是应该的
            var top = manager.lineFragmentRect(forGlyphAt: g.location, effectiveRange: nil).minY
            // 这一段前面紧挨着诗题、诗题也在本栏:截在诗题上沿,题目随诗一起挪到下一栏
            if s1 > 0, chapter.segs.indices.contains(s1 - 1), chapter.segs[s1 - 1].kind == "title", range.location > 0 {
                var tr = NSRange()
                if storage.attribute(.deskSeg, at: range.location - 1, longestEffectiveRange: &tr, in: NSRange(location: 0, length: storage.length)) as? Int == s1 - 1 {
                    let tg = manager.glyphRange(forCharacterRange: tr, actualCharacterRange: nil)
                    if tg.location > a.location { top = manager.lineFragmentRect(forGlyphAt: tg.location, effectiveRange: nil).minY }
                }
            }
            let h1 = manager.boundingRect(forGlyphRange: NSIntersectionRange(g, a), in: containers[p]).height
            let h2 = manager.boundingRect(forGlyphRange: NSIntersectionRange(g, b), in: containers[p + 1]).height
            if top > pageSize.height * 0.25, h1 + h2 <= pageSize.height * 0.7 { return ceil(top) + 1 }   // 向上取整再留一点:取小了上一段的最后一行也会被挤走
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

    /// 某个字上的注释(.deskNote 的值是「段:注」)。
    func note(atCharacter i: Int) -> Note? {
        guard i >= 0, i < storage.length, let k = storage.attribute(.deskNote, at: i, effectiveRange: nil) as? String else { return nil }
        let parts = k.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, chapter.segs.indices.contains(parts[0]), let ns = chapter.segs[parts[0]].n, ns.indices.contains(parts[1]) else { return nil }
        return ns[parts[1]]
    }

    func note(for url: URL) -> Note? {
        guard url.scheme == "desk-note" else { return nil }
        let parts = url.pathComponents.compactMap { Int($0) }
        guard parts.count == 2, chapter.segs.indices.contains(parts[0]), let ns = chapter.segs[parts[0]].n, ns.indices.contains(parts[1]) else { return nil }
        return ns[parts[1]]
    }

    /// 韵文断行点(utf16 下标,在这个位置之前插断行):句读 ，。；！？ 之后;紧跟的后引号、括号随前一行;段尾不断。
    static func verseBreaks(_ o: String) -> [Int] {
        let ns = o as NSString
        let stops: Set<unichar> = [0xFF0C, 0x3002, 0xFF1B, 0xFF01, 0xFF1F]                 // ，。；！？
        let closers: Set<unichar> = [0x300D, 0x300F, 0x201D, 0x2019, 0xFF09, 0x300B, 0x3011]   // 」』”’）》】
        var out: [Int] = []
        var i = 0
        while i < ns.length {
            if stops.contains(ns.character(at: i)) {
                var j = i + 1
                while j < ns.length, closers.contains(ns.character(at: j)) { j += 1 }
                if j < ns.length { out.append(j) }
                i = j
            } else { i += 1 }
        }
        return out
    }

    @MainActor static func typeset(_ ch: Chapter, unit: String, style: ReaderStyle) -> NSAttributedString {
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
            let titleFont = style.face.uiBold(style.fontSize * 1.5)
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
        let verse = style.verse || (ch.verse ?? false)
        for (i, s) in ch.segs.enumerated() {
            let block = NSMutableAttributedString()
            let open = (style.showTranslation || style.revealed.contains(i)) && !(s.t ?? "").isEmpty
            let os = NSMutableParagraphStyle()
            os.lineSpacing = style.fontSize * 0.5
            os.paragraphSpacing = open ? style.fontSize * 0.45 : gap
            // 爻题(初九、六二…用九)排在爻辞前面,用主题色;彖、象的原文自带「彖曰」「象曰」,不另标
            // 语录体(论语)每条前面标条号,小一号、主题色,方便「某篇第几条」这样指认
            let isLine = s.line != nil && s.label != nil && s.label != "象"
            let isTitle = s.kind == "title"          // 诗题(《关雎》):章内小标题
            let tag = isLine || isTitle ? (isLine ? s.label! + "　" : "") : (style.template == "yulu" ? "\(i + 1)  " : "")
            // 韵文:逢 ，。；！？ 断行(与网站同一套句读),行间插 U+2028——同一段落内换行,不另起段,
            // 「一段尽量不拆两栏」照旧按段算;原文层的偏移靠 seps 扣回去,划线、注释坐标不变
            let breaks = verse && !isTitle ? Self.verseBreaks(s.o) : []
            var shown = s.o
            for b in breaks.reversed() { shown = (shown as NSString).replacingCharacters(in: NSRange(location: b, length: 0), with: "\u{2028}") }
            let shift: (Int, Bool) -> Int = { u, end in u + breaks.filter { end ? $0 < u : $0 <= u }.count }
            if verse && !isTitle {
                os.alignment = .center
                os.lineSpacing = style.fontSize * 0.42
            }
            if isTitle {
                os.alignment = verse ? .center : .natural
                os.paragraphSpacingBefore = i == 0 ? 0 : style.fontSize * 0.9
                os.paragraphSpacing = open ? style.fontSize * 0.45 : style.fontSize * 0.55
            }
            // 书包典籍的段名(label):原文上方一行小字,主题色;不进原文层,划线偏移不受影响
            if style.template == "deskbook", !isLine, let l = s.label, !l.isEmpty {
                let ls = NSMutableParagraphStyle(); ls.paragraphSpacing = style.fontSize * 0.2
                block.append(NSAttributedString(string: l + "\n", attributes: [
                    .font: UIFont.systemFont(ofSize: max(12, style.fontSize * 0.52), weight: .semibold), .foregroundColor: style.accent,
                    .kern: 2, .paragraphStyle: ls, .deskSeg: i]))
            }
            let para = NSMutableAttributedString(string: tag + shown + "\n", attributes: [
                .font: isTitle ? style.face.uiBold(style.fontSize * 1.08) : style.face.ui(style.fontSize),
                .foregroundColor: isTitle ? style.accent : style.text, .paragraphStyle: os, .kern: isTitle ? 2 : 0.6, .deskSeg: i])
            let lead = (tag as NSString).length
            para.addAttribute(.deskLayer, value: "o", range: NSRange(location: lead, length: (shown as NSString).length))
            if lead > 0, isLine {
                para.addAttributes([.font: style.face.uiBold(style.fontSize), .foregroundColor: style.accent], range: NSRange(location: 0, length: lead))
            } else if lead > 0 {
                para.addAttributes([.font: UIFont.systemFont(ofSize: style.fontSize * 0.5, weight: .semibold).rounded, .foregroundColor: style.accent,
                                    .baselineOffset: style.fontSize * 0.28, .kern: 0], range: NSRange(location: 0, length: lead))
            }
            for (j, n) in (s.n ?? []).enumerated() {
                var r = (s.o as NSString).range(of: n.k)
                guard r.location != NSNotFound else { continue }
                let e = shift(NSMaxRange(r), true)
                r.location = shift(r.location, false)
                r.length = e - r.location
                r.location += lead
                // 带注释的字词:主题色点线下划线 + 系统「链接」属性。链接属性只留在整章分页用的 storage 里——
                // 分页一直是带着它算的(带不带它,UIKit 往一页里装的行数不一样),去掉会让各章页数变;
                // 显示用的单栏文本框(ColumnTextView)里去掉它:长按链接会弹链接预览、选不了字,出注由页面的轻点手势按 .deskNote 判断
                para.addAttributes([.deskNote: "\(i):\(j)", .link: URL(string: "desk-note://n/\(i)/\(j)")!,
                                    .underlineStyle: NSUnderlineStyle.single.rawValue | NSUnderlineStyle.patternDot.rawValue,
                                    .underlineColor: style.accent], range: r)
            }
            // 词的换片处原文是两个全角空格(「愁苦。　　问院落」):断行后它们落在行首、把那一行顶偏,排成近乎零宽(字还在,偏移不变)
            if verse, !breaks.isEmpty {
                let ps = para.string as NSString
                for b in breaks {
                    var j = lead + shift(b, false)
                    while j < ps.length, ps.character(at: j) == 0x3000 { para.addAttribute(.font, value: UIFont.systemFont(ofSize: 1), range: NSRange(location: j, length: 1)); j += 1 }
                }
            }
            block.append(para)
            if open, let t = s.t {
                let tb = NSMutableAttributedString(string: t + "\n", attributes: [
                    .font: UIFont.systemFont(ofSize: max(15, style.fontSize * 0.62)), .foregroundColor: style.soft, .paragraphStyle: tsy, .deskSeg: i, .deskTrans: CGFloat(12)])   // 与段前留白相当
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


/// 一栏正文的显示文本框:自己一份 storage / 排版器 / 容器(见 ChapterLayout.makeColumnView)。
/// storage 装的是本栏的字扩到整段;offset 是它第一个字在整章 storage 里的下标——点按、选字拿到的本地下标加上它,
/// 就是整章坐标(段号、划线偏移照旧)。visible 是本栏真正显示的那几个字(本地下标)。
/// dy:与整章分页结果对齐的纵向偏移;文本框放在 ColumnClipView 里,frame.y = dy,上下文排在裁切框外。
final class ColumnTextView: TightTextView {
    let offset: Int
    let visible: NSRange
    var dy: CGFloat = 0
    let layoutManagerD: DeskLayoutManager
    /// 整段排完的高度(文本框按它定高)。
    private(set) var fullHeight: CGFloat = 0

    init(text: NSAttributedString, offset: Int, visible: NSRange, source: NSTextStorage, width: CGFloat, tint: UIColor) {
        self.offset = offset
        self.visible = visible
        let st = NSTextStorage(attributedString: text)
        let lm = DeskLayoutManager()
        lm.tint = tint
        lm.source = source
        lm.sourceOffset = offset
        lm.drawLimit = visible
        st.addLayoutManager(lm)
        let big: CGFloat = 1_000_000
        let c = NSTextContainer(size: CGSize(width: width, height: big))
        c.lineFragmentPadding = 0
        lm.addTextContainer(c)
        layoutManagerD = lm
        lm.ensureLayout(for: c)
        let h = ceil(lm.usedRect(for: c).height) + 40
        super.init(frame: CGRect(x: 0, y: 0, width: width, height: h), textContainer: c)
        isEditable = false
        isScrollEnabled = false
        isSelectable = true
        backgroundColor = .clear
        textContainerInset = .zero
        contentInsetAdjustmentBehavior = .never
        tintColor = tint
        // 注释词的样子:字色不变,只在下面加一道主题色的点线
        linkTextAttributes = [.foregroundColor: UIColor.inkText,
                              .underlineStyle: NSUnderlineStyle.single.rawValue | NSUnderlineStyle.patternDot.rawValue,
                              .underlineColor: tint]
        c.size = CGSize(width: width, height: big)      // 文本框会把自己的大小写回容器;容器保持够高,整段都排得下
        fullHeight = h
    }
    required init?(coder: NSCoder) { fatalError() }

    /// 选区只留在本栏看得见的字里(拖柄拖出裁切框,不让选到上下文里去)。
    func clampSelection() {
        let r = selectedRange
        guard r.length > 0 else { return }
        let c = NSIntersectionRange(r, visible)
        if c != r { selectedRange = c.length > 0 ? c : NSRange(location: visible.location, length: 0) }
    }

    /// 整章 storage 的划线属性抄到本栏。
    func copyHighlights(from src: NSTextStorage, styles: [String: (color: Int, note: Bool)]) {
        let all = NSRange(location: 0, length: textStorage.length)
        textStorage.beginEditing()
        textStorage.removeAttribute(.deskHL, range: all)
        let r = NSIntersectionRange(NSRange(location: offset, length: textStorage.length), NSRange(location: 0, length: src.length))
        src.enumerateAttribute(.deskHL, in: r) { v, rr, _ in
            guard let id = v else { return }
            textStorage.addAttribute(.deskHL, value: id, range: NSRange(location: rr.location - offset, length: rr.length))
        }
        textStorage.endEditing()
        layoutManagerD.hlStyle = styles
        layoutManagerD.invalidateDisplay(forCharacterRange: all)
    }
}

/// 一栏的裁切框:栏那么大,把扩出来的上下文(上一栏 / 下一栏的字)挡在外面,也不让点按落到它们上。
final class ColumnClipView: UIView {
    /// 上下各多露一点:选字的拖柄圆头在首行之上,贴边裁会被切掉半个。上下文的字是透明的,露出来也看不见。
    static let margin: CGFloat = 12
    let text: ColumnTextView
    init(_ t: ColumnTextView) {
        text = t
        super.init(frame: .zero)
        clipsToBounds = true
        backgroundColor = .clear
        addSubview(t)
    }
    required init?(coder: NSCoder) { fatalError() }
    override func layoutSubviews() {
        super.layoutSubviews()
        text.frame = CGRect(x: 0, y: text.dy + Self.margin, width: bounds.width, height: text.fullHeight)
    }
}

#if DEBUG
/// DESK_VERIFY=1 时累计核对结果,日志里一行汇总。
enum DeskVerify {
    static var ok = 0, bad = 0
    static func record(ok good: Bool) {
        if good { ok += 1 } else { bad += 1 }
        if (ok + bad) % 20 == 0 { NSLog("DESKVERIFY total ok=%d bad=%d", ok, bad) }
    }
}
#endif
