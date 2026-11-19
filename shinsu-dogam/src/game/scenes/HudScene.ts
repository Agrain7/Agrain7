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
import { addCanvas, riderMeta } from '../textures.ts';
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
  /** 원형 방향키 (테스트·키보드 표시용) */
  joy?: { cx: number; cy: number; R: number; knob: Phaser.GameObjects.Image };
  private bossName!: Phaser.GameObjects.Text;
  private bossLayer!: Phaser.GameObjects.Container;
  private bossBar!: ReturnType<typeof bar>;
  private msgs: Phaser.GameObjects.Text[] = [];
  private ultRing!: Phaser.GameObjects.Graphics;
  private ultGlow!: Phaser.GameObjects.Image;
  private progress!: Phaser.GameObjects.Graphics;
  private progressIcon!: Phaser.GameObjects.Image;
  private showBtns = true;
  private lastOutfit = '';

  constructor() {
    super('Hud');
  }

  create() {
    this.world = this.scene.get('World') as WorldScene;
    this.btns = [];
    this.msgs = [];
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
    sw.setVisible(store.state.rideableMounts().length > 1);
    if (sw.visible) txt(this, GAME_W - 62, 146, 'Q 교체', 12, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5);
    // ---- 상단 가운데: 구간 진행 (편의) ----
    this.progress = this.add.graphics();
    this.progressIcon = this.add.image(0, 26, 'wisp_gold').setScale(1.2);
    // ---- 보스 체력 ----
    this.bossLayer = this.add.container(0, 0).setVisible(false);
    const bt = this.bossName = txt(this, GAME_W / 2, 96, '흑운 산군', 22, '#ffd0c8', { title: true, stroke: '#1d1a2b', strokeThickness: 5 }).setOrigin(0.5);
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
    // 좌하단 이동: 원형 방향키 (손가락을 대고 끌면 그 방향으로, 위·아래는 비행 상승·하강)
    this.makeJoystick(pc);
    // 우하단 기술
    mk('btn_swirl_blue', GAME_W - 478, GAME_H - 92, 'attack', 0.82, true, 'Z 공격');
    mk('btn_swirl_red', GAME_W - 362, GAME_H - 92, 'special', 0.82, true, 'C 기술');
    const lotus = mk('btn_lotus', GAME_W - 246, GAME_H - 92, 'ult', 0.82, false, 'V 필살기');
    mk('btn_jump', GAME_W - 112, GAME_H - 108, 'jump', 1.04, false, 'Space 점프');
    mk('btn_dash', GAME_W - 112, GAME_H - 250, 'dash', 0.66, true, 'X 돌진');
    this.ultGlow = this.add.image(lotus.img.x, lotus.img.y, 'wisp_gold').setScale(7).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.btnLayer.addAt(this.ultGlow, 0);
    this.ultRing = this.add.graphics();
    this.btnLayer.add(this.ultRing);
    this.legend = txt(this, GAME_W / 2, GAME_H - 16, 'A·D 이동 · Space 점프(길게: 활공·비행) · Z 공격(누르고 있으면 연속, 멀면 원거리) · X 돌진 · C 기술 · V 필살기 · Q 교체 · Esc 메뉴', 13, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5).setAlpha(0.85);
    this.applyButtonMode();
    // ---- 월드 이벤트 ----
    const onMsg = (m: string, c: string) => this.message(m, c);
    const onTitle = (t: string, s: string) => this.titleCard(t, s);
    const onBoss = (hp: number, max: number, show: boolean, name?: string) => { this.bossLayer.setVisible(show); this.bossBar.set(hp / max); if (name && this.bossName.text !== name) this.bossName.setText(name); };
    this.world.events.on('hud-msg', onMsg);
    this.world.events.on('hud-title', onTitle);
    this.world.events.on('boss-hp', onBoss);
    this.events.once('shutdown', () => {
      this.world.events.off('hud-msg', onMsg);
      this.world.events.off('hud-title', onTitle);
      this.world.events.off('boss-hp', onBoss);
    });
    this.events.on('resume', () => { this.applyButtonMode(); this.refreshFace(); });
  }

  /** 원형 방향키 */
  private makeJoystick(pc: boolean) {
    const cx = 146, cy = GAME_H - 118, R = 76;
    const base = this.add.image(cx, cy, 'joy_base').setAlpha(0.92).setScale(0.8);
    const knob = this.add.image(cx, cy, 'joy_knob').setScale(0.82);
    this.btnLayer.add([base, knob]);
    if (pc) this.btnLayer.add(txt(this, cx, cy + R + 14, 'A·D / ← →', 13, '#f6ead0', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5));
    // 넓은 터치 영역 (왼쪽 아래) — 처음 닿은 손가락 하나만 따라간다
    const zone = this.add.zone(0, GAME_H - 360, 440, 360).setOrigin(0).setInteractive();
    this.btnLayer.addAt(zone, 0);
    let pid = -1;
    const set = (px: number, py: number) => {
      let dx = px - cx, dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.setPosition(cx + dx, cy + dy);
      const nx = dx / R, ny = dy / R;
      controls.touch.left = nx < -0.28;
      controls.touch.right = nx > 0.28;
      controls.touch.up = ny < -0.55;
      controls.touch.down = ny > 0.55;
    };
    const release = () => {
      pid = -1;
      controls.touch.left = controls.touch.right = controls.touch.up = controls.touch.down = false;
      this.tweens.add({ targets: knob, x: cx, y: cy, duration: 90, ease: 'Quad.out' });
      base.setAlpha(0.92);
    };
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (pid !== -1) return;
      pid = p.id;
      controls.usedTouch = true;
      audio.unlock();
      base.setAlpha(1);
      set(p.x, p.y);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.id === pid && p.isDown) set(p.x, p.y); });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.id === pid) release(); });
    this.input.on('gameout', () => { if (pid !== -1) release(); });
    this.joy = { cx, cy, R, knob };
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
    // 기본 의상: 참고 화면의 소녀 초상을 그대로 사용 (tools/extract_backdrop.py)
    if (outfit === 'outfit_default' && this.textures.exists('ref_portrait')) return 'ref_portrait';
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
    const [fx, fy, fr2] = riderMeta(`rider_${outfit}`).face;
    ctx.drawImage(img, fr.cutX + fx - fr2, fr.cutY + fy - fr2 + 2, fr2 * 2, fr2 * 2, 0, 4, 84, 84);
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
    }
  }
}
