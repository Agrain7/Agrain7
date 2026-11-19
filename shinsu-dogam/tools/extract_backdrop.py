#!/usr/bin/env python3
"""
게임 화면 참고 이미지의 원경(절벽 위 궁궐·폭포·구름)을 잘라 패럴랙스 배경 층으로 만든다.
(사용자 요청: "배경 퀄리티를 내가 보낸 사진처럼")

- 참고 이미지 x 1000~1480, y 362~546 (달 오른쪽, 몬스터 체력바 위) 사용
- 오른쪽 위 '월하산맥 1-3' 표지판·일시정지 버튼 자리는 왼쪽 하늘(x 610~780)로 메운다
- 2.1배 확대 + 약한 선명화, 좌우 반전본을 이어 붙여 가로로 끊김 없이 반복
- 위는 하늘과, 아래는 근경 숲과 자연스럽게 섞이도록 투명하게 흐림
- 밤(night)·안개(mist) 판은 색 보정으로 만든다

사용법:  python3 tools/extract_backdrop.py
출력:    public/assets/backgrounds/<dusk|night|mist>_cliffs.png, public/assets/ui/portrait_haram.png (HUD 초상)
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'reference', 'gameplay_reference.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'backgrounds')

BOX = (1000, 362, 1480, 546)
PLAQUE = (1250, 362, 1480, 428)      # 표지판·버튼 (메울 곳)
SKY_SRC = (610, 362, 780, 428)       # 메울 때 쓸 하늘
SCALE = 2.1


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def build(ref: Image.Image) -> np.ndarray:
    img = np.asarray(ref.convert('RGB'), np.float32)
    x0, y0, x1, y1 = BOX
    a = img[y0:y1, x0:x1].copy()
    # 표지판 자리 메우기: 하늘 조각을 좌우 반전으로 이어 붙여 폭을 맞춤
    px0, py0, px1, py1 = PLAQUE
    sx0, sy0, sx1, sy1 = SKY_SRC
    sky = img[sy0:sy1, sx0:sx1]
    sky = np.concatenate([sky, sky[:, ::-1]], axis=1)
    need_w, need_h = px1 - px0, py1 - py0
    patch = sky[:need_h, :need_w]
    # 아래쪽 경계는 부드럽게 (절벽·첨탑 끝을 살림)
    yy = np.arange(need_h)[:, None]
    xx = np.arange(need_w)[None, :]
    w = (1 - smooth(need_h - 10, need_h, yy)) * smooth(0, 34, xx)
    region = a[py0 - y0:py1 - y0, px0 - x0:px1 - x0]
    a[py0 - y0:py1 - y0, px0 - x0:px1 - x0] = region * (1 - w[..., None]) + patch * w[..., None]
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    im = im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    arr = np.asarray(im, np.float32)
    # 이어 붙이기 (A | 반전 A) → 끊김 없는 가로 반복
    arr = np.concatenate([arr, arr[:, ::-1]], axis=1)
    h = arr.shape[0]
    y = np.arange(h)[:, None] / h
    alpha = smooth(0.0, 0.14, y) * (1 - smooth(0.8, 1.0, y))
    alpha = np.broadcast_to(alpha, arr.shape[:2]).copy()
    # 위쪽의 푸른 하늘은 투명하게 → 게임의 하늘·큰 달이 구름 사이로 보인다 (크림색 구름·궁궐 지붕은 남김)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    lum = (r + g + b) / 3
    blue = smooth(10, 28, b - r) * smooth(10, 22, b - g) * smooth(100, 125, lum)
    key = blue * (1 - smooth(0.22, 0.42, y))
    alpha *= 1 - key
    # 하늘에 남은 작은 얼룩 정리 (윗부분만)
    from scipy import ndimage
    top = (alpha > 0.4) & (y < 0.4)
    lab, n = ndimage.label(top)
    if n:
        sz = ndimage.sum(top, lab, range(1, n + 1))
        small = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v < 90])
        alpha[ndimage.binary_dilation(small, iterations=2) & (y < 0.4)] *= 0.0
    return np.dstack([arr, alpha * 255])


def grade(rgba: np.ndarray, kind: str) -> np.ndarray:
    out = rgba.copy()
    c = out[..., :3] / 255
    if kind == 'night':
        lum = c.mean(axis=2, keepdims=True)
        c = c * np.array([0.42, 0.46, 0.7]) + lum * np.array([0.02, 0.04, 0.1])
        # 궁궐 창의 붉은빛·금빛은 등불처럼 남김
        warm = np.clip((rgba[..., 0:1] - rgba[..., 2:3]) / 255 - 0.12, 0, 1) * 1.6
        c = c * (1 - warm) + (rgba[..., :3] / 255) * np.array([1.0, 0.82, 0.55]) * warm
    elif kind == 'mist':
        mist = np.array([0.93, 0.92, 0.9])
        c = c * 0.55 + mist * 0.45
    elif kind == 'sea':
        c = c * np.array([0.78, 0.98, 1.02]) + np.array([0.0, 0.04, 0.06])
        c = c * 0.85 + np.array([0.55, 0.85, 0.88]) * 0.15
    elif kind == 'fire':
        c = c * np.array([1.12, 0.84, 0.7]) + np.array([0.06, 0.0, 0.0])
        c = c * 0.88 + np.array([1.0, 0.62, 0.4]) * 0.12
    elif kind == 'paradise':
        c = c * 0.82 + np.array([1.0, 0.93, 0.9]) * 0.18
    elif kind == 'snow':
        l = c.mean(axis=2, keepdims=True)
        c = (c * 0.5 + l * 0.5) * 0.75 + np.array([0.86, 0.92, 1.0]) * 0.25
    out[..., :3] = np.clip(c * 255, 0, 255)
    return out


def portrait(ref: Image.Image) -> Image.Image:
    """HUD 초상: 참고 화면 왼쪽 위 금테 안의 소녀 얼굴 (원 안쪽만)"""
    cx, cy, rad = 89, 413, 33
    S = 4
    crop = ref.convert('RGB').crop((cx - rad, cy - rad, cx + rad, cy + rad)).resize((rad * 2 * S, rad * 2 * S), Image.LANCZOS)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=2, percent=50, threshold=2))
    m = Image.new('L', crop.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).ellipse((2, 2, crop.width - 3, crop.height - 3), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(1.5))
    crop.putalpha(m)
    return crop.resize((168, 168), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    ref = Image.open(SRC)
    ui = os.path.join(ROOT, 'public', 'assets', 'ui')
    os.makedirs(ui, exist_ok=True)
    portrait(ref).save(os.path.join(ui, 'portrait_haram.png'), optimize=True)
    base = build(ref)
    for kind in ('dusk', 'mist', 'sea', 'fire', 'paradise', 'snow'):  # 지역 테마별 (밤 판은 쓰지 않음)
        arr = base if kind == 'dusk' else grade(base, kind)
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
        im.save(os.path.join(OUT, f'{kind}_cliffs.png'), optimize=True)
        print(kind, im.size)


if __name__ == '__main__':
    main()
