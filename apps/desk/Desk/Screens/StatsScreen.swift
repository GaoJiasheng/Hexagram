import SwiftUI

/// 统计:今天 / 本周 / 30 天 / 全部;大数字一排 → 按书 → 这一年(热力图)→ 连续 → 每周目标。
/// 首页目标卡、账号面板都能进(都在 NavigationStack 里 push)。版式按可用宽度走:宽(iPad)时按书与连续并排。
struct StatsScreen: View {
    @State private var win: StatsWindow = .week
    @State private var showGoal = false
    private var stats: Stats { .shared }
    private var library: Library { .shared }

    var body: some View {
        GeometryReader { geo in
            let w = min(geo.size.width - (geo.size.width > 700 ? 80 : 40), 1040)
            let wide = w >= 720
            let all = stats.window(.all)
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    if all.isEmpty {
                        emptyAll
                        goalCard
                    } else {
                        windowPicker
                        numbers(stats.window(win), wide: wide)
                        if wide {
                            HStack(alignment: .top, spacing: 24) {
                                byBook(stats.window(win)).frame(maxWidth: .infinity, alignment: .topLeading)
                                VStack(alignment: .leading, spacing: 28) { streak; goalCard }.frame(width: min(380, w * 0.42))
                            }
                            heat(width: w)
                        } else {
                            byBook(stats.window(win))
                            heat(width: w)
                            streak
                            goalCard
                        }
                    }
                }
                .frame(width: w, alignment: .leading)
                .padding(.vertical, 20)
                .frame(maxWidth: .infinity)
                #if DEBUG
                memoryNote.padding(.bottom, 24)
                #endif
            }
        }
        .background(Ink.paper.ignoresSafeArea())
        .navigationTitle("统计").navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showGoal) { GoalSheet() }
        #if DEBUG
        .onAppear { if let w = ProcessInfo.processInfo.environment["DESK_WIN"], let x = StatsWindow(rawValue: w) { win = x } }
        #endif
    }

    #if DEBUG
    /// 调试:本进程内存与本机下过几本书(量统计的内存开销用;DESK_PACKS_ALL=1 时照改之前的做法把每本书整本读进内存)。
    private var memoryNote: some View {
        let downloaded = library.allBooks.filter { PackSummaries.shared.of($0) != nil }.count
        return Text("调试 · 内存 \(MemoryFootprint.bytes() / 1_048_576) MB · 本机内容包 \(downloaded) 本" + (ProcessInfo.processInfo.environment["DESK_PACKS_ALL"] == "1" ? " · 整本全读(改之前的做法)" : " · 只读摘要"))
            .font(.system(size: 12, design: .monospaced)).foregroundStyle(Ink.faint)
    }
    #endif

    // MARK: 时间窗

    private var windowPicker: some View {
        HStack(spacing: 4) {
            ForEach(StatsWindow.allCases) { x in
                Button {
                    withAnimation(.spring(duration: 0.3)) { win = x }
                    UISelectionFeedbackGenerator().selectionChanged()
                } label: {
                    Text(x.label).font(.system(size: 15, weight: win == x ? .semibold : .medium))
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .foregroundStyle(win == x ? .white : Ink.soft)
                        .background { if win == x { Capsule().fill(Ink.cinnabar.gradient).matchedGeometryEffect(id: "win", in: ns) } }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(win == x ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Ink.card, in: Capsule())
        .overlay(Capsule().stroke(Ink.line, lineWidth: 1))
        .frame(maxWidth: 460)
    }
    @Namespace private var ns

    // MARK: 大数字

    @ViewBuilder private func numbers(_ s: WindowStats, wide: Bool) -> some View {
        if s.isEmpty {
            HStack(spacing: 16) {
                Image(systemName: "leaf").font(.system(size: 26, weight: .medium)).foregroundStyle(Ink.cinnabar.opacity(0.7))
                VStack(alignment: .leading, spacing: 4) {
                    Text(emptyTitle).font(Fonts.song(19, bold: true)).foregroundStyle(Ink.text)
                    Text("翻开一章,读满 3 分钟就算学过;这里的数字会跟着长。").font(.system(size: 14)).foregroundStyle(Ink.soft)
                }
                Spacer(minLength: 0)
            }
            .padding(20).background(Ink.card, in: RoundedRectangle(cornerRadius: 22))
        } else {
            let cells: [(String, [(String, String)], String, Color, String)] = [
                ("时长", Fmt.durParts(s.sec), "clock", Ink.cinnabar, ""),
                ("读过", [Fmt.chars(s.chars)], "text.book.closed", Color(UIColor.pair("#B7791F", "#E0A84E")), ""),
                ("学习", [("\(s.days)", "天")], "calendar", Color(UIColor.pair("#3F7A4E", "#78B487")), ""),
                ("划线", [("\(s.marks)", "处")], "highlighter", Color(UIColor.pair("#4C7DB4", "#86B0DE")), s.notes > 0 ? "\(s.notes) 条带批注" : ""),
            ]
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: wide ? 4 : 2), spacing: 14) {
                ForEach(cells, id: \.0) { c in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 6) {
                            Image(systemName: c.2).font(.system(size: 12, weight: .semibold))
                            Text(c.0).font(.system(size: 13, weight: .semibold))
                            Spacer(minLength: 0)
                            if !c.4.isEmpty { Text(c.4).font(.system(size: 11, weight: .medium)).foregroundStyle(Ink.soft).lineLimit(1) }
                        }
                        .foregroundStyle(c.3)
                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            ForEach(Array(c.1.enumerated()), id: \.offset) { _, p in
                                Text(p.0).font(Fonts.num(wide ? 34 : 28)).foregroundStyle(Ink.text).contentTransition(.numericText())
                                Text(p.1).font(.system(size: 13, weight: .medium)).foregroundStyle(Ink.soft)
                            }
                        }
                        .lineLimit(1).minimumScaleFactor(0.55)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(c.3.opacity(0.08), in: RoundedRectangle(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(c.3.opacity(0.14), lineWidth: 1))
                    // 旁白一格读一句:「时长 38 分」「划线 14 处,9 条带批注」
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Self.tileLabel(c.0, c.1, c.4))
                }
            }
            .animation(.spring(duration: 0.35), value: win)
        }
    }

    private static func tileLabel(_ name: String, _ parts: [(String, String)], _ note: String) -> String {
        let v: String = parts.map { $0.0 + $0.1 }.joined()
        return note.isEmpty ? "\(name) \(v)" : "\(name) \(v),\(note)"
    }

    private var emptyTitle: String {
        switch win {
        case .today: "今天还没翻开书"
        case .week: "这周还没开始"
        case .month: "近 30 天没有记录"
        case .all: "还没有记录"
        }
    }

    // MARK: 按书

    private func byBook(_ s: WindowStats) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            title("按书")
            if s.books.isEmpty {
                Text("这段时间没有读书的记录。").font(.system(size: 14)).foregroundStyle(Ink.faint).padding(.vertical, 6)
            } else {
                let top = max(s.books.map(\.sec).max() ?? 1, 1)
                VStack(spacing: 0) {
                    ForEach(Array(s.books.enumerated()), id: \.element.id) { i, r in
                        bookRow(r, top: top)
                        if i < s.books.count - 1 { Divider().overlay(Ink.line).padding(.leading, 20) }
                    }
                }
                .padding(.vertical, 4)
                .background(Ink.card, in: RoundedRectangle(cornerRadius: 20))
            }
        }
    }

    private func bookRow(_ r: WindowStats.BookRow, top: Int) -> some View {
        let b = library.book(r.id)
        let color = b?.theme.accentColor ?? Ink.faint
        let total = b.flatMap { PackSummaries.shared.of($0)?.count } ?? 0
        let learned = b.map { stats.learnedCount($0.id) } ?? 0
        return HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 3).fill(color.gradient).frame(width: 6, height: 44)
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .firstTextBaseline) {
                    Text(b?.title ?? "网站上读的其他篇目").font(Fonts.song(17, bold: true)).foregroundStyle(b == nil ? Ink.soft : Ink.text).lineLimit(1)
                    if let b, stats.finishedBooks().contains(where: { $0.book.id == b.id }) {
                        Seal(text: "学完").frame(width: 18, height: 18)
                    }
                    Spacer(minLength: 8)
                    Text(r.sec > 0 ? Fmt.dur(r.sec) : "—").font(Fonts.num(16)).foregroundStyle(r.sec > 0 ? Ink.text : Ink.faint)
                }
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(color.opacity(0.12))
                        Capsule().fill(color).frame(width: r.sec > 0 ? max(6, g.size.width * Double(r.sec) / Double(top)) : 0)
                    }
                }
                .frame(height: 6)
                HStack(spacing: 10) {
                    if total > 0 { Text("学过 \(learned) / \(total)").font(Fonts.num(12, weight: .medium)) }
                    if r.chars > 0 { Text(Fmt.charsText(r.chars)).font(Fonts.num(12, weight: .medium)) }
                    if r.marks > 0 { Text("\(r.marks) 处划线").font(Fonts.num(12, weight: .medium)) }
                }
                .foregroundStyle(Ink.soft)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }

    // MARK: 这一年

    private func heat(width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                title("这一年")
                Spacer()
                Text("共 \(stats.totalDays) 天").font(Fonts.num(13, weight: .medium)).foregroundStyle(Ink.soft)
            }
            HeatMap(width: width - 32)
                .padding(16)
                .background(Ink.card, in: RoundedRectangle(cornerRadius: 20))
        }
    }

    // MARK: 连续

    private var streak: some View {
        let fin = stats.finishedBooks()
        let n = stats.streakWeeks
        return VStack(alignment: .leading, spacing: 12) {
            title("连续")
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 0) {
                    big("\(n)", "周", n > 0 ? "连续达成每周目标" : "本周达成就从 1 起算", Ink.cinnabar)
                    Rectangle().fill(Ink.line).frame(width: 1, height: 52)
                    big("\(stats.totalDays)", "天", "总学习天数", Color(UIColor.pair("#3F7A4E", "#78B487"))).padding(.leading, 18)
                }
                if !fin.isEmpty {
                    Divider().overlay(Ink.line)
                    Text("学完的书").font(.system(size: 12, weight: .semibold)).kerning(2).foregroundStyle(Ink.soft)
                    ForEach(fin, id: \.book.id) { f in
                        HStack(spacing: 12) {
                            Seal(text: "学完").frame(width: 30, height: 30).rotationEffect(.degrees(-8))
                            Text(f.book.title).font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text)
                            Spacer()
                            Text(Fmt.ymd(f.at)).font(Fonts.num(13, weight: .medium)).foregroundStyle(Ink.soft)
                        }
                    }
                }
            }
            .padding(18)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 20))
        }
    }

    private func big(_ v: String, _ unit: String, _ note: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(v).font(Fonts.num(36)).foregroundStyle(color)
                Text(unit).font(.system(size: 14, weight: .semibold)).foregroundStyle(color.opacity(0.8))
            }
            Text(note).font(.system(size: 12)).foregroundStyle(Ink.soft).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(note) \(v) \(unit)")
    }

    // MARK: 目标

    private var goalCard: some View {
        let goal = DeskSettings.shared.deskGoal
        let done = stats.thisWeekSec
        return VStack(alignment: .leading, spacing: 12) {
            title("每周目标")
            HStack(spacing: 16) {
                WeekRing(progress: Double(done) / Double(max(goal * 60, 1)), size: 64, line: 7)
                VStack(alignment: .leading, spacing: 4) {
                    Text("每周 \(Fmt.dur(goal * 60))").font(Fonts.song(19, bold: true)).foregroundStyle(Ink.text)
                    Text(done >= goal * 60 ? "本周已达成" : "本周还差 \(Fmt.dur(goal * 60 - done))").font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(1).minimumScaleFactor(0.8)
                }
                Spacer(minLength: 0)
                Button("调整") { showGoal = true }
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Ink.cinnabar)
                    .padding(.horizontal, 16).padding(.vertical, 8).background(Ink.cinnabar.opacity(0.1), in: Capsule())
            }
            .padding(18)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 20))
        }
    }

    // MARK: 空

    private var emptyAll: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack {
                Circle().fill(Ink.cinnabar.opacity(0.08)).frame(width: 92, height: 92)
                Image(systemName: "book.pages").font(.system(size: 36, weight: .regular)).foregroundStyle(Ink.cinnabar)
            }
            Text("这里会记下你读过的每一章").font(Fonts.song(22, bold: true)).foregroundStyle(Ink.text)
            Text("读了多久、多少字、划了几处、哪几天翻过书,一年下来铺成一张图。从书桌上挑一本,读满 3 分钟,这一章就算学过。")
                .font(.system(size: 15)).foregroundStyle(Ink.soft).lineSpacing(5).fixedSize(horizontal: false, vertical: true)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 24))
    }

    private func title(_ s: String) -> some View {
        Text(s).font(Fonts.song(20, bold: true)).foregroundStyle(Ink.text)
    }
}

