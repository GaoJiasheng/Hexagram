import SwiftUI

/// 阅读页上弹出的各种面板(同一时刻只有一个)。
enum ReaderSheet: Identifiable {
    case note(Note), toc, marks, find(String), hl(String), editNote(String)
    var id: String {
        switch self {
        case .note(let n): return "note:" + n.id
        case .toc: return "toc"
        case .marks: return "marks"
        case .find(let q): return "find:" + q
        case .hl(let i): return "hl:" + i
        case .editNote(let i): return "edit:" + i
        }
    }
}

/// 从查本书结果打开另一本书。
struct OtherReader: Identifiable {
    let id = UUID()
    let model: ReaderModel
}

struct ReaderScreen: View {
    @State var model: ReaderModel
    @Environment(\.dismiss) private var dismiss
    @State private var sheet: ReaderSheet?
    @State private var other: OtherReader?
    @State private var showFinish = false
    /// 已学完的书再看账单:不再盖一次印的那套全程,直接落定。
    @State private var finishReplay = false
    @AppStorage("desk.hlColor") private var lastColor = 0
    @AppStorage("desk.showArt") private var showArt = true
    @AppStorage(TextSize.key) private var textSize = TextSize.standard.rawValue
    @AppStorage(ReadingFont.key) private var fontRaw = ReadingFont.song.rawValue
    @AppStorage(PageTurn.key) private var turnRaw = PageTurn.slide.rawValue
    @Environment(\.colorScheme) private var scheme
    @Environment(\.scenePhase) private var phase
    @Environment(\.horizontalSizeClass) private var hSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// iPad 上轻点划线:不用整张表单,在页面下方浮一张合身的小卡片。
    @State private var hlCard: String?
    /// iPad 横屏:目录做成右侧侧栏,不用表单。
    @State private var tocPanel = false
    @State private var wide = false
    /// 正开着的白话深读(全屏盖在阅读页上)。
    @State private var deep: BaihuaTarget?
    private var sync: SyncEngine { .shared }

    var theme: BookTheme { model.book.theme }

