import SwiftUI

struct ReaderScreen: View {
    @State var model: ReaderModel
    @Environment(\.dismiss) private var dismiss
    @State private var note: Note?
    @State private var showTOC = false
    @State private var showFinish = false
    @AppStorage("desk.showArt") private var showArt = true
    @Environment(\.colorScheme) private var scheme

    var theme: BookTheme { model.book.theme }

    var body: some View {
        ZStack {
            backdrop
            VStack(spacing: 0) {
                Color.clear.frame(height: 46)     // 给左上、右上的悬浮按钮让出一条,不设整栏
                GeometryReader { geo in
                    // 字号跟着屏宽走:手机 22 上下,各尺寸 iPad 30–34;一行约二十来个字,不拉成长条
                    let font = min(34, max(22, floor(geo.size.width / 22)))
                    let margin: CGFloat = geo.size.width > 600 ? 64 : 26
                    let w = min(geo.size.width - margin * 2, font * 24)
                    let size = CGSize(width: floor(w), height: floor(geo.size.height - 8))
                    PagedReader(model: model, version: model.layoutVersion, onNote: { note = $0 },
                                onSeg: { r, seg in
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    model.toggle(seg: seg, inChapter: r.ch)
                                },
                                endPage: { r in AnyView(endPage(r)) })
                        .onAppear { model.relayout(size: size, fontSize: font) }
                        .onChange(of: size) { _, s in model.relayout(size: s, fontSize: font) }
                }
                footer
            }
        }
        .overlay(alignment: .top) { chrome }
        .sheet(item: $note) { n in NoteSheet(note: n, accent: theme.accentColor).presentationDetents([.height(220)]) }
        .sheet(isPresented: $showTOC) { TOCSheet(model: model) { ch in showTOC = false; model.jump(toChapter: ch) } }
        .fullScreenCover(isPresented: $showFinish) { FinishScreen(book: model.book, stats: .sample) }
    }

    /// 页面底子:纸色 + 顶上一抹主题色 + 这一章的插画铺在页面底部、自下而上淡出(可关)。
    /// 插画只做背景:短章下半页本来空着,正好落在那里;正文长的页再调淡。没有插画时右下角放章号水印。
    private var backdrop: some View {
        let art = showArt ? UIImage(named: "art-\(model.book.id)-\(model.current.ch)") : nil
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
    }

    /// 悬浮按钮:左上返回,右上三个工具。没有整条顶栏。
    private var chrome: some View {
        HStack(spacing: 10) {
            float("chevron.left", label: "返回书桌") { dismiss() }
            Spacer()
            if UIImage(named: "art-\(model.book.id)-\(model.current.ch)") != nil {
                float(showArt ? "photo.fill" : "photo", label: showArt ? "隐藏插画" : "显示插画", on: showArt) { showArt.toggle() }
            }
            Button { model.toggleTranslation() } label: {
                Text("译").font(Fonts.song(15, bold: true)).frame(width: 38, height: 38)
                    .foregroundStyle(model.showTranslation ? .white : Ink.text)
                    .background(model.showTranslation ? AnyShapeStyle(theme.accentColor) : AnyShapeStyle(.ultraThinMaterial), in: Circle())
            }
            .accessibilityLabel(model.showTranslation ? "收起全部译文" : "展开全部译文")
            float("list.bullet", label: "目录") { showTOC = true }
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
            Spacer()
            if !model.showTranslation && model.current.page == 0 && !model.isEndPageSafe {
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
                }
                if let y = ch.yanyi, !y.isEmpty {
                    Text("延伸").font(.system(size: 12, weight: .semibold)).foregroundStyle(theme.accentColor).kerning(2)
                    ForEach(y, id: \.self) { p in
                        Text(p).font(.system(size: 15)).lineSpacing(7).foregroundStyle(Ink.soft)
                    }
                }
                if last {
                    Button { showFinish = true } label: {
                        Label("学完这本书", systemImage: "checkmark.seal.fill")
                            .font(Fonts.song(18, bold: true)).frame(maxWidth: .infinity).padding(.vertical, 16)
                            .background(Ink.cinnabar, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.white)
                    }
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

struct NoteSheet: View {
    let note: Note
    let accent: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(note.k).font(Fonts.song(26, bold: true))
                if let r = note.r { Text(r).font(Fonts.num(15, weight: .medium)).foregroundStyle(accent) }
            }
            Text(note.d).font(.system(size: 16)).lineSpacing(6).foregroundStyle(Ink.text)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .background(Ink.paper)
    }
}

struct TOCSheet: View {
    let model: ReaderModel
    let pick: (Int) -> Void
    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    let parts = model.book.parts.isEmpty ? [BookPart(title: "", from: 1, to: model.pack.chapters.count, note: nil)] : model.book.parts
                    ForEach(parts, id: \.self) { p in
                        Section(p.title) {
                            ForEach(model.pack.chapters.filter { $0.no >= p.from && $0.no <= p.to }) { c in
                                Button { pick(c.no) } label: {
                                    HStack {
                                        Text(Numerals.chinese(c.no)).font(Fonts.num(13, weight: .medium)).foregroundStyle(Ink.faint).frame(width: 44, alignment: .leading)
                                        Text(c.title).font(Fonts.song(17)).foregroundStyle(Ink.text)
                                        Spacer()
                                        if c.no == model.current.ch { Image(systemName: "bookmark.fill").foregroundStyle(model.book.theme.accentColor) }
                                    }
                                }
                                .id(c.no)
                            }
                        }
                    }
                }
                .onAppear { proxy.scrollTo(model.current.ch, anchor: .center) }
            }
            .navigationTitle("目录").navigationBarTitleDisplayMode(.inline)
        }
    }
}
