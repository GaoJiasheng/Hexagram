import SwiftUI
import UIKit

/// 一页正文:一栏或并排两栏不可编辑的 UITextView,接在这一章共用的排版器上(每栏一个文字容器)。
final class TextPageController: UIViewController, UITextViewDelegate, UIGestureRecognizerDelegate {
    let ref: PageRef
    private let layout: ChapterLayout
    private let pageSize: CGSize
    private var columns: [(index: Int, view: UITextView)] = []
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
        for i in layout.columnIndices(ofPage: ref.page) {
            let tv = layout.textViews[i]      // 分页时建好的那一个(见 ChapterLayout)
            tv.delegate = self
            tv.gestureRecognizers?.filter { $0.name == "desk.tap" }.forEach { tv.removeGestureRecognizer($0) }
            let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
            tap.name = "desk.tap"
            tap.delegate = self
            tv.addGestureRecognizer(tap)
            view.addSubview(tv)
            columns.append((i, tv))
        }
    }

    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

    /// 轻点一段正文:展开 / 收起它的译文。点在注释词上的交给下面的链接处理。
    @objc private func tapped(_ g: UITapGestureRecognizer) {
        guard let tv = g.view as? UITextView, let i = columns.first(where: { $0.view === tv })?.index else { return }
        let p = g.location(in: tv)
        let c = layout.containers[i]
        let glyph = layout.manager.glyphIndex(for: p, in: c)
        guard layout.manager.lineFragmentRect(forGlyphAt: glyph, effectiveRange: nil).insetBy(dx: 0, dy: -6).contains(p) else { return }
        let ch = layout.manager.characterIndexForGlyph(at: glyph)
        let box = layout.manager.boundingRect(forGlyphRange: NSRange(location: glyph, length: 1), in: c)
        if let url = layout.storage.attribute(.link, at: ch, effectiveRange: nil) as? URL, box.insetBy(dx: -4, dy: -6).contains(p) {
            // 出注在这里做,不靠系统的链接点按:系统那套只在一章的第一个文字容器上可靠,
            // 接在同一排版器上的其余容器(双栏的右栏、后面各页)点了没反应。
            if let n = layout.note(for: url) { onNote?(n) }
            return
        }
        if let s = layout.seg(atCharacter: ch) { onSeg?(s) }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // 整页(一栏或两栏 + 中缝)水平居中;最后一页只有左栏时,左栏仍在原位,不挪到中间
        let x0 = (view.bounds.width - pageSize.width) / 2
        for (k, col) in columns.enumerated() {
            col.view.frame = CGRect(x: x0 + CGFloat(k) * (layout.columnWidth + layout.gutter), y: 0, width: layout.columnWidth,
                                    height: layout.height(ofColumn: col.index, full: pageSize.height))
        }
    }

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

