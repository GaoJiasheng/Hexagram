import SwiftUI
import UIKit

/// 长按选字后的菜单项。
enum ReaderMenuAction {
    case mark([HLPiece], color: Int)    // 划线
    case annotate([HLPiece])            // 批注:先划一条默认色,再写批注
    case find(String)                   // 查本书
}

/// 一页正文:一栏或并排两栏不可编辑的文本框。每栏一个独立的 ColumnTextView(自己的 storage / 排版器 / 容器),
/// 字的范围与断行取自这一章共用排版器的分页结果(见 ChapterLayout.makeColumnView)——这样每一页、每一栏都能长按选字。
final class TextPageController: UIViewController, UITextViewDelegate, UIGestureRecognizerDelegate {
    let ref: PageRef
    private let layout: ChapterLayout
    private let pageSize: CGSize
    private var columns: [(index: Int, view: ColumnTextView, clip: ColumnClipView)] = []
    var onNote: ((Note) -> Void)?
    var onSeg: ((Int) -> Void)?
    var onHighlight: ((String) -> Void)?
    var onMenu: ((ReaderMenuAction) -> Void)?
    /// 旁白翻页(三指轻扫、「上一页 / 下一页」动作):true 往后。翻得动返回 true。
    var onTurn: ((Bool) -> Bool)?
    /// 此刻是不是「全部展开译文」(那时单段的看译文 / 收起不起作用,不给这个动作)。
    var translationAll: (() -> Bool)?
    /// 这一页有没有正选着的字(仿真翻页时,选着字就不让翻页手势抢走拖动)。
    var hasSelection: Bool { columns.contains { $0.view.selectedRange.length > 0 } }

    init(ref: PageRef, layout: ChapterLayout, pageSize: CGSize) {
        self.ref = ref; self.layout = layout; self.pageSize = pageSize
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        for i in layout.columnIndices(ofPage: ref.page) {
            let tv = layout.makeColumnView(i)
            tv.delegate = self
            let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
            tap.name = "desk.tap"
            tap.delegate = self
            tv.addGestureRecognizer(tap)
            let clip = ColumnClipView(tv)
            installAccessibility(column: tv, clip: clip, layout: layout)
            view.addSubview(clip)
            columns.append((i, tv, clip))
        }
    }

    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

