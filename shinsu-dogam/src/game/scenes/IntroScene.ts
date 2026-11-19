// 서장 「빈 도감」: 흐르는 밤 배경 위로 해설 → 하람과 월하랑의 대화 → 지도
import Phaser from 'phaser';
import { Backdrop } from '../world/Backdrop.ts';
import { GAME_W } from '../config.ts';
import { playStory } from '../../ui/dialogue.ts';
import { makeRunner } from '../runner.ts';

export class IntroScene extends Phaser.Scene {
  private bd!: Backdrop;
  private x = 0;
  private runner?: Phaser.GameObjects.Container;
  constructor() {
    super('Intro');
  }
  create() {
    this.bd = new Backdrop(this, 'night');
    this.add.image(0, 640, 'top_grass').setOrigin(0, 0.5).setDisplaySize(GAME_W, 48).setDepth(-1);
    this.add.tileSprite(0, 660, GAME_W, 80, 'ground_grass').setOrigin(0).setDepth(-2);
    this.runner = makeRunner(this, 380, 640, 1.2, 'wolf');
    // 흑운: 화면 위쪽에 번지는 검은 구름
    const g = this.add.graphics().setAlpha(0);
    for (let i = 0; i < 14; i++) {
      g.fillStyle(0x14101c, 0.18);
      g.fillCircle(GAME_W * (i / 13), 30 + (i % 3) * 18, 90 + (i % 4) * 22);
    }
    this.tweens.add({ targets: g, alpha: 1, delay: 5200, duration: 2400 });
    playStory(this, 'prologue', { cinematic: true, chapterCard: true, dim: 0.25, depth: 100, onDone: () => this.scene.start('Map') });
  }
  update(_t: number, dms: number) {
    this.x += dms * 0.18;
    this.bd.update(this.x, 0, dms / 1000);
    if (this.runner) this.runner.y = 640 + Math.sin(this.x / 40) * 2;
  }
}
