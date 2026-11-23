import UIKit
import SwiftUI

// 脑图画布:UIScrollView(拖动的惯性、回弹、双指缩放都用系统的)+ 一层内容视图(坐标就是排版的世界坐标)。
// 每个节点一个 CALayer,自己按「当前缩放 × 屏幕倍率」重画一遍字(contentsScale),所以放多大都是清楚的矢量字,
// 不是位图放大;只有看得见的节点才画,缩放停下来、或拖到新地方时补画。连线每条一个 CAShapeLayer(矢量,随缩放自动清楚)。
// 展开收起:重新排版后整体平移,让点的那个节点留在原处,其余节点与连线用 Core Animation 滑到新位置。

/// 画一个节点要的东西(树、量好的字、配色);节点层各拿一份引用,换配色时整份换掉。
final class MindPaintCtx: @unchecked Sendable {
    let tree: MindTree
    let metrics: MindMetrics
    let palette: MindPalette
    init(tree: MindTree, metrics: MindMetrics, palette: MindPalette) { self.tree = tree; self.metrics = metrics; self.palette = palette }
}

final class MindNodeLayer: CALayer {
    var nodeID = 0
    var look = MindNodeLook()
    var nodeRect: CGRect = .zero          // 节点框在本层坐标里
    var paint: MindPaintCtx?
    /// 内容变了(状态、配色),还没重画
    var stale = true

    override init() { super.init(); commonInit() }
    override init(layer: Any) {
        super.init(layer: layer)
        if let l = layer as? MindNodeLayer { nodeID = l.nodeID; look = l.look; nodeRect = l.nodeRect; paint = l.paint }
    }
    required init?(coder: NSCoder) { fatalError() }
    private func commonInit() {
        needsDisplayOnBoundsChange = false
        isOpaque = false
        drawsAsynchronously = true
    }

    override func draw(in ctx: CGContext) {
        guard let c = paint else { return }
        let tree = c.tree, m = c.metrics, pal = c.palette
        MindPainter.drawNode(ctx, tree: tree, id: nodeID, rect: nodeRect, look: look, pal: pal, metrics: m)
        if look.hasKids {
            MindPainter.drawBubble(ctx, center: MindPainter.bubbleCenter(nodeRect, collapsed: look.collapsedKids > 0), collapsed: look.collapsedKids,
                                   hue: pal.hue(tree[nodeID].branch), pal: pal)
        }
    }
}

@MainActor
final class MindCanvasView: UIScrollView, UIScrollViewDelegate {
    let content = UIView()
    private let linksLayer = CALayer()
    private let nodesLayer = CALayer()
    private var nodeLayers: [Int: MindNodeLayer] = [:]
    private var linkLayers: [Int: CAShapeLayer] = [:]

    private(set) var tree: MindTree?
    private(set) var metrics: MindMetrics?
    private(set) var palette: MindPalette?
    private var paint: MindPaintCtx?
    private(set) var layout = MindLayout()
    var theme: BookTheme = DeskbookInstaller.defaultTheme

    /// 状态从哪来(选中、展开、命中…)
    var lookOf: (Int) -> MindNodeLook = { _ in MindNodeLook() }
    var openSet: () -> Set<Int> = { [] }
    var onTapNode: (Int) -> Void = { _ in }
    var onTapBubble: (Int) -> Void = { _ in }
    var onTapEmpty: () -> Void = {}
    /// 屏上盖在画布上的 SwiftUI 件(节点卡片、控制条、顶栏)此刻的位置(窗口坐标)。点在它们身上的不算点画布——
    /// SwiftUI 的按钮与画布的点按识别器会同时收到同一下点击(宿主视图的识别器收得到落在子视图上的触摸):
    /// 曾有一次点卡片上的「读这一章」,画布先把卡片底下的节点选中、展开(并存了盘),按钮再按新卡片读了别的章。
    /// 只靠 obscured(按卡片高度推算的留白)挡不住卡片换内容、正在动画的那一瞬。
    var blockedRects: () -> [CGRect] = { [] }
    var onInteract: () -> Void = {}
    var onCamera: () -> Void = {}
    var onFirstLayout: (CGSize) -> Void = { _ in }
    /// 被卡片挡住的那一边(居中时让开它)
    var obscured = UIEdgeInsets.zero
    var reduceMotion = false
    private var didFirst = false
    private var lastRenderedZoom: CGFloat = 1

