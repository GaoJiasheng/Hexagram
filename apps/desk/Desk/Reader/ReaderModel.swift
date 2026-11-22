import UIKit
import Observation

/// 阅读器里的一页:第几章(书内序号)、章内第几页。每章最后多一页「章末页」。
struct PageRef: Hashable {
    var ch: Int
    var page: Int
}

/// 章内一处字:第几章、第几段、哪一层、第几到第几个字(字符数)。跳转、闪动用。
struct Spot: Hashable {
    var ch: Int
    var seg: Int
    var layer: String
    var start: Int
    var end: Int
}

@MainActor
@Observable
final class ReaderModel {
    let book: BookInfo
    let pack: BookPack
    var current: PageRef
    var showTranslation = false
    var fontSize: CGFloat = 22
    @ObservationIgnored private var revealed: [Int: Set<Int>] = [:]   // 章 → 点开了译文的段
    var layoutVersion = 0
    private(set) var pageSize: CGSize = .zero       // 整页正文区(双栏时含中缝)
    private(set) var columns = 1                      // iPad 横屏 2 栏,其余 1 栏
    @ObservationIgnored private var layouts: [Int: ChapterLayout] = [:]
    @ObservationIgnored private var anchorSeg = 0
    /// 「回到原处」:从查本书跳走前的位置(章、页、页首段、当时那一章的排版对象)。翻几页后自己消失。
    private(set) var returnPoint: PageRef?
    @ObservationIgnored private var returnSeg = 0
    @ObservationIgnored private weak var returnLayout: ChapterLayout?
    @ObservationIgnored private var turnsSinceJump = 0
    /// 打开时要先跳到的地方(从别的书的查本书结果点进来)。第一次排好版后执行。
    @ObservationIgnored var initialSpot: Spot?
    /// 学习时长时钟(见 ReadClock);字数:一页显示满 3 秒才计。
    @ObservationIgnored let clock = ReadClock()
    @ObservationIgnored private var dwell: DispatchWorkItem?
    @ObservationIgnored private(set) var active = false

    init(book: BookInfo, pack: BookPack, start: ReadPos?, reveal: Set<Int> = []) {
        self.book = book
        self.pack = pack
        let ch = min(max(start?.ch ?? 1, 1), pack.chapters.count)
        if !reveal.isEmpty { revealed[ch] = reveal }
        current = PageRef(ch: ch, page: 0)
        anchorSeg = start?.seg ?? 0
    }

    var style: ReaderStyle {
        var s = ReaderStyle()
        s.showTranslation = showTranslation
        s.fontSize = fontSize
        s.bookID = book.id
        s.template = book.template
        s.accent = book.theme.accentUI
        return s
    }

    func chapter(_ no: Int) -> Chapter { pack.chapters[no - 1] }

    /// 页角水印:卦用卦名,十翼的篇章不放,其余用章号。
    func watermark(_ no: Int) -> String {
        let c = chapter(no)
        if let g = c.gua { return g.name }
        return c.kind == "text" ? "" : Numerals.chinese(no)
    }

    /// 页脚那一行:「道德经 · 第八章」「周易 · 乾为天」「周易 · 系辞上 · 第一章」
    func caption(_ no: Int) -> String {
        let c = chapter(no)
        if c.gua != nil || c.kind == "text" { return "\(book.title) · \(c.title)" }
        return "\(book.title) · 第 \(Numerals.chinese(no)) \(book.unit)"
    }

    func layout(_ ch: Int) -> ChapterLayout {
        if let l = layouts[ch] { return l }
        var st = style
        st.revealed = revealed[ch] ?? []
        let l = ChapterLayout(chapter: chapter(ch), unit: book.unit, pageSize: pageSize, columns: columns, style: st,
                              highlights: HighlightStore.shared.inChapter(book: book.id, no: ch))
        layouts[ch] = l
        if layouts.count > 6 { for k in layouts.keys where abs(k - current.ch) > 2 { layouts[k] = nil } }
        return l
    }

