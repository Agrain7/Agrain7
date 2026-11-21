#!/usr/bin/env python3
"""
영물 도감 원본 일러스트(assets-src/reference/beasts_codex.png)에서
9종 x 3단계 영물 그림을 잘라 투명 배경 PNG로 저장한다.

사용법:  python3 tools/extract_beasts.py
출력:    public/assets/mounts/<id>_<stage>.png  (오른쪽을 바라보도록 좌우 반전)
         public/assets/mounts/beasts.json       (크기 정보)
         assets-src/beasts_preview.png          (검수용 미리보기)

원본은 사용자 제공 이미지이며, 그림 자체는 수정하지 않고 배경만 제거한다.
"""
import json
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import retouch  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'reference', 'beasts_codex.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'mounts')

# (id, stage) -> 잘라낼 상자 (x0, y0, x1, y1), 지울 사각형(단계 화살표/테두리)
BEASTS = {
    ('cheongryong', 0): {'box': (100, 158, 233, 292)},
    ('cheongryong', 1): {'box': (254, 118, 449, 298)},
    ('cheongryong', 2): {'box': (440, 107, 744, 304), 'erase': [(436, 222, 474, 252), (684, 107, 744, 128)]},
    ('baekho', 0): {'box': (98, 380, 222, 496)},
    ('baekho', 1): {'box': (238, 352, 426, 501)},
    ('baekho', 2): {'box': (440, 328, 744, 504)},
    ('jujak', 0): {'box': (855, 172, 963, 297)},
    ('jujak', 1): {'box': (968, 124, 1185, 302), 'erase': [(966, 222, 992, 250)]},
    ('jujak', 2): {'box': (1186, 107, 1516, 304), 'erase': [(1180, 222, 1207, 252), (1452, 107, 1516, 132)]},
    ('hyeonmu', 0): {'box': (851, 400, 966, 496)},
    ('hyeonmu', 1): {'box': (994, 344, 1173, 502), 'erase': [(990, 420, 1000, 450)]},
    ('hyeonmu', 2): {'box': (1203, 327, 1516, 507)},
    # 'fill': 얼굴·턱의 흰 털이 종이색과 같고 외곽선이 끊겨 있어 배경으로 잘못 지워지는 곳 → 다각형 안을 그림으로 채운다
    ('girin', 0): {'box': (108, 576, 242, 726), 'fill': [[(117, 644), (122, 638), (132, 627), (142, 621), (152, 624), (160, 620), (168, 614), (178, 616), (186, 621), (192, 627), (189, 632), (196, 637), (192, 642), (197, 648), (191, 653), (193, 658), (184, 660), (175, 662), (160, 664), (148, 664), (140, 667), (132, 664), (124, 660), (118, 652)]]},
    ('girin', 1): {'box': (258, 534, 451, 730)},
    ('girin', 2): {'box': (469, 532, 744, 731), 'erase': [(466, 640, 472, 670)],
                   'fill': [[(478, 582), (485, 572), (492, 565), (505, 560), (520, 555), (535, 553), (545, 560), (550, 575), (546, 590), (538, 598), (527, 600), (522, 620), (521, 640), (505, 645), (500, 625), (500, 605), (496, 599), (485, 601), (472, 600), (467, 597), (471, 589)]]},
    ('bonghwang', 0): {'box': (103, 820, 206, 940)},
    ('bonghwang', 1): {'box': (212, 776, 384, 966), 'erase': [(205, 865, 230, 902), (370, 864, 395, 902)]},
    ('bonghwang', 2): {'box': (392, 754, 662, 990), 'erase': [(624, 952, 680, 1000), (598, 754, 662, 778)]},
    ('haetae', 0): {'box': (854, 598, 979, 716)},
    ('haetae', 1): {'box': (996, 562, 1186, 723)},
    ('haetae', 2): {'box': (1189, 532, 1516, 725), 'erase': [(1184, 638, 1209, 670)]},
    ('wolf', 0): {'box': (700, 843, 796, 941)},
    ('wolf', 1): {'box': (796, 820, 922, 939), 'erase': [(794, 888, 813, 914)]},
    ('wolf', 2): {'box': (916, 796, 1096, 977), 'erase': [(913, 884, 942, 914), (913, 936, 960, 992)]},
    ('hawk', 0): {'box': (1107, 843, 1193, 933)},
    ('hawk', 1): {'box': (1196, 816, 1311, 936), 'erase': [(1194, 884, 1212, 912)]},
    ('hawk', 2): {'box': (1307, 769, 1517, 960), 'erase': [(1305, 884, 1332, 914), (1300, 937, 1367, 992)]},
}

