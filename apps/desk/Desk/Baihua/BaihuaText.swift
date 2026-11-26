import SwiftUI
import UIKit

/// 白话正文里长按选字后的菜单项。
enum BHMenuAction {
    case mark(HLPiece, color: Int)
    case annotate(HLPiece)
}

/// 白话的行内排版:`**…**` 渲染成主题色加粗(记号去掉),其余原样。
enum BHAttr {
    /// SwiftUI 用。
    static func text(_ s: String, accent: Color, boldColor: Color? = nil) -> AttributedString {
        var out = AttributedString()
        for r in BHText.runs(s) {
            var a = AttributedString(r.text)
            if r.bold { a.inlinePresentationIntent = .stronglyEmphasized; a.foregroundColor = boldColor ?? accent }
            if r.code { a.inlinePresentationIntent = r.bold ? [.code, .stronglyEmphasized] : .code; a.backgroundColor = Ink.line.opacity(0.6) }
            if let u = r.link { a.link = u; a.foregroundColor = accent; a.underlineStyle = .single }
            out += a
        }
        return out
    }

    /// UIKit 用(可划线的段)。
    static func ns(_ s: String, font: UIFont, bold: UIFont, color: UIColor, accent: UIColor, lineSpacing: CGFloat) -> NSAttributedString {
        let ps = NSMutableParagraphStyle()
        ps.lineSpacing = lineSpacing
        ps.lineBreakStrategy = .standard
        let out = NSMutableAttributedString()
        for r in BHText.runs(s) {
            var at: [NSAttributedString.Key: Any] = [.font: r.bold ? bold : font, .foregroundColor: r.bold ? accent : color, .paragraphStyle: ps, .kern: 0.3]
            if r.code {
                at[.font] = UIFont.monospacedSystemFont(ofSize: font.pointSize * 0.88, weight: r.bold ? .semibold : .regular)
                at[.backgroundColor] = UIColor.pair("#EFE9DE", "#34302B")
                at[.kern] = 0
            }
            if let u = r.link { at[.link] = u }
            out.append(NSAttributedString(string: r.text, attributes: at))
        }
        return out
    }
}

/// 一段可选字、可划线的白话(导语、正文段)。不可编辑的 UITextView,排版器用阅读器那一个(划线的圆角底色、批注小点一样)。
struct BHMarkableText: UIViewRepresentable {
    let raw: String
    let block: Int
    let font: UIFont
    let bold: UIFont
    let color: UIColor
    let accent: UIColor
    let lineSpacing: CGFloat
    /// 这一块上的划线:id、在去记号文字里的起止(字符数)、颜色、有无批注。
    let marks: [BHMark]
    /// 变了就闪一下 flashRange。
    var flashToken = 0
    var flashRange: (Int, Int)?
    let onMenu: (BHMenuAction) -> Void
    let onHighlight: (String) -> Void
    let onTouch: () -> Void
    /// 正文里的链接(书包文章才有):点了先问再开。
    var onLink: (URL) -> Void = { _ in }

    struct BHMark: Hashable { var id: String; var start: Int; var end: Int; var color: Int; var note: Bool }

    final class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: BHMarkableText
        var shownRaw = ""
        var shownKey = ""
        var shownMarks: [BHMark] = []
        var shownFlash = 0
        var downAt: TimeInterval = 0
        var timer: Timer?
        init(_ p: BHMarkableText) { parent = p }

        var plain: String { BHText.plain(parent.raw) }

        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool { downAt = touch.timestamp; return true }

        /// 轻点划线 → 划线面板;正选着字时轻点只取消选择。
        @objc func tapped(_ g: UITapGestureRecognizer) {
            guard let tv = g.view as? UITextView else { return }
            parent.onTouch()
            if tv.selectedRange.length > 0 { return }
            if ProcessInfo.processInfo.systemUptime - downAt > 0.45 { return }
            let lm = tv.layoutManager
            var p = g.location(in: tv); p.x -= tv.textContainerInset.left; p.y -= tv.textContainerInset.top
            let glyph = lm.glyphIndex(for: p, in: tv.textContainer)
            let box = lm.boundingRect(forGlyphRange: NSRange(location: glyph, length: 1), in: tv.textContainer)
            guard box.insetBy(dx: -4, dy: -6).contains(p) else { return }
            let ch = lm.characterIndexForGlyph(at: glyph)
            guard ch < tv.textStorage.length, let id = tv.textStorage.attribute(.deskHL, at: ch, effectiveRange: nil) as? String else { return }
            parent.onHighlight(id)
        }

