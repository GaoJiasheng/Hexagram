import SwiftUI

/// 从脑图里打开的那一章,在章末点「这一章在全书里的位置」:不再叠一层脑图,而是退回原来那张脑图并聚焦到这一章。
private struct MindMapReturnKey: EnvironmentKey { static let defaultValue: ((Int) -> Void)? = nil }
extension EnvironmentValues {
    var mindMapReturn: ((Int) -> Void)? {
        get { self[MindMapReturnKey.self] }
        set { self[MindMapReturnKey.self] = newValue }
    }
}

/// 脑图全屏页。onRead:点「读这一章」交给调用方(从文章章末进来时:退回文章、换章);
/// 为 nil 时脑图自己把那一章盖在上面打开,读完退回来,脑图原样还在。
struct MindMapScreen: View {
    let book: BookInfo
    var focusChapter: Int? = nil
    var onRead: ((Int) -> Void)? = nil
    /// 打开就从根开始走读
    var walk = false
    @State private var model: MindMapModel?
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        Group {
            if let model { MindMapView(model: model, onRead: onRead, close: { dismiss() }) }
            else {
                VStack(spacing: 10) {
                    Text("这本书的脑图打不开").font(Fonts.song(18, bold: true)).foregroundStyle(Ink.text)
                    Button("关闭") { dismiss() }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity).background(book.theme.paperColor.ignoresSafeArea())
            }
        }
        .onAppear {
            guard model == nil, let t = MindMapStore.tree(book) else { return }
            let m = MindMapModel(book: book, tree: t, focusChapter: focusChapter)
            if walk { m.outline = false; m.autoWalk = true }
            model = m
        }
    }
}

private struct ReadingTarget: Identifiable { let id = UUID(); let ch: Int }

