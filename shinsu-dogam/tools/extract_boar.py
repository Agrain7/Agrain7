#!/usr/bin/env python3
"""
게임 화면 참고 이미지(assets-src/reference/gameplay_reference.png)의 가운데 산돼지 몬스터를
투명 배경 PNG로 잘라 낸다 (사용자 요청: "몬스터도 저 사진에 있는 몬스터로").

배경(하늘·폭포·이끼 낀 땅)은 색 분류 + 바깥과 이어진 영역만 지우는 방식,
그림 안쪽에 갇힌 하늘 조각(배 밑·꼬리 고리)도 지운다. 원본이 작아서 4배 확대 후 처리하고 2배로 저장.

사용법:  python3 tools/extract_boar.py
출력:    public/assets/monsters/boar.png  (오른쪽을 바라봄)
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'reference', 'gameplay_reference.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'monsters')
S = 4      # 처리 배율
SAVE = 2   # 저장 배율

BOAR = {
    'box': (1030, 558, 1172, 656),
    'floor': 649,  # 발바닥 선 (아래는 땅)
    'poly': [(1038, 616), (1042, 602), (1049, 588), (1056, 584), (1062, 579), (1072, 572), (1080, 567), (1086, 573), (1093, 568),
             (1100, 563), (1104, 571), (1112, 571), (1120, 574), (1128, 577), (1138, 580), (1146, 586), (1150, 592), (1153, 587),
             (1156, 581), (1163, 582), (1168, 588), (1166, 595), (1160, 600), (1156, 606), (1152, 616), (1150, 624), (1154, 636),
             (1158, 648), (1157, 650), (1146, 650), (1136, 644), (1128, 638), (1118, 638), (1108, 644), (1104, 650), (1092, 650),
             (1086, 644), (1076, 645), (1070, 650), (1056, 650), (1052, 642), (1048, 632), (1042, 628)],
    'holes': [(1158, 590, 2.5)],  # 꼬리 고리 안쪽
}


def extract(ref: np.ndarray, c) -> Image.Image:
    x0, y0, x1, y1 = c['box']
    crop = ref[y0:y1, x0:x1]
    up = np.array(Image.fromarray(crop).resize(((x1 - x0) * S, (y1 - y0) * S), Image.BICUBIC)).astype(np.float32)
    h, w = up.shape[:2]
    pm = Image.new('L', (w, h), 0)
    ImageDraw.Draw(pm).polygon([((px - x0) * S, (py - y0) * S) for px, py in c['poly']], fill=1)
    pm = np.array(pm).astype(bool)
    dil = ndimage.binary_dilation(pm, iterations=3 * S)
    below = np.zeros((h, w), bool)
    below[int((c['floor'] - y0) * S):] = True
    dil &= ~below
    r, g, b = up[..., 0], up[..., 1], up[..., 2]
    lum = (r + g + b) / 3
    sky = (b - r > 6) & (lum > 110)
    moss = (g > b + 12) & (g >= r - 6) & (lum > 70) & (r - b < 70) & ~(r > g + 15)
    ground = (r > 140) & (g > 125) & (b < 130) & (r - b > 45) & (np.abs(r - g) < 45)
    cand = sky | moss | ground | ~dil
    lab, _ = ndimage.label(cand)
    outside = np.unique(lab[~dil])
    bg = np.isin(lab, outside[outside > 0])
    strong = (b - r > 12) & (lum > 165)
    sl, sn = ndimage.label(strong)
    if sn:
        ssz = ndimage.sum(strong, sl, range(1, sn + 1))
        bg |= np.isin(sl, [i + 1 for i, v in enumerate(ssz) if v >= 3 * S * S])
    fg = dil & ~bg
    fg = ndimage.binary_opening(fg, iterations=1)
    lab2, n2 = ndimage.label(fg)
    if n2 > 1:
        sz = ndimage.sum(fg, lab2, range(1, n2 + 1))
        keep = np.zeros(n2 + 1, bool)
        for i, s in enumerate(sz, 1):
            keep[i] = s >= max(200, sz.max() * 0.01)
        fg = keep[lab2]
    holes = ndimage.binary_fill_holes(fg) & ~fg
    hl, hn = ndimage.label(holes)
    for i in range(1, hn + 1):
        m = hl == i
        if cand[m].mean() < 0.5:
            fg |= m
    yy, xx = np.mgrid[0:h, 0:w]
    for (hx, hy, rad) in c.get('holes', []):
        fg &= ((xx - (hx - x0) * S) ** 2 + (yy - (hy - y0) * S) ** 2) > (rad * S) ** 2
    a = np.array(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32)
    a = np.clip((a - 40) * 1.4, 0, 255)
    rgba = np.dstack([up, a]).astype(np.uint8)
    im = Image.fromarray(rgba)
    bb = im.getbbox()
    im = im.crop((max(0, bb[0] - 4), max(0, bb[1] - 4), min(w, bb[2] + 4), min(h, bb[3] + 4)))
    im = im.resize((round(im.width * SAVE / S), round(im.height * SAVE / S)), Image.LANCZOS)
    return im.transpose(Image.FLIP_LEFT_RIGHT)


def main():
    os.makedirs(OUT, exist_ok=True)
    ref = np.array(Image.open(SRC).convert('RGB'))
    im = extract(ref, BOAR)
    im.save(os.path.join(OUT, 'boar.png'), optimize=True)
    print('boar', im.size)


if __name__ == '__main__':
    main()
