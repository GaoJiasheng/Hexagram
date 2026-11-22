#!/usr/bin/env python3
# 观象 · 书桌 —— 正文字体子集。思源宋体(Noto Serif SC,SIL OFL 1.1)全量每个字重约 15 MB,
# 这里只留「GB2312 全部汉字 + 全站 src/data 里出现过的字 + 标点与拉丁」,落到 apps/desk/Desk/Fonts/。
# 源字体从 npm 取(与网站用的 @fontsource/noto-serif-sc 同一款):
#   cd <临时目录> && npm pack @expo-google-fonts/noto-serif-sc && tar -xzf *.tgz
#   python3 scripts/desk/subset-fonts.py <临时目录>/package
# 加了新书、出现了字体里原来没留的字,重跑一遍即可。
import sys, os, glob
from fontTools import subset

src = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = os.path.join(root, 'apps/desk/Desk/Fonts')
os.makedirs(out, exist_ok=True)

chars = set()
for hi in range(0xB0, 0xF8):            # GB2312 一、二级汉字
    for lo in range(0xA1, 0xFF):
        try: chars.add(bytes([hi, lo]).decode('gb2312'))
        except UnicodeDecodeError: pass
for f in glob.glob(os.path.join(root, 'src/data/**/*.json'), recursive=True):
    with open(f, encoding='utf-8') as fh: chars.update(fh.read())
chars.update(chr(c) for c in range(0x20, 0x7F))
chars.update('，。、；：？！「」『』（）《》〈〉【】〔〕—…·～“”‘’〇○●◎△▲※→←↑↓×÷°′″％‰')
chars = {c for c in chars if c >= ' '}
text = ''.join(sorted(chars))
print(f'留 {len(text)} 字')

for name, file in (('Regular', '400Regular/NotoSerifSC_400Regular.ttf'), ('Bold', '700Bold/NotoSerifSC_700Bold.ttf')):
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(os.path.join(src, file), opts)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    dst = os.path.join(out, f'NotoSerifSC-{name}.ttf')
    subset.save_font(font, dst, opts)
    names = {n.nameID: n.toUnicode() for n in font['name'].names if n.nameID in (1, 4, 6)}
    print(dst, os.path.getsize(dst) // 1024, 'KB', names.get(6))