    var body: some View {
        ZStack {
            backdrop
            VStack(spacing: 0) {
                Color.clear.frame(height: 46)     // 给左上、右上的悬浮按钮让出一条,不设整栏
                if let d = model.book.disclaimers, !d.isEmpty {
                    // 书包的声明:每章第一页顶上一条;别的页留着同样的高度(页面大小不变,不触发重排)
                    DisclaimerBanner(lines: d, compact: true)
                        .frame(maxWidth: 640)
                        .padding(.horizontal, 24)
                        .frame(height: CGFloat(d.count) * 18 + 16)
                        .opacity(model.current.page == 0 ? 1 : 0)
                        .animation(.easeInOut(duration: 0.2), value: model.current.page == 0)
                }
                GeometryReader { geo in
                    // 字号跟着屏宽走:手机 22 上下,各尺寸 iPad 30–34;一行约二十来个字,不拉成长条。
                    // iPad 横屏(正文区宽 ≥ 900 且宽 > 高)摊成左右两栏:每栏约 18–20 字,中缝 56,字号封顶 30。
                    let margin: CGFloat = geo.size.width > 600 ? 64 : 26
                    let avail = geo.size.width - margin * 2
                    let cols = avail >= 900 && geo.size.width > geo.size.height ? 2 : 1
                    let gutter: CGFloat = 56
                    let colAvail = (avail - gutter) / 2
                    let auto = cols == 2 ? min(30, max(22, floor(colAvail / 18))) : min(34, max(22, floor(geo.size.width / 22)))
                    let font = floor(auto * TextSize.of(textSize).scale)        // 字号四档(本机设置)
                    let w = cols == 2 ? floor(min(colAvail, font * 20)) * 2 + gutter : min(avail, font * 24)
                    let size = CGSize(width: floor(w), height: floor(geo.size.height - 8))
                    let face = ReadingFont.resolve(fontRaw)
                    let curl = turnRaw == PageTurn.curl.rawValue && !reduceMotion     // 减弱动态效果:按滑动
                    PagedReader(model: model, version: model.layoutVersion, curl: curl, backdrop: curl ? { r in pageBackdrop(r) } : nil,
                                onNote: { model.touch(); sheet = .note($0) },
                                onSeg: { r, seg in
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    model.touch()
                                    model.toggle(seg: seg, inChapter: r.ch)
                                },
                                endPage: { r in AnyView(endPage(r)) },
                                onHighlight: { id in
                                    model.touch()
                                    if hSize == .regular { withAnimation(.spring(duration: 0.3)) { hlCard = id } } else { sheet = .hl(id) }
                                },
                                onMenu: { r, a in model.touch(); menu(r, a) })
                        .id(curl)       // 换翻页方式:重建翻页控制器,停在同一页
                        .onAppear { model.relayout(size: size, fontSize: font, columns: cols, face: face) }
                        .onChange(of: size) { _, s in model.relayout(size: s, fontSize: font, columns: cols, face: face) }
                        .onChange(of: font) { _, f in model.relayout(size: size, fontSize: f, columns: cols, face: face) }   // 换字号:重排,落回同一段
                        .onChange(of: face) { _, f in model.relayout(size: size, fontSize: font, columns: cols, face: f) }   // 换字体:同上
                }
                footer
            }
        }
        .overlay(alignment: .top) { chrome }
        .overlay(alignment: .bottom) { remoteBanner }
        .overlay(alignment: .bottomLeading) { backButton }
        .overlay { highlightCard }
        .overlay { tocSidePanel }
        .onGeometryChange(for: Bool.self) { $0.size.width > $0.size.height && $0.size.width >= 900 } action: { wide = $0; if !$0 { tocPanel = false } }
        .sheet(item: $sheet) { s in sheetView(s) }
        .fullScreenCover(isPresented: $showFinish) { FinishScreen(book: model.book, stats: Stats.shared.finishStats(model.book), replay: finishReplay,
                                                                     onDone: finishReplay ? nil : { showFinish = false; DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { dismiss() } }) }
        .background { Color.clear.fullScreenCover(item: $other) { o in ReaderScreen(model: o.model) } }
        .background { Color.clear.fullScreenCover(item: $deep) { t in BaihuaScreen(target: t) } }
        .task { await BaihuaStore.shared.ensure(model.book) }
        .onChange(of: HighlightStore.shared.version) { _, _ in model.syncHighlights() }
        .onAppear { model.resume() }
        .onDisappear { model.pause(leaving: true) }
        .onChange(of: phase) { _, p in if p == .active { if other == nil && deep == nil { model.resume() } } else { model.pause() } }
        .onChange(of: other == nil) { _, none in if none { model.resume() } else { model.pause() } }   // 叠开的另一本书自己计时
        .onChange(of: deep == nil) { _, none in if none { model.resume() } else { model.pause() } }    // 白话深读自己计时(记在同一章)
        .onChange(of: sheet?.id) { _, _ in model.touch() }
        .onChange(of: showFinish) { _, on in if !on { model.resume() } }
        #if DEBUG
        .onAppear { debugOpen() }
        #endif
    }

