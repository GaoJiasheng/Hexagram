import Foundation

/// 内容包清单(public/desk/v1/manifest.json,由 scripts/build-desk-packs.mjs 生成)。
struct Manifest: Codable {
    var v: Int
    var books: [BookInfo]
}

struct BookPart: Codable, Hashable {
    var title: String
    var from: Int
    var to: Int
    var note: String?
}

struct BookInfo: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var alias: String
    var era: String
    var attribution: String
    var brief: String
    var howto: String
    var template: String      // duanzhang 短章 · yulu 语录 · gua 卦 · pianzhang 篇章
    var unit: String
    var chapters: Int
    var summary: String?      // 有就用它代替「N 章」(周易:六十四卦 · 十翼)
    var segs: Int
    var chars: Int
    var parts: [BookPart]
    var theme: BookTheme
    var version: String
    var file: String
    var bytes: Int
    var art: ArtInfo?         // 插画(可选;老清单没有,一张图都没有的书也没有)
}

/// 一本书有哪些插画(public/desk/v1/art/<id>/):cover 竖版封面 · banner 横版题图 · heads 有题头图的章号。
/// v 是这批图的指纹,变了就清本机缓存重下。
struct ArtInfo: Codable, Hashable {
    var cover: Bool
    var banner: Bool
    var heads: [Int]
    var v: String
}

/// 一章在观象站内的坐标;进度、时长、划线都按它记,与网站同一套。
struct Src: Codable, Hashable {
    var corpus: String
    var slug: String
    var ch: Int
}

struct Note: Codable, Hashable {
    var k: String      // 被注的字词(该段原文的子串)
    var d: String      // 释义
    var r: String?     // 读音
    var x: String?     // 展开的一段(详注才有)
}

struct Seg: Codable, Hashable {
    var o: String      // 原文
    var t: String?     // 译文
    var n: [Note]?
    var label: String?   // 段名(易经):卦辞 · 彖 · 象 · 初九… · 用九 · 文言
    var line: Int?       // 易经爻辞与其小象:1…6(初爻为 1),用九 / 用六为 7
}

/// 一卦的卦画信息(易经 kind == "gua" 的章才有)。binary 自下而上,下标 0 是初爻。
struct Gua: Codable, Hashable {
    var name: String
    var fullName: String
    var pinyin: String
    var binary: String
    var upper: String    // 上卦名,如「乾」
    var lower: String    // 下卦名
}

struct Chapter: Codable, Identifiable, Hashable {
    var no: Int
    var title: String
    var src: Src
    var kind: String?    // 易经:"gua" 卦 · "text" 十翼传文;其他书无此字段
    var gua: Gua?
    var segs: [Seg]
    var yanyi: [String]?
    var id: Int { no }
}

struct BookPack: Codable {
    var id: String
    var version: String
    var chapters: [Chapter]
}

extension BookInfo {
    /// 书的规模一句话:「81 章」/「六十四卦 · 十翼」
    var sizeLabel: String { summary ?? "\(chapters) \(unit)" }
}
