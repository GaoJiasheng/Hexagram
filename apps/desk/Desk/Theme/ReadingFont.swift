import SwiftUI
import UIKit
import CoreText
import Observation

/// 正文字体:阅读页与白话深读共用,只存本机。宋体随 App 带;黑体用系统苹方;楷体 / 仿宋 / 手写按需下载(FontStore)。
/// 选中的字体没下到本机、或注册失败,一律回落宋体。
enum ReadingFont: String, CaseIterable, Identifiable {
    case song, hei, kai, fangsong, shou
    static let key = "desk.readingFont"
    var id: String { rawValue }

    var label: String {
        switch self {
        case .song: "宋体"
        case .hei: "黑体"
        case .kai: "楷体"
        case .fangsong: "仿宋"
        case .shou: "手写"
        }
    }

    /// 字体本名(设置里小字显示)。
    var face: String {
        switch self {
        case .song: "思源宋体"
        case .hei: "苹方"
        case .kai: "霞鹜文楷"
        case .fangsong: "朱雀仿宋"
        case .shou: "小赖字体"
        }
    }

    /// 要下载的三款(id 与内容服务上 fonts/index.json 的 id 一致)。
    var downloadable: Bool { self == .kai || self == .fangsong || self == .shou }

    /// 设置里存的那一款;没下到本机的当宋体。
    @MainActor static var current: ReadingFont { resolve(UserDefaults.standard.string(forKey: key)) }

    @MainActor static func resolve(_ raw: String?) -> ReadingFont {
        guard let f = raw.flatMap(ReadingFont.init(rawValue:)) else { return .song }
        if f.downloadable && !FontStore.shared.isReady(f) { return .song }
        return f
    }

    /// 正文字号 size 的这款字体。下载的三款带回落链:字体子集里缺的字先找随带的宋体,再交系统。
    @MainActor func ui(_ size: CGFloat) -> UIFont {
        switch self {
        case .song: return Fonts.uiSong(size)
        case .hei: return Fonts.withExt(UIFont(name: "PingFangSC-Regular", size: size) ?? .systemFont(ofSize: size))
        default:
            guard let ps = FontStore.shared.postScriptName(self), UIFont(name: ps, size: size) != nil else { return Fonts.uiSong(size) }
            return Fonts.withExt(UIFont(descriptor: UIFontDescriptor(name: ps, size: size), size: size), also: ["NotoSerifSC-Regular"])
        }
    }

    /// 题名、爻题等加粗处:黑体用苹方中粗;其余几款没有粗体,题名仍用宋体粗(与正文成一对,不做假粗)。
    @MainActor func uiBold(_ size: CGFloat) -> UIFont {
        if self == .hei { return Fonts.withExt(UIFont(name: "PingFangSC-Semibold", size: size) ?? .systemFont(ofSize: size, weight: .semibold)) }
        return Fonts.uiSong(size, bold: true)
    }

    @MainActor func font(_ size: CGFloat) -> Font { Font(ui(size) as CTFont) }
    @MainActor func boldFont(_ size: CGFloat) -> Font { Font(uiBold(size) as CTFont) }
}

/// 按需下载的字体:清单(fonts/index.json)、下载进度、本机缓存、CoreText 注册。
/// 文件放 Application Support/fonts/;启动时把已在本机的注册上(只在本进程内,不装进系统)。
@MainActor
@Observable
final class FontStore {
    static let shared = FontStore()

    struct Entry: Codable, Hashable {
        var id: String
        var name: String
        var face: String
        var ps: String
        var file: String
        var bytes: Int
        var licence: String
        var copyright: String?
        var upstream: String
        var version: String
    }
    private struct Index: Codable { var v: Int; var fonts: [Entry] }

    enum State: Equatable { case idle, downloading(Double), failed(String), ready }

    private(set) var entries: [Entry] = []
    private(set) var states: [String: State] = [:]
    /// 清单取不到(离线且本机也没存过)时的提示。
    private(set) var indexError: String?

    @ObservationIgnored private var registered: Set<String> = []

