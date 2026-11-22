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
    var segs: Int
    var chars: Int
    var parts: [BookPart]
    var theme: BookTheme
    var version: String
    var file: String
    var bytes: Int
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
}

struct Seg: Codable, Hashable {
    var o: String      // 原文
    var t: String?     // 译文
    var n: [Note]?
}

struct Chapter: Codable, Identifiable, Hashable {
    var no: Int
    var title: String
    var src: Src
    var segs: [Seg]
    var yanyi: [String]?
    var id: Int { no }
}

struct BookPack: Codable {
    var id: String
    var version: String
    var chapters: [Chapter]
}
