import Foundation
import Observation
import UIKit

/// 云同步(与网站同一个 POST /api/sync)。只在登录后联网;未登录时各项数据照常只存本机。
///
/// 同步的键:
/// - `highlights` / `readDays` / `finished`:逐条合并的键(服务端按记录里的 at 取新者,删除走墓碑)。只推本机改过的那几条。
/// - `readPos`:整值新者胜。先取云端值,只改自己读过的那些 slug,其余原样带回;书桌的条目多带 at、dev。
/// - `settings`:整值新者胜,是网站的设置。先取云端值,只合进书桌自己的字段(deskGoal)再推,不动网站写的其余字段。
///
/// 节奏:本机有改动后约 15 秒推一次(其间再改就顺延,最长不超过 60 秒);退到后台立即推;启动与回到前台拉一次;
/// 失败按 15 秒起翻倍退避(封顶 10 分钟)重试,不弹错。
///
/// 进度冲突只提示不自动跳:拉到云端的某本书位置与本机不同、且不是本机上次推上去的,就记进 `pending`,
/// 阅读页打开这本书时出一条小提示;选过的位置不再问。
@MainActor
@Observable
final class SyncEngine {
    static let shared = SyncEngine()

    private(set) var syncing = false
    private(set) var failing = false
    private(set) var lastSyncAt: Date?
    /// 云端(另一台设备)读到的位置:书 → 章(书内序号)、段。
    private(set) var pending: [String: ReadPos] = [:]

    private struct Meta: Codable {
        var seen: [String: String] = [:]      // slug → 上次见到的云端位置「ch:seg」
        var pushed: [String: String] = [:]    // slug → 本机上次推上去的位置
        var dismissed: [String: String] = [:] // 书 → 用户已经选过的那个云端位置「no:seg」
        var pending: [String: ReadPos] = [:]
        var lastSyncAt: Date?
    }
    @ObservationIgnored private var meta = Meta()
    @ObservationIgnored private var timer: Task<Void, Never>?
    @ObservationIgnored private var firstDirty: Date?
    @ObservationIgnored private var failures = 0
    @ObservationIgnored private var retryAt: Date?
    @ObservationIgnored private var again = false
    @ObservationIgnored private var loginMerge = false
    @ObservationIgnored private var lastPull = Date.distantPast

    static let debounce: TimeInterval = 15
    static let maxWait: TimeInterval = 60

    init() {
        if let d = UserDefaults.standard.data(forKey: "desk.sync.meta"), let m = try? JSONDecoder().decode(Meta.self, from: d) {
            meta = m; pending = m.pending; lastSyncAt = m.lastSyncAt
        }
    }

    private var token: String? { AccountStore.shared.token }

    // MARK: 节奏

    /// 本机数据改了:约 15 秒后推(再改顺延,自第一次改动起最长 60 秒)。
    func noteChange() {
        guard token != nil else { return }
        let now = Date()
        if firstDirty == nil { firstDirty = now }
        var at = min(now.addingTimeInterval(Self.debounce), firstDirty!.addingTimeInterval(Self.maxWait))
        if let r = retryAt, r > at { at = r }      // 正在退避:不提前
        dlog("noteChange → push in \(Int(at.timeIntervalSinceNow))s")
        schedule(at: at)
    }

    /// 启动、回到前台:拉一次(3 秒内不重复)。
    func appActive() {
        guard token != nil, Date().timeIntervalSince(lastPull) > 3 else { return }
        lastPull = Date()
        Task { await run() }
    }

    /// 退到后台:先让时钟结清,立即推一次(向系统要一点后台时间)。
    func appBackground() {
        ReadClock.active?.settle()
        guard token != nil else { return }
        var bg = UIBackgroundTaskIdentifier.invalid
        bg = UIApplication.shared.beginBackgroundTask(withName: "desk.sync") { UIApplication.shared.endBackgroundTask(bg) }
        Task {
            await run()
            UIApplication.shared.endBackgroundTask(bg)
        }
    }

    /// 「立即同步」。
    func syncNow() { retryAt = nil; failures = 0; Task { await run() } }

