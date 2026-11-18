import Phaser from 'phaser';
import { MOUNT_ART } from '../../data/mountArt.ts';
import { loadFonts } from '../fonts.ts';
import { addCanvas, ensureRider, ensureSky, generateCommon } from '../textures.ts';
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
        this.drawBar(0.4 + 0.5 * (i / jobs.length));
        if (i < jobs.length) this.time.delayedCall(1, step);
        else resolve();
      };
      step();
    });
    ensureSky(this, 'dusk');
    ensureRider(this, store.state.data.cosmetics.outfit);
    this.drawBar(1);
    (window as unknown as Record<string, unknown>).__SD_READY__ = true;
    if (START_STAGE && (DEBUG || AUTOTEST)) this.scene.start('World', { stage: START_STAGE });
    else this.scene.start(AUTOTEST ? 'Map' : 'Title');
  }
}
