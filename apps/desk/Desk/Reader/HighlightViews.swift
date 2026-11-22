import SwiftUI

/// 四个色点,点了换色。
struct HLColorRow: View {
    let selected: Int
    let pick: (Int) -> Void
    var body: some View {
        HStack(spacing: 14) {
            ForEach(0..<4, id: \.self) { c in
                Button { pick(c) } label: {
                    Circle().fill(HLColor.markColor(c)).frame(width: 26, height: 26)
                        .overlay(Circle().stroke(Ink.text.opacity(selected == c ? 0.7 : 0), lineWidth: 2).padding(-4))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(HLColor.names[c])色")
            }
        }
        .padding(.horizontal, 4)
    }
}

/// 轻点已有划线弹出的小面板:改颜色、写 / 改批注、删除。
struct HighlightPanel: View {
    let id: String
    let editNote: () -> Void
    /// 浮卡片(iPad)用:给了就按内容定高、用它收起,不撑满整张表单。
    var close: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    /// 量出来的内容高度:表单按它定高(此前写死 220 / 290,手机上下面空出一大块)。
    @State private var measured: CGFloat = 0
    private func shut() { if let close { close() } else { dismiss() } }
    private var store: HighlightStore { .shared }

    var body: some View {
        if let h = store.get(id) {
            VStack(alignment: .leading, spacing: 16) {
                Text(h.text)
                    .font(h.layer == "o" ? Fonts.song(19) : .system(size: 16))
                    .foregroundStyle(Ink.text).lineLimit(3)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(HLColor.fillColor(h.color), in: RoundedRectangle(cornerRadius: 6))
                if h.hasNote, let n = h.note {
                    HStack(alignment: .top, spacing: 10) {
                        RoundedRectangle(cornerRadius: 2).fill(HLColor.markColor(h.color)).frame(width: 3)
                        Text(n).font(.system(size: 15)).lineSpacing(5).foregroundStyle(Ink.soft).lineLimit(4)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
                HStack {
                    HLColorRow(selected: h.color) { store.setColor(id, $0) }
                    Spacer()
                    Button { editNote() } label: {
                        Label(h.hasNote ? "改批注" : "写批注", systemImage: "square.and.pencil")
                    }
                    .buttonStyle(.bordered)
                    Button(role: .destructive) { store.delete(id); shut() } label: {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("删除划线")
                }
            }
            .frame(maxWidth: 640, alignment: .leading)
            .padding(.horizontal, 24).padding(.top, 24).padding(.bottom, close == nil ? 8 : 24)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { measured = $0 }
            .frame(maxWidth: .infinity, maxHeight: close == nil ? .infinity : nil, alignment: .topLeading)
            .background(close == nil ? Ink.paper : Color.clear)
            .modifier(FitDetent(height: measured, enabled: close == nil))
        } else {
            Color.clear.frame(height: 1).onAppear { shut() }
        }
    }
}

/// 表单按内容定高(量到高度之前先给一个估值,免得第一帧弹得过高)。
struct FitDetent: ViewModifier {
    let height: CGFloat
    var enabled = true
    var fallback: CGFloat = 220
    /// 内容太长时封顶(再往下靠表单里的滚动),并允许再拉到全屏。
    var cap: CGFloat? = nil
    func body(content: Content) -> some View {
        if enabled {
            let h = height > 0 ? ceil(height) : fallback
            if let cap { content.presentationDetents(h > cap ? [.height(cap), .large] : [.height(h)]) }
            else { content.presentationDetents([.height(h)]) }
        } else { content }
    }
}

/// 批注编辑:多行输入框,保存 / 取消。
struct NoteEditor: View {
    let id: String
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                if let h = HighlightStore.shared.get(id) {
                    Text(h.text)
                        .font(h.layer == "o" ? Fonts.song(17) : .system(size: 15))
                        .foregroundStyle(Ink.soft).lineLimit(2)
                        .padding(.leading, 10)
                        .overlay(alignment: .leading) { RoundedRectangle(cornerRadius: 2).fill(HLColor.markColor(h.color)).frame(width: 3) }
                }
                TextEditor(text: $text)
                    .font(.system(size: 17))
                    .focused($focused)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .background(Ink.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(alignment: .topLeading) {
                        if text.isEmpty {
                            Text("写下这里的想法…").font(.system(size: 17)).foregroundStyle(Ink.faint).padding(.horizontal, 15).padding(.vertical, 18).allowsHitTesting(false)
                        }
                    }
            }
            .padding(20)
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
            .background(Ink.paper)
            .navigationTitle("批注").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { HighlightStore.shared.setNote(id, text); dismiss() }.bold()
                }
            }
            .onAppear {
                text = HighlightStore.shared.get(id)?.note ?? ""
                focused = true
            }
        }
    }
}

