import SwiftUI

/// 书桌:接着学 → 本周 → 我的书 → 今日一章 → 添书。
struct DeskHome: View {
    @State private var library = Library.shared
    @State private var progress = ProgressStore.shared
    /// 要打开的书与落点放在同一个值里:落点单独存一份 @State 时,封面里那份闭包会读到旧值(首开总落在第一章)。
    @State private var reading: Opening?
    @State private var showCatalog = false
    @State private var showAccount = false
    @State private var showStats = false
    @State private var showGoal = false
    /// 书包的首页(第一次打开、长按「这本书」、书目里点书包那一行)。
    @State private var home: BookInfo?
    @State private var catalogFocus: String?
    @State private var importer = ImportCenter.shared
    /// 书桌上的书多了(典籍八十来本可以都放上来):默认只摆最近在读的十来本,其余收在「全部 N 本」里。
    @State private var showAllShelf = false
    private static let shelfCap = 12
    private var stats: Stats { .shared }
    @Environment(\.horizontalSizeClass) private var hSize
    private var pad: Bool { hSize == .regular }
    /// iPad 放大系数
    private var k: CGFloat { pad ? 1.3 : 1 }

    private var recent: BookInfo? {
        library.shelfBooks.max { (progress.pos[$0.id]?.at ?? .distantPast) < (progress.pos[$1.id]?.at ?? .distantPast) }
    }

    var body: some View {
        NavigationStack {
            page
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(isPresented: $showStats) { StatsScreen() }
        }
    }

