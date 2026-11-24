import XCTest
import UIKit
@testable import Desk

/// iPad 横屏双栏:长译文跨栏时「框矮一行、末行被裁」的回归测试。
/// 根因:整章分页在新栏首行(以「起头、接着上一栏半段)比连着排多排一两个字,显示用文本框带上下文重排时少排,行错位,
/// 最坏多出一行被裁切框切掉。修法见 ChapterLayout.makeColumnView。
@MainActor
final class ColumnLayoutTests: XCTestCase {
    /// 伪随机(确定性)造一章:原文短、译文长,全部展开。
    static func chapter(seed: UInt64, segs: Int = 24) -> Chapter {
        var x = seed
        func rnd(_ n: Int) -> Int { x = x &* 6364136223846793005 &+ 1442695040888963407; return Int((x >> 33) % UInt64(n)) }
        let pool = Array("天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏道可道非常道名可名非常名无名天地之始有名万物之母故常无欲以观其妙")
        let punct = Array("，，，。；：「」！？、")
        func text(_ n: Int) -> String {
            var s = ""
            for k in 0..<n { s.append(pool[rnd(pool.count)]); if k % (5 + rnd(9)) == 4 { s.append(punct[rnd(punct.count)]) } }
            return s + "。"
        }
        let ss = (0..<segs).map { _ in Seg(o: text(12 + rnd(120)), t: text(60 + rnd(520)), n: nil, label: nil, line: nil, kind: nil) }
        return Chapter(no: 1, title: "测试章", src: Src(corpus: "t", slug: "t", ch: 1), kind: nil, gua: nil, segs: ss, yanyi: nil, meta: nil, verse: nil)
    }

    /// 整章排在一个无限高容器里,第 at 个字所在那一行的字范围。
    static func continuous(_ s: NSTextStorage, width: CGFloat, at: Int) -> NSRange {
        let st = NSTextStorage(attributedString: s); let lm = NSLayoutManager(); st.addLayoutManager(lm)
        let c = NSTextContainer(size: CGSize(width: width, height: 10_000_000)); c.lineFragmentPadding = 0; lm.addTextContainer(c)
        var r = NSRange()
        _ = lm.lineFragmentRect(forGlyphAt: lm.glyphIndexForCharacter(at: at), effectiveRange: &r)
        return lm.characterRange(forGlyphRange: r, actualGlyphRange: nil)
    }

    /// 显示文本框若从本栏第一个字起排(不带上一栏的半段):逐行字范围。
    static func tailOnly(_ l: ChapterLayout, column i: Int) -> [NSRange] {
        let chars = l.manager.characterRange(forGlyphRange: l.manager.glyphRange(for: l.containers[i]), actualGlyphRange: nil)
        let ns = l.storage.string as NSString
        let tail = ns.paragraphRange(for: NSRange(location: max(NSMaxRange(chars) - 1, chars.location), length: 0))
        let span = NSRange(location: chars.location, length: NSMaxRange(tail) - chars.location)
        let st = NSTextStorage(attributedString: l.storage.attributedSubstring(from: span)); let lm = NSLayoutManager(); st.addLayoutManager(lm)
        let c = NSTextContainer(size: CGSize(width: l.columnWidth, height: 10_000_000)); c.lineFragmentPadding = 0; lm.addTextContainer(c)
        var out: [NSRange] = []
        lm.enumerateLineFragments(forGlyphRange: lm.glyphRange(forCharacterRange: NSRange(location: 0, length: chars.length), actualCharacterRange: nil)) { _, _, _, g, _ in
            var r = lm.characterRange(forGlyphRange: g, actualGlyphRange: nil); r.location += span.location; out.append(r)
        }
        return out
    }

    static var oldMismatch = 0, oldExtraLine = 0
    struct Failure: CustomStringConvertible { let what: String; var description: String { what } }