    @ViewBuilder private func sheetView(_ s: ReaderSheet) -> some View {
        switch s {
        case .note(let n):
            NoteSheet(note: n, accent: theme.accentColor)     // 表单高度按内容定(此前写死 200 / 380,短注下面空一大块)
        case .toc:
            TOCSheet(model: model) { ch in sheet = nil; model.jumpFromTOC(toChapter: ch) }
        case .marks:
            HighlightsSheet(book: model.book, pack: model.pack) { h in
                sheet = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    if h.layer == "b" { openDeep(h.no, flash: h.id) } else { model.go(to: h) }
                }
            }
        case .find(let q):
            FindSheet(query: q, book: model.book, pack: model.pack) { hit in
                sheet = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { open(hit) }
            }
        case .hl(let id):
            HighlightPanel(id: id) { sheet = .editNote(id) }      // 表单高度由面板按内容自己定
        case .editNote(let id):
            NoteEditor(id: id).presentationDetents([.medium, .large])
        }
    }

    /// 长按选字后的菜单。
    private func menu(_ r: PageRef, _ a: ReaderMenuAction) {
        switch a {
        case .mark(let pieces, let c):
            lastColor = c
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            model.addHighlights(pieces, inChapter: r.ch, color: c)
        case .annotate(let pieces):
            if let h = model.addHighlights(pieces, inChapter: r.ch, color: lastColor).last { sheet = .editNote(h.id) }
        case .find(let q):
            sheet = .find(String(q.prefix(40)))
        }
    }

    /// 查本书的结果:本书就地跳、留「回到原处」;别的书打开那本的阅读器到相应位置。
    private func open(_ hit: FindHit) {
        if hit.book == model.book.id { model.go(to: hit.spot, keepReturn: true); return }
        guard let b = Library.shared.book(hit.book), let p = Library.shared.pack(b) else { return }
        let m = ReaderModel(book: b, pack: p, start: ReadPos(ch: hit.ch, seg: hit.seg, at: Date()))
        m.initialSpot = hit.spot
        other = OtherReader(model: m)
    }

    /// 另一台设备读到了别处:页脚上方一条不打断的小提示。选过的位置不再问。
    @ViewBuilder private var remoteBanner: some View {
        if let p = sync.pending[model.book.id], model.pack.chapters.indices.contains(p.ch - 1) {
            HStack(spacing: 10) {
                Image(systemName: "ipad.and.iphone").font(.system(size: 13, weight: .semibold)).foregroundStyle(theme.accentColor)
                Text("另一台设备读到\(remoteLabel(p))").font(.system(size: 14, weight: .medium)).foregroundStyle(Ink.text)
                    .lineLimit(1).minimumScaleFactor(0.75)
                Button("跳过去") {
                    sync.resolve(model.book.id)
                    withAnimation { model.jump(toChapter: p.ch, seg: p.seg) }
                }
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(theme.accentColor)
                Text("·").foregroundStyle(Ink.faint)
                Button("留在这里") { withAnimation { sync.resolve(model.book.id) } }
                    .font(.system(size: 14)).foregroundStyle(Ink.soft)
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(.regularMaterial, in: Capsule())
            .overlay(Capsule().stroke(theme.accentColor.opacity(0.25), lineWidth: 1))
            .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
            .padding(.horizontal, 16)
            .padding(.bottom, model.returnPoint != nil ? 104 : 52)      // 落在页脚上方,不压章题;有「回到原处」时让到它上面
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    private func remoteLabel(_ p: ReadPos) -> String {
        let c = model.chapter(p.ch)
        if c.kind == "text" { return "「\(c.title)」" }
        if c.gua != nil { return "第 \(Numerals.chinese(p.ch)) \(model.book.unit) · \(c.title)" }
        return "第 \(Numerals.chinese(p.ch)) \(model.book.unit)"
    }

    /// iPad 的划线小卡片:点卡片外收起。
    @ViewBuilder private var highlightCard: some View {
        if let id = hlCard {
            ZStack(alignment: .bottom) {
                Color.black.opacity(scheme == .dark ? 0.25 : 0.08).ignoresSafeArea()
                    .onTapGesture { withAnimation(.easeOut(duration: 0.2)) { hlCard = nil } }
                HighlightPanel(id: id, editNote: { hlCard = nil; sheet = .editNote(id) }, close: { withAnimation(.easeOut(duration: 0.2)) { hlCard = nil } })
                    .frame(width: 500)
                    .background(Ink.paper, in: RoundedRectangle(cornerRadius: 22))
                    .overlay(RoundedRectangle(cornerRadius: 22).stroke(Ink.line, lineWidth: 1))
                    .shadow(color: .black.opacity(0.16), radius: 24, y: 10)
                    .padding(.bottom, 64)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    /// iPad 横屏的目录侧栏:从右边滑出,点外面收起。
    @ViewBuilder private var tocSidePanel: some View {
        if tocPanel {
            ZStack(alignment: .trailing) {
                Color.black.opacity(scheme == .dark ? 0.3 : 0.12).ignoresSafeArea()
                    .onTapGesture { withAnimation(.easeOut(duration: 0.25)) { tocPanel = false } }
                    .transition(.opacity)
                TOCSheet(model: model, panel: true, pick: { ch in
                    withAnimation(.easeOut(duration: 0.25)) { tocPanel = false }
                    model.jumpFromTOC(toChapter: ch)
                }, close: { withAnimation(.easeOut(duration: 0.25)) { tocPanel = false } })
                .frame(width: 440)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .overlay(RoundedRectangle(cornerRadius: 24).stroke(Ink.line, lineWidth: 1))
                .shadow(color: .black.opacity(0.18), radius: 28, x: -6)
                .padding(.vertical, 12).padding(.trailing, 12)
                .transition(.move(edge: .trailing))
            }
        }
    }

    @ViewBuilder private var backButton: some View {
        if model.returnPoint != nil {
            Button { withAnimation { model.goBack() } } label: {
                Label("回到原处", systemImage: "arrow.uturn.backward")
                    .font(.system(size: 14, weight: .semibold))
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .foregroundStyle(theme.accentColor)
                    .background(.ultraThinMaterial, in: Capsule())
                    .overlay(Capsule().stroke(theme.accentColor.opacity(0.3), lineWidth: 1))
            }
            .padding(.leading, 20).padding(.bottom, 52)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
        }
    }

    /// 打开某一章的白话深读(可落到某一块、闪某一条划线)。
    private func openDeep(_ no: Int, block: Int? = nil, flash: String? = nil) {
        guard model.pack.chapters.indices.contains(no - 1) else { return }
        deep = BaihuaTarget(book: model.book, chapter: model.chapter(no), block: block, flash: flash)
    }

    #if DEBUG
    /// 调试入口:DESK_OPEN=baihua 直接打开这一章的白话深读(DESK_BLOCK=n 落到第 n 块);DESK_FIND=水 启动后直接打开查本书;DESK_MARKS=1 直接打开划线与批注;DESK_HLTAP=1 打开第一条划线的面板。
    private func debugOpen() {
        guard !ReaderScreen.debugDone else { return }
        ReaderScreen.debugDone = true
        let env = ProcessInfo.processInfo.environment
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            if env["DESK_OPEN"] == "baihua" { openDeep(model.current.ch, block: env["DESK_BLOCK"].flatMap(Int.init)) }
            else if let q = env["DESK_FIND"], !q.isEmpty { sheet = .find(q) }
            else if env["DESK_MARKS"] == "1" { sheet = .marks }
            else if env["DESK_OPEN"] == "toc" { if wide { tocPanel = true } else { sheet = .toc } }
            else if env["DESK_OPEN"] == "end" { model.jumpToEnd() }
            else if env["DESK_OPEN"] == "trans" { model.toggleTranslation() }
            else if env["DESK_OPEN"] == "note", let n = model.chapter(model.current.ch).segs.lazy.compactMap({ $0.n?.first(where: { $0.x != nil }) ?? $0.n?.first }).first { sheet = .note(n) }
            else if env["DESK_HLTAP"] == "1", let h = HighlightStore.shared.inChapter(book: model.book.id, no: model.current.ch).first(where: \.hasNote) { sheet = .hl(h.id) }
            else if let j = env["DESK_GOHL"], let k = Int(j) {      // 跳到本书第 k 条划线(测跳转与闪动)
                let all = HighlightStore.shared.alive(book: model.book.id)
                if all.indices.contains(k) { model.go(to: all[k]) }
            }
        }
    }
    @MainActor static var debugDone = false
    #endif

    /// 仿真翻页时一页的底子(与下面 backdrop 同一套画法,见 PageBackdropView)。
    private func pageBackdrop(_ r: PageRef) -> PageBackdropSpec {
        let art = showArt ? ArtStore.shared.image(model.book, .head(r.ch)) : nil
        let paper = UIColor.pair(theme.paper, "#171513")
        let a2 = UIColor(hex: theme.accent2)
        return PageBackdropSpec(paper: paper, accent: theme.accentUI,
                                accent2: UIColor { $0.userInterfaceStyle == .dark ? a2.lifted(0.25) : a2 },
                                art: art, artOpacity: r.page == 0 ? 0.62 : 0.26, watermark: model.watermark(r.ch))
    }

    /// 页面底子:纸色 + 顶上一抹主题色 + 这一章的插画铺在页面底部、自下而上淡出(可关)。
    /// 插画只做背景:短章下半页本来空着,正好落在那里;正文长的页再调淡。没有插画时右下角放章号水印。
    private var backdrop: some View {
        let art = showArt ? ArtStore.shared.image(model.book, .head(model.current.ch)) : nil
        return ZStack {
            theme.paperColor
            GeometryReader { geo in
                LinearGradient(colors: [theme.accentColor.opacity(0.14), theme.accent2Color.opacity(0.05), .clear], startPoint: .top, endPoint: .center)
                    .frame(height: geo.size.height * 0.5)
                if let img = art {
                    Image(uiImage: img).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: min(geo.size.height * 0.52, geo.size.width * 0.8), alignment: .bottom)
                        .clipped()
                        .opacity((model.current.page == 0 ? 0.62 : 0.26) * (scheme == .dark ? 0.55 : 1))
                        .mask(LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black.opacity(0.8), location: 0.5), .init(color: .black, location: 1)],
                                             startPoint: .top, endPoint: .bottom))
                        .frame(maxHeight: .infinity, alignment: .bottom)
                        .id(model.current.ch)
                        .transition(.opacity)
                } else {
                    Text(model.watermark(model.current.ch))
                        .font(Fonts.song(min(geo.size.width * 0.42, 340), bold: true))
                        .foregroundStyle(theme.accentColor.opacity(0.05))
                        .lineLimit(1).minimumScaleFactor(0.3)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                        .padding(.trailing, geo.size.width * 0.04).padding(.bottom, geo.size.height * 0.05)
                        .id("n\(model.current.ch)")
                        .transition(.opacity)
                }
            }
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 0.45), value: model.current)
        .animation(.easeInOut(duration: 0.3), value: showArt)
        .onChange(of: model.current.ch, initial: true) { _, ch in
            ArtStore.shared.prefetch(model.book, chapters: [ch + 1, ch + 2])   // 翻到这一章时先把后两章的题头图拉下来
        }
    }

    /// 悬浮按钮:左上返回,右上三个工具。没有整条顶栏。
    private var chrome: some View {
        HStack(spacing: 10) {
            float("chevron.left", label: "返回书桌") { dismiss() }
            Spacer()
            if BaihuaStore.shared.has(model.book, model.current.ch) {
                float("book.pages", label: model.book.deepLabel) { model.touch(); openDeep(model.current.ch) }
            }
            if ArtStore.shared.has(model.book, .head(model.current.ch)) {
                float(showArt ? "photo.fill" : "photo", label: showArt ? "隐藏插画" : "显示插画", on: showArt) { showArt.toggle() }
            }
            Button { model.toggleTranslation() } label: {
                Text("译").font(Fonts.song(15, bold: true)).frame(width: 38, height: 38)
                    .foregroundStyle(model.showTranslation ? .white : Ink.text)
                    .background(model.showTranslation ? AnyShapeStyle(theme.accentColor) : AnyShapeStyle(.ultraThinMaterial), in: Circle())
            }
            .accessibilityLabel(model.showTranslation ? "收起全部译文" : "展开全部译文")
            ReadingSettingsButton(onChange: { model.touch() }) {
                Image(systemName: "textformat.size").font(.system(size: 15, weight: .semibold)).frame(width: 38, height: 38)
                    .foregroundStyle(Ink.text)
                    .background(.ultraThinMaterial, in: Circle())
            }
            float("highlighter", label: "划线与批注") { sheet = .marks }
            float("list.bullet", label: "目录") {
                if wide { withAnimation(.spring(duration: 0.35)) { tocPanel = true } } else { sheet = .toc }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private func float(_ icon: String, label: String, on: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold)).frame(width: 38, height: 38)
                .foregroundStyle(on ? theme.accentColor : Ink.text)
                .background(.ultraThinMaterial, in: Circle())
        }
        .accessibilityLabel(label)
    }

    private var footer: some View {
        let n = model.pageSize == .zero ? 1 : model.pageCount(model.current.ch)
        return HStack(spacing: 10) {
            Text(model.caption(model.current.ch)).font(.system(size: 12, weight: .medium)).foregroundStyle(theme.accentColor)
            if model.learnedFlash == model.current.ch {
                LearnedStamp(color: theme.accentColor)
                    .transition(reduceMotion ? .opacity : .asymmetric(insertion: .scale(scale: 2.2).combined(with: .opacity), removal: .opacity))   // 减弱动态效果:不盖印,只淡入
            }
            Spacer()
            if !model.showTranslation && model.current.page == 0 && !model.isEndPageSafe && model.learnedFlash != model.current.ch {
                Label("轻点一段看译文", systemImage: "hand.tap").font(.system(size: 12)).foregroundStyle(Ink.faint)
                Spacer()
            }
            // 翻页点:这一章有几页、现在在第几页
            HStack(spacing: 5) {
                ForEach(0..<min(n, 12), id: \.self) { i in
                    Capsule().fill(i == min(model.current.page, 11) ? theme.accentColor : theme.accentColor.opacity(0.22))
                        .frame(width: i == min(model.current.page, 11) ? 16 : 6, height: 6)
                }
            }
            .animation(.spring(duration: 0.3), value: model.current.page)
        }
        .animation(.spring(duration: 0.45, bounce: 0.4), value: model.learnedFlash)
        .frame(height: 20)      // 定高:「轻点一段看译文」只在首页出现,页脚高度一变正文区就变,会触发重排把页面弹回去
        .padding(.horizontal, 28)
        .padding(.vertical, 12)
    }

    /// 章末页:这一章的「延伸」、下一章;全书最后一章才有「学完」。
    private func endPage(_ r: PageRef) -> some View {
        let ch = model.chapter(r.ch)
        let last = r.ch == model.pack.chapters.count
        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 2).fill(theme.accentColor).frame(width: 4, height: 18)
                    Text("读完这一\(model.book.unit)").font(Fonts.song(19, bold: true))
                    Spacer()
                    ChapterLearnedTag(src: ch.src, color: theme.accentColor)
                }
                DeepReadCard(book: model.book, chapter: ch) { model.touch(); openDeep(r.ch) }
                if let y = ch.yanyi, !y.isEmpty {
                    Text("延伸").font(.system(size: 12, weight: .semibold)).foregroundStyle(theme.accentColor).kerning(2)
                    ForEach(y, id: \.self) { p in
                        Text(p).font(.system(size: 15)).lineSpacing(7).foregroundStyle(Ink.soft)
                    }
                }
                if last {
                    FinishButton(pack: model.pack, finish: {
                        model.pause()            // 先结清这一段,账单里有它
                        FinishedStore.shared.markFinished(model.pack)
                        Stats.shared.recompute()
                        finishReplay = false; showFinish = true
                    }, replay: { model.pause(); finishReplay = true; showFinish = true })
                    .padding(.top, 8)
                } else {
                    Button { model.jump(toChapter: r.ch + 1) } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("下一\(model.book.unit)").font(.system(size: 12)).opacity(0.85)
                                Text(model.chapter(r.ch + 1).title).font(Fonts.song(18, bold: true))
                            }
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                        .padding(18).background(theme.accentColor, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.white)
                    }
                    .padding(.top, 8)
                }
            }
            .frame(maxWidth: 640, alignment: .leading)
            .padding(.horizontal, 28).padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
    }
}

