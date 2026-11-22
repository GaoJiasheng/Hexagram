import Foundation
import Compression

/// 书包读不开时的说明(原样给界面看)。
struct DeskbookError: Error, LocalizedError {
    let message: String
    init(_ m: String) { message = m }
    var errorDescription: String? { message }
}

/// 书包的上限与路径规则(docs/deskbook-standard.md §1;与 scripts/desk/deskbook-core.mjs 的 LIMITS、checkPath 同一套)。
enum DBRules {
    static let MB = 1024 * 1024
    static let totalBytes = 300 * MB
    static let bookJSONBytes = 2 * MB
    static let chapterBytes = 2 * MB
    static let imageBytes = 4 * MB
    static let videoBytes = 24 * MB
    static let chapters = 2000
    static let entries = 10000
    static let pathLength = 255
    static let formatVersion = 1

    enum FileKind { case book, chapter, image, video }

    /// 路径合规就返回 nil,否则一句说明。
    static func checkPath(_ p: String) -> String? {
        if p.isEmpty { return "路径为空" }
        if p.utf16.count > pathLength { return "路径超过 \(pathLength) 字符" }
        if p.contains("\\") { return "路径里有反斜杠" }
        if p.hasPrefix("/") { return "不许绝对路径" }
        if p.count >= 2, p.dropFirst().first == ":" { return "不许带盘符的路径" }
        var s = p
        if s.hasSuffix("/") { s.removeLast() }
        for seg in s.split(separator: "/", omittingEmptySubsequences: false) {
            if seg.isEmpty { return "路径里有空的一段" }
            if seg == "." || seg == ".." { return "不许 . 或 .. 段" }
            if seg.hasPrefix(".") { return "不许隐藏文件「\(seg)」" }
            if !seg.unicodeScalars.allSatisfy({ ("a"..."z").contains($0) || ("0"..."9").contains($0) || $0 == "." || $0 == "-" || $0 == "_" }) {
                return "「\(seg)」含不允许的字符"
            }
        }
        return nil
    }

    static func classify(_ p: String) -> FileKind? {
        if p == "book.json" { return .book }
        if p.hasPrefix("chapters/"), p.hasSuffix(".json") {
            let mid = p.dropFirst(9).dropLast(5)
            if mid.count >= 3, mid.allSatisfy(\.isASCII), mid.allSatisfy(\.isNumber) { return .chapter }
            return nil
        }
        if p.hasPrefix("media/"), p.count > 6 {
            let ext = (p as NSString).pathExtension
            if ["jpg", "png", "webp"].contains(ext) { return .image }
            if ext == "mp4" { return .video }
        }
        return nil
    }

    static func limit(_ k: FileKind) -> Int {
        switch k {
        case .book: return bookJSONBytes
        case .chapter: return chapterBytes
        case .image: return imageBytes
        case .video: return videoBytes
        }
    }

    /// 媒体引用(块里的 src / poster、book.json 的 cover…):必须是合规路径、在 media/ 下、是认得的类型。
    static func mediaPath(_ p: String?) -> String? {
        guard let p, !p.isEmpty, checkPath(p) == nil, let k = classify(p), k == .image || k == .video else { return nil }
        return p
    }
}

/// 只读的小 zip 读取器:按需从文件里取中央目录与单个条目,不把整个书包读进内存。
/// 只认存储(0)与 deflate(8);加密、分卷、符号链接、嵌套压缩包、路径不合规一律拒收;解压时按上限截停并核 CRC。
final class ZipReader {
    struct Entry {
        let name: String
        let method: UInt16
        let crc: UInt32
        let csize: UInt64
        let usize: UInt64
        let offset: UInt64
    }

    let fileSize: UInt64
    private(set) var entries: [String: Entry] = [:]
    /// 包里有、但书桌不认的文件(不解开,只记下)。
    private(set) var ignored: [String] = []
    private let fh: FileHandle

