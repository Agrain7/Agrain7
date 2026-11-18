#!/usr/bin/env python3
"""
몬스터 그림 만들기 — 참고 화면의 산돼지(먹빛 몸·크림색 갈기·붉은 소용돌이 무늬)와 같은 분위기로,
영물 도감 원화를 '어둠에 물든 요괴' 색으로 바꾼다. (원화 자체는 사용자 제공, 색만 변환)

사용법:  python3 tools/extract_boar.py && python3 tools/make_monsters.py
출력:    public/assets/monsters/<id>.png  (오른쪽을 바라봄), monsters.json (크기)
"""
import colorsys
import json
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOUNTS = os.path.join(ROOT, 'public', 'assets', 'mounts')
OUT = os.path.join(ROOT, 'public', 'assets', 'monsters')



def hsl(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    l = (mx + mn) / 2
    d = mx - mn
    s = np.where(d < 1e-6, 0, d / np.maximum(1e-6, 1 - np.abs(2 * l - 1)))
    h = np.zeros_like(l)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0)
    gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0)
    bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2 + rc - bc, 4 + gc - rc))
    h = (h / 6) % 1
    return h, np.clip(s, 0, 1), l


def rgb_from(h, s, l):
    def f(n):
        k = (n + h * 12) % 12
        a = s * np.minimum(l, 1 - l)
        return l - a * np.maximum(-1, np.minimum(np.minimum(k - 3, 9 - k), 1))
    return np.stack([f(0), f(8), f(4)], axis=-1)


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hue_w(h, a, b, soft=12):
    """색상환 위 [a, b]도 구간 소속도 (가장자리 soft도에서 부드럽게)"""
    hd = h * 360
    c = ((a + b) / 2 if a <= b else ((a + b + 360) / 2) % 360)
    half = ((b - a) % 360) / 2
    d = np.abs((hd - c + 180) % 360 - 180)
    return 1 - smooth(half, half + soft, d)


def target(kind, l):
    """색 계열별 목표 색 (밝기 l 을 이어받아 명암 유지)"""
    if kind == 'char':      # 먹빛: 참고 산돼지 몸통
        return (0.74, 0.13, 0.09 + 0.27 * l)
    if kind == 'cream':     # 크림색 갈기
        return (0.09, 0.42, 0.66 + 0.28 * l)
    if kind == 'crimson':   # 진홍 (소용돌이·불꽃)
        return (0.995, 0.72, 0.24 + 0.32 * l)
    if kind == 'ember':     # 달아오른 균열 (주황빛 진홍)
        return (0.03, 0.85, 0.36 + 0.3 * l)
    if kind == 'stone':     # 이끼 낀 회색 돌
        return (0.2, 0.1, 0.2 + 0.5 * l)
    if kind == 'moss':
        return (0.22, 0.14, 0.2 + 0.42 * l)
    raise ValueError(kind)


def recolor(rgba, m):
    rgb = rgba[..., :3].astype(np.float32) / 255
    h, _, l = hsl(rgb)
    C = rgb.max(axis=2) - rgb.min(axis=2)
    w_out = 1 - smooth(0.14, 0.26, l)                      # 진한 외곽선: 그대로
    w_red = smooth(0.28, 0.42, C) * hue_w(h, 340, 18)
    w_gold = smooth(0.34, 0.5, C) * hue_w(h, 26, 66)
    w_blue = smooth(0.1, 0.24, C) * hue_w(h, *m.get('blue_hue', (150, 270)))
    rest = np.clip(1 - w_red - w_gold - w_blue, 0, 1)
    classes = [(w_red, m.get('red', 'crimson')), (w_gold, m.get('gold', 'crimson')), (w_blue, m['blue'])]
    neutral = m['neutral']
    if neutral == 'char_cream':  # 어두운 깃은 먹빛, 밝은 깃은 크림
        wc = smooth(0.74, 0.86, l)
        classes += [(rest * (1 - wc), 'char'), (rest * wc, 'cream')]
    elif m.get('cream_region'):  # 갈기·얼굴 영역의 밝은 털은 크림 (참고 산돼지처럼)
        hh, ww = l.shape
        reg = Image.new('L', (ww, hh), 0)
        ImageDraw.Draw(reg).polygon([(x * ww, y * hh) for x, y in m['cream_region']], fill=255)
        from PIL import ImageFilter
        reg = np.asarray(reg.filter(ImageFilter.GaussianBlur(ww * 0.03)), np.float32) / 255
        lo, hi = m.get('cream_l', (0.8, 0.9))
        wc = smooth(lo, hi, l) * reg
        classes += [(rest * (1 - wc), neutral), (rest * wc, 'cream')]
    else:
        classes.append((rest, neutral))
    acc = np.zeros(rgb.shape, np.float32)
    tot = np.zeros(l.shape, np.float32)
    for w, kind in classes:
        th, ts, tl = target(kind, l)
        col = rgb_from(np.full_like(l, th), np.full_like(l, ts), tl)
        acc += col * w[..., None]
        tot += w
    col = acc / np.maximum(tot, 1e-6)[..., None]
    col = col * (1 - w_out[..., None]) + rgb * 0.8 * w_out[..., None]
    res = rgba.copy()
    res[..., :3] = np.clip(col * 255 + 0.5, 0, 255).astype(np.uint8)
    return res


