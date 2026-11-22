import SwiftUI
import UIKit
import AVFoundation

// 书包文章里的六种新块:图片(点开全屏、双指缩放)、视频 / 动图(静音循环,上屏才播)、提纲(可收放的脑图)、代码、分隔、
// 另有书与每章开头的声明条。官方白话没有这些块,只有书包文章会走到这里。

// MARK: 图片

struct BHImageBlock: View {
    let m: BHMedia
    let accent: Color
    let width: CGFloat
    @State private var img: UIImage?
    @State private var zoom = false
    @Environment(\.displayScale) private var scale

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 14).fill(accent.opacity(0.06))
                if let img {
                    Image(uiImage: img).resizable().scaledToFit().transition(.opacity)
                } else {
                    Image(systemName: "photo").font(.system(size: 22)).foregroundStyle(accent.opacity(0.35))
                }
            }
            .aspectRatio(m.aspect, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(alignment: .bottomTrailing) {
                if img != nil {
                    Image(systemName: "arrow.up.left.and.arrow.down.right").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 26, height: 26).background(.black.opacity(0.35), in: Circle()).padding(8)
                        .accessibilityHidden(true)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { if img != nil { zoom = true } }
            .accessibilityElement()
            .accessibilityLabel(m.alt.isEmpty ? "图片" : m.alt)
            .accessibilityAddTraits([.isImage, .isButton])
            .accessibilityHint("点开放大")
            if let c = m.cap { Caption(text: c) }
        }
        .task(id: m.url) {
            let u = m.url, px = max(width, 320) * scale
            let got = await Task.detached(priority: .userInitiated) { Downsample.image(u, maxPixel: px) }.value
            withAnimation(.easeOut(duration: 0.2)) { img = got }
        }
        .fullScreenCover(isPresented: $zoom) { ZoomImageScreen(url: m.url, alt: m.alt, cap: m.cap) }
    }
}

private struct Caption: View {
    let text: String
    var body: some View {
        Text(BHAttr.text(text, accent: Ink.soft)).font(.system(size: 13)).lineSpacing(3).foregroundStyle(Ink.faint)
            .frame(maxWidth: .infinity, alignment: .center).multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// 全屏看图:双指缩放、双击放大 / 复原、拖动;右上角收起。
struct ZoomImageScreen: View {
    let url: URL
    let alt: String
    let cap: String?
    @Environment(\.dismiss) private var dismiss
    @State private var img: UIImage?

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            if let img { ZoomView(image: img).ignoresSafeArea().accessibilityLabel(alt) } else { ProgressView().tint(.white).frame(maxWidth: .infinity, maxHeight: .infinity) }
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(.black.opacity(0.5), in: Circle())
            }
            .accessibilityLabel("收起")
            .padding(16)
        }
        .overlay(alignment: .bottom) {
            if let cap {
                Text(cap).font(.system(size: 14)).foregroundStyle(.white).multilineTextAlignment(.center)
                    .padding(.horizontal, 14).padding(.vertical, 8).background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal, 24).padding(.bottom, 24)
            }
        }
        .statusBarHidden(true)
        .task { let u = url; img = await Task.detached { Downsample.image(u, maxPixel: 4096) }.value }
    }
}

private struct ZoomView: UIViewRepresentable {
    let image: UIImage

    final class Coordinator: NSObject, UIScrollViewDelegate {
        let iv = UIImageView()
        func viewForZooming(in s: UIScrollView) -> UIView? { iv }
        func scrollViewDidZoom(_ s: UIScrollView) { center(s) }
        func center(_ s: UIScrollView) {
            let dx = max(0, (s.bounds.width - s.contentSize.width) / 2), dy = max(0, (s.bounds.height - s.contentSize.height) / 2)
            s.contentInset = UIEdgeInsets(top: dy, left: dx, bottom: dy, right: dx)
        }
        @objc func doubleTap(_ g: UITapGestureRecognizer) {
            guard let s = g.view as? UIScrollView else { return }
            if s.zoomScale > 1.01 { s.setZoomScale(1, animated: true); return }
            let p = g.location(in: iv)
            let w = s.bounds.width / 2.5, h = s.bounds.height / 2.5
            s.zoom(to: CGRect(x: p.x - w / 2, y: p.y - h / 2, width: w, height: h), animated: true)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UIScrollView {
        let s = FitScrollView()
        s.delegate = context.coordinator
        s.minimumZoomScale = 1
        s.maximumZoomScale = 6
        s.showsHorizontalScrollIndicator = false
        s.showsVerticalScrollIndicator = false
        s.backgroundColor = .clear
        s.contentInsetAdjustmentBehavior = .never
        let iv = context.coordinator.iv
        iv.image = image
        iv.contentMode = .scaleAspectFit
        s.addSubview(iv)
        s.onLayout = { [weak s] in
            guard let s, s.zoomScale == 1 else { return }
            let sz = image.size, b = s.bounds.size
            guard sz.width > 0, b.width > 0 else { return }
            let k = min(b.width / sz.width, b.height / sz.height)
            iv.frame = CGRect(x: 0, y: 0, width: sz.width * k, height: sz.height * k)
            s.contentSize = iv.frame.size
            context.coordinator.center(s)
        }
        let dt = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.doubleTap(_:)))
        dt.numberOfTapsRequired = 2
        s.addGestureRecognizer(dt)
        return s
    }