    init(url: URL) throws {
        guard let h = try? FileHandle(forReadingFrom: url) else { throw DeskbookError("文件打不开") }
        fh = h
        let size = (try? h.seekToEnd()) ?? 0
        fileSize = size
        if size > UInt64(DBRules.totalBytes) { throw DeskbookError("书包超过 300 MB") }
        if size < 22 { throw DeskbookError("不是书包:文件太短") }
        try parseDirectory()
    }

    deinit { try? fh.close() }

    private func read(_ off: UInt64, _ len: Int) throws -> [UInt8] {
        guard off + UInt64(len) <= fileSize else { throw DeskbookError("书包数据越界") }
        try fh.seek(toOffset: off)
        guard let d = try fh.read(upToCount: len), d.count == len else { throw DeskbookError("书包读到一半断了") }
        return [UInt8](d)
    }

    private static func u16(_ b: [UInt8], _ o: Int) -> UInt16 { UInt16(b[o]) | UInt16(b[o + 1]) << 8 }
    private static func u32(_ b: [UInt8], _ o: Int) -> UInt32 { UInt32(b[o]) | UInt32(b[o + 1]) << 8 | UInt32(b[o + 2]) << 16 | UInt32(b[o + 3]) << 24 }
    private static func u64(_ b: [UInt8], _ o: Int) -> UInt64 { UInt64(u32(b, o)) | UInt64(u32(b, o + 4)) << 32 }

