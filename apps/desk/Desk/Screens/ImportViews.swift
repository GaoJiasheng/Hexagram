import SwiftUI
import UIKit
import UniformTypeIdentifiers

extension UTType {
    /// 书包(Info.plist 里导出的类型,扩展名 .deskbook)。
    static let deskbook = UTType(exportedAs: "pub.gavin.hexa.deskbook", conformingTo: .data)
}

/// 书包格式的公开页(标准、校验器、做书 skill、示例书包)。
enum DeskStandard {
    #if DEBUG
    static let base = URL(string: ProcessInfo.processInfo.environment["DESK_STANDARD"] ?? "http://localhost:8765/desk/standard/")!
    #else
    static let base = URL(string: "https://hexa.gavin.pub/desk/standard/")!
    #endif
    static let version = DBRules.formatVersion
    static var tool: URL { base.appendingPathComponent("deskbook.mjs") }
    static var skill: URL { base.appendingPathComponent("deskbook-skill.zip") }
    static let samples: [(file: String, title: String, kind: String)] = [
        ("sample-book.deskbook", "摆的道理", "现代书 · 动画与图解"),
        ("sample-fitness.deskbook", "深蹲的形", "现代书 · 带健身声明"),
        ("sample-collection.deskbook", "厨房里的科学", "文集 · 三篇短文"),
        ("sample-classic.deskbook", "道德经 · 三章", "典籍 · 原文译注"),
    ]
    static func sample(_ f: String) -> URL { base.appendingPathComponent("samples/\(f)") }
}

/// 导入书包:从「用书桌打开」、文件选择、粘贴链接三处进来 → 读一遍书包 → 确认卡片 → 装进书桌。
/// 卡片挂在最上面那一层(阅读中隔空投送过来也能弹出)。书只存在这台设备上,不上传。
@MainActor
@Observable
final class ImportCenter {
    static let shared = ImportCenter()

    enum Relation: Equatable { case new, update(from: Int), same(Int), older(Int) }
    enum State {
        case reading(String)
        case ready(DeskbookPreview, Relation)
        case installing(DeskbookPreview)
        case done(BookInfo, updated: Bool)
        case failed(String)
    }

    private(set) var state: State?
    /// 要书桌首页打开的书(装好后点了「现在读」、账号面板里的书点了读):首页收起别的面板再打开。
    struct OpenRequest: Equatable { var id: String; var ch: Int?; var home: Bool }
    var openRequest: OpenRequest?
    @ObservationIgnored private var file: URL?
    @ObservationIgnored private weak var host: UIViewController?

