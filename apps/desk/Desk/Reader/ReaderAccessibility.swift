import UIKit

/// 旁白读正文:一栏的文本框里装着扩到整段的上下文(上下栏的字是透明的),系统默认的文本元素会把看不见的字也读出来,
/// 也没有「看译文」「划线」这些只靠轻点 / 长按才有的功能。这里把一栏按段落切成元素(只取本栏看得见的字),
/// 每个元素带自定义动作:看译文、划线、批注、出注、看划线、上一页 / 下一页;三指轻扫也能翻页。
final class SegAXElement: UIAccessibilityElement {
    weak var textView: ColumnTextView?
    /// 本栏 storage 里的下标(本地)。
    var localRange = NSRange()
    var onScroll: ((UIAccessibilityScrollDirection) -> Bool)?
    /// 动作按需现算(划线是建好文本框之后才抄上去的,点开译文也会变)。
    var makeActions: (() -> [UIAccessibilityCustomAction])?

    override var accessibilityCustomActions: [UIAccessibilityCustomAction]? {
        get { makeActions?() }
        set {}
    }

    override var accessibilityFrameInContainerSpace: CGRect {
        get {
            guard let tv = textView, let clip = tv.superview else { return .zero }
            let lm = tv.layoutManager
            let g = lm.glyphRange(forCharacterRange: localRange, actualCharacterRange: nil)
            let r = lm.boundingRect(forGlyphRange: g, in: tv.textContainer)
            return tv.convert(r, to: clip).intersection(clip.bounds)
        }
        set {}
    }

    override func accessibilityScroll(_ direction: UIAccessibilityScrollDirection) -> Bool {
        onScroll?(direction) ?? false
    }
}

extension TextPageController {
    /// 三指轻扫的方向 → 往后翻(true)/ 往前翻(false);上下轻扫不算(可能是想滚动别的)。
    static func isForward(_ d: UIAccessibilityScrollDirection) -> Bool? {
        switch d {
        case .left, .next: return true
        case .right, .previous: return false
        default: return nil
        }
    }

    /// 给一栏造旁白元素,装进它的裁切框。
    func installAccessibility(column tv: ColumnTextView, clip: ColumnClipView, layout: ChapterLayout) {
        tv.isAccessibilityElement = false
        tv.accessibilityElementsHidden = true
        clip.isAccessibilityElement = false
        let ns = tv.textStorage.string as NSString
        let st = tv.textStorage
        var els: [SegAXElement] = []
        let scroll: (UIAccessibilityScrollDirection) -> Bool = { [weak self] d in
            guard let f = Self.isForward(d) else { return false }
            return self?.onTurn?(f) ?? false
        }
        ns.enumerateSubstrings(in: tv.visible, options: [.byParagraphs]) { sub, r, _, _ in
            guard let sub, r.length > 0 else { return }
            let text = sub.replacingOccurrences(of: "\u{2028}", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return }
            let seg = st.attribute(.deskSeg, at: r.location, effectiveRange: nil) as? Int ?? -1
            let isTrans = st.attribute(.deskTrans, at: r.location, effectiveRange: nil) != nil
            let e = SegAXElement(accessibilityContainer: clip)
            e.textView = tv
            e.localRange = r
            e.onScroll = scroll
            e.accessibilityLabel = isTrans ? "译文,\(text)" : text
            e.accessibilityTraits = seg < 0 ? [.header, .staticText] : .staticText
            e.makeActions = { [weak self, weak tv] in
                guard let self, let tv else { return [] }
                return self.actions(seg: seg, local: r, tv: tv, layout: layout)
            }
            els.append(e)
        }
        clip.accessibilityElements = els
    }

    private func actions(seg: Int, local: NSRange, tv: ColumnTextView, layout: ChapterLayout) -> [UIAccessibilityCustomAction] {
        // 章题、篇题:只读不操作(翻页仍可三指轻扫)
        guard seg >= 0 else { return [] }
        var out: [UIAccessibilityCustomAction] = []
        let whole = NSRange(location: local.location + tv.offset, length: local.length)
        if seg >= 0 {
            let segs = layout.chapter.segs
            if !(translationAll?() ?? false), segs.indices.contains(seg), !(segs[seg].t ?? "").isEmpty {
                out.append(UIAccessibilityCustomAction(name: layout.translationShown(seg: seg) ? "收起译文" : "看译文") { [weak self] _ in
                    self?.onSeg?(seg); return true
                })
            }
            let pieces = layout.pieces(in: whole)
            if !pieces.isEmpty {
                out.append(UIAccessibilityCustomAction(name: "划线") { [weak self] _ in self?.onMenu?(.mark(pieces, color: 0)); return true })
                out.append(UIAccessibilityCustomAction(name: "批注") { [weak self] _ in self?.onMenu?(.annotate(pieces)); return true })
            }
            // 这一段里的注释词、划线:各给一个动作
            var seenNotes = Set<String>(), seenHL = Set<String>()
            tv.textStorage.enumerateAttributes(in: local) { attrs, r, _ in
                if let k = attrs[.deskNote] as? String, !seenNotes.contains(k), let n = layout.note(atCharacter: r.location + tv.offset) {
                    seenNotes.insert(k)
                    out.append(UIAccessibilityCustomAction(name: "注:\(n.k)") { [weak self] _ in self?.onNote?(n); return true })
                }
                if let id = attrs[.deskHL] as? String, !seenHL.contains(id) {
                    seenHL.insert(id)
                    let t = (tv.textStorage.string as NSString).substring(with: r)
                    out.append(UIAccessibilityCustomAction(name: "看划线:\(t.prefix(12))") { [weak self] _ in self?.onHighlight?(id); return true })
                }
            }
        }
        out.append(UIAccessibilityCustomAction(name: "下一页") { [weak self] _ in self?.onTurn?(true) ?? false })
        out.append(UIAccessibilityCustomAction(name: "上一页") { [weak self] _ in self?.onTurn?(false) ?? false })
        return out
    }
}

extension ChapterLayout {
    /// 这一段的译文此刻展开着没有(排版里有没有它的译文框)。
    func translationShown(seg: Int) -> Bool {
        var found = false
        storage.enumerateAttribute(.deskTrans, in: NSRange(location: 0, length: storage.length)) { v, r, stop in
            if v != nil, storage.attribute(.deskSeg, at: r.location, effectiveRange: nil) as? Int == seg { found = true; stop.pointee = true }
        }
        return found
    }
}