    /// 按下的时刻:按得久的是长按选字,松手时轻点手势也会报一次,要认出来丢掉。
    private var downAt: TimeInterval = 0
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        downAt = touch.timestamp
        return true
    }

    /// 轻点:注释词 → 出注;划线 → 划线面板;其余正文 → 展开 / 收起这一段的译文。正选着字时轻点只取消选择。
    @objc private func tapped(_ g: UITapGestureRecognizer) {
        guard let tv = g.view as? ColumnTextView else { return }
        // 正选着字(或长按选字刚松手,轻点手势也会报一次):不出注、不展开,取消选择交给系统
        if hasSelection { return }
        if ProcessInfo.processInfo.systemUptime - downAt > 0.45 { return }
        let lm = tv.layoutManager, c = tv.textContainer
        guard tv.textStorage.length > 0 else { return }
        let p = g.location(in: tv)
        let glyph = lm.glyphIndex(for: p, in: c)
        guard lm.lineFragmentRect(forGlyphAt: glyph, effectiveRange: nil).insetBy(dx: 0, dy: -6).contains(p) else { return }
        let local = lm.characterIndexForGlyph(at: glyph)
        let ch = local + tv.offset
        let box = lm.boundingRect(forGlyphRange: NSRange(location: glyph, length: 1), in: c)
        if let n = layout.note(atCharacter: ch), box.insetBy(dx: -4, dy: -6).contains(p) {
            onNote?(n)
            return
        }
        if let id = layout.highlightID(atCharacter: ch), box.insetBy(dx: -4, dy: -6).contains(p) {
            onHighlight?(id)
            return
        }
        if let s = layout.seg(atCharacter: ch) { onSeg?(s) }
    }

    /// 长按选字后的菜单:换成我们自己的——划线(四色)、批注、查本书、拷贝。不要系统的查询、翻译、共享。
    /// 选中的只有章题、条号等不属于任何段的字时,不给划线 / 批注。
    func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
        // 本栏的下标换成整章的
        let local = range
        let range = NSRange(location: local.location + ((textView as? ColumnTextView)?.offset ?? 0), length: local.length)
        let all = layout.storage.string as NSString
        guard range.length > 0, NSMaxRange(range) <= all.length else { return UIMenu(children: []) }
        let text = all.substring(with: range)
        let pieces = layout.pieces(in: range)
        let done = { [weak textView] in textView?.selectedTextRange = nil }
        var items: [UIMenuElement] = []
        if !pieces.isEmpty {
            let dots = (0..<4).map { c -> UIAction in
                let a = UIAction(title: HLColor.names[c], image: HLColor.dot(c)) { [weak self] _ in self?.onMenu?(.mark(pieces, color: c)); done() }
                a.accessibilityLabel = "划\(HLColor.names[c])线"
                return a
            }
            items.append(UIMenu(title: "划线", image: UIImage(systemName: "highlighter"), options: [], preferredElementSize: .small, children: dots))
            items.append(UIAction(title: "批注") { [weak self] _ in self?.onMenu?(.annotate(pieces)); done() })
        }
        let q = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !q.isEmpty {
            items.append(UIAction(title: "查本书") { [weak self] _ in self?.onMenu?(.find(q)); done() })
        }
        items.append(UIAction(title: "拷贝") { _ in UIPasteboard.general.string = text; done() })
        return UIMenu(children: items)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // 整页(一栏或两栏 + 中缝)水平居中;最后一页只有左栏时,左栏仍在原位,不挪到中间
        let x0 = (view.bounds.width - pageSize.width) / 2
        for (k, col) in columns.enumerated() {
            let m = ColumnClipView.margin
            col.clip.frame = CGRect(x: x0 + CGFloat(k) * (layout.columnWidth + layout.gutter), y: -m, width: layout.columnWidth,
                                    height: layout.height(ofColumn: col.index, full: pageSize.height) + m * 2)
        }
    }

    func textViewDidChangeSelection(_ textView: UITextView) { (textView as? ColumnTextView)?.clampSelection() }

    /// 注释词的系统点按什么也不做(出注由上面的轻点手势负责,免得第一栏出两次),也不走系统的「打开链接」。
    func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
        guard case .link(let url) = textItem.content, layout.note(for: url) != nil else { return nil }
        return UIAction { _ in }
    }

    /// 长按注释词不出系统的链接预览菜单。
    func textView(_ textView: UITextView, menuConfigurationFor textItem: UITextItem, defaultMenu: UIMenu) -> UITextItem.MenuConfiguration? { nil }
}

/// 章末页:SwiftUI 画的,套一层带页码的控制器。
final class EndPageController: UIHostingController<AnyView> {
    let ref: PageRef
    init(ref: PageRef, content: AnyView) {
        self.ref = ref
        super.init(rootView: content)
        view.backgroundColor = .clear
    }
    @MainActor required dynamic init?(coder: NSCoder) { fatalError() }
}

/// 仿真翻页时一页的底子:纸色 + 顶上一抹主题色 + 本章题头插画(或章号水印),与阅读页背后那层画法一致、按屏幕坐标对齐——
/// 卷起来的那一页是不透明的纸,翻过去看到的是下一页自己的底子,不是透出来的字。
struct PageBackdropSpec {
    var paper: UIColor
    var accent: UIColor
    var accent2: UIColor
    var art: UIImage?
    var artOpacity: CGFloat        // 浅色下的不透明度;深色再乘 0.55(同 ReaderScreen.backdrop)
    var watermark: String
}

final class PageBackdropView: UIView {
    let spec: PageBackdropSpec
    /// 翻页控制器的视图:本页在整屏底子坐标里的位置按它算(卷页时页面本身在变形,不能拿页面自己去换算)。
    weak var anchor: UIView?
    private var origin: CGPoint { guard let a = anchor, let w = a.window else { return .zero }; return a.convert(CGPoint.zero, to: w) }
    private var canvas: CGSize { anchor?.window?.bounds.size ?? .zero }
    override func didMoveToWindow() { super.didMoveToWindow(); setNeedsDisplay() }

