#!/usr/bin/env python3
"""
참고 게임 화면(assets-src/reference/gameplay_reference.png)에서 청룡을 탄 소녀(라이더 하람)를 잘라 낸다.
(사용자 요청: "타고 있는 사람 모습도 내가 보낸 사진처럼")

- 소녀 외곽을 다각형으로 따고, 그 안에서 바깥과 이어진 하늘·청룡 색만 지운다
- 움직임용으로 두 층: 몸(body) / 뒤로 묶은 머리채(tail) — 같은 크기 캔버스라 겹치면 원래 그림
- 길게 휘날리는 띠는 게임이 그린다 (청룡 갈기와 겹쳐 잘라 낼 수 없음)

사용법:  python3 tools/extract_rider.py
출력:    public/assets/rider/haram_body.png, haram_tail.png, haram.json (안장·머리채 회전점·얼굴)
"""
import json
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'reference', 'gameplay_reference.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'rider')
S = 4        # 처리 배율
SAVE = 1.4   # 저장 배율 (참고 화면 픽셀 대비)
BOX = (490, 448, 618, 600)

GIRL = [(496, 488), (503, 482), (515, 482), (524, 474), (530, 463), (540, 457), (552, 454), (558, 458), (565, 468), (575, 465),
        (585, 463), (593, 470), (600, 479), (605, 490), (604, 502), (601, 512), (597, 521), (592, 520), (590, 526), (600, 532),
        (608, 534), (612, 541), (606, 548), (596, 549), (591, 552), (600, 556), (611, 560), (612, 570), (600, 577), (591, 580),
        (588, 591), (580, 595), (570, 593), (566, 585), (558, 580), (545, 580), (538, 575), (534, 566), (531, 556), (528, 548),
        (529, 534), (536, 526), (546, 520), (549, 512), (545, 505), (533, 506), (520, 503), (508, 500), (498, 496)]
TAIL = [(492, 486), (503, 480), (515, 480), (524, 472), (533, 468), (538, 480), (539, 496), (533, 506), (520, 504), (508, 501), (496, 498)]
SEAT = (552, 573)        # 안장에 닿는 엉덩이
TAIL_PIVOT = (536, 484)  # 머리채가 묶인 곳
FACE = (581, 497, 24)    # 얼굴 중심·반지름 (HUD 초상용)


def poly_mask(w, h, poly, x0, y0):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon([((x - x0) * S, (y - y0) * S) for x, y in poly], fill=255)
    return np.array(m) > 127


def main():
    os.makedirs(OUT, exist_ok=True)
    ref = np.array(Image.open(SRC).convert('RGB'))
    x0, y0, x1, y1 = BOX
    up = np.array(Image.fromarray(ref[y0:y1, x0:x1]).resize(((x1 - x0) * S, (y1 - y0) * S), Image.BICUBIC)).astype(np.float32)
    h, w = up.shape[:2]
    girl = poly_mask(w, h, GIRL, x0, y0)
    r, g, b = up[..., 0], up[..., 1], up[..., 2]
    lum = up.mean(axis=2)
    chroma = up.max(axis=2) - up.min(axis=2)
    sky = (b - r > 12) & (lum > 120) & (chroma < 90)
    teal = (g - r > 18) & (b - r > 18)                     # 청룡 몸 (푸른 비늘)
    cand = (sky | teal) | ~girl
    lab, _ = ndimage.label(cand)
    outside = np.unique(lab[~girl])
    bg = np.isin(lab, outside[outside > 0])
    # 머리카락 사이에 갇힌 하늘 조각도 지운다
    strong = (b - r > 22) & (lum > 140) & (chroma > 18) & (chroma < 95)
    sl, sn = ndimage.label(strong)
    if sn:
        ssz = ndimage.sum(strong, sl, range(1, sn + 1))
        bg |= np.isin(sl, [i + 1 for i, v in enumerate(ssz) if v >= 2 * S * S])
    fg = girl & ~bg
    fg = ndimage.binary_opening(fg, iterations=1)
    lab2, n2 = ndimage.label(fg)
    if n2 > 1:
        sz = ndimage.sum(fg, lab2, range(1, n2 + 1))
        fg = lab2 == (np.argmax(sz) + 1)
    holes = ndimage.binary_fill_holes(fg) & ~fg
    hl, hn = ndimage.label(holes)
    for i in range(1, hn + 1):
        m = hl == i
        if cand[m].mean() < 0.5:
            fg |= m
    a = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)), np.float32)
    a = np.clip((a - 40) * 1.4, 0, 255)
    tail = poly_mask(w, h, TAIL, x0, y0)
    tail_soft = np.asarray(Image.fromarray((tail * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
    k = SAVE / S
    out_w, out_h = round(w * k), round(h * k)

    def save(alpha, name):
        im = Image.fromarray(np.dstack([up, alpha]).astype(np.uint8)).resize((out_w, out_h), Image.LANCZOS)
        im.save(os.path.join(OUT, name), optimize=True)

    save(a * (1 - tail_soft), 'haram_body.png')
    save(a * tail_soft, 'haram_tail.png')
    P = lambda p: [round((p[0] - x0) * SAVE, 1), round((p[1] - y0) * SAVE, 1)]
    meta = {'w': out_w, 'h': out_h, 'seat': P(SEAT), 'tailPivot': P(TAIL_PIVOT), 'face': P(FACE[:2]) + [round(FACE[2] * SAVE, 1)],
            'waist': P((532, 546)), 'source': 'assets-src/reference/gameplay_reference.png', 'box': BOX}
    with open(os.path.join(OUT, 'haram.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('rider', out_w, out_h, meta)


if __name__ == '__main__':
    main()
