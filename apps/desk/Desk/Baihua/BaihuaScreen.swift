import SwiftUI

/// 要打开的那一篇白话深读:哪本书、哪一章,可选落到第几块、闪哪一条划线。
struct BaihuaTarget: Identifiable {
    let id = UUID()
    let book: BookInfo
    let chapter: Chapter
    /// 细粒度白话(这一章里的一首 / 一条)的键;nil = 章级那一篇。
    var sub: String? = nil
    var block: Int?
    var flash: String?          // 划线 id
    /// 书 / 文集:文章就是正文(不是原文的「深读」),页末给上下章、学过与学完,顶上是全书目录。
    var bookMode = false
    #if DEBUG
    var fixture: BHChapter?     // 调试样张(DESK_DEMO=figs)
    #endif
}

private struct MapFocus: Identifiable { let id = UUID(); let ch: Int? }

private enum BHSheet: Identifiable {
    case hl(String), editNote(String), toc, bookTOC, marks
    var id: String {
        switch self {
        case .hl(let i): return "hl:" + i
        case .editNote(let i): return "edit:" + i
        case .toc: return "toc"
        case .bookTOC: return "bookTOC"
        case .marks: return "marks"
        }
    }
}

/// 文章书里换章:到第几章、落到第几块、闪哪条划线。
struct ArticleNav {
    var go: (_ no: Int, _ block: Int?, _ flash: String?) -> Void
}

/// 书 / 文集的阅读页:一章一篇,纵向滚动;换章就地换,不叠新页。
struct ArticleBookScreen: View {
    let book: BookInfo
    let pack: BookPack
    @State private var cur: BaihuaTarget

    init(book: BookInfo, pack: BookPack, start: ReadPos?) {
        self.book = book
        self.pack = pack
        let no = min(max(start?.ch ?? 1, 1), max(pack.chapters.count, 1))
        let block = (start?.seg ?? 0) > 0 ? start?.seg : nil      // 续读:落到上次读到的那一块
        _cur = State(initialValue: BaihuaTarget(book: book, chapter: pack.chapters[no - 1], block: block, flash: nil, bookMode: true))
    }

    var body: some View {
        BaihuaScreen(target: cur, nav: ArticleNav { no, block, flash in
            guard pack.chapters.indices.contains(no - 1) else { return }
            withAnimation(.easeInOut(duration: 0.25)) {
                cur = BaihuaTarget(book: book, chapter: pack.chapters[no - 1], block: block, flash: flash, bookMode: true)
            }
        })
        .id(cur.id)
        .transition(.opacity)
    }
}

/// 典籍的白话深读(全屏盖在阅读页上):一章有几篇细粒度白话时,篇末可以就地换到上一篇 / 下一篇,不叠新页。
struct DeepScreen: View {
    @State private var cur: BaihuaTarget
    init(target: BaihuaTarget) { _cur = State(initialValue: target) }
    var body: some View {
        BaihuaScreen(target: cur, subNav: { key in
            withAnimation(.easeInOut(duration: 0.25)) {
                cur = BaihuaTarget(book: cur.book, chapter: cur.chapter, sub: key, block: nil, flash: nil)
            }
        })
        .id(cur.id)
        .transition(.opacity)
    }
}

/// 白话深读:一章一篇长文,纵向滚动。题头插画淡入纸色 → 题目 / 副题 / 「一句话」→ 正文十种块。
/// 时长计入同一章(ReadClock,口径与阅读器一致);滚到哪一块记在本机,下次打开落回去。
struct BaihuaScreen: View {
    let target: BaihuaTarget
    var nav: ArticleNav? = nil
    /// 细粒度白话换篇(DeepScreen 给;nil 就不出上一篇 / 下一篇)
    var subNav: ((String) -> Void)? = nil
    @State private var pendingLink: URL?
    @State private var showFinish = false
    @State private var finishReplay = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var phase
    @Environment(\.colorScheme) private var scheme
    @AppStorage("desk.hlColor") private var lastColor = 0
    @AppStorage(TextSize.key) private var textSize = TextSize.standard.rawValue
    @AppStorage(ReadingFont.key) private var fontRaw = ReadingFont.song.rawValue
    @State private var top: Int?
    @State private var sheet: BHSheet?
    @State private var clock = ReadClock()
    @State private var flashToken = 0
    @State private var flashAt: (block: Int, start: Int, end: Int)?
    @State private var restored = false
    @State private var lastTouch = Date.distantPast
    /// 打开着的脑图(聚焦哪一章;0 = 不聚焦)
    @State private var mapFocus: MapFocus?
    @Environment(\.mindMapReturn) private var mindMapReturn

