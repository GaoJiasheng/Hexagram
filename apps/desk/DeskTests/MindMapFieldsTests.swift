import XCTest
@testable import Desk

/// 全书脑图(标准 §10)两个可无字段:节点 id(稳定身份)、full(截短前的整句)。老书包 / 老状态照旧能用。
@MainActor
final class MindMapFieldsTests: XCTestCase {
    private func parse(_ json: String, chapters: Int = 3) -> MindMapFile? {
        MindMapParser.parse(Data(json.utf8), chapters: chapters)
    }

    func testIdAndFullParsed() throws {
        let f = try XCTUnwrap(parse("""
        { "root": { "id": "m0", "label": "中心", "children": [
          { "id": "A_1-b", "label": "长句的开头", "full": "长句的开头,和后半句。", "note": "长句的开头,和后半句。\\n\\n展开" },
          { "label": "没 id", "full": "不以标签起头的整句" },
          { "id": "bad.id", "label": "坏 id" },
          { "id": "A_1-b", "label": "重复 id" } ] } }
        """))
        let t = MindTree(f)
        XCTAssertEqual(t[0].key, "m0")
        XCTAssertEqual(t[1].key, "A_1-b")
        XCTAssertEqual(t[1].full, "长句的开头,和后半句。")
        XCTAssertNil(t[2].full, "full 不以 label 起头:当没写,回到推断")
        XCTAssertNil(t[3].key, "字符集不合的 id 当没写")
        XCTAssertNil(t[4].key, "重复的 id 后来的当没写")
        // 卡片:有 full 用 full 当标题,说明里去掉重复的那一句
        let c = MindNodeCard.texts(t[1])
        XCTAssertEqual(c.head, "长句的开头,和后半句。")
        XCTAssertEqual(c.body, "展开")
    }

    func testStateKeyPrefersIdFallsBackToPath() throws {
        let f = try XCTUnwrap(parse("""
        { "root": { "label": "中心", "children": [ { "id": "x1", "label": "一", "children": [ { "label": "一之一" } ] }, { "label": "二" } ] } }
        """))
        let t = MindTree(f)
        XCTAssertEqual(t.stateKey(1), "#x1")
        XCTAssertEqual(t.stateKey(2), "0.0")
        XCTAssertEqual(t.stateKey(0), "")
        for i in 0..<t.count { XCTAssertEqual(t.node(stateKey: t.stateKey(i)), i) }
        // 旧版存下的路径照样认得;「#id」在没有这个 id 的书包里认不出(丢掉,不误认)
        XCTAssertEqual(t.node(stateKey: "0"), 1)
        XCTAssertNil(t.node(stateKey: "#nope"))
    }

    func testIdSurvivesReorder() throws {
        // 书包更新、兄弟换了次序:按 id 记的状态仍指向同一个节点
        let a = MindTree(try XCTUnwrap(parse(#"{ "root": { "label": "中心", "children": [ { "id": "p", "label": "甲" }, { "id": "q", "label": "乙" } ] } }"#)))
        let b = MindTree(try XCTUnwrap(parse(#"{ "root": { "label": "中心", "children": [ { "id": "q", "label": "乙" }, { "id": "p", "label": "甲" } ] } }"#)))
        let key = a.stateKey(1)
        XCTAssertEqual(b[try XCTUnwrap(b.node(stateKey: key))].label, "甲")
    }

    func testLegacyPackAndStoreDecode() throws {
        // 没有 id / full 的老书包:推断照旧
        let t = MindTree(try XCTUnwrap(parse(#"{ "root": { "label": "中心", "children": [ { "label": "长句的开头…", "note": "长句的开头还有后半。\n\n展开" } ] } }"#)))
        XCTAssertNil(t[1].key); XCTAssertNil(t[1].full)
        XCTAssertEqual(t.stateKey(1), "0")
        XCTAssertEqual(MindNodeCard.texts(t[1]).head, "长句的开头还有后半。")
        // 旧版 App 存下的 mindmap.desk.json(节点没有 id / full 两项)解得开
        let old = #"{"root":{"label":"中心","children":[{"label":"一","ch":1,"children":[]}]},"nodes":2}"#
        let f = try JSONDecoder().decode(MindMapFile.self, from: Data(old.utf8))
        XCTAssertNil(f.root.id); XCTAssertNil(f.root.children[0].full)
        // 新版存的(带 id / full)用旧结构的解码器也解得开:多出的键 JSONDecoder 不管
        struct OldNode: Decodable { var label: String; var note: String?; var ch: Int?; var children: [OldNode] }
        struct OldFile: Decodable { var root: OldNode; var nodes: Int }
        let new = try JSONEncoder().encode(MindMapFile(root: MindNodeFile(id: "m1", label: "中心", full: nil, note: nil, ch: nil, children: [
            MindNodeFile(id: "m2", label: "开头", full: "开头和后半", note: nil, ch: nil, children: [])]), nodes: 2))
        XCTAssertEqual(try JSONDecoder().decode(OldFile.self, from: new).root.children[0].label, "开头")
    }
}