/// 一年热力图:一列一周、周一在上,颜色深浅 = 当天时长(暖色四档)。放得下就铺满,放不下横向滚动、默认停在最近这一头。
struct HeatMap: View {
    let width: CGFloat
    @State private var picked: String?
    private var stats: Stats { .shared }

    static func level(_ sec: Int) -> Int {
        switch sec {
        case ..<1: 0
        case ..<(10 * 60): 1
        case ..<(30 * 60): 2
        case ..<(60 * 60): 3
        default: 4
        }
    }
    static let ramp: [Color] = [
        Color(UIColor.pair("#EFE8DC", "#2C2824")),
        Color(UIColor.pair("#F6D9B8", "#4E3424")),
        Color(UIColor.pair("#EFAE78", "#83492B")),
        Color(UIColor.pair("#DD7A45", "#BA6236")),
        Color(UIColor.pair("#B9432A", "#F08A56")),
    ]

    var body: some View {
        let cols = stats.heat()
        let start = stats.heatStart()
        let labelW: CGFloat = 18
        let gap: CGFloat = 3
        let fit = floor((width - labelW) / 53) - gap
        let cell = min(16, max(11, fit))
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 4) {
                VStack(spacing: gap) {
                    Color.clear.frame(width: labelW - 4, height: 14)
                    ForEach(0..<7, id: \.self) { d in
                        Text(d % 2 == 0 ? ["一", "", "三", "", "五", "", "日"][d] : "").font(.system(size: 9)).foregroundStyle(Ink.faint)
                            .frame(width: labelW - 4, height: cell)
                    }
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: gap) {
                        ForEach(0..<cols.count, id: \.self) { w in
                            VStack(spacing: gap) {
                                Text(monthLabel(w, start)).font(.system(size: 9, weight: .medium)).foregroundStyle(Ink.faint)
                                    .fixedSize().frame(width: cell, height: 14, alignment: .leading)
                                ForEach(0..<7, id: \.self) { d in
                                    let v = cols[w][d]
                                    let key = Stats.dayString(Stats.add(w * 7 + d, to: start))
                                    RoundedRectangle(cornerRadius: cell * 0.25)
                                        .fill(v < 0 ? Color.clear : Self.ramp[Self.level(v)])
                                        .overlay { if picked == key { RoundedRectangle(cornerRadius: cell * 0.25).stroke(Ink.text, lineWidth: 1.5) } }
                                        .frame(width: cell, height: cell)
                                        .onTapGesture { if v >= 0 { picked = picked == key ? nil : key } }
                                }
                            }
                        }
                    }
                }
                .defaultScrollAnchor(.trailing)
            }
            HStack(spacing: 6) {
                if let p = picked, let d = Stats.date(p) {
                    Text("\(Fmt.md(d)) · \(stats.perDay[p].map { $0.sec > 0 ? Fmt.dur($0.sec) : "没有读" } ?? "没有读")")
                        .font(Fonts.num(12, weight: .medium)).foregroundStyle(Ink.text)
                } else {
                    Text("点一格看那一天").font(.system(size: 11)).foregroundStyle(Ink.faint)
                }
                Spacer()
                Text("少").font(.system(size: 10)).foregroundStyle(Ink.faint)
                ForEach(0..<5, id: \.self) { i in RoundedRectangle(cornerRadius: 2.5).fill(Self.ramp[i]).frame(width: 11, height: 11) }
                Text("多").font(.system(size: 10)).foregroundStyle(Ink.faint)
            }
        }
        // 旁白:整张图一个元素;上下轻扫在有学习记录的日子之间挪,读出那一天的时长(代替点格子)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("这一年的学习热力图,共 \(stats.totalDays) 天有学习记录")
        .accessibilityValue(picked.flatMap { p in Stats.date(p).map { "\(Fmt.md($0)),\(stats.perDay[p].map { $0.sec > 0 ? Fmt.dur($0.sec) : "没有读" } ?? "没有读")" } } ?? "")
        .accessibilityHint("上下轻扫,逐日查看有学习记录的日子")
        .accessibilityAdjustableAction { dir in
            let from = Stats.dayString(start)
            let days = stats.perDay.filter { $0.key >= from && $0.value.sec > 0 }.map(\.key).sorted()
            guard !days.isEmpty else { return }
            guard let p = picked, let i = days.firstIndex(of: p) else { picked = days.last; return }
            switch dir {
            case .increment: picked = days[min(i + 1, days.count - 1)]
            case .decrement: picked = days[max(i - 1, 0)]
            @unknown default: break
            }
        }
    }

    /// 一列的头上:这一周里有某月 1 号就写「N月」(第一列也写)。
    private func monthLabel(_ w: Int, _ start: Date) -> String {
        let c = Calendar.current
        for d in 0..<7 {
            let x = Stats.add(w * 7 + d, to: start)
            if c.component(.day, from: x) == 1 || (w == 0 && d == 0) {
                if w == 0 && c.component(.day, from: x) > 20 { return "" }   // 第一列落在月底:让给下一列写
                return "\(c.component(.month, from: x))月"
            }
        }
        return ""
    }
}