    private var page: some View {
        GeometryReader { geo in
            let contentW = pad ? min(geo.size.width - 96, 1100) : min(geo.size.width, 720)
            let twoCol = pad && contentW >= 880
            ScrollView {
                VStack(alignment: .leading, spacing: 26 * (pad ? 1.2 : 1)) {
                    greeting
                    // 第一次打开就没网 / 服务器连不上:书目取不到,先说清楚、给重试
                    if library.manifest == nil, let e = library.loadError {
                        OfflineCard(message: e, busy: library.refreshing, note: nil) { Task { await library.refresh() } }
                    }
                    if twoCol {
                        HStack(alignment: .top, spacing: 32) {
                            VStack(alignment: .leading, spacing: 34) {
                                if let b = recent { resumeCard(b) }
                                if library.shelf.isEmpty { emptyDesk; addButton } else { shelf }
                                libraryStrip
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            if !library.shelf.isEmpty {
                                VStack(alignment: .leading, spacing: 30) {
                                    week(wide: false)
                                    today
                                }
                                .frame(width: 340)
                            }
                        }
                    } else {
                        if let b = recent { resumeCard(b) }
                        if library.shelf.isEmpty { emptyDesk; addButton } else {
                            week(wide: pad && contentW >= 720)      // iPad mini 竖屏放不下右边三句(会截成「1 小时 2…」)
                            shelf
                            today
                            libraryStrip
                        }
                        if !pad && !library.shelf.isEmpty { addButton }     // 书桌空着时上面已经有一个「添书」了(此前手机上会出两个)
                    }
                }
                .frame(maxWidth: contentW, alignment: .leading)
                .padding(.horizontal, pad ? 0 : 22).padding(.top, pad ? 28 : 12).padding(.bottom, 40)
                .frame(maxWidth: .infinity)
            }
        }
        .background(Ink.paper.ignoresSafeArea())
        .task { await library.refresh() }
        .sheet(isPresented: $showCatalog) {
            CatalogSheet(library: library, focus: $catalogFocus) { b in
                showCatalog = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { home = b }
            }
        }
        .bookHome(item: $home) { b in
            BookHomeScreen(book: b) { ch in
                home = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { read(b, chapter: ch) }
            }
        }
        .onChange(of: importer.openRequest) { _, r in
            guard let r, let b = library.book(r.id) else { return }
            importer.openRequest = nil
            // 先收起正开着的面板,再打开
            let busy = showCatalog || showAccount || showGoal || home != nil || reading != nil
            showCatalog = false; showAccount = false; showGoal = false; home = nil; reading = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + (busy ? 0.6 : 0)) { if r.home { home = b } else { read(b, chapter: r.ch) } }
        }
        .sheet(isPresented: $showAccount) { AccountSheet() }
        .sheet(isPresented: $showGoal) { GoalSheet() }
        #if DEBUG
        .task { if ProcessInfo.processInfo.environment["DESK_ACCOUNT"] == "1" { try? await Task.sleep(nanoseconds: 800_000_000); showAccount = true } }
        // DESK_OPEN=bookhome DESK_BOOK=…:走真实的弹出方式打开书首页(iPad 全屏、手机页卡)
        .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "bookhome", let b = library.book(ProcessInfo.processInfo.environment["DESK_BOOK"] ?? "") { try? await Task.sleep(nanoseconds: 1_200_000_000); home = b } }
        .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "stats" { try? await Task.sleep(nanoseconds: 900_000_000); showStats = true } }
        .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "catalog" { try? await Task.sleep(nanoseconds: 900_000_000); catalogFocus = ProcessInfo.processInfo.environment["DESK_FOCUS"]; showCatalog = true } }
        #endif
        .fullScreenCover(item: $reading) { o in
            if let pack = library.pack(o.book), !pack.chapters.isEmpty {
                if o.book.isArticleBook { ArticleBookScreen(book: o.book, pack: pack, start: o.start) }
                else { ReaderScreen(model: ReaderModel(book: o.book, pack: pack, start: o.start)) }
            }
        }
    }

    /// 「第 N 卦 · 题名」;周易十翼等非卦章只显示题名。
    private func chapterLabel(_ b: BookInfo, _ n: Int, withNo: Bool = true) -> String {
        let c = library.pack(b)?.chapter(n)
        if c?.kind == "text" || n == 0, let t = c?.title { return t }
        let head = "第 \(Numerals.chinese(n)) \(b.unit)"
        if withNo, let t = c?.title, !t.isEmpty { return "\(head) · \(t)" }
        return head
    }

    /// 点书:书包第一次打开先看这本书的首页(声明、目录在那里);读过的直接接着读。
    private func open(_ b: BookInfo, chapter: Int? = nil) {
        if b.isDeskbook, chapter == nil, progress.pos[b.id] == nil { home = b; return }
        read(b, chapter: chapter)
    }

    private func read(_ b: BookInfo, chapter: Int?) {
        var start = chapter.map { ReadPos(ch: $0, seg: 0, at: Date()) } ?? progress.pos[b.id]
        // 文章书从目录点进某一章:落到上次在那一章读到的那一块
        if b.isArticleBook, let ch = chapter { start = ReadPos(ch: ch, seg: BaihuaPos.get(b.id, ch) ?? 0, at: Date()) }
        reading = Opening(book: b, start: start)
    }

    private var greeting: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Date.now.formatted(.dateTime.month().day().weekday(.wide).locale(Locale(identifier: "zh_CN")))).font(.system(size: 13 * k)).foregroundStyle(Ink.soft)
                Text("书桌").font(Fonts.song(34 * k, bold: true)).foregroundStyle(Ink.text)
            }
            Spacer()
            AccountButton(scale: pad ? 1.15 : 1) { showAccount = true }.padding(.top, 4)
        }
    }

    private func resumeCard(_ b: BookInfo) -> some View {
        let p = progress.pos[b.id]
        let ch = p?.ch ?? 1
        return Button { open(b) } label: {
            ZStack(alignment: .bottomLeading) {
                Color.clear.frame(height: pad ? 300 : 210).frame(maxWidth: .infinity).overlay(BookArt(book: b, kind: .banner)).clipped()
                LinearGradient(colors: [.clear, .black.opacity(0.55)], startPoint: .center, endPoint: .bottom)
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(p == nil ? "开始学" : "接着学").font(.system(size: 12 * k, weight: .semibold)).kerning(3).opacity(0.9)
                        Text(b.title).font(Fonts.song(28 * k * (pad ? 1.1 : 1), bold: true))
                        Text(chapterLabel(b, ch)).font(.system(size: 14 * k)).opacity(0.92).lineLimit(2)
                    }
                    Spacer()
                    Image(systemName: "arrow.right").font(.system(size: 17 * k, weight: .bold))
                        .frame(width: 46 * k, height: 46 * k).background(.white, in: Circle()).foregroundStyle(b.theme.accentColor)
                }
                .foregroundStyle(.white).padding(20 * k)
            }
            .clipShape(RoundedRectangle(cornerRadius: 26 * (pad ? 1.15 : 1)))
            .shadow(color: b.theme.accentColor.opacity(0.25), radius: 20, y: 10)
        }
        .buttonStyle(.plain)
    }

    /// 本周目标:进度环、已学 / 目标、周一到周日哪几天学过(今天描一圈)。点卡进统计页;没设过目标给「设定目标」。
    private func week(wide: Bool) -> some View {
        let goal = DeskSettings.shared.deskGoal * 60
        let done = stats.thisWeekSec
        let days = stats.thisWeekDays
        let todayIdx = (Calendar.current.component(.weekday, from: Date()) + 5) % 7
        let streak = stats.streakWeeks
        return Button { showStats = true } label: {
            HStack(spacing: 16) {
                WeekRing(progress: Double(done) / Double(max(goal, 1)), size: 78, line: 9, showPercent: true)
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Text("本周目标").font(.system(size: 12, weight: .semibold)).kerning(2).foregroundStyle(Ink.soft)
                        if streak > 0 {
                            Label("连续 \(streak) 周", systemImage: "flame.fill").font(.system(size: 11, weight: .semibold)).labelStyle(.titleAndIcon)
                                .foregroundStyle(Color(UIColor.pair("#B7791F", "#E0A84E")))
                                .padding(.horizontal, 7).padding(.vertical, 2)
                                .background(Color(UIColor.pair("#B7791F", "#E0A84E")).opacity(0.12), in: Capsule())
                        }
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(done > 0 ? Fmt.dur(done) : "还没开始").font(Fonts.song(21, bold: true)).foregroundStyle(Ink.text).minimumScaleFactor(0.8).lineLimit(1)
                        Text("/ \(Fmt.dur(goal))").font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(1)
                    }
                    HStack(spacing: 4) {
                        ForEach(0..<7, id: \.self) { i in
                            let on = days[i]
                            Text(["一", "二", "三", "四", "五", "六", "日"][i]).font(.system(size: 11, weight: i == todayIdx ? .bold : .medium))
                                .frame(width: 23, height: 23)
                                .background(on ? Ink.cinnabar.opacity(0.16) : Ink.line.opacity(0.5), in: Circle())
                                .overlay { if i == todayIdx { Circle().stroke(Ink.cinnabar, lineWidth: 1.5) } }
                                .foregroundStyle(on ? Ink.cinnabar : (i == todayIdx ? Ink.text : Ink.faint))
                        }
                    }
                }
                Spacer(minLength: 0)
                if wide {
                    // iPad 竖屏整行宽:右边再摆两句,不留一大片空
                    HStack(spacing: 28) {
                        weekFact(done >= goal ? "已达成" : Fmt.dur(goal - done), done >= goal ? "本周目标" : "本周还差")
                        weekFact(Fmt.dur(stats.window(.today).sec), "今天")
                        weekFact("\(stats.totalDays) 天", "总学习天数")
                    }
                    .padding(.trailing, 36)
                }
            }
            .overlay(alignment: .topTrailing) {
                if !DeskSettings.shared.isGoalSet {
                    Button("设定目标") { showGoal = true }
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(Ink.cinnabar)
                        .padding(.horizontal, 10).padding(.vertical, 5).background(Ink.cinnabar.opacity(0.1), in: Capsule())
                        .offset(x: 4, y: -6)
                } else {
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Ink.faint)
                }
            }
            .padding(18)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 22))
            .contentShape(RoundedRectangle(cornerRadius: 22))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("本周目标,已学 \(Fmt.dur(done)),目标 \(Fmt.dur(goal)),打开统计")
    }

    private func weekFact(_ v: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(v).font(Fonts.num(22)).foregroundStyle(Ink.text).lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.system(size: 12)).foregroundStyle(Ink.soft)
        }
    }

    /// 摆在书桌上的那几本:不多时照加入次序全摆;多了按最近读过的在前,只摆前十来本(展开后全摆,次序不变)。
    private var shelfShown: [BookInfo] {
        let all = library.shelfBooks
        guard all.count > Self.shelfCap else { return all }
        let order = Dictionary(uniqueKeysWithValues: all.enumerated().map { ($1.id, $0) })
        let sorted = all.sorted {
            let a = progress.pos[$0.id]?.at, b = progress.pos[$1.id]?.at
            if a != b { return (a ?? .distantPast) > (b ?? .distantPast) }
            return order[$0.id]! < order[$1.id]!
        }
        return showAllShelf ? sorted : Array(sorted.prefix(Self.shelfCap - 1))
    }

    private var shelf: some View {
        let shown = shelfShown
        let total = library.shelfBooks.count
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                sectionTitle("我的书")
                if total > Self.shelfCap {
                    Text("\(total) 本").font(Fonts.num(13, weight: .medium)).foregroundStyle(Ink.faint)
                    Spacer()
                    // 点按区上下各放宽 13 点(不改版面:外面再收回去),够 44 点高
                    Button { withAnimation(.easeInOut(duration: 0.25)) { showAllShelf.toggle() } } label: {
                        Text(showAllShelf ? "只看最近的" : "全部 \(total) 本").padding(.vertical, 13).contentShape(Rectangle())
                    }
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Ink.cinnabar)
                        .padding(.vertical, -13)
                }
            }
            if pad {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180, maximum: 210), spacing: 20, alignment: .top)], alignment: .leading, spacing: 22) {
                    ForEach(shown) { b in
                        shelfCard(b, grid: true)
                    }
                    Button { showCatalog = true } label: {
                        Label("添书", systemImage: "plus").font(Fonts.song(18, bold: true))
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Ink.faint.opacity(0.6), style: StrokeStyle(lineWidth: 1.2, dash: [6, 6])))
                            .foregroundStyle(Ink.soft)
                            .contentShape(Rectangle())
                    }
                    .aspectRatio(0.72, contentMode: .fit)
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 14) {
                        ForEach(shown) { b in shelfCard(b, grid: false) }
                    }
                    .padding(.vertical, 4)
                }
                .scrollClipDisabled()
            }
        }
    }

    private func shelfCard(_ b: BookInfo, grid: Bool) -> some View {
        let sum = PackSummaries.shared.of(b)
        return BookCard(book: b, pos: progress.pos[b.id], learned: stats.learnedCount(b.id), total: sum?.count ?? b.chapters,
                 finished: sum.map { s in !s.keys.isEmpty && s.keys.allSatisfy { FinishedStore.shared.recs[$0].map { !$0.deleted } ?? false } } ?? false, flexible: grid)
            .contentShape(RoundedRectangle(cornerRadius: 18))
            .onTapGesture { open(b) }
            .contextMenu {
                if b.isDeskbook { Button("这本书", systemImage: "book.closed") { home = b } }
                if b.isArticleBook || b.isDeskbook { Button("目录", systemImage: "list.bullet") { home = b } }
                Button("从书桌收起", systemImage: "tray.and.arrow.down") { library.remove(b.id) }
            }
            .accessibilityAddTraits(.isButton)
            // 长按菜单的旁白等价动作
            .accessibilityAction(named: "这本书的目录") { home = b }
            .accessibilityAction(named: "从书桌收起") { library.remove(b.id) }
    }

    /// 今日一章:订阅且最近 30 天读过的书(都没有就取书桌上的全部),每本给「下一章没学过的」——
    /// 从上次读到的那一章起往后找第一个没学过的,到书尾再从头绕回;全学过了就不出这本。
    private var todayItems: [(book: BookInfo, no: Int)] {
        _ = stats.rev
        let cutoff = Stats.dayString(Stats.add(-29, to: Date()))
        let recentAt = Date().addingTimeInterval(-30 * 86400)
        let shelf = library.shelfBooks
        let recent = shelf.filter { b in (stats.lastDay(b.id).map { $0 >= cutoff } ?? false) || (progress.pos[b.id].map { $0.at >= recentAt } ?? false) }
        let pool = (recent.isEmpty ? shelf : recent)
            .sorted { (progress.pos[$0.id]?.at ?? .distantPast) > (progress.pos[$1.id]?.at ?? .distantPast) }
        return pool.compactMap { b in
            guard let p = PackSummaries.shared.of(b), p.count > 0 else { return nil }
            let n = p.count
            let from = min(max(progress.pos[b.id]?.ch ?? 1, 1), n)
            let order = Array(from...n) + Array(1..<from)
            return order.first { !stats.learned(p.srcs[$0 - 1]) }.map { (b, $0) }
        }
    }

    @ViewBuilder private var today: some View {
        let items = todayItems
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 12 * (pad ? 1.15 : 1)) {
                sectionTitle("今日一章")
                ForEach(items.prefix(3), id: \.book.id) { it in todayRow(it.book, it.no) }      // 书多了也只给三本,不铺满一屏
            }
        }
    }

    private func todayRow(_ b: BookInfo, _ next: Int) -> some View {
        let c = library.pack(b)?.chapters[safe: next - 1]
        let isText = c?.kind == "text"
        let title = c?.title ?? ""
        let chars = stats.chapterChars(b.id, next)
        let est = c?.meta?.minutes ?? max(1, Int((Double(chars) / (b.isArticleBook ? 450 : 120)).rounded(.up)))       // 原文连读带看译文,一分钟一百来字;文章四五百字
        let spent = c.map { stats.sec($0.src) } ?? 0
        return Button { open(b, chapter: next) } label: {
            HStack(spacing: 14 * k) {
                Text(isText ? String(title.prefix(1)) : Numerals.chinese(next)).font(Fonts.song(17 * k, bold: true)).foregroundStyle(b.theme.accentColor)
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .frame(width: 46 * k, height: 46 * k).background(b.theme.accentColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 13 * k))
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(Fonts.song(18 * (pad ? 1.15 : 1), bold: true)).foregroundStyle(Ink.text).lineLimit(2)
                    Text(isText ? b.title : "\(b.title) · 第 \(Numerals.chinese(next)) \(b.unit)").font(.system(size: 12 * (pad ? 1.15 : 1))).foregroundStyle(Ink.soft)
                    HStack(spacing: 8) {
                        Label("约 \(est) 分钟", systemImage: "clock").labelStyle(.titleAndIcon)
                        if spent > 0 {
                            Text(spent < 60 ? "已读不到 1 分钟" : "已读 \(spent / 60) 分钟").foregroundStyle(b.theme.accentColor)
                        }
                    }
                    .font(Fonts.num(11 * (pad ? 1.15 : 1), weight: .medium)).foregroundStyle(Ink.faint)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.system(size: 13 * k, weight: .semibold)).foregroundStyle(Ink.faint)
            }
            .padding(14 * (pad ? 1.15 : 1)).background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
    }

    /// 书库:典籍 / 书房 / 我的导入各几本(只列有书的;只有典籍时不出,免得和「添书」重复)。点一格打开添书、落到那一栏。
    @ViewBuilder private var libraryStrip: some View {
        let official = library.manifest?.books.count ?? 0
        let shelfN = ShelfStore.shared.visibleItems.count
        let mine = DeskbookStore.shared.all.filter { $0.origin == .imported }.count
        if shelfN > 0 || mine > 0 {
            VStack(alignment: .leading, spacing: 12) {
                sectionTitle("书库")
                HStack(spacing: 10) {
                    libTile("典籍", official, icon: "books.vertical", focus: "official")
                    if shelfN > 0 { libTile("书房", shelfN, icon: "archivebox", focus: "shelf") }
                    if mine > 0 { libTile("我的导入", mine, icon: "square.and.arrow.down", focus: "imported") }
                }
            }
        }
    }

    private func libTile(_ t: String, _ n: Int, icon: String, focus: String) -> some View {
        Button { catalogFocus = focus; showCatalog = true } label: {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).font(.system(size: 15, weight: .medium)).foregroundStyle(Ink.cinnabar)
                Text(t).font(Fonts.song(16, bold: true)).foregroundStyle(Ink.text)
                Text("\(n) 本").font(Fonts.num(12, weight: .medium)).foregroundStyle(Ink.soft)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14).background(Ink.card, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(t),\(n) 本")
    }

    private var emptyDesk: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("书桌上还没有书").font(Fonts.song(20, bold: true))
            Text("挑一本想学的放上来。只摆正在学的几本就好。").font(.system(size: 14)).foregroundStyle(Ink.soft)
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(22)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 22))
    }

    private var addButton: some View {
        Button { showCatalog = true } label: {
            Label("添书", systemImage: "plus").font(Fonts.song(16, bold: true))
                .frame(maxWidth: pad ? 260 : .infinity).padding(.vertical, 15)
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Ink.faint.opacity(0.6), style: StrokeStyle(lineWidth: 1.2, dash: [5, 5])))
                .foregroundStyle(Ink.soft)
                .contentShape(Rectangle())
        }
    }

    private func sectionTitle(_ s: String) -> some View {
        Text(s).font(Fonts.song(20 * (pad ? 1.25 : 1), bold: true)).foregroundStyle(Ink.text)
    }
}