    static let minZoom: CGFloat = 0.12
    static let maxZoom: CGFloat = 3.2

    override init(frame: CGRect) {
        super.init(frame: frame)
        delegate = self
        // 读屏:画布上的节点是画出来的,不是一个个元素;给它一个名字,并指去「提纲」(同一张图的逐项列表,读屏可逐项读)
        isAccessibilityElement = true
        accessibilityLabel = "思想脑图画布"
        accessibilityHint = "画布上的节点读屏读不到,请用顶上的「提纲」逐项阅读;选中的节点在下方卡片里"
        minimumZoomScale = Self.minZoom
        maximumZoomScale = Self.maxZoom
        bouncesZoom = true
        showsVerticalScrollIndicator = false
        showsHorizontalScrollIndicator = false
        contentInsetAdjustmentBehavior = .never
        decelerationRate = .normal
        backgroundColor = .clear
        delaysContentTouches = false
        content.layer.addSublayer(linksLayer)
        content.layer.addSublayer(nodesLayer)
        addSubview(content)
        let dbl = UITapGestureRecognizer(target: self, action: #selector(doubleTap(_:)))
        dbl.numberOfTapsRequired = 2
        addGestureRecognizer(dbl)
        let tap = UITapGestureRecognizer(target: self, action: #selector(singleTap(_:)))
        tap.require(toFail: dbl)
        addGestureRecognizer(tap)
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (v: MindCanvasView, _) in v.rebuildPalette() }
    }
    required init?(coder: NSCoder) { fatalError() }

    // MARK: 数据

    func load(_ tree: MindTree, metrics: MindMetrics, theme: BookTheme) {
        self.tree = tree
        self.metrics = metrics
        self.theme = theme
        rebuildPalette(redraw: false)
        if bounds.width > 0 { firstLayoutIfNeeded() }
    }

    private func rebuildPalette(redraw: Bool = true) {
        guard let tree else { return }
        let pal = MindPalette.make(theme, branches: tree.branches, dark: traitCollection.userInterfaceStyle == .dark)
        palette = pal
        if let m = metrics { paint = MindPaintCtx(tree: tree, metrics: m, palette: pal) }
        if redraw {
            for (_, l) in nodeLayers { l.paint = paint; l.stale = true }
            for (id, l) in linkLayers { l.strokeColor = linkColor(id) }
            renderVisible(force: true)
        }
    }

    private func linkColor(_ child: Int) -> CGColor? {
        guard let tree, let palette else { return nil }
        return palette.hue(tree[child].branch).withAlphaComponent(palette.dark ? 0.55 : 0.6).cgColor
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // 任何节点都能拖到屏幕中间:四周留出大半屏的余地
        let inset = UIEdgeInsets(top: bounds.height * 0.72, left: bounds.width * 0.72, bottom: bounds.height * 0.72, right: bounds.width * 0.72)
        if contentInset != inset { contentInset = inset }
        firstLayoutIfNeeded()
    }

    private func firstLayoutIfNeeded() {
        guard !didFirst, tree != nil, metrics != nil, bounds.width > 10 else { return }
        didFirst = true
        onFirstLayout(bounds.size)
    }

    // MARK: 坐标

    var zoom: CGFloat { zoomScale }
    /// 世界坐标的点 → 视口里的点
    func screen(_ p: CGPoint) -> CGPoint {
        let o = content.bounds.origin
        return CGPoint(x: (p.x - o.x) * zoomScale - contentOffset.x, y: (p.y - o.y) * zoomScale - contentOffset.y)
    }
    /// 让世界里的 p 落在视口的 s 处,要的 contentOffset
    func offset(placing p: CGPoint, at s: CGPoint, zoom z: CGFloat) -> CGPoint {
        let o = content.bounds.origin
        return CGPoint(x: (p.x - o.x) * z - s.x, y: (p.y - o.y) * z - s.y)
    }
    /// 视口里没被卡片挡住的那一块
    var clearRect: CGRect { bounds.size == .zero ? .zero : CGRect(origin: .zero, size: bounds.size).inset(by: obscured) }

    private func setContentBounds(_ b: CGRect) {
        // 换内容视图的 bounds(世界坐标的窗口)时同步改 contentOffset,屏上的东西一点不动
        let old = content.bounds.origin
        let z = zoomScale
        let off = contentOffset
        UIView.performWithoutAnimation {
            CATransaction.begin(); CATransaction.setDisableActions(true)
            content.bounds = b
            content.center = CGPoint(x: b.width * z / 2, y: b.height * z / 2)
            contentSize = CGSize(width: b.width * z, height: b.height * z)
            contentOffset = CGPoint(x: off.x + (b.minX - old.x) * z, y: off.y + (b.minY - old.y) * z)
            CATransaction.commit()
        }
    }

    // MARK: 排版

    /// 按当前展开重排。anchor:这个节点在屏上的位置不动;glide:排完把镜头滑到它(居中、可指定缩放)。
    func relayout(anchor: Int?, animated: Bool, glide: Int? = nil, glideZoom: CGFloat? = nil) {
        guard let tree, let metrics else { return }
        let t0 = CFAbsoluteTimeGetCurrent()
        var next = MindLayout.make(tree, metrics, open: openSet())
        let tMake = (CFAbsoluteTimeGetCurrent() - t0) * 1000
        let old = layout
        let hadOld = !old.frames.isEmpty
        if hadOld, let a = anchor ?? (old.frames[0] != nil ? 0 : nil), let o = old.frames[a], let n = next.frames[a] {
            next = next.shifted(CGPoint(x: o.minX - n.minX, y: o.minY - n.minY))
        }
        layout = next
        var b = next.bounds.insetBy(dx: -40, dy: -40)
        if hadOld { b = b.union(old.bounds.insetBy(dx: -40, dy: -40)) }   // 收起的节点滑走的那一段也在窗口里
        setContentBounds(b)
        let anim = animated && hadOld && !reduceMotion
        let dur: CFTimeInterval = 0.34
        CATransaction.begin()
        CATransaction.setDisableActions(!anim)
        CATransaction.setAnimationDuration(dur)
        CATransaction.setAnimationTimingFunction(CAMediaTimingFunction(controlPoints: 0.25, 0.1, 0.25, 1))
        // 节点
        var gone = Set(nodeLayers.keys)
        for id in next.order {
            gone.remove(id)
            let r = next.frames[id]!
            let f = layerFrame(id, r)
            let look = lookOf(id)
            if let l = nodeLayers[id] {
                l.position = CGPoint(x: f.midX, y: f.midY)
                l.opacity = 1
                if l.look != look { l.look = look; l.stale = true }
            } else {
                let l = MindNodeLayer()
                l.paint = paint
                l.nodeID = id
                l.look = look
                l.nodeRect = CGRect(x: MindPainter.margin, y: MindPainter.margin, width: r.width, height: r.height)
                l.bounds = CGRect(origin: .zero, size: f.size)
                l.contentsScale = targetScale()
                // 新出来的从父节点那里长出来
                CATransaction.begin(); CATransaction.setDisableActions(true)
                let p = tree[id].parent
                if anim, p >= 0, let pl = nodeLayers[p], let pr = old.frames[p] {
                    l.position = CGPoint(x: pr.maxX - f.width / 2 + MindPainter.margin, y: pl.position.y)
                    l.opacity = 0
                } else {
                    l.position = CGPoint(x: f.midX, y: f.midY)
                }
                CATransaction.commit()
                nodesLayer.addSublayer(l)
                nodeLayers[id] = l
                l.position = CGPoint(x: f.midX, y: f.midY)
                l.opacity = 1
            }
        }
        for id in gone {
            guard let l = nodeLayers.removeValue(forKey: id) else { continue }
            // 收起的缩回最近一个还看得见的祖先
            var p = tree[id].parent
            while p >= 0 && next.frames[p] == nil { p = tree[p].parent }
            if anim, p >= 0, let pr = next.frames[p] {
                l.position = CGPoint(x: pr.maxX - l.bounds.width / 2 + MindPainter.margin, y: pr.midY)
                l.opacity = 0
                DispatchQueue.main.asyncAfter(deadline: .now() + dur) { l.removeFromSuperlayer() }
            } else { l.removeFromSuperlayer() }
        }
        // 连线(按子节点记)
        var goneLinks = Set(linkLayers.keys)
        for id in next.order where id != 0 {
            goneLinks.remove(id)
            let n = tree[id]
            let r = next.frames[id]!, pr = next.frames[n.parent]!
            let path = MindPainter.link(from: MindPainter.linkStart(pr), to: CGPoint(x: r.minX, y: r.midY))
            if let s = linkLayers[id] {
                s.path = path
            } else {
                let s = CAShapeLayer()
                s.fillColor = nil
                s.strokeColor = linkColor(id)
                s.lineWidth = MindPainter.linkWidth(n.depth)
                s.lineCap = .round
                linksLayer.addSublayer(s)
                linkLayers[id] = s
                if anim, let opr = old.frames[n.parent] {
                    let a = MindPainter.linkStart(opr)
                    CATransaction.begin(); CATransaction.setDisableActions(true)
                    s.path = MindPainter.link(from: a, to: a)
                    s.opacity = 0
                    CATransaction.commit()
                }
                s.path = path
                s.opacity = 1
            }
        }
        for id in goneLinks {
            guard let s = linkLayers.removeValue(forKey: id) else { continue }
            var p = tree[id].parent
            while p >= 0 && next.frames[p] == nil { p = tree[p].parent }
            if anim, p >= 0, let pr = next.frames[p] {
                let a = MindPainter.linkStart(pr)
                s.path = MindPainter.link(from: a, to: a)
                s.opacity = 0
                DispatchQueue.main.asyncAfter(deadline: .now() + dur) { s.removeFromSuperlayer() }
            } else { s.removeFromSuperlayer() }
        }
        CATransaction.commit()
        #if DEBUG
        let ms = (CFAbsoluteTimeGetCurrent() - t0) * 1000
        print("[mindmap] relayout \(next.order.count)/\(tree.count) nodes in \(String(format: "%.1f", ms)) ms (tree layout \(String(format: "%.1f", tMake)) ms)")
        #endif
        if let g = glide { center(on: g, zoom: glideZoom, animated: animated) }
        renderVisible(force: false)
        // 动画走完再收一次窗口(去掉收起那段多留的地方)并补画
        DispatchQueue.main.asyncAfter(deadline: .now() + (anim ? dur + 0.05 : 0.01)) { [weak self] in
            guard let self else { return }
            self.setContentBounds(self.layout.bounds.insetBy(dx: -40, dy: -40))
            self.renderVisible(force: false)
        }
    }

    private func layerFrame(_ id: Int, _ r: CGRect) -> CGRect {
        let m = MindPainter.margin
        let extra: CGFloat = (tree?[id].children.isEmpty ?? true) ? 0 : MindStyle.bubbleGap + MindStyle.bubbleR * 2
        return CGRect(x: r.minX - m, y: r.minY - m, width: r.width + m * 2 + extra, height: r.height + m * 2)
    }

    /// 状态变了(选中、命中、学过…):只重画变了的节点。
    func refreshLooks() {
        for (id, l) in nodeLayers {
            let k = lookOf(id)
            if k != l.look { l.look = k; l.stale = true }
        }
        renderVisible(force: false)
    }

    private func targetScale() -> CGFloat {
        let s = (window?.screen.scale ?? traitCollection.displayScale)
        return min(max(s * zoomScale, 0.5), s * Self.maxZoom)
    }

    /// 看得见(连同四周半屏)的节点:没画过、内容变了、或分辨率不够当前缩放的,补画。
    func renderVisible(force: Bool) {
        let vis = content.convert(bounds, from: self).insetBy(dx: -bounds.width / (2 * zoomScale), dy: -bounds.height / (2 * zoomScale))
        let target = targetScale()
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for (_, l) in nodeLayers where l.frame.intersects(vis) {
            let need = l.stale || force || l.contentsScale < target * 0.92 || l.contentsScale > target * 2.2
            if need {
                l.contentsScale = target
                l.stale = false
                l.setNeedsDisplay()
            }
        }
        CATransaction.commit()
        lastRenderedZoom = zoomScale
    }

    // MARK: 镜头

    private func animateCamera(zoom z: CGFloat, offset: CGPoint, animated: Bool, duration: TimeInterval = 0.45) {
        let z = min(max(z, minimumZoomScale), Self.maxZoom)
        let work = {
            if abs(self.zoomScale - z) > 0.0001 { self.zoomScale = z }
            self.contentOffset = offset
        }
        if animated && !reduceMotion {
            UIView.animate(withDuration: duration, delay: 0, usingSpringWithDamping: 1, initialSpringVelocity: 0, options: [.allowUserInteraction, .beginFromCurrentState], animations: work) { _ in
                self.renderVisible(force: false); self.onCamera()
            }
        } else {
            work(); renderVisible(force: false); onCamera()
        }
    }

    /// 整棵(看得见的部分)放进视口。maxZoom:最多放到多大(小树不放得太大)。
    func fit(animated: Bool, maxZoom: CGFloat = 1.15) {
        guard !layout.frames.isEmpty else { return }
        fitRect(layout.bounds, animated: animated, maxZoom: maxZoom)
    }

    func fitRect(_ r: CGRect, animated: Bool, maxZoom: CGFloat = 1.15, minZoom: CGFloat = MindCanvasView.minZoom) {
        let c = clearRect.insetBy(dx: 18, dy: 18)
        guard c.width > 20, c.height > 20 else { return }
        let fitZ = min(c.width / max(r.width, 1), c.height / max(r.height, 1))
        // 整棵展开的大树:允许缩到放得下为止
        minimumZoomScale = min(Self.minZoom, fitZ * 0.85)
        let z = min(maxZoom, max(minZoom > Self.minZoom ? minZoom : 0, fitZ))
        let mid = CGPoint(x: r.midX, y: r.midY)
        // 缩放后宽度超出视口(minZoom 撑着)时,左缘对齐
        var s = CGPoint(x: c.midX, y: c.midY)
        if r.width * z > c.width { s.x = c.minX + r.width * z / 2 }
        if r.height * z > c.height { s.y = c.minY + r.height * z / 2 }
        animateCamera(zoom: z, offset: offset(placing: mid, at: s, zoom: z), animated: animated)
    }

    /// 镜头滑到节点(放在没被挡住那块的中间;太宽的节点靠左一些)。
    func center(on id: Int, zoom: CGFloat? = nil, animated: Bool) {
        guard let r = layout.frames[id] else { return }
        let z = zoom ?? zoomScale
        let c = clearRect
        var s = CGPoint(x: c.midX, y: c.midY)
        // 有子项又展开着:把节点放在偏左,让它的子项也进来
        if let t = tree, !t[id].children.isEmpty, openSet().contains(id) || id == 0 {
            s.x = c.minX + min(c.width * 0.3, c.width / 2 - r.width * z / 2) + r.width * z / 2
        }
        animateCamera(zoom: z, offset: offset(placing: CGPoint(x: r.midX, y: r.midY), at: s, zoom: z), animated: animated)
    }

    /// 节点在视口里能不能看清(整个在没被挡住的地方)
    func isComfortablyVisible(_ id: Int, checkZoom: Bool = true) -> Bool {
        guard let r = layout.frames[id] else { return false }
        let a = screen(r.origin), b = screen(CGPoint(x: min(r.maxX, r.minX + clearRect.width / zoomScale - 24), y: r.maxY))
        let c = clearRect.insetBy(dx: 12, dy: 12)
        return c.contains(a) && c.contains(b) && (!checkZoom || zoomScale >= 0.55)
    }

    var onObscuredChange: () -> Void = {}

    /// 一眼能读的缩放:节点字在屏上不小于约 13 点
    var readableZoom: CGFloat { 0.9 }

    func zoomTo(node id: Int, animated: Bool) {
        guard let r = layout.frames[id] else { return }
        let c = clearRect
        let z = min(Self.maxZoom, max(1.1, min(c.width * 0.62 / r.width, c.height * 0.4 / r.height, 2.2)))
        animateCamera(zoom: z, offset: offset(placing: CGPoint(x: r.midX, y: r.midY), at: CGPoint(x: c.midX, y: c.midY), zoom: z), animated: animated)
    }

    /// 存镜头用:缩放,和根节点左缘中点在视口里的位置(按视口比例)
    var camera: (zoom: CGFloat, rx: CGFloat, ry: CGFloat)? {
        guard let r = layout.frames[0], bounds.width > 0 else { return nil }
        let p = screen(CGPoint(x: r.minX, y: r.midY))
        return (zoomScale, p.x / bounds.width, p.y / bounds.height)
    }

    func restoreCamera(zoom z: CGFloat, rx: CGFloat, ry: CGFloat) {
        guard let r = layout.frames[0] else { return }
        let z = min(max(z, minimumZoomScale), Self.maxZoom)
        zoomScale = z
        contentOffset = offset(placing: CGPoint(x: r.minX, y: r.midY), at: CGPoint(x: rx * bounds.width, y: ry * bounds.height), zoom: z)
        renderVisible(force: false)
    }

    // MARK: 手势

    private func hit(_ p: CGPoint) -> (id: Int, bubble: Bool)? {
        guard let tree else { return nil }
        let z = zoomScale
        // 屏上至少 44 点见方的命中区
        for id in layout.order.reversed() {
            guard let r = layout.frames[id] else { continue }
            if !tree[id].children.isEmpty {
                let collapsed = !(id == 0 || openSet().contains(id))
                let c = MindPainter.bubbleCenter(r, collapsed: collapsed)
                let rad = max(16, 22 / z)
                if hypot(p.x - c.x, p.y - c.y) <= rad && p.x >= r.maxX - 2 { return (id, true) }
            }
            let dx = max(0, (44 / z - r.width) / 2), dy = max(0, (44 / z - r.height) / 2)
            if r.insetBy(dx: -dx, dy: -dy).contains(p) { return (id, false) }
        }
        return nil
    }

    /// 点在卡片 / 控制条底下的(被挡住的那一块)不算点画布
    private func inClear(_ g: UIGestureRecognizer) -> Bool {
        let s = g.location(in: self)
        guard clearRect.contains(CGPoint(x: s.x - contentOffset.x, y: s.y - contentOffset.y)) else { return false }
        let w = g.location(in: nil)
        return !blockedRects().contains { $0.insetBy(dx: -6, dy: -6).contains(w) }
    }

    @objc private func singleTap(_ g: UITapGestureRecognizer) {
        guard inClear(g) else { return }
        onInteract()
        let p = g.location(in: content)
        if let h = hit(p) { if h.bubble { onTapBubble(h.id) } else { onTapNode(h.id) } } else { onTapEmpty() }
    }

    @objc private func doubleTap(_ g: UITapGestureRecognizer) {
        guard inClear(g) else { return }
        onInteract()
        let p = g.location(in: content)
        if let h = hit(p), !h.bubble {
            if let r = layout.frames[h.id], r.width * zoomScale > clearRect.width * 0.45 { fit(animated: true) } else { zoomTo(node: h.id, animated: true) }
        } else if zoomScale >= Self.maxZoom * 0.8 {
            fit(animated: true)
        } else {
            let z = min(Self.maxZoom, zoomScale * 2)
            let s = g.location(in: self)
            let vis = CGPoint(x: s.x - contentOffset.x, y: s.y - contentOffset.y)
            animateCamera(zoom: z, offset: offset(placing: p, at: vis, zoom: z), animated: true, duration: 0.35)
        }
    }

    // MARK: UIScrollViewDelegate

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { content }

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        // 捏合当中:放大到原来的 1.6 倍以上就先补画一遍,不必等手指离开
        if zoomScale > lastRenderedZoom * 1.6 { renderVisible(force: false) }
    }
    func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
        renderVisible(force: false); onCamera()
    }
    private var lastScrollRender = Date.distantPast
    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        // 拖到新地方:新进来的节点要画;一秒最多查十次
        let now = Date()
        if now.timeIntervalSince(lastScrollRender) > 0.1 { lastScrollRender = now; renderVisible(force: false) }
    }
    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) { onInteract() }
    func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) { onInteract() }
    func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) { renderVisible(force: false); onCamera() }
    func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate d: Bool) { if !d { renderVisible(force: false); onCamera() } }
}

/// SwiftUI 里放画布;状态都在 MindMapModel 里,画布由它直接驱动。
struct MindCanvasRep: UIViewRepresentable {
    let model: MindMapModel
    var obscured: UIEdgeInsets
    func makeUIView(context: Context) -> MindCanvasView {
        let v = MindCanvasView(frame: .zero)
        model.attach(v)
        return v
    }
    func updateUIView(_ v: MindCanvasView, context: Context) {
        if v.obscured != obscured {
            v.obscured = obscured
            // 卡片出来 / 换高度:选中的节点要是被挡住了,挪出来
            DispatchQueue.main.async { v.onObscuredChange() }
        }
    }
}