struct MindMapView: View {
    @Bindable var model: MindMapModel
    var onRead: ((Int) -> Void)?
    let close: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var phase
    @State private var cardH: CGFloat = 0
    @State private var reading: ReadingTarget?
    @FocusState private var searchFocus: Bool
    private var book: BookInfo { model.book }
    private var theme: BookTheme { book.theme }
    private var accent: Color { theme.accentColor }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let side = w > h && w >= 900          // iPad 横屏:卡片靠右
            let cardW: CGFloat = side ? min(400, w * 0.34) : min(w - 24, 640)
            let showCard = model.selected != nil || model.walking
            let controlsH: CGFloat = model.walking ? 0 : 58
            let obscured: UIEdgeInsets = side
                ? UIEdgeInsets(top: geo.safeAreaInsets.top + 56, left: 0, bottom: controlsH + geo.safeAreaInsets.bottom, right: showCard ? cardW + 24 : 0)
                : UIEdgeInsets(top: geo.safeAreaInsets.top + (model.searching ? 104 : 56), left: 0, bottom: (showCard ? cardH + 12 : 0) + controlsH + geo.safeAreaInsets.bottom, right: 0)
            ZStack(alignment: .topLeading) {
                theme.paperColor.ignoresSafeArea()
                if model.outline {
                    MindOutlineView(model: model, onRead: read, topInset: geo.safeAreaInsets.top + (model.searching ? 108 : 60), bottomInset: controlsH + 24)
                        .ignoresSafeArea()
                        .transition(.opacity)
                        .onAppear { model.outlineAppeared() }
                    // 顶上垫一层纸色,滚上去的字不从按钮底下穿过
                    LinearGradient(stops: [.init(color: theme.paperColor, location: 0), .init(color: theme.paperColor, location: 0.78), .init(color: theme.paperColor.opacity(0), location: 1)],
                                   startPoint: .top, endPoint: .bottom)
                        .frame(height: geo.safeAreaInsets.top + (model.searching ? 150 : 100))
                        .ignoresSafeArea(edges: .top)
                        .allowsHitTesting(false)
                } else {
                    MindCanvasRep(model: model, obscured: obscured)
                        .ignoresSafeArea()
                        .transition(.opacity)
                    // 状态栏那一条垫一层淡纸色,时间与电量不压在节点上
                    LinearGradient(colors: [theme.paperColor.opacity(0.92), theme.paperColor.opacity(0)], startPoint: .top, endPoint: .bottom)
                        .frame(height: geo.safeAreaInsets.top + 24)
                        .ignoresSafeArea(edges: .top)
                        .allowsHitTesting(false)
                }
                topBar(geo).padding(.top, geo.safeAreaInsets.top)
                    .ignoresSafeArea(edges: .top)
                // 下沿:层级与适应屏幕
                VStack(spacing: 10) {
                    Spacer(minLength: 0)
                    if !model.walking {
                        controls.frame(maxWidth: .infinity, alignment: side ? .leading : .center)
                            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { model.chromeRects["controls"] = $0 }
                            .onDisappear { model.chromeRects["controls"] = nil }
                    }
                    if showCard && !side && !model.outline {
                        MindNodeCard(model: model, onRead: read)
                            .frame(maxWidth: cardW, maxHeight: h * (model.walking ? 0.46 : 0.42))
                            .fixedSize(horizontal: false, vertical: true)
                            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { cardH = $0 }
                            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { model.chromeRects["card"] = $0 }
                            .onDisappear { model.chromeRects["card"] = nil }
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, max(geo.safeAreaInsets.bottom, 12))
                .ignoresSafeArea(edges: .bottom)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                if showCard && side && !model.outline {
                    MindNodeCard(model: model, onRead: read, tall: true)
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { model.chromeRects["card"] = $0 }
                        .onDisappear { model.chromeRects["card"] = nil }
                        .frame(width: cardW)
                        .frame(maxHeight: h - 90, alignment: .top)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.trailing, 16).padding(.top, 64)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
            .animation(reduceMotion ? nil : .spring(response: 0.34, dampingFraction: 0.9), value: showCard)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.22), value: model.outline)
        }
        .statusBarHidden(false)
        .onAppear {
            model.reduceMotion = reduceMotion
            model.clock.start(model.clockSrc())
        }
        .onDisappear { model.clock.stop(); model.saveNow() }
        .onChange(of: phase) { _, p in if p == .active && reading == nil { model.clock.start(model.clockSrc()) } else { model.clock.settle(); model.saveNow() } }
        .onChange(of: model.outline) { _, _ in model.scheduleSave() }
        .fullScreenCover(item: $reading, onDismiss: {
            model.clock.start(model.clockSrc())
            model.refreshLooks()      // 读过回来,学过的标记可能变了
        }) { r in readingScreen(r.ch) }
    }

    // MARK: 读这一章

    private func read(_ ch: Int) {
        model.clock.touch()
        if let onRead { model.saveNow(); onRead(ch); return }
        model.clock.settle()
        reading = ReadingTarget(ch: ch)
    }

    @ViewBuilder private func readingScreen(_ ch: Int) -> some View {
        if let pack = model.pack, pack.chapters.indices.contains(ch - 1) {
            Group {
                if book.isArticleBook {
                    ArticleBookScreen(book: book, pack: pack, start: ReadPos(ch: ch, seg: BaihuaPos.get(book.id, ch) ?? 0, at: Date()))
                } else {
                    ReaderScreen(model: ReaderModel(book: book, pack: pack, start: ReadPos(ch: ch, seg: 0, at: Date())))
                }
            }
            .environment(\.mindMapReturn) { back in
                reading = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { model.showChapter(back, animated: true) }
            }
        }
    }

    // MARK: 顶栏

    private func topBar(_ geo: GeometryProxy) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                MindFloatButton(icon: "chevron.left", label: "返回") { close() }
                titleBlock(fixed: false)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                MindFloatButton(icon: "magnifyingglass", label: "在脑图里找", on: model.searching) {
                    model.searching.toggle()
                    if model.searching { searchFocus = true } else { model.endSearch() }
                }
                modeToggle
                MindFloatButton(icon: "square.and.arrow.up", label: "分享整张脑图") { model.share() }
            }
            .padding(.horizontal, 14).padding(.top, 4)
            if model.searching { searchBar.padding(.horizontal, 14).transition(.move(edge: .top).combined(with: .opacity)) }
        }
        .animation(.easeInOut(duration: 0.2), value: model.searching)
    }

    private func titleBlock(fixed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(book.title).font(Fonts.song(15, bold: true)).foregroundStyle(Ink.text).lineLimit(1)
                .fixedSize(horizontal: fixed, vertical: false)
            Text("思想脑图 · \(model.tree.count)").font(.system(size: 11, weight: .medium)).foregroundStyle(Ink.soft).lineLimit(1)
                .fixedSize()
        }
        .padding(.horizontal, 12).padding(.vertical, 5)
        .background(.ultraThinMaterial, in: Capsule())
    }

    private var modeToggle: some View {
        HStack(spacing: 0) {
            ForEach([false, true], id: \.self) { o in
                Button {
                    model.clock.touch()
                    if o { model.endWalk() }
                    model.outline = o
                } label: {
                    Image(systemName: o ? "list.bullet.indent" : "point.3.connected.trianglepath.dotted")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 38, height: 32)
                        .foregroundStyle(model.outline == o ? Color.white : Ink.text)
                        .background(model.outline == o ? accent : .clear, in: Capsule())
                }
                .accessibilityLabel(o ? "提纲" : "画布")
                .accessibilityAddTraits(model.outline == o ? .isSelected : [])
            }
        }
        .padding(3)
        .background(.ultraThinMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.08), radius: 4, y: 1)
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").font(.system(size: 13, weight: .semibold)).foregroundStyle(Ink.faint)
            TextField("找节点里的字", text: $model.query)
                .font(.system(size: 15))
                .focused($searchFocus)
                .submitLabel(.search)
                .onSubmit { model.jumpMatch(model.matchPos) }
            if !model.query.isEmpty {
                Text(model.matches.isEmpty ? "没有" : "\(model.matchPos + 1) / \(model.matches.count)")
                    .font(Fonts.num(12, weight: .semibold)).foregroundStyle(model.matches.isEmpty ? Ink.faint : Ink.soft)
                    .monospacedDigit()
                Button { model.jumpMatch(model.matchPos - 1) } label: { Image(systemName: "chevron.up") }
                    .disabled(model.matches.isEmpty).accessibilityLabel("上一处")
                Button { model.jumpMatch(model.matchPos + 1) } label: { Image(systemName: "chevron.down") }
                    .disabled(model.matches.isEmpty).accessibilityLabel("下一处")
            }
        }
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(accent)
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(.regularMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
        .frame(maxWidth: 520)
    }

    // MARK: 下沿的控制条

    private var controls: some View {
        HStack(spacing: 4) {
            Text("展开").font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Ink.soft).padding(.leading, 8).padding(.trailing, 2)
            ForEach([1, 2, 3, 99], id: \.self) { n in
                if n < model.tree.maxDepth || n == 99 {
                    Button { model.setLevel(n) } label: {
                        Text(n == 99 ? "全" : Numerals.chinese(n)).font(Fonts.song(15, bold: true))
                            .frame(width: 36, height: 36)
                            .foregroundStyle(model.level == n ? Color.white : Ink.text)
                            .background(model.level == n ? accent : Color.clear, in: Circle())
                    }
                    .accessibilityLabel(n == 99 ? "全部展开" : "展开到第 \(n) 层")
                }
            }
            Rectangle().fill(Ink.line).frame(width: 1, height: 22).padding(.horizontal, 4)
            if !model.outline {
                Button { model.fit() } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right").font(.system(size: 14, weight: .semibold)).frame(width: 36, height: 36)
                }
                .foregroundStyle(Ink.text).accessibilityLabel("适应屏幕")
            }
            Button { model.startWalk(from: model.selected ?? 0) } label: {
                HStack(spacing: 4) {
                    Image(systemName: "play.fill").font(.system(size: 11, weight: .bold))
                    Text(model.selected.map { $0 == 0 ? "走读" : "从这里走读" } ?? "走读").font(.system(size: 13.5, weight: .semibold))
                }
                .padding(.horizontal, 12).frame(height: 36)
                .foregroundStyle(accent)
                .background(accent.opacity(0.12), in: Capsule())
            }
            .accessibilityHint("一个节点一个节点地讲下去")
        }
        .padding(4)
        .background(.regularMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.1), radius: 8, y: 2)
    }
}