    func updateUIView(_ s: UIScrollView, context: Context) {}

    final class FitScrollView: UIScrollView {
        var onLayout: (() -> Void)?
        private var last: CGSize = .zero
        override func layoutSubviews() {
            super.layoutSubviews()
            if bounds.size != last { last = bounds.size; onLayout?() }
        }
    }
}

// MARK: 视频 / 动图

/// 视频块:先显示封面;进到屏上(露出一半以上)静音循环自动播,离开就停,滚远了连播放器一起释放。
/// 点一下暂停 / 接着播。`sound: true` 的不自动播(点了才带声播);「减弱动态效果」打开时也不自动播,封面上给播放钮。
struct BHVideoBlock: View {
    let m: BHMedia
    let accent: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var phase
    @State private var poster: UIImage?
    @State private var near = false
    @State private var visible = false
    @State private var userPaused = false
    @State private var started = false
    @State private var ready = false

    private var autoplay: Bool { !m.sound && !reduceMotion }
    private var playing: Bool { near && visible && phase == .active && !userPaused && (autoplay || started) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 14).fill(Color.black.opacity(0.06))
                if let poster { Image(uiImage: poster).resizable().scaledToFit() }
                if near {
                    LoopPlayer(url: m.url, loop: m.loop, muted: !(m.sound && started), playing: playing,
                               onReady: { ready = true }, onEnd: { started = false; userPaused = false })
                        .opacity(ready && (playing || started || autoplay) ? 1 : 0)
                }
                if !playing {
                    Image(systemName: "play.fill").font(.system(size: 20, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 54, height: 54).background(.black.opacity(0.42), in: Circle())
                        .accessibilityHidden(true)
                        .transition(.opacity)
                }
            }
            .aspectRatio(m.aspect, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(alignment: .bottomLeading) {
                HStack(spacing: 4) {
                    Image(systemName: m.sound ? "speaker.wave.2.fill" : "speaker.slash.fill")
                    if let s = m.sec, s > 0 { Text("\(Int(s.rounded())) 秒") }
                }
                .font(.system(size: 10.5, weight: .semibold)).foregroundStyle(.white)
                .padding(.horizontal, 7).padding(.vertical, 4).background(.black.opacity(0.35), in: Capsule()).padding(8)
                .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if autoplay || started { userPaused.toggle() } else { started = true; userPaused = false }
            }
            .animation(.easeInOut(duration: 0.2), value: playing)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { r in
                let screen = UIScreen.main.bounds
                let shown = max(0, min(r.maxY, screen.maxY) - max(r.minY, screen.minY))
                visible = r.height > 0 && shown >= r.height * 0.5
                near = r.maxY > -screen.height * 1.5 && r.minY < screen.maxY + screen.height * 1.5
                if !near { ready = false }
            }
            // 懒列表把这一块移出排版范围时不再报位置:直接停播、放掉播放器
            .onDisappear { visible = false; near = false; ready = false }
            .accessibilityElement()
            .accessibilityLabel((m.alt.isEmpty ? "动画" : m.alt) + (playing ? ",正在播放" : ",已暂停"))
            .accessibilityAddTraits(.isButton)
            .accessibilityHint(playing ? "点一下暂停" : "点一下播放")
            if let c = m.cap { Caption(text: c) }
        }
        .task(id: m.poster) {
            guard let u = m.poster else { return }
            poster = await Task.detached { Downsample.image(u, maxPixel: 1400) }.value
        }
    }
}

final class PlayerUIView: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

/// AVPlayer 的壳:循环播放、静音与否、播与停都由外面给;视图拆掉时停播、放掉播放器。
struct LoopPlayer: UIViewRepresentable {
    let url: URL
    let loop: Bool
    let muted: Bool
    let playing: Bool
    let onReady: () -> Void
    let onEnd: () -> Void

