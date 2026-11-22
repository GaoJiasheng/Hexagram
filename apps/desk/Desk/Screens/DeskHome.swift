import SwiftUI

/// 书桌:接着学 → 本周 → 我的书 → 今日一章 → 添书。
struct DeskHome: View {
    @State private var library = Library.shared
    @State private var progress = ProgressStore.shared
    @State private var reading: BookInfo?
    @State private var startAt: ReadPos?
    @State private var showCatalog = false

    private var recent: BookInfo? {
        library.shelfBooks.max { (progress.pos[$0.id]?.at ?? .distantPast) < (progress.pos[$1.id]?.at ?? .distantPast) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                greeting
                if let b = recent { resumeCard(b) }
                if library.shelf.isEmpty { emptyDesk } else {
                    week
                    shelf
                    today
                }
                addButton
                if let e = library.loadError { Text(e).font(.system(size: 13)).foregroundStyle(Ink.cinnabar) }
            }
            .frame(maxWidth: 720, alignment: .leading)
            .padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 40)
            .frame(maxWidth: .infinity)
        }
        .background(Ink.paper.ignoresSafeArea())
        .task { await library.refresh() }
        .sheet(isPresented: $showCatalog) { CatalogSheet(library: library) }
        .fullScreenCover(item: $reading) { b in
            if let pack = library.pack(b) {
                ReaderScreen(model: ReaderModel(book: b, pack: pack, start: startAt))
            }
        }
    }

    private func open(_ b: BookInfo, chapter: Int? = nil) {
        startAt = chapter.map { ReadPos(ch: $0, seg: 0, at: Date()) } ?? progress.pos[b.id]
        reading = b
    }

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(Date.now.formatted(.dateTime.month().day().weekday(.wide).locale(Locale(identifier: "zh_CN")))).font(.system(size: 13)).foregroundStyle(Ink.soft)
            Text("书桌").font(Fonts.song(34, bold: true)).foregroundStyle(Ink.text)
        }
    }

    private func resumeCard(_ b: BookInfo) -> some View {
        let p = progress.pos[b.id]
        let ch = p?.ch ?? 1
        let title = library.pack(b)?.chapters[safe: ch - 1]?.title ?? ""
        return Button { open(b) } label: {
            ZStack(alignment: .bottomLeading) {
                BookArt(bookID: b.id, theme: b.theme).frame(height: 210).clipped()
                LinearGradient(colors: [.clear, .black.opacity(0.55)], startPoint: .center, endPoint: .bottom)
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(p == nil ? "开始学" : "接着学").font(.system(size: 12, weight: .semibold)).kerning(3).opacity(0.9)
                        Text(b.title).font(Fonts.song(28, bold: true))
                        Text("第 \(Numerals.chinese(ch)) \(b.unit) · \(title)").font(.system(size: 14)).opacity(0.92)
                    }
                    Spacer()
                    Image(systemName: "arrow.right").font(.system(size: 17, weight: .bold))
                        .frame(width: 46, height: 46).background(.white, in: Circle()).foregroundStyle(b.theme.accentColor)
                }
                .foregroundStyle(.white).padding(20)
            }
            .clipShape(RoundedRectangle(cornerRadius: 26))
            .shadow(color: b.theme.accentColor.opacity(0.25), radius: 20, y: 10)
        }
        .buttonStyle(.plain)
    }

    /// 本周目标。M0 是样张:数字为示例,M4 接真实时长。
    private var week: some View {
        HStack(spacing: 18) {
            ZStack {
                Circle().stroke(Ink.line, lineWidth: 9)
                Circle().trim(from: 0, to: 0.62).stroke(Ink.cinnabar, style: StrokeStyle(lineWidth: 9, lineCap: .round)).rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text("62%").font(Fonts.num(17))
                    Text("示例").font(.system(size: 9)).foregroundStyle(Ink.faint)
                }
            }
            .frame(width: 78, height: 78)
            VStack(alignment: .leading, spacing: 8) {
                Text("本周目标").font(.system(size: 12, weight: .semibold)).kerning(2).foregroundStyle(Ink.soft)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("1 小时 14 分").font(Fonts.song(21, bold: true))
                    Text("/ 2 小时").font(.system(size: 13)).foregroundStyle(Ink.soft)
                }
                HStack(spacing: 7) {
                    ForEach(Array(zip(["一", "二", "三", "四", "五", "六", "日"], [true, true, false, true, false, false, false])), id: \.0) { d, on in
                        Text(d).font(.system(size: 11, weight: .medium))
                            .frame(width: 24, height: 24)
                            .background(on ? Ink.cinnabar.opacity(0.14) : Ink.line.opacity(0.5), in: Circle())
                            .foregroundStyle(on ? Ink.cinnabar : Ink.faint)
                    }
                }
            }
            Spacer()
        }
        .padding(18)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 22))
    }

    private var shelf: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("我的书")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(library.shelfBooks) { b in
                        BookCard(book: b, pos: progress.pos[b.id])
                            .contentShape(RoundedRectangle(cornerRadius: 18))
                            .onTapGesture { open(b) }
                            .contextMenu { Button("从书桌收起", systemImage: "tray.and.arrow.down") { library.remove(b.id) } }
                            .accessibilityAddTraits(.isButton)
                    }
                }
                .padding(.vertical, 4)
            }
            .scrollClipDisabled()
        }
    }

    /// 今日一章:订阅的每本书各给下一章。
    private var today: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("今日一章")
            ForEach(library.shelfBooks) { b in
                let next = min(progress.pos[b.id]?.ch ?? 1, b.chapters)   // M0:接着当前这一章;M4 有了「学过」再改成下一章没学过的
                let title = library.pack(b)?.chapters[safe: next - 1]?.title ?? ""
                Button { open(b, chapter: next) } label: {
                    HStack(spacing: 14) {
                        Text(Numerals.chinese(next)).font(Fonts.song(17, bold: true)).foregroundStyle(b.theme.accentColor)
                            .frame(width: 46, height: 46).background(b.theme.accentColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 13))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(title).font(Fonts.song(18, bold: true)).foregroundStyle(Ink.text)
                            Text("\(b.title) · 第 \(Numerals.chinese(next)) \(b.unit)").font(.system(size: 12)).foregroundStyle(Ink.soft)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Ink.faint)
                    }
                    .padding(14).background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
                }
                .buttonStyle(.plain)
            }
        }
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
                .frame(maxWidth: .infinity).padding(.vertical, 15)
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Ink.faint.opacity(0.6), style: StrokeStyle(lineWidth: 1.2, dash: [5, 5])))
                .foregroundStyle(Ink.soft)
                .contentShape(Rectangle())
        }
    }

    private func sectionTitle(_ s: String) -> some View {
        Text(s).font(Fonts.song(20, bold: true)).foregroundStyle(Ink.text)
    }
}