/// 悬浮的圆钮(与文章页同一套样子)。
struct MindFloatButton: View {
    let icon: String
    let label: String
    var on = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold)).frame(width: 38, height: 38)
                .foregroundStyle(on ? Color.white : Ink.text)
                .background { if on { Circle().fill(Ink.text.opacity(0.85)) } else { Circle().fill(.ultraThinMaterial) } }
                .shadow(color: .black.opacity(0.08), radius: 4, y: 1)
        }
        .accessibilityLabel(label)
    }
}

/// 节点卡:面包屑、整句、展开说明、上下兄弟、「读这一章」;走读时换成走读的进度与上一步 / 下一步。
struct MindNodeCard: View {
    @Bindable var model: MindMapModel
    let onRead: (Int) -> Void
    var tall = false
    @State private var drag: CGFloat = 0
    private var accent: Color { model.book.theme.accentColor }

    /// 标签是长句截下的开头(以「…」收,或展开说明就以它起头):卡片上直接用说明里的整句当标题,不重复
    static func texts(_ n: MindTree.Node) -> (head: String, body: String?) {
        let lab = n.label.hasSuffix("…") ? String(n.label.dropLast()) : n.label
        if let note = n.note, BHText.plain(note).hasPrefix(lab) {
            // 整句 = 说明里从头到标签之后第一个句末标点(。!?;或换行);其余是展开
            let chars = Array(note)
            var cut = chars.count
            var i = min(lab.count, chars.count)
            while i < chars.count {
                if "\n".contains(chars[i]) { cut = i; break }
                if "\u{3002}\u{FF01}\u{FF1F}\u{FF1B}!?".contains(chars[i]) { cut = i + 1; break }
                i += 1
            }
            let head = String(chars[..<cut]).trimmingCharacters(in: .whitespacesAndNewlines)
            let rest = String(chars[cut...]).trimmingCharacters(in: .whitespacesAndNewlines)
            return (head, rest.isEmpty ? nil : rest)
        }
        return (n.label, n.note)
    }

