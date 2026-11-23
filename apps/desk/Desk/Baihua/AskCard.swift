import SwiftUI

/// 「想一想」点开过的:每本书一组键(章|块|问题前 24 字),只存本机。问题改了字就当新的一问。
@MainActor
enum AskState {
    private static let key = "desk.ask"
    private static var map: [String: [String]] = (UserDefaults.standard.dictionary(forKey: key) as? [String: [String]]) ?? [:]
    static func id(_ no: Int, _ block: Int, _ q: String) -> String { "\(no)|\(block)|\(BHText.plain(q).prefix(24))" }
    static func isOpen(_ book: String, _ id: String) -> Bool { map[book]?.contains(id) ?? false }
    static func set(_ book: String, _ id: String, _ open: Bool) {
        var s = map[book] ?? []
        if open { if !s.contains(id) { s.append(id) } } else { s.removeAll { $0 == id } }
        map[book] = s.isEmpty ? nil : s
        UserDefaults.standard.set(map, forKey: key)
    }
    /// 章号整体挪位(书包换了版式)
    static func remap(_ book: String, _ f: (Int) -> Int) {
        guard let s = map[book] else { return }
        map[book] = s.map { k in
            var p = k.split(separator: "|", maxSplits: 1, omittingEmptySubsequences: false).map(String.init)
            if let n = Int(p[0]) { p[0] = String(f(n)) }
            return p.joined(separator: "|")
        }
        UserDefaults.standard.set(map, forKey: key)
    }
    static func clear(_ book: String) { map[book] = nil; UserDefaults.standard.set(map, forKey: key) }
}

/// 文章里的「想一想」:先只见问题,自己想一会儿,点一下才揭开答案(轻轻展开;减弱动态效果时直接出现)。
/// 揭开过的记在本机,下次再来仍是揭开的;「收起」可以再考自己一回。答案可以划线(与正文段同一套)。
struct AskCard<Answer: View>: View {
    let book: String
    let stateID: String
    let question: String
    let tint: Color
    let fs: CGFloat
    let questionFont: Font
    /// 要闪的划线落在这一问的答案里:先揭开
    var reveal = false
    var onTouch: () -> Void = {}
    @ViewBuilder let answer: () -> Answer
    @State private var open: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(book: String, stateID: String, question: String, tint: Color, fs: CGFloat, questionFont: Font,
         reveal: Bool = false, onTouch: @escaping () -> Void = {}, @ViewBuilder answer: @escaping () -> Answer) {
        self.book = book; self.stateID = stateID; self.question = question; self.tint = tint; self.fs = fs
        self.questionFont = questionFont; self.reveal = reveal; self.onTouch = onTouch; self.answer = answer
        #if DEBUG
        let force = ProcessInfo.processInfo.environment["DESK_ASK"] == "open"
        #else
        let force = false
        #endif
        _open = State(initialValue: force || reveal || AskState.isOpen(book, stateID))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: "questionmark.bubble").font(.system(size: 12, weight: .bold)).accessibilityHidden(true)
                Text("想一想").font(.system(size: 12.5, weight: .bold)).kerning(2)
                Spacer()
                if open {
                    Button { toggle(false) } label: {
                        Text("收起答案").font(.system(size: 12.5, weight: .medium)).foregroundStyle(Ink.faint)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("收起来,再自己想一遍")
                }
            }
            .foregroundStyle(tint)
            Text(BHAttr.text(question, accent: tint)).font(questionFont).lineSpacing(fs * 0.42).foregroundStyle(Ink.text)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            if open {
                VStack(alignment: .leading, spacing: 10) {
                    Line().stroke(tint.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [3, 4])).frame(height: 1)
                    answer()
                }
                .padding(.top, 16)
                .transition(reduceMotion ? .identity : .opacity.combined(with: .move(edge: .top)))
            } else {
                Button { toggle(true) } label: {
                    HStack(spacing: 6) {
                        Text("想好了,看看书里怎么说").font(.system(size: 14, weight: .semibold))
                        Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(tint)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(tint.opacity(0.1), in: Capsule())
                    .overlay(Capsule().stroke(tint.opacity(0.3), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .padding(.top, 16)
                .accessibilityHint("揭开答案")
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(tint.opacity(open ? 0.22 : 0.38), style: StrokeStyle(lineWidth: 1, dash: open ? [] : [5, 4])))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .contain)
        .onChange(of: reveal) { _, r in if r && !open { open = true } }
    }

    private func toggle(_ to: Bool) {
        onTouch()
        if to { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
        AskState.set(book, stateID, to)
        if reduceMotion { open = to } else { withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) { open = to } }
    }
}

private struct Line: Shape {
    func path(in r: CGRect) -> Path { var p = Path(); p.move(to: CGPoint(x: r.minX, y: r.midY)); p.addLine(to: CGPoint(x: r.maxX, y: r.midY)); return p }
}
