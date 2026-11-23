#!/usr/bin/env python3
# 观象 · 书桌 —— 正文字体子集。两种用法,字集同一套(「GB2312 全部汉字 + 全站 src/data 里出现过的字 + 标点与拉丁」):
#
# ① 随 App 带的宋体:思源宋体(Noto Serif SC,SIL OFL 1.1)全量每个字重约 15 MB,子集落到 apps/desk/Desk/Fonts/。
#    源字体从 npm 取(与网站用的 @fontsource/noto-serif-sc 同一款):
#      cd <临时目录> && npm pack @expo-google-fonts/noto-serif-sc && tar -xzf *.tgz
#      python3 scripts/desk/subset-fonts.py <临时目录>/package
#
# ② 按需下载的另外三款(楷 / 仿宋 / 手写,均 SIL OFL 1.1),子集落到 public/desk/v1/fonts/<id>.<内容哈希>.ttf
#    + fonts/index.json(App 读它列字体、显示大小、下载)+ 各款的许可证全文 <id>.OFL.txt。
#    源文件只从各自官方仓库的 release 取,放进 scripts/.cache/desk-fonts/ 下新建的目录(只是数据文件,不执行):
#      LXGWWenKai-Regular.ttf        https://github.com/lxgw/LxgwWenKai/releases       + OFL.txt → WenKai-OFL.txt
#      ZhuqueFangsong-Regular.ttf    https://github.com/TrionesType/zhuque/releases    + LICENSE.txt → Zhuque-LICENSE.txt
#      Xiaolai-Regular.ttf           https://github.com/lxgw/kose-font/releases        + OFL.txt → Xiaolai-OFL.txt
#      python3 scripts/desk/subset-fonts.py --ondemand scripts/.cache/desk-fonts/<目录>
#    OFL 规定改过的版本(子集就是改过)不得再用「保留字体名」:霞鹜文楷保留了「霞鹜」「LXGW」等名,
#    所以三款子集一律改名为 GuanxiangDesk-*(家族名「书桌楷体」等),版权与许可证条目原样保留。
#
# ③ 生僻字回落(随 App 带):思源宋体全量里也没有的字(多是扩展 B 区以后的,如《庄子》的「𩐈」)从字咪(Jigmo,
#    CC0 1.0,https://kamichikoichi.github.io/jigmo/ 官方 zip,放进 scripts/.cache/desk-fonts/ 下新建的目录)里只取这几个字,
#    落到 apps/desk/Desk/Fonts/GuanxiangDeskExt-Regular.ttf(几十 KB)。App 里每款正文字体的回落链最后都接上它。
#      python3 scripts/desk/subset-fonts.py --fallback scripts/.cache/desk-fonts/<目录>
#    要先跑 ① 再跑 ③(③ 只收 ① 的子集里没有的字)。
#
# 加了新书、出现了字体里原来没留的字,几种都重跑一遍即可。字体缺的字(朱雀仿宋还是技术预览版,只有一万多字)
# App 里按「回落到随带的宋体」处理(UIFontDescriptor 的 cascadeList),不会出豆腐块。
import sys, os, glob, json, hashlib
from fontTools import subset
from fontTools.ttLib import TTFont

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def charset():
    chars = set()
    for hi in range(0xB0, 0xF8):            # GB2312 一、二级汉字
        for lo in range(0xA1, 0xFF):
            try: chars.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError: pass
    for f in glob.glob(os.path.join(root, 'src/data/**/*.json'), recursive=True):
        with open(f, encoding='utf-8') as fh: chars.update(fh.read())
    chars.update(pack_text())
    chars.update(chr(c) for c in range(0x20, 0x7F))
    chars.update('，。、；：？！「」『』（）《》〈〉【】〔〕—…·～“”‘’〇○●◎△▲※→←↑↓×÷°′″％‰')
    return ''.join(sorted(c for c in chars if c >= ' '))


def pack_text():
    """书桌内容包(public/desk/v1/*.json,核心包与白话包)里的字:有的字只在包里出现(管线后来补的),src/data 扫不到。"""
    chars = set()
    for f in glob.glob(os.path.join(root, 'public/desk/v1/*.json')):
        with open(f, encoding='utf-8') as fh: raw = fh.read()
        try: raw = json.dumps(json.loads(raw), ensure_ascii=False)     # \uXXXX 转义还原成字
        except ValueError: pass
        chars.update(raw)
    return chars