        // 链接:点了交给外面(先问再用系统浏览器开);长按不出系统的链接预览
        func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
            guard case .link(let url) = textItem.content else { return nil }
            return UIAction { [weak self] _ in self?.parent.onLink(url) }
        }
        func textView(_ textView: UITextView, menuConfigurationFor textItem: UITextItem, defaultMenu: UIMenu) -> UITextItem.MenuConfiguration? { nil }

        func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
            parent.onTouch()
            let all = textView.textStorage.string as NSString
            guard range.length > 0, NSMaxRange(range) <= all.length else { return UIMenu(children: []) }
            let text = all.substring(with: range)
            let s = textView.textStorage.string
            let a = s.charOffset(utf16: range.location), b = s.charOffset(utf16: NSMaxRange(range))
            let done = { [weak textView] in textView?.selectedTextRange = nil }
            var items: [UIMenuElement] = []
            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, let t = s.chars(a, b) {
                let piece = HLPiece(seg: parent.block, layer: "b", start: a, end: b, text: t)
                let dots = (0..<4).map { c -> UIAction in
                    let x = UIAction(title: HLColor.names[c], image: HLColor.dot(c)) { [weak self] _ in self?.parent.onMenu(.mark(piece, color: c)); done() }
                    x.accessibilityLabel = "划\(HLColor.names[c])线"
                    return x
                }
                items.append(UIMenu(title: "划线", image: UIImage(systemName: "highlighter"), options: [], preferredElementSize: .small, children: dots))
                items.append(UIAction(title: "批注") { [weak self] _ in self?.parent.onMenu(.annotate(piece)); done() })
            }
            items.append(UIAction(title: "拷贝") { _ in UIPasteboard.general.string = text; done() })
            return UIMenu(children: items)
        }

        /// 旁白:长按选字出菜单这条路,旁白用户走不了。给整段挂自定义动作——划线、批注(都是整段),以及这一段里已有的每条划线。
        func axActions(_ tv: UITextView) -> [UIAccessibilityCustomAction] {
            let text = tv.textStorage.string
            let n = text.count
            var out: [UIAccessibilityCustomAction] = []
            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let piece = HLPiece(seg: parent.block, layer: "b", start: 0, end: n, text: text)
                // 整段已经划过就不再给「划线」(免得叠两条一样的)
                if !parent.marks.contains(where: { $0.start == 0 && $0.end >= n }) {
                    out.append(UIAccessibilityCustomAction(name: "划线") { [weak self] _ in self?.parent.onMenu(.mark(piece, color: 0)); return true })
                }
                out.append(UIAccessibilityCustomAction(name: "批注") { [weak self] _ in self?.parent.onMenu(.annotate(piece)); return true })
            }
            for m in parent.marks {
                guard let t = text.chars(m.start, m.end) else { continue }
                out.append(UIAccessibilityCustomAction(name: "看划线:\(t.prefix(12))") { [weak self] _ in self?.parent.onHighlight(m.id); return true })
            }
            // 正文里的链接(书包文章才有):整段成了一个元素,链接也给成动作
            let st = tv.textStorage
            st.enumerateAttribute(.link, in: NSRange(location: 0, length: st.length)) { v, r, _ in
                guard let u = v as? URL else { return }
                let t = (st.string as NSString).substring(with: r)
                out.append(UIAccessibilityCustomAction(name: "打开链接:\(t.prefix(12))") { [weak self] _ in self?.parent.onLink(u); return true })
            }
            return out
        }

        func flash(_ tv: UITextView, _ r: NSRange) {
            guard let lm = tv.layoutManager as? DeskLayoutManager else { return }
            timer?.invalidate()
            lm.flashRange = r
            let t0 = Date()
            timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak lm] t in
                guard let lm else { t.invalidate(); return }
                let x = Date().timeIntervalSince(t0) / 1.3
                if x >= 1 { t.invalidate(); lm.flashAlpha = 0; lm.flashRange = nil }
                else { lm.flashAlpha = CGFloat(sin(x * .pi * 4 - .pi / 2) * 0.5 + 0.5) * 0.4 }
                lm.invalidateDisplay(forCharacterRange: r)
            }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UITextView {
        // TextKit 1:用阅读器的排版器画划线
        let storage = NSTextStorage()
        let lm = DeskLayoutManager()
        lm.tint = accent
        storage.addLayoutManager(lm)
        let tc = NSTextContainer(size: CGSize(width: 100, height: CGFloat.greatestFiniteMagnitude))
        tc.widthTracksTextView = true
        tc.lineFragmentPadding = 0
        lm.addTextContainer(tc)
        let tv = TightTextView(frame: .zero, textContainer: tc)
        tv.isEditable = false
        tv.isSelectable = true
        tv.isScrollEnabled = false
        tv.backgroundColor = .clear
        tv.textContainerInset = UIEdgeInsets(top: 2, left: 0, bottom: 2, right: 0)
        tv.delegate = context.coordinator
        tv.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        tv.setContentHuggingPriority(.defaultLow, for: .horizontal)
        tv.tintColor = accent
        tv.linkTextAttributes = [.foregroundColor: accent, .underlineStyle: NSUnderlineStyle.single.rawValue]
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        tap.delegate = context.coordinator
        tv.addGestureRecognizer(tap)
        // 旁白:整段一个元素,自定义动作按需现算(划线随时会变)
        let c = context.coordinator
        tv.makeAXActions = { [weak c, weak tv] in
            guard let c, let tv else { return [] }
            return c.axActions(tv)
        }
        return tv
    }

    func updateUIView(_ tv: UITextView, context: Context) {
        let c = context.coordinator
        c.parent = self
        let key = "\(font.pointSize)|\(lineSpacing)"
        if c.shownRaw != raw || c.shownKey != key {
            c.shownRaw = raw; c.shownKey = key; c.shownMarks = []
            tv.textStorage.setAttributedString(BHAttr.ns(raw, font: font, bold: bold, color: color, accent: accent, lineSpacing: lineSpacing))
            tv.invalidateIntrinsicContentSize()
        }
        if c.shownMarks != marks { apply(tv, marks); c.shownMarks = marks }
        if flashToken != c.shownFlash {
            c.shownFlash = flashToken
            if let (a, b) = flashRange {
                let s = tv.textStorage.string
                let r = NSRange(location: s.utf16Offset(char: a), length: s.utf16Offset(char: b) - s.utf16Offset(char: a))
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { c.flash(tv, r) }
            }
        }
    }

    private func apply(_ tv: UITextView, _ marks: [BHMark]) {
        guard let lm = tv.layoutManager as? DeskLayoutManager else { return }
        let st = tv.textStorage
        let all = NSRange(location: 0, length: st.length)
        let s = st.string
        st.beginEditing()
        st.removeAttribute(.deskHL, range: all)
        var styles: [String: (color: Int, note: Bool)] = [:]
        for m in marks {
            let a = s.utf16Offset(char: m.start), b = s.utf16Offset(char: m.end)
            guard b > a, b <= st.length else { continue }
            st.addAttribute(.deskHL, value: m.id, range: NSRange(location: a, length: b - a))
            styles[m.id] = (m.color, m.note)
        }
        st.endEditing()
        lm.hlStyle = styles
        lm.invalidateDisplay(forCharacterRange: all)
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        let w = proposal.width ?? 320
        guard w > 0, w.isFinite else { return nil }
        let s = uiView.sizeThatFits(CGSize(width: w, height: .greatestFiniteMagnitude))
        return CGSize(width: w, height: ceil(s.height))
    }
}