    private var book: BookInfo { target.book }
    private var pack: BookPack? { Library.shared.pack(book) }
    private var bookMode: Bool { target.bookMode && nav != nil }
    private var theme: BookTheme { book.theme }
    private var no: Int { target.chapter.no }
    private var bh: BHChapter? {
        #if DEBUG
        if let f = target.fixture { return f }
        #endif
        return BaihuaStore.shared.chapter(book, no, sub: target.sub)
    }
    /// 这一章的细粒度白话(换篇、题头小字用)
    private var subs: [BHSub] { BaihuaStore.shared.subs(book, no) }
    private var subIndex: Int? { target.sub.flatMap { k in subs.firstIndex { $0.key == k } } }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let margin: CGFloat = w > 600 ? 48 : 22
            let col = min(w - margin * 2, 680)
            let sideTOC = w >= 1100 && (bh?.sections.count ?? 0) > 1
            let fs: CGFloat = (col >= 600 ? 20 : 18) * TextSize.of(textSize).scale     // 字号四档(本机设置,与阅读页同一档)
            ZStack(alignment: .top) {
                theme.paperColor.ignoresSafeArea()
                if let c = bh {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 0) {
                                header(c, width: w, col: col, top: geo.safeAreaInsets.top).padding(.top, -inset(geo)).id(-1)
                                ForEach(Array(c.blocks.enumerated()), id: \.offset) { i, b in
                                    block(b, i, c, col: col, fs: fs)
                                        .padding(.top, gapBefore(b, i, c, fs: fs))
                                        .frame(width: col, alignment: .leading)
                                        .frame(maxWidth: .infinity)
                                        .id(i)
                                }
                                ending(c, col: col).id(-2)
                            }
                            .scrollTargetLayout()
                        }
                        .scrollPosition(id: $top, anchor: anchor(geo))
                        .ignoresSafeArea(edges: .top)
                        // 跳到某一块时让它落在状态栏与悬浮按钮之下:顶上留一段内容边距,题图用负边距顶回去照样通到屏顶
                        .contentMargins(.top, inset(geo), for: .scrollContent)
                        .onAppear { restore(proxy, c, anchor(geo)) }
                        .onChange(of: textSize) { _, _ in
                            // 换字号后各块变高变矮:落回原来最上面那一块
                            guard let t = top, t >= 0 else { return }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { proxy.scrollTo(t, anchor: anchor(geo)) }
                        }
                        .overlay(alignment: .topTrailing) {
                            if sideTOC { sideTOCView(c, proxy, anchor(geo), width: (w - col) / 2 - 28).padding(.top, 70).padding(.trailing, 20) }
                        }
                        .sheet(item: $sheet) { s in sheetView(s, c, proxy, anchor(geo)) }
                    }
                    // 滚过题图后,状态栏与悬浮按钮那一条垫一层纸色,字不从按钮底下穿过
                    // 实色要铺到悬浮按钮的下沿(安全区 + 4 + 38),再往下 26 点淡出;此前实色只到 55%,按钮那一段是半透明的,字隐约透上来
                    let band = geo.safeAreaInsets.top + 72
                    LinearGradient(stops: [.init(color: theme.paperColor, location: 0), .init(color: theme.paperColor, location: (geo.safeAreaInsets.top + 46) / band),
                                           .init(color: theme.paperColor.opacity(0), location: 1)],
                                   startPoint: .top, endPoint: .bottom)
                        .frame(height: band)
                        .offset(y: -geo.safeAreaInsets.top)
                        .allowsHitTesting(false)
                        .opacity((top ?? -1) >= 0 ? 1 : 0)
                        .animation(.easeInOut(duration: 0.2), value: (top ?? -1) >= 0)
                    progressBar(c).padding(.top, 0)
                } else {
                    VStack(spacing: 12) {
                        if !BaihuaStore.shared.offered(book) {
                            Text("这一\(book.unit)还没有\(book.deepLabel)").font(.system(size: 14)).foregroundStyle(Ink.soft)
                        } else if BaihuaStore.shared.failed.contains(book.id) {
                            Image(systemName: "wifi.exclamationmark").font(.system(size: 28)).foregroundStyle(Ink.faint).accessibilityHidden(true)
                            Text("白话深读没取到").font(Fonts.song(18, bold: true)).foregroundStyle(Ink.text)
                            Text("检查一下网络,或者稍后再试。原文不受影响。").font(.system(size: 14)).foregroundStyle(Ink.soft)
                            Button("重试") { Task { await BaihuaStore.shared.retry(book) } }
                                .font(.system(size: 15, weight: .semibold)).foregroundStyle(theme.accentColor)
                                .padding(.horizontal, 20).padding(.vertical, 9).background(theme.accentColor.opacity(0.1), in: Capsule())
                                .padding(.top, 4)
                        } else {
                            ProgressView()
                            Text("白话深读正在取…").font(.system(size: 14)).foregroundStyle(Ink.soft)
                        }
                    }
                    .padding(.horizontal, 32)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .task { await BaihuaStore.shared.ensure(book) }
                }
            }
            .overlay(alignment: .top) { chrome(sideTOC: sideTOC) }
        }
        .onAppear {
            clock.start(target.chapter.src)
            if bookMode { ProgressStore.shared.set(book.id, ch: no, seg: max(0, target.block ?? BaihuaPos.get(book.id, no, sub: target.sub) ?? 0)) }
        }
        .onDisappear { clock.stop() }
        .environment(\.openURL, OpenURLAction { url in askLink(url); return .handled })
        .alert("用浏览器打开这个链接?", isPresented: Binding(get: { pendingLink != nil }, set: { if !$0 { pendingLink = nil } }), presenting: pendingLink) { u in
            Button("打开") { UIApplication.shared.open(u) }
            Button("拷贝链接") { UIPasteboard.general.string = u.absoluteString }
            Button("取消", role: .cancel) {}
        } message: { u in Text(u.absoluteString.removingPercentEncoding ?? u.absoluteString) }
        .fullScreenCover(isPresented: $showFinish) {
            FinishScreen(book: book, stats: Stats.shared.finishStats(book), replay: finishReplay,
                         onDone: finishReplay ? nil : { showFinish = false; DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { dismiss() } })
        }
        .onChange(of: phase) { _, p in if p == .active && mapFocus == nil { clock.start(target.chapter.src) } else { clock.settle() } }
        .fullScreenCover(item: $mapFocus, onDismiss: { clock.start(target.chapter.src) }) { f in
            MindMapScreen(book: book, focusChapter: f.ch) { ch in
                mapFocus = nil
                if ch != no { DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { nav?.go(ch, nil, nil) } }
            }
        }
        .onChange(of: top) { _, t in
            touch()
            if restored, let t, t >= 0 {
                BaihuaPos.set(book.id, no, sub: target.sub, t)
                if bookMode { ProgressStore.shared.set(book.id, ch: no, seg: t); countChars(through: t) }
            }
        }
        .onChange(of: sheet?.id) { _, _ in touch() }
        .statusBarHidden(false)
    }

    /// 链接只认 https;先问再用系统浏览器开。
    private func askLink(_ u: URL) {
        guard u.scheme?.lowercased() == "https" else { return }
        touch()
        pendingLink = u
    }

    /// 文章书:滚过的块计入当天读过的字数(同一块一天只计一次,与阅读器的「一页显示满 3 秒」同一本账)。
    private func countChars(through t: Int) {
        guard let c = bh, t > 0 else { return }
        let segs = (0..<min(t, c.blocks.count)).map { (seg: $0, chars: c.blocks[$0].charCount) }.filter { $0.chars > 0 }
        ReadDaysStore.shared.addChars(target.chapter.src, segs: segs)
    }

    private func touch() {
        // 滚动时一秒最多报一次
        let now = Date()
        guard now.timeIntervalSince(lastTouch) > 1 else { return }
        lastTouch = now
        clock.touch()
    }

    /// 「最上面那一块」的判定线 / 跳转落点:块顶对齐内容边距(状态栏和悬浮按钮之下)。
    private func anchor(_ geo: GeometryProxy) -> UnitPoint { .top }
    private func inset(_ geo: GeometryProxy) -> CGFloat { geo.safeAreaInsets.top + 60 }

    /// 打开时落位:给了块就到那一块(并闪划线),否则回到上次读到的那一块。
    private func restore(_ proxy: ScrollViewProxy, _ c: BHChapter, _ a: UnitPoint) {
        var to: Int? = target.block ?? BaihuaPos.get(book.id, no, sub: target.sub)
        if let id = target.flash, let h = HighlightStore.shared.get(id), let p = c.locate(h) {
            to = p.seg; flashAt = (p.seg, p.start, p.end)
        }
        guard let t = to, c.blocks.indices.contains(t), t > 0 else { restored = true; return }
        // 走 scrollPosition 的绑定(用 proxy.scrollTo 跳,绑定不会跟着变,进度与小目录就不知道在哪)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            top = t
            // 懒加载的列表第一次估的高度不准,落位后再校一次
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                proxy.scrollTo(t, anchor: a)     // 绑定已是 t,这一下只校位置
                restored = true
                if flashAt != nil { flashToken += 1 }
            }
        }
    }

    // MARK: 题头

    private func header(_ c: BHChapter, width: CGFloat, col: CGFloat, top: CGFloat) -> some View {
        let img = ArtStore.shared.image(book, .head(no))
        let h = min(max(width * 0.52, 240), 420) + top
        return VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottom) {
                if let img {
                    Image(uiImage: img).resizable().scaledToFill()
                        .frame(width: width, height: h).clipped()
                        .opacity(scheme == .dark ? 0.62 : 1)
                } else {
                    LinearGradient(colors: [theme.accentColor.opacity(0.55), theme.accent2Color.opacity(0.35), theme.paperColor], startPoint: .topLeading, endPoint: .bottomTrailing)
                        .frame(width: width, height: h)
                }
                // 自下而上淡进纸色
                LinearGradient(stops: [.init(color: theme.paperColor.opacity(0), location: 0), .init(color: theme.paperColor.opacity(0.35), location: 0.5), .init(color: theme.paperColor, location: 1)],
                               startPoint: .top, endPoint: .bottom)
                    .frame(height: h * 0.62)
            }
            .frame(width: width, height: h)

            VStack(alignment: .leading, spacing: 14) {
                if let hero = c.hero { heroHead(hero) }
                HStack(spacing: 8) {
                    Text(bookMode ? book.title : book.deepLabel).font(.system(size: 12, weight: .bold)).kerning(bookMode ? 1 : 3).foregroundStyle(theme.accentColor)
                        .lineLimit(1)
                    Rectangle().fill(theme.accentColor.opacity(0.35)).frame(width: 28, height: 1)
                    Text(headLabel).font(.system(size: 12, weight: .medium)).foregroundStyle(Ink.soft).lineLimit(1)
                }
                Text(c.title).font(Fonts.song(col >= 600 ? 34 : 27, bold: true)).foregroundStyle(Ink.text).lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                if let s = c.subtitle, !s.isEmpty {
                    Text(s).font(Fonts.song(col >= 600 ? 19 : 17)).foregroundStyle(Ink.soft).lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 14) {
                    Label("约 \(target.chapter.meta?.minutes ?? max(1, c.charCount / 450)) 分钟", systemImage: "clock")
                    if c.figCount > 0 { Label("\(c.figCount) 张图解", systemImage: "square.grid.2x2") }
                    if c.mediaCount > 0 { Label("\(c.mediaCount) 段动画", systemImage: "play.rectangle") }
                }
                .font(.system(size: 12.5)).foregroundStyle(Ink.faint)
                DisclaimerBanner(lines: book.disclaimers ?? [], compact: true)
                if let idea = c.idea, !idea.isEmpty { ideaCard(idea) }
            }
            .frame(width: col, alignment: .leading)
            .frame(maxWidth: .infinity)
            .padding(.top, c.hero == nil ? -54 : -84)
        }
    }

    /// 封面级的章:徽记 + 大字题句 + 一行引子。
    private func heroHead(_ hero: BHHero) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let b = hero.badge {
                Text(b).font(.system(size: 12, weight: .bold)).kerning(2).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Ink.cinnabar, in: Capsule())
                    .shadow(color: Ink.cinnabar.opacity(0.3), radius: 6, y: 2)
            }
            if let hl = hero.headline {
                Text(hl).font(Fonts.song(40, bold: true)).foregroundStyle(theme.accentColor).kerning(2)
                    .minimumScaleFactor(0.6).lineLimit(2)
                    .shadow(color: theme.paperColor, radius: 8)
            }
            if let t = hero.tagline {
                Text(t).font(Fonts.song(15)).foregroundStyle(Ink.soft).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
            }
            Rectangle().fill(LinearGradient(colors: [theme.accentColor.opacity(0.6), .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 1).padding(.vertical, 4)
        }
    }

    private func ideaCard(_ idea: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "quote.opening").font(.system(size: 11, weight: .bold))
                Text("一句话").font(.system(size: 12, weight: .bold)).kerning(2)
            }
            .foregroundStyle(theme.accent2Color)
            Text(idea).font(Fonts.song(16.5)).lineSpacing(7).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.accent2Color.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(theme.accent2Color.opacity(0.25), lineWidth: 1))
        .padding(.top, 8)
    }

    /// 题头小字:书是「第一章」;文集是作者 · 日期;典籍的深读是「第 N 章 · 题名」。
    private var headLabel: String {
        let c = target.chapter
        if bookMode && book.isCollection {
            let parts = [c.meta?.author, c.meta?.date].compactMap { $0 }
            return parts.isEmpty ? (book.unit) : parts.joined(separator: " · ")
        }
        if bookMode { return "第 \(Numerals.chinese(c.no)) \(book.unit)" }
        if let i = subIndex { return BookSearch.chapterLabel(c, unit: book.unit) + " · \(i + 1) / \(subs.count)" }
        return BookSearch.chapterLabel(c, unit: book.unit)
    }

    // MARK: 块

    private func gapBefore(_ b: BHBlock, _ i: Int, _ c: BHChapter, fs: CGFloat) -> CGFloat {
        if i == 0 { return 30 }
        switch b {
        case .h2: return fs * 2.4
        case .h3: return fs * 1.7
        case .fig, .pull, .callout, .img, .video, .outline, .code: return fs * 1.5
        case .divider: return fs * 2
        case .cite: return fs * 1.3
        case .quote: return fs * 1.2
        case .refs: return fs * 2.6
        default:
            if case .h2 = c.blocks[i - 1] { return fs * 0.9 }
            if case .h3 = c.blocks[i - 1] { return fs * 0.7 }
            return fs * 1.0
        }
    }

    /// 正文字体(阅读设置):宋体是原设计——原文、导语用宋体,白话正文用系统字;选了楷 / 仿宋 / 手写,白话正文也换成它。
    private var face: ReadingFont { ReadingFont.resolve(fontRaw) }
    private var proseFace: Bool { face.downloadable }
    private func proseUI(_ size: CGFloat, bold: Bool = false) -> UIFont {
        if proseFace { return face.ui(size) }      // 这几款没有粗体,加粗处靠主题色区分
        if face == .hei { return bold ? face.uiBold(size) : face.ui(size) }
        return .systemFont(ofSize: size, weight: bold ? .semibold : .regular)
    }
    private func prose(_ size: CGFloat) -> Font { proseFace ? face.font(size) : .system(size: size) }

    @ViewBuilder
    private func block(_ b: BHBlock, _ i: Int, _ c: BHChapter, col: CGFloat, fs: CGFloat) -> some View {
        let accent = theme.accentColor
        switch b {
        case .lead(let x):
            HStack(alignment: .top, spacing: 14) {
                RoundedRectangle(cornerRadius: 2).fill(accent.opacity(0.7)).frame(width: 3)
                markable(x, i, c, font: face.ui(fs * 1.06), bold: face == .song ? Fonts.uiSong(fs * 1.06, bold: true) : face.uiBold(fs * 1.06), color: .inkText, line: fs * 0.72)
            }
            .fixedSize(horizontal: false, vertical: true)
        case .h2(let x):
            VStack(alignment: .leading, spacing: 10) {
                Text(BHAttr.text(x, accent: accent)).font(face.boldFont(fs * 1.32)).foregroundStyle(Ink.text).lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 4) {
                    Capsule().fill(accent).frame(width: 22, height: 3)
                    Capsule().fill(theme.accent2Color.opacity(0.6)).frame(width: 6, height: 3)
                }
            }
        case .p(let x):
            markable(x, i, c, font: proseUI(fs), bold: proseUI(fs, bold: true), color: .inkText, line: fs * 0.66)
        case .quote(let o, let tr):
            if let o, !o.isEmpty {
                HStack(alignment: .top, spacing: 14) {
                    RoundedRectangle(cornerRadius: 2).fill(accent).frame(width: 3.5)
                    VStack(alignment: .leading, spacing: 10) {
                        Text(o).font(face.font(fs * 1.14)).lineSpacing(fs * 0.5).kerning(0.6).foregroundStyle(Ink.text)
                        if let tr, !tr.isEmpty {
                            Text(BHAttr.text(tr, accent: accent)).font(prose(fs * 0.86)).lineSpacing(fs * 0.36).foregroundStyle(Ink.soft)
                        }
                    }
                    .padding(.vertical, 4)
                    .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.vertical, 14).padding(.leading, 14).padding(.trailing, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(accent.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
                .fixedSize(horizontal: false, vertical: true)
            } else if let tr {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: "text.quote").font(.system(size: fs * 0.7)).foregroundStyle(accent.opacity(0.7))
                    Text(BHAttr.text(tr, accent: accent)).font(prose(fs * 0.9)).lineSpacing(fs * 0.4).foregroundStyle(Ink.soft)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        case .callout(let tone, let label, let items):
            callout(tone, label, items, fs: fs)
        case .pull(let x):
            VStack(spacing: 14) {
                Rectangle().fill(accent.opacity(0.5)).frame(width: 40, height: 2)
                Text(BHAttr.text(x, accent: accent, boldColor: accent)).font(face.boldFont(fs * 1.45)).lineSpacing(fs * 0.5)
                    .foregroundStyle(accent).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                Rectangle().fill(accent.opacity(0.5)).frame(width: 40, height: 2)
            }
            .padding(.vertical, fs * 0.8).padding(.horizontal, col >= 600 ? 40 : 8)
            .frame(maxWidth: .infinity)
        case .steps(let items):
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.offset) { k, s in
                    HStack(alignment: .top, spacing: 14) {
                        ZStack(alignment: .top) {
                            if k < items.count - 1 { Rectangle().fill(accent.opacity(0.25)).frame(width: 2).padding(.top, 26) }
                            Text("\(k + 1)").font(Fonts.num(13, weight: .bold)).foregroundStyle(.white)
                                .frame(width: 26, height: 26).background(accent, in: Circle())
                        }
                        .frame(width: 26)
                        Text(BHAttr.text(s, accent: accent)).font(prose(fs * 0.95)).lineSpacing(fs * 0.55).foregroundStyle(Ink.text)
                            .padding(.top, 2).padding(.bottom, 18)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        case .list(let ordered, let items):
            VStack(alignment: .leading, spacing: fs * 0.7) {
                ForEach(Array(items.enumerated()), id: \.offset) { k, s in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        if ordered {
                            Text("\(k + 1).").font(Fonts.num(fs * 0.85, weight: .bold)).foregroundStyle(accent).frame(minWidth: 22, alignment: .trailing)
                        } else {
                            Circle().fill(accent.opacity(0.7)).frame(width: 6, height: 6).offset(y: -fs * 0.18).frame(width: 14)
                        }
                        Text(BHAttr.text(s, accent: accent)).font(prose(fs * 0.95)).lineSpacing(fs * 0.55).foregroundStyle(Ink.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        case .refs(let items):
            VStack(alignment: .leading, spacing: 8) {
                Text("出处与参照").font(.system(size: 12, weight: .bold)).kerning(2).foregroundStyle(Ink.faint)
                ForEach(Array(items.enumerated()), id: \.offset) { _, s in
                    Text(BHAttr.text(s, accent: Ink.soft)).font(.system(size: 12.5)).lineSpacing(4).foregroundStyle(Ink.faint)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.top, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .top) { Rectangle().fill(Ink.line).frame(height: 1) }
        case .fig(let cap, let fig):
            FigBlockView(cap: cap, fig: fig, ctx: FigContext(accent: accent, accent2: theme.accent2Color, book: book, chapter: no, width: col))
        case .h3(let x):
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                RoundedRectangle(cornerRadius: 1.5).fill(theme.accent2Color.opacity(0.8)).frame(width: 3, height: fs * 0.8)
                Text(BHAttr.text(x, accent: accent)).font(face.boldFont(fs * 1.1)).foregroundStyle(Ink.text).lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityAddTraits(.isHeader)
        case .cite(let x, let by):
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: "quote.opening").font(.system(size: fs * 0.8, weight: .bold)).foregroundStyle(accent.opacity(0.45))
                Text(BHAttr.text(x, accent: accent)).font(face.font(fs * 1.06)).lineSpacing(fs * 0.45).foregroundStyle(Ink.text)
                    .fixedSize(horizontal: false, vertical: true)
                if let by {
                    Text("— " + by).font(.system(size: fs * 0.78)).foregroundStyle(Ink.soft)
                        .frame(maxWidth: .infinity, alignment: .trailing).fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.vertical, 6).padding(.horizontal, col >= 600 ? 24 : 8)
        case .img(let m):
            BHImageBlock(m: m, accent: accent, width: col)
        case .video(let m):
            BHVideoBlock(m: m, accent: accent)
        case .outline(let nodes):
            BHOutlineBlock(nodes: nodes, accent: accent, accent2: theme.accent2Color, fs: fs)
        case .code(let x, let lang):
            BHCodeBlock(x: x, lang: lang, fs: fs)
        case .divider:
            BHDivider(accent: accent)
        }
    }

    private func callout(_ tone: String, _ label: String?, _ items: [String], fs: CGFloat) -> some View {
        let (tint, icon, name): (Color, String, String) = {
            switch tone {
            case "warn": return (Ink.cinnabar, "exclamationmark.triangle", "留神")
            case "tip": return (theme.accent2Color, "lightbulb", "小贴士")
            case "mute": return (Ink.soft, "book.closed", "旁注")
            default: return (theme.accentColor, "text.bubble", "")
            }
        }()
        return VStack(alignment: .leading, spacing: 10) {
            if let l = label ?? (name.isEmpty ? nil : name) {
                Label(l, systemImage: icon).font(.system(size: 12.5, weight: .bold)).foregroundStyle(tint)
            }
            ForEach(Array(items.enumerated()), id: \.offset) { _, s in
                Text(BHAttr.text(s, accent: tint)).font(prose(fs * 0.93)).lineSpacing(fs * 0.55)
                    .foregroundStyle(tone == "mute" ? Ink.soft : Ink.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(tone == "mute" ? 0.06 : 0.08), in: RoundedRectangle(cornerRadius: 14))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 14).fill(tint.opacity(0.7)).frame(width: 4)
        }
    }

    /// 可划线的一段:这一块上的划线画出来;长按选字出菜单;轻点划线出面板。
    private func markable(_ x: String, _ i: Int, _ c: BHChapter, font: UIFont, bold: UIFont, color: UIColor, line: CGFloat) -> some View {
        let marks = marks(c)[i] ?? []
        let fl = flashAt?.block == i ? flashAt : nil
        return BHMarkableText(raw: x, block: i, font: font, bold: bold, color: color, accent: theme.accentUI, lineSpacing: line, marks: marks,
                              flashToken: fl == nil ? 0 : flashToken, flashRange: fl.map { ($0.start, $0.end) },
                              onMenu: { a in menu(a) }, onHighlight: { id in sheet = .hl(id) }, onTouch: { clock.touch() }, onLink: { askLink($0) })
    }

    /// 本章白话划线 → 按块分好(按存下的字重新定位)。
    private func marks(_ c: BHChapter) -> [Int: [BHMarkableText.BHMark]] {
        _ = HighlightStore.shared.version
        var out: [Int: [BHMarkableText.BHMark]] = [:]
        for h in HighlightStore.shared.inChapter(book: book.id, no: no).sorted(by: { $0.at < $1.at }) where h.layer == c.layer {
            guard let p = c.locate(h) else { continue }
            out[p.seg, default: []].append(.init(id: h.id, start: p.start, end: p.end, color: h.color, note: h.hasNote))
        }
        return out
    }

    private func menu(_ a: BHMenuAction) {
        clock.touch()
        switch a {
        case .mark(var p, let c):
            p.layer = bh?.layer ?? p.layer      // 细粒度白话的划线记在 "b:<篇键>" 层
            lastColor = c
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            HighlightStore.shared.add(book: book.id, chapter: target.chapter, pieces: [p], color: c)
        case .annotate(var p):
            p.layer = bh?.layer ?? p.layer
            if let h = HighlightStore.shared.add(book: book.id, chapter: target.chapter, pieces: [p], color: lastColor).last { sheet = .editNote(h.id) }
        }
    }

    // MARK: 篇末

    @ViewBuilder private func ending(_ c: BHChapter, col: CGFloat) -> some View {
        if bookMode, let pack { bookEnding(pack, col: col) } else { deepEnding }
    }

    /// 书 / 文集的篇末:学过了没有、下一章(或学完这本书)、上一章。
    private func bookEnding(_ pack: BookPack, col: CGFloat) -> some View {
        let last = no >= pack.chapters.count
        let nextC = pack.chapters[safe: no]
        return VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 2).fill(theme.accentColor).frame(width: 4, height: 18)
                Text("读完这一\(book.unit)").font(Fonts.song(19, bold: true)).foregroundStyle(Ink.text)
                Spacer()
                ChapterLearnedTag(src: target.chapter.src, color: theme.accentColor)
            }
            if last {
                FinishButton(pack: pack, finish: {
                    clock.settle()
                    FinishedStore.shared.markFinished(pack)
                    Stats.shared.recompute()
                    finishReplay = false; showFinish = true
                }, replay: { clock.settle(); finishReplay = true; showFinish = true })
            } else if let n = nextC {
                Button { nav?.go(n.no, 0, nil) } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(book.isCollection ? "下一篇" : "下一\(book.unit) · 第 \(Numerals.chinese(n.no)) \(book.unit)").font(.system(size: 12)).opacity(0.85)
                            Text(n.title).font(Fonts.song(18, bold: true)).multilineTextAlignment(.leading)
                            if let s = n.meta?.subtitle ?? n.meta?.idea { Text(s).font(.system(size: 13)).opacity(0.85).lineLimit(2).multilineTextAlignment(.leading) }
                        }
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading)
                    .background(theme.accentColor, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.white)
                }
                .buttonStyle(.plain)
            }
            ChapterInMapLink(book: book, chapter: no) { openMap(focus: no) }
            HStack {
                if let p = pack.chapters[safe: no - 2] {
                    Button { nav?.go(p.no, nil, nil) } label: {
                        Label(book.isCollection ? "上一篇:\(p.title)" : "上一\(book.unit):\(p.title)", systemImage: "arrow.left").lineLimit(1)
                    }
                    .font(.system(size: 14, weight: .medium)).foregroundStyle(theme.accentColor)
                }
                Spacer()
                Button { sheet = .bookTOC } label: { Label("目录", systemImage: "list.bullet") }
                    .font(.system(size: 14, weight: .medium)).foregroundStyle(Ink.soft)
            }
        }
        .padding(.top, 48).padding(.bottom, 80)
        .frame(width: col, alignment: .leading)
        .frame(maxWidth: .infinity)
    }

    /// 脑图:从脑图里打开的这一章 → 退回那张脑图;否则在这一章上面盖一张(读那一章 = 退回来换章)。
    private func openMap(focus: Int?) {
        touch()
        if let back = mindMapReturn, let f = focus { back(f); return }
        clock.settle()
        mapFocus = MapFocus(ch: focus)
    }

    private var deepEnding: some View {
        VStack(spacing: 14) {
            Text("— 本篇完 —").font(Fonts.song(14)).foregroundStyle(Ink.faint).kerning(2)
            // 细粒度白话:同一章里的下一篇 / 上一篇
            if let i = subIndex, let go = subNav {
                if let n = subs[safe: i + 1] {
                    Button { go(n.key) } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("下一篇 · \(i + 2) / \(subs.count)").font(.system(size: 12)).opacity(0.85)
                                Text(n.name).font(Fonts.song(18, bold: true)).multilineTextAlignment(.leading)
                                if let s = n.essay.subtitle, !s.isEmpty { Text(s).font(.system(size: 13)).opacity(0.85).lineLimit(2).multilineTextAlignment(.leading) }
                            }
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                        .padding(18).frame(maxWidth: 560, alignment: .leading)
                        .background(theme.accentColor, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.white)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 22)
                }
                if let p = subs[safe: i - 1] {
                    Button { go(p.key) } label: { Label("上一篇:\(p.name)", systemImage: "arrow.left").lineLimit(1) }
                        .font(.system(size: 14, weight: .medium)).foregroundStyle(theme.accentColor)
                }
            }
            Button { dismiss() } label: {
                Label("回到原文", systemImage: "arrow.uturn.backward")
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(theme.accentColor)
                    .padding(.horizontal, 18).padding(.vertical, 11)
                    .background(theme.accentColor.opacity(0.1), in: Capsule())
            }
        }
        .padding(.top, 48).padding(.bottom, 80)
        .frame(maxWidth: .infinity)
    }

    // MARK: 悬浮件

    private func chrome(sideTOC: Bool) -> some View {
        HStack(spacing: 10) {
            float("chevron.left", label: bookMode ? "返回书桌" : "回到原文") { dismiss() }
            Spacer()
            if bookMode { float("highlighter", label: "划线与批注") { sheet = .marks } }
            ReadingSettingsButton(paging: false, onChange: { touch() }) {
                Image(systemName: "textformat.size").font(.system(size: 15, weight: .semibold)).frame(width: 38, height: 38)
                    .foregroundStyle(Ink.text)
                    .background(.ultraThinMaterial, in: Circle())
                    .shadow(color: .black.opacity(0.08), radius: 4, y: 1)
            }
            if bookMode {
                float("list.bullet", label: "目录") { sheet = .bookTOC }
            } else if let c = bh, !c.sections.isEmpty, !sideTOC {
                float("list.bullet", label: "目录") { sheet = .toc }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private func float(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: 15, weight: .semibold)).frame(width: 38, height: 38)
                .foregroundStyle(Ink.text)
                .background(.ultraThinMaterial, in: Circle())
                .shadow(color: .black.opacity(0.08), radius: 4, y: 1)
        }
        .accessibilityLabel(label)
    }

    /// 读到哪儿:顶上一道细线(按块数算)。
    private func progressBar(_ c: BHChapter) -> some View {
        let n = max(c.blocks.count - 1, 1)
        let p = min(1, max(0, Double(top ?? 0) / Double(n)))
        return GeometryReader { g in
            Capsule().fill(theme.accentColor.opacity(0.85))
                .frame(width: max(0, g.size.width * p), height: 2.5)
                .animation(.easeOut(duration: 0.25), value: p)
        }
        .frame(height: 2.5)
        .opacity((top ?? -1) >= 0 ? 1 : 0)
        .animation(.easeInOut(duration: 0.2), value: (top ?? -1) >= 0)
    }

    private func currentSection(_ c: BHChapter) -> Int? { c.sections.last { $0.index <= (top ?? -1) }?.index }

    /// iPad 横屏:右边空白处常驻一份小目录,当前小节点亮。
    private func sideTOCView(_ c: BHChapter, _ proxy: ScrollViewProxy, _ a: UnitPoint, width: CGFloat) -> some View {
        let cur = currentSection(c)
        return VStack(alignment: .leading, spacing: 4) {
            Text("本篇").font(.system(size: 11, weight: .bold)).kerning(2).foregroundStyle(Ink.faint).padding(.bottom, 6)
            ForEach(c.sections, id: \.index) { s in
                Button { withAnimation(.easeInOut(duration: 0.35)) { top = s.index } } label: {
                    HStack(alignment: .top, spacing: 8) {
                        Capsule().fill(s.index == cur ? theme.accentColor : Ink.line).frame(width: 2.5, height: 16).padding(.top, 1)
                        Text(s.title).font(.system(size: 13, weight: s.index == cur ? .semibold : .regular))
                            .foregroundStyle(s.index == cur ? theme.accentColor : Ink.soft)
                            .lineLimit(2).multilineTextAlignment(.leading)
                    }
                }
                .buttonStyle(.plain)
                .padding(.vertical, 3)
            }
        }
        .frame(width: min(width, 240), alignment: .leading)
        // 还停在题图上时也显示(此前要先滚一下才出来):压在题图上,垫一层纸色卡片免得字看不清
        .padding((top ?? -1) >= 0 ? 0 : 12)
        .background { if (top ?? -1) < 0 { RoundedRectangle(cornerRadius: 14).fill(theme.paperColor.opacity(0.88)) } }
        .animation(.easeInOut(duration: 0.25), value: (top ?? -1) >= 0)
        .animation(.easeInOut(duration: 0.2), value: cur)
    }

    @ViewBuilder private func sheetView(_ s: BHSheet, _ c: BHChapter, _ proxy: ScrollViewProxy, _ a: UnitPoint) -> some View {
        switch s {
        case .hl(let id):
            HighlightPanel(id: id) { sheet = .editNote(id) }      // 表单高度由面板按内容自己定
        case .editNote(let id):
            NoteEditor(id: id).presentationDetents([.medium, .large])
        case .bookTOC:
            if let pack {
                ArticleTOCSheet(book: book, pack: pack, current: no, sections: c.sections, currentSection: currentSection(c),
                                openMap: book.mindmapNodes == nil ? nil : {
                                    sheet = nil
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { openMap(focus: nil) }
                                }) { pick in
                    sheet = nil
                    switch pick {
                    case .chapter(let n): if n != no { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { nav?.go(n, nil, nil) } }
                    case .section(let i): DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { withAnimation(.easeInOut(duration: 0.35)) { top = i } }
                    }
                }
            }
        case .marks:
            if let pack {
                HighlightsSheet(book: book, pack: pack) { h in
                    sheet = nil
                    if h.no == no, h.layer == c.layer, let p = c.locate(h) {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { flashAt = (p.seg, p.start, p.end); top = p.seg; flashToken += 1 }
                    } else {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { nav?.go(h.no, nil, h.id) }
                    }
                }
            }
        case .toc:
            NavigationStack {
                List {
                    ForEach(c.sections, id: \.index) { s in
                        Button {
                            sheet = nil
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { withAnimation(.easeInOut(duration: 0.35)) { top = s.index } }
                        } label: {
                            HStack {
                                Text(s.title).font(Fonts.song(16)).foregroundStyle(Ink.text)
                                Spacer()
                                if s.index == currentSection(c) { Image(systemName: "bookmark.fill").foregroundStyle(theme.accentColor).accessibilityLabel("读到这里") }
                            }
                        }
                    }
                }
                .navigationTitle(c.title).navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium, .large])
        }
    }
}