T_BG = 30.0      # 이 거리 이내 = 확실한 배경
T_SOFT = 70.0    # 배경~전경 사이 부드러운 경계
SHADOW_MAX = 85.0  # 배경과 같은 계열(베이지)의 그림자 허용 거리


# 벌린 입 다물기 리터치 (추출된 PNG 좌표, tools/retouch.py) — 사용자 요청: 늑대·백호는 입을 다문 모습
MOUTHS = {
    ('wolf', 2): {'cavity': [(146, 49), (152, 50), (160, 53), (166, 54), (167, 58), (164, 62), (157, 64), (151, 63), (148, 58), (146, 53)], 'jaw': [(147, 58), (150, 63), (156, 65), (163, 63), (166, 60), (169, 64), (166, 70), (160, 73), (152, 75), (145, 73), (142, 66), (144, 60)], 'hinge': (146, 54), 'angle': 22, 'heal': [(144, 48), (152, 49), (160, 52), (168, 53), (168, 58), (160, 61), (150, 61), (144, 57)], 'lines': [[(148, 54), (154, 55.5), (160, 56.5), (166, 56.5)]], 'width': 1.1},
    ('baekho', 0): {'cavity': [(89, 56.5), (96, 56.5), (101, 58), (103, 61), (102, 66), (98, 69.5), (92, 69.5), (89, 66)], 'jaw': [(88.5, 67), (92, 70), (98, 70), (101, 66), (104, 66), (104.5, 72), (100, 77), (92, 78), (87.5, 74)], 'hinge': (89, 59), 'angle': 30, 'heal': [(88, 56), (101, 56), (110, 57.5), (110, 60), (102, 63.5), (92, 63.5), (88, 61)], 'lines': [[(90.5, 59), (95, 60.5), (100, 61), (105, 59.6)]], 'width': 1.0},
    ('baekho', 1): {'cavity': [(154, 52), (160, 51), (166, 52), (171, 55), (173, 60), (174.5, 66), (169, 70.5), (160, 70.5), (156, 66), (154, 58)], 'jaw': [(153.5, 65), (158, 70), (166, 71), (172, 68), (175.5, 67), (175.5, 73), (170, 79), (162, 82), (155, 81), (151, 75)], 'hinge': (155, 56), 'angle': 27, 'heal': [(153, 51), (166, 51), (172, 55), (180, 55.5), (180, 58), (172, 62.5), (160, 64.5), (153, 62)], 'lines': [[(156, 57.5), (162, 60), (168, 61), (174, 59.5), (178, 57.5)]], 'width': 1.1},
    ('baekho', 2): {'cavity': [(263, 58), (270, 56.5), (278, 57), (281.5, 60), (283.5, 66), (285.5, 72), (285.5, 79), (278, 80.5), (268, 79.5), (263, 72), (262, 64)], 'jaw': [(266, 74), (270, 80), (276, 81), (283, 80), (285.5, 73), (288.5, 77), (286.5, 84), (282, 90), (276, 93.5), (268, 93.5), (265, 86)], 'hinge': (264, 62), 'angle': 20, 'shift': (0, -5), 'heal': [(262, 56.5), (270, 55.5), (280, 56.5), (295, 57), (295, 60), (286, 64.5), (277, 69), (271, 75), (268, 84), (263, 88), (258, 83), (259, 70), (261, 64)], 'lines': [[(265, 61.5), (271, 64.5), (278, 66), (285, 65), (291, 61.5)], [(259, 84), (263, 87.5), (268, 85)]], 'width': 1.2},
}

# 기린 턱·수염·목 아래의 빈 틈을 흰 털로 채움 (추출된 PNG 좌표) — 사용자 요청: "턱쪽을 아예 하얗게"
WHITEN = {
    ('girin', 0): [[(78, 58), (118, 55), (122, 60), (116, 67), (112, 74), (108, 81), (100, 86), (88, 86), (79, 81), (74, 70)]],
    ('girin', 1): [[(138, 60), (160, 63), (176, 61), (189, 58), (187, 68), (181, 75), (177, 83), (168, 88), (156, 88), (147, 94), (139, 91), (134, 78)]],
    ('girin', 2): [[(230, 56), (250, 55), (262, 56), (269, 54), (267, 64), (259, 71), (253, 83), (247, 97), (238, 101), (231, 90)],
                   [(199, 50), (215, 50), (215, 71), (201, 71)]],
}