def swirls(rgba, spots, scale=1.0):
    """참고 몬스터의 붉은 소용돌이 무늬"""
    h, w = rgba.shape[:2]
    SS = 4
    lay = Image.new('L', (w * SS, h * SS), 0)
    d = ImageDraw.Draw(lay)
    for (cx, cy, r) in spots:
        cx, cy, r = cx * w * SS, cy * h * SS, r * w * SS
        pts = []
        turns = 1.7
        for i in range(60):
            t = i / 59
            ang = t * turns * 2 * np.pi
            rad = r * (0.15 + 0.85 * t)
            pts.append((cx + rad * np.cos(ang), cy + rad * np.sin(ang)))
        d.line(pts, fill=255, width=max(2, int(r * 0.32)), joint='curve')
    m = np.asarray(lay.resize((w, h), Image.LANCZOS), np.float32) / 255
    body = (rgba[..., 3] > 240).astype(np.float32)
    m *= body
    col = np.array([196, 44, 38], np.float32)
    out = rgba.astype(np.float32)
    out[..., :3] = out[..., :3] * (1 - m[..., None] * 0.9) + col * m[..., None] * 0.9
    return np.clip(out, 0, 255).astype(np.uint8)


def glow_eyes(rgba, eyes):
    h, w = rgba.shape[:2]
    out = rgba.astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    for (ex, ey, er) in eyes:
        d = np.sqrt((xx - ex * w) ** 2 + (yy - ey * h) ** 2) / max(1.0, er * w)
        k = np.clip(1.2 - d, 0, 1) * (rgba[..., 3] > 200)
        col = np.array([255, 196, 70], np.float32)
        out[..., :3] = out[..., :3] * (1 - k[..., None]) + col * k[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


MONSTERS = {
    # 어둠의 이리 (원거리 요괴) ← 늑대 성장체: 흰 털 → 먹빛, 푸른 불꽃 → 붉은 불꽃
    'fox': {'base': 'wolf_1', 'map': {'neutral': 'char', 'blue': 'crimson', 'cream_region': [(0.5, 0.05), (0.8, 0.0), (0.8, 0.62), (0.5, 0.7)], 'cream_l': (0.78, 0.9)}, 'swirls': [(0.34, 0.52, 0.06), (0.58, 0.5, 0.045)]},
    # 먹구름 까마귀 요괴 (비행) ← 매 성장체
    'bat': {'base': 'hawk_1', 'map': {'neutral': 'char_cream', 'blue': 'crimson'}, 'swirls': [(0.42, 0.42, 0.045)]},
    # 도깨비 짐승 (깡충) ← 해태 유체: 크림 몸 → 먹빛, 청록 곱슬 갈기 → 크림 갈기
    'dokkaebi': {'base': 'haetae_0', 'map': {'neutral': 'char', 'blue': 'cream'}, 'swirls': [(0.42, 0.64, 0.06), (0.63, 0.68, 0.045)]},
    # 바위 정령 ← 현무 성장체: 이끼 낀 돌 + 달아오른 균열
    'rock': {'base': 'hyeonmu_1', 'map': {'neutral': 'stone', 'blue': 'moss', 'blue_hue': (60, 260), 'gold': 'ember'}, 'swirls': []},
    # 흑운 산군 (보스) ← 백호 각성체: 흰 털 → 먹빛, 남색 줄무늬·푸른 눈·술 → 진홍
    'boss': {'base': 'baekho_2', 'map': {'neutral': 'char', 'blue': 'crimson', 'gold': 'ember', 'cream_region': [(0.56, 0.0), (0.86, 0.0), (0.84, 0.78), (0.6, 0.8)], 'cream_l': (0.8, 0.92)}, 'swirls': [(0.42, 0.58, 0.032)]},
}


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    boar = os.path.join(OUT, 'boar.png')
    if os.path.exists(boar):
        im = Image.open(boar)
        meta['boar'] = {'file': 'assets/monsters/boar.png', 'w': im.width, 'h': im.height, 'source': 'assets-src/reference/gameplay_reference.png'}
    for mid, cfg in MONSTERS.items():
        src = np.array(Image.open(os.path.join(MOUNTS, cfg['base'] + '.png')).convert('RGBA'))
        out = recolor(src, cfg['map'])
        if cfg.get('swirls'):
            out = swirls(out, cfg['swirls'])
        if cfg.get('eyes'):
            out = glow_eyes(out, cfg['eyes'])
        im = Image.fromarray(out)
        im.save(os.path.join(OUT, f'{mid}.png'), optimize=True)
        meta[mid] = {'file': f'assets/monsters/{mid}.png', 'w': im.width, 'h': im.height, 'base': cfg['base']}
    with open(os.path.join(OUT, 'monsters.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('monsters', {k: (v['w'], v['h']) for k, v in meta.items()})


if __name__ == '__main__':
    main()