/// 进度环:主色描边,满了换金色一圈。出现时从 0 长到位。
struct WeekRing: View {
    let progress: Double
    var size: CGFloat = 78
    var line: CGFloat = 9
    var showPercent = false
    @State private var shown = 0.0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        let p = min(max(progress, 0), 1)
        ZStack {
            Circle().stroke(Ink.line, lineWidth: line)
            Circle().trim(from: 0, to: shown)
                .stroke(AngularGradient(colors: [Ink.cinnabar.opacity(0.75), Ink.cinnabar, p >= 1 ? Color(hex: "#D9A441") : Ink.cinnabar], center: .center, startAngle: .degrees(0), endAngle: .degrees(360 * max(shown, 0.01))),
                        style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if showPercent {
                if p >= 1 {
                    Image(systemName: "checkmark").font(.system(size: size * 0.26, weight: .heavy)).foregroundStyle(Ink.cinnabar)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        Text("\(Int((p * 100).rounded(.down)))").font(Fonts.num(size * 0.24))
                        Text("%").font(Fonts.num(size * 0.13, weight: .medium)).foregroundStyle(Ink.soft)
                    }
                    .foregroundStyle(Ink.text)
                }
            }
        }
        .frame(width: size, height: size)
        .onAppear { if reduceMotion { shown = p } else { withAnimation(.spring(duration: 1.0, bounce: 0.15).delay(0.15)) { shown = p } } }
        .onChange(of: p) { _, v in if reduceMotion { shown = v } else { withAnimation(.spring(duration: 0.7)) { shown = v } } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("本周目标完成 \(Int((p * 100).rounded(.down)))%")
    }
}