# 추가 손질 (추출된 PNG 좌표): 다각형 안을 주변 색으로 메우고 바깥 테두리에 먹선 — retouch.patch
FUR = (248, 242, 231)
PATCH: dict = {
    # 백호: 입을 다물게 한 뒤 턱 뒤(목)가 비어 배경이 보이던 곳 + 입술 사이 틈 → 흰 털로 채우고 바깥 먹선 (사용자: "백호 입도 비어있다")
    ('baekho', 0): [
        {'poly': [(86, 60), (92, 61.5), (96, 64), (97, 68), (95, 71.5), (91, 73.5), (87, 73), (85.5, 67)], 'color': FUR},
        {'poly': [(90, 58.5), (98, 59.5), (104, 59), (106, 62), (100, 64.5), (93, 64)], 'color': FUR, 'ink': False},
    ],
    ('baekho', 1): [
        {'poly': [(144, 63), (151, 62.5), (157, 66), (160, 71), (159, 74), (154, 74.5), (148, 73), (144.5, 69)], 'color': FUR},
        {'poly': [(152, 60.5), (162, 61.5), (170, 61), (175, 60), (174, 66), (166, 69), (158, 69), (152, 67.5)], 'color': FUR, 'ink': False},
    ],
    ('baekho', 2): [
        {'poly': [(247, 78), (256, 79), (260, 82), (259, 87), (254, 90), (248, 90), (245.5, 85)], 'color': FUR},
        {'poly': [(269, 62.5), (280, 63.5), (288, 61.5), (293, 61.5), (292, 67), (285, 70), (276, 70), (269.5, 68.5)], 'color': FUR, 'ink': False},
    ],
    # 청룡 성장체: 원화에서 종이색 위에 선으로만 그린 등 갈기·왼쪽 털 뭉치 → 게임 배경 위에서 비어 보여 흰 털로 받침 (선은 그대로)
    ('cheongryong', 1): [
        {'poly': [(55, 99), (62, 93), (72, 94), (80, 91), (90, 93), (100, 95), (108, 100), (104, 107), (92, 107), (80, 108), (66, 110), (56, 107)], 'color': FUR, 'ink': False},
        {'poly': [(9, 73), (14, 65), (24, 61), (34, 63), (42, 67), (47, 73), (45, 80), (37, 84), (27, 84), (17, 82), (11, 78)], 'color': FUR, 'ink': False},
    ],
    # 원본 도감에서 옆 그림 조각이 가장자리에 딸려 온 것 지우기
    ('wolf', 1): [{'poly': [(0, 12), (8, 12), (8, 28), (0, 28)], 'clear': True, 'lum': -1}],
    ('hawk', 1): [{'poly': [(0, 0), (6, 0), (6, 34), (0, 34)], 'clear': True, 'lum': -1}],
    # 현무 유체: 꼬리 고리 안에 남은 종이색 → 투명 (뒤 배경이 보여야 하는 곳)
    ('hyeonmu', 0): [{'poly': [(29, 22), (30, 14), (36, 10.5), (46, 9.5), (53, 11.5), (56.5, 17), (56.5, 22), (45, 21), (36, 21)], 'clear': True}],
}


