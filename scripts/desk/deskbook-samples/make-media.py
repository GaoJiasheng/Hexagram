# 观象 · 书桌 —— 示例书包的媒体(一次性生成,产物入库在各示例的 media/ 下)。
# 用法:python3 scripts/desk/deskbook-samples/make-media.py
# 图片用 PIL 直接画;动画先画成 GIF(放临时目录,GIF 不进包),再用我们自己的 `deskbook gif2mp4` 转成 mp4 + 封面图。
# 封面、题图不带文字(标准 §4);图解里只有 L、θ 一类字母标注。
import math, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
CLI = os.path.join(ROOT, '..', 'deskbook-cli.mjs')
PAPER = (247, 245, 238)
INK = (40, 44, 48)
SOFT = (170, 168, 160)
ACCENT = (46, 125, 134)
ACCENT2 = (199, 103, 63)


def font(size):
    for f in ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def out(name, sample):
    d = os.path.join(ROOT, sample, 'media')
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, name)


def save_jpg(img, path):
    img.convert('RGB').save(path, 'JPEG', quality=82, optimize=True, progressive=False)


def ss(img, scale):  # 超采样画、缩小存:线条平滑
    return img.resize((img.width // scale, img.height // scale), Image.LANCZOS)


# ── 示例书:单摆 ──

def cover_arcs(w, h, path, accent=ACCENT, accent2=ACCENT2, seed_angle=24):
    S = 2
    img = Image.new('RGB', (w * S, h * S), PAPER)
    d = ImageDraw.Draw(img)
    px, py = w * S // 2, int(h * S * 0.12)
    for i, r in enumerate(range(int(h * S * 0.2), int(h * S * 1.1), int(h * S * 0.07))):
        col = tuple(int(c + (255 - c) * (0.55 + 0.04 * i)) if i % 3 else c for c in accent)
        d.arc([px - r, py - r, px + r, py + r], 50, 130, fill=col, width=3 * S)
    a = math.radians(seed_angle)
    L = int(h * S * 0.62)
    bx, by = px + L * math.sin(a), py + L * math.cos(a)
    d.line([px, py, bx, by], fill=INK, width=3 * S)
    d.ellipse([px - 8 * S, py - 8 * S, px + 8 * S, py + 8 * S], fill=INK)
    R = int(w * S * 0.07)
    d.ellipse([bx - R, by - R, bx + R, by + R], fill=accent2)
    save_jpg(ss(img, S), path)


def geometry(path):
    S = 2
    W, H = 1200, 900
    img = Image.new('RGB', (W * S, H * S), PAPER)
    d = ImageDraw.Draw(img)
    f = font(44 * S)
    px, py, L = 600 * S, 110 * S, 600 * S
    a = math.radians(28)
    bx, by = px + L * math.sin(a), py + L * math.cos(a)
    # 竖直参考线(虚线)
    for y in range(py, py + L + 40 * S, 28 * S):
        d.line([px, y, px, min(y + 14 * S, py + L + 40 * S)], fill=SOFT, width=3 * S)
    # 摆过的弧
    d.arc([px - L, py - L, px + L, py + L], 90 - 34, 90 + 34, fill=SOFT, width=4 * S)
    # 角度小弧
    r = 150 * S
    d.arc([px - r, py - r, px + r, py + r], 90 - 28, 90, fill=ACCENT, width=5 * S)
    d.text((px + 34 * S, py + 160 * S), 'θ', font=f, fill=ACCENT)
    # 绳与支点
    d.rectangle([px - 120 * S, py - 26 * S, px + 120 * S, py - 10 * S], fill=INK)
    d.line([px, py, bx, by], fill=INK, width=5 * S)
    d.ellipse([px - 10 * S, py - 10 * S, px + 10 * S, py + 10 * S], fill=INK)
    d.text((px + 0.5 * L * math.sin(a) + 26 * S, py + 0.5 * L * math.cos(a) - 30 * S), 'L', font=f, fill=INK)
    # 摆球
    R = 40 * S
    d.ellipse([bx - R, by - R, bx + R, by + R], fill=ACCENT2)
    d.text((bx + R + 16 * S, by - 60 * S), 'm', font=f, fill=INK)
    # 重力与分解
    g = 210 * S

    def arrow(x0, y0, x1, y1, col):
        d.line([x0, y0, x1, y1], fill=col, width=5 * S)
        ang = math.atan2(y1 - y0, x1 - x0)
        h = 24 * S
        d.polygon([(x1, y1), (x1 - h * math.cos(ang - 0.4), y1 - h * math.sin(ang - 0.4)), (x1 - h * math.cos(ang + 0.4), y1 - h * math.sin(ang + 0.4))], fill=col)

    arrow(bx, by, bx, by + g, INK)
    d.text((bx - 70 * S, by + g - 30 * S), 'mg', font=f, fill=INK)
    t = g * math.sin(a)  # 切向分量,沿弧指回最低点
    arrow(bx, by, bx - t * math.cos(a), by + t * math.sin(a), ACCENT)
    d.text((bx - t * math.cos(a) - 250 * S, by + t * math.sin(a) + 10 * S), 'mg sinθ', font=f, fill=ACCENT)
    img = ss(img, S)
    img.save(path, 'PNG', optimize=True)


def energy(path):
    S = 2
    W, H = 1200, 700
    img = Image.new('RGB', (W * S, H * S), PAPER)
    d = ImageDraw.Draw(img)
    f = font(38 * S)
    x0, y0, x1, y1 = 120 * S, 80 * S, 1140 * S, 600 * S
    d.line([x0, y1, x1, y1], fill=INK, width=4 * S)
    d.line([x0, y0, x0, y1], fill=INK, width=4 * S)
    d.text((x1 - 30 * S, y1 + 16 * S), 't', font=f, fill=INK)
    d.text((x0 - 70 * S, y0 - 10 * S), 'E', font=f, fill=INK)
    n = 400
    pe, ke = [], []
    for i in range(n + 1):
        u = i / n
        x = x0 + (x1 - x0) * u
        c = math.cos(2 * math.pi * u * 2) ** 2  # 一个周期里势能两次到顶
        pe.append((x, y1 - (y1 - y0) * 0.9 * c))
        ke.append((x, y1 - (y1 - y0) * 0.9 * (1 - c)))
    d.line(pe, fill=ACCENT2, width=6 * S)
    d.line(ke, fill=ACCENT, width=6 * S)
    d.line([x0, y1 - (y1 - y0) * 0.9, x1, y1 - (y1 - y0) * 0.9], fill=SOFT, width=3 * S)
    d.rectangle([x1 - 300 * S, y0 - 50 * S, x1 - 270 * S, y0 - 20 * S], fill=ACCENT2)
    d.text((x1 - 255 * S, y0 - 62 * S), 'Ep', font=f, fill=INK)
    d.rectangle([x1 - 150 * S, y0 - 50 * S, x1 - 120 * S, y0 - 20 * S], fill=ACCENT)
    d.text((x1 - 105 * S, y0 - 62 * S), 'Ek', font=f, fill=INK)
    ss(img, S).save(path, 'PNG', optimize=True)


def pendulum_frames(w, h, specs, seconds, fps=25):
    # specs:[(支点 x, 支点 y, 摆长 px, 周期秒, 振幅度, 颜色)]
    frames = []
    S = 2
    for i in range(int(seconds * fps)):
        t = i / fps
        img = Image.new('RGB', (w * S, h * S), PAPER)
        d = ImageDraw.Draw(img)
        for (px, py, L, T, amp, col) in specs:
            px, py, L = px * S, py * S, L * S
            d.arc([px - L, py - L, px + L, py + L], 90 - amp - 3, 90 + amp + 3, fill=(222, 219, 210), width=2 * S)
            th = math.radians(amp) * math.cos(2 * math.pi * t / T)
            bx, by = px + L * math.sin(th), py + L * math.cos(th)
            d.rectangle([px - 50 * S, py - 12 * S, px + 50 * S, py - 4 * S], fill=INK)
            d.line([px, py, bx, by], fill=INK, width=3 * S)
            R = 15 * S
            d.ellipse([bx - R, by - R, bx + R, by + R], fill=col)
        frames.append(ss(img, S).convert('P', palette=Image.ADAPTIVE, colors=32))
    return frames


def save_gif(frames, path, fps=25):
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0, optimize=True)


def gif2mp4(gif, mp4):
    subprocess.run(['node', CLI, 'gif2mp4', gif, '-o', mp4], check=True)


# ── 示例:健身(深蹲火柴人) ──

def squat_frames(w, h, seconds=4, fps=25):
    frames = []
    S = 2
    for i in range(int(seconds * fps)):
        t = i / fps
        s = (1 - math.cos(2 * math.pi * t / seconds)) / 2  # 0 站立 → 1 蹲到底 → 0
        img = Image.new('RGB', (w * S, h * S), PAPER)
        d = ImageDraw.Draw(img)
        gy = int(h * 0.86) * S
        d.line([40 * S, gy, (w - 40) * S, gy], fill=SOFT, width=3 * S)
        ax, ay = w * 0.52 * S, gy - 6 * S
        shin, thigh, torso = 95 * S, 100 * S, 115 * S
        a = math.radians(32 * s)  # 小腿前倾
        b = math.radians(95 * s)  # 大腿自竖直向后转
        c = math.radians(40 * s)  # 躯干前倾
        kx, ky = ax + shin * math.sin(a), ay - shin * math.cos(a)
        hx, hy = kx - thigh * math.sin(b), ky - thigh * math.cos(b)
        sx, sy = hx + torso * math.sin(c), hy - torso * math.cos(c)
        arm = math.radians(10 + 75 * s)  # 手臂从下垂抬到前平
        ex, ey = sx + 95 * S * math.sin(arm), sy + 115 * S * math.cos(arm)
        wdt = 9 * S
        d.line([ax + 30 * S, ay, ax - 20 * S, ay], fill=INK, width=wdt)  # 脚
        d.line([ax, ay, kx, ky], fill=ACCENT, width=wdt)
        d.line([kx, ky, hx, hy], fill=ACCENT, width=wdt)
        d.line([hx, hy, sx, sy], fill=INK, width=wdt)
        d.line([sx, sy, ex, ey], fill=INK, width=7 * S)
        r = 22 * S
        hcx, hcy = sx + 30 * S * math.sin(c), sy - 30 * S * math.cos(c)
        d.ellipse([hcx - r, hcy - r, hcx + r, hcy + r], outline=INK, width=6 * S)
        for (x, y) in [(kx, ky), (hx, hy)]:
            d.ellipse([x - 8 * S, y - 8 * S, x + 8 * S, y + 8 * S], fill=ACCENT2)
        frames.append(ss(img, S).convert('P', palette=Image.ADAPTIVE, colors=32))
    return frames


def main():
    tmp = tempfile.mkdtemp(prefix='deskbook-media-')
    # 单摆
    cover_arcs(800, 1200, out('cover.jpg', 'sample-book'))
    cover_arcs(1200, 800, out('banner.jpg', 'sample-book'), seed_angle=-30)
    cover_arcs(1200, 800, out('head-001.jpg', 'sample-book'), accent=(120, 120, 120), seed_angle=12)
    geometry(out('pendulum-geometry.png', 'sample-book'))
    energy(out('energy.png', 'sample-book'))
    g1 = os.path.join(tmp, 'swing.gif')
    save_gif(pendulum_frames(480, 360, [(240, 40, 270, 2.0, 28, ACCENT2)], 4.0), g1)
    gif2mp4(g1, out('swing.mp4', 'sample-book'))
    g2 = os.path.join(tmp, 'two-lengths.gif')
    save_gif(pendulum_frames(640, 400, [(180, 40, 80, 2.0, 25, ACCENT), (440, 40, 320, 4.0, 25, ACCENT2)], 4.0), g2)
    gif2mp4(g2, out('two-lengths.mp4', 'sample-book'))
    # 健身
    cover_arcs(800, 1200, out('cover.jpg', 'sample-fitness'), accent=(70, 110, 160), accent2=(210, 140, 60), seed_angle=-18)
    g3 = os.path.join(tmp, 'squat.gif')
    save_gif(squat_frames(480, 480), g3)
    gif2mp4(g3, out('squat.mp4', 'sample-fitness'))
    print('GIF 原件(不进包):', tmp)
    for g in [g1, g2, g3]:
        print(f'  {os.path.basename(g)} {os.path.getsize(g) // 1024} KB')


if __name__ == '__main__':
    main()
