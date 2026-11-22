import SwiftUI
import UIKit

/// 一页正文:一个不可编辑的 UITextView,接在这一章共用的排版器上(每页一个文字容器)。
final class TextPageController: UIViewController, UITextViewDelegate, UIGestureRecognizerDelegate {
    let ref: PageRef
    private let layout: ChapterLayout
    private let pageSize: CGSize
    private var textView: UITextView!
    var onNote: ((Note) -> Void)?
    var onSeg: ((Int) -> Void)?

    init(ref: PageRef, layout: ChapterLayout, pageSize: CGSize) {
        self.ref = ref; self.layout = layout; self.pageSize = pageSize
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        let tv = UITextView(frame: CGRect(origin: .zero, size: pageSize), textContainer: layout.containers[ref.page])
        tv.isEditable = false
        tv.isScrollEnabled = false
        tv.backgroundColor = .clear
        tv.textContainerInset = .zero
        tv.isSelectable = true
        tv.delegate = self
        // 注释词的样子:字色不变,只在下面加一道主题色的点线
        tv.linkTextAttributes = [
            .foregroundColor: UIColor(hex: "#2A2623"),
            .underlineStyle: NSUnderlineStyle.single.rawValue | NSUnderlineStyle.patternDot.rawValue,
            .underlineColor: layout.accent,
        ]
        view.addSubview(tv)
        textView = tv
        let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
        tap.delegate = self
        tv.addGestureRecognizer(tap)
    }

    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

    /// 轻点一段正文:展开 / 收起它的译文。点在注释词上的交给下面的链接处理。
    @objc private func tapped(_ g: UITapGestureRecognizer) {
        let p = g.location(in: textView)
        let c = layout.containers[ref.page]
        let glyph = layout.manager.glyphIndex(for: p, in: c)
        guard layout.manager.lineFragmentRect(forGlyphAt: glyph, effectiveRange: nil).insetBy(dx: 0, dy: -6).contains(p) else { return }
        let ch = layout.manager.characterIndexForGlyph(at: glyph)
        let box = layout.manager.boundingRect(forGlyphRange: NSRange(location: glyph, length: 1), in: c)
        if layout.storage.attribute(.link, at: ch, effectiveRange: nil) != nil, box.insetBy(dx: -4, dy: -6).contains(p) { return }
        if let s = layout.seg(atCharacter: ch) { onSeg?(s) }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        textView.frame = CGRect(x: (view.bounds.width - pageSize.width) / 2, y: 0, width: pageSize.width, height: pageSize.height)
    }

    /// 点到带注释的字词就出注(不走系统的「打开链接」)。
    func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
        guard case .link(let url) = textItem.content, let n = layout.note(for: url) else { return nil }
        return UIAction { [weak self] _ in self?.onNote?(n) }
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

/// 左右翻页的容器。用系统的 UIPageViewController:滑动跟手,以后要「卷页」效果换一个参数即可。
struct PagedReader: UIViewControllerRepresentable {
    let model: ReaderModel
    let version: Int            // 排版版本:变了就整体重置到 model.current
    let onNote: (Note) -> Void
    let onSeg: (PageRef, Int) -> Void
    let endPage: (PageRef) -> AnyView

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIPageViewController {
        let pvc = UIPageViewController(transitionStyle: .scroll, navigationOrientation: .horizontal, options: [.interPageSpacing: 24])
        pvc.dataSource = context.coordinator
        pvc.delegate = context.coordinator
        pvc.view.backgroundColor = .clear
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
            let animated = c.shownVersion == version && c.shown != nil
            c.shownVersion = version
            c.shown = model.current
            pvc.setViewControllers([c.controller(for: model.current)], direction: dir, animated: animated)
        }
    }

    final class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
        var parent: PagedReader
        var shown: PageRef?
        var shownVersion = -1
        init(_ p: PagedReader) { parent = p }

        func controller(for r: PageRef) -> UIViewController {
            let m = parent.model
            if m.isEndPage(r) { return EndPageController(ref: r, content: parent.endPage(r)) }
            let vc = TextPageController(ref: r, layout: m.layout(r.ch), pageSize: m.pageSize)
            vc.onNote = parent.onNote
            vc.onSeg = { [weak self] s in self?.parent.onSeg(r, s) }
            return vc
        }

        private func ref(of vc: UIViewController) -> PageRef? {
            (vc as? TextPageController)?.ref ?? (vc as? EndPageController)?.ref
        }

        func pageViewController(_ pvc: UIPageViewController, viewControllerBefore vc: UIViewController) -> UIViewController? {
            guard let r = ref(of: vc), let b = parent.model.before(r) else { return nil }
            return controller(for: b)
        }

        func pageViewController(_ pvc: UIPageViewController, viewControllerAfter vc: UIViewController) -> UIViewController? {
            guard let r = ref(of: vc), let a = parent.model.after(r) else { return nil }
            return controller(for: a)
        }

        func pageViewController(_ pvc: UIPageViewController, didFinishAnimating finished: Bool, previousViewControllers: [UIViewController], transitionCompleted completed: Bool) {
            guard completed, let vc = pvc.viewControllers?.first, let r = ref(of: vc) else { return }
            shown = r
            parent.model.landed(on: r)
        }
    }
}