def process(img: np.ndarray, cfg, barrier: bool = False, ref_bbox=None):
    """barrier: 원화의 먹선(외곽선)을 벽으로 삼아, 종이색과 비슷한 흰 털·갈기가 외곽선의 작은 틈으로 새어
    배경과 함께 지워지지 않게 한다 (청룡 갈기·기린 갈기 등 '빈 부분' 수정, 2026-11-21).
    ref_bbox: 잘라낼 상자를 이 값으로 고정 (예전 출력과 같은 크기 → 리깅 좌표 유지). 반환: (rgba, bbox)"""
    x0, y0, x1, y1 = cfg['box']
    crop = img[y0:y1, x0:x1].astype(np.float32)
    h, w, _ = crop.shape
    # 지울 사각형은 배경색으로 채움
    border = np.concatenate([crop[0], crop[-1], crop[:, 0], crop[:, -1]])
    bg = np.median(border, axis=0)
    for (ex0, ey0, ex1, ey1) in cfg.get('erase', []):
        ax0, ay0 = max(0, ex0 - x0), max(0, ey0 - y0)
        ax1, ay1 = min(w, ex1 - x0), min(h, ey1 - y0)
        if ax1 > ax0 and ay1 > ay0:
            crop[ay0:ay1, ax0:ax1] = bg
    dist = np.sqrt(((crop - bg) ** 2).sum(axis=2))
    # 그림자: 배경과 비슷한 색조(따뜻한 회갈색), 너무 어둡지 않음
    lum = crop.mean(axis=2)
    r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
    warm_gray = (r >= g - 4) & (g >= b - 6) & ((r - b) < 60) & (lum > 150)
    bg_like = (dist < T_BG) | ((dist < SHADOW_MAX) & warm_gray)
    # 가장자리와 연결된 배경만 제거 (그림 내부의 흰 털은 보존)
    wall = np.zeros_like(bg_like)
    if barrier:
        bg_lum = float(np.median(np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])))
        ink = (lum < bg_lum - 58) | (dist > 105)
        wall = ndimage.binary_dilation(ink, iterations=1)
    lab, n = ndimage.label(bg_like & ~wall)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg_mask = np.isin(lab, list(edge_labels))
    if barrier:
        # 벽(먹선을 1px 넓힌 띠) 위의 종이색 픽셀 중 바깥 배경과 맞닿은 것만 배경으로 — 털 안쪽으로는 번지지 않음
        for _ in range(2):
            bg_mask |= bg_like & wall & ndimage.binary_dilation(bg_mask)
    fg = ~bg_mask
    # 작은 잡티 제거 + 주 덩어리와 멀리 떨어진 조각 제거
    lab2, n2 = ndimage.label(fg)
    if n2:
        sizes = ndimage.sum(fg, lab2, range(1, n2 + 1))
        biggest = sizes.max()
        keep = np.zeros(n2 + 1, bool)
        for i, s in enumerate(sizes, start=1):
            keep[i] = s >= max(30, biggest * 0.004)
        fg = keep[lab2]
    # 그림 안쪽에 갇힌 종이 영역(갈기·구름 사이 빈틈) 제거:
    # 종이는 배경색과 매우 가깝고(평균 거리 < 9) 따뜻한 색조(R-B > 24)이며 결이 고르다.
    # 흰 털(백호, 청룡 갈기)은 이보다 차갑거나 명암이 있어 보존된다.
    tight = dist < T_BG
    lab4, n4 = ndimage.label(tight & fg)
    alpha = fg.astype(np.float32)
    if n4:
        idx = np.arange(1, n4 + 1)
        area = ndimage.sum(np.ones_like(dist), lab4, idx)
        mean_d = ndimage.mean(dist, lab4, idx)
        warm = ndimage.mean(crop[..., 0] - crop[..., 2], lab4, idx)
        std = ndimage.standard_deviation(lum, lab4, idx)
        paper = np.zeros(n4 + 1, bool)
        for i in range(n4):
            if area[i] < 20:
                continue
            if (mean_d[i] < 9 and warm[i] > 24 and std[i] < 9) or mean_d[i] < 4.5:
                paper[i + 1] = True
        pm = paper[lab4]
        # 종이 영역 주변 그림자/결 1px까지 함께 제거
        pm = ndimage.binary_dilation(pm, iterations=1) & (dist < T_SOFT * 0.6)
        alpha[pm] = 0.0
    ink = None
    if cfg.get('fill'):
        fm = Image.new('L', (w, h), 0)
        dr = ImageDraw.Draw(fm)
        for poly in cfg['fill']:
            dr.polygon([(px - x0, py - y0) for (px, py) in poly], fill=255)
        fa = np.asarray(fm.filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255.0
        before = alpha > 0.5
        alpha = np.maximum(alpha, np.clip(fa * 1.4 - 0.2, 0, 1))
        # 새로 채운 가장자리에 원화와 같은 갈색 외곽선 1px
        added = (fa > 0.5) & ~before
        ink = ndimage.binary_dilation(added, iterations=1) & ~(fa > 0.5) & ~before
    fgm = alpha > 0.5
    # 부드러운 경계: 배경과 맞닿은 2px 띠에서 색 거리로 알파 계산
    near_bg = ndimage.binary_dilation(~fgm, iterations=2) & fgm
    soft = np.clip((dist - T_BG * 0.6) / (T_SOFT - T_BG * 0.6), 0, 1)
    alpha[near_bg] = np.minimum(alpha[near_bg], soft[near_bg])
    ring = ndimage.binary_dilation(fgm, iterations=1) & ~fgm
    alpha[ring] = np.clip(soft[ring] * 0.5, 0, 0.5)
    # 작은 조각 제거
    lab3, n3 = ndimage.label(alpha > 0.5)
    if n3:
        sizes = ndimage.sum(np.ones_like(alpha), lab3, range(1, n3 + 1))
        small = np.zeros(n3 + 1, bool)
        for i, sz in enumerate(sizes, start=1):
            small[i] = sz < max(25, sizes.max() * 0.003)
        alpha[small[lab3]] = 0
    # 색 언프리멀티플라이: c = (c - (1-a)*bg)/a  → 밝은 테두리(헤일로) 제거
    a3 = alpha[..., None]
    col = np.where(a3 > 0.02, (crop - (1 - a3) * bg) / np.maximum(a3, 0.02), crop)
    col = np.clip(col, 0, 255)
    if ink is not None:
        col[ink] = (128, 78, 42)
        alpha[ink] = 0.85
    rgba = np.dstack([col, alpha * 255]).astype(np.uint8)
    # 투명 여백 잘라내기 (+여백 2px)
    ys, xs = np.where(alpha > 0.05)
    bbox = ref_bbox
    if bbox is None and len(xs):
        bbox = (max(0, ys.min() - 2), ys.max() + 3, max(0, xs.min() - 2), xs.max() + 3)
    if bbox is not None:
        rgba = rgba[bbox[0]:bbox[1], bbox[2]:bbox[3]]
    # 오른쪽을 바라보도록 좌우 반전 (원본은 모두 왼쪽을 바라봄)
    return rgba[:, ::-1], bbox


def main():
    os.makedirs(OUT, exist_ok=True)
    img = np.array(Image.open(SRC).convert('RGB'))
    meta = {}
    tiles = []
    for (bid, stage), cfg in BEASTS.items():
        # 크기(잘라낼 상자)는 예전 방식으로 정하고, 그림은 먹선 벽 방식으로 (리깅 좌표가 그대로 맞게)
        _, bbox = process(img, cfg, barrier=False)
        rgba, _ = process(img, cfg, barrier=cfg.get('barrier', True), ref_bbox=bbox)
        if (bid, stage) in WHITEN:
            rgba = retouch.whiten(np.ascontiguousarray(rgba), WHITEN[(bid, stage)])
        if (bid, stage) in MOUTHS:
            rgba = retouch.close_mouth(np.ascontiguousarray(rgba), MOUTHS[(bid, stage)])
        rgba = retouch.patch(np.ascontiguousarray(rgba), PATCH.get((bid, stage), []))
        rgba = retouch.drop_specks(rgba)
        im = Image.fromarray(rgba, 'RGBA')
        name = f'{bid}_{stage}.png'
        im.save(os.path.join(OUT, name), optimize=True)
        meta[f'{bid}_{stage}'] = {'file': f'assets/mounts/{name}', 'w': im.width, 'h': im.height,
                                  'source': 'assets-src/reference/beasts_codex.png', 'box': cfg['box'], 'mirrored': True}
        tiles.append((f'{bid}_{stage}', im))
    with open(os.path.join(OUT, 'beasts.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    # 검수용 미리보기 (어두운 배경 위)
    cols = 3
    cw, ch = 340, 220
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * ch), (40, 42, 64, 255))
    for i, (_, im) in enumerate(tiles):
        cx, cy = (i % cols) * cw, (i // cols) * ch
        sheet.alpha_composite(im, (cx + (cw - im.width) // 2, cy + (ch - im.height) // 2))
    sheet.save(os.path.join(ROOT, 'assets-src', 'beasts_preview.png'))
    print('extracted', len(tiles), 'images ->', OUT)


if __name__ == '__main__':
    main()
