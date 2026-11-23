import Foundation
import Observation

// 思想脑图(书包根目录的 mindmap.json,book.json 里 "mindmap": "mindmap.json" 声明):
// { root: { label, note?, ch?, children: [ … ] } } —— 节点没有 id,按在树里的位置(下标路径)认。
// 导入时宽松地解一遍(不认识的字段不管;超深、超量的截去并记一句说明,不因此拒收整本书),
// 解好的样子写成 mindmap.desk.json 放在这本书的目录里,之后打开脑图只读这一份。

/// 一个节点(存盘用,嵌套)。
struct MindNodeFile: Codable, Hashable {
    var label: String
    var note: String?
    var ch: Int?
    var children: [MindNodeFile]
}

struct MindMapFile: Codable {
    static let storeName = "mindmap.desk.json"
    var root: MindNodeFile
    var nodes: Int
    var truncated: String?
}

enum MindMapParser {
    static let maxDepth = 5          // 含根
    static let maxNodes = 600
    static let labelMax = 120        // 标准说 ≤ 60;读的时候宽一点,再长才截
    static let noteMax = 1600

    private static func clean(_ s: String?, max: Int, oneLine: Bool) -> String? {
        guard var t = s?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty else { return nil }
        if oneLine { t = t.replacingOccurrences(of: "\r", with: " ").replacingOccurrences(of: "\n", with: " ") }
        if t.count > max { t = String(t.prefix(max - 1)) + "…" }
        return t
    }

    /// 解一份 mindmap.json;根都找不到就返回 nil(这本书当没有脑图)。
    /// chapters:这本书的章数(ch 不在 1…chapters 里的当没写)。
    static func parse(_ data: Data, chapters: Int) -> MindMapFile? {
        guard let v = try? JSONDecoder().decode(JSONValue.self, from: data) else { return nil }
        // 宽松:{root:{…}} 是标准写法;整份就是根节点(站内 {id,label,children})也认
        let rootV: JSONValue
        if let r = v["root"], case .object = r { rootV = r } else if case .object = v, v["label"] != nil { rootV = v } else { return nil }
        func node(_ x: JSONValue) -> String? {
            // 画布上只画纯文字:行内记号(§3)去掉
            let raw = x.string ?? x["label"]?.string ?? x["x"]?.string
            return clean(raw.map { BHText.plain(BHText.importMarks($0)) }, max: labelMax, oneLine: true)
        }
        var count = 0
        var cutDeep = 0, cutMany = 0
        // 先按层(广度优先)数配额:超量时保住上面几层,截掉的是最深处的末梢
        var quota: [Int: Int] = [:]      // 深度 → 这一层还能收几个
        do {
            var level: [JSONValue] = [rootV]
            var d = 1, left = maxNodes
            while !level.isEmpty && left > 0 && d <= maxDepth {
                let valid = level.filter { node($0) != nil }
                quota[d] = min(valid.count, left)
                left -= quota[d]!
                level = valid.flatMap { $0["children"]?.array ?? [] }
                d += 1
            }
        }
        var used: [Int: Int] = [:]
        func walk(_ x: JSONValue, depth: Int) -> MindNodeFile? {
            guard let label = node(x) else { return nil }
            if used[depth, default: 0] >= quota[depth, default: 0] { cutMany += 1; return nil }
            used[depth, default: 0] += 1
            count += 1
            var ch: Int?
            if case .number(let n)? = x["ch"] ?? x["ref"]?["ch"], n == n.rounded(), n >= 1, Int(n) <= chapters { ch = Int(n) }
            var kids: [MindNodeFile] = []
            let raw = x["children"]?.array ?? []
            if depth >= maxDepth {
                cutDeep += raw.count
            } else {
                for c in raw { if let k = walk(c, depth: depth + 1) { kids.append(k) } }
            }
            return MindNodeFile(label: label, note: clean(x["note"]?.string.map(BHText.importMarks), max: noteMax, oneLine: false), ch: ch, children: kids)
        }
        guard let root = walk(rootV, depth: 1) else { return nil }
        var note: String?
        if cutDeep > 0 || cutMany > 0 {
            var parts: [String] = []
            if cutDeep > 0 { parts.append("超过 \(maxDepth) 层的 \(cutDeep) 处") }
            if cutMany > 0 { parts.append("超出 \(maxNodes) 个节点上限的部分") }
            note = "这份脑图" + parts.joined(separator: "、") + "没有收进来"
        }
        return MindMapFile(root: root, nodes: count, truncated: note)
    }
}

/// 运行时的脑图:拍平成数组,节点按先序编号(0 = 根),先序也就是「走读」的次序。
final class MindTree {
    struct Node {
        var id: Int
        var parent: Int          // 根为 -1
        var children: [Int]
        var depth: Int           // 根为 0
        var index: Int           // 在兄弟里的第几个
        var branch: Int          // 属于第几支一级分支;根为 -1
        var label: String
        var note: String?
        var ch: Int?
        /// 自己没写 ch 时,取最近的祖先的
        var effCh: Int?
        var path: String         // 「0.2.1」:根下第 1 支 → 第 3 项 → 第 2 项;根为 ""
        var subtreeEnd: Int      // 先序里这棵子树最后一个节点的编号
    }

    let nodes: [Node]
    let title: String
    let truncated: String?
    let maxDepth: Int
    /// 写了 ch 的节点:章号 → 节点
    let byChapter: [Int: [Int]]