struct Opening: Identifiable {
    let book: BookInfo
    let start: ReadPos?
    var id: String { book.id }
}

struct BookCard: View {
    let book: BookInfo
    let pos: ReadPos?
    var learned = 0
    var total = 0
    var finished = false
    var flexible = false
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Group {
                if flexible {
                    Color.clear.aspectRatio(1, contentMode: .fit)
                        .overlay(BookArt(book: book, kind: .cover)).clipped()
                } else {
                    BookArt(book: book, kind: .cover).frame(width: 150, height: 150).clipped()
                }
            }
            .overlay(alignment: .topLeading) {
                if let o = book.origin {
                    Text(o.label).font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2.5).background(.black.opacity(0.38), in: Capsule()).padding(8)
                        .accessibilityLabel(o == .shelf ? "书房的书" : "自己导入的书")
                }
            }
            .overlay(alignment: .topTrailing) {
                if finished {
                    Seal(text: "学完").frame(width: 34, height: 34).rotationEffect(.degrees(-10))
                        .shadow(color: .black.opacity(0.18), radius: 3, y: 1)
                        .padding(9)
                        .accessibilityLabel("已学完")
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(book.title).font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text).lineLimit(1)
                ProgressView(value: Double(learned), total: Double(max(total, 1))).tint(book.theme.accentColor)
                Text(caption).font(.system(size: 11)).foregroundStyle(Ink.soft).lineLimit(1)
            }
            .padding(12)
        }
        .frame(width: flexible ? nil : 150)
        .background(Ink.card)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .shadow(color: .black.opacity(0.06), radius: 12, y: 6)
        // 读屏:一本书一个元素(此前封面、角标、书名、进度条、小字各算一个,封面与进度条还没有名字,左右滑要过五下)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(([book.title, caption] + (book.origin.map { [$0 == .shelf ? "书房的书" : "自己导入的书"] } ?? []) + (finished ? ["已学完"] : [])).joined(separator: ","))
    }

    private var caption: String {
        if finished && learned >= total { return "学完 · \(total) \(unitWord)全学过" }
        if pos == nil && learned == 0 { return "还没开始" }
        return "学过 \(learned) / \(total)" + (unitWord.isEmpty ? "" : " \(unitWord)")
    }
    /// 周易卦与十翼混排,不写单位。
    private var unitWord: String { book.summary == nil ? book.unit : "" }
}

/// 连不上时的那张卡:一句说明 + 重试。书桌首页与书目页共用。
struct OfflineCard: View {
    let message: String
    var busy = false
    var note: String? = "已经放上书桌的书,没网也照样能读。"
    let retry: () -> Void
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "wifi.exclamationmark").font(.system(size: 22, weight: .medium)).foregroundStyle(Ink.faint)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 10) {
                Text(message).font(.system(size: 15)).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true)
                if let note { Text(note).font(.system(size: 13)).foregroundStyle(Ink.soft) }
                Button(action: retry) {
                    HStack(spacing: 6) {
                        if busy { ProgressView().controlSize(.small) }
                        Text(busy ? "正在重试…" : "重试")
                    }
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Ink.cinnabar)
                    .padding(.horizontal, 18).padding(.vertical, 8).background(Ink.cinnabar.opacity(0.1), in: Capsule())
                }
                .disabled(busy)
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 20))
    }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
