import SwiftUI
import Observation

/// 一本书脑图的全部阅读状态:画布与提纲共用(展开、选中、搜索、走读、「这一章」)。画布由它直接驱动。
@MainActor
@Observable
final class MindMapModel {
    let book: BookInfo
    let pack: BookPack?
    let tree: MindTree
    private(set) var metrics: MindMetrics?

    var open: Set<Int> = []
    var selected: Int?
    var outline = false
    /// 「这一章在全书里的位置」:这些节点标出来
    var focus: Set<Int> = []
    var focusChapter: Int?
    // 搜索
    var searching = false
    var query = "" { didSet { if query != oldValue { runSearch() } } }
    private(set) var matches: [Int] = []
    var matchPos = 0
    // 走读
    private(set) var walk: [Int]?
    var walkPos = 0
    /// 最近一次点的「展开到第几层」(按钮点亮用);手动收放后清掉
    var level: Int?
    /// 提纲里要滚到的节点(选中变了就滚过去)
    var outlineScrollTarget: Int?

    @ObservationIgnored private(set) weak var canvas: MindCanvasView?
    @ObservationIgnored let clock = ReadClock()
    @ObservationIgnored private var saved: MindMapUIState?
    @ObservationIgnored private var saveWork: DispatchWorkItem?
    @ObservationIgnored var reduceMotion = false
    @ObservationIgnored private var pendingFit: (CGRect, Date)?
    #if DEBUG
    @ObservationIgnored private let env = ProcessInfo.processInfo.environment
    #endif

    init(book: BookInfo, tree: MindTree, focusChapter: Int? = nil) {
        self.book = book
        self.pack = Library.shared.pack(book)
        self.tree = tree
        self.focusChapter = focusChapter
        saved = MindMapUIState.load(book.id)
        if let s = saved {
            open = Set(s.open.compactMap { tree.node(path: $0) }.filter { !tree[$0].children.isEmpty })
            selected = s.sel.flatMap { tree.node(path: $0) }
            outline = s.outline
        }
        #if DEBUG
        if env["DESK_MAP_MODE"] == "outline" { outline = true }
        if env["DESK_MAP_MODE"] == "canvas" { outline = false }
        if env["DESK_MAP_FRESH"] == "1" { saved = nil; open = []; selected = nil; outline = env["DESK_MAP_MODE"] == "outline" }
        #endif
        let t = tree
        Task.detached(priority: .userInitiated) {
            let t0 = CFAbsoluteTimeGetCurrent()
            let m = MindMetrics.measure(t)
            let ms = (CFAbsoluteTimeGetCurrent() - t0) * 1000
            await MainActor.run {
                #if DEBUG
                print("[mindmap] measured \(t.count) nodes in \(String(format: "%.1f", ms)) ms (background)")
                #endif
                self.metrics = m
                if let c = self.canvas { self.loadCanvas(c) }
            }
        }
    }

    // MARK: 画布

    func attach(_ c: MindCanvasView) {
        canvas = c
        c.reduceMotion = reduceMotion
        c.lookOf = { [weak self] in self?.look($0) ?? MindNodeLook() }
        c.openSet = { [weak self] in self?.open ?? [] }
        c.onTapNode = { [weak self] in self?.tapNode($0) }
        c.onTapBubble = { [weak self] in self?.toggle($0) }
        c.onTapEmpty = { [weak self] in
            guard let self else { return }
            if self.walk == nil { self.selected = nil; self.afterSelect(glide: false) }
        }
        c.onInteract = { [weak self] in self?.clock.touch() }
        c.onCamera = { [weak self] in self?.scheduleSave() }
        c.onFirstLayout = { [weak self] size in self?.initialView(size) }
        c.onObscuredChange = { [weak self] in
            guard let self, let s = self.selected, let c = self.canvas, !self.outline, c.layout.frames[s] != nil else { return }
            // 刚聚焦了「这一章」:卡片量好高度后按让开卡片的视口重新框一次
            if let (r, until) = self.pendingFit, Date() < until { c.fitRect(r, animated: true, maxZoom: 1.05, minZoom: 0.55); return }
            if !c.isComfortablyVisible(s, checkZoom: false) { c.center(on: s, animated: true) }
        }
        if metrics != nil { loadCanvas(c) }
    }

    private func loadCanvas(_ c: MindCanvasView) {
        guard let m = metrics, c.tree == nil else { return }
        c.load(tree, metrics: m, theme: book.theme)
    }