def make_subset(src_file, text, opts=None):
    if opts is None:
        opts = subset.Options()
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
    font = subset.load_font(src_file, opts)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    return font, opts


def bundled(src):
    out = os.path.join(root, 'apps/desk/Desk/Fonts')
    os.makedirs(out, exist_ok=True)
    text = charset()
    print(f'留 {len(text)} 字')
    for name, file in (('Regular', '400Regular/NotoSerifSC_400Regular.ttf'), ('Bold', '700Bold/NotoSerifSC_700Bold.ttf')):
        font, opts = make_subset(os.path.join(src, file), text)
        dst = os.path.join(out, f'NotoSerifSC-{name}.ttf')
        subset.save_font(font, dst, opts)
        names = {n.nameID: n.toUnicode() for n in font['name'].names if n.nameID in (1, 4, 6)}
        print(dst, os.path.getsize(dst) // 1024, 'KB', names.get(6))


# 按需下载的三款。name:界面上的名字;family / ps:改名后的家族名与 PostScript 名(App 按 ps 取字体)。
ONDEMAND = [
    dict(id='kai', name='楷体', face='霞鹜文楷', src='LXGWWenKai-Regular.ttf', lic='WenKai-OFL.txt',
         family='GuanxiangDesk Kai', ps='GuanxiangDesk-Kai', zh='书桌楷体',
         upstream='https://github.com/lxgw/LxgwWenKai', licence='SIL Open Font License 1.1',
         copyright='© 2021–2026 LXGW;基于 Klee One © 2020 The Klee Project Authors'),
    dict(id='fangsong', name='仿宋', face='朱雀仿宋', src='ZhuqueFangsong-Regular.ttf', lic='Zhuque-LICENSE.txt',
         family='GuanxiangDesk Fangsong', ps='GuanxiangDesk-Fangsong', zh='书桌仿宋',
         upstream='https://github.com/TrionesType/zhuque', licence='SIL Open Font License 1.1',
         copyright='© 2023 Zhejiang JadeFoci Technology Co. Ltd.(TrionesType)'),
    dict(id='shou', name='手写', face='小赖字体', src='Xiaolai-Regular.ttf', lic='Xiaolai-OFL.txt',
         family='GuanxiangDesk Shouxie', ps='GuanxiangDesk-Shouxie', zh='书桌手写',
         upstream='https://github.com/lxgw/kose-font', licence='SIL Open Font License 1.1',
         copyright='© 2020–2024 LXGW;基于濑户字体 © 2014 Nozomi Seto'),
]


def rename(font, spec, version):
    """OFL 第 3 条:改过的版本不用保留字体名。换掉家族 / 全名 / PostScript 名 / 唯一 ID,其余(版权、许可证)原样。"""
    note = f'Subset of {spec["face"]} {version} for 观象 · 书桌; renamed per SIL OFL 1.1 §3'
    table = font['name']
    for rec in list(table.names):
        if rec.nameID in (1, 3, 4, 6, 16, 17, 18, 21, 22, 25):
            table.removeNames(nameID=rec.nameID)
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        table.setName(spec['family'], 1, pid, eid, lid)
        table.setName('Regular', 2, pid, eid, lid)
        table.setName(f'{spec["ps"]};{version}', 3, pid, eid, lid)
        table.setName(spec['family'], 4, pid, eid, lid)
        table.setName(spec['ps'], 6, pid, eid, lid)
    table.setName(spec['zh'], 1, 3, 1, 0x804)
    table.setName(spec['zh'], 4, 3, 1, 0x804)
    table.setName(note, 10, 3, 1, 0x409)
    if 'CFF ' in font:
        font['CFF '].cff.fontNames = [spec['ps']]


def ondemand(srcdir):
    out = os.path.join(root, 'public/desk/v1/fonts')
    os.makedirs(out, exist_ok=True)
    text = charset()
    print(f'留 {len(text)} 字')
    old = {f for f in os.listdir(out) if f.endswith('.ttf')}
    index = []
    for spec in ONDEMAND:
        src = os.path.join(srcdir, spec['src'])
        version = TTFont(src, lazy=True)['name'].getDebugName(5) or ''
        version = version.split(';')[0].replace('Version ', 'v').strip()
        font, opts = make_subset(src, text)
        have = set(font.getBestCmap().keys())
        rename(font, spec, version)
        tmp = os.path.join(out, f'{spec["id"]}.tmp.ttf')
        subset.save_font(font, tmp, opts)
        with open(tmp, 'rb') as fh: digest = hashlib.sha1(fh.read()).hexdigest()[:10]
        file = f'{spec["id"]}.{digest}.ttf'
        os.replace(tmp, os.path.join(out, file))
        old.discard(file)
        with open(os.path.join(srcdir, spec['lic']), encoding='utf-8') as fh: lic_text = fh.read()
        with open(os.path.join(out, f'{spec["id"]}.OFL.txt'), 'w', encoding='utf-8') as fh: fh.write(lic_text)
        size = os.path.getsize(os.path.join(out, file))
        han = sum(1 for c in text if ord(c) >= 0x3400)
        got = sum(1 for c in text if ord(c) >= 0x3400 and ord(c) in have)
        index.append(dict(id=spec['id'], name=spec['name'], face=spec['face'], ps=spec['ps'], file=file, bytes=size,
                          licence=spec['licence'], licenceFile=f'{spec["id"]}.OFL.txt', copyright=spec['copyright'],
                          upstream=spec['upstream'], version=version, glyphs=got))
        print(f'{file}  {size / 1048576:.1f} MB  {spec["face"]} {version}  汉字 {got}/{han}(缺的回落宋体)')
    for f in old: os.remove(os.path.join(out, f))          # 旧版本的子集删掉,免得越积越多
    with open(os.path.join(out, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'fonts': index}, fh, ensure_ascii=False, indent=1)
    print('→', os.path.relpath(os.path.join(out, 'index.json'), root))


FALLBACK = dict(src='Jigmo2.ttf', lic='LICENSE.txt', family='GuanxiangDesk Ext', ps='GuanxiangDeskExt-Regular', zh='书桌生僻字',
                face='字咪 Jigmo2')


def fallback(srcdir):
    """③ 随带宋体子集里没有的汉字(扩展区)从字咪里取。字咪是 CC0,改名只为与原版区分。"""
    out = os.path.join(root, 'apps/desk/Desk/Fonts')
    have = set(TTFont(os.path.join(out, 'NotoSerifSC-Regular.ttf')).getBestCmap().keys())
    # 只收汉字(基本区、扩展 A、扩展 B 以后);卦符 ䷀ 之类交系统字体
    han = lambda o: 0x3400 <= o <= 0x4DBF or 0x4E00 <= o <= 0x9FFF or 0x20000 <= o <= 0x323AF
    want = sorted(c for c in charset() if han(ord(c)) and ord(c) not in have)
    src = os.path.join(srcdir, FALLBACK['src'])
    cmap = TTFont(src, lazy=True).getBestCmap()
    got = ''.join(c for c in want if ord(c) in cmap)
    lost = [c for c in want if ord(c) not in cmap]
    font, opts = make_subset(src, got)
    version = (font['name'].getDebugName(5) or '').split(';')[0].replace('Version ', 'v').strip()
    rename(font, FALLBACK, version)
    font['name'].setName(f'Subset of Jigmo2 {version} (CC0 1.0) for 观象 · 书桌', 10, 3, 1, 0x409)
    dst = os.path.join(out, 'GuanxiangDeskExt-Regular.ttf')
    subset.save_font(font, dst, opts)
    with open(os.path.join(srcdir, FALLBACK['lic']), encoding='utf-8') as fh: lic = fh.read()
    with open(os.path.join(out, 'Jigmo-LICENSE.txt'), 'w', encoding='utf-8') as fh: fh.write(lic)
    print(f'{dst}  {os.path.getsize(dst) // 1024} KB  收 {len(got)} 字:{got}')
    if lost: print('字咪 Jigmo2 里也没有(还会是豆腐块):', ' '.join(f'{c} U+{ord(c):X}' for c in lost))


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--ondemand':
        ondemand(sys.argv[2])
    elif len(sys.argv) == 3 and sys.argv[1] == '--fallback':
        fallback(sys.argv[2])
    elif len(sys.argv) == 2:
        bundled(sys.argv[1])
    else:
        sys.exit(__doc__ or '用法见文件头')
