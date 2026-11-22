import SwiftUI

/// 添书:典籍(官方)/ 书房(只有管理员看得到)/ 我的导入,只列有书的几栏。三栏都按门类分栏,栏可收放、标本数
/// (典籍按清单的门类次序:易、道、儒、佛……;书房与我的导入按书多的在前);
/// 顶上一个搜索框(书名、作者、门类、标签都搜)。书多了(书房一百五十本上下)也一眼清楚:List 懒加载,栏默认收着。
struct CatalogSheet: View {
    let library: Library
    /// 打开时落到哪一栏:official / shelf / imported。
    @Binding var focus: String?
    /// 点书包那一行:看这本书的首页。
    var onHome: (BookInfo) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var collapsed: Set<String> = []
    @State private var seeded = false
    @State private var picking = false
    @State private var askLink = false
    @State private var link = ""
    private var shelf: ShelfStore { .shared }
    private var store: DeskbookStore { .shared }

    private var q: String { query.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        NavigationStack {
            Group {
                if library.manifest == nil && store.all.isEmpty && shelf.visibleItems.isEmpty {
                    // 第一次打开、还没拉到书目:转圈;拉不到:说明 + 重试。不留空白页
                    VStack(spacing: 14) {
                        if library.refreshing || library.loadError == nil {
                            ProgressView()
                            Text("正在取书目…").font(.system(size: 14)).foregroundStyle(Ink.soft)
                        } else {
                            OfflineCard(message: library.loadError ?? "书目取不到", busy: false, note: library.shelf.isEmpty ? nil : "已经放上书桌的书,没网也照样能读。") { Task { await library.refresh() } }
                        }
                    }
                    .padding(24)
                    .frame(maxWidth: 460, maxHeight: .infinity)
                    .frame(maxWidth: .infinity)
                    .background(Ink.paper)
                    .task { if !library.refreshing { await library.refresh() } }
                } else { list }
            }
            .navigationTitle("添书").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button("从文件导入书包", systemImage: "folder") { picking = true }
                        Button("粘贴书包链接", systemImage: "link") {
                            let clip = UIPasteboard.general.hasURLs ? UIPasteboard.general.url?.absoluteString : nil
                            link = clip.flatMap { $0.hasPrefix("https://") ? $0 : nil } ?? ""
                            askLink = true
                        }
                    } label: { Label("导入", systemImage: "square.and.arrow.down") }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("好了") { dismiss() } }
            }
            .fileImporter(isPresented: $picking, allowedContentTypes: [.deskbook]) { r in
                if case .success(let u) = r { ImportCenter.shared.open(u) }
            }
            .alert("贴一个书包的链接", isPresented: $askLink) {
                TextField("https://…/书名.deskbook", text: $link).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                Button("下载并导入") { if let u = URL(string: link.trimmingCharacters(in: .whitespacesAndNewlines)) { ImportCenter.shared.fetch(u) } }
                Button("取消", role: .cancel) {}
            } message: { Text("只认 https 开头的链接。") }
        }
        .task { await shelf.refresh() }
    }

    // MARK: 筛选与分栏

    private func hit(_ fields: [String?]) -> Bool {
        guard !q.isEmpty else { return true }
        return fields.contains { ($0 ?? "").localizedCaseInsensitiveContains(q) }
    }

    private var officialBooks: [BookInfo] {
        (library.manifest?.books ?? []).filter { hit([$0.title, $0.alias, $0.attribution, $0.brief, $0.category]) }
    }

    /// 典籍按门类分栏,次序照清单的 categories(站内门户的次序);清单里没有次序的门类排在后面。
    private var officialGroups: [(String, [BookInfo])] {
        let order = library.manifest?.categories ?? []
        let rank: (String) -> Int = { order.firstIndex(of: $0) ?? order.count }
        return Dictionary(grouping: officialBooks, by: \.shelfCategory).map { ($0.key, $0.value) }
            .sorted { (rank($0.0), $0.0) < (rank($1.0), $1.0) }
    }

    private var shelfGroups: [(String, [ShelfItem])] {
        let items = shelf.visibleItems.filter { hit([$0.title, $0.subtitle, $0.category, $0.summary, ($0.authors ?? []).joined(separator: " "), ($0.tags ?? []).joined(separator: " ")]) }
        return group(items, by: \.categoryLabel)
    }

    private var mineGroups: [(String, [BookInfo])] {
        let books = store.all.filter { $0.origin == .imported && hit([$0.title, $0.subtitle, $0.category, $0.brief, $0.attribution, ($0.tags ?? []).joined(separator: " ")]) }
        return group(books, by: \.shelfCategory)
    }

    /// 按门类分组;门类按书多的在前,「其他」垫底。
    private func group<T>(_ xs: [T], by key: (T) -> String) -> [(String, [T])] {
        Dictionary(grouping: xs, by: key).map { ($0.key, $0.value) }
            .sorted { ($0.0 == "其他" ? 1 : 0, -$0.1.count, $0.0) < ($1.0 == "其他" ? 1 : 0, -$1.1.count, $1.0) }
    }

    private func isOpen(_ k: String) -> Bool { !q.isEmpty || !collapsed.contains(k) }

    private var list: some View {
        ScrollViewReader { proxy in
            List {
                let og = officialGroups
                let off = og.flatMap(\.1)
                if og.count == 1 {
                    Section {
                        ForEach(off) { officialRow($0) }
                    } header: { bigHeader("典籍", off.count, sub: "观象的研读底本,所有人都有") }
                    .id("official")
                } else if !og.isEmpty {
                    Section { anchor("official", "观象的研读底本,所有人都有。按门类分栏,点栏头收放。") } header: { bigHeader("典籍", off.count, sub: nil) }
                    ForEach(og, id: \.0) { cat, books in
                        Section {
                            if isOpen("o|" + cat) { ForEach(books) { officialRow($0) } }
                        } header: { catHeader("o|" + cat, cat, books.count, onDesk: books.filter { library.shelf.contains($0.id) }.count) }
                    }
                }
                let sg = shelfGroups
                if !sg.isEmpty {
                    Section { anchor("shelf", "只有你的管理员账号看得到。按门类分栏,点栏头收放。") } header: { bigHeader("书房", sg.reduce(0) { $0 + $1.1.count }, sub: nil) }
                    ForEach(sg, id: \.0) { cat, items in
                        Section {
                            if isOpen("s|" + cat) { ForEach(items) { shelfRow($0) } }
                        } header: { catHeader("s|" + cat, cat, items.count) }
                    }
                }
                let mg = mineGroups
                if !mg.isEmpty {
                    Section { anchor("imported", "只存在这台设备上,不上传。") } header: { bigHeader("我的导入", mg.reduce(0) { $0 + $1.1.count }, sub: nil) }
                    ForEach(mg, id: \.0) { cat, books in
                        Section {
                            if isOpen("m|" + cat) { ForEach(books) { mineRow($0) } }
                        } header: { catHeader("m|" + cat, cat, books.count) }
                    }
                }
                if !q.isEmpty && off.isEmpty && sg.isEmpty && mg.isEmpty {
                    Text("没有找到「\(q)」").font(.system(size: 15)).foregroundStyle(Ink.soft).frame(maxWidth: .infinity).padding(.vertical, 30)
                        .listRowBackground(Color.clear)
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "书名、作者或门类")
            .onAppear {
                if !seeded {
                    seeded = true
                    // 书多时各门类先收着,只看栏头;少时全展开
                    let sg = shelfGroups
                    if sg.reduce(0, { $0 + $1.1.count }) > 24 { collapsed.formUnion(sg.map { "s|" + $0.0 }) }
                    let og = officialGroups
                    if og.reduce(0, { $0 + $1.1.count }) > 24 { collapsed.formUnion(og.map { "o|" + $0.0 }) }
                }
                if let f = focus { focus = nil; DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { withAnimation { proxy.scrollTo(f, anchor: .top) } } }
            }
        }
    }

    /// 跳栏用的落点(一行零高的空行;空的 Section 滚不过去)。
    private func anchor(_ id: String, _ text: String) -> some View {
        Text(text).font(.system(size: 12.5)).foregroundStyle(Ink.soft).id(id)
    }

    private func bigHeader(_ t: String, _ n: Int, sub: String?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(t).font(Fonts.song(20, bold: true)).foregroundStyle(Ink.text)
                Text("\(n) 本").font(Fonts.num(12, weight: .medium)).foregroundStyle(Ink.faint)
            }
            if let sub { Text(sub).font(.system(size: 12)).foregroundStyle(Ink.soft) }
        }
        .textCase(nil)
        .padding(.top, 8)
        .accessibilityAddTraits(.isHeader)
    }

    private func catHeader(_ key: String, _ cat: String, _ n: Int, onDesk: Int = 0) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { if collapsed.contains(key) { collapsed.remove(key) } else { collapsed.insert(key) } }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).rotationEffect(.degrees(isOpen(key) ? 90 : 0))
                Text(cat).font(.system(size: 14, weight: .semibold))
                Text("\(n)").font(Fonts.num(12, weight: .medium)).foregroundStyle(Ink.faint)
                Spacer()
                if onDesk > 0 {
                    Label("\(onDesk)", systemImage: "checkmark.circle").font(Fonts.num(11, weight: .medium)).foregroundStyle(Ink.faint)
                        .labelStyle(.titleAndIcon)
                }
            }
            .foregroundStyle(Ink.soft)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .textCase(nil)
        .disabled(!q.isEmpty)
        .accessibilityLabel("\(cat),\(n) 本," + (onDesk > 0 ? "\(onDesk) 本在书桌上," : "") + (isOpen(key) ? "已展开" : "已收起"))
    }

    // MARK: 行

    private func thumb(_ img: UIImage?, title: String, theme: BookTheme) -> some View {
        Group {
            if let img { Image(uiImage: img).resizable().scaledToFill() }
            else {
                RoundedRectangle(cornerRadius: 10).fill(theme.accentColor.gradient)
                    .overlay(Text(String(title.prefix(1))).font(Fonts.song(22, bold: true)).foregroundStyle(.white))
            }
        }
        .frame(width: 44, height: 58).clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityHidden(true)
    }

    private func officialRow(_ b: BookInfo) -> some View {
        HStack(spacing: 14) {
            thumb(ArtStore.shared.image(b, .cover), title: b.title, theme: b.theme)
            VStack(alignment: .leading, spacing: 4) {
                Text(b.title).font(Fonts.song(18, bold: true)).lineLimit(2)
                Text("\(b.sizeLabel) · \(b.chars >= 10000 ? Fmt.charsText(b.chars) : "\(b.chars) 字") · \(ByteCountFormatter.string(fromByteCount: Int64(b.totalBytes), countStyle: .file))")
                    .font(.system(size: 12)).foregroundStyle(Ink.soft)
                if !b.brief.isEmpty { Text(b.brief).font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(2) }
                if let has = layersLine(b) { Text(has).font(.system(size: 11)).foregroundStyle(Ink.faint).lineLimit(1) }
                if let d = b.disclaimers?.first {
                    Label(d, systemImage: "info.circle").font(.system(size: 11)).foregroundStyle(Ink.faint).lineLimit(1).labelStyle(.titleAndIcon)
                }
            }
            Spacer()
            if library.shelf.contains(b.id) {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(b.theme.accentColor).font(.system(size: 22))
                    .accessibilityLabel("已在书桌上")
            } else if library.downloading.contains(b.id) {
                ProgressView()
            } else if library.failed.contains(b.id) {
                VStack(alignment: .trailing, spacing: 4) {
                    Button("重试") { Task { await library.add(b) } }
                        .buttonStyle(.bordered).tint(b.theme.accentColor).controlSize(.small)
                    Text("没下下来").font(.system(size: 11)).foregroundStyle(Ink.cinnabar)
                }
            } else {
                Button("放上书桌") { Task { await library.add(b) } }
                    .buttonStyle(.borderedProminent).tint(b.theme.accentColor).controlSize(.small)
            }
        }
        .padding(.vertical, 6)
    }

    /// 这本书有什么:译注 / 详注 / 白话各几章(没有的不写;每章都有的只写名字)。
    private func layersLine(_ b: BookInfo) -> String? {
        var p: [String] = []
        let n = b.chapters
        let say: (String, Int) -> String = { name, k in k >= n ? name : "\(name) \(k) \(b.unit)" }
        if let l = b.layers {
            if l.trans > 0 || l.notes > 0 { p.append(say("译注", max(l.trans, l.notes))) }
            if l.xiang > 0 { p.append(say("详注", l.xiang)) }
        }
        if let bh = b.baihua {
            p.append(bh.subs.map { s in (bh.essays ?? 0) > 0 ? "白话 \(bh.essays!) \(b.unit) + \(s) 篇" : "白话 \(s) 篇" } ?? say("白话", bh.chapters))
            if (bh.figsDone ?? 0) > 0 { p.append("图解 \(bh.figsDone!)") }
        }
        return p.isEmpty ? nil : p.joined(separator: " · ")
    }

    private func meta(_ kind: String, _ chapters: Int?, _ unit: String?, _ bytes: Int?) -> String {
        var p = [kind]
        if let c = chapters { p.append("\(c) \(unit ?? "章")") }
        if let b = bytes, b > 0 { p.append(ByteCountFormatter.string(fromByteCount: Int64(b), countStyle: .file)) }
        return p.joined(separator: " · ")
    }

    private func shelfRow(_ it: ShelfItem) -> some View {
        let local = store.info(it.id)
        let accent = it.accent.accentColor
        return HStack(spacing: 14) {
            thumb(shelf.cover(it), title: it.title, theme: it.accent)
            VStack(alignment: .leading, spacing: 4) {
                Text(it.title).font(Fonts.song(17, bold: true)).lineLimit(2)
                Text(meta(it.kindLabel, it.chapters, it.unit, it.bytes)).font(.system(size: 12)).foregroundStyle(Ink.soft)
                if let s = it.summary ?? it.subtitle { Text(s).font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(2) }
                if let e = shelf.failed[it.id] { Text(e).font(.system(size: 11)).foregroundStyle(Ink.cinnabar).lineLimit(2) }
            }
            Spacer(minLength: 6)
            if let p = shelf.progress[it.id] {
                ZStack {
                    ProgressView(value: p).progressViewStyle(.circular).tint(accent)
                    if p > 0 { Text("\(Int(p * 100))").font(Fonts.num(9, weight: .bold)).foregroundStyle(Ink.soft) }
                }
                .accessibilityLabel("正在下载,\(Int(p * 100))%")
            } else if let local, shelf.updateAvailable(it.id) {
                VStack(alignment: .trailing, spacing: 3) {
                    Button("更新") { shelf.download(it) }.buttonStyle(.borderedProminent).tint(accent).controlSize(.small)
                    Text("有第 \(it.revision) 版(本机第 \(local.revision ?? 0) 版)").font(.system(size: 10.5)).foregroundStyle(Ink.faint)
                }
            } else if local != nil, library.shelf.contains(it.id) {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(accent).font(.system(size: 22)).accessibilityLabel("已在书桌上")
            } else if local != nil {
                Button("放上书桌") { library.putOnShelf(it.id) }.buttonStyle(.borderedProminent).tint(accent).controlSize(.small)
            } else {
                Button(shelf.failed[it.id] == nil ? "加到书桌" : "重试") { shelf.download(it) }
                    .buttonStyle(.borderedProminent).tint(accent).controlSize(.small)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .onTapGesture { if let local { onHome(local) } }
    }

    private func mineRow(_ b: BookInfo) -> some View {
        HStack(spacing: 14) {
            thumb(ArtStore.shared.image(b, .cover), title: b.title, theme: b.theme)
            VStack(alignment: .leading, spacing: 4) {
                Text(b.title).font(Fonts.song(17, bold: true)).lineLimit(2)
                Text(meta(b.kindLabel, b.chapters, b.unit, DeskbookStore.shared.record(b.id)?.fileBytes) + " · 第 \(b.revision ?? 1) 版").font(.system(size: 12)).foregroundStyle(Ink.soft)
                if !b.brief.isEmpty { Text(b.brief).font(.system(size: 13)).foregroundStyle(Ink.soft).lineLimit(2) }
            }
            Spacer(minLength: 6)
            if library.shelf.contains(b.id) {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(b.theme.accentColor).font(.system(size: 22)).accessibilityLabel("已在书桌上")
            } else {
                Button("放上书桌") { library.putOnShelf(b.id) }.buttonStyle(.borderedProminent).tint(b.theme.accentColor).controlSize(.small)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .onTapGesture { onHome(b) }
    }
}