    private let inbox: URL = {
        let d = FileManager.default.temporaryDirectory.appendingPathComponent("import", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()

    /// 「用书桌打开」/ 文件选择给的文件:先拷一份到临时目录(原文件可能在别的 App 的沙盒里、只给了临时访问权)。
    func open(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let to = inbox.appendingPathComponent("\(UUID().uuidString).deskbook")
        do {
            try FileManager.default.copyItem(at: url, to: to)
        } catch {
            show(.failed("文件读不了:\(error.localizedDescription)"))
            return
        }
        // 系统放进 Documents/Inbox 的那份用完就删
        if url.path.contains("/Documents/Inbox/") { try? FileManager.default.removeItem(at: url) }
        read(to, name: url.lastPathComponent)
    }

    /// 粘贴的链接:只认 https(调试版另认本机地址)。下到临时目录再走同一套。
    func fetch(_ link: URL) {
        guard Self.allowed(link) else { show(.failed("只认 https 开头的链接")); return }
        show(.reading("正在下载书包…"))
        Task {
            do {
                let (tmp, resp) = try await Library.session.download(from: link)
                guard let code = (resp as? HTTPURLResponse)?.statusCode, code == 200 else { throw DeskbookError("下载没成功(\((resp as? HTTPURLResponse)?.statusCode ?? 0))") }
                let size = (try? FileManager.default.attributesOfItem(atPath: tmp.path)[.size] as? Int) ?? 0
                if size > DBRules.totalBytes { throw DeskbookError("书包超过 300 MB") }
                let to = inbox.appendingPathComponent("\(UUID().uuidString).deskbook")
                try FileManager.default.moveItem(at: tmp, to: to)
                read(to, name: link.lastPathComponent)
            } catch {
                show(.failed((error as? LocalizedError)?.errorDescription ?? "下载没成功,检查一下链接与网络"))
            }
        }
    }

    static func allowed(_ u: URL) -> Bool {
        if u.scheme?.lowercased() == "https" { return true }
        #if DEBUG
        if u.scheme == "http", ["localhost", "127.0.0.1"].contains(u.host ?? "") { return true }
        #endif
        return false
    }

    private func read(_ f: URL, name: String) {
        file = f
        show(.reading("正在读书包…"))
        Task {
            do {
                let p = try await Task.detached(priority: .userInitiated) { try DeskbookInstaller.inspect(f) }.value
                if Library.shared.isOfficial(p.book.id) { throw DeskbookError("这本书包的 id「\(p.book.id)」与官方典籍重名,书桌不收。请换一个 id(自己做的书以 u- 开头)。") }
                let rel: Relation
                if let old = DeskbookStore.shared.info(p.book.id) {
                    let o = old.revision ?? 0, n = p.book.revision ?? 0
                    rel = n > o ? .update(from: o) : n == o ? .same(o) : .older(o)
                } else { rel = .new }
                state = .ready(p, rel)
            } catch {
                discard()
                state = .failed((error as? LocalizedError)?.errorDescription ?? "书包读不开")
            }
        }
    }

    /// 确认:装进书桌(同 id 新版就地换掉,进度与划线照旧)。
    func confirm() {
        guard case .ready(let p, let rel) = state, let f = file else { return }
        state = .installing(p)
        Task {
            do {
                let info = try await DeskbookStore.shared.install(f, origin: .imported, sha256: p.sha256, keepPackage: true)
                Library.shared.putOnShelf(info.id)
                discard()
                if case .update = rel { state = .done(info, updated: true) } else { state = .done(info, updated: false) }
            } catch {
                discard()
                state = .failed((error as? LocalizedError)?.errorDescription ?? "没装上")
            }
        }
    }

    func close(read: Bool = false) {
        if read, case .done(let b, _) = state { openRequest = OpenRequest(id: b.id, ch: nil, home: true) }
        discard()
        state = nil
        host?.dismiss(animated: true)
        host = nil
    }

    private func discard() {
        if let f = file { try? FileManager.default.removeItem(at: f) }
        file = nil
    }

    private func show(_ s: State) {
        state = s
        guard host == nil || host?.presentingViewController == nil else { return }
        guard let top = UIApplication.topViewController() else { return }
        let vc = UIHostingController(rootView: ImportCard().tint(Ink.cinnabar).environment(\.locale, Locale(identifier: "zh_CN")))
        vc.modalPresentationStyle = .formSheet
        vc.isModalInPresentation = true
        vc.view.backgroundColor = UIColor(Ink.paper)
        if let sh = vc.sheetPresentationController { sh.detents = [.large()]; sh.prefersGrabberVisible = false }
        top.present(vc, animated: true)
        host = vc
    }

    #if DEBUG
    /// 调试:DESK_IMPORT=路径(逗号分隔几个)启动时直接装,不弹卡片。
    func importDirect(_ paths: [String]) async {
        for p in paths where !p.isEmpty {
            let u = URL(fileURLWithPath: p)
            let to = inbox.appendingPathComponent("\(UUID().uuidString).deskbook")
            do {
                try FileManager.default.copyItem(at: u, to: to)
                let info = try await DeskbookStore.shared.install(to, origin: .imported, keepPackage: true)
                Library.shared.putOnShelf(info.id)
                NSLog("DESKIMPORT ok %@ r%d", info.id, info.revision ?? 0)
            } catch { NSLog("DESKIMPORT fail %@ %@", p, "\(error)") }
            try? FileManager.default.removeItem(at: to)
        }
    }
    #endif
}

/// 导入确认卡片:封面、书名、体裁、章数、大小、来源与指纹、声明、「只存在这台设备上」。
struct ImportCard: View {
    private var center: ImportCenter { .shared }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    switch center.state {
                    case .reading(let s)?: waiting(s)
                    case .ready(let p, let rel)?: card(p, rel)
                    case .installing(let p)?: card(p, nil)
                    case .done(let b, let updated)?: done(b, updated)
                    case .failed(let m)?: failed(m)
                    case nil: EmptyView()
                    }
                }
                .frame(maxWidth: 520, alignment: .leading)
                .padding(24)
                .frame(maxWidth: .infinity)
            }
            .background(Ink.paper.ignoresSafeArea())
            .navigationTitle("导入书包").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if case .installing = center.state {} else { Button(isDone ? "好" : "取消") { center.close() } }
                }
            }
        }
    }

    private var isDone: Bool { if case .done = center.state { return true } else { return false } }

    private func waiting(_ s: String) -> some View {
        VStack(spacing: 12) { ProgressView(); Text(s).font(.system(size: 15)).foregroundStyle(Ink.soft) }
            .frame(maxWidth: .infinity).padding(.top, 80)
    }

    private func failed(_ m: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: "exclamationmark.triangle").font(.system(size: 28, weight: .medium)).foregroundStyle(Ink.cinnabar)
            Text("这个书包导不进来").font(Fonts.song(22, bold: true)).foregroundStyle(Ink.text)
            Text(m).font(.system(size: 15)).foregroundStyle(Ink.text).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
            Text("书包的格式见「我的 → 自定义导入」里的标准;用校验器 deskbook.mjs validate 查一遍,会指出是哪个文件、哪一块。")
                .font(.system(size: 13)).foregroundStyle(Ink.soft).lineSpacing(3).fixedSize(horizontal: false, vertical: true)
            Button("好") { center.close() }.buttonStyle(.borderedProminent).padding(.top, 6)
        }
    }

    private func done(_ b: BookInfo, _ updated: Bool) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 30)).foregroundStyle(b.theme.accentColor)
            Text(updated ? "已更新到第 \(b.revision ?? 1) 版" : "《\(b.title)》已放上书桌").font(Fonts.song(22, bold: true)).foregroundStyle(Ink.text)
            Text(updated ? "阅读进度、时长、划线与批注都照旧。" : "书只存在这台设备上。换一台设备要再导入一次;进度与划线登录后跟着账号走。")
                .font(.system(size: 15)).foregroundStyle(Ink.soft).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 12) {
                Button { center.close(read: true) } label: {
                    Text("现在读").font(Fonts.song(17, bold: true)).frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(b.theme.accentColor, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                Button { center.close() } label: {
                    Text("好").font(.system(size: 16, weight: .semibold)).frame(width: 90).padding(.vertical, 13)
                        .background(Ink.line.opacity(0.6), in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(Ink.text)
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 6)
        }
    }

    private func card(_ p: DeskbookPreview, _ rel: ImportCenter.Relation?) -> some View {
        let b = p.book
        let accent = b.theme.accentColor
        return VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 16) {
                Group {
                    if let d = p.cover, let img = UIImage(data: d) {
                        Image(uiImage: img).resizable().scaledToFill()
                    } else {
                        LinearGradient(colors: [accent, b.theme.accent2Color.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)
                            .overlay(Text(String(b.title.prefix(1))).font(Fonts.song(30, bold: true)).foregroundStyle(.white))
                    }
                }
                .frame(width: 96, height: 144).clipShape(RoundedRectangle(cornerRadius: 10))
                .shadow(color: .black.opacity(0.15), radius: 8, y: 4)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 6) {
                    Text(b.kindLabel + (b.category.map { " · \($0)" } ?? "")).font(.system(size: 12, weight: .semibold)).foregroundStyle(accent)
                    Text(b.title).font(Fonts.song(23, bold: true)).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true)
                    if let s = b.subtitle { Text(s).font(Fonts.song(15)).foregroundStyle(Ink.soft).fixedSize(horizontal: false, vertical: true) }
                    if !b.attribution.isEmpty { Text(b.attribution).font(.system(size: 13)).foregroundStyle(Ink.soft) }
                    Text("\(b.chapters) \(b.unit) · \(ByteCountFormatter.string(fromByteCount: Int64(p.fileBytes), countStyle: .file))" + (p.mediaFiles > 0 ? " · \(p.mediaFiles) 个图片与视频" : ""))
                        .font(.system(size: 12.5)).foregroundStyle(Ink.faint)
                }
            }
            if !b.brief.isEmpty { Text(b.brief).font(.system(size: 15)).foregroundStyle(Ink.text).lineSpacing(4).fixedSize(horizontal: false, vertical: true) }
            DisclaimerBanner(lines: b.disclaimers ?? [])
            VStack(alignment: .leading, spacing: 6) {
                if let s = b.sourceLine { row("来源", s) }
                row("版本", "第 \(b.revision ?? 1) 版" + (p.generator.map { " · \($0)" } ?? ""))
                row("标识", b.id)
                row("指纹", "SHA-256 " + String(p.sha256.prefix(16)) + "…")
                if !p.ignored.isEmpty { row("略过", "\(p.ignored.count) 个书桌不认的文件(不解开)") }
            }
            .padding(14)
            .background(Ink.card, in: RoundedRectangle(cornerRadius: 14))
            Label("只存在这台设备上,不上传。", systemImage: "lock.iphone").font(.system(size: 13, weight: .medium)).foregroundStyle(Ink.soft)
            if let rel {
                switch rel {
                case .new: primary("放上书桌", accent)
                case .update(let from):
                    Text("书桌上已有第 \(from) 版。更新后阅读进度、划线与批注照旧。").font(.system(size: 14)).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true)
                    primary("更新到第 \(b.revision ?? 1) 版", accent)
                case .same(let r):
                    Text("书桌上已经有这本(第 \(r) 版),不用再导入。").font(.system(size: 14)).foregroundStyle(Ink.text)
                    Button("好") { center.close() }.buttonStyle(.bordered)
                case .older(let r):
                    Text("书桌上已有更新的第 \(r) 版,这一份是旧版,不导入。").font(.system(size: 14)).foregroundStyle(Ink.text)
                    Button("好") { center.close() }.buttonStyle(.bordered)
                }
            } else {
                HStack(spacing: 10) { ProgressView(); Text("正在放上书桌…").font(.system(size: 15)).foregroundStyle(Ink.soft) }
            }
        }
    }

    private func primary(_ t: String, _ accent: Color) -> some View {
        Button { center.confirm() } label: {
            Text(t).font(Fonts.song(17, bold: true)).frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(accent, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
        }
        .buttonStyle(.plain)
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(k).font(.system(size: 12, weight: .semibold)).foregroundStyle(Ink.faint).frame(width: 34, alignment: .leading)
            Text(v).font(.system(size: 13)).foregroundStyle(Ink.text).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
        }
    }
}