    private func schedule(at: Date) {
        timer?.cancel()
        let wait = max(0, at.timeIntervalSinceNow)
        timer = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
            guard !Task.isCancelled, let self else { return }
            // 另起一个任务去跑:run() 开头会取消待发的定时器,不能让它把自己这一轮的网络请求也取消掉
            self.timer = nil
            Task { await self.run() }
        }
    }

    // MARK: 登录 / 登出

    /// 刚登录:把本机已有的数据与云端合并(逐条合并的键全部推一遍;readPos 先比对、按冲突规则走)。
    func didLogin() {
        meta = Meta()
        pending = [:]
        lastSyncAt = nil
        loginMerge = true
        HighlightStore.shared.markAllDirty()
        ReadDaysStore.shared.markAllDirty()
        FinishedStore.shared.markAllDirty()
        DeskSettings.shared.markDirty()
        save()
        retryAt = nil; failures = 0
        Task { await run() }
    }

    /// 登出:本机数据都留着,只忘掉与这个账号的同步记录。
    func didLogout() {
        timer?.cancel(); timer = nil
        meta = Meta()
        pending = [:]
        lastSyncAt = nil
        failing = false
        failures = 0; retryAt = nil; firstDirty = nil
        save()
    }

    // MARK: 一轮

    private func run() async {
        guard let t = token else { return }
        dlog("run (syncing=\(syncing))")
        if syncing { again = true; return }
        syncing = true
        timer?.cancel(); timer = nil
        firstDirty = nil
        do {
            try await cycle(t)
            failures = 0; retryAt = nil; failing = false
            lastSyncAt = Date()
            lastPull = Date()
            meta.lastSyncAt = lastSyncAt
            save()
        } catch let e as API.Failure where e.status == 401 {
            syncing = false
            AccountStore.shared.dropSession()
            return
        } catch {
            dlog("failed: \(error) [\(API.lastNetError)]")
            failures += 1
            failing = true
            let delay = min(600, Self.debounce * pow(2, Double(failures - 1)))
            retryAt = Date().addingTimeInterval(delay)
            schedule(at: retryAt!)
        }
        syncing = false
        if again {
            again = false
            if failures == 0 { await run() }
        }
    }

    private var nowMS: Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

    private func cycle(_ t: String) async throws {
        // ① 逐条合并的键:只推改过的那几条;响应里是云端合并后的全部键,顺带就是一次拉取
        let hs = HighlightStore.shared, rd = ReadDaysStore.shared, fin = FinishedStore.shared
        let hSnap = hs.dirty.stamps, rSnap = rd.dirty.stamps, fSnap = fin.dirty.stamps
        var data: [String: Any] = [:]
        func pack(_ snap: [String: Int], _ wire: (String) -> [String: Any]?) -> [String: Any]? {
            var m: [String: Any] = [:]
            for k in snap.keys { if let w = wire(k) { m[k] = w } }
            return m.isEmpty ? nil : ["value": m, "at": nowMS]
        }
        if let v = pack(hSnap, hs.wire) { data["highlights"] = v }
        if let v = pack(rSnap, rd.wire) { data["readDays"] = v }
        if let v = pack(fSnap, fin.wire) { data["finished"] = v }
        dlog("push① \(data.keys.sorted()) h=\(hSnap.count) r=\(rSnap.count) f=\(fSnap.count)")
        let r1 = try await API.call("POST", "sync", body: ["data": data], token: t, timeout: 30)
        hs.clearDirty(hSnap); rd.clearDirty(rSnap); fin.clearDirty(fSnap)
        let d1 = r1["data"] as? [String: Any] ?? [:]
        apply(d1)

        if loginMerge {
            // 登录那一刻:本机有位置、云端没提示冲突的书,把本机位置推上去(有冲突的先不推,等用户选)
            loginMerge = false
            ProgressStore.shared.markAllDirty(ProgressStore.shared.pos.keys.filter { pending[$0] == nil })
        }

        // ② 整值新者胜的键:拿 ① 取回的云端值做底,只改自己的部分
        let pSnap = ProgressStore.shared.dirty.stamps
        let settingsDirty = DeskSettings.shared.dirty
        guard !pSnap.isEmpty || settingsDirty else { return }
        var data2: [String: Any] = [:]
        var commits: [(String, String)] = []
        if !pSnap.isEmpty, let rp = d1["readPos"] as? [String: Any] {
            var v = rp["value"] as? [String: Any] ?? [:]
            let cloudAt = (rp["at"] as? NSNumber)?.int64Value ?? 0
            var any = false
            for b in pSnap.keys {
                guard let p = ProgressStore.shared.pos[b], let c = chapter(book: b, no: p.ch) else { continue }
                v[c.src.slug] = ["ch": c.src.ch, "seg": p.seg, "at": API.iso(p.at), "dev": rd.dev]
                commits.append((c.src.slug, "\(c.src.ch):\(p.seg)"))
                any = true
            }
            if any { data2["readPos"] = ["value": v, "at": max(nowMS, cloudAt + 1)] }
        }
        let settingsStamp = Date()
        if settingsDirty {
            let st = d1["settings"] as? [String: Any]
            var v = st?["value"] as? [String: Any] ?? [:]
            for (k, x) in DeskSettings.shared.fields { v[k] = x }
            let cloudAt = (st?["at"] as? NSNumber)?.int64Value ?? 0
            data2["settings"] = ["value": v, "at": max(nowMS, cloudAt + 1)]
        }
        if data2.isEmpty { ProgressStore.shared.clearDirty(pSnap); return }
        dlog("push② \(data2.keys.sorted())")
        let r2 = try await API.call("POST", "sync", body: ["data": data2], token: t, timeout: 30)
        ProgressStore.shared.clearDirty(pSnap)
        if settingsDirty { DeskSettings.shared.pushed(at: settingsStamp) }
        for (slug, sig) in commits { meta.pushed[slug] = sig; meta.seen[slug] = sig }
        if let d2 = r2["data"] as? [String: Any], let rp = d2["readPos"] as? [String: Any] { detect(rp["value"]) }
        save()
    }

    private func apply(_ d: [String: Any]) {
        func value(_ k: String) -> [String: Any]? { (d[k] as? [String: Any])?["value"] as? [String: Any] }
        if let m = value("highlights") { HighlightStore.shared.applyRemote(m) }
        if let m = value("readDays") { ReadDaysStore.shared.applyRemote(m) }
        if let m = value("finished") { FinishedStore.shared.applyRemote(m) }
        if let s = d["settings"] as? [String: Any], let v = s["value"] as? [String: Any], let at = (s["at"] as? NSNumber)?.doubleValue {
            DeskSettings.shared.applyRemote(v, at: Date(timeIntervalSince1970: at / 1000))
        }
        if let rp = d["readPos"] as? [String: Any] { detect(rp["value"]) }
        save()
    }

    // MARK: 进度冲突

    /// 看云端 readPos 里哪些 slug 变了(与上次见到的不同)、又不是本机推的:按书归拢,与本机位置比。
    private func detect(_ value: Any?) {
        guard let v = value as? [String: Any] else { return }
        struct Cand { var no: Int; var seg: Int; var at: Date? }
        var cands: [String: Cand] = [:]
        for (slug, raw) in v {
            guard let r = raw as? [String: Any], let ch = (r["ch"] as? NSNumber)?.intValue else { continue }
            let seg = (r["seg"] as? NSNumber)?.intValue ?? 0
            let sig = "\(ch):\(seg)"
            if meta.seen[slug] == sig { continue }
            guard let (book, no) = locate(slug: slug, ch: ch) else { continue }   // 这本书的内容包还没下:下次再看
            meta.seen[slug] = sig
            if meta.pushed[slug] == sig { continue }
            let at = API.date(r["at"])
            if let c = cands[book], (c.at ?? .distantPast) >= (at ?? .distantPast) { continue }
            cands[book] = Cand(no: no, seg: seg, at: at)
        }
        for (b, c) in cands {
            guard let local = ProgressStore.shared.pos[b] else {
                ProgressStore.shared.adoptRemote(b, ch: c.no, seg: c.seg, at: c.at ?? Date())   // 本机没读过这本:直接用云端的位置
                continue
            }
            if local.ch == c.no && local.seg == c.seg { pending[b] = nil; continue }
            if let at = c.at, at < local.at { continue }                // 云端那条比本机旧,不打扰
            if meta.dismissed[b] == "\(c.no):\(c.seg)" { continue }
            pending[b] = ReadPos(ch: c.no, seg: c.seg, at: c.at ?? Date())
        }
        meta.pending = pending
    }

    /// 用户对提示做了选择(跳过去 / 留在这里):这个位置不再问。
    func resolve(_ book: String) {
        guard let p = pending[book] else { return }
        meta.dismissed[book] = "\(p.ch):\(p.seg)"
        pending[book] = nil
        meta.pending = pending
        save()
    }

    /// 本机自己读到了云端那个位置:提示自然消失。
    func localMoved(_ book: String, ch: Int, seg: Int) {
        guard let p = pending[book], p.ch == ch, p.seg == seg else { return }
        pending[book] = nil
        meta.pending = pending
        save()
    }

    // MARK: 坐标换算(书桌的书 · 章序号 ↔ 站内 slug · 章号)

    private func chapter(book: String, no: Int) -> Chapter? {
        guard let b = Library.shared.book(book), let p = Library.shared.pack(b) else { return nil }
        return p.chapter(no)
    }

    private func locate(slug: String, ch: Int) -> (String, Int)? {
        for b in Library.shared.allBooks {
            guard let p = PackSummaries.shared.of(b) else { continue }
            if let o = p.overview, o.slug == slug, o.ch == ch { return (b.id, 0) }
            if let i = p.srcs.firstIndex(where: { $0.slug == slug && $0.ch == ch }) { return (b.id, i + 1) }
        }
        return nil
    }

    private func save() {
        meta.pending = pending
        if let d = try? JSONEncoder().encode(meta) { UserDefaults.standard.set(d, forKey: "desk.sync.meta") }
    }

    private func dlog(_ s: String) {
        #if DEBUG
        // 调试:追加到 Library/Caches/desksync.log(模拟器里看节奏用)
        let f = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("desksync.log")
        let line = "\(API.iso(Date())) \(s)\n"
        if let h = try? FileHandle(forWritingTo: f) { h.seekToEndOfFile(); h.write(Data(line.utf8)); try? h.close() }
        else { try? Data(line.utf8).write(to: f) }
        #endif
    }

    // MARK: 界面用

    func statusText(now: Date = Date()) -> String {
        if failing { return "等待联网" }
        guard let t = lastSyncAt else { return syncing ? "正在同步…" : "还没同步" }
        let s = now.timeIntervalSince(t)
        if s < 60 { return "刚刚同步" }
        if s < 3600 { return "\(Int(s / 60)) 分钟前同步" }
        if s < 86400 { return "\(Int(s / 3600)) 小时前同步" }
        return "\(Int(s / 86400)) 天前同步"
    }
}
