import Phaser from 'phaser';
import { MOUNT_ART } from '../../data/mountArt.ts';
import { loadFonts } from '../fonts.ts';
import { addCanvas, ensureRider, ensureSky, generateCommon, loadSpriteOverrides, prewarmMonsters } from '../textures.ts';
import { MONSTER_ART, monsterImageKey } from '../../data/monsterArt.ts';
import { store } from '../ctx.ts';
import { GAME_W, GAME_H, AUTOTEST, DEBUG, START_STAGE } from '../config.ts';

export class BootScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;

  constructor() {
    super('Boot');
  }

  preload() {
    this.cameras.main.setBackgroundColor('#14121d');
    this.bar = this.add.graphics();
    this.label = this.add.text(GAME_W / 2, GAME_H / 2 + 40, '신수도감 불러오는 중…', { fontFamily: 'serif', fontSize: '20px', color: '#e2b14c' }).setOrigin(0.5);
    this.drawBar(0);
    this.load.on('progress', (p: number) => this.drawBar(p * 0.4));
    for (const key of Object.keys(MOUNT_ART)) this.load.image(`img_${key}`, `assets/mounts/${key}.png`);
    for (const [id, art] of Object.entries(MONSTER_ART)) this.load.image(monsterImageKey(id), art.file);
    for (const sky of ['dusk', 'mist']) this.load.image(`ref_${sky}_cliffs`, `assets/backgrounds/${sky}_cliffs.png`);
    this.load.image('ref_portrait', 'assets/ui/portrait_haram.png');
    // 참고 화면에서 잘라 낸 배경 조각 (tools/extract_scenery.py)
    for (const sky of ['dusk', 'mist']) for (const n of ['sky', 'clouds', 'forest']) this.load.image(`scn_${sky}_${n}`, `assets/scenery/${sky}_${n}.png`);
    for (const n of ['moon', 'bridge_top', 'pavilion', 'banner_red', 'banner_pink']) this.load.image(`scn_${n}`, `assets/scenery/${n}.png`);
  }

  private drawBar(p: number) {
    const w = 420;
    this.bar.clear();
    this.bar.lineStyle(2, 0xe2b14c, 1);
    this.bar.strokeRoundedRect(GAME_W / 2 - w / 2, GAME_H / 2, w, 14, 7);
    this.bar.fillStyle(0xc3352c, 1);
    this.bar.fillRoundedRect(GAME_W / 2 - w / 2 + 2, GAME_H / 2 + 2, Math.max(10, (w - 4) * p), 10, 5);
  }

  create() {
    void this.boot();
  }

  private async boot() {
    await loadFonts();
    // 받은 그림(프레임·배경)이 있으면 먼저 불러온다
    await loadSpriteOverrides(this);
    this.label.setText('영물의 기운을 모으는 중…');
    const jobs = generateCommon(this);
    let i = 0;
    await new Promise<void>((resolve) => {
      const step = () => {
        const t0 = performance.now();
        while (i < jobs.length && performance.now() - t0 < 24) {
          addCanvas(this, jobs[i][0], jobs[i][1]());
          i++;
        }
        this.drawBar(0.4 + 0.4 * (i / jobs.length));
        if (i < jobs.length) this.time.delayedCall(1, step);
        else resolve();
      };
      step();
    });
    this.label.setText('요괴의 기척을 살피는 중…');
    await prewarmMonsters(this, (p) => this.drawBar(0.8 + 0.18 * p));
    ensureSky(this, 'dusk');
    ensureRider(this, store.state.data.cosmetics.outfit);
    this.drawBar(1);
    (window as unknown as Record<string, unknown>).__SD_READY__ = true;
    if (START_STAGE && (DEBUG || AUTOTEST)) this.scene.start('World', { stage: START_STAGE });
    else this.scene.start(AUTOTEST ? 'Map' : 'Title');
  }
}