    /// 一种栏宽 / 字号下,逐栏核对:显示用文本框排出的每一行都在栏内(不会被裁切框切掉)、与整章分页逐行一致,
    /// 译文底色框盖住它的每一行字。
    static func check(_ layout: ChapterLayout, pageHeight: CGFloat, tag: String) -> [Failure] {
        var out: [Failure] = []
        for i in 0..<layout.containers.count {
            // 修前的排法(总带整段上下文)与整章分页对不上的栏:记数,看多出行的有几栏
            let chars = layout.manager.characterRange(forGlyphRange: layout.manager.glyphRange(for: layout.containers[i]), actualGlyphRange: nil)
            let head = (layout.storage.string as NSString).paragraphRange(for: NSRange(location: chars.location, length: 0)).location
            let old = layout.columnView(i, from: head)
            if !layout.linesMatch(column: i, view: old) {
                Self.oldMismatch += 1
                let lm = old.layoutManagerD
                var n = 0, m = 0
                lm.enumerateLineFragments(forGlyphRange: lm.glyphRange(forCharacterRange: old.visible, actualCharacterRange: nil)) { _, _, _, _, _ in n += 1 }
                layout.manager.enumerateLineFragments(forGlyphRange: layout.manager.glyphRange(for: layout.containers[i])) { _, _, _, _, _ in m += 1 }
                if n > m { Self.oldExtraLine += 1 }
            }
            let v = layout.makeColumnView(i)
            let lm = v.layoutManagerD
            let H = layout.height(ofColumn: i, full: pageHeight)
            let vg = lm.glyphRange(forCharacterRange: v.visible, actualCharacterRange: nil)
            var local: [(NSRange, CGRect)] = []
            lm.enumerateLineFragments(forGlyphRange: vg) { _, used, _, g, _ in
                var cr = lm.characterRange(forGlyphRange: g, actualGlyphRange: nil); cr.location += v.offset
                local.append((cr, used.offsetBy(dx: 0, dy: v.dy)))
            }
            var shared: [NSRange] = []
            let cg = layout.manager.glyphRange(for: layout.containers[i])
            layout.manager.enumerateLineFragments(forGlyphRange: cg) { _, _, _, g, _ in
                shared.append(layout.manager.characterRange(forGlyphRange: g, actualGlyphRange: nil))
            }
            if shared != local.map(\.0) {
                let ns = layout.storage.string as NSString
                let lr = local.map(\.0); let k = (0..<min(shared.count, lr.count)).first { shared[$0] != lr[$0] } ?? min(shared.count, lr.count)
                let a = k < shared.count ? shared[k] : NSRange(), b = k < local.count ? local[k].0 : NSRange()
                out.append(Failure(what: "\(tag) col\(i): 行不一致 \(shared.count) vs \(local.count) 第\(k)行 \(a)[\(a.length > 0 ? ns.substring(with: a) : "")] vs \(b)[\(b.length > 0 ? ns.substring(with: b) : "")] 栏首\(v.visible.location + v.offset) 段首\(v.offset) 连排\(Self.continuous(layout.storage, width: layout.columnWidth, at: a.location)) 仅本栏起\(Self.tailOnly(layout, column: i) == shared)"))
            }
            for (r, u) in local {
                // 行的 used 底部含行距(空白);只看字形的下沿
                let ps = layout.storage.attribute(.paragraphStyle, at: r.location, effectiveRange: nil) as? NSParagraphStyle
                guard u.maxY - (ps?.lineSpacing ?? 0) > H + 0.5 || u.minY < -ColumnClipView.margin else { continue }
                out.append(Failure(what: "\(tag) col\(i): 行 \(r) 出栏 used=\(u) H=\(H)"))
            }
            // 译文框:盖住框里每一行字
            for box in lm.transBoxes(v.textStorage, chars: v.visible, glyphsToShow: vg) {
                lm.enumerateLineFragments(forGlyphRange: vg) { _, used, _, g, _ in
                    let c = lm.characterIndexForGlyph(at: g.location)
                    guard lm.textStorage?.attribute(.deskTrans, at: c, effectiveRange: nil) != nil,
                          used.minY >= box.minY - 0.5, used.minY < box.maxY + 40 else { return }
                    if used.maxY > box.maxY + 0.5 { out.append(Failure(what: "\(tag) col\(i): 译文框底 \(box.maxY) 盖不住行底 \(used.maxY)")) }
                }
            }
        }
        return out
    }

    func testLandscapeColumnsLongTranslations() {
        var fails: [Failure] = []
        var columnsChecked = 0
        for colW: CGFloat in [360, 401, 447, 489, 523, 555] {
            for pageH: CGFloat in [690, 744, 812] {
                for fs: CGFloat in [17, 19, 21, 24, 28] {
                    for seed: UInt64 in [1, 2, 3, 4, 5] {
                        var st = ReaderStyle(); st.fontSize = fs; st.showTranslation = true
                        let l = ChapterLayout(chapter: Self.chapter(seed: seed &* 7919 &+ UInt64(fs)), unit: "章",
                                              pageSize: CGSize(width: colW * 2 + 56, height: pageH), columns: 2, style: st)
                        columnsChecked += l.containers.count
                        fails += Self.check(l, pageHeight: pageH, tag: "w\(colW) h\(pageH) fs\(fs) s\(seed)")
                    }
                }
            }
        }
        print("COLUMNS checked=\(columnsChecked) fails=\(fails.count) 修前错行栏=\(Self.oldMismatch) 其中多出一行=\(Self.oldExtraLine)")
        for f in fails.prefix(30) { print("FAIL \(f)") }
        XCTAssertTrue(fails.isEmpty, "\(fails.count) 处:\(fails.prefix(5))")
    }
}
