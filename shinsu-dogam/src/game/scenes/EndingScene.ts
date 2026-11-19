// 종장 「이어진 길」 + 엔딩 크레디트: 노을 길 위로 하람이 달리고, 함께한 영물들이 차례로 지나간다
import Phaser from 'phaser';
import { Backdrop } from '../world/Backdrop.ts';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { txt, button, fitInto } from '../../ui/widgets.ts';
import { playStory } from '../../ui/dialogue.ts';
import { makeRunner } from '../runner.ts';
import { store } from '../ctx.ts';
import { MOUNT_ORDER, MOUNTS } from '../../data/mounts.ts';
import { ensurePortrait } from '../textures.ts';
import { audio } from '../../systems/audio.ts';
import { analytics } from '../../services/analytics/Analytics.ts';
import RELEASE from '../../../release.config.json';

export class EndingScene extends Phaser.Scene {
  private bd!: Backdrop;
  private x = 0;
  private runner?: Phaser.GameObjects.Container;
  private rolling?: Phaser.GameObjects.Container;
  private speed = 1;

  constructor() {
    super('Ending');
  }

  create() {
    audio.stopMusic();
    audio.startMusic('calm');
    this.speed = 1;
    this.ended = false;
    this.rolling = undefined;
    this.bd = new Backdrop(this, 'dusk');
    this.add.image(0, 640, 'top_grass').setOrigin(0, 0.5).setDisplaySize(GAME_W, 48).setDepth(-1);
    this.add.tileSprite(0, 660, GAME_W, 80, 'ground_grass').setOrigin(0).setDepth(-2);
    this.runner = makeRunner(this, 330, 640, 1.3).setDepth(5);
    analytics.track('ending_reached', {});
    // 엔딩 기념 선물 (처음 한 번 — 종장을 본 기록으로 판단)
    const st = store.state;
    const firstTime = !st.storySeen('ending');
    playStory(this, 'ending', { dim: 0.3, depth: 100, onDone: () => this.credits(firstTime) });
  }

  private credits(gift: boolean) {
    const st = store.state;
    if (gift) {
      st.addItem('spirit_stone', 30);
      st.addItem('gold', 3000);
      st.save();
    }
    const maker = RELEASE.business.name || '신수도감 제작진';
    const lines: [string, number, string][] = [
      ['神獸圖鑑', 26, '#e2b14c'], ['신수도감', 54, '#fff6e0'], ['― 길을 잇는 기수 ―', 22, '#f6ead0'], ['', 40, ''],
      ['원작 · 세계관 · 영물 원화', 18, '#e2b14c'], [maker, 26, '#fff6e0'], ['', 26, ''],
      ['이야기 · 연출 · 개발', 18, '#e2b14c'], [maker, 26, '#fff6e0'], ['', 26, ''],
      ['함께 달린 영물들', 18, '#e2b14c'],
      [MOUNT_ORDER.slice(0, 5).map((id) => MOUNTS[id].name).join(' · '), 24, '#fff6e0'],
      [MOUNT_ORDER.slice(5).map((id) => MOUNTS[id].name).join(' · '), 24, '#fff6e0'], ['', 26, ''],
      ['글꼴', 18, '#e2b14c'], ['고운바탕 · 고운돋움 · Noto Serif KR (SIL OFL 1.1)', 20, '#fff6e0'], ['', 20, ''],
      ['엔진', 18, '#e2b14c'], ['Phaser (MIT)', 20, '#fff6e0'], ['', 40, ''],
      ['그리고, 함께 달려 준 당신', 28, '#fff6e0'], ['', 60, ''],
      ['끝', 46, '#ffe6a6'], ['도감의 빈 장은 다음 이야기에서', 20, '#f6ead0'],
    ];
    const roll = this.add.container(GAME_W * 0.68, GAME_H + 30).setDepth(20);
    let y = 0;
    for (const [s, size, color] of lines) {
      if (s) roll.add(txt(this, 0, y, s, size, color, { title: true, align: 'center', stroke: '#1d1a2b', strokeThickness: 5 }).setOrigin(0.5, 0));
      y += size + 18;
    }
    this.rolling = roll;
    const endY = GAME_H / 2 - y + 60; // '끝' 이 화면 가운데쯤에서 멈춤
    this.tweens.addCounter({
      from: 0, to: 1, duration: 30000,
      onUpdate: (tw) => { roll.y = Phaser.Math.Linear(GAME_H + 30, endY, tw.getValue() ?? 0); },
      onComplete: () => this.endButtons(gift),
    });
    // 함께한 영물 행렬 (뒤에서 차례로 지나감)
    const owned = MOUNT_ORDER.filter((id) => st.owns(id));
    owned.forEach((id, i) => {
      this.time.delayedCall(1200 + i * 3000, () => {
        const m = st.data.mounts[id]!;
        const fly = MOUNTS[id].stages[m.stage].abilities.join('').includes('비행');
        // 하람 뒤에서 나란히 달려와 앞질러 간다 (함께 달리는 길)
        const img = fitInto(this.add.image(0, 0, ensurePortrait(this, id, m.stage, 'normal', m.skin)), -180, fly ? 380 : 610, 240, 170, 1.2).setDepth(fly ? 3 : 6);
        this.tweens.add({ targets: img, x: GAME_W + 200, duration: 9000, ease: 'Sine.inOut', onComplete: () => img.destroy() });
        this.tweens.add({ targets: img, y: img.y - (fly ? 26 : 8), yoyo: true, repeat: -1, duration: fly ? 900 : 260 });
      });
    });
    // 꽃잎
    this.add.particles(0, 0, 'petal', {
      x: { min: 0, max: GAME_W }, y: -20, lifespan: 9000, speedY: { min: 30, max: 70 }, speedX: { min: -40, max: 10 },
      rotate: { min: 0, max: 360 }, scale: { min: 0.6, max: 1.1 }, frequency: 300, alpha: 0.9,
    }).setDepth(30);
    const skip = button(this, 1170, 50, 160, 44, '건너뛰기 ≫', () => { this.tweens.killAll(); roll.y = endY; this.endButtons(gift); }, 'normal', 16).setDepth(50);
    this.skipBtn = skip;
    this.input.on('pointerdown', () => { this.speed = 2.5; });
    this.input.on('pointerup', () => { this.speed = 1; });
  }
  private skipBtn?: Phaser.GameObjects.Container;
  private ended = false;

  private endButtons(gift: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.skipBtn?.destroy();
    if (gift) {
      const t = txt(this, GAME_W * 0.68, GAME_H - 150, '엔딩 기념 선물 · 영기석 30 · 금화 3,000', 20, '#ffe6a6', { title: true, stroke: '#1d1a2b', strokeThickness: 5 }).setOrigin(0.5).setDepth(40);
      this.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, duration: 600 });
    }
    button(this, GAME_W * 0.68, GAME_H - 90, 240, 58, '지도로 돌아가기', () => this.scene.start('Map'), 'primary', 22).setDepth(40);
    void COLORS;
  }

  update(_t: number, dms: number) {
    this.x += dms * 0.18 * this.speed;
    this.bd.update(this.x, 0, dms / 1000);
    if (this.runner) this.runner.y = 640 + Math.sin(this.x / 40) * 2;
    if (this.rolling) this.tweens.timeScale = this.speed;
  }
}
