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
            out.append(NSAttributedString(string: r.text, attributes: [
                .font: r.bold ? bold : font, .foregroundColor: r.bold ? accent : color, .paragraphStyle: ps, .kern: 0.3]))
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
        let tv = UITextView(frame: .zero, textContainer: tc)
        tv.isEditable = false
        tv.isSelectable = true
        tv.isScrollEnabled = false
        tv.backgroundColor = .clear
        tv.textContainerInset = UIEdgeInsets(top: 2, left: 0, bottom: 2, right: 0)
        tv.delegate = context.coordinator
        tv.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        tv.setContentHuggingPriority(.defaultLow, for: .horizontal)
        tv.tintColor = accent
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        tap.delegate = context.coordinator
        tv.addGestureRecognizer(tap)
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
