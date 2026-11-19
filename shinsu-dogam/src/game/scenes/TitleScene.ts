import Phaser from 'phaser';
import { Backdrop } from '../world/Backdrop.ts';
import { txt, button, confirmBox } from '../../ui/widgets.ts';
import { store } from '../ctx.ts';
import { isLive } from '../../services/payment/PaymentService.ts';
import RELEASE from '../../../release.config.json';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { UI_TEXT } from '../uiText.ts';
import { ensureMount, ensureRider, riderMeta } from '../textures.ts';
import { MOUNT_ART, artKey } from '../../data/mountArt.ts';
import { audio } from '../../systems/audio.ts';
import { analytics } from '../../services/analytics/Analytics.ts';
import { applyPlaytestGift, PLAYTEST_GIFT_ID } from '../../systems/playtestGift.ts';
import { panel } from '../../ui/widgets.ts';

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
    const spr = this.add.sprite(0, 0, mt.key, 'run_0').setOrigin(mt.originX, mt.originY).setScale(1.25 * mt.scale);
    spr.play(`${mt.key}:run`);
    const rk = ensureRider(this, st.data.cosmetics.outfit);
    const rm = riderMeta(rk);
    const seatX = mt.seatPx ? mt.seatPx[0] * mt.scale * 1.25 : (info.seat[0] - 0.5) * info.w * 1.25 * info.scale;
    const seatY = mt.seatPx ? mt.seatPx[1] * mt.scale * 1.25 : -(1 - info.seat[1]) * info.h * 1.25 * info.scale;
    const rider = this.add.sprite(seatX, seatY, rk, 'run_0').setOrigin(rm.ox, rm.oy).setScale(Math.max(0.56, Math.min(0.86, (info.h * info.scale) / 150)) * 1.25 * rm.scaleMul);
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
    txt(this, 16, GAME_H - 28, `v${RELEASE.version}${isLive() ? '' : ' · 테스트 결제'} · © 신수도감`, 14, '#f6ead0').setAlpha(0.8);
    if (!store.storageAvailable) txt(this, 16, GAME_H - 52, '※ 이 브라우저에서는 저장소를 쓸 수 없어 진행 상황이 저장되지 않습니다.', 14, '#ffd6a0');

    // 떨어지는 꽃잎
    this.add.particles(0, 0, 'petal', {
      x: { min: 0, max: GAME_W }, y: -20, lifespan: 9000, speedY: { min: 30, max: 70 }, speedX: { min: -40, max: 10 },
      rotate: { min: 0, max: 360 }, scale: { min: 0.6, max: 1.1 }, frequency: 260, alpha: 0.9,
    }).setDepth(50);
    if (store.giftJustApplied) {
      store.giftJustApplied = false;
      this.giftNotice();
    }
    if (store.payNotice) {
      const n = store.payNotice;
      store.payNotice = null;
      this.notice(n.title, n.body, n.ok);
    }
    this.input.once('pointerdown', () => audio.unlock());
    this.input.keyboard?.once('keydown', () => audio.unlock());
    void COLORS;
  }

  private notice(title: string, body: string, ok: boolean) {
    const layer = this.add.container(0, 0).setDepth(3000);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0).setInteractive();
    const p = panel(this, GAME_W / 2 - 330, GAME_H / 2 - 150, 660, 300);
    const t1 = txt(this, GAME_W / 2, GAME_H / 2 - 100, title, 32, ok ? COLORS.text : '#8a2a22', { title: true }).setOrigin(0.5);
    const t2 = txt(this, GAME_W / 2, GAME_H / 2 - 50, body, 19, '#3a2a2a', { align: 'center', lineSpacing: 8, wordWrap: { width: 600 } }).setOrigin(0.5, 0);
    const b = button(this, GAME_W / 2, GAME_H / 2 + 100, 200, 56, '확인', () => layer.destroy(), 'primary', 22);
    layer.add([dim, p, t1, t2, b]);
    if (ok) audio.play('chest');
  }

  private giftNotice() {
    const layer = this.add.container(0, 0).setDepth(3000);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.55).setOrigin(0).setInteractive();
    const p = panel(this, GAME_W / 2 - 330, GAME_H / 2 - 170, 660, 340);
    const t1 = txt(this, GAME_W / 2, GAME_H / 2 - 120, '선물이 도착했어요!', 34, COLORS.text, { title: true }).setOrigin(0.5);
    const t2 = txt(this, GAME_W / 2, GAME_H / 2 - 60, [
      '영물 9종이 모두 각성체(Lv.30)로 합류했어요.',
      'Q로 영물을 바꿔 가며 영물마다 다른 필살기(V)를 써 보세요.',
      '공격(Z)은 누르고 있으면 연속 — 적이 멀면 영물 고유 원거리 공격! 돌진 X · 기술 C',
      '청룡·주작·봉황은 공중에서 점프를 한 번 더 누르면 자유 비행.',
    ].join('\n'), 20, '#3a2a2a', { align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0);
    const ok = button(this, GAME_W / 2, GAME_H / 2 + 120, 200, 56, '확인', () => layer.destroy(), 'primary', 22);
    layer.add([dim, p, t1, t2, ok]);
  }

  private go(fresh: boolean) {
    audio.unlock();
    if (fresh) {
      store.state.reset();
      applyPlaytestGift(store.state, PLAYTEST_GIFT_ID);
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