    /// 第一次摆:「这一章」→ 展开到那几个节点并框住;存过的 → 照原样;都没有 → 根 + 一级,放得下就再展开二级。
    private func initialView(_ size: CGSize) {
        guard let c = canvas, let m = metrics else { return }
        #if DEBUG
        if let l = env["DESK_MAP_LEVEL"] {
            level = l == "all" ? 99 : (Int(l) ?? 1)
            open = tree.openSet(level: level!)
            c.relayout(anchor: nil, animated: false)
            if let p = env["DESK_MAP_NODE"], let id = tree.node(path: p) { expandPath(id); selected = id; c.relayout(anchor: nil, animated: false); afterSelect(glide: false) }
            if env["DESK_MAP_ZOOM"] == "in", let s = selected { c.zoomTo(node: s, animated: false) }
            else if let z = env["DESK_MAP_ZOOM"].flatMap(Double.init) { c.fit(animated: false, maxZoom: 3); c.restoreCamera(zoom: z, rx: 0.06, ry: 0.5) }
            else if let s = selected { c.center(on: s, zoom: 0.95, animated: false) }
            else { c.fit(animated: false, maxZoom: 1.1) }
            debugAfterOpen()
            return
        }
        #endif
        if let ch = focusChapter, !tree.nodes(forChapter: ch).isEmpty {
            if saved == nil { open = tree.openSet(level: 1) }
            c.relayout(anchor: nil, animated: false)
            showChapter(ch, animated: false)
        } else if let s = saved {
            c.relayout(anchor: nil, animated: false)
            if let z = s.zoom, let rx = s.rootX, let ry = s.rootY { c.restoreCamera(zoom: CGFloat(z), rx: CGFloat(rx), ry: CGFloat(ry)) }
            else { c.fit(animated: false) }
            refreshLooks()
        } else {
            let two = MindLayout.make(tree, m, open: tree.openSet(level: 2))
            let clear = CGRect(origin: .zero, size: size).inset(by: c.obscured).insetBy(dx: 18, dy: 70)
            let z = min(clear.width / two.bounds.width, clear.height / two.bounds.height)
            // 二级放进屏里字还看得清(缩放 ≥ 0.62,二级正文约 9 点以上)才展开二级
            open = tree.openSet(level: z >= 0.62 ? 2 : 1)
            level = z >= 0.62 ? 2 : 1
            c.relayout(anchor: nil, animated: false)
            c.fit(animated: false, maxZoom: 1.1)
        }
        #if DEBUG
        debugAfterOpen()
        #endif
    }

    /// 提纲模式下第一次出现(画布没建):调试参数在这里生效
    func outlineAppeared() {
        #if DEBUG
        guard canvas == nil else { return }
        if let l = env["DESK_MAP_LEVEL"] { level = l == "all" ? 99 : (Int(l) ?? 1); open = tree.openSet(level: level!) }
        if let p = env["DESK_MAP_NODE"], let id = tree.node(path: p) { expandPath(id); selected = id; afterSelect(glide: false) }
        if let q = env["DESK_MAP_Q"] { searching = true; query = q; if !matches.isEmpty { jumpMatch(0) } }
        #endif
    }

