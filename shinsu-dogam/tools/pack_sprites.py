#!/usr/bin/env python3
"""
신수도감 그림 넣기 도구 — 받은 그림(프레임 PNG)을 검사하고 게임용 시트로 묶는다.

사용법 (shinsu-dogam 폴더에서):
    python3 tools/pack_sprites.py                 # art-in/ 전체
    python3 tools/pack_sprites.py --only mounts/hawk_2
    python3 tools/pack_sprites.py --in 다른폴더   # 입력 폴더 지정

입력 폴더 구조 (자세한 규격: docs/ART_REQUEST.md)
    art-in/mounts/<영물>_<단계>/idle_0.png, idle_1.png ... run_0.png ... fly_0.png ... atk_0.png ...
    art-in/mounts/<영물>_<단계>/seat.json        (선택) {"x": 412, "y": 233}  ← 라이더가 앉는 점 (원본 프레임 픽셀)
    art-in/riders/<의상>/idle_0.png ... run_ ... attack_ ... hit_ ... cast_ ... fly_
    art-in/riders/<의상>/seat.json               (선택) 라이더 엉덩이(안장에 닿는 점)
    art-in/monsters/<몬스터>/idle_0.png ... run_ ... attack_ ... hit_ ... (비행 몬스터는 fly_)
    art-in/backgrounds/<하늘>_<층>.png           하늘: dusk·night·mist / 층: sky·clouds·mount0·mount1·cliffs·grove

출력
    public/assets/sprites/<분류>/<이름>.png + public/assets/sprites/index.json  → 게임이 자동으로 사용
    assets-src/previews/                      → 동작 미리보기 GIF·검수 시트
"""
import argparse
import json
import os
import re
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'sprites')
PREV = os.path.join(ROOT, 'assets-src', 'previews')

ANIMS = {
    'mounts': ['idle', 'run', 'fly', 'atk'],
    'riders': ['idle', 'run', 'attack', 'hit', 'cast', 'fly'],
    'monsters': ['idle', 'run', 'attack', 'hit', 'jump', 'fly', 'cast', 'fall'],
}
REQUIRED = {'mounts': ['idle', 'run'], 'riders': ['idle', 'run'], 'monsters': []}
GROUNDED = {'idle', 'run', 'atk', 'attack', 'hit'}
# 게임 텍스처에서의 그림(내용) 높이 — 너무 크면 이 높이로 줄인다 (모바일 메모리)
TARGET_H = {'mounts': {0: 170, 1: 230, 2: 280}, 'riders': 130, 'monsters': 150, 'boss': 330}
BG_H = {'sky': 720, 'clouds': 260, 'mount0': 460, 'mount1': 460, 'cliffs': 620, 'grove': 440}
FPS = {'mounts': {'idle': 8, 'run': 13, 'fly': 11, 'atk': 16}}

warnings: list[str] = []
errors: list[str] = []


def warn(msg):
    warnings.append(msg)
    print('  ⚠', msg)


def err(msg):
    errors.append(msg)
    print('  ✖', msg)


def content_box(a: np.ndarray):
    ys, xs = np.where(a > 20)
    if not len(xs):
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def pack_set(category: str, key: str, folder: str):
    print(f'[{category}/{key}]')
    n_err = len(errors)
    meta = _pack_set(category, key, folder)
    if len(errors) > n_err:
        print('  → 오류가 있어 이 세트는 게임에 넣지 않았습니다 (고친 뒤 다시 실행)')
        return None
    return meta