extension BHChapter {
    /// 正文字数(估读时长用)。
    var charCount: Int { blocks.reduce(0) { $0 + $1.charCount } }
    var figCount: Int { blocks.filter { if case .fig(_, let f) = $0 { return f != nil } else { return false } }.count }
    var mediaCount: Int { blocks.filter { if case .video = $0 { return true } else { return false } }.count }
}

/// 章末页的白话深读入口:一张请人往里读的卡片。白话包还没到时先空着,到了自己出现。
/// 一章有几篇细粒度白话(诗经一首一篇、传习录一条一篇)时,下面再列几篇,「全部 N 篇」开选单。
struct DeepReadCard: View {
    let book: BookInfo
    let chapter: Chapter
    let open: () -> Void
    var openSub: (String) -> Void = { _ in }
    var showAll: () -> Void = {}
    var body: some View {
        VStack(spacing: 14) {
            chapterCard
            subsCard
        }
    }

    @ViewBuilder private var subsCard: some View {
        let subs = BaihuaStore.shared.subs(book, chapter.no)
        if !subs.isEmpty {
            let theme = book.theme
            let shown = Array(subs.prefix(5))
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Image(systemName: "book.pages").font(.system(size: 11, weight: .bold))
                    Text("往深里读 · 本\(book.unit) \(subs.count) 篇\(book.deepLabel)").font(.system(size: 12, weight: .bold)).kerning(1.5)
                }
                .foregroundStyle(theme.accentColor)
                .padding(.bottom, 8)
                ForEach(shown) { s in
                    Button { openSub(s.key) } label: { SubEssayRow(book: book, chapter: chapter.no, sub: s, compact: true) }
                        .buttonStyle(.plain)
                    if s.key != shown.last?.key { Divider().overlay(Ink.line) }
                }
                if subs.count > shown.count {
                    Button(action: showAll) {
                        HStack(spacing: 4) {
                            Text("全部 \(subs.count) 篇").font(.system(size: 14, weight: .semibold))
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(theme.accentColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 12)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(theme.accentColor.opacity(0.3), lineWidth: 1))
        }
    }

    @ViewBuilder private var chapterCard: some View {
        if let c = BaihuaStore.shared.chapter(book, chapter.no) {
            let theme = book.theme
            Button(action: open) {
                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) {
                            Image(systemName: "book.pages").font(.system(size: 11, weight: .bold))
                            Text("往深里读 · \(book.deepLabel)").font(.system(size: 12, weight: .bold)).kerning(1.5)
                        }
                        .foregroundStyle(theme.accentColor)
                        Text(c.title).font(Fonts.song(19, bold: true)).foregroundStyle(Ink.text).multilineTextAlignment(.leading)
                        if let s = c.subtitle, !s.isEmpty {
                            Text(s).font(.system(size: 14)).lineSpacing(4).foregroundStyle(Ink.soft).multilineTextAlignment(.leading).lineLimit(3)
                        }
                        HStack(spacing: 12) {
                            Text("约 \(max(1, c.charCount / 450)) 分钟" + (c.figCount > 0 ? " · \(c.figCount) 张图解" : "")).font(.system(size: 12)).foregroundStyle(Ink.faint)
                            Spacer()
                            HStack(spacing: 4) {
                                Text("读下去").font(.system(size: 14, weight: .semibold))
                                Image(systemName: "arrow.right").font(.system(size: 12, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(theme.accentColor, in: Capsule())
                        }
                        .padding(.top, 4)
                    }
                    .padding(18)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background {
                    ZStack(alignment: .trailing) {
                        Ink.card
                        if let img = ArtStore.shared.image(book, .head(chapter.no)) {
                            Image(uiImage: img).resizable().scaledToFill().frame(width: 220).clipped()
                                .mask(LinearGradient(colors: [.clear, .black.opacity(0.55)], startPoint: .leading, endPoint: .trailing))
                                .opacity(0.7)
                        }
                        LinearGradient(colors: [theme.accentColor.opacity(0.08), .clear], startPoint: .topLeading, endPoint: .bottomTrailing)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(theme.accentColor.opacity(0.3), lineWidth: 1))
                .shadow(color: theme.accentColor.opacity(0.12), radius: 12, y: 4)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(book.deepLabel):\(c.title)")
        }
    }
}

/// 细粒度白话的一行:原文题名(大)+ 白话题目 / 副题(小)+ 分钟;有划线标个数。
struct SubEssayRow: View {
    let book: BookInfo
    let chapter: Int
    let sub: BHSub
    var compact = false
    var current = false
    var body: some View {
        let marks = HighlightStore.shared.inChapter(book: book.id, no: chapter).filter { $0.layer == sub.essay.layer }.count
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(sub.name).font(Fonts.song(compact ? 16 : 17, bold: true)).foregroundStyle(current ? book.theme.accentColor : Ink.text)
                    .multilineTextAlignment(.leading).lineLimit(2)
                if let s = sub.essay.subtitle, !s.isEmpty {
                    Text(s).font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(compact ? 1 : 2).multilineTextAlignment(.leading)
                }
            }
            Spacer(minLength: 6)
            if marks > 0 {
                HStack(spacing: 2) {
                    Image(systemName: "highlighter").font(.system(size: 10, weight: .medium))
                    Text("\(marks)").font(Fonts.num(11, weight: .semibold))
                }
                .foregroundStyle(HLColor.markColor(0)).padding(.top, 3)
            }
            Text("\(max(1, sub.essay.charCount / 450)) 分").font(Fonts.num(11, weight: .medium)).foregroundStyle(Ink.faint).padding(.top, 3)
        }
        .padding(.vertical, compact ? 9 : 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// 一章的白话选单:章级那篇(有就在最上面)+ 各篇细粒度白话;正读到的那一首标出来、滚到它。
struct SubEssaySheet: View {
    let book: BookInfo
    let chapter: Chapter
    /// 正读到的段(落在哪一篇的段区间里,那一篇标「正在读」)
    var seg: Int?
    let pick: (String?) -> Void
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        let subs = BaihuaStore.shared.subs(book, chapter.no)
        let whole = BaihuaStore.shared.chapter(book, chapter.no)
        let q = query.trimmingCharacters(in: .whitespaces)
        let shown = q.isEmpty ? subs : subs.filter { $0.name.contains(q) || $0.essay.title.contains(q) }
        let here = seg.flatMap { s in subs.first { s >= $0.from && s < $0.to }?.key }
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    if let whole, q.isEmpty {
                        Section {
                            Button { pick(nil) } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(whole.title).font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text)
                                    Text("本\(book.unit)总说 · 约 \(max(1, whole.charCount / 450)) 分钟").font(.system(size: 12)).foregroundStyle(Ink.faint)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Section {
                        ForEach(shown) { s in
                            Button { pick(s.key) } label: { SubEssayRow(book: book, chapter: chapter.no, sub: s, current: s.key == here) }
                                .buttonStyle(.plain)
                                .listRowBackground(s.key == here ? book.theme.accentColor.opacity(0.08) : nil)
                                .id(s.key)
                        }
                    } header: {
                        Text("\(subs.count) 篇").font(.system(size: 12, weight: .semibold)).foregroundStyle(Ink.soft).textCase(nil)
                    }
                }
                .listStyle(.insetGrouped)
                .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: "篇名")
                .onAppear { if let here { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { proxy.scrollTo(here, anchor: .center) } } }
            }
            .navigationTitle(chapter.title.isEmpty ? book.deepLabel : "\(chapter.title) · \(book.deepLabel)").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

extension BHBlock {
    /// 这一块的字数(估读时长、记字数用)。
    var charCount: Int {
        switch self {
        case .lead(let x), .p(let x), .h2(let x), .h3(let x), .pull(let x): return x.count
        case .quote(let o, let tr): return (o?.count ?? 0) + (tr?.count ?? 0)
        case .cite(let x, _): return x.count
        case .callout(_, _, let i), .steps(let i), .list(_, let i): return i.reduce(0) { $0 + $1.count }
        case .outline(let n): func w(_ n: [BHNode]) -> Int { n.reduce(0) { $0 + $1.x.count + w($1.children) } }; return w(n)
        default: return 0
        }
    }
}
