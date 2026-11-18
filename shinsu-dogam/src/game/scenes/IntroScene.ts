import Phaser from 'phaser';
import { Backdrop } from '../world/Backdrop.ts';
import { txt, button } from '../../ui/widgets.ts';
import { UI_TEXT } from '../uiText.ts';
import { GAME_W, GAME_H } from '../config.ts';

export class IntroScene extends Phaser.Scene {
  private bd!: Backdrop;
  private x = 0;
  constructor() {
    super('Intro');
  }
  create() {
    this.bd = new Backdrop(this, 'night');
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0912, 0.45).setOrigin(0);
    const line = txt(this, GAME_W / 2, GAME_H / 2 - 20, '', 30, '#f6ead0', { title: true, align: 'center', wordWrap: { width: 900 }, lineSpacing: 12, stroke: '#14121d', strokeThickness: 4 }).setOrigin(0.5);
    let i = 0;
    const show = () => {
      if (i >= UI_TEXT.intro.length) return this.scene.start('Map');
      line.setText(UI_TEXT.intro[i++]).setAlpha(0);
      this.tweens.add({ targets: line, alpha: 1, duration: 700 });
    };
    show();
    const next = button(this, GAME_W / 2, GAME_H - 110, 220, 56, '다음 ▶', show, 'primary');
    button(this, GAME_W - 110, 50, 160, 46, '건너뛰기', () => this.scene.start('Map'));
    this.input.keyboard?.on('keydown-SPACE', show);
    this.input.keyboard?.on('keydown-ENTER', show);
    void next;
  }
  update(_t: number, dms: number) {
    this.x += dms * 0.05;
    this.bd.update(this.x, 0, dms / 1000);
  }
}
