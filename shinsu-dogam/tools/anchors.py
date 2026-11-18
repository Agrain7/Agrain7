#!/usr/bin/env python3
"""영물 일러스트별 라이더 좌석 위치 자동 추정 + 검수 이미지 생성 (수동 보정값은 src/data/mountArt.ts)"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'public', 'assets', 'mounts')
meta = json.load(open(os.path.join(D, 'beasts.json')))
override = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
out = {}
tiles = []
for key, m in meta.items():
    im = Image.open(os.path.join(D, m['file'].split('/')[-1]))
    a = np.array(im)[..., 3] > 128
    h, w = a.shape
    bird = key.split('_')[0] in ('hawk', 'jujak', 'bonghwang')
    x0, x1 = (0.42, 0.58) if bird else (0.36, 0.52)
    ys = []
    for x in range(int(w * x0), int(w * x1)):
        col = a[:, x]
        run = 0
        for y in range(h):
            run = run + 1 if col[y] else 0
            if run >= 7:
                ys.append(y - 6)
                break
    fy = (np.median(ys) / h) if ys else 0.3
    fx = (x0 + x1) / 2
    if key in override:
        fx, fy = override[key]
    out[key] = [round(fx, 3), round(float(fy), 3)]
    t = im.resize((w * 2, h * 2))
    bg = Image.new('RGBA', (360, 300), (40, 42, 64, 255))
    ox, oy = (360 - w * 2) // 2, (300 - h * 2) // 2
    bg.alpha_composite(t, (ox, oy))
    dr = ImageDraw.Draw(bg)
    sx, sy = ox + fx * w * 2, oy + fy * h * 2
    dr.ellipse((sx - 5, sy - 5, sx + 5, sy + 5), fill=(255, 0, 255))
    dr.rectangle((sx - 14, sy - 70, sx + 14, sy), outline=(255, 0, 255))
    dr.text((4, 4), key, fill=(255, 255, 255))
    tiles.append(bg)
cols = 6
sheet = Image.new('RGBA', (cols * 360, ((len(tiles) + cols - 1) // cols) * 300))
for i, t in enumerate(tiles):
    sheet.alpha_composite(t, ((i % cols) * 360, (i // cols) * 300))
sheet.save('/tmp/claude-0/shots/anchors.png')
print(json.dumps(out))