extension Note: Identifiable { var id: String { k + d } }

/// 注释气泡:上面一句话释义,下面(详注才有)一段展开。
struct NoteSheet: View {
    let note: Note
    let accent: Color
    @State private var measured: CGFloat = 0
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(note.k).font(Fonts.song(28, bold: true)).foregroundStyle(Ink.text)
                    if let r = note.r { Text(r).font(Fonts.num(15, weight: .medium)).foregroundStyle(accent) }
                }
                Text(note.d).font(.system(size: 17, weight: .medium)).lineSpacing(5).foregroundStyle(Ink.text)
                if let x = note.x {
                    HStack(alignment: .top, spacing: 12) {
                        RoundedRectangle(cornerRadius: 2).fill(accent.opacity(0.7)).frame(width: 3)
                        Text(x).font(.system(size: 16)).lineSpacing(7).foregroundStyle(Ink.soft)
                    }
                    .padding(.top, 2)
                }
            }
            .frame(maxWidth: 640, alignment: .leading)
            .padding(24)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { measured = $0 + 12 }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Ink.paper)
        .modifier(FitDetent(height: measured, fallback: note.x == nil ? 200 : 380, cap: 560))
    }
}

/// 目录里一章的状态:学过(满 3 分钟)一枚小印;读到一半(有时长、不足 3 分钟)空心圈;没读不标。
struct ChapterMark: View {
    let sec: Int
    let color: Color
    var body: some View {
        Group {
            if sec >= Stats.learnedSec {
                Image(systemName: "checkmark").font(.system(size: 10, weight: .heavy)).foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(color, in: RoundedRectangle(cornerRadius: 5))
                    .rotationEffect(.degrees(-6))
                    .accessibilityLabel("学过")
            } else if sec > 0 {
                Circle().stroke(color.opacity(0.6), lineWidth: 1.6).frame(width: 16, height: 16)
                    .overlay(Circle().trim(from: 0, to: Double(sec) / Double(Stats.learnedSec)).stroke(color, style: StrokeStyle(lineWidth: 1.6, lineCap: .round)).rotationEffect(.degrees(-90)))
                    .frame(width: 20, height: 20)
                    .accessibilityLabel("读到一半")
            } else {
                Color.clear.frame(width: 20, height: 20)
            }
        }
    }
}