/// 选字时系统画的底色按整个行框画:行距大时比字高出一截(下一行的字像被盖住一半)。这里把每一块收到字的上下沿,
/// 与划线底色同高;拖柄跟着这些框走。阅读页与白话深读的可选字文本框都用它。
class TightTextView: UITextView {
    /// 旁白(白话深读的可划线段用;阅读页的栏另有一套按段落切的元素,不设这个):设了它,这个文本框对旁白就是**一个**元素,
    /// 读整段、带自定义动作。不这样做的话,系统把不可编辑的文本框拆成内部的段落元素(_AXUITextViewParagraphElement),
    /// 挂在文本框上的自定义动作到不了它们身上。
    var makeAXActions: (() -> [UIAccessibilityCustomAction])?
    private var axSingle: Bool { makeAXActions != nil }
    override var isAccessibilityElement: Bool {
        get { axSingle || super.isAccessibilityElement }
        set { super.isAccessibilityElement = newValue }
    }
    override var accessibilityElements: [Any]? {
        get { axSingle ? nil : super.accessibilityElements }
        set { super.accessibilityElements = newValue }
    }
    override func accessibilityElementCount() -> Int { axSingle ? 0 : super.accessibilityElementCount() }
    override var accessibilityLabel: String? {
        get { axSingle ? textStorage.string : super.accessibilityLabel }
        set { super.accessibilityLabel = newValue }
    }
    override var accessibilityValue: String? {
        get { axSingle ? nil : super.accessibilityValue }
        set { super.accessibilityValue = newValue }
    }
    override var accessibilityTraits: UIAccessibilityTraits {
        get { axSingle ? .staticText : super.accessibilityTraits }
        set { super.accessibilityTraits = newValue }
    }
    override var accessibilityCustomActions: [UIAccessibilityCustomAction]? {
        get { makeAXActions?() ?? super.accessibilityCustomActions }
        set { super.accessibilityCustomActions = newValue }
    }

    override func selectionRects(for range: UITextRange) -> [UITextSelectionRect] {
        let rects = super.selectionRects(for: range)
        guard textStorage.length > 0 else { return rects }
        let loc = min(max(offset(from: beginningOfDocument, to: range.start), 0), textStorage.length - 1)
        guard let font = textStorage.attribute(.font, at: loc, effectiveRange: nil) as? UIFont else { return rects }
        let h = ceil(font.lineHeight) + 2
        return rects.map { r in
            guard !r.isVertical, r.rect.height > h + 1 else { return r }
            return TightSelectionRect(base: r, rect: CGRect(x: r.rect.minX, y: r.rect.minY, width: r.rect.width, height: h))
        }
    }
}

private final class TightSelectionRect: UITextSelectionRect {
    private let base: UITextSelectionRect
    private let r: CGRect
    init(base: UITextSelectionRect, rect: CGRect) { self.base = base; r = rect }
    override var rect: CGRect { r }
    override var writingDirection: NSWritingDirection { base.writingDirection }
    override var containsStart: Bool { base.containsStart }
    override var containsEnd: Bool { base.containsEnd }
    override var isVertical: Bool { base.isVertical }
}