    #if DEBUG
    private func debugAfterOpen() {
        if let q = env["DESK_MAP_Q"] { searching = true; query = q; if !matches.isEmpty { jumpMatch(0) } }
        if let w = env["DESK_MAP_WALK"], let k = Int(w) { startWalk(from: 0); for _ in 0..<k { walkStep(1, animated: false) } }
        if env["DESK_MAP_SHARE"] == "1" { DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.share() } }
    }
    #endif

    // MARK: 状态 → 画法

    private func chapterSrc(_ ch: Int) -> Src? { pack?.chapters[safe: ch - 1]?.src }
    private func learned(_ ch: Int) -> Bool { chapterSrc(ch).map { Stats.shared.learned($0) } ?? false }
    private var readingCh: Int? { ProgressStore.shared.pos[book.id]?.ch }

    func look(_ id: Int) -> MindNodeLook {
        let n = tree[id]
        var k = MindNodeLook()
        k.selected = selected == id
        k.match = searching && !query.isEmpty && matchSet.contains(id)
        if let ch = n.ch { k.learned = learned(ch); k.reading = ch == readingCh && !(n.parent >= 0 && tree[n.parent].ch == ch) }
        k.focus = focus.contains(id)
        k.hasKids = !n.children.isEmpty
        k.collapsedKids = (k.hasKids && !(id == 0 || open.contains(id))) ? n.children.count : 0
        k.hasNote = n.note != nil
        if n.depth == 1 {
            let chs = tree.chapters(inSubtree: id)
            if !chs.isEmpty { k.progress = Double(chs.filter(learned).count) / Double(chs.count) }
        }
        return k
    }
    @ObservationIgnored private var matchSet = Set<Int>()

    func refreshLooks() { canvas?.refreshLooks() }

    // MARK: 操作

    func isOpen(_ id: Int) -> Bool { id == 0 || open.contains(id) }

    /// 点节点:选中;收着的顺手展开;已经选中的再点一下收放。
    func tapNode(_ id: Int) {
        let was = selected == id
        selected = id
        if walk != nil, let p = walk?.firstIndex(of: id) { walkPos = p }
        if !tree[id].children.isEmpty && (!isOpen(id) || was) && id != 0 {
            toggle(id)
        } else {
            afterSelect(glide: false)
        }
    }

    func toggle(_ id: Int) {
        guard id != 0, !tree[id].children.isEmpty else { return }
        clock.touch()
        if open.contains(id) { open.remove(id) } else { open.insert(id) }
        level = nil
        canvas?.relayout(anchor: id, animated: true)
        // 展开后子项伸出屏外:镜头往里挪一些
        if open.contains(id), let c = canvas, let last = tree[id].children.last, let r = c.layout.frames[last], let f = c.layout.frames[tree[id].children[0]] {
            let a = c.screen(CGPoint(x: f.minX, y: f.minY)), b = c.screen(CGPoint(x: r.maxX, y: r.maxY))
            let clear = c.clearRect.insetBy(dx: 10, dy: 10)
            if !clear.contains(a) || !clear.contains(b) {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.36) { if !(self.canvas?.isComfortablyVisible(last) ?? true) { self.canvas?.center(on: id, animated: true) } }
            }
        }
        afterSelect(glide: false)
    }

    /// 展开到第 n 层(99 = 全部)。
    func setLevel(_ n: Int) {
        clock.touch()
        open = tree.openSet(level: n)
        level = n
        // 选中的节点收进去了就不选了
        if let s = selected, !tree.ancestry(s).dropLast().allSatisfy(isOpen) { selected = nil }
        canvas?.relayout(anchor: selected ?? 0, animated: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { self.canvas?.fit(animated: true, maxZoom: 1.1) }
        afterSelect(glide: false)
    }

    func fit() { clock.touch(); canvas?.fit(animated: true, maxZoom: 1.1) }

    /// 展开它的所有祖先;有变化返回 true。
    @discardableResult func expandPath(_ id: Int) -> Bool {
        var changed = false
        for a in tree.ancestry(id).dropLast() where a != 0 && !open.contains(a) { open.insert(a); changed = true }
        if changed { level = nil }
        return changed
    }

    /// 选中某节点并让它出现在视野里(搜索、走读、面包屑、上下兄弟)。
    func reveal(_ id: Int, zoomIfSmall: Bool = true, animated: Bool = true) {
        clock.touch()
        let changed = expandPath(id)
        let anchor = selected
        selected = id
        guard let c = canvas, !outline else { afterSelect(glide: false); return }
        let z: CGFloat? = (zoomIfSmall && c.zoom < 0.8) ? 0.95 : nil
        if changed {
            c.relayout(anchor: anchor ?? 0, animated: animated, glide: id, glideZoom: z)
        } else if !c.isComfortablyVisible(id) || z != nil {
            c.center(on: id, zoom: z, animated: animated)
        }
        afterSelect(glide: false)
    }

    func afterSelect(glide: Bool) {
        refreshLooks()
        clock.start(clockSrc())
        outlineScrollTarget = selected
        scheduleSave()
    }

    /// 上一个 / 下一个兄弟
    func sibling(_ d: Int) -> Int? {
        guard let s = selected, s != 0 else { return nil }
        let p = tree[s].parent
        return tree[p].children[safe: tree[s].index + d]
    }

    // MARK: 这一章

    func showChapter(_ ch: Int, animated: Bool) {
        let ids = tree.nodes(forChapter: ch)
        guard !ids.isEmpty, let c = canvas else { return }
        focusChapter = ch
        focus = Set(ids)
        for id in ids { expandPath(id); if !tree[id].children.isEmpty { open.insert(id) } }
        selected = ids[0]
        c.relayout(anchor: 0, animated: animated)
        // 框住这一章的节点(连同它们展开的子项)
        var r = CGRect.null
        for id in ids { for k in id...tree[id].subtreeEnd { if let f = c.layout.frames[k] { r = r.union(f) } } }
        if !r.isNull {
            let rr = r.insetBy(dx: -30, dy: -30)
            c.fitRect(rr, animated: animated, maxZoom: 1.05, minZoom: 0.55)
            pendingFit = (rr, Date().addingTimeInterval(1.2))
        }
        afterSelect(glide: false)
    }

    // MARK: 搜索

    private func runSearch() {
        matches = tree.search(query)
        matchSet = Set(matches)
        matchPos = 0
        refreshLooks()
    }

    func jumpMatch(_ i: Int) {
        guard !matches.isEmpty else { return }
        matchPos = (i + matches.count) % matches.count
        reveal(matches[matchPos])
    }

    func endSearch() { searching = false; query = ""; refreshLooks() }

    // MARK: 走读

    var walking: Bool { walk != nil }
    var walkCount: Int { walk?.count ?? 0 }

    /// 从某个节点开始走读:先序走遍它这一支(从根开始就是整本书)。
    func startWalk(from id: Int) {
        clock.touch()
        var end = tree[id].subtreeEnd
        // 从末梢起步:接着把它所在的这一支走完(只走一个节点没有意思)
        if end - id < 2, tree[id].branch >= 0 { end = max(end, tree[tree[0].children[tree[id].branch]].subtreeEnd) }
        let ids = Array(id...end)
        walk = ids
        walkPos = 0
        outline = false
        reveal(ids[0])
    }

    func walkStep(_ d: Int, animated: Bool = true) {
        guard let w = walk else { return }
        let p = walkPos + d
        guard w.indices.contains(p) else { return }
        walkPos = p
        let id = w[p]
        // 走到一个有子项的节点:顺手展开,下一步要去的子项就在旁边
        if !tree[id].children.isEmpty && !open.contains(id) && id != 0 { open.insert(id); expandPathAndRelayout(id, animated: animated) }
        else { reveal(id, animated: animated) }
    }

    private func expandPathAndRelayout(_ id: Int, animated: Bool) {
        expandPath(id)
        let anchor = selected ?? 0
        selected = id
        guard let c = canvas else { afterSelect(glide: false); return }
        c.relayout(anchor: anchor, animated: animated, glide: id, glideZoom: c.zoom < 0.8 ? 0.95 : nil)
        afterSelect(glide: false)
    }

    func endWalk() { walk = nil; walkPos = 0 }

    // MARK: 计时

    /// 脑图上的时长:记在选中节点(或最近的祖先)对应的那一章;都没有记在全书第一章。
    func clockSrc() -> Src {
        let ch = selected.flatMap { tree[$0].effCh } ?? 1
        return chapterSrc(ch) ?? chapterSrc(1) ?? Src(corpus: DeskbookInstaller.corpus, slug: book.id, ch: 1)
    }

    // MARK: 存

    func scheduleSave() {
        saveWork?.cancel()
        let w = DispatchWorkItem { [weak self] in self?.saveNow() }
        saveWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6, execute: w)
    }

    func saveNow() {
        var s = MindMapUIState(open: open.map { tree[$0].path }.sorted(), sel: selected.map { tree[$0].path }, outline: outline)
        if let cam = canvas?.camera { s.zoom = Double(cam.zoom); s.rootX = Double(cam.rx); s.rootY = Double(cam.ry) }
        else if let o = saved { s.zoom = o.zoom; s.rootX = o.rootX; s.rootY = o.rootY }
        s.save(book.id)
        saved = s
    }

    // MARK: 分享

    /// 把现在展开着的整棵树(不只是屏上这一块)画成一张图,走分享菜单。
    func share() {
        guard let m = metrics else { return }
        let layout = MindLayout.make(tree, m, open: open)
        var looks: [Int: MindNodeLook] = [:]
        for id in layout.order { looks[id] = look(id) }
        let img = MindExport.image(tree: tree, metrics: m, layout: layout, looks: looks, book: book)
        let url = Share.tmp(Share.safeName(book.title) + " · 思想脑图.png")
        try? img.pngData()?.write(to: url)
        #if DEBUG
        if env["DESK_MAP_SHARE"] == "1" {
            let out = URL(fileURLWithPath: env["DESK_MAP_SHARE_OUT"] ?? NSTemporaryDirectory() + "mindmap-export.png")
            try? img.pngData()?.write(to: out)
            print("[mindmap] exported \(Int(img.size.width))×\(Int(img.size.height)) @\(img.scale)x → \(out.path)")
            return
        }
        #endif
        Share.present([url])
    }
}