    private let dir: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("fonts", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    private var indexFile: URL { dir.appendingPathComponent("index.json") }
    static var base: URL { Library.base.appendingPathComponent("fonts/") }

    init() {
        if let d = try? Data(contentsOf: indexFile), let i = try? JSONDecoder().decode(Index.self, from: d) { entries = i.fonts }
        registerCached()
    }

    func entry(_ f: ReadingFont) -> Entry? { entries.first { $0.id == f.rawValue } }
    func postScriptName(_ f: ReadingFont) -> String? { entry(f)?.ps }
    func state(_ f: ReadingFont) -> State {
        if !f.downloadable { return .ready }
        return states[f.rawValue] ?? .idle
    }
    func isReady(_ f: ReadingFont) -> Bool { state(f) == .ready }

    /// 启动时:本机已有的字体文件注册上。
    private func registerCached() {
        for e in entries {
            let url = dir.appendingPathComponent(e.file)
            guard FileManager.default.fileExists(atPath: url.path) else { continue }
            if register(url, ps: e.ps) { states[e.id] = .ready }
        }
    }

    private func register(_ url: URL, ps: String) -> Bool {
        if registered.contains(url.lastPathComponent) || UIFont(name: ps, size: 12) != nil { registered.insert(url.lastPathComponent); return true }
        var err: Unmanaged<CFError>?
        let ok = CTFontManagerRegisterFontsForURL(url as CFURL, .process, &err)
        if ok { registered.insert(url.lastPathComponent) }
        return ok && UIFont(name: ps, size: 12) != nil
    }

    /// 拉最新清单(设置面板打开时)。取不到就用本机存的。
    func refreshIndex() async {
        do {
            let (data, resp) = try await Library.session.data(from: Self.base.appendingPathComponent("index.json"))
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let i = try JSONDecoder().decode(Index.self, from: data)
            entries = i.fonts
            try? data.write(to: indexFile, options: .atomic)
            indexError = nil
            registerCached()
        } catch {
            if entries.isEmpty { indexError = "字体清单取不到,联网后再试。" }
        }
    }

    /// 下载一款(带进度);成功后注册,返回能不能用。文件大小与清单不符当失败。
    @discardableResult
    func download(_ f: ReadingFont) async -> Bool {
        if entries.isEmpty { await refreshIndex() }
        guard let e = entry(f) else { states[f.rawValue] = .failed("字体清单取不到"); return false }
        if case .downloading = state(f) { return false }
        states[f.rawValue] = .downloading(0)
        let progress = DownloadProgress { [weak self] p in
            Task { @MainActor in if case .downloading = self?.states[f.rawValue] { self?.states[f.rawValue] = .downloading(p) } }
        }
        do {
            let (tmp, resp) = try await Library.session.download(from: Self.base.appendingPathComponent(e.file), delegate: progress)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let size = (try? FileManager.default.attributesOfItem(atPath: tmp.path)[.size] as? Int) ?? 0
            guard size == e.bytes else { throw URLError(.cannotDecodeContentData) }
            let dst = dir.appendingPathComponent(e.file)
            // 同一款的旧版本文件删掉
            for old in (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [] where old.hasPrefix(e.id + ".") && old.hasSuffix(".ttf") && old != e.file {
                try? FileManager.default.removeItem(at: dir.appendingPathComponent(old))
            }
            try? FileManager.default.removeItem(at: dst)
            try FileManager.default.moveItem(at: tmp, to: dst)
            guard register(dst, ps: e.ps) else { throw URLError(.cannotDecodeContentData) }
            states[f.rawValue] = .ready
            return true
        } catch {
            let offline = (error as? URLError).map { [.notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotConnectToHost, .cannotFindHost].contains($0.code) } ?? false
            states[f.rawValue] = .failed(offline ? "没连上网络" : "没下下来")
            return false
        }
    }

    /// 本机已占的空间(设置里显示「已下载」时用)。
    func sizeLabel(_ f: ReadingFont) -> String? {
        guard let e = entry(f) else { return nil }
        return String(format: "%.1f MB", Double(e.bytes) / 1_048_576)
    }
}

/// 下载进度回调(URLSession 的任务代理)。
private final class DownloadProgress: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    let onProgress: (Double) -> Void
    private var obs: NSKeyValueObservation?
    init(_ f: @escaping (Double) -> Void) { onProgress = f }
    func urlSession(_ session: URLSession, didCreateTask task: URLSessionTask) {
        obs = task.progress.observe(\.fractionCompleted) { [weak self] p, _ in self?.onProgress(p.fractionCompleted) }
    }
}

/// 翻页方式:滑动(默认)/ 仿真(卷页)。只存本机;开了「减弱动态效果」一律按滑动。
enum PageTurn: String, CaseIterable, Identifiable {
    case slide, curl
    static let key = "desk.pageTurn"
    var id: String { rawValue }
    var label: String { self == .slide ? "滑动" : "仿真" }
}

/// 「阅读设置」:字号、字体、翻页方式。阅读页与白话深读右上角的按钮点开(白话深读不显示翻页方式)。
struct ReadingSettingsButton<Label: View>: View {
    var paging = true
    var onChange: () -> Void = {}
    @ViewBuilder let label: () -> Label
    @State private var open = false
    var body: some View {
        Button { open = true } label: { label() }
            .accessibilityLabel("阅读设置")
            .popover(isPresented: $open, arrowEdge: .top) {
                ReadingSettingsPanel(paging: paging, onChange: onChange)
                    .presentationCompactAdaptation(.popover)
            }
    }
}

struct ReadingSettingsPanel: View {
    var paging = true
    var onChange: () -> Void = {}
    @AppStorage(TextSize.key) private var size = TextSize.standard.rawValue
    @AppStorage(ReadingFont.key) private var font = ReadingFont.song.rawValue
    @AppStorage(PageTurn.key) private var turn = PageTurn.slide.rawValue
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private var store: FontStore { .shared }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            group("字号") {
                Picker("字号", selection: Binding(get: { size }, set: { size = $0; onChange() })) {
                    ForEach(TextSize.allCases) { t in Text(t.label).tag(t.rawValue) }
                }
                .pickerStyle(.segmented)
            }
            group("字体") {
                VStack(spacing: 0) {
                    ForEach(ReadingFont.allCases) { f in
                        fontRow(f)
                        if f != ReadingFont.allCases.last { Divider().overlay(Ink.line).padding(.leading, 40) }
                    }
                }
                .background(Ink.card, in: RoundedRectangle(cornerRadius: 12))
                if let e = store.indexError { Text(e).font(.system(size: 12)).foregroundStyle(Ink.cinnabar) }
            }
            if paging {
                group("翻页方式") {
                    Picker("翻页方式", selection: Binding(get: { turn }, set: { turn = $0; onChange() })) {
                        ForEach(PageTurn.allCases) { t in Text(t.label).tag(t.rawValue) }
                    }
                    .pickerStyle(.segmented)
                    if reduceMotion && turn == PageTurn.curl.rawValue {
                        Text("已开「减弱动态效果」,按滑动翻页。").font(.system(size: 12)).foregroundStyle(Ink.faint)
                    }
                }
            }
        }
        .padding(18)
        .frame(width: 320)
        .background(Ink.paper)
        .task { await store.refreshIndex() }
    }

    private func group<C: View>(_ title: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 12, weight: .semibold)).kerning(2).foregroundStyle(Ink.soft)
            c()
        }
    }

    @ViewBuilder private func fontRow(_ f: ReadingFont) -> some View {
        let st = store.state(f)
        let selected = ReadingFont.resolve(font) == f
        Button {
            switch st {
            case .ready: font = f.rawValue; onChange()
            case .downloading: break
            case .idle, .failed:
                Task { if await store.download(f) { font = f.rawValue; onChange() } }
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(Ink.cinnabar)
                    .opacity(selected ? 1 : 0).frame(width: 16)
                VStack(alignment: .leading, spacing: 2) {
                    // 字体名用它自己的字形写(没下的先用宋体占位)
                    Text(f.label).font(st == .ready ? f.font(18) : Fonts.song(18)).foregroundStyle(Ink.text)
                    Text(f.face).font(.system(size: 11)).foregroundStyle(Ink.faint)
                }
                Spacer(minLength: 8)
                trailing(f, st)
            }
            .padding(.horizontal, 12).padding(.vertical, 9)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(f.label + (selected ? ",已选" : ""))
    }

    @ViewBuilder private func trailing(_ f: ReadingFont, _ st: FontStore.State) -> some View {
        switch st {
        case .ready:
            if f.downloadable { Text("已下载").font(.system(size: 12)).foregroundStyle(Ink.faint) }
            else { Text(f == .song ? "内置" : "系统").font(.system(size: 12)).foregroundStyle(Ink.faint) }
        case .idle:
            HStack(spacing: 5) {
                Text(store.sizeLabel(f) ?? "").font(Fonts.num(12, weight: .medium)).foregroundStyle(Ink.soft)
                Image(systemName: "arrow.down.circle").font(.system(size: 17)).foregroundStyle(Ink.soft)
            }
            .accessibilityLabel("下载 \(store.sizeLabel(f) ?? "")")
        case .downloading(let p):
            HStack(spacing: 6) {
                Text("\(Int(p * 100))%").font(Fonts.num(12, weight: .medium)).foregroundStyle(Ink.soft).monospacedDigit()
                ProgressView(value: p).progressViewStyle(.circular).controlSize(.small).tint(Ink.cinnabar)
            }
        case .failed(let m):
            HStack(spacing: 4) {
                Text(m).font(.system(size: 12)).foregroundStyle(Ink.cinnabar)
                Text("· 重试").font(.system(size: 12, weight: .semibold)).foregroundStyle(Ink.cinnabar)
            }
        }
    }
}