    private func parseDirectory() throws {
        let tailLen = Int(min(fileSize, 22 + 65535 + 20))
        let base = fileSize - UInt64(tailLen)
        let tail = try read(base, tailLen)
        var eocd = -1
        var i = tailLen - 22
        while i >= 0 {
            if Self.u32(tail, i) == 0x06054b50, base + UInt64(i) + 22 + UInt64(Self.u16(tail, i + 20)) == fileSize { eocd = i; break }
            i -= 1
        }
        guard eocd >= 0 else { throw DeskbookError("不是书包:不是 zip 文件") }
        if Self.u16(tail, eocd + 4) != 0 || Self.u16(tail, eocd + 6) != 0 { throw DeskbookError("不支持分卷 zip") }
        var count = UInt64(Self.u16(tail, eocd + 10))
        var cdSize = UInt64(Self.u32(tail, eocd + 12))
        var cdOff = UInt64(Self.u32(tail, eocd + 16))
        if count == 0xffff || cdSize == 0xffffffff || cdOff == 0xffffffff {
            let loc = eocd - 20
            guard loc >= 0, Self.u32(tail, loc) == 0x07064b50 else { throw DeskbookError("zip64 结构不完整") }
            let zOff = Self.u64(tail, loc + 8)
            let z = try read(zOff, 56)
            guard Self.u32(z, 0) == 0x06064b50 else { throw DeskbookError("zip64 结构不完整") }
            count = Self.u64(z, 32); cdSize = Self.u64(z, 40); cdOff = Self.u64(z, 48)
        }
        if count > UInt64(DBRules.entries) { throw DeskbookError("条目超过 \(DBRules.entries) 个") }
        guard cdOff + cdSize <= fileSize, cdSize <= 16 * UInt64(DBRules.MB) else { throw DeskbookError("中央目录越界") }
        let cd = try read(cdOff, Int(cdSize))
        var p = 0
        var declared: UInt64 = 0
        for n in 0..<Int(count) {
            guard p + 46 <= cd.count, Self.u32(cd, p) == 0x02014b50 else { throw DeskbookError("中央目录第 \(n + 1) 条损坏") }
            let flags = Self.u16(cd, p + 8)
            let method = Self.u16(cd, p + 10)
            let crc = Self.u32(cd, p + 16)
            var csize = UInt64(Self.u32(cd, p + 20))
            var usize = UInt64(Self.u32(cd, p + 24))
            let nLen = Int(Self.u16(cd, p + 28)), xLen = Int(Self.u16(cd, p + 30)), cLen = Int(Self.u16(cd, p + 32))
            let disk = Self.u16(cd, p + 34)
            let ext = Self.u32(cd, p + 38)
            var off = UInt64(Self.u32(cd, p + 42))
            guard p + 46 + nLen + xLen + cLen <= cd.count else { throw DeskbookError("中央目录第 \(n + 1) 条越界") }
            guard let name = String(bytes: cd[(p + 46)..<(p + 46 + nLen)], encoding: .utf8) else { throw DeskbookError("第 \(n + 1) 条的文件名不是合法 UTF-8") }
            var x = p + 46 + nLen
            let xEnd = x + xLen
            while x + 4 <= xEnd {
                let id = Self.u16(cd, x), sz = Int(Self.u16(cd, x + 2))
                if id == 0x0001 {
                    var q = x + 4
                    if usize == 0xffffffff, q + 8 <= xEnd { usize = Self.u64(cd, q); q += 8 }
                    if csize == 0xffffffff, q + 8 <= xEnd { csize = Self.u64(cd, q); q += 8 }
                    if off == 0xffffffff, q + 8 <= xEnd { off = Self.u64(cd, q); q += 8 }
                }
                x += 4 + sz
            }
            p = xEnd + cLen
            if flags & 0x0001 != 0 || flags & 0x0040 != 0 { throw DeskbookError("「\(name)」是加密条目,书包不许加密") }
            if disk != 0 { throw DeskbookError("不支持分卷 zip") }
            if (ext >> 16) & 0xf000 == 0xa000 { throw DeskbookError("「\(name)」是符号链接,不收") }
            if let e = DBRules.checkPath(name) { throw DeskbookError("「\(name)」路径不合规:\(e)") }
            if name.hasSuffix("/") { continue }
            if entries[name] != nil { throw DeskbookError("「\(name)」在书包里出现了两次") }
            let lower = name.lowercased()
            if ["zip", "deskbook", "jar", "apk", "ipa", "epub", "docx", "xlsx", "pptx", "7z", "rar", "gz", "tgz"].contains((lower as NSString).pathExtension) {
                throw DeskbookError("「\(name)」是压缩包,书包里不许嵌套压缩包")
            }
            guard let kind = DBRules.classify(name) else { ignored.append(name); continue }
            if method != 0 && method != 8 { throw DeskbookError("「\(name)」的压缩方式不支持(只认存储与 deflate)") }
            if usize > UInt64(DBRules.limit(kind)) { throw DeskbookError("「\(name)」解开后超过上限 \(DBRules.limit(kind) / DBRules.MB) MB") }
            if method == 0 && csize != usize { throw DeskbookError("「\(name)」存储条目的大小前后不一") }
            if off + 30 + csize > cdOff { throw DeskbookError("「\(name)」的数据越界") }
            declared += usize
            if declared > UInt64(DBRules.totalBytes) { throw DeskbookError("解开后总量超过 300 MB") }
            entries[name] = Entry(name: name, method: method, crc: crc, csize: csize, usize: usize, offset: off)
        }
    }

    var unpackedBytes: UInt64 { entries.values.reduce(0) { $0 + $1.usize } }

    /// 解开一个条目放进内存(JSON、封面这类小文件)。
    func data(_ name: String) throws -> Data {
        guard let e = entries[name] else { throw DeskbookError("书包里没有「\(name)」") }
        var out = Data(capacity: Int(e.usize))
        try stream(e) { out.append($0.bindMemory(to: UInt8.self)) }
        return out
    }

    /// 解开一个条目写到文件(媒体)。边解边写,不整块进内存。
    func extract(_ name: String, to url: URL) throws {
        guard let e = entries[name] else { throw DeskbookError("书包里没有「\(name)」") }
        FileManager.default.createFile(atPath: url.path, contents: nil)
        guard let out = try? FileHandle(forWritingTo: url) else { throw DeskbookError("写不进本机存储") }
        defer { try? out.close() }
        try stream(e) { buf in try out.write(contentsOf: Data(buf)) }
    }