    init(_ f: MindMapFile) {
        var out: [Node] = []
        func add(_ n: MindNodeFile, parent: Int, depth: Int, index: Int, branch: Int, inherited: Int?, path: String) -> Int {
            let id = out.count
            let eff = n.ch ?? inherited
            out.append(Node(id: id, parent: parent, children: [], depth: depth, index: index, branch: branch, label: n.label, note: n.note,
                            ch: n.ch, effCh: eff, path: path, subtreeEnd: id))
            var kids: [Int] = []
            for (i, c) in n.children.enumerated() {
                kids.append(add(c, parent: id, depth: depth + 1, index: i, branch: depth == 0 ? i : branch, inherited: eff,
                                path: path.isEmpty ? "\(i)" : "\(path).\(i)"))
            }
            out[id].children = kids
            out[id].subtreeEnd = out.count - 1
            return id
        }
        _ = add(f.root, parent: -1, depth: 0, index: 0, branch: -1, inherited: nil, path: "")
        nodes = out
        title = f.root.label
        truncated = f.truncated
        maxDepth = out.map(\.depth).max() ?? 0
        var bc: [Int: [Int]] = [:]
        for n in out { if let c = n.ch { bc[c, default: []].append(n.id) } }
        byChapter = bc
    }

    var count: Int { nodes.count }
    var branches: Int { nodes[0].children.count }
    subscript(_ i: Int) -> Node { nodes[i] }

    func node(path: String) -> Int? {
        var cur = 0
        for s in path.split(separator: ".") {
            guard let i = Int(s), let c = nodes[cur].children[safe: i] else { return nil }
            cur = c
        }
        return cur
    }

    /// 从根到它(含两头)。
    func ancestry(_ i: Int) -> [Int] {
        var out: [Int] = []
        var c = i
        while c >= 0 { out.append(c); c = nodes[c].parent }
        return out.reversed()
    }

    func isAncestor(_ a: Int, of b: Int) -> Bool { b > a && b <= nodes[a].subtreeEnd }

    /// 有子项的节点里,深度 < level 的(「展开到第 n 层」:看得到第 n 层)。
    func openSet(level: Int) -> Set<Int> {
        Set(nodes.filter { !$0.children.isEmpty && $0.depth < level }.map(\.id))
    }
    var allOpen: Set<Int> { Set(nodes.filter { !$0.children.isEmpty }.map(\.id)) }

    /// 这一章对应的节点:写了 ch 的那些;没有的话,看有没有落在它上面的(effCh)。
    func nodes(forChapter ch: Int) -> [Int] {
        if let n = byChapter[ch], !n.isEmpty {
            // 祖先已经标了同一章的,子孙不另算(一支整个讲这一章时只聚焦那一支)
            return n.filter { id in !n.contains { $0 != id && isAncestor($0, of: id) } }
        }
        return []
    }

    /// 一章落在哪一支一级分支:写了这一章的节点里最靠前的那个所在的那一支(根上写的不算);脑图没提到这一章为 nil。
    func branch(forChapter ch: Int) -> Int? {
        for id in (byChapter[ch] ?? []).sorted() where nodes[id].branch >= 0 { return nodes[id].branch }
        return nil
    }
    /// 第 b 支一级分支的题名。
    func branchLabel(_ b: Int) -> String? { nodes[0].children[safe: b].map { nodes[$0].label } }

    /// 一支里涉及的章(去重):学过几章 / 共几章,画进度用。
    func chapters(inSubtree i: Int) -> Set<Int> {
        var s = Set<Int>()
        for k in i...nodes[i].subtreeEnd { if let c = nodes[k].ch { s.insert(c) } }
        return s
    }

    /// 搜索:标签或展开说明里含这几个字的(不分大小写)。
    func search(_ q: String) -> [Int] {
        let t = q.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return [] }
        return nodes.filter { $0.label.localizedCaseInsensitiveContains(t) || ($0.note ?? "").localizedCaseInsensitiveContains(t) }.map(\.id)
    }
}

/// 一本书脑图的读取(带个小缓存)。
@MainActor
enum MindMapStore {
    private static var cache: [String: (version: String, tree: MindTree)] = [:]

    static func tree(_ book: BookInfo) -> MindTree? {
        guard book.mindmapNodes != nil else { return nil }
        if let c = cache[book.id], c.version == book.version { return c.tree }
        let url = DeskbookStore.shared.dir(book.id).appendingPathComponent(MindMapFile.storeName)
        guard let d = try? Data(contentsOf: url), let f = try? JSONDecoder().decode(MindMapFile.self, from: d), f.nodes > 0 else { return nil }
        let t = MindTree(f)
        cache[book.id] = (book.version, t)
        return t
    }
}

/// 一本书脑图上的阅读状态(只存本机):展开了哪些、选中哪一个、画布还是提纲、缩放与位置。
/// 节点按下标路径存,书包更新后对不上的自然丢掉。
struct MindMapUIState: Codable {
    var open: [String]
    var sel: String?
    var outline: Bool
    var zoom: Double?
    /// 根节点左缘中点落在屏上哪里(按视口宽高的比例);nil = 按默认摆
    var rootX: Double?
    var rootY: Double?

    static func key(_ book: String) -> String { "desk.mindmap.\(book)" }
    static func load(_ book: String) -> MindMapUIState? {
        guard let d = UserDefaults.standard.data(forKey: key(book)) else { return nil }
        return try? JSONDecoder().decode(MindMapUIState.self, from: d)
    }
    func save(_ book: String) {
        if let d = try? JSONEncoder().encode(self) { UserDefaults.standard.set(d, forKey: Self.key(book)) }
    }
}
