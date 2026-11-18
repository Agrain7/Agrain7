"""
추출한 영물 그림의 작은 보정(리터치) — 벌린 입 다물기.

원화의 아래턱을 떼어 경첩(입꼬리) 기준으로 위로 돌려 붙이고,
드러난 입 속(붉은 부분)은 주변 털 색으로 메운 뒤, 원화와 같은 먹선으로 입선을 그린다.
좌표는 모두 추출된 PNG(오른쪽을 바라봄, 여백 잘라낸 뒤)의 픽셀 좌표.

설정 예:
  'mouth': {
     'jaw':    [(x, y), ...],   # 아래턱 다각형 (입 속 붉은 부분은 제외)
     'cavity': [(x, y), ...],   # 지울 입 속 다각형 (혀·이빨 포함)
     'hinge':  (x, y),          # 입꼬리 (회전 중심)
     'angle':  23,              # 위로 돌릴 각도(도)
     'shift':  (0, 0),          # 회전 뒤 추가 이동
     'heal':   [(x, y), ...],   # 다문 뒤 털로 채워야 할 영역
     'lines':  [[(x, y), ...]], # 입선 등 먹선
     'width':  1.2,             # 먹선 굵기
  }
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 4  # 다각형·선 안티에일리어싱 배율


def _mask(w, h, polys, blur=0.0):
    m = Image.new('L', (w * SS, h * SS), 0)
    d = ImageDraw.Draw(m)
    for poly in polys:
        d.polygon([(x * SS, y * SS) for (x, y) in poly], fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m, np.float32) / 255.0


def _lines(w, h, lines, width, color, alpha=0.95):
    m = Image.new('L', (w * SS, h * SS), 0)
    d = ImageDraw.Draw(m)
    for ln in lines:
        pts = [(x * SS, y * SS) for (x, y) in ln]
        d.line(pts, fill=255, width=max(1, int(round(width * SS))), joint='curve')
        r = width * SS / 2
        for (x, y) in (pts[0], pts[-1]):
            d.ellipse([x - r * 0.6, y - r * 0.6, x + r * 0.6, y + r * 0.6], fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    a = np.asarray(m, np.float32)[..., None] / 255.0 * alpha
    return np.concatenate([np.broadcast_to(np.array(color, np.float32), (h, w, 3)) * a, a], axis=2)


def _rotate(pm, angle, center, shift):
    """premultiplied RGBA float 배열을 center 기준 angle(도, 반시계=위로) 회전 + 이동"""
    out = np.zeros_like(pm)
    for c in range(4):
        im = Image.fromarray(pm[..., c], 'F')
        im = im.rotate(angle, resample=Image.BICUBIC, center=center, translate=shift)
        out[..., c] = np.asarray(im, np.float32)
    out[..., 3] = np.clip(out[..., 3], 0, 1)
    out[..., :3] = np.clip(out[..., :3], 0, 1) * 1.0
    out[..., :3] = np.minimum(out[..., :3], out[..., 3:4])
    return out


def close_mouth(rgba: np.ndarray, cfg) -> np.ndarray:
    h, w = rgba.shape[:2]
    a = rgba[..., 3:4].astype(np.float32) / 255.0
    pm = np.concatenate([rgba[..., :3].astype(np.float32) / 255.0 * a, a], axis=2)

    jm = _mask(w, h, [cfg['jaw']])[..., None]
    cm = _mask(w, h, [cfg['cavity']])[..., None]
    jaw = pm * jm
    base = pm * (1 - np.maximum(jm, cm))
    rot = _rotate(jaw, cfg.get('angle', 0), cfg['hinge'], cfg.get('shift', (0, 0)))

    # 털 색: 주둥이 주변의 밝은 털 (불투명·밝은 픽셀의 상위값)
    ring = _mask(w, h, [cfg['heal']], blur=4.0) > 0.02
    opaque = (pm[..., 3] > 0.95) & ring & (cm[..., 0] < 0.1)
    col = pm[..., :3][opaque]
    lum = col.mean(axis=1)
    fur = np.array(cfg.get('fur') or col[lum >= np.percentile(lum, 80)].mean(axis=0), np.float32)
    if cfg.get('fur'):
        fur = fur / 255.0

    # 1) 털 바탕 (heal 영역) → 2) 원래 몸통 → 3) 돌린 아래턱 → 4) 먹선
    hm = _mask(w, h, [cfg['heal']], blur=0.4)[..., None]
    fill = np.concatenate([np.broadcast_to(fur, (h, w, 3)) * hm, hm], axis=2)
    out = base + fill * (1 - base[..., 3:4])
    # heal 영역 안에서는 지운 입 속 자리를 털이 덮도록 (몸통 위에)
    hole = (hm * cm)
    out = out * (1 - hole) + np.concatenate([np.broadcast_to(fur, (h, w, 3)), np.ones((h, w, 1), np.float32)], axis=2) * hole
    out = rot + out * (1 - rot[..., 3:4])
    ink = np.array(cfg.get('ink', (52, 34, 40)), np.float32) / 255.0
    ln = _lines(w, h, cfg.get('lines', []), cfg.get('width', 1.2), ink)
    out = ln + out * (1 - ln[..., 3:4])

    # 턱을 옮기고 남은 작은 털 조각 제거 (턱 주변에서만)
    from scipy import ndimage
    near = _mask(w, h, [cfg['jaw']], blur=3.0) > 0.01
    lab, n = ndimage.label(out[..., 3] > 0.25)
    if n:
        sizes = ndimage.sum(np.ones((h, w)), lab, range(1, n + 1))
        for i, sz in enumerate(sizes, start=1):
            if sz < 14 and near[lab == i].all():
                out[lab == i] = 0
    alpha = np.clip(out[..., 3:4], 0, 1)
    rgb = np.where(alpha > 1e-3, out[..., :3] / np.maximum(alpha, 1e-3), 0)
    res = np.concatenate([np.clip(rgb, 0, 1), alpha], axis=2)
    return (res * 255 + 0.5).astype(np.uint8)


def apply(rgba: np.ndarray, cfg) -> np.ndarray:
    if cfg.get('mouth'):
        rgba = close_mouth(rgba, cfg['mouth'])
    return rgba


def whiten(rgba: np.ndarray, polys, fur=(248, 242, 231), ink=(128, 78, 42)) -> np.ndarray:
    """다각형 안의 빈 곳(투명한 틈)을 흰 털로 채운다. 원래 그림(선·무늬)은 그 위에 그대로 남긴다.
    채운 영역이 바깥 투명과 맞닿는 곳에는 원화 같은 갈색 외곽선 1px."""
    from scipy import ndimage
    h, w = rgba.shape[:2]
    a = rgba[..., 3:4].astype(np.float32) / 255.0
    pm = np.concatenate([rgba[..., :3].astype(np.float32) / 255.0 * a, a], axis=2)
    m = _mask(w, h, polys, blur=0.5)[..., None]
    under = np.concatenate([np.broadcast_to(np.array(fur, np.float32) / 255, (h, w, 3)) * m, m], axis=2)
    out = pm + under * (1 - pm[..., 3:4])
    # 바깥 테두리 먹선
    inside = m[..., 0] > 0.5
    ring = ndimage.binary_dilation(inside, iterations=1) & ~inside & (rgba[..., 3] < 80)
    ring &= ndimage.binary_dilation(inside & (rgba[..., 3] < 200), iterations=1)
    col = np.array(ink, np.float32) / 255
    k = ring[..., None] * 0.85
    out = np.concatenate([col * k, k], axis=2) + out * (1 - k)
    alpha = np.clip(out[..., 3:4], 0, 1)
    rgb = np.where(alpha > 1e-3, out[..., :3] / np.maximum(alpha, 1e-3), 0)
    return (np.concatenate([np.clip(rgb, 0, 1), alpha], axis=2) * 255 + 0.5).astype(np.uint8)
