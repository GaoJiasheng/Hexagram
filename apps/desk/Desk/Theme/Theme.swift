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
        .custom(bold ? "NotoSerifSC-Bold" : "NotoSerifSC-Regular", size: size)
    }
    static func uiSong(_ size: CGFloat, bold: Bool = false) -> UIFont {
        UIFont(name: bold ? "NotoSerifSC-Bold" : "NotoSerifSC-Regular", size: size) ?? .systemFont(ofSize: size, weight: bold ? .bold : .regular)
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
struct BookArt: View {
    let bookID: String
    let theme: BookTheme
    var body: some View {
        if let img = UIImage(named: "art-\(bookID)") {
            Image(uiImage: img).resizable().scaledToFill()
        } else {
            LinearGradient(colors: [theme.accentColor.opacity(0.85), theme.accent2Color.opacity(0.7), theme.paperColor],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}
