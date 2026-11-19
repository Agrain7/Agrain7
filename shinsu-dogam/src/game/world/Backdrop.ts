// 2D 패럴랙스 배경: 하늘(고정) → 달 → 구름 → 원경 산맥 2겹 → 중경 절벽·궁궐·폭포 → 근경 꽃나무 숲
import Phaser from 'phaser';
import type { SkyKind } from '../../art/world.ts';
import { ensureSky, bgOverrides, type SkyLayer } from '../textures.ts';
import { REGIONS } from '../../data/regions.ts';
import { GAME_W, GAME_H } from '../config.ts';

interface Layer { obj: Phaser.GameObjects.TileSprite; fx: number; fy: number; baseY: number; drift?: number }

const FALLS = [470, 1250];
/** 참고 파노라마 아래쪽이 놓일 화면 y (근경 숲과 겹쳐 흐려진다) */
const REF_BOTTOM = 486;
/** 근경 숲 아래쪽 화면 y (지면 뒤로 살짝 숨김) · 확대 배율 */
const FOREST_BOTTOM = 540;
const FOREST_SCALE = 1.25;

export class Backdrop {
  layers: Layer[] = [];
  moon: Phaser.GameObjects.Image;
  falls: Phaser.GameObjects.TileSprite[] = [];
  private cliffs!: Layer;
  private t = 0;
  /** 받은 절벽 그림에는 폭포가 그려져 있다고 보고 움직이는 폭포를 숨긴다 */
  private hideFalls = false;

  private refScrollY: number;

  constructor(scene: Phaser.Scene, sky: SkyKind, refScrollY = 0) {
    this.refScrollY = refScrollY;
    const k = (n: string) => `bg_${sky}_${n}`;
    // 원경: 받은 그림 > 참고 화면에서 잘라 낸 궁궐 절벽 파노라마 > 코드 그림
    const refKey = `ref_${sky}_cliffs`;
    const useRef = !bgOverrides.has(k('cliffs')) && scene.textures.exists(refKey);
    this.hideFalls = bgOverrides.has(k('cliffs')) || useRef;
    // 하늘·달·구름: 참고 화면 조각이 있으면 그것을 (밝은 동양풍 2D)
    const scn = (n: string) => (scene.textures.exists(`scn_${sky}_${n}`) ? `scn_${sky}_${n}` : null);
    // 코드로 그릴 층만 준비 (지역 테마가 많아져도 부팅·구간 시작이 느려지지 않게)
    const need: SkyLayer[] = [];
    if (!scn('sky')) need.push('sky');
    if (!(useRef && scene.textures.exists('scn_moon'))) need.push('moon');
    if (!scn('clouds')) need.push('clouds');
    if (!useRef) need.push('mount0', 'mount1', 'cliffs');
    if (!(useRef && scn('forest'))) need.push('grove');
    ensureSky(scene, sky, need);
    scene.add.image(0, 0, scn('sky') ?? k('sky')).setOrigin(0).setScrollFactor(0).setDepth(-100).setDisplaySize(GAME_W, GAME_H);
    const moonKey = useRef && scene.textures.exists('scn_moon') ? 'scn_moon' : k('moon');
    this.moon = scene.add.image(900, 170, moonKey).setScrollFactor(0).setDepth(-99).setScale(sky === 'mist' ? 0.6 : 0.85).setAlpha(sky === 'mist' ? 0.7 : 1);
    const theme = REGIONS.find((r) => r.sky === sky);
    if (moonKey === 'scn_moon' && theme && theme.moonTint !== 0xffffff) this.moon.setTint(theme.moonTint);
    const add = (key: string, y: number, h: number, fx: number, fy: number, depth: number, drift = 0) => {
      const obj = scene.add.tileSprite(0, y, GAME_W, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
      const L = { obj, fx, fy, baseY: y, drift };
      this.layers.push(L);
      return L;
    };
    add(scn('clouds') ?? k('clouds'), 30, 260, 0.04, 0.02, -98, 6);
    if (!useRef) {
      add(k('mount0'), 120, 460, 0.08, 0.05, -97);
      add(k('mount1'), 190, 460, 0.16, 0.1, -96);
    }
    if (useRef) {
      const th = (scene.textures.get(refKey).getSourceImage() as HTMLImageElement).height;
      this.cliffs = add(refKey, REF_BOTTOM - th, th, 0.24, 0.16, -95);
    } else this.cliffs = add(k('cliffs'), 150, 620, 0.32, 0.2, -95);
    for (let i = 0; i < 4; i++) {
      const f = scene.add.tileSprite(0, 0, 96, 520, 'waterfall').setOrigin(0.5, 0).setScrollFactor(0).setDepth(-94.5).setAlpha(0.9);
      this.falls.push(f);
    }
    // 근경 숲: 참고 화면 절벽 아래 소나무·벚나무 (없으면 코드 그림)
    const forest = useRef ? scn('forest') : null;
    if (forest) {
      const fh = (scene.textures.get(forest).getSourceImage() as HTMLImageElement).height;
      const L = add(forest, FOREST_BOTTOM - fh * FOREST_SCALE, fh * FOREST_SCALE, 0.5, 0.35, -93);
      L.obj.setTileScale(FOREST_SCALE, FOREST_SCALE);
    } else add(k('grove'), 330, 440, 0.6, 0.4, -93);
  }

  update(camX: number, camY: number, dt: number) {
    this.t += dt;
    const dy = this.refScrollY - camY;
    for (const L of this.layers) {
      L.obj.tilePositionX = camX * L.fx + (L.drift ? this.t * L.drift : 0);
      L.obj.y = L.baseY + dy * L.fy;
    }
    this.moon.x = 900 - camX * 0.01;
    this.moon.y = 170 + dy * 0.02;
    // 폭포: 절벽 레이어와 같은 속도로 이동
    const off = (camX * this.cliffs.fx) % 2048;
    let i = 0;
    for (const rep of [0, 2048]) {
      for (const fxp of FALLS) {
        const f = this.falls[i++];
        if (!f) continue;
        f.x = fxp + rep - off;
        f.y = this.cliffs.obj.y + 230;
        f.tilePositionY -= dt * 260;
        f.setVisible(!this.hideFalls && f.x > -80 && f.x < GAME_W + 80);
      }
    }
  }
}
