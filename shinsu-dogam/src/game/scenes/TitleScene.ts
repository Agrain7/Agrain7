import Phaser from 'phaser';
import { Backdrop } from '../world/Backdrop.ts';
import { txt, button, confirmBox } from '../../ui/widgets.ts';
import { store } from '../ctx.ts';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { UI_TEXT } from '../uiText.ts';
import { ensureMount, ensureRider } from '../textures.ts';
import { MOUNT_ART, artKey } from '../../data/mountArt.ts';
import { audio } from '../../systems/audio.ts';
import { analytics } from '../../services/analytics/Analytics.ts';

export class TitleScene extends Phaser.Scene {
  private bd!: Backdrop;
  private camX = 0;
  private runner?: Phaser.GameObjects.Container;

  constructor() {
    super('Title');
  }

  create() {
    this.bd = new Backdrop(this, 'dusk');
    const st = store.state;
    // 달리는 영물 + 라이더
    const m = st.active;
    const mt = ensureMount(this, m.id, m.stage, m.skin);
    const info = MOUNT_ART[artKey(m.id, m.stage)];
    const spr = this.add.sprite(0, 0, mt.key, 'run_0').setOrigin(0.5, (mt.padTop + info.h) / mt.fh).setScale(1.25 * info.scale);
    spr.play(`${mt.key}:run`);
    const rk = ensureRider(this, st.data.cosmetics.outfit);
    const rider = this.add.sprite((info.seat[0] - 0.5) * info.w * 1.25 * info.scale, -(1 - info.seat[1]) * info.h * 1.25 * info.scale, rk, 'run_0').setOrigin(54 / 120, 104 / 130).setScale(Math.max(0.56, Math.min(0.86, (info.h * info.scale) / 150)) * 1.25);
    rider.play(`${rk}:run`);
    this.runner = this.add.container(260, 640, [spr, rider]);
    this.add.image(0, 640, 'top_grass').setOrigin(0, 0.5).setDisplaySize(GAME_W, 48).setDepth(-1);
    this.add.tileSprite(0, 660, GAME_W, 80, 'ground_grass').setOrigin(0).setDepth(-2);

    // 제목
    const cx = GAME_W / 2;
    const title = txt(this, cx, 150, UI_TEXT.title, 104, '#3a1f1a', { title: true, stroke: '#f6e7c8', strokeThickness: 10 }).setOrigin(0.5);
    title.setShadow(0, 6, 'rgba(0,0,0,0.35)', 12, true, true);
    const seal = this.add.rectangle(cx + 250, 110, 74, 74, 0xb8322b).setStrokeStyle(3, 0x6e1b18);
    txt(this, seal.x, seal.y, '神獸\n圖鑑', 26, '#f6e7c8', { title: true, align: 'center', lineSpacing: -4 }).setOrigin(0.5);
    txt(this, cx, 228, UI_TEXT.english, 22, '#f6e7c8', { title: true, stroke: '#3a1f1a', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing?.(6);
    txt(this, cx, 266, `— ${UI_TEXT.slogan} —`, 24, '#fff6e0', { stroke: '#3a1f1a', strokeThickness: 5 }).setOrigin(0.5);

    const hasSave = st.hasSave();
    let y = 360;
    const bx = GAME_W - 230;
    if (hasSave) {
      button(this, bx, y, 300, 60, UI_TEXT.continue, () => this.go(false), 'primary', 24);
      y += 74;
    }
    button(this, bx, y, 300, 60, UI_TEXT.newGame, () => {
      if (hasSave) confirmBox(this, UI_TEXT.overwrite, () => this.go(true), '새로 시작');
      else this.go(true);
    }, hasSave ? 'normal' : 'primary', 24);
    y += 74;
    button(this, bx, y, 300, 56, UI_TEXT.codex, () => this.openMenu('codex'));
    y += 68;
    button(this, bx, y, 145, 52, UI_TEXT.shop, () => this.openMenu('shop'));
    button(this, bx + 155, y, 145, 52, UI_TEXT.settings, () => this.openMenu('settings'));
    txt(this, 16, GAME_H - 28, 'v0.1 프로토타입 · 영물 일러스트: 사용자 제공 원화 · © 신수도감', 14, '#f6ead0').setAlpha(0.8);
    if (!store.storageAvailable) txt(this, 16, GAME_H - 52, '※ 이 브라우저에서는 저장소를 쓸 수 없어 진행 상황이 저장되지 않습니다.', 14, '#ffd6a0');

    // 떨어지는 꽃잎
    this.add.particles(0, 0, 'petal', {
      x: { min: 0, max: GAME_W }, y: -20, lifespan: 9000, speedY: { min: 30, max: 70 }, speedX: { min: -40, max: 10 },
      rotate: { min: 0, max: 360 }, scale: { min: 0.6, max: 1.1 }, frequency: 260, alpha: 0.9,
    }).setDepth(50);
    this.input.once('pointerdown', () => audio.unlock());
    this.input.keyboard?.once('keydown', () => audio.unlock());
    void COLORS;
  }

  private go(fresh: boolean) {
    audio.unlock();
    if (fresh) {
      store.state.reset();
      store.state.save();
      analytics.track('game_start', { fresh: true });
      this.scene.start('Intro');
    } else {
      analytics.track('game_start', { fresh: false });
      this.scene.start('Map');
    }
  }

  private openMenu(tab: string) {
    this.scene.launch('Menu', { tab, from: 'Title' });
    this.scene.pause();
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.camX += dt * 180;
    this.bd.update(this.camX, 0, dt);
    if (this.runner) this.runner.y = 640 + Math.sin(this.camX / 40) * 2;
  }
}
