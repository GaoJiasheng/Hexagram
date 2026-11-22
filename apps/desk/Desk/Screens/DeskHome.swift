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
                    if twoCol {
                        HStack(alignment: .top, spacing: 32) {
                            VStack(alignment: .leading, spacing: 34) {
                                if let b = recent { resumeCard(b) }
                                if library.shelf.isEmpty { emptyDesk; addButton } else { shelf }
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
                            week(wide: pad)
                            shelf
                            today
                        }
                        if !pad { addButton }
                    }
                    if let e = library.loadError { Text(e).font(.system(size: 13)).foregroundStyle(Ink.cinnabar) }
                }
                .frame(maxWidth: contentW, alignment: .leading)
                .padding(.horizontal, pad ? 0 : 22).padding(.top, pad ? 28 : 12).padding(.bottom, 40)
                .frame(maxWidth: .infinity)
            }
        }
        .background(Ink.paper.ignoresSafeArea())
        .task { await library.refresh() }
        .sheet(isPresented: $showCatalog) { CatalogSheet(library: library) }
        .sheet(isPresented: $showAccount) { AccountSheet() }
        .sheet(isPresented: $showGoal) { GoalSheet() }
        #if DEBUG
        .task { if ProcessInfo.processInfo.environment["DESK_ACCOUNT"] == "1" { try? await Task.sleep(nanoseconds: 800_000_000); showAccount = true } }
        .task { if ProcessInfo.processInfo.environment["DESK_OPEN"] == "stats" { try? await Task.sleep(nanoseconds: 900_000_000); showStats = true } }
        #endif
        .fullScreenCover(item: $reading) { o in
            if let pack = library.pack(o.book) {
                ReaderScreen(model: ReaderModel(book: o.book, pack: pack, start: o.start))
            }
        }
    }

    /// 「第 N 卦 · 题名」;周易十翼等非卦章只显示题名。
    private func chapterLabel(_ b: BookInfo, _ n: Int, withNo: Bool = true) -> String {
        let c = library.pack(b)?.chapters[safe: n - 1]
        if c?.kind == "text", let t = c?.title { return t }
        let head = "第 \(Numerals.chinese(n)) \(b.unit)"
        if withNo, let t = c?.title, !t.isEmpty { return "\(head) · \(t)" }
        return head
    }

    private func open(_ b: BookInfo, chapter: Int? = nil) {
        reading = Opening(book: b, start: chapter.map { ReadPos(ch: $0, seg: 0, at: Date()) } ?? progress.pos[b.id])
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
            Text(v).font(Fonts.num(22)).foregroundStyle(Ink.text).lineLimit(1)
            Text(label).font(.system(size: 12)).foregroundStyle(Ink.soft)
        }
    }

    private var shelf: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionTitle("我的书")
            if pad {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180, maximum: 210), spacing: 20, alignment: .top)], alignment: .leading, spacing: 22) {
                    ForEach(library.shelfBooks) { b in
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
                    HStack(spacing: 14) {
                        ForEach(library.shelfBooks) { b in shelfCard(b, grid: false) }
                    }
                    .padding(.vertical, 4)
                }
                .scrollClipDisabled()
            }
        }
    }

    private func shelfCard(_ b: BookInfo, grid: Bool) -> some View {
        BookCard(book: b, pos: progress.pos[b.id], learned: stats.learnedCount(b.id), total: library.pack(b)?.chapters.count ?? b.chapters,
                 finished: library.pack(b).map { FinishedStore.shared.isFinished($0) } ?? false, flexible: grid)
            .contentShape(RoundedRectangle(cornerRadius: 18))
            .onTapGesture { open(b) }
            .contextMenu { Button("从书桌收起", systemImage: "tray.and.arrow.down") { library.remove(b.id) } }
            .accessibilityAddTraits(.isButton)
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
            guard let p = library.pack(b), !p.chapters.isEmpty else { return nil }
            let n = p.chapters.count
            let from = min(max(progress.pos[b.id]?.ch ?? 1, 1), n)
            let order = Array(from...n) + Array(1..<from)
            return order.first { !stats.learned(p.chapters[$0 - 1].src) }.map { (b, $0) }
        }
    }

    @ViewBuilder private var today: some View {
        let items = todayItems
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 12 * (pad ? 1.15 : 1)) {
                sectionTitle("今日一章")
                ForEach(items, id: \.book.id) { it in todayRow(it.book, it.no) }
            }
        }
    }

    private func todayRow(_ b: BookInfo, _ next: Int) -> some View {
        let c = library.pack(b)?.chapters[safe: next - 1]
        let isText = c?.kind == "text"
        let title = c?.title ?? ""
        let chars = stats.chapterChars(b.id, next)
        let est = max(1, Int((Double(chars) / 120).rounded(.up)))       // 原文连读带看译文,一分钟一百来字
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
    }

    private var caption: String {
        if finished && learned >= total { return "学完 · \(total) \(unitWord)全学过" }
        if pos == nil && learned == 0 { return "还没开始" }
        return "学过 \(learned) / \(total)" + (unitWord.isEmpty ? "" : " \(unitWord)")
    }
    /// 周易卦与十翼混排,不写单位。
    private var unitWord: String { book.summary == nil ? book.unit : "" }
}

/// 书目:可订的书。点一下下载并放上书桌。
struct CatalogSheet: View {
    let library: Library
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                ForEach(library.manifest?.books ?? []) { b in
                    HStack(spacing: 14) {
                        Group {
                            if let img = ArtStore.shared.image(b, .cover) {
                                Image(uiImage: img).resizable().scaledToFill()
                            } else {
                                RoundedRectangle(cornerRadius: 10).fill(b.theme.accentColor.gradient)
                                    .overlay(Text(String(b.title.prefix(1))).font(Fonts.song(22, bold: true)).foregroundStyle(.white))
                            }
                        }
                        .frame(width: 44, height: 58).clipShape(RoundedRectangle(cornerRadius: 10))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(b.title).font(Fonts.song(18, bold: true))
                            Text("\(b.sizeLabel) · \(b.chars) 字").font(.system(size: 12)).foregroundStyle(Ink.soft)
                            Text(b.brief).font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(2)
                        }
                        Spacer()
                        if library.shelf.contains(b.id) {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(b.theme.accentColor).font(.system(size: 22))
                        } else if library.downloading.contains(b.id) {
                            ProgressView()
                        } else {
                            Button("放上书桌") { Task { await library.add(b) } }
                                .buttonStyle(.borderedProminent).tint(b.theme.accentColor).controlSize(.small)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
            .navigationTitle("添书").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("好了") { dismiss() } } }
        }
    }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
