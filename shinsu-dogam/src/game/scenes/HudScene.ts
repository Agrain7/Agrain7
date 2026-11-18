// 플레이 화면 UI — 참고 화면 구성: 좌상단 원형 초상 + Lv + 빨강 체력·파랑 경험치, 우상단 지역 현판 + 일시정지,
// 좌하단 ←→, 우하단 파랑 소용돌이(공격)·빨강 소용돌이(기술)·연꽃(필살기)·위 화살표(점프). PC에서도 버튼을 누를 수 있다.
import Phaser from 'phaser';
import type { WorldScene } from './WorldScene.ts';
import { txt, bar } from '../../ui/widgets.ts';
import { store } from '../ctx.ts';
import { controls, type Btn } from '../controls.ts';
import { MOUNTS } from '../../data/mounts.ts';
import { RANGED } from '../../data/beastSkills.ts';
import type { MountId } from '../../data/types.ts';
import { expToNext } from '../../systems/state.ts';
import { GAME_W, GAME_H, COLORS, isTouchDevice } from '../config.ts';
import { addCanvas, ensurePortrait } from '../textures.ts';
import { MOUNT_ART, artKey } from '../../data/mountArt.ts';
import { makeCanvas, cloudSwirl } from '../../art/paint.ts';
import { audio } from '../../systems/audio.ts';

interface UIBtn { img: Phaser.GameObjects.Image; btn: Btn; cd?: Phaser.GameObjects.Graphics; r: number; s: number; label?: Phaser.GameObjects.Text }

export class HudScene extends Phaser.Scene {
  private world!: WorldScene;
  private hp!: ReturnType<typeof bar>;
  private exp!: ReturnType<typeof bar>;
  private lv!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private stoneText!: Phaser.GameObjects.Text;
  private pearlText!: Phaser.GameObjects.Text;
  private face!: Phaser.GameObjects.Image;
  private btns: UIBtn[] = [];
  private btnLayer!: Phaser.GameObjects.Container;
  private legend!: Phaser.GameObjects.Text;
  private bossLayer!: Phaser.GameObjects.Container;
  private bossBar!: ReturnType<typeof bar>;
  private msgs: Phaser.GameObjects.Text[] = [];
  private ultRing!: Phaser.GameObjects.Graphics;
  private ultGlow!: Phaser.GameObjects.Image;
  private ultReadyShown = false;
  private progress!: Phaser.GameObjects.Graphics;
  private progressIcon!: Phaser.GameObjects.Image;
  private rangedText!: Phaser.GameObjects.Text;
  private showBtns = true;
  private lastOutfit = '';

  constructor() {
    super('Hud');
  }