    final class Coordinator {
        var player: AVQueuePlayer?
        var looper: AVPlayerLooper?
        var ready: NSKeyValueObservation?
        var end: NSObjectProtocol?
        var withSound = false
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> PlayerUIView {
        let v = PlayerUIView()
        v.playerLayer.videoGravity = .resizeAspect
        v.backgroundColor = .clear
        let item = AVPlayerItem(url: url)
        let p = AVQueuePlayer()
        p.isMuted = true
        p.preventsDisplaySleepDuringVideoPlayback = false
        p.actionAtItemEnd = loop ? .advance : .pause
        if loop { context.coordinator.looper = AVPlayerLooper(player: p, templateItem: item) } else {
            p.insert(item, after: nil)
            context.coordinator.end = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak p] _ in
                p?.seek(to: .zero)
                onEnd()
            }
        }
        v.playerLayer.player = p
        context.coordinator.player = p
        context.coordinator.ready = v.playerLayer.observe(\.isReadyForDisplay, options: [.initial, .new]) { l, _ in
            if l.isReadyForDisplay { DispatchQueue.main.async { onReady() } }
        }
        return v
    }

    func updateUIView(_ v: PlayerUIView, context: Context) {
        guard let p = context.coordinator.player else { return }
        if p.isMuted != muted {
            p.isMuted = muted
            if !muted { try? AVAudioSession.sharedInstance().setCategory(.playback); context.coordinator.withSound = true }
        }
        if playing { if p.timeControlStatus != .playing { p.play(); dlog("play") } } else if p.timeControlStatus != .paused { p.pause(); dlog("pause") }
    }

    private func dlog(_ s: String) {
        #if DEBUG
        NSLog("DESKVIDEO %@ %@", s, url.lastPathComponent)
        #endif
    }

    static func dismantleUIView(_ v: PlayerUIView, coordinator c: Coordinator) {
        #if DEBUG
        NSLog("DESKVIDEO release")
        #endif
        c.player?.pause()
        c.looper?.disableLooping()
        c.ready?.invalidate()
        if let e = c.end { NotificationCenter.default.removeObserver(e) }
        v.playerLayer.player = nil
        c.player = nil; c.looper = nil
        if c.withSound { try? AVAudioSession.sharedInstance().setCategory(.ambient, options: .mixWithOthers) }
    }
}

// MARK: 提纲

/// 提纲 / 思想脑图:第一层一张张小卡,往下用连线挂子项;有下层的点一下收放,右上角一键全部展开 / 收起。最多四层。
struct BHOutlineBlock: View {
    let nodes: [BHNode]
    let accent: Color
    let accent2: Color
    let fs: CGFloat
    @State private var open: Set<String> = []
    @State private var seeded = false

    private var all: [String] { nodes.flatMap(\.allIDs) }
    private var withKids: [String] { func walk(_ n: BHNode) -> [String] { (n.children.isEmpty ? [] : [n.id]) + n.children.flatMap(walk) }; return nodes.flatMap(walk) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "point.3.connected.trianglepath.dotted").font(.system(size: 12, weight: .bold))
                Text("提纲").font(.system(size: 12.5, weight: .bold)).kerning(2)
                Spacer()
                if !withKids.isEmpty {
                    let allOpen = withKids.allSatisfy(open.contains)
                    Button(allOpen ? "全部收起" : "全部展开") {
                        withAnimation(.easeInOut(duration: 0.25)) { open = allOpen ? [] : Set(withKids) }
                    }
                    .font(.system(size: 12.5, weight: .semibold))
                }
            }
            .foregroundStyle(accent)
            ForEach(Array(nodes.enumerated()), id: \.element.id) { i, n in
                OutlineNodeView(node: n, level: 0, index: i, open: $open, accent: accent, accent2: accent2, fs: fs)
            }
        }
        .onAppear {
            // 起初:第一层展开(看得到第二层),更深的收着
            guard !seeded else { return }
            seeded = true
            open = Set(nodes.filter { !$0.children.isEmpty }.map(\.id))
        }
    }
}

private struct OutlineNodeView: View {
    let node: BHNode
    let level: Int
    let index: Int
    @Binding var open: Set<String>
    let accent: Color
    let accent2: Color
    let fs: CGFloat

    private var isOpen: Bool { open.contains(node.id) }
    private var hasKids: Bool { !node.children.isEmpty }