/// 「划线与批注」记录页:本书的,按章分组、组内按段序。可只看有批注的、按层筛。点一条跳回原处,左滑删除。
struct HighlightsSheet: View {
    let book: BookInfo
    let pack: BookPack
    let pick: (Highlight) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var onlyNotes = false
    @State private var layer = "all"
    private var store: HighlightStore { .shared }

    private static let date: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "zh_CN"); f.dateFormat = "M月d日"; return f
    }()

    var body: some View {
        let all = store.alive(book: book.id)
        let shown = all.filter { (!onlyNotes || $0.hasNote) && (layer == "all" || $0.layer == layer) }
        // 按章分组;白话深读的划线在本章原文 / 译文之后另成一组(键 = 章号 × 2 + 是否白话)
        let groups = Dictionary(grouping: shown, by: { $0.no * 2 + ($0.layer == "b" ? 1 : 0) }).sorted { $0.key < $1.key }
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(all.isEmpty ? "这本书还没有划线" : "《\(book.title)》 \(all.count) 条划线 · \(all.filter(\.hasNote).count) 条批注")
                            .font(Fonts.song(16, bold: true)).foregroundStyle(Ink.text)
                        Picker("范围", selection: $onlyNotes) {
                            Text("全部").tag(false)
                            Text("只看有批注的").tag(true)
                        }
                        .pickerStyle(.segmented)
                        Picker("层", selection: $layer) {
                            Text("各层").tag("all")
                            Text("原文").tag("o")
                            Text("译文").tag("t")
                            Text("白话").tag("b")
                        }
                        .pickerStyle(.segmented)
                    }
                    .padding(.vertical, 4)
                }
                if all.isEmpty {
                    Section {
                        Text("在正文里长按选字,选「划线」或「批注」。").font(.system(size: 15)).foregroundStyle(Ink.soft)
                    }
                } else if shown.isEmpty {
                    Section { Text("没有符合条件的记录").font(.system(size: 15)).foregroundStyle(Ink.soft) }
                }
                ForEach(groups, id: \.key) { key, rows in
                    let no = key / 2
                    Section {
                        ForEach(rows) { h in
                            Button { pick(h) } label: { row(h) }
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) { store.delete(h.id) } label: { Label("删除", systemImage: "trash") }
                                }
                        }
                    } header: {
                        Text((pack.chapters.indices.contains(no - 1) ? BookSearch.chapterLabel(pack.chapters[no - 1], unit: book.unit) : "第 \(no) \(book.unit)") + (key % 2 == 1 ? " · 白话深读" : ""))
                            .font(Fonts.song(14, bold: true)).foregroundStyle(Ink.soft).textCase(nil)
                    }
                }
                // 筛选条件或记录一变就整组重建:List 增量更新时,整章的行都被筛掉 / 删光后,章标题偶尔会留成一个空段
                .id("\(onlyNotes)|\(layer)|\(store.version)")
            }
            .listStyle(.insetGrouped)
            .navigationTitle("划线与批注").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } }
                if !all.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button { Share.markdown(book) } label: { Label("导出 Markdown", systemImage: "square.and.arrow.up") }
                    }
                }
            }
        }
    }

    private func row(_ h: Highlight) -> some View {
        // 白话的划线按白话深读那一章核(白话包还没载入时不报「已改」)
        let bh = h.layer == "b" ? BaihuaStore.shared.chapter(book, h.no) : nil
        let stale = h.layer == "b" ? (bh.map { $0.locate(h) == nil } ?? false)
            : pack.chapters.indices.contains(h.no - 1) ? pack.chapters[h.no - 1].locate(h) == nil : true
        return HStack(alignment: .top, spacing: 12) {
            RoundedRectangle(cornerRadius: 2).fill(HLColor.markColor(h.color)).frame(width: 4)
            VStack(alignment: .leading, spacing: 7) {
                Text(h.text)
                    .font(h.layer == "o" ? Fonts.song(17) : .system(size: 15))
                    .foregroundStyle(Ink.text)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(HLColor.fillColor(h.color), in: RoundedRectangle(cornerRadius: 4))
                    .multilineTextAlignment(.leading)
                if h.hasNote, let n = h.note {
                    Text(n).font(.system(size: 15)).lineSpacing(4).foregroundStyle(Ink.soft).multilineTextAlignment(.leading)
                }
                HStack(spacing: 8) {
                    Text(h.layer == "o" ? "原文" : h.layer == "t" ? "译文" : "白话")
                    if h.layer == "b" {
                        if let sec = bh?.section(of: bh?.locate(h)?.seg ?? h.seg) { Text(sec).lineLimit(1) }
                    } else {
                        Text("第 \(h.seg + 1) 段")
                    }
                    Text(Self.date.string(from: h.at))
                    if stale { Text(h.layer == "b" ? "白话已改" : "原文已改").foregroundStyle(Ink.cinnabar) }
                }
                .font(.system(size: 12)).foregroundStyle(Ink.faint)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
        .fixedSize(horizontal: false, vertical: true)
    }
}