    init(spec: PageBackdropSpec) {
        self.spec = spec
        super.init(frame: .zero)
        isOpaque = true
        contentMode = .redraw
        isUserInteractionEnabled = false
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (v: PageBackdropView, _) in v.setNeedsDisplay() }
    }
    required init?(coder: NSCoder) { fatalError() }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        let tc = traitCollection
        let dark = tc.userInterfaceStyle == .dark
        spec.paper.resolvedColor(with: tc).setFill()
        ctx.fill(bounds)
        let W = canvas.width > 0 ? canvas.width : bounds.width, H = canvas.height > 0 ? canvas.height : bounds.height
        let o = origin
        ctx.saveGState()
        ctx.translateBy(x: -o.x, y: -o.y)
        // 顶上一抹主题色(整屏高的前四分之一)
        let a1 = spec.accent.resolvedColor(with: tc), a2 = spec.accent2.resolvedColor(with: tc)
        if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                              colors: [a1.withAlphaComponent(0.14).cgColor, a2.withAlphaComponent(0.05).cgColor, a2.withAlphaComponent(0).cgColor] as CFArray,
                              locations: [0, 0.5, 1]) {
            ctx.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: H * 0.25), options: [])
        }
        if let img = spec.art {
            let ah = min(H * 0.52, W * 0.8)
            let box = CGRect(x: 0, y: H - ah, width: W, height: ah)
            let scale = max(box.width / img.size.width, box.height / img.size.height)
            let iw = img.size.width * scale, ih = img.size.height * scale
            let r = CGRect(x: box.midX - iw / 2, y: box.maxY - ih, width: iw, height: ih)
            ctx.setAlpha(spec.artOpacity * (dark ? 0.55 : 1))
            ctx.beginTransparencyLayer(auxiliaryInfo: nil)
            ctx.clip(to: box)
            img.draw(in: r)
            // 自下而上淡出:上沿透明,到一半八成,底部全显
            ctx.setBlendMode(.destinationIn)
            if let m = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                  colors: [UIColor.black.withAlphaComponent(0).cgColor, UIColor.black.withAlphaComponent(0.8).cgColor, UIColor.black.cgColor] as CFArray,
                                  locations: [0, 0.5, 1]) {
                ctx.drawLinearGradient(m, start: CGPoint(x: 0, y: box.minY), end: CGPoint(x: 0, y: box.maxY), options: [])
            }
            ctx.endTransparencyLayer()
        } else if !spec.watermark.isEmpty {
            var size = min(W * 0.42, 340)
            let s = spec.watermark as NSString
            var attrs: [NSAttributedString.Key: Any] = [.font: Fonts.uiSong(size, bold: true), .foregroundColor: a1.withAlphaComponent(0.05)]
            var sz = s.size(withAttributes: attrs)
            let maxW = W * 0.92
            if sz.width > maxW { size *= maxW / sz.width; attrs[.font] = Fonts.uiSong(size, bold: true); sz = s.size(withAttributes: attrs) }
            s.draw(at: CGPoint(x: W - W * 0.04 - sz.width, y: H - H * 0.05 - sz.height), withAttributes: attrs)
        }
        ctx.restoreGState()
    }
}

/// 仿真翻页的一页:底子在下,正文页(或章末页)作子控制器叠在上面。
final class CurlPageController: UIViewController {
    let ref: PageRef
    let inner: UIViewController
    private let backdrop: PageBackdropView
    init(ref: PageRef, inner: UIViewController, backdrop: PageBackdropView) {
        self.ref = ref; self.inner = inner; self.backdrop = backdrop
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError() }
    override func viewDidLoad() {
        super.viewDidLoad()
        backdrop.frame = view.bounds
        backdrop.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(backdrop)
        addChild(inner)
        inner.view.frame = view.bounds
        inner.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(inner.view)
        inner.didMove(toParent: self)
    }
}

