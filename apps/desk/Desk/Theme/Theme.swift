import SwiftUI
import UIKit

/// 全局观感:暖白纸底、墨色字、每本书一个主色。不沿用观象的墨灰。
/// 每个颜色都是「浅色 / 深色」一对:深色不是反色,是暖黑的夜读纸。
enum Ink {
    static let paper = Color(UIColor.pair("#FBF8F1", "#171513"))
    static let card = Color(UIColor.pair("#FFFFFF", "#24211E"))
    static let text = Color(UIColor.inkText)
    static let soft = Color(UIColor.inkSoft)
    static let faint = Color(UIColor.pair("#A79F94", "#756E65"))
    static let line = Color(UIColor.pair("#E9E2D6", "#34302B"))
    static let cinnabar = Color(UIColor.pair("#C8472F", "#E0654A"))
}

extension UIColor {
    static func pair(_ light: String, _ dark: String) -> UIColor {
        UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) }
    }
    static let inkText = pair("#2A2623", "#EAE3D7")
    static let inkSoft = pair("#6F675E", "#A9A195")
    static let inkFaint = pair("#A79F94", "#756E65")

    /// 往白里调亮一些(深色模式下的主题色用,免得沉在黑底里)。
    func lifted(_ t: CGFloat) -> UIColor {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        getRed(&r, green: &g, blue: &b, alpha: &a)
        return UIColor(red: r + (1 - r) * t, green: g + (1 - g) * t, blue: b + (1 - b) * t, alpha: a)
    }
}

enum Fonts {
    /// 原文与标题用思源宋体(随 App 带的子集,scripts/desk/subset-fonts.py);界面数字用圆体,轻一点。
    static func song(_ size: CGFloat, bold: Bool = false) -> Font {
        // 跟随「动态字体」放大的写法(.custom)接不上回落链;题名、正文都可能出现扩展区的字,这里换成带回落链的那一款,
        // 字号仍按动态字体缩放
        Font(uiSong(UIFontMetrics(forTextStyle: .body).scaledValue(for: size), bold: bold) as CTFont)
    }
    static func uiSong(_ size: CGFloat, bold: Bool = false) -> UIFont {
        guard let f = UIFont(name: bold ? "NotoSerifSC-Bold" : "NotoSerifSC-Regular", size: size) else { return .systemFont(ofSize: size, weight: bold ? .bold : .regular) }
        return withExt(f)
    }
    /// 随带的生僻字回落(字咪子集,只有宋体子集里没有的那一两百个扩展区汉字,scripts/desk/subset-fonts.py ③)。
    static let extName = "GuanxiangDeskExt-Regular"
    /// 给一款字体接上生僻字回落:自己缺的字先找它,再交系统(系统没有扩展 B 区以后的字,不接就是豆腐块)。
    static func withExt(_ f: UIFont, also: [String] = []) -> UIFont {
        let list = (also + [extName]).map { UIFontDescriptor(name: $0, size: f.pointSize) }
        return UIFont(descriptor: f.fontDescriptor.addingAttributes([.cascadeList: list]), size: f.pointSize)
    }
    static func num(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(.sRGB, red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255, opacity: 1)
    }
}

extension UIColor {
    convenience init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}

/// 一本书的主题:主色 / 辅色 / 纸色。随内容包清单下发。
struct BookTheme: Codable, Hashable {
    var accent: String
    var accent2: String
    var paper: String
    var accentUI: UIColor { let c = UIColor(hex: accent); return UIColor { $0.userInterfaceStyle == .dark ? c.lifted(0.32) : c } }
    var accentColor: Color { Color(accentUI) }
    var accent2Color: Color { let c = UIColor(hex: accent2); return Color(UIColor { $0.userInterfaceStyle == .dark ? c.lifted(0.25) : c }) }
    /// 纸色:浅色用这本书自己的纸色,深色统一用暖黑
    var paperColor: Color { Color(UIColor.pair(paper, "#171513")) }
}

/// 题图:内容包里的插画还没接入时(M0),先用随 App 带的样张;没有样张的书用主题色渐变。
/// 书的题图:kind 取 .banner(横版,书桌大卡片 / 学完页)或 .cover(竖版,书目 / 「我的书」小卡)。
/// 图从 ArtStore 取(按需下载),取不到时用主题色渐变;下完 ArtStore.version 变,这里自动重画。
struct BookArt: View {
    let book: BookInfo
    var kind: ArtKind = .banner
    private var theme: BookTheme { book.theme }
    var body: some View {
        if let img = ArtStore.shared.image(book, kind) {
            Image(uiImage: img).resizable().scaledToFill()
        } else {
            DefaultArt(title: book.title, theme: theme, kind: kind)
        }
    }
}