def _pack_set(category: str, key: str, folder: str):
    files = {}
    for f in os.listdir(folder):
        m = re.match(r'^([a-z]+)_(\d+)\.png$', f)
        if not m:
            if f.endswith('.png'):
                warn(f'파일 이름 규칙(동작_번호.png)에 맞지 않아 건너뜀: {f}')
            continue
        anim, i = m.group(1), int(m.group(2))
        if anim not in ANIMS[category]:
            warn(f'알 수 없는 동작 이름 "{anim}" ({f}) — 사용 가능: {", ".join(ANIMS[category])}')
            continue
        files.setdefault(anim, {})[i] = os.path.join(folder, f)
    for r in REQUIRED[category]:
        if r not in files:
            err(f'필수 동작 "{r}" 프레임이 없음')
    if not files:
        err('프레임이 하나도 없음')
        return None
    order = [a for a in ANIMS[category] if a in files]
    frames = []
    for a in order:
        idx = sorted(files[a])
        if idx != list(range(len(idx))):
            err(f'"{a}" 프레임 번호가 0부터 빠짐없이 이어져야 함: {idx}')
        for i in idx:
            frames.append((a, i, files[a][i]))
    imgs = [Image.open(p).convert('RGBA') for _, _, p in frames]
    sizes = {im.size for im in imgs}
    if len(sizes) > 1:
        err(f'프레임 크기가 서로 다름: {sorted(sizes)} — 모든 프레임은 같은 캔버스 크기여야 원점이 맞습니다')
        return None
    W, H = imgs[0].size
    arrs = [np.array(im) for im in imgs]
    # 배경 투명 검사
    for (a, i, p), arr in zip(frames, arrs):
        corners = [arr[0, 0, 3], arr[0, -1, 3], arr[-1, 0, 3], arr[-1, -1, 3]]
        if min(corners) > 200:
            err(f'{os.path.basename(p)}: 배경이 투명하지 않음 (모서리가 불투명) — 투명 PNG로 보내 주세요')
            return None
    boxes = [content_box(arr[..., 3]) for arr in arrs]
    if any(b is None for b in boxes):
        err('빈 프레임이 있음')
        return None
    ux0 = min(b[0] for b in boxes); uy0 = min(b[1] for b in boxes)
    ux1 = max(b[2] for b in boxes); uy1 = max(b[3] for b in boxes)
    # 발 위치(지면선) 일치 검사
    bottoms = {f'{a}_{i}': b[3] for (a, i, _), b in zip(frames, boxes) if a in GROUNDED}
    ground = int(np.median(list(bottoms.values()))) if bottoms else uy1
    for name, b in bottoms.items():
        if abs(b - ground) > max(4, 0.03 * H):
            warn(f'{name}: 발 아래쪽이 다른 프레임과 {b - ground:+d}px 어긋남 (땅에서 뜨거나 파묻혀 보일 수 있음)')
    # 좌우 중심 흔들림
    cx = [(b[0] + b[2]) / 2 for b in boxes]
    if max(cx) - min(cx) > 0.12 * W:
        warn(f'프레임마다 그림의 좌우 위치가 크게 다름 (최대 {max(cx) - min(cx):.0f}px) — 같은 자리에 그려 주세요')
    m = 4
    cx0, cy0 = max(0, ux0 - m), max(0, uy0 - m)
    cx1, cy1 = min(W, ux1 + m), min(H, max(uy1, ground) + m)
    crops = [im.crop((cx0, cy0, cx1, cy1)) for im in imgs]
    cw, ch = cx1 - cx0, cy1 - cy0
    content_h = (uy1 - uy0)
    if category == 'mounts':
        stage = int(key.rsplit('_', 1)[1]) if key[-1].isdigit() else 2
        target = TARGET_H['mounts'].get(stage, 260)
    elif category == 'monsters':
        target = TARGET_H['boss'] if key == 'boss' else TARGET_H['monsters']
    else:
        target = TARGET_H[category]
    s = min(1.0, target / max(1, content_h))
    if s < 1:
        crops = [c.resize((max(1, round(cw * s)), max(1, round(ch * s))), Image.LANCZOS) for c in crops]
    fw, fh = crops[0].size
    if content_h * s < target * 0.6:
        warn(f'그림이 작음 (내용 높이 {content_h}px) — 확대하면 흐려질 수 있어 {int(target)}px 이상을 권장')
    # 원점: 기본 자세(idle_0 또는 첫 프레임)의 좌우 중심, 지면선
    b0 = boxes[0]
    ox = (((b0[0] + b0[2]) / 2) - cx0) * s / fw
    oy = (ground - cy0) * s / fh
    idle_box = [round((b0[0] - cx0) * s), round((b0[1] - cy0) * s), round((b0[2] - b0[0]) * s), round((b0[3] - b0[1]) * s)]
    seat = None
    sp = os.path.join(folder, 'seat.json')
    if os.path.exists(sp):
        sj = json.load(open(sp, encoding='utf-8'))
        seat = [round((sj['x'] - cx0) * s), round((sj['y'] - cy0) * s)]
    elif category == 'riders':
        warn('seat.json 없음 — 엉덩이 위치를 그림 아래쪽 20% 지점으로 추정합니다')
    # 시트
    cols = max(1, min(len(crops), 4096 // fw))
    rows = (len(crops) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))
    for k, c in enumerate(crops):
        sheet.alpha_composite(c, ((k % cols) * fw, (k // cols) * fh))
    os.makedirs(os.path.join(OUT, category), exist_ok=True)
    sheet.save(os.path.join(OUT, category, f'{key}.png'), optimize=True)
    # 미리보기 GIF (체크 무늬 배경)
    os.makedirs(PREV, exist_ok=True)
    def on_bg(c):
        bg = Image.new('RGBA', c.size, (236, 232, 222, 255))
        for y in range(0, c.size[1], 16):
            for x in range(0, c.size[0], 16):
                if (x // 16 + y // 16) % 2:
                    bg.paste((220, 214, 200, 255), (x, y, x + 16, y + 16))
        bg.alpha_composite(c)
        return bg.convert('P', palette=Image.ADAPTIVE)
    k = 0
    anims = {}
    for a in order:
        n = len(files[a])
        anims[a] = n
        seq = [on_bg(crops[k + j]) for j in range(n)]
        fps = FPS.get(category, {}).get(a, 10)
        seq[0].save(os.path.join(PREV, f'{category}_{key}_{a}.gif'), save_all=True, append_images=seq[1:], duration=int(1000 / fps), loop=0, disposal=2)
        k += n
    print(f'  ✓ {len(crops)}프레임 {fw}×{fh}px, 동작 {anims}, 축소 {s:.2f}배')
    return {
        'category': category, 'key': key, 'file': f'assets/sprites/{category}/{key}.png', 'fw': fw, 'fh': fh, 'cols': cols,
        'anims': anims, 'origin': [round(ox, 4), round(oy, 4)], 'contentH': round(content_h * s), 'idleBox': idle_box, 'seat': seat,
    }


def pack_bg(path: str, name: str):
    print(f'[backgrounds/{name}]')
    m = re.match(r'^(dusk|night|mist)_(sky|clouds|mount0|mount1|cliffs|grove)$', name)
    if not m:
        warn(f'배경 이름 규칙(<dusk|night|mist>_<sky|clouds|mount0|mount1|cliffs|grove>.png)에 맞지 않아 건너뜀: {name}')
        return None
    im = Image.open(path).convert('RGBA')
    layer = m.group(2)
    th = BG_H[layer]
    if layer == 'sky':
        im = im.resize((1280, 720), Image.LANCZOS)
    else:
        w = round(im.width * th / im.height)
        im = im.resize((w, th), Image.LANCZOS)
        a = np.array(im).astype(np.int32)
        seam = np.abs(a[:, 0, :3] - a[:, -1, :3]).mean()
        if seam > 18:
            warn(f'왼쪽 끝과 오른쪽 끝이 이어지지 않음 (평균 차이 {seam:.0f}) — 가로로 반복되는 그림이어야 합니다')
        if layer != 'sky' and np.array(im)[0, :, 3].mean() > 200:
            warn('위쪽이 투명하지 않음 — 하늘 위에 겹치는 층은 빈 곳을 투명하게 해 주세요')
    os.makedirs(os.path.join(OUT, 'bg'), exist_ok=True)
    im.save(os.path.join(OUT, 'bg', f'{name}.png'), optimize=True)
    print(f'  ✓ {im.width}×{im.height}px')
    return {'key': f'bg_{name}', 'file': f'assets/sprites/bg/{name}.png'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='inp', default=os.path.join(ROOT, 'art-in'))
    ap.add_argument('--only', default=None)
    args = ap.parse_args()
    if not os.path.isdir(args.inp):
        print(f'입력 폴더가 없습니다: {args.inp}')
        sys.exit(1)
    idx_path = os.path.join(OUT, 'index.json')
    index = json.load(open(idx_path, encoding='utf-8')) if os.path.exists(idx_path) else {'version': 1, 'sets': [], 'backgrounds': []}
    for cat in ['mounts', 'riders', 'monsters']:
        d = os.path.join(args.inp, cat)
        if not os.path.isdir(d):
            continue
        for key in sorted(os.listdir(d)):
            if args.only and args.only != f'{cat}/{key}':
                continue
            if not os.path.isdir(os.path.join(d, key)):
                continue
            meta = pack_set(cat, key, os.path.join(d, key))
            if meta:
                index['sets'] = [s for s in index['sets'] if not (s['category'] == cat and s['key'] == key)] + [meta]
    bd = os.path.join(args.inp, 'backgrounds')
    if os.path.isdir(bd) and (not args.only or args.only.startswith('backgrounds')):
        for f in sorted(os.listdir(bd)):
            if f.endswith('.png'):
                meta = pack_bg(os.path.join(bd, f), f[:-4])
                if meta:
                    index['backgrounds'] = [b for b in index['backgrounds'] if b['key'] != meta['key']] + [meta]
    os.makedirs(OUT, exist_ok=True)
    json.dump(index, open(idx_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n완료: 세트 {len(index["sets"])}개, 배경 {len(index["backgrounds"])}개 → {os.path.relpath(idx_path, ROOT)}')
    print(f'경고 {len(warnings)}개, 오류 {len(errors)}개')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
