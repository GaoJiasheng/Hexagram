import UIKit
import Observation

/// 阅读器里的一页:第几章(书内序号)、章内第几页。每章最后多一页「章末页」。
struct PageRef: Hashable {
    var ch: Int
    var page: Int
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
    private(set) var pageSize: CGSize = .zero
    @ObservationIgnored private var layouts: [Int: ChapterLayout] = [:]
    @ObservationIgnored private var anchorSeg = 0

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
        let l = ChapterLayout(chapter: chapter(ch), unit: book.unit, pageSize: pageSize, style: st)
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

    /// 页面大小或「显示译文」变了:重排,落回原来那一段。
    func relayout(size: CGSize, fontSize: CGFloat) {
        guard size.width > 50, size.height > 50 else { return }
        if size == pageSize && fontSize == self.fontSize && !layouts.isEmpty { return }
        pageSize = size
        self.fontSize = fontSize
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
    }

    func jump(toChapter ch: Int) {
        anchorSeg = 0
        current = PageRef(ch: ch, page: 0)
        layoutVersion += 1
        remember()
    }

    /// 翻到了某一页:记住位置(章 + 段),立即落盘。
    func landed(on r: PageRef) {
        current = r
        if !isEndPage(r) { anchorSeg = layout(r.ch).firstSeg[r.page] }
        remember()
    }

    private func remember() { ProgressStore.shared.set(book.id, ch: current.ch, seg: anchorSeg) }

    /// 全书进度 0…1(按章 + 章内页)。
    var bookProgress: Double {
        guard pageSize != .zero else { return 0 }
        let inCh = Double(current.page) / Double(max(pageCount(current.ch), 1))
        return (Double(current.ch - 1) + inCh) / Double(pack.chapters.count)
    }
}