    var body: some View {
        let row = HStack(alignment: .firstTextBaseline, spacing: 10) {
            marker
            Text(BHAttr.text(node.x, accent: accent))
                .font(level == 0 ? Fonts.song(fs * 1.02, bold: true) : .system(size: fs * (level == 1 ? 0.92 : 0.86), weight: level == 1 ? .medium : .regular))
                .foregroundStyle(level >= 2 ? Ink.soft : Ink.text)
                .lineSpacing(fs * 0.3)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 4)
            if hasKids {
                HStack(spacing: 3) {
                    if !isOpen { Text("\(node.children.count)").font(Fonts.num(11, weight: .semibold)) }
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).rotationEffect(.degrees(isOpen ? 90 : 0))
                }
                .foregroundStyle(isOpen ? accent : Ink.faint)
                .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            guard hasKids else { return }
            withAnimation(.easeInOut(duration: 0.22)) { if isOpen { open.remove(node.id) } else { open.insert(node.id) } }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(hasKids ? .isButton : [])
        .accessibilityValue(hasKids ? (isOpen ? "已展开" : "已收起,\(node.children.count) 项") : "")

        VStack(alignment: .leading, spacing: level == 0 ? 10 : 8) {
            row
            if hasKids && isOpen {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(node.children.enumerated()), id: \.element.id) { i, c in
                        OutlineNodeView(node: c, level: level + 1, index: i, open: $open, accent: accent, accent2: accent2, fs: fs)
                            .padding(.leading, 18)
                            .overlay(alignment: .topLeading) {
                                // 连线:从父节点下来的竖线,再横拐到这一项
                                Path { p in p.move(to: CGPoint(x: 5, y: -8)); p.addLine(to: CGPoint(x: 5, y: fs * 0.62)); p.addLine(to: CGPoint(x: 14, y: fs * 0.62)) }
                                    .stroke(lineColor, style: StrokeStyle(lineWidth: 1.2, lineCap: .round, lineJoin: .round))
                            }
                    }
                }
                .padding(.leading, level == 0 ? 2 : 0)
                .overlay(alignment: .leading) {
                    Rectangle().fill(lineColor).frame(width: 1.2).padding(.leading, 4.4).padding(.bottom, 14)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(level == 0 ? 14 : 0)
        .background {
            if level == 0 {
                RoundedRectangle(cornerRadius: 14).fill(accent.opacity(0.055))
                    .overlay(alignment: .leading) { UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 14).fill(accent.opacity(0.65)).frame(width: 3.5) }
            }
        }
    }

    private var lineColor: Color { (level == 0 ? accent : accent2).opacity(0.3) }

    @ViewBuilder private var marker: some View {
        switch level {
        case 0:
            Text("\(index + 1)").font(Fonts.num(11, weight: .bold)).foregroundStyle(.white)
                .frame(width: 20, height: 20).background(accent, in: Circle())
                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
        case 1:
            Circle().fill(accent2.opacity(0.85)).frame(width: 7, height: 7)
        default:
            Circle().stroke(Ink.faint, lineWidth: 1.2).frame(width: 6, height: 6)
        }
    }
}

// MARK: 代码 · 分隔 · 引文 · 声明

struct BHCodeBlock: View {
    let x: String
    let lang: String?
    let fs: CGFloat
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let lang {
                Text(lang).font(.system(size: 10.5, weight: .bold, design: .monospaced)).foregroundStyle(Ink.faint)
                    .padding(.horizontal, 14).padding(.top, 10)
            }
            ScrollView(.horizontal, showsIndicators: true) {
                Text(x).font(.system(size: max(12, fs * 0.76), design: .monospaced)).foregroundStyle(Ink.text).lineSpacing(4)
                    .fixedSize(horizontal: true, vertical: false)
                    .textSelection(.enabled)
                    .padding(14)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Ink.line.opacity(0.32), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Ink.line, lineWidth: 1))
        .accessibilityLabel("代码:\(x)")
    }
}

struct BHDivider: View {
    let accent: Color
    var body: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Ink.line).frame(height: 1)
            HStack(spacing: 6) { ForEach(0..<3, id: \.self) { _ in Circle().fill(accent.opacity(0.45)).frame(width: 4, height: 4) } }
            Rectangle().fill(Ink.line).frame(height: 1)
        }
        .padding(.horizontal, 40)
        .accessibilityHidden(true)
    }
}

/// 书包的声明(医学 / 命理 / 自写的一句):书的首页与每章开头,一条安静的提示。
struct DisclaimerBanner: View {
    let lines: [String]
    var compact = false
    var body: some View {
        if !lines.isEmpty {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle").font(.system(size: compact ? 11 : 12.5, weight: .semibold)).padding(.top, 1)
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(lines, id: \.self) { Text($0).fixedSize(horizontal: false, vertical: true) }
                }
            }
            .font(.system(size: compact ? 11.5 : 13))
            .foregroundStyle(Ink.soft)
            .padding(.horizontal, compact ? 10 : 12).padding(.vertical, compact ? 6 : 9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Ink.line.opacity(0.4), in: RoundedRectangle(cornerRadius: 10))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("提示:" + lines.joined(separator: "。"))
        }
    }
}
