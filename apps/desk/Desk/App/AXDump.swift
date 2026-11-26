#if DEBUG
import UIKit

/// 调试(DESK_AXDUMP=1):隔几秒把屏上的无障碍元素按读屏的次序打进日志——标签、特征、位置,
/// 没有标签的按钮标「!!」。代替 Accessibility Inspector 做 VoiceOver 走查。
enum AXDump {
    static func schedule() {
        guard let s = ProcessInfo.processInfo.environment["DESK_AXDUMP"], let delay = Double(s.isEmpty || s == "1" ? "5" : s) else { return }
        for k in 0..<3 { DispatchQueue.main.asyncAfter(deadline: .now() + delay * Double(k + 1)) { dump(pass: k) } }
    }

    @MainActor static func dump(pass: Int) {
        guard let w = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap(\.windows).first(where: \.isKeyWindow) else { return }
        var out: [String] = []
        var unlabeled = 0
        func visit(_ o: NSObject, depth: Int) {
            if depth > 60 { return }
            if let v = o as? UIView, v.isHidden || v.alpha < 0.01 { return }
            if o.isAccessibilityElement {
                let label = o.accessibilityLabel ?? ""
                let t = o.accessibilityTraits
                var tags: [String] = []
                if t.contains(.button) { tags.append("button") }
                if t.contains(.header) { tags.append("header") }
                if t.contains(.selected) { tags.append("selected") }
                if t.contains(.staticText) { tags.append("text") }
                if t.contains(.image) { tags.append("image") }
                let f = o.accessibilityFrame
                let bad = label.trimmingCharacters(in: .whitespaces).isEmpty && (t.contains(.button) || t.contains(.image))
                if bad { unlabeled += 1 }
                out.append("\(bad ? "!!" : "  ") [\(tags.joined(separator: ","))] \(label.prefix(60))" + ((o.accessibilityValue ?? "").isEmpty ? "" : " = \(o.accessibilityValue!.prefix(20))")
                           + (o.accessibilityHint.map { " (\($0.prefix(30)))" } ?? "")
                           + ((o.accessibilityCustomActions ?? []).isEmpty ? "" : " {\((o.accessibilityCustomActions ?? []).map(\.name).joined(separator: "|"))}") + " @\(Int(f.minX)),\(Int(f.minY))" + (label.isEmpty ? " <\(type(of: o))>" : ""))
                return
            }
            let kids: [NSObject]
            if let els = o.accessibilityElements as? [NSObject], !els.isEmpty { kids = els }
            else if o.accessibilityElementCount() > 0 && o.accessibilityElementCount() != NSNotFound {
                kids = (0..<o.accessibilityElementCount()).compactMap { o.accessibilityElement(at: $0) as? NSObject }
            } else if let v = o as? UIView { kids = v.subviews }
            else { kids = [] }
            for k in kids { visit(k, depth: depth + 1) }
        }
        visit(w, depth: 0)
        NSLog("DESKAX pass=%d elements=%d unlabeled=%d\n%@", pass, out.count, unlabeled, out.joined(separator: "\n"))
    }
}
#endif