/// 设每周目标:30 分钟一档,30 分钟到 20 小时。改了立即存、推同步。
struct GoalSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var m = DeskSettings.shared.deskGoal
    private let presets = [60, 120, 180, 300, 420, 600]
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("按时长算,周一到周日累计。不设每日目标,也不提醒。")
                    .font(.system(size: 14)).foregroundStyle(Ink.soft).multilineTextAlignment(.center)
                HStack(spacing: 22) {
                    step("minus", enabled: m > 30) { m = max(30, m - 30) }
                    VStack(spacing: 2) {
                        Text(Fmt.dur(m * 60)).font(Fonts.num(34)).foregroundStyle(Ink.text).contentTransition(.numericText()).lineLimit(1).minimumScaleFactor(0.7)
                        Text("每周").font(.system(size: 13)).foregroundStyle(Ink.soft)
                    }
                    .frame(minWidth: 170)
                    step("plus", enabled: m < 1200) { m = min(1200, m + 30) }
                }
                HStack(spacing: 8) {
                    ForEach(presets, id: \.self) { p in
                        Button { withAnimation { m = p } } label: {
                            Text(p < 60 ? "\(p)分" : "\(p / 60)时").font(.system(size: 14, weight: .medium))
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(m == p ? Ink.cinnabar : Ink.card, in: Capsule())
                                .foregroundStyle(m == p ? .white : Ink.soft)
                                .overlay(Capsule().stroke(Ink.line, lineWidth: m == p ? 0 : 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(Ink.paper.ignoresSafeArea())
            .navigationTitle("每周目标").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("好了") { DeskSettings.shared.setGoal(m); dismiss() }.fontWeight(.semibold) } }
            .onDisappear { DeskSettings.shared.setGoal(m) }
        }
        .presentationDetents([.height(330)])
    }

    private func step(_ icon: String, enabled: Bool, _ f: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.snappy) { f() }
            UISelectionFeedbackGenerator().selectionChanged()
        } label: {
            Image(systemName: icon).font(.system(size: 20, weight: .bold)).frame(width: 52, height: 52)
                .background(Ink.cinnabar.opacity(enabled ? 0.12 : 0.05), in: Circle())
                .foregroundStyle(enabled ? Ink.cinnabar : Ink.faint)
        }
        .disabled(!enabled)
        .buttonRepeatBehavior(.enabled)
        .accessibilityLabel(icon == "minus" ? "减少 30 分钟" : "增加 30 分钟")
    }
}