    var body: some View {
        if let id = model.selected {
            let n = model.tree[id]
            let hue = MindPalette.hueColor(model.book.theme, branches: model.tree.branches, branch: n.branch)
            VStack(alignment: .leading, spacing: 0) {
                header(n, hue: hue)
                ScrollView {
                    content(n, hue: hue).padding(.horizontal, 18).padding(.bottom, 12)
                }
                .scrollBounceBehavior(.basedOnSize)
                Divider().overlay(Ink.line)
                footer(n)
            }
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Ink.line, lineWidth: 0.8))
            .shadow(color: .black.opacity(0.14), radius: 18, y: 6)
            .offset(x: drag)
            .gesture(model.walking ? DragGesture(minimumDistance: 24).onChanged { drag = $0.translation.width * 0.35 }.onEnded { v in
                withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { drag = 0 }
                if v.translation.width < -50 { model.walkStep(1) } else if v.translation.width > 50 { model.walkStep(-1) }
            } : nil)
        }
    }

    private func header(_ n: MindTree.Node, hue: Color) -> some View {
        HStack(alignment: .center, spacing: 8) {
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        // 面包屑只列祖先(自己就是下面的标题);根节点卡片上写「全书的中心」
                        let path = Array(model.tree.ancestry(n.id).dropLast())
                        if path.isEmpty { Text("全书的中心").font(.system(size: 12, weight: .semibold)).foregroundStyle(hue).id(n.id) }
                        ForEach(Array(path.enumerated()), id: \.element) { i, a in
                            if i > 0 { Image(systemName: "chevron.right").font(.system(size: 8, weight: .bold)).foregroundStyle(Ink.faint) }
                            Button { model.reveal(a) } label: {
                                Text(crumb(model.tree[a])).font(.system(size: 12)).foregroundStyle(Ink.soft).lineLimit(1)
                            }
                            .buttonStyle(.plain).id(a == path.last ? n.id : a)
                        }
                    }
                    .padding(.vertical, 2)
                }
                .onAppear { proxy.scrollTo(n.id, anchor: .trailing) }
                .onChange(of: n.id) { _, v in proxy.scrollTo(v, anchor: .trailing) }
            }
            Spacer(minLength: 0)
            Button { model.selected = nil; model.endWalk(); model.afterSelect(glide: false) } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Ink.soft)
                    .frame(width: 28, height: 28).background(Ink.line.opacity(0.6), in: Circle())
            }
            .accessibilityLabel(model.walking ? "结束走读" : "收起卡片")
        }
        .padding(.leading, 18).padding(.trailing, 12).padding(.top, 12).padding(.bottom, 6)
    }

    private func crumb(_ n: MindTree.Node) -> String {
        n.depth == 0 ? "根" : (n.label.count > 14 ? String(n.label.prefix(13)) + "…" : n.label)
    }

    private func content(_ n: MindTree.Node, hue: Color) -> some View {
        let t = Self.texts(n)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if n.depth > 0 { RoundedRectangle(cornerRadius: 2).fill(hue).frame(width: 4, height: 16) }
                // 短的是标题(粗);整句的不加粗,读起来是一句话
                let sentence = t.head.count > 28
                Text(BHAttr.text(t.head, accent: accent)).font(Fonts.song(sentence ? 18.5 : (n.depth <= 1 ? 21 : 19), bold: !sentence)).foregroundStyle(Ink.text)
                    .lineSpacing(5).fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
            if let b = t.body {
                Text(BHAttr.text(b, accent: accent)).font(Fonts.song(17)).foregroundStyle(Ink.text.opacity(0.92))
                    .lineSpacing(7).fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
            marks(n, hue: hue)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private func marks(_ n: MindTree.Node, hue: Color) -> some View {
        let k = model.look(n.id)
        let kids = n.children.count
        if kids > 0 || k.learned || k.reading || k.progress != nil {
            HStack(spacing: 12) {
                if kids > 0 {
                    Button { model.toggle(n.id) } label: {
                        Label(model.isOpen(n.id) ? "收起 \(kids) 项" : "展开 \(kids) 项", systemImage: model.isOpen(n.id) ? "minus.circle" : "plus.circle")
                    }
                    .disabled(n.id == 0)
                    .foregroundStyle(hue)
                }
                if k.learned { Label("这一章学过", systemImage: "checkmark.seal.fill").foregroundStyle(hue) }
                if k.reading { Label("正在读", systemImage: "bookmark.fill").foregroundStyle(Ink.cinnabar) }
                if let p = k.progress { Text("这一支学过 \(Int((p * 100).rounded()))%").foregroundStyle(Ink.soft) }
            }
            .font(.system(size: 12.5, weight: .semibold))
            .padding(.top, 2)
        }
    }

    @ViewBuilder private func footer(_ n: MindTree.Node) -> some View {
        let ch = n.effCh
        let chapter = ch.flatMap { model.pack?.chapters[safe: $0 - 1] }
        VStack(spacing: 10) {
            if let ch, let c = chapter {
                Button { onRead(ch) } label: {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(n.ch == nil ? "出自" : "读这一\(model.book.unit)").font(.system(size: 11.5, weight: .medium)).opacity(0.85)
                            Text(model.book.isCollection ? c.title : "第 \(Numerals.chinese(c.no)) \(model.book.unit) · \(c.title)")
                                .font(Fonts.song(15.5, bold: true)).lineLimit(1)
                        }
                        Spacer(minLength: 4)
                        Image(systemName: "arrow.right").font(.system(size: 14, weight: .bold))
                    }
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .foregroundStyle(.white)
                    .background(accent, in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("读这一章:\(c.title)")
            }
            if model.walking { walkBar } else { siblingBar(n) }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
    }

    private func siblingBar(_ n: MindTree.Node) -> some View {
        let p = model.sibling(-1), q = model.sibling(1)
        let count = n.parent >= 0 ? model.tree[n.parent].children.count : 1
        return HStack {
            Button { if let p { model.reveal(p) } } label: { Label("上一项", systemImage: "chevron.left") }
                .disabled(p == nil).opacity(p == nil ? 0.35 : 1)
            Spacer()
            Text(n.depth == 0 ? "\(n.children.count) 条主线" : "第 \(n.index + 1) / \(count) 项").font(Fonts.num(12, weight: .medium)).foregroundStyle(Ink.faint)
            Spacer()
            Button { if let q { model.reveal(q) } } label: { HStack(spacing: 4) { Text("下一项"); Image(systemName: "chevron.right") } }
                .disabled(q == nil).opacity(q == nil ? 0.35 : 1)
        }
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(accent)
    }

    private var walkBar: some View {
        VStack(spacing: 8) {
            GeometryReader { g in
                let p = model.walkCount > 1 ? CGFloat(model.walkPos) / CGFloat(model.walkCount - 1) : 1
                ZStack(alignment: .leading) {
                    Capsule().fill(accent.opacity(0.14))
                    Capsule().fill(accent).frame(width: max(4, g.size.width * p))
                }
            }
            .frame(height: 4)
            .animation(.easeOut(duration: 0.25), value: model.walkPos)
            HStack {
                Button { model.walkStep(-1) } label: { Label("上一步", systemImage: "chevron.left") }
                    .disabled(model.walkPos == 0).opacity(model.walkPos == 0 ? 0.35 : 1)
                Spacer()
                Text("走读 \(model.walkPos + 1) / \(model.walkCount)").font(Fonts.num(12.5, weight: .semibold)).foregroundStyle(Ink.soft).monospacedDigit()
                Spacer()
                if model.walkPos + 1 < model.walkCount {
                    Button { model.walkStep(1) } label: {
                        HStack(spacing: 4) { Text("下一步"); Image(systemName: "chevron.right") }
                            .padding(.horizontal, 14).padding(.vertical, 7)
                            .foregroundStyle(.white).background(accent, in: Capsule())
                    }
                } else {
                    Button { model.endWalk() } label: { Text("走完了").padding(.horizontal, 14).padding(.vertical, 7).background(accent.opacity(0.12), in: Capsule()) }
                }
            }
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(accent)
        }
    }
}

// MARK: 提纲模式

/// 同一棵树排成缩进的提纲:展开、选中与画布共用;说明直接跟在行下(没选中的只露两行)。单手在手机上读最舒服。
struct MindOutlineView: View {
    @Bindable var model: MindMapModel
    let onRead: (Int) -> Void
    var topInset: CGFloat = 0
    var bottomInset: CGFloat = 0
    private var accent: Color { model.book.theme.accentColor }

    private var rows: [Int] {
        var out: [Int] = []
        func walk(_ i: Int) {
            out.append(i)
            if model.isOpen(i) { for c in model.tree[i].children { walk(c) } }
        }
        walk(0)
        return out
    }

    var body: some View {
        let hues = (0..<max(model.tree.branches, 1)).map { MindPalette.hueColor(model.book.theme, branches: model.tree.branches, branch: $0) }
        GeometryReader { geo in
            let col = min(geo.size.width - 32, 720)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(rows, id: \.self) { id in
                            MindOutlineRow(model: model, id: id, hue: model.tree[id].branch < 0 ? accent : hues[model.tree[id].branch % hues.count], onRead: onRead)
                                .frame(width: col, alignment: .leading)
                                .frame(maxWidth: .infinity)
                                .id(id)
                        }
                    }
                    .padding(.top, topInset).padding(.bottom, bottomInset + 60)
                }
                .onAppear { if let s = model.selected { DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { proxy.scrollTo(s, anchor: .center) } } }
                .onChange(of: model.outlineScrollTarget) { _, t in
                    guard let t else { return }
                    withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo(t, anchor: .center) }
                }
            }
        }
    }
}