    /// 正文页数 + 1 张章末页
    func pageCount(_ ch: Int) -> Int { layout(ch).pageCount + 1 }
    func isEndPage(_ r: PageRef) -> Bool { r.page >= layout(r.ch).pageCount }
    var isEndPageSafe: Bool { pageSize != .zero && isEndPage(current) }

    func after(_ r: PageRef) -> PageRef? {
        if r.page + 1 < pageCount(r.ch) { return PageRef(ch: r.ch, page: r.page + 1) }
        return r.ch < pack.chapters.count ? PageRef(ch: r.ch + 1, page: 0) : nil
    }

    func before(_ r: PageRef) -> PageRef? {
        if r.page > 0 { return PageRef(ch: r.ch, page: r.page - 1) }
        return r.ch > 1 ? PageRef(ch: r.ch - 1, page: pageCount(r.ch - 1) - 1) : nil
    }

    /// 页面大小、栏数(转屏)或「显示译文」变了:重排,落回原来那一段。
    func relayout(size: CGSize, fontSize: CGFloat, columns: Int = 1) {
        guard size.width > 50, size.height > 50 else { return }
        if size == pageSize && fontSize == self.fontSize && columns == self.columns && !layouts.isEmpty { return }
        pageSize = size
        self.fontSize = fontSize
        self.columns = columns
        rebuild()
    }

    func toggleTranslation() { showTranslation.toggle(); revealed.removeAll(); rebuild() }

    /// 轻点一段:展开 / 收起这一段的译文。留在这一段所在的页。
    func toggle(seg: Int, inChapter ch: Int) {
        guard !showTranslation, !(chapter(ch).segs[seg].t ?? "").isEmpty else { return }
        var s = revealed[ch] ?? []
        if s.contains(seg) { s.remove(seg) } else { s.insert(seg) }
        revealed[ch] = s
        anchorSeg = seg
        rebuild()
    }

    private func rebuild() {
        guard pageSize != .zero else { return }
        layouts.removeAll()
        current = PageRef(ch: current.ch, page: layout(current.ch).page(forSeg: anchorSeg))
        layoutVersion += 1
        remember()   // 一打开就算读到这里
        if let s = initialSpot { initialSpot = nil; go(to: s) }
        #if DEBUG
        if ProcessInfo.processInfo.environment["DESK_PAGES"] == "1" {
            let l = layout(current.ch)
            NSLog("DESKPAGES firstSeg=%@ pageForSeg=%@ landed=%d", "\(l.firstSeg)", "\((0..<chapter(current.ch).segs.count).map { l.page(forSeg: $0) })", current.page)
        }
        #endif
    }

    // MARK: 划线

    /// 划线记录改了:把已排好的各章重新画一遍(只改属性、不重新分页)。
    func syncHighlights() {
        for (ch, l) in layouts { l.applyHighlights(HighlightStore.shared.inChapter(book: book.id, no: ch)) }
    }

    @discardableResult
    func addHighlights(_ pieces: [HLPiece], inChapter ch: Int, color: Int, note: String? = nil) -> [Highlight] {
        HighlightStore.shared.add(book: book.id, chapter: chapter(ch), pieces: pieces, color: color, note: note)
    }

