import UIKit

/// 旁白读画布:节点是画在图层上的,这里按画布上的次序给每个节点一个元素(读整句、读展开状态、读学过 / 正在读),
/// 轻点两下 = 选中(出下方卡片),自定义动作 = 展开 / 收起、放大到这里。焦点落到屏外的节点时把镜头挪过去。
final class MindNodeAXElement: UIAccessibilityElement {
    let id: Int
    weak var canvas: MindCanvasView?
    init(id: Int, canvas: MindCanvasView) {
        self.id = id
        self.canvas = canvas
        super.init(accessibilityContainer: canvas)
    }

    override var accessibilityFrameInContainerSpace: CGRect {
        get {
            guard let c = canvas, let r = c.layout.frames[id] else { return .zero }
            return c.content.convert(r, to: c)
        }
        set {}
    }

    override func accessibilityActivate() -> Bool {
        canvas?.onInteract()
        canvas?.onTapNode(id)
        return true
    }

    override func accessibilityElementDidBecomeFocused() {
        guard let c = canvas, !c.isComfortablyVisible(id, checkZoom: false) else { return }
        c.center(on: id, animated: false)
    }
}

extension MindCanvasView {
    /// 画布上眼下排出来的节点(展开着的那些),每个一个元素。
    func nodeAccessibilityElements() -> [Any] {
        guard let tree else { return [] }
        let open = openSet()
        return layout.order.compactMap { id -> MindNodeAXElement? in
            guard layout.frames[id] != nil else { return nil }
            let n = tree[id]
            let look = lookOf(id)
            let e = axCache[id] ?? MindNodeAXElement(id: id, canvas: self)
            axCache[id] = e
            e.accessibilityLabel = (n.full ?? n.label).replacingOccurrences(of: "**", with: "")
            var v: [String] = []
            if id == 0 { v.append("全书的中心") }
            if !n.children.isEmpty && id != 0 { v.append(open.contains(id) ? "已展开" : "已收起,\(n.children.count) 项") }
            if look.learned { v.append("学过") }
            if look.reading { v.append("正在读") }
            if look.match { v.append("命中") }
            e.accessibilityValue = v.joined(separator: ",")
            e.accessibilityTraits = look.selected ? [.button, .selected] : .button
            var acts: [UIAccessibilityCustomAction] = []
            if !n.children.isEmpty && id != 0 {
                acts.append(UIAccessibilityCustomAction(name: open.contains(id) ? "收起" : "展开") { [weak self] _ in
                    self?.onInteract(); self?.onTapBubble(id); return true
                })
            }
            acts.append(UIAccessibilityCustomAction(name: "放大到这里") { [weak self] _ in self?.zoomTo(node: id, animated: false); return true })
            e.accessibilityCustomActions = acts
            return e
        }
    }

    /// 排版、展开状态变了:让旁白重新取元素。
    func accessibilityTreeChanged() {
        guard UIAccessibility.isVoiceOverRunning else { return }
        UIAccessibility.post(notification: .layoutChanged, argument: nil)
    }
}