/// 仿真翻页时一页的背面:纸色,略暗一点(像纸背)。
final class BackPageController: UIViewController {
    let front: PageRef
    private let paper: UIColor
    init(front: PageRef, paper: UIColor) { self.front = front; self.paper = paper; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError() }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = paper
        let shade = UIView()
        shade.backgroundColor = UIColor { $0.userInterfaceStyle == .dark ? UIColor.white.withAlphaComponent(0.03) : UIColor.black.withAlphaComponent(0.035) }
        shade.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        shade.frame = view.bounds
        view.addSubview(shade)
    }
}

/// 左右翻页的容器。用系统的 UIPageViewController:滑动(.scroll,默认)或仿真(.pageCurl,翻页方式设置)。
/// 换翻页方式时外面换 id 重建本控制器,model.current 不变,停在同一页。
struct PagedReader: UIViewControllerRepresentable {
    let model: ReaderModel
    let version: Int            // 排版版本:变了就整体重置到 model.current
    var curl = false
    /// 仿真翻页时每页的底子(滑动时页面透明,底子是阅读页背后那一层)。
    var backdrop: ((PageRef) -> PageBackdropSpec)?
    let onNote: (Note) -> Void
    let onSeg: (PageRef, Int) -> Void
    let endPage: (PageRef) -> AnyView
    var onHighlight: (String) -> Void = { _ in }
    var onMenu: (PageRef, ReaderMenuAction) -> Void = { _, _ in }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIPageViewController {
        let pvc: UIPageViewController
        if curl {
            // 单页书脊在左;双面:每页背后接一张纸背,卷起来时不透出反字
            pvc = UIPageViewController(transitionStyle: .pageCurl, navigationOrientation: .horizontal, options: [.spineLocation: UIPageViewController.SpineLocation.min.rawValue])
            pvc.isDoubleSided = true
            // 系统卷页自带「点页边翻页」的轻点手势,会和「轻点一段看译文」打架:关掉,只留拖动
            for g in pvc.gestureRecognizers where g is UITapGestureRecognizer { g.isEnabled = false }
            for g in pvc.gestureRecognizers where g is UIPanGestureRecognizer { g.delegate = context.coordinator }
        } else {
            pvc = UIPageViewController(transitionStyle: .scroll, navigationOrientation: .horizontal, options: [.interPageSpacing: 24])
        }
        pvc.dataSource = context.coordinator
        pvc.delegate = context.coordinator
        pvc.view.backgroundColor = .clear
        context.coordinator.pvc = pvc
        return pvc
    }

    func updateUIViewController(_ pvc: UIPageViewController, context: Context) {
        let c = context.coordinator
        c.parent = self
        guard model.pageSize != .zero else { return }
        if c.shownVersion != version || c.shown != model.current {
            let dir: UIPageViewController.NavigationDirection = {
                guard let s = c.shown, c.shownVersion == version else { return .forward }
                return (model.current.ch, model.current.page) < (s.ch, s.page) ? .reverse : .forward
            }()
            // 跳章、跳到划线等程序翻页:开了「减弱动态效果」就直接换页,不滑过去(手指翻页照常跟手)
            let animated = c.shownVersion == version && c.shown != nil && !UIAccessibility.isReduceMotionEnabled
            c.shownVersion = version
            c.shown = model.current
            let front = c.controller(for: model.current)
            // 仿真(书脊在左、双面)也只给正面一张:背面由数据源按「正 · 背 · 正」的次序要
            pvc.setViewControllers([front], direction: dir, animated: animated)
        }
    }

    final class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate, UIGestureRecognizerDelegate {
        var parent: PagedReader
        var shown: PageRef?
        var shownVersion = -1
        weak var pvc: UIPageViewController?
        init(_ p: PagedReader) { parent = p }

