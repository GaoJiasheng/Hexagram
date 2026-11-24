import XCTest

/// 旁白自动审计:用调试钩子(DESK_DEMO / DESK_OPEN)直接打开几张主屏,跑 iOS 17 的 performAccessibilityAudit。
/// 动态字号、对比度、文字截断(书名一行截断是版面取舍)不在这次范围,审计时排除;其余问题(缺标签、点按区过小、元素不可达…)一律报出来。
/// 需要本机内容服务:cd <仓库>/public && python3 -m http.server 8765。只连本机,不碰线上账号。
final class AccessibilityAuditTests: XCTestCase {
    override func setUp() { continueAfterFailure = true }

    private func launch(_ env: [String: String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment = env
        app.launch()
        return app
    }

    private func audit(_ app: XCUIApplication, wait id: String? = nil, file: StaticString = #filePath, line: UInt = #line) throws {
        if let id { _ = app.descendants(matching: .any)[id].firstMatch.waitForExistence(timeout: 20) } else { sleep(6) }
        try app.performAccessibilityAudit(for: .all.subtracting([.dynamicType, .contrast, .textClipped])) { issue in
            let el = issue.element.map { "\($0.elementType.rawValue) 「\($0.label)」 \($0.frame)" } ?? "-"
            print("[ax-audit] \(issue.auditType) · \(issue.compactDescription) · \(el)")
            return false    // 不吞,全部算失败,便于看清
        }
    }

    func testDeskHome() throws { try audit(launch(["DESK_DEMO": "seed"]), wait: "添书") }
    func testReader() throws { try audit(launch(["DESK_DEMO": "reader", "DESK_BOOK": "daodejing", "DESK_CH": "8"]), wait: "目录") }
    func testBaihua() throws { try audit(launch(["DESK_OPEN": "baihua", "DESK_BOOK": "daodejing", "DESK_CH": "8"]), wait: "回到原文") }
    func testBookHome() throws { try audit(launch(["DESK_DEMO": "home", "DESK_BOOK": "daodejing"]), wait: nil) }
    func testMindMap() throws { try audit(launch(["DESK_OPEN": "mindmap", "DESK_BOOK": "g-bafeite-zhi-gudong-de-xin"]), wait: "走读") }
}