/// 全书最后一章章末页的按钮:没学完是「学完这本书」,学完了是「已学完 · 再看一遍账单」。
/// 单独成一个 View:章末页是预先建好的 UIHostingController,在这里读 FinishedStore 才会随它刷新。
struct FinishButton: View {
    let pack: BookPack
    let finish: () -> Void
    let replay: () -> Void
    var body: some View {
        if FinishedStore.shared.isFinished(pack) {
            Button(action: replay) {
                Label("已学完 · 再看一遍账单", systemImage: "checkmark.seal")
                    .font(Fonts.song(18, bold: true)).frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(Ink.cinnabar.opacity(0.1), in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(Ink.cinnabar)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Ink.cinnabar.opacity(0.35), lineWidth: 1))
            }
        } else {
            Button(action: finish) {
                Label("学完这本书", systemImage: "checkmark.seal.fill")
                    .font(Fonts.song(18, bold: true)).frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(Ink.cinnabar, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.white)
            }
        }
    }
}

/// 章末页右上:这一章学过了没有(学过 / 已读 N 分钟 · 满 3 分钟算学过)。单独成 View,随统计刷新。
struct ChapterLearnedTag: View {
    let src: Src
    let color: Color
    var body: some View {
        let sec = Stats.shared.sec(src)
        if sec >= Stats.learnedSec {
            LearnedStamp(color: color)
        } else if sec > 0 {
            Text((sec < 60 ? "已读不到 1 分钟" : "已读 \(sec / 60) 分钟") + " · 满 3 分钟算学过").font(.system(size: 12)).foregroundStyle(Ink.faint)
        }
    }
}

/// 一章刚学过时,页脚章名旁落下的小印。
struct LearnedStamp: View {
    let color: Color
    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "checkmark").font(.system(size: 8, weight: .heavy))
            Text("学过").font(Fonts.song(10, bold: true))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 6).padding(.vertical, 2.5)
        .background(color, in: RoundedRectangle(cornerRadius: 4))
        .rotationEffect(.degrees(-6))
        .accessibilityLabel("这一章学过了")
    }
}