struct BookCard: View {
    let book: BookInfo
    let pos: ReadPos?
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BookArt(bookID: book.id, theme: book.theme).frame(width: 150, height: 104).clipped()
            VStack(alignment: .leading, spacing: 6) {
                Text(book.title).font(Fonts.song(17, bold: true)).foregroundStyle(Ink.text).lineLimit(1)
                let done = Double((pos?.ch ?? 1) - 1) / Double(max(book.chapters, 1))
                ProgressView(value: done).tint(book.theme.accentColor)
                Text(pos == nil ? "还没开始" : "读到第 \(Numerals.chinese(pos!.ch)) \(book.unit)").font(.system(size: 11)).foregroundStyle(Ink.soft)
            }
            .padding(12)
        }
        .frame(width: 150)
        .background(Ink.card)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .shadow(color: .black.opacity(0.06), radius: 12, y: 6)
    }
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
                        RoundedRectangle(cornerRadius: 10).fill(b.theme.accentColor.gradient).frame(width: 44, height: 58)
                            .overlay(Text(String(b.title.prefix(1))).font(Fonts.song(22, bold: true)).foregroundStyle(.white))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(b.title).font(Fonts.song(18, bold: true))
                            Text("\(b.chapters) \(b.unit) · \(b.chars) 字").font(.system(size: 12)).foregroundStyle(Ink.soft)
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