/// 没有插画的书:主题色的底子 + 宋体书名。
/// 封面仿线装书:左上一条纸色题签,书名竖排;横版题图(上面另有书名叠字)只铺底子与一个淡淡的大字(书名首字),不重复书名。
struct DefaultArt: View {
    let title: String
    let theme: BookTheme
    var kind: ArtKind = .banner
    /// 题签上的书名:去掉括注(「战国策(选)」→ 战国策)、间隔号(「黄帝内经·素问」照竖排),最多十个字(七字起分两行)
    private var label: String {
        var t = title
        if let i = t.firstIndex(where: { "（(".contains($0) }) { t = String(t[..<i]) }
        return String(t.replacingOccurrences(of: "·", with: "・").prefix(10))
    }
    var body: some View {
        GeometryReader { g in
            let w = g.size.width, h = g.size.height
            ZStack(alignment: .topLeading) {
                LinearGradient(colors: [theme.accentColor, theme.accentColor.opacity(0.78), theme.accent2Color.opacity(0.55)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                // 纸纹:几道极淡的横线,免得一块平涂
                VStack(spacing: max(h / 9, 6)) {
                    ForEach(0..<10, id: \.self) { _ in Rectangle().fill(.white.opacity(0.035)).frame(height: 1) }
                }
                .frame(width: w, height: h, alignment: .top)
                if case .cover = kind {
                    // 每个字放进固定高的格子(宋体的行高比字号高出三成,此前按字号排,五个字就顶出题签);
                    // 七个字以上分两行竖排(右行先读),格子里的字放不下再缩
                    // 有间隔号的(「黄帝内经・素问」)就在间隔号处分行,否则对半分
                    let parts = label.split(separator: "・").map { Array($0) }
                    let chars = Array(label)
                    let columns: [[Character]] = {
                        if parts.count == 2, parts.allSatisfy({ !$0.isEmpty && $0.count <= 6 }) { return parts }
                        let n = max(chars.count, 1), cols = n > 6 ? 2 : 1
                        let per = Int((Double(n) / Double(cols)).rounded(.up))
                        return (0..<cols).map { k in Array(chars.dropFirst(k * per).prefix(per)) }
                    }()
                    let cols = columns.count
                    let rows = CGFloat(max(columns.map(\.count).max() ?? 1, 3))
                    let fs = min(w * (cols == 1 ? 0.13 : 0.105), h * 0.7 / (rows * 1.12 + 1.0))
                    let cell = fs * 1.12
                    HStack(alignment: .top, spacing: fs * 0.18) {
                        ForEach(Array(columns.enumerated().reversed()), id: \.offset) { _, col in
                            VStack(spacing: 0) {
                                ForEach(Array(col.enumerated()), id: \.offset) { _, c in
                                    Text(String(c)).font(Fonts.song(fs, bold: true)).foregroundStyle(theme.accentColor)
                                        .lineLimit(1).minimumScaleFactor(0.5)
                                        .frame(width: fs * 1.2, height: cell)
                                }
                            }
                        }
                    }
                    .padding(.vertical, fs * 0.5)
                    .padding(.horizontal, fs * 0.28)
                    .frame(height: rows * cell + fs, alignment: .top)
                    .background(theme.paperColor.opacity(0.96))
                    .overlay(Rectangle().stroke(theme.accentColor.opacity(0.35), lineWidth: max(w / 160, 0.6)).padding(max(w / 70, 2)))
                    .shadow(color: .black.opacity(0.12), radius: 3, y: 1)
                    .offset(x: w * 0.12, y: h * 0.1)
                } else {
                    Text(String(label.prefix(1)))
                        .font(Fonts.song(min(h * 0.9, w * 0.5), bold: true))
                        .foregroundStyle(.white.opacity(0.12))
                        .frame(width: w * 0.92, height: h, alignment: .trailing)
                }
            }
            .frame(width: w, height: h)
            .clipped()
        }
        .accessibilityHidden(true)
    }
}

/// 阅读字号:四档,阅读页与白话深读共用。只存本机(不进同步的 settings——那个键与网站共用、整值新者胜)。
/// 「标准」就是按屏宽自适应算出来的那个字号,其余三档在它上面乘一个系数。
enum TextSize: Int, CaseIterable, Identifiable {
    case small, standard, large, xlarge
    static let key = "desk.textSize"
    var id: Int { rawValue }
    var scale: CGFloat { [0.88, 1, 1.14, 1.3][rawValue] }
    var label: String { ["小", "标准", "大", "特大"][rawValue] }
    static func of(_ raw: Int) -> TextSize { TextSize(rawValue: raw) ?? .standard }
}

/// 工具栏上的「字号」按钮:点开四档单选。
struct TextSizeMenu<Label: View>: View {
    @AppStorage(TextSize.key) private var raw = TextSize.standard.rawValue
    var onChange: () -> Void = {}
    @ViewBuilder let label: () -> Label
    var body: some View {
        Menu {
            Picker("字号", selection: Binding(get: { raw }, set: { raw = $0; onChange() })) {
                ForEach(TextSize.allCases) { t in Text(t.label).tag(t.rawValue) }
            }
            .pickerStyle(.inline)
        } label: { label() }
        .accessibilityLabel("字号:\(TextSize.of(raw).label)")
    }
}
