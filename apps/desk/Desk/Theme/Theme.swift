import SwiftUI
import UIKit

/// 全局观感:暖白纸底、墨色字、每本书一个主色。不沿用观象的墨灰。
enum Ink {
    static let paper = Color(hex: "#FBF8F1")
    static let card = Color.white
    static let text = Color(hex: "#2A2623")
    static let soft = Color(hex: "#6F675E")
    static let faint = Color(hex: "#A79F94")
    static let line = Color(hex: "#E9E2D6")
    static let cinnabar = Color(hex: "#C8472F")
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
    convenience init(hex: String) { self.init(Color(hex: hex)) }
}

/// 一本书的主题:主色 / 辅色 / 纸色。随内容包清单下发。
struct BookTheme: Codable, Hashable {
    var accent: String
    var accent2: String
    var paper: String
    var accentColor: Color { Color(hex: accent) }
    var accent2Color: Color { Color(hex: accent2) }
    var paperColor: Color { Color(hex: paper) }
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