    /// 跳到某一处并让它闪两下。是译文层而那段译文没展开,先把它展开。
    /// keepReturn:记下现在的位置,阅读页左下角给「回到原处」。
    func go(to s: Spot, keepReturn: Bool = false) {
        guard pageSize != .zero, (1...pack.chapters.count).contains(s.ch) else { initialSpot = s; return }
        if keepReturn {
            returnPoint = current; returnSeg = anchorSeg; returnLayout = layouts[current.ch]; turnsSinceJump = 0
        }
        if s.layer == "t", !showTranslation, !(revealed[s.ch] ?? []).contains(s.seg), !(chapter(s.ch).text(seg: s.seg, layer: "t") ?? "").isEmpty {
            revealed[s.ch, default: []].insert(s.seg)
            layouts[s.ch] = nil
        }
        let l = layout(s.ch)
        let r = l.range(seg: s.seg, layer: s.layer, start: s.start, end: s.end)
        anchorSeg = s.seg
        current = PageRef(ch: s.ch, page: r.map { l.page(forCharacter: $0.location) } ?? l.page(forSeg: s.seg))
        layoutVersion += 1
        remember()
        if let r {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak l] in l?.flash(r) }
        }
    }

    func go(to h: Highlight) {
        let c = chapter(h.no)
        let p = c.locate(h) ?? (start: h.start, end: h.end)
        go(to: Spot(ch: h.no, seg: h.seg, layer: h.layer, start: p.start, end: p.end))
    }

    /// 回到查本书之前的那一页。那一章没重排过就回原页;重排过(展开了译文等)按页首段落回。
    func goBack() {
        guard let r = returnPoint else { return }
        returnPoint = nil
        anchorSeg = returnSeg
        if let l = layouts[r.ch], l === returnLayout { current = PageRef(ch: r.ch, page: min(r.page, l.pageCount)) }
        else { current = PageRef(ch: r.ch, page: layout(r.ch).page(forSeg: returnSeg)) }
        layoutVersion += 1
        remember()
    }

    func jump(toChapter ch: Int) {
        returnPoint = nil
        anchorSeg = 0
        current = PageRef(ch: ch, page: 0)
        layoutVersion += 1
        remember()
    }

    /// 翻到了某一页:记住位置(章 + 段),立即落盘。
    func landed(on r: PageRef) {
        current = r
        if !isEndPage(r) { anchorSeg = layout(r.ch).firstSeg[r.page] }
        if returnPoint != nil { turnsSinceJump += 1; if turnsSinceJump > 4 { returnPoint = nil } }
        remember()
    }

    private func remember() {
        ProgressStore.shared.set(book.id, ch: current.ch, seg: anchorSeg)
        if active { clock.start(chapter(current.ch).src); clock.touch(); armDwell() }
    }

    // MARK: 学习时长

    /// 阅读器到了前台、可见:开始计时(换章时 remember 里自动换段)。
    func resume() {
        active = true
        clock.start(chapter(current.ch).src)
        armDwell()
    }

    /// 退到后台、离开阅读器:结清。
    func pause(leaving: Bool = false) {
        active = false
        dwell?.cancel(); dwell = nil
        if leaving { clock.stop() } else { clock.settle() }
    }

    /// 点按、长按、开面板等操作。
    func touch() { if active { clock.touch() } }

    /// 当前这一页显示满 3 秒:把这页各段的原文字数计入当天(同一段一天只计一次)。
    private func armDwell() {
        dwell?.cancel()
        let r = current
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.active, self.current == r, self.pageSize != .zero, !self.isEndPage(r) else { return }
            let c = self.chapter(r.ch)
            let segs = self.layout(r.ch).segs(onPage: r.page).compactMap { i in c.segs[safe: i].map { (seg: i, chars: Self.charCount($0.o)) } }
            ReadDaysStore.shared.addChars(c.src, segs: segs)
        }
        dwell = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: item)
    }

    /// 原文字数:只数字,不数标点与空白。
    static func charCount(_ s: String) -> Int {
        s.unicodeScalars.reduce(0) { n, u in
            CharacterSet.punctuationCharacters.contains(u) || CharacterSet.symbols.contains(u) || CharacterSet.whitespacesAndNewlines.contains(u) ? n : n + 1
        }
    }

    /// 跳到另一台设备读到的那一处(章、段)。
    func jump(toChapter ch: Int, seg: Int) {
        guard (1...pack.chapters.count).contains(ch) else { return }
        returnPoint = nil
        anchorSeg = seg
        current = PageRef(ch: ch, page: pageSize == .zero ? 0 : layout(ch).page(forSeg: seg))
        layoutVersion += 1
        remember()
    }

    /// 全书进度 0…1(按章 + 章内页)。
    var bookProgress: Double {
        guard pageSize != .zero else { return 0 }
        let inCh = Double(current.page) / Double(max(pageCount(current.ch), 1))
        return (Double(current.ch - 1) + inCh) / Double(pack.chapters.count)
    }
}