        func controller(for r: PageRef) -> UIViewController {
            let m = parent.model
            let vc: UIViewController
            if m.isEndPage(r) {
                vc = EndPageController(ref: r, content: AnyView(parent.endPage(r)
                    .accessibilityScrollAction { [weak self] edge in _ = self?.turn(from: r, forward: edge == .trailing || edge == .bottom) }))
            }
            else {
                let t = TextPageController(ref: r, layout: m.layout(r.ch), pageSize: m.pageSize)
                t.onNote = parent.onNote
                t.onSeg = { [weak self] s in self?.parent.onSeg(r, s) }
                t.onHighlight = { [weak self] id in self?.parent.onHighlight(id) }
                t.onMenu = { [weak self] a in self?.parent.onMenu(r, a) }
                t.onTurn = { [weak self] f in self?.turn(from: r, forward: f) ?? false }
                t.translationAll = { [weak m] in m?.showTranslation ?? false }
                vc = t
            }
            if parent.curl, let spec = parent.backdrop?(r) {
                // 仿真翻页:页面铺一层不透明的底子(按屏幕坐标对齐阅读页背后那一层)。
                // 套一层容器:章末页是 SwiftUI 宿主,内容画在宿主视图自己的层上,底子不能插在它里面
                let bg = PageBackdropView(spec: spec)
                bg.anchor = pvc?.view
                return CurlPageController(ref: r, inner: vc, backdrop: bg)
            }
            return vc
        }

        /// 旁白翻页:落到相邻一页(updateUIViewController 见 current 变了就换页),再报页码、把焦点挪到新页上。
        func turn(from r: PageRef, forward: Bool) -> Bool {
            let m = parent.model
            guard let to = forward ? m.after(r) : m.before(r) else { return false }
            m.landed(on: to)
            let n = m.pageCount(to.ch)
            let say = m.isEndPage(to) ? "本章完" : "第 \(to.page + 1) 页,共 \(n - 1) 页"
            UIAccessibility.post(notification: .pageScrolled, argument: say)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { UIAccessibility.post(notification: .layoutChanged, argument: nil) }
            return true
        }

        func back(of r: PageRef) -> UIViewController {
            BackPageController(front: r, paper: parent.backdrop?(r).paper ?? .systemBackground)
        }

        private func ref(of vc: UIViewController) -> PageRef? {
            (vc as? TextPageController)?.ref ?? (vc as? EndPageController)?.ref ?? (vc as? CurlPageController)?.ref
        }

        // 仿真(双面)的次序:正 0 · 背 0 · 正 1 · 背 1 …… 往后翻先要当前页的背面,再要下一页;往前翻先要上一页的背面,再要上一页。
        func pageViewController(_ pvc: UIPageViewController, viewControllerBefore vc: UIViewController) -> UIViewController? {
            if parent.curl {
                if let b = vc as? BackPageController { return controller(for: b.front) }
                guard let r = ref(of: vc), let b = parent.model.before(r) else { return nil }
                return back(of: b)
            }
            guard let r = ref(of: vc), let b = parent.model.before(r) else { return nil }
            return controller(for: b)
        }

        func pageViewController(_ pvc: UIPageViewController, viewControllerAfter vc: UIViewController) -> UIViewController? {
            if parent.curl {
                if let b = vc as? BackPageController {
                    guard let a = parent.model.after(b.front) else { return nil }
                    return controller(for: a)
                }
                guard let r = ref(of: vc), parent.model.after(r) != nil else { return nil }
                return back(of: r)
            }
            guard let r = ref(of: vc), let a = parent.model.after(r) else { return nil }
            return controller(for: a)
        }

        func pageViewController(_ pvc: UIPageViewController, didFinishAnimating finished: Bool, previousViewControllers: [UIViewController], transitionCompleted completed: Bool) {
            guard completed, let vc = pvc.viewControllers?.first, let r = ref(of: vc) else { return }
            shown = r
            parent.model.landed(on: r)
        }

        /// 仿真翻页的拖动:正选着字时不翻(拖的是选区的拖柄)。
        func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
            if let t = (pvc?.viewControllers?.first as? CurlPageController)?.inner as? TextPageController, t.hasSelection { return false }
            return true
        }
    }
}