/// 「我的 → 自定义导入」:书包是什么、三步做一本、标准与工具的下载、导入按钮、我导入的书。
struct CustomImportScreen: View {
    @State private var picking = false
    @State private var askLink = false
    @State private var link = ""
    @State private var openBook: BookInfo?
    private var store: DeskbookStore { .shared }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("自己做一本书,放上书桌").font(Fonts.song(24, bold: true)).foregroundStyle(Ink.text)
                    Text("书桌读的每一本书都是一个「书包」:一个 .deskbook 文件。格式是公开的,谁都可以照着它做一本——读书笔记、讲义、科普文集、带动图的健身书——导进自己的书桌,和典籍一样划线、记时长、学完。")
                        .font(.system(size: 15)).foregroundStyle(Ink.soft).lineSpacing(5).fixedSize(horizontal: false, vertical: true)
                }
                importButtons
                section("书包是什么") {
                    Text("一个 zip:里面一份 book.json(书名、作者、门类、目录),每章一个 json 文件,另有图片与短视频。三种体裁:")
                        .font(.system(size: 14)).foregroundStyle(Ink.text).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                    kindRow("典籍", "原文分段、译文、字词注,章末一篇深读;像这里的六部经典那样翻页读")
                    kindRow("现代书", "一章一篇文章,纵向长文;可带图解、图片与循环播放的动图")
                    kindRow("文集", "若干独立文章,各有作者与日期;目录是文章列表")
                }
                section("三步做一本") {
                    step(1, "照标准写", "写 book.json 与每章的文件。也可以把做书用的 skill 交给 AI 助手,让它照标准帮你起草。")
                    step(2, "校验、打包", "node deskbook.mjs validate 目录 —— 指出哪个文件、哪一块不合;通过后 node deskbook.mjs pack 目录 打成 .deskbook。")
                    step(3, "传到这台设备", "隔空投送、「文件」、分享菜单里选「用书桌打开」,或在这里贴一个 https 链接。")
                }
                section("标准与工具") {
                    Link(destination: DeskStandard.base) { linkRow("书包格式标准 v\(DeskStandard.version)", "全文、结构定义、红线与声明", icon: "doc.text") }
                    Divider().overlay(Ink.line)
                    Link(destination: DeskStandard.tool) { linkRow("校验器 deskbook.mjs", "单文件,Node 18+,无依赖", icon: "checkmark.shield") }
                    Divider().overlay(Ink.line)
                    Link(destination: DeskStandard.skill) { linkRow("做书用的 skill", "deskbook-skill.zip,交给 AI 助手照标准起草", icon: "wand.and.stars") }
                }
                section("示例书包") {
                    Text("点一本直接导入看看(四本加起来不到 0.5 MB)。").font(.system(size: 13)).foregroundStyle(Ink.soft)
                    ForEach(DeskStandard.samples, id: \.file) { s in
                        Button { ImportCenter.shared.fetch(DeskStandard.sample(s.file)) } label: { linkRow(s.title, s.kind, icon: "shippingbox", chevron: "arrow.down.circle") }
                            .buttonStyle(.plain)
                    }
                }
                let mine = store.all.filter { $0.origin == .imported }
                if !mine.isEmpty {
                    section("我导入的书") {
                        ForEach(mine, id: \.id) { b in
                            Button { openBook = b } label: { linkRow(b.title, "\(b.kindLabel) · \(b.chapters) \(b.unit) · 第 \(b.revision ?? 1) 版", icon: "book.closed") }
                                .buttonStyle(.plain)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Label("导入的书只存在这台设备上,不上传。", systemImage: "lock.iphone").font(.system(size: 13, weight: .medium)).foregroundStyle(Ink.soft)
                    Text("书桌读书包格式 v\(DeskStandard.version)。遇到更新版本的书包,会提示升级 App。").font(.system(size: 12)).foregroundStyle(Ink.faint)
                }
            }
            .frame(maxWidth: 560, alignment: .leading)
            .padding(.horizontal, 24).padding(.vertical, 20)
            .frame(maxWidth: .infinity)
        }
        .background(Ink.paper.ignoresSafeArea())
        .navigationTitle("自定义导入").navigationBarTitleDisplayMode(.inline)
        .fileImporter(isPresented: $picking, allowedContentTypes: [.deskbook]) { r in
            if case .success(let u) = r { ImportCenter.shared.open(u) }
        }
        .alert("贴一个书包的链接", isPresented: $askLink) {
            TextField("https://…/书名.deskbook", text: $link).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
            Button("下载并导入") { if let u = URL(string: link.trimmingCharacters(in: .whitespacesAndNewlines)) { ImportCenter.shared.fetch(u) } }
            Button("取消", role: .cancel) {}
        } message: { Text("只认 https 开头的链接。") }
        .sheet(item: $openBook) { b in BookHomeScreen(book: b) { ch in openBook = nil; ImportCenter.shared.openRequest = .init(id: b.id, ch: ch, home: false) } }
    }

    private var importButtons: some View {
        HStack(spacing: 12) {
            Button { picking = true } label: {
                Label("从文件导入", systemImage: "folder").font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(Ink.cinnabar, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            Button {
                let clip = UIPasteboard.general.hasURLs ? UIPasteboard.general.url?.absoluteString : nil
                link = clip.flatMap { $0.hasPrefix("https://") ? $0 : nil } ?? ""
                askLink = true
            } label: {
                Label("粘贴链接", systemImage: "link").font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(Ink.cinnabar.opacity(0.1), in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(Ink.cinnabar)
            }
            .buttonStyle(.plain)
        }
    }

    private func section<C: View>(_ title: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.system(size: 12, weight: .semibold)).kerning(2).foregroundStyle(Ink.soft)
            c()
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.card, in: RoundedRectangle(cornerRadius: 18))
    }

    private func kindRow(_ k: String, _ d: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(k).font(Fonts.song(15, bold: true)).foregroundStyle(Ink.cinnabar).frame(width: 48, alignment: .leading)
            Text(d).font(.system(size: 14)).foregroundStyle(Ink.text).lineSpacing(3).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func step(_ n: Int, _ t: String, _ d: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(n)").font(Fonts.num(13, weight: .bold)).foregroundStyle(.white).frame(width: 24, height: 24).background(Ink.cinnabar, in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(t).font(.system(size: 15, weight: .semibold)).foregroundStyle(Ink.text)
                Text(d).font(.system(size: 13.5)).foregroundStyle(Ink.soft).lineSpacing(3).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func linkRow(_ t: String, _ sub: String, icon: String, chevron: String = "chevron.right") -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 16, weight: .medium)).foregroundStyle(Ink.soft).frame(width: 22).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(t).font(.system(size: 15, weight: .medium)).foregroundStyle(Ink.text)
                Text(sub).font(.system(size: 12)).foregroundStyle(Ink.faint)
            }
            Spacer(minLength: 0)
            Image(systemName: chevron).font(.system(size: 13, weight: .semibold)).foregroundStyle(Ink.faint).accessibilityHidden(true)
        }
        .contentShape(Rectangle())
    }
}