  create() {
    this.world = this.scene.get('World') as WorldScene;
    this.btns = [];
    this.msgs = [];
    this.ultReadyShown = false;
    this.ensureOrnaments();
    // ---- 좌상단: 초상 + 레벨 + 체력·경험치 ----
    this.add.image(250, 66, 'hud_plate').setOrigin(0.5);
    this.add.circle(72, 70, 50, 0xf2e6cc);
    this.face = this.add.image(72, 70, this.faceTexture()).setDisplaySize(94, 94);
    this.add.image(72, 70, 'hud_ring');
    this.lv = txt(this, 136, 22, 'Lv. 1', 26, '#f6ead0', { title: true, stroke: '#1d1a2b', strokeThickness: 5 });
    this.nameText = txt(this, 236, 28, '', 16, '#e8dcc4', { stroke: '#1d1a2b', strokeThickness: 3 });
    this.hp = bar(this, 132, 58, 268, 20, COLORS.hp);
    this.hpText = txt(this, 266, 68, '', 13, '#ffffff', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5);
    this.exp = bar(this, 132, 84, 236, 13, COLORS.exp);
    this.add.image(146, 116, 'icon_gold').setScale(0.36);
    this.goldText = txt(this, 162, 106, '0', 17, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 4 });
    this.add.image(236, 116, 'icon_stone').setScale(0.36);
    this.stoneText = txt(this, 252, 106, '0', 17, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 4 });
    this.pearlText = txt(this, 310, 106, '', 16, '#bfe9ff', { stroke: '#1d1a2b', strokeThickness: 4 });
    // ---- 우상단: 지역 현판 + 일시정지 ----
    const map = this.world.map;
    this.add.image(GAME_W - 232, 52, 'hud_banner');
    txt(this, GAME_W - 232, 52, `${map.name} ${map.id}`, 25, '#f6ead0', { title: true, stroke: '#1d1a2b', strokeThickness: 4 }).setOrigin(0.5);
    const pause = this.add.image(GAME_W - 62, 52, 'btn_pause').setScale(0.56).setInteractive({ useHandCursor: true });
    pause.on('pointerup', () => { audio.unlock(); this.world.openMenu('stable'); });
    const sw = this.add.image(GAME_W - 62, 118, 'btn_swap').setScale(0.44).setInteractive({ useHandCursor: true });
    sw.on('pointerdown', () => { controls.touch.swap = true; audio.unlock(); });
    sw.on('pointerup', () => { controls.touch.swap = false; });
    sw.on('pointerout', () => { controls.touch.swap = false; });
    sw.setVisible(store.state.ownedMounts().length > 1);
    if (sw.visible) txt(this, GAME_W - 62, 146, 'Q 교체', 12, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5);
    // ---- 상단 가운데: 구간 진행 (편의) ----
    this.progress = this.add.graphics();
    this.progressIcon = this.add.image(0, 26, 'wisp_gold').setScale(1.2);
    // ---- 보스 체력 ----
    this.bossLayer = this.add.container(0, 0).setVisible(false);
    const bt = txt(this, GAME_W / 2, 96, '흑운 산군', 22, '#ffd0c8', { title: true, stroke: '#1d1a2b', strokeThickness: 5 }).setOrigin(0.5);
    this.bossBar = bar(this, GAME_W / 2 - 260, 116, 520, 18, 0x8a2be2);
    this.bossLayer.add([bt, this.bossBar.g]);
    // ---- 버튼 (참고 화면 배치) ----
    this.btnLayer = this.add.container(0, 0);
    const pc = !isTouchDevice();
    const mk = (key: string, x: number, y: number, btn: Btn, s: number, cd = false, key2 = '') => {
      const img = this.add.image(x, y, key).setScale(s).setAlpha(0.95).setInteractive({ useHandCursor: true });
      const on = () => { controls.touch[btn] = true; controls.usedTouch = true; audio.unlock(); img.setScale(s * 0.92); };
      const off = () => { controls.touch[btn] = false; img.setScale(s); };
      img.on('pointerdown', on);
      img.on('pointerup', off);
      img.on('pointerout', off);
      const g = cd ? this.add.graphics() : undefined;
      this.btnLayer.add(img);
      if (g) this.btnLayer.add(g);
      let label: Phaser.GameObjects.Text | undefined;
      if (pc && key2) {
        label = txt(this, x, y + 56 * s + 10, key2, 13, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5);
        this.btnLayer.add(label);
      }
      const b: UIBtn = { img, btn, cd: g, r: 50 * s, s, label };
      this.btns.push(b);
      return b;
    };
    // 좌하단 이동 (구름 장식)
    this.btnLayer.add(this.add.image(165, GAME_H - 96, 'hud_cloud').setAlpha(0.9));
    mk('btn_left', 98, GAME_H - 96, 'left', 0.9, false, 'A / ←');
    mk('btn_right', 232, GAME_H - 96, 'right', 0.9, false, 'D / →');
    mk('btn_down', 165, GAME_H - 214, 'down', 0.6);
    // 우하단 기술
    mk('btn_swirl_blue', GAME_W - 478, GAME_H - 92, 'attack', 0.82, true, 'J 공격');
    mk('btn_swirl_red', GAME_W - 362, GAME_H - 92, 'special', 0.82, true, 'K 기술');
    const lotus = mk('btn_lotus', GAME_W - 246, GAME_H - 92, 'ult', 0.82, false, 'U 필살기');
    mk('btn_jump', GAME_W - 112, GAME_H - 108, 'jump', 1.04, false, 'Space 점프');
    mk('btn_dash', GAME_W - 112, GAME_H - 250, 'dash', 0.66, true, 'L 돌진');
    this.ultGlow = this.add.image(lotus.img.x, lotus.img.y, 'wisp_gold').setScale(7).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.btnLayer.addAt(this.ultGlow, 0);
    this.ultRing = this.add.graphics();
    this.btnLayer.add(this.ultRing);
    this.rangedText = txt(this, GAME_W - 478, GAME_H - 150, '', 12, '#bfe9ff', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5);
    this.btnLayer.add(this.rangedText);
    this.legend = txt(this, GAME_W / 2, GAME_H - 16, 'A·D 이동 · Space 점프(길게: 활공·비행) · J 공격(누르고 있으면 연속, 멀면 원거리) · K 기술 · U 필살기 · L 돌진 · Q 교체 · Esc 메뉴', 13, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5).setAlpha(0.85);
    this.applyButtonMode();
    // ---- 월드 이벤트 ----
    const onMsg = (m: string, c: string) => this.message(m, c);
    const onTitle = (t: string, s: string) => this.titleCard(t, s);
    const onBoss = (hp: number, max: number, show: boolean) => { this.bossLayer.setVisible(show); this.bossBar.set(hp / max); };
    const onCut = (id: MountId, stage: number, name: string, hanja: string, ink: string, color: number) => this.cutIn(id, stage, name, hanja, ink, color);
    this.world.events.on('hud-msg', onMsg);
    this.world.events.on('hud-title', onTitle);
    this.world.events.on('boss-hp', onBoss);
    this.world.events.on('ult-cutin', onCut);
    this.events.once('shutdown', () => {
      this.world.events.off('hud-msg', onMsg);
      this.world.events.off('hud-title', onTitle);
      this.world.events.off('boss-hp', onBoss);
      this.world.events.off('ult-cutin', onCut);
    });
    this.events.on('resume', () => { this.applyButtonMode(); this.refreshFace(); });
  }

  /** HUD 장식 텍스처 (한 번만 생성) */
  private ensureOrnaments() {
    if (this.textures.exists('hud_plate')) return;
    // 초상 옆 먹색 판 + 금테 + 구름 문양
    {
      const [c, ctx] = makeCanvas(480, 150);
      const g = ctx.createLinearGradient(0, 0, 480, 0);
      g.addColorStop(0, 'rgba(20,16,32,0.82)'); g.addColorStop(0.75, 'rgba(20,16,32,0.6)'); g.addColorStop(1, 'rgba(20,16,32,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(60, 20); ctx.lineTo(440, 20); ctx.quadraticCurveTo(470, 66, 440, 112); ctx.lineTo(60, 112); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(226,177,76,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(110, 22); ctx.lineTo(420, 22); ctx.moveTo(110, 110); ctx.lineTo(400, 110); ctx.stroke();
      cloudSwirl(ctx, 438, 98, 0.9, 'rgba(226,177,76,0)', 'rgba(226,177,76,0.9)', false, 1.5);
      addCanvas(this, 'hud_plate', c);
    }
    // 초상 금테 (이중 고리 + 구름 꼬리)
    {
      const [c, ctx] = makeCanvas(140, 140);
      ctx.strokeStyle = '#e2b14c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(70, 70, 52, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#7a5a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(70, 70, 56, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#fff1c4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(70, 70, 47, 0, Math.PI * 2); ctx.stroke();
      cloudSwirl(ctx, 22, 112, 0.9, '#e2b14c', '#7a5a1e', true, 1.3);
      cloudSwirl(ctx, 112, 24, 0.7, '#e2b14c', '#7a5a1e', false, 1.3);
      addCanvas(this, 'hud_ring', c);
    }
    // 지역 현판
    {
      const [c, ctx] = makeCanvas(300, 70);
      const g = ctx.createLinearGradient(0, 0, 0, 70);
      g.addColorStop(0, 'rgba(40,32,58,0.92)'); g.addColorStop(1, 'rgba(18,14,28,0.92)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(28, 6); ctx.lineTo(272, 6); ctx.quadraticCurveTo(296, 35, 272, 64); ctx.lineTo(28, 64); ctx.quadraticCurveTo(4, 35, 28, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e2b14c'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(226,177,76,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(34, 12); ctx.lineTo(266, 12); ctx.moveTo(34, 58); ctx.lineTo(266, 58); ctx.stroke();
      for (const x of [16, 284]) { ctx.fillStyle = '#e2b14c'; ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x + (x < 150 ? 8 : -8), 35); ctx.lineTo(x, 44); ctx.lineTo(x + (x < 150 ? -6 : 6), 35); ctx.closePath(); ctx.fill(); }
      addCanvas(this, 'hud_banner', c);
    }
    // 이동 버튼 사이 금빛 구름
    {
      const [c, ctx] = makeCanvas(150, 60);
      cloudSwirl(ctx, 75, 34, 1.4, 'rgba(226,177,76,0.18)', 'rgba(226,177,76,0.85)', false, 1.6);
      addCanvas(this, 'hud_cloud', c);
    }
  }

  private applyButtonMode() {
    const mode = store.state.data.settings.touch;
    this.showBtns = mode !== 'off';
    this.btnLayer.setVisible(this.showBtns);
    this.legend.setVisible(!this.showBtns && !isTouchDevice());
  }

  /** 라이더 얼굴 초상 */
  private faceTexture() {
    const outfit = store.state.data.cosmetics.outfit;
    this.lastOutfit = outfit;
    const key = `face_${outfit}`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get(`rider_${outfit}`);
    const fr = src.get('idle_0');
    const [c, ctx] = makeCanvas(84, 84);
    ctx.beginPath();
    ctx.arc(42, 42, 42, 0, Math.PI * 2);
    ctx.clip();
    const bg = ctx.createRadialGradient(42, 30, 6, 42, 42, 44);
    bg.addColorStop(0, '#fff3dc'); bg.addColorStop(1, '#e8c9a0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 84, 84);
    const img = src.getSourceImage() as HTMLCanvasElement;
    ctx.drawImage(img, fr.cutX + 56 - 32, fr.cutY + 46 - 30, 64, 64, 0, 4, 84, 84);
    addCanvas(this, key, c);
    return key;
  }
  private refreshFace() {
    if (store.state.data.cosmetics.outfit !== this.lastOutfit && this.textures.exists(`rider_${store.state.data.cosmetics.outfit}`)) {
      this.face.setTexture(this.faceTexture()).setDisplaySize(94, 94);
    }
  }

  message(m: string, color: string) {
    const y = 170 + this.msgs.length * 36;
    const t = txt(this, GAME_W / 2, y, m, 21, color, { stroke: '#1d1a2b', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setAlpha(0);
    this.msgs.push(t);
    this.tweens.add({ targets: t, alpha: 1, duration: 200 });
    this.tweens.add({
      targets: t, alpha: 0, y: y - 20, delay: 2200, duration: 400,
      onComplete: () => { t.destroy(); this.msgs = this.msgs.filter((x) => x !== t); },
    });
  }

  titleCard(title: string, sub: string) {
    const c = this.add.container(GAME_W / 2, GAME_H / 2 - 120).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(0x1d1a2b, 0.55);
    g.fillRoundedRect(-280, -56, 560, 112, 20);
    c.add(g);
    c.add(txt(this, 0, -16, title, 40, '#f6ead0', { title: true, stroke: '#1d1a2b', strokeThickness: 6 }).setOrigin(0.5));
    c.add(txt(this, 0, 30, sub, 22, '#e2b14c', { title: true }).setOrigin(0.5));
    this.tweens.add({ targets: c, alpha: 1, duration: 500 });
    this.tweens.add({ targets: c, alpha: 0, delay: 2200, duration: 600, onComplete: () => c.destroy() });
  }

  /** 필살기 컷인: 먹 띠 + 영물 원화 + 기술 이름 */
  private cutIn(id: MountId, stage: number, name: string, hanja: string, ink: string, color: number) {
    const c = this.add.container(0, 0).setDepth(500);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.35).setOrigin(0);
    const band = this.add.graphics();
    band.fillStyle(Phaser.Display.Color.HexStringToColor(ink).color, 0.92);
    band.beginPath();
    band.moveTo(-40, GAME_H / 2 - 120); band.lineTo(GAME_W + 40, GAME_H / 2 - 160); band.lineTo(GAME_W + 40, GAME_H / 2 + 90); band.lineTo(-40, GAME_H / 2 + 130);
    band.closePath(); band.fillPath();
    band.lineStyle(4, 0xe2b14c, 1);
    band.lineBetween(-40, GAME_H / 2 - 120, GAME_W + 40, GAME_H / 2 - 160);
    band.lineBetween(-40, GAME_H / 2 + 130, GAME_W + 40, GAME_H / 2 + 90);
    const glow = this.add.image(380, GAME_H / 2, 'wisp_gold').setScale(24).setTint(color).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD);
    const key = ensurePortrait(this, id, stage, 'normal', store.state.data.mounts[id]?.skin);
    const info = MOUNT_ART[artKey(id, stage)];
    const por = this.add.image(-260, GAME_H / 2 + 120, key).setOrigin(0.5, 1).setScale(Math.min(2.4, 380 / info.w, 300 / info.h));
    const title = txt(this, GAME_W + 300, GAME_H / 2 - 30, name, 64, '#fff6e0', { title: true, stroke: '#1d1a2b', strokeThickness: 10 }).setOrigin(0.5);
    const sub = txt(this, GAME_W + 300, GAME_H / 2 + 40, hanja, 30, '#e2b14c', { title: true, stroke: '#1d1a2b', strokeThickness: 6 }).setOrigin(0.5);
    c.add([dim, band, glow, por, title, sub]);
    band.setScale(1, 0.05).setY(GAME_H / 2 * 0.95);
    this.tweens.add({ targets: band, scaleY: 1, y: 0, duration: 140, ease: 'Cubic.out' });
    this.tweens.add({ targets: por, x: 360, duration: 260, ease: 'Back.out' });
    this.tweens.add({ targets: [title, sub], x: 880, duration: 260, delay: 60, ease: 'Back.out' });
    this.cameras.main.flash(160, 255, 255, 255);
    audio.play('boss');
    this.tweens.add({ targets: c, alpha: 0, delay: 760, duration: 180, onComplete: () => c.destroy() });
  }

  update() {
    const p = this.world.player;
    if (!p) return;
    const st = store.state;
    const m = st.active;
    this.lv.setText(`Lv. ${m.level}`);
    this.nameText.setText(`${MOUNTS[m.id].name} · ${MOUNTS[m.id].stages[m.stage].name}`);
    this.nameText.x = 136 + this.lv.width + 12;
    this.hp.set(p.hp / p.maxHp);
    this.hpText.setText(`${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`);
    this.exp.set(m.exp / expToNext(m.level));
    this.goldText.setText(`${st.count('gold')}`);
    this.stoneText.setText(`${st.count('spirit_stone')}`);
    const shards = st.count('pearl_shard');
    this.pearlText.setText(!st.owns('cheongryong') && shards > 0 ? `여의주 ${shards}/3` : '');
    // 구간 진행
    const map = this.world.map;
    const px0 = GAME_W / 2 - 170, pw = 340;
    const prog = Phaser.Math.Clamp((p.x - map.spawn.x) / Math.max(1, map.goal.x - map.spawn.x), 0, 1);
    const g = this.progress;
    g.clear();
    g.fillStyle(0x1d1a2b, 0.55); g.fillRoundedRect(px0 - 6, 20, pw + 12, 12, 6);
    g.fillStyle(0xe2b14c, 0.9); g.fillRoundedRect(px0, 23, pw * prog, 6, 3);
    g.fillStyle(0xc3352c, 1); g.fillRect(px0 + pw - 3, 16, 6, 20);
    this.progressIcon.x = px0 + pw * prog;
    // 쿨타임
    const cds: Partial<Record<Btn, [number, number]>> = {
      attack: [Math.max(0, p.attackCD), Math.max(0.2, p.attackCD > 0.45 ? p.attackSkill.cooldown : RANGED[p.def.id as MountId].cd)],
      special: [Math.max(0, p.specialCD), p.specialSkill.cooldown],
      dash: [Math.max(0, p.dashCD), p.mv.dash.cooldown],
    };
    if (this.showBtns) {
      for (const b of this.btns) {
        if (b.btn === 'down') b.img.setVisible(p.flying);
        if (!b.cd) continue;
        const v = cds[b.btn];
        b.cd.clear();
        if (v && v[0] > 0.05) {
          b.cd.fillStyle(0x000000, 0.5);
          b.cd.slice(b.img.x, b.img.y, b.r * 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, v[0] / v[1]), false);
          b.cd.fillPath();
        }
      }
      // 필살기 게이지 고리
      const lotus = this.btns.find((b) => b.btn === 'ult')!;
      const r = this.ultRing;
      r.clear();
      r.lineStyle(7, 0x2a2238, 0.9);
      r.strokeCircle(lotus.img.x, lotus.img.y, lotus.r + 6);
      r.lineStyle(7, p.ult >= 100 ? 0xffe08a : 0xf2a7c0, 1);
      r.beginPath();
      r.arc(lotus.img.x, lotus.img.y, lotus.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.ult / 100), false);
      r.strokePath();
      this.ultGlow.setAlpha(p.ult >= 100 ? 0.5 + Math.sin(this.time.now / 160) * 0.25 : 0);
      this.rangedText.setText(RANGED[p.def.id as MountId].name);
    }
    if (p.ult >= 100 && !this.ultReadyShown) {
      this.ultReadyShown = true;
      this.message('필살기 준비 완료! (U / 연꽃 버튼)', '#ffe08a');
    } else if (p.ult < 100) this.ultReadyShown = false;
  }
}