    private func stream(_ e: Entry, _ sink: (UnsafeRawBufferPointer) throws -> Void) throws {
        let lh = try read(e.offset, 30)
        guard Self.u32(lh, 0) == 0x04034b50 else { throw DeskbookError("「\(e.name)」的本地文件头损坏") }
        let start = e.offset + 30 + UInt64(Self.u16(lh, 26)) + UInt64(Self.u16(lh, 28))
        guard start + e.csize <= fileSize else { throw DeskbookError("「\(e.name)」的数据越界") }
        try fh.seek(toOffset: start)
        var crc = CRC32()
        var produced: UInt64 = 0
        let chunk = 256 * 1024
        func emit(_ b: UnsafeRawBufferPointer) throws {
            produced += UInt64(b.count)
            if produced > e.usize { throw DeskbookError("「\(e.name)」解开后比目录记载的大") }
            crc.update(b)
            try sink(b)
        }
        if e.method == 0 {
            var left = e.csize
            while left > 0 {
                let n = Int(min(UInt64(chunk), left))
                guard let d = try fh.read(upToCount: n), d.count == n else { throw DeskbookError("「\(e.name)」读到一半断了") }
                try d.withUnsafeBytes { try emit($0) }
                left -= UInt64(n)
            }
        } else {
            let sp = UnsafeMutablePointer<compression_stream>.allocate(capacity: 1)
            defer { sp.deallocate() }
            // COMPRESSION_ZLIB 在苹果的实现里就是裸 DEFLATE(RFC 1951),正是 zip 的 method 8
            guard compression_stream_init(sp, COMPRESSION_STREAM_DECODE, COMPRESSION_ZLIB) == COMPRESSION_STATUS_OK else { throw DeskbookError("解压器起不来") }
            defer { compression_stream_destroy(sp) }
            let src = UnsafeMutablePointer<UInt8>.allocate(capacity: chunk)
            let dst = UnsafeMutablePointer<UInt8>.allocate(capacity: chunk)
            defer { src.deallocate(); dst.deallocate() }
            var left = e.csize
            sp.pointee.src_size = 0
            var done = false
            while !done {
                if sp.pointee.src_size == 0 && left > 0 {
                    let n = Int(min(UInt64(chunk), left))
                    guard let d = try fh.read(upToCount: n), d.count == n else { throw DeskbookError("「\(e.name)」读到一半断了") }
                    d.copyBytes(to: src, count: n)
                    sp.pointee.src_ptr = UnsafePointer(src)
                    sp.pointee.src_size = n
                    left -= UInt64(n)
                }
                sp.pointee.dst_ptr = dst
                sp.pointee.dst_size = chunk
                let flags = left == 0 ? Int32(COMPRESSION_STREAM_FINALIZE.rawValue) : 0
                let st = compression_stream_process(sp, flags)
                let got = chunk - sp.pointee.dst_size
                if got > 0 { try emit(UnsafeRawBufferPointer(start: dst, count: got)) }
                switch st {
                case COMPRESSION_STATUS_END: done = true
                case COMPRESSION_STATUS_OK:
                    if left == 0 && sp.pointee.src_size == 0 && got == 0 { done = true }
                default: throw DeskbookError("「\(e.name)」解压失败(数据损坏)")
                }
            }
        }
        if produced != e.usize { throw DeskbookError("「\(e.name)」解开后的大小不对") }
        if crc.value != e.crc { throw DeskbookError("「\(e.name)」校验和不对(数据损坏)") }
    }
}

/// CRC-32(zip 用的那一种,多项式 0xEDB88320)。
struct CRC32 {
    private static let table: [UInt32] = (0..<256).map { i -> UInt32 in
        var c = UInt32(i)
        for _ in 0..<8 { c = c & 1 != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1 }
        return c
    }
    private var c: UInt32 = 0xffffffff
    mutating func update(_ b: UnsafeRawBufferPointer) {
        var x = c
        Self.table.withUnsafeBufferPointer { t in
            for byte in b { x = t[Int((x ^ UInt32(byte)) & 0xff)] ^ (x >> 8) }
        }
        c = x
    }
    var value: UInt32 { c ^ 0xffffffff }
}
