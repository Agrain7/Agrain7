#!/usr/bin/env python3
"""
참고 게임 화면(assets-src/reference/gameplay_reference.png)에서 배경 조각을 잘라 낸다.
(사용자 요청: "배경도 내가 보낸 일러대로 밝은 동양풍 실사 2D 느낌으로")

출력 (public/assets/scenery/):
  <dusk|mist>_sky.png      하늘 (참고 화면 하늘 결 + 같은 색 그라데이션), 1280×720
  moon.png                 달 (보이는 부분의 결로 원판 복원)
  <dusk|mist>_clouds.png   크림색 소용돌이 구름 띠 (가로 반복)
  <dusk|mist>_forest.png   절벽 아래 소나무·벚나무 숲 (중경, 가로 반복, 안개는 투명)
  bridge_top.png           돌다리 윗부분 (가로 반복)
  pavilion.png, banner_red.png, banner_pink.png   정자·현수막
사용법:  python3 tools/extract_scenery.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'reference', 'gameplay_reference.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'scenery')


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def up(arr, s):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return np.asarray(im.filter(ImageFilter.UnsharpMask(radius=2, percent=50, threshold=2)), np.float32)


def save(arr, name):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), optimize=True)
    print(name, arr.shape[1], 'x', arr.shape[0])


def mist_grade(rgba):
    out = rgba.copy()
    c = out[..., :3] / 255
    c = c * 0.62 + np.array([0.93, 0.92, 0.9]) * 0.38
    out[..., :3] = c * 255
    return out


def sky(ref):
    """하늘: 참고 화면 하늘색 그라데이션 + 하늘 결(구름 얼룩)을 크게 늘려 덮음"""
    W, H = 1280, 720
    top, mid, low, bot = np.array([86, 104, 160.]), np.array([120, 136, 190.]), np.array([176, 174, 210.]), np.array([234, 214, 206.])
    y = np.linspace(0, 1, H)[:, None, None]
    g = np.where(y < 0.4, top + (mid - top) * (y / 0.4), np.where(y < 0.72, mid + (low - mid) * ((y - 0.4) / 0.32), low + (bot - low) * ((y - 0.72) / 0.28)))
    g = np.broadcast_to(g, (H, W, 3)).copy()
    # 붓결: 참고 하늘처럼 큼직한 얼룩 (여러 크기의 부드러운 잡음, 가로로 이어지게)
    rng = np.random.default_rng(7)
    noise = np.zeros((H, W), np.float32)
    for cell, amp in ((180, 1.0), (90, 0.55), (40, 0.3), (16, 0.15)):
        gh, gw = H // cell + 3, W // cell
        grid = rng.standard_normal((gh, gw)).astype(np.float32)
        grid = np.concatenate([grid, grid[:, :1]], axis=1)  # 가로 이음
        im = Image.fromarray(grid).resize((W + cell, (gh - 1) * cell), Image.BICUBIC)
        noise += np.asarray(im, np.float32)[:H, :W] * amp
    noise /= np.abs(noise).max()
    k = (1 - smooth(0.5, 0.85, y))[..., 0]
    light = np.array([196, 196, 226.])
    t = np.clip(noise * 0.9, 0, 1)[..., None] * 0.35 * k[..., None]
    g = g * (1 - t) + light * t
    g *= (1 + np.clip(noise, -1, 0)[..., None] * 0.1 * k[..., None])
    return np.dstack([g, np.full((H, W), 255.)])


def moon(ref):
    """달: 참고 화면 달 왼쪽(구름 위·아래)의 결로 원판을 채우고 가장자리는 부드럽게"""
    S = 200
    tile = ref[368:398, 832:892].astype(np.float32)   # 달 윗부분 (구름·나무 없음)
    tile = np.concatenate([tile, tile[:, ::-1]], axis=1)
    tile = np.concatenate([tile, tile[::-1]], axis=0)
    t = np.tile(tile, (S // tile.shape[0] + 1, S // tile.shape[1] + 1, 1))[:S, :S]
    t = np.asarray(Image.fromarray(t.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), np.float32)
    # 무늬 반복이 드러나지 않게 결은 약하게, 바탕은 참고 달의 평균색
    base = tile.reshape(-1, 3).mean(axis=0)
    t = base + (t - base) * 0.55
    yy, xx = np.mgrid[0:S, 0:S]
    d = np.sqrt((xx - S / 2 + 0.5) ** 2 + (yy - S / 2 + 0.5) ** 2) / (S / 2 - 2)
    shade = 1 - 0.12 * smooth(0.55, 1.0, d)
    rgb = t * shade[..., None]
    a = (1 - smooth(0.97, 1.0, d)) * 255
    m = np.dstack([rgb, a])
    return up(m, 2.1)


def key_cloud(region, lum_min=178, chroma_max=58):
    """크림색 구름: 밝고 채도 낮은 부분 + 그 안의 선(구멍 메움)"""
    r = region.astype(np.float32)
    lum = r.mean(axis=2)
    chroma = r.max(axis=2) - r.min(axis=2)
    m = (lum > lum_min) & (chroma < chroma_max)
    m = ndimage.binary_closing(m, iterations=2)
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(m, lab, range(1, n + 1))
        m = lab == (np.argmax(sz) + 1)
    a = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), np.float32)
    return np.dstack([r, a])


def clouds(ref):
    c1 = up(key_cloud(ref[398:446, 640:906]), 2.1)     # 달 앞의 긴 소용돌이 구름
    c2 = up(key_cloud(ref[478:510, 902:1016]), 2.1)    # 폭포 앞 구름
    W, H = 2048, 260
    band = np.zeros((H, W, 4), np.float32)

    def put(c, x, y, flip=False, s=1.0):
        if flip:
            c = c[:, ::-1]
        if s != 1.0:
            c = np.asarray(Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).resize((round(c.shape[1] * s), round(c.shape[0] * s)), Image.LANCZOS), np.float32)
        h, w = c.shape[:2]
        for dx in (0, -W):
            x0, x1 = x + dx, x + dx + w
            sx0, sx1 = max(0, -x0), w - max(0, x1 - W)
            if sx1 <= sx0:
                continue
            X0 = max(0, x0)
            dst = band[y:y + h, X0:X0 + (sx1 - sx0)]
            src = c[:dst.shape[0], sx0:sx0 + dst.shape[1]]
            a = src[..., 3:4] / 255
            dst[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a)
            dst[..., 3:4] = np.maximum(dst[..., 3:4], src[..., 3:4])
    put(c1, 60, 40)
    put(c2, 760, 150, s=1.1)
    put(c1, 1180, 90, flip=True, s=0.8)
    put(c2, 1760, 30, flip=True, s=0.9)
    return band


def forest(ref):
    """절벽 아래 숲: 소나무(왼쪽 조각) + 소나무·벚나무(오른쪽 조각), 안개·하늘·폭포는 투명"""
    A = ref[548:642, 796:890].astype(np.float32)
    B = ref[548:642, 1318:1430].astype(np.float32)
    strip = np.concatenate([B, A, B[:, ::-1], A[:, ::-1]], axis=1)
    rgb = up(strip, 2.1)
    h = rgb.shape[0]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    bluish = smooth(4, 20, b - r) * smooth(-6, 8, b - g) * smooth(95, 130, lum)
    misty = smooth(160, 185, lum) * (1 - smooth(38, 60, chroma)) * (1 - smooth(10, 30, r - b))
    bluish = np.maximum(bluish, misty)
    y = np.arange(h)[:, None] / h
    keep_low = smooth(0.62, 0.86, y)  # 아래쪽(덤불·풀)은 안개도 남김
    a = 1 - bluish * (1 - keep_low)
    a *= smooth(0.0, 0.05, y)
    # 작은 얼룩 정리
    m = a > 0.5
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(m, lab, range(1, n + 1))
        a[np.isin(lab, [i + 1 for i, v in enumerate(sz) if v < 60])] = 0
    a = np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), np.float32)
    return np.dstack([rgb, a])


def bridge(ref):
    """돌다리 윗부분 (발 딛는 이끼 줄 아래 ~ 아치 위)"""
    band = ref[649:705, 690:1000].astype(np.float32)
    band = np.concatenate([band, band[:, ::-1]], axis=1)
    rgb = up(band, 2.0)
    a = np.full(rgb.shape[:2], 255.)
    return np.dstack([rgb, a])


def cutout(ref, poly, box, key_rows=None, scale=2.0):
    """다각형으로 잘라 낸 소품 (key_rows 범위 안의 하늘·꽃·구름 색은 투명)"""
    x0, y0, x1, y1 = box
    reg = ref[y0:y1, x0:x1].astype(np.float32)
    h, w = reg.shape[:2]
    m = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(m).polygon([((x - x0) * 4, (y - y0) * 4) for x, y in poly], fill=255)
    a = np.asarray(m.resize((w, h), Image.LANCZOS), np.float32) / 255
    if key_rows:
        r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
        lum = reg.mean(axis=2)
        chroma = reg.max(axis=2) - reg.min(axis=2)
        skyc = (b - r > 14) & (lum > 128)
        pink = (r > 190) & (r - g > 35) & (b > g)
        cloud = (lum > 200) & (chroma < 40)
        bg = skyc | pink | cloud
        rows = np.zeros(bg.shape, bool)
        for (ry0, ry1, rx0, rx1) in key_rows:
            rows[ry0 - y0:ry1 - y0, rx0 - x0:rx1 - x0] = True
        bg &= rows
        bg = ndimage.binary_opening(bg, iterations=1)
        a = a * (1 - bg)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5)), np.float32)
    im = np.dstack([reg, a])
    return up(im, scale)


def main():
    os.makedirs(OUT, exist_ok=True)
    ref = np.asarray(Image.open(SRC).convert('RGB'))
    s = sky(ref)
    save(s, 'dusk_sky.png')
    save(mist_grade(s), 'mist_sky.png')
    save(moon(ref), 'moon.png')
    c = clouds(ref)
    save(c, 'dusk_clouds.png')
    save(mist_grade(c), 'mist_clouds.png')
    f = forest(ref)
    save(f, 'dusk_forest.png')
    save(mist_grade(f), 'mist_forest.png')
    save(bridge(ref), 'bridge_top.png')
    pav = [(198, 549), (222, 536), (244, 522), (252, 507), (300, 504), (314, 521), (334, 535), (351, 546), (342, 556),
           (338, 600), (344, 622), (344, 643), (204, 643), (204, 622), (210, 600), (208, 557)]
    save(cutout(ref, pav, (190, 500, 356, 646), key_rows=[(500, 552, 190, 356), (552, 604, 190, 356)]), 'pavilion.png')
    save(cutout(ref, [(370, 417), (373, 417), (373, 430), (383, 430), (381, 435), (380, 496), (371, 507), (362, 496), (361, 435), (359, 430), (370, 430)],
                (356, 414, 386, 510), key_rows=[(414, 432, 356, 386)]), 'banner_red.png')
    save(cutout(ref, [(402, 424), (422, 424), (421, 480), (412, 491), (403, 480)], (398, 420, 424, 494), key_rows=[(420, 494, 398, 424)]), 'banner_pink.png')


if __name__ == '__main__':
    main()