/// 提纲的一行(也给文章里的 outline 块以外的地方用:自己带缩进、竖线与收放钮)。
struct MindOutlineRow: View {
    @Bindable var model: MindMapModel
    let id: Int
    let hue: Color
    let onRead: (Int) -> Void

    var body: some View {
        let n = model.tree[id]
        let sel = model.selected == id
        let k = model.look(id)
        let t = MindNodeCard.texts(n)
        let indent = CGFloat(max(0, n.depth - 1)) * 18
        HStack(alignment: .top, spacing: 0) {
            // 缩进处的竖线:每一层一道,颜色随分支
            if n.depth > 1 {
                HStack(spacing: 0) {
                    ForEach(1..<n.depth, id: \.self) { _ in
                        Rectangle().fill(hue.opacity(0.22)).frame(width: 1.2).padding(.leading, 6).padding(.trailing, 10.8)
                    }
                }
                .frame(width: indent, alignment: .leading)
            }
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    marker(n)
                    // 标签是长句开头的,提纲里直接写整句;说明里重复的那句不再出现
                    Text(BHAttr.text(t.head, accent: hue))
                        .font(font(n.depth))
                        .foregroundStyle(n.depth >= 3 ? Ink.soft : Ink.text)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 4)
                    if k.learned { Image(systemName: "checkmark.circle.fill").font(.system(size: 13)).foregroundStyle(hue).accessibilityLabel("学过") }
                    if k.reading { Image(systemName: "bookmark.fill").font(.system(size: 12)).foregroundStyle(Ink.cinnabar).accessibilityLabel("正在读") }
                    if !n.children.isEmpty && n.id != 0 {
                        Button { model.toggle(id) } label: {
                            HStack(spacing: 3) {
                                if !model.isOpen(id) { Text("\(n.children.count)").font(Fonts.num(11, weight: .semibold)) }
                                Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).rotationEffect(.degrees(model.isOpen(id) ? 90 : 0))
                            }
                            .foregroundStyle(model.isOpen(id) ? hue : Ink.faint)
                            .frame(minWidth: 34, minHeight: 30, alignment: .trailing)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(model.isOpen(id) ? "收起" : "展开 \(n.children.count) 项")
                    }
                }
                if let b = t.body {
                    Text(BHAttr.text(b, accent: hue)).font(Fonts.song(sel ? 16.5 : 14.5)).foregroundStyle(sel ? Ink.text.opacity(0.9) : Ink.soft)
                        .lineSpacing(sel ? 6 : 4).lineLimit(sel ? nil : 2)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.leading, 18)
                }
                if sel, let ch = n.effCh, let c = model.pack?.chapters[safe: ch - 1] {
                    Button { onRead(ch) } label: {
                        Label(model.book.isCollection ? "读《\(c.title)》" : "读第 \(Numerals.chinese(c.no)) \(model.book.unit) · \(c.title)", systemImage: "arrow.right")
                            .labelStyle(TrailingIconLabel())
                            .font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8).background(model.book.theme.accentColor, in: Capsule())
                    }
                    .buttonStyle(.plain).padding(.leading, 18).padding(.top, 2)
                }
            }
            .padding(.vertical, n.depth <= 1 ? 12 : 8)
            .padding(.horizontal, 10)
            .background {
                RoundedRectangle(cornerRadius: 12).fill(sel ? hue.opacity(0.1) : (k.match ? Color.yellow.opacity(0.18) : (n.depth == 1 ? hue.opacity(0.05) : .clear)))
            }
        }
        .padding(.top, n.depth == 1 ? 10 : 0)
        .contentShape(Rectangle())
        .onTapGesture {
            model.clock.touch()
            if model.selected == id, !n.children.isEmpty, id != 0 { model.toggle(id) } else { model.selected = id; model.afterSelect(glide: false) }
        }
        .accessibilityElement(children: .contain)
    }

    private func font(_ d: Int) -> Font {
        switch d {
        case 0: return Fonts.song(23, bold: true)
        case 1: return Fonts.song(18.5, bold: true)
        case 2: return Fonts.song(16.5, bold: false)
        default: return Fonts.song(15.5)
        }
    }

    @ViewBuilder private func marker(_ n: MindTree.Node) -> some View {
        switch n.depth {
        case 0: EmptyView()
        case 1:
            Text("\(n.index + 1)").font(Fonts.num(11, weight: .bold)).foregroundStyle(.white)
                .frame(width: 20, height: 20).background(hue, in: Circle())
                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
        case 2: Circle().fill(hue.opacity(0.85)).frame(width: 7, height: 7).alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
        default: Circle().stroke(hue.opacity(0.6), lineWidth: 1.2).frame(width: 6, height: 6).alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
        }
    }
}

struct TrailingIconLabel: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) { configuration.title; configuration.icon }
    }
}
