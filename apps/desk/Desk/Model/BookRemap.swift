import Foundation

/// 书包换版式时,本机阅读记录跟着挪坐标。
///
/// 老版观书书包把「全书总览」当第一章(正文从第二章起);新版把总览单列成 overview.json(坐标第 0 章),
/// 正文从第一章起。同一本书从老版更新到新版时:老 1 → 0(总览),老 n → n − 1。
/// 由 DeskbookStore.install 在「装前是老版式、装后有总览」时调一次(本机账 desk.bookLayout 防重搬)。
@MainActor
enum BookRemap {
    /// 新版是不是「旧第一章抽成总览、其余前移一位」:旧版正好多一章,且旧第 k+1 章与新第 k 章题名大半对得上。
    /// 旧版没在本机(删书留了记录再装)时只能按章数判断不了——不挪,宁可不动也不错挪。
    /// 只是添了一篇总览、正文没动的(章数相同)不挪。
    static func looksShifted(old: [String]?, new: [String]) -> Bool {
        guard let old, old.count == new.count + 1, !new.isEmpty else { return false }
        let same = zip(old.dropFirst(), new).filter { $0 == $1 }.count
        return same * 2 >= new.count
    }

    static func overviewShift(_ id: String) {
        let f: (Int) -> Int = { $0 <= 1 ? 0 : $0 - 1 }
        // 续读位置(推上云的是新坐标)
        if let p = ProgressStore.shared.pos[id] { ProgressStore.shared.set(id, ch: f(p.ch), seg: p.seg) }
        // 文章里滚到哪一块(只存本机)
        BaihuaPos.remap(id, f)
        AskState.remap(id, f)
        // 时长与字数(学过由它算):只搬本机设备的键
        ReadDaysStore.shared.remapOwn(corpus: DeskbookInstaller.corpus, slug: id, f)
        // 划线:按存下的字核——在新坐标那一篇里找得到才搬;已经对得上原章号、新坐标里反而没有的(别的设备搬过、同步下来的)不动
        for h in HighlightStore.shared.alive(book: id) {
            let to = f(h.no)
            guard to != h.no else { continue }
            let inNew = found(h, id, to), inHere = found(h, id, h.no)
            if inHere && !inNew { continue }
            HighlightStore.shared.relocate(h.id, ch: to, no: to)
        }
        #if DEBUG
        print("[remap] \(id): 老版式 → 有总览,阅读记录章号挪一位")
        #endif
    }

    private static func found(_ h: Highlight, _ id: String, _ no: Int) -> Bool {
        guard !h.text.isEmpty, let a = DeskbookStore.shared.article(id, no) else { return false }
        return a.blocks.contains { $0.markable?.contains(h.text) == true }
    }
}
