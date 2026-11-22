import SwiftUI

/// 学完一本书的账单。M0 是样张:数字是示例,M4 接真实统计。
struct FinishStats {
    var days: Int
    var minutes: Int
    var chars: Int
    var marks: Int
    static let sample = FinishStats(days: 23, minutes: 412, chars: 6446, marks: 37)
}

/// 学完:整屏庆祝。题图铺开 → 书名落定 → 盖印 → 账单逐项数上来。
struct FinishScreen: View {
    let book: BookInfo
    let stats: FinishStats
    @Environment(\.dismiss) private var dismiss
    @State private var stage = 0
    @Environment(\.horizontalSizeClass) private var hSize
    private var pad: Bool { hSize == .regular }
    private var k: CGFloat { pad ? 1.45 : 1 }

    var body: some View {
        ZStack {
            book.theme.paperColor.ignoresSafeArea()
            GeometryReader { geo in
                BookArt(book: book, kind: .banner)
                    .frame(width: geo.size.width, height: geo.size.height * (pad ? 0.56 : 0.48))
                    .clipped()
                    .mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .top, endPoint: .bottom))
                    .scaleEffect(stage >= 1 ? 1 : 1.12, anchor: .top)
                    .opacity(stage >= 1 ? 1 : 0)
            }
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer().frame(minHeight: pad ? 260 : 150)
                ZStack(alignment: .topTrailing) {
                    VStack(spacing: 10 * k) {
                        Text("学完了").font(.system(size: 14 * k, weight: .semibold)).kerning(6).foregroundStyle(book.theme.accentColor)
                        Text(book.title).font(Fonts.song(pad ? 68 : 46, bold: true)).foregroundStyle(Ink.text)
                        Text("\(book.sizeLabel) · \(book.chars) 字").font(.system(size: 14 * k)).foregroundStyle(Ink.soft)
                    }
                    .padding(.horizontal, pad ? 110 : 54)
                    .opacity(stage >= 2 ? 1 : 0)
                    .offset(y: stage >= 2 ? 0 : 14)

                    Seal(text: "学完")
                        .frame(width: pad ? 96 : 66, height: pad ? 96 : 66)
                        .rotationEffect(.degrees(-9))
                        .scaleEffect(stage >= 3 ? 1 : 2.4)
                        .opacity(stage >= 3 ? 1 : 0)
                        .offset(x: pad ? 6 : 12, y: pad ? -26 : -18)
                }

                HStack(spacing: 0) {
                    bill("\(stats.days)", "天")
                    bill(String(format: "%.1f", Double(stats.minutes) / 60), "小时")
                    bill("\(stats.chars)", "字")
                    bill("\(stats.marks)", "处划线")
                }
                .padding(.vertical, 22 * k)
                .background(Ink.card, in: RoundedRectangle(cornerRadius: 22 * k))
                .shadow(color: .black.opacity(0.06), radius: 18, y: 8)
                .padding(.horizontal, 24)
                .padding(.top, 36 * k)
                .opacity(stage >= 4 ? 1 : 0)
                .offset(y: stage >= 4 ? 0 : 20)

                Text("示例数字").font(.system(size: 11 * k)).foregroundStyle(Ink.faint).padding(.top, 8).opacity(stage >= 4 ? 1 : 0)

                Spacer()
                Button { dismiss() } label: {
                    Text("回到书桌").font(Fonts.song(18 * k, bold: true)).frame(maxWidth: pad ? 420 : 360).padding(.vertical, 16 * k)
                        .background(book.theme.accentColor, in: RoundedRectangle(cornerRadius: 16 * k)).foregroundStyle(.white)
                }
                .padding(.horizontal, 24).padding(.bottom, 28)
                .opacity(stage >= 4 ? 1 : 0)
            }
            .frame(maxWidth: pad ? 640 : 560)
        }
        .task {
            withAnimation(.easeOut(duration: 0.9)) { stage = 1 }
            try? await Task.sleep(for: .milliseconds(500))
            withAnimation(.spring(duration: 0.6)) { stage = 2 }
            try? await Task.sleep(for: .milliseconds(550))
            withAnimation(.spring(duration: 0.35, bounce: 0.45)) { stage = 3 }
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            try? await Task.sleep(for: .milliseconds(450))
            withAnimation(.spring(duration: 0.6)) { stage = 4 }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private func bill(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4 * k) {
            Text(value).font(Fonts.num(pad ? 34 : 24)).foregroundStyle(Ink.text).contentTransition(.numericText())
            Text(label).font(.system(size: 12 * k)).foregroundStyle(Ink.soft)
        }
        .frame(maxWidth: .infinity)
    }
}

/// 一方朱印。
struct Seal: View {
    let text: String
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9).fill(Ink.cinnabar)
            RoundedRectangle(cornerRadius: 6).stroke(.white.opacity(0.75), lineWidth: 1.2).padding(4)
            VStack(spacing: -2) {
                ForEach(Array(text), id: \.self) { c in Text(String(c)).font(Fonts.song(22, bold: true)) }
            }
            .foregroundStyle(.white)
        }
    }
}
