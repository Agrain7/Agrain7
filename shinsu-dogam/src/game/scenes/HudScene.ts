// 플레이 화면 UI: 좌상단 프로필·레벨·체력·경험치, 우상단 지역명·일시정지, 하단 터치 버튼
import Phaser from 'phaser';
import type { WorldScene } from './WorldScene.ts';
import { txt, bar } from '../../ui/widgets.ts';
import { store } from '../ctx.ts';
import { controls, type Btn } from '../controls.ts';
import { MOUNTS } from '../../data/mounts.ts';
import { expToNext } from '../../systems/state.ts';
import { GAME_W, GAME_H, COLORS, isTouchDevice } from '../config.ts';
import { addCanvas } from '../textures.ts';
import { makeCanvas } from '../../art/paint.ts';
import { audio } from '../../systems/audio.ts';

interface TouchBtn { img: Phaser.GameObjects.Image; btn: Btn; cd?: Phaser.GameObjects.Graphics; r: number }

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
  private touchBtns: TouchBtn[] = [];
  private touchLayer!: Phaser.GameObjects.Container;
  private hints!: Phaser.GameObjects.Container;
  private bossLayer!: Phaser.GameObjects.Container;
  private bossBar!: ReturnType<typeof bar>;
  private msgs: Phaser.GameObjects.Text[] = [];
  private cdIcons!: Phaser.GameObjects.Graphics;
  private touchOn = false;
  private lastOutfit = '';

  constructor() {
    super('Hud');
  }

  create() {
    this.world = this.scene.get('World') as WorldScene;
    this.touchBtns = [];
    this.msgs = [];
    // ---- 좌상단 프로필 ----
    const g = this.add.graphics();
    g.fillStyle(0x1d1a2b, 0.55);
    g.fillRoundedRect(14, 12, 400, 104, 18);
    g.lineStyle(2, 0xe2b14c, 0.8);
    g.strokeRoundedRect(14, 12, 400, 104, 18);
    this.add.circle(66, 64, 44, 0xf2e6cc).setStrokeStyle(4, 0xe2b14c);
    this.face = this.add.image(66, 64, this.faceTexture()).setDisplaySize(84, 84);
    this.lv = txt(this, 122, 20, 'Lv. 1', 24, COLORS.textLight, { title: true, stroke: '#1d1a2b', strokeThickness: 4 });
    this.nameText = txt(this, 210, 25, '', 17, '#e8dcc4', { stroke: '#1d1a2b', strokeThickness: 3 });
    this.hp = bar(this, 122, 54, 270, 18, COLORS.hp);
    this.hpText = txt(this, 257, 63, '', 14, '#ffffff', { stroke: '#1d1a2b', strokeThickness: 3 }).setOrigin(0.5);
    this.exp = bar(this, 122, 80, 270, 12, COLORS.exp);
    // 재화
    this.add.image(436, 34, 'icon_gold').setScale(0.42);
    this.goldText = txt(this, 456, 22, '0', 20, COLORS.textLight, { stroke: '#1d1a2b', strokeThickness: 4 });
    this.add.image(436, 72, 'icon_stone').setScale(0.42);
    this.stoneText = txt(this, 456, 60, '0', 20, COLORS.textLight, { stroke: '#1d1a2b', strokeThickness: 4 });
    this.pearlText = txt(this, 530, 60, '', 18, '#bfe9ff', { stroke: '#1d1a2b', strokeThickness: 4 });
    // ---- 우상단 지역명 + 일시정지 ----
    const map = this.world.map;
    const tg = this.add.graphics();
    tg.fillStyle(0x1d1a2b, 0.6);
    tg.fillRoundedRect(GAME_W - 330, 18, 236, 52, 26);
    tg.lineStyle(2, 0xe2b14c, 0.9);
    tg.strokeRoundedRect(GAME_W - 330, 18, 236, 52, 26);
    txt(this, GAME_W - 212, 44, `${map.name} ${map.id}`, 22, COLORS.textLight, { title: true }).setOrigin(0.5);
    const pause = this.add.image(GAME_W - 52, 44, 'btn_pause').setScale(0.5).setInteractive({ useHandCursor: true });
    pause.on('pointerup', () => { audio.unlock(); this.world.openMenu('stable'); });
    const sw = this.add.image(GAME_W - 52, 104, 'btn_swap').setScale(0.42).setInteractive({ useHandCursor: true });
    sw.on('pointerdown', () => { controls.touch.swap = true; });
    sw.on('pointerup', () => { controls.touch.swap = false; });
    sw.on('pointerout', () => { controls.touch.swap = false; });
    sw.setVisible(store.state.ownedMounts().length > 1);
    // ---- 보스 체력 ----
    this.bossLayer = this.add.container(0, 0).setVisible(false);
    const bt = txt(this, GAME_W / 2, 92, '흑운 산군', 22, '#ffd0c8', { title: true, stroke: '#1d1a2b', strokeThickness: 5 }).setOrigin(0.5);
    this.bossBar = bar(this, GAME_W / 2 - 260, 112, 520, 18, 0x8a2be2);
    this.bossLayer.add([bt, this.bossBar.g]);
    // ---- 터치 버튼 ----
    this.touchLayer = this.add.container(0, 0);
    const mk = (key: string, x: number, y: number, btn: Btn, s = 0.86, withCd = false) => {
      const img = this.add.image(x, y, key).setScale(s).setAlpha(0.9).setInteractive();
      const r = 56 * s;
      const on = (p: Phaser.Input.Pointer) => { controls.touch[btn] = true; controls.usedTouch = true; audio.unlock(); img.setScale(s * 0.92); void p; };
      const off = () => { controls.touch[btn] = false; img.setScale(s); };
      img.on('pointerdown', on);
      img.on('pointerup', off);
      img.on('pointerout', off);
      const cd = withCd ? this.add.graphics() : undefined;
      this.touchLayer.add(img);
      if (cd) this.touchLayer.add(cd);
      this.touchBtns.push({ img, btn, cd, r });
    };
    mk('btn_left', 92, GAME_H - 92, 'left');
    mk('btn_right', 222, GAME_H - 92, 'right');
    mk('btn_down', 157, GAME_H - 205, 'down', 0.62);
    mk('btn_attack', GAME_W - 300, GAME_H - 82, 'attack', 0.86, true);
    mk('btn_skill', GAME_W - 215, GAME_H - 190, 'special', 0.8, true);
    mk('btn_dash', GAME_W - 100, GAME_H - 245, 'dash', 0.68, true);
    mk('btn_jump', GAME_W - 112, GAME_H - 96, 'jump', 1.0);
    // ---- PC 키 안내 + 쿨타임 ----
    this.hints = this.add.container(0, 0);
    const hg = this.add.graphics();
    hg.fillStyle(0x1d1a2b, 0.5);
    hg.fillRoundedRect(GAME_W - 560, GAME_H - 46, 548, 34, 17);
    this.hints.add(hg);
    this.hints.add(txt(this, GAME_W - 286, GAME_H - 29, 'A·D 이동  Space 점프  J 공격  K 기술  L 돌진  Q 교체  Esc 메뉴', 15, '#f6ead0').setOrigin(0.5));
    this.cdIcons = this.add.graphics();
    this.hints.add(this.cdIcons);
    this.hints.add(txt(this, GAME_W - 40, GAME_H - 80, 'K', 16, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
    this.hints.add(txt(this, GAME_W - 86, GAME_H - 80, 'L', 16, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5));
    this.applyTouchMode();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch && !this.touchOn && store.state.data.settings.touch === 'auto') {
        controls.usedTouch = true;
        this.applyTouchMode();
      }
    });
    // ---- 월드 이벤트 ----
    const onMsg = (m: string, c: string) => this.message(m, c);
    const onTitle = (t: string, s: string) => this.titleCard(t, s);
    const onBoss = (hp: number, max: number, show: boolean) => {
      this.bossLayer.setVisible(show);
      this.bossBar.set(hp / max);
    };
    this.world.events.on('hud-msg', onMsg);
    this.world.events.on('hud-title', onTitle);
    this.world.events.on('boss-hp', onBoss);
    this.events.once('shutdown', () => {
      this.world.events.off('hud-msg', onMsg);
      this.world.events.off('hud-title', onTitle);
      this.world.events.off('boss-hp', onBoss);
    });
    this.events.on('resume', () => { this.applyTouchMode(); this.refreshFace(); });
  }

  private applyTouchMode() {
    const mode = store.state.data.settings.touch;
    this.touchOn = mode === 'on' || (mode === 'auto' && (isTouchDevice() || controls.usedTouch));
    this.touchLayer.setVisible(this.touchOn);
    this.hints.setVisible(!this.touchOn);
  }

  /** 라이더 얼굴 초상 (라이더 시트에서 머리 부분을 원형으로 잘라냄) */
  private faceTexture() {
    const outfit = store.state.data.cosmetics.outfit;
    this.lastOutfit = outfit;
    const key = `face_${outfit}`;
    if (this.textures.exists(key)) return key;
    const rk = `rider_${outfit}`;
    const src = this.textures.get(rk);
    const fr = src.get('idle_0');
    const [c, ctx] = makeCanvas(84, 84);
    ctx.beginPath();
    ctx.arc(42, 42, 42, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#f2e6cc';
    ctx.fillRect(0, 0, 84, 84);
    const img = src.getSourceImage() as HTMLCanvasElement;
    ctx.drawImage(img, fr.cutX + 56 - 32, fr.cutY + 46 - 30, 64, 64, 0, 4, 84, 84);
    addCanvas(this, key, c);
    return key;
  }
  private refreshFace() {
    if (store.state.data.cosmetics.outfit !== this.lastOutfit && this.textures.exists(`rider_${store.state.data.cosmetics.outfit}`)) {
      this.face.setTexture(this.faceTexture()).setDisplaySize(84, 84);
    }
  }

  message(m: string, color: string) {
    const y = 150 + this.msgs.length * 38;
    const t = txt(this, GAME_W / 2, y, m, 22, color, { stroke: '#1d1a2b', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setAlpha(0);
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

  update() {
    const p = this.world.player;
    if (!p) return;
    const st = store.state;
    const m = st.active;
    this.lv.setText(`Lv. ${m.level}`);
    this.nameText.setText(`${MOUNTS[m.id].name} · ${MOUNTS[m.id].stages[m.stage].name}`);
    this.hp.set(p.hp / p.maxHp);
    this.hpText.setText(`${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`);
    this.exp.set(m.exp / expToNext(m.level));
    this.goldText.setText(`${st.count('gold')}`);
    this.stoneText.setText(`${st.count('spirit_stone')}`);
    const shards = st.count('pearl_shard');
    this.pearlText.setText(!st.owns('cheongryong') && shards > 0 ? `여의주 ${shards}/3` : '');
    // 쿨타임 표시
    const cds: Partial<Record<Btn, [number, number]>> = {
      attack: [Math.max(0, p.attackCD), p.attackSkill.cooldown],
      special: [Math.max(0, p.specialCD), p.specialSkill.cooldown],
      dash: [Math.max(0, p.dashCD), p.mv.dash.cooldown],
    };
    if (this.touchOn) {
      for (const tb of this.touchBtns) {
        if (tb.btn === 'down') tb.img.setVisible(p.flying);
        if (!tb.cd) continue;
        const v = cds[tb.btn];
        tb.cd.clear();
        if (v && v[0] > 0) {
          tb.cd.fillStyle(0x000000, 0.5);
          tb.cd.slice(tb.img.x, tb.img.y, tb.r * 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (v[0] / v[1]), false);
          tb.cd.fillPath();
        }
      }
    } else {
      const g = this.cdIcons;
      g.clear();
      const names: [Btn, string][] = [['special', 'K'], ['dash', 'L']];
      names.forEach(([b], i) => {
        const v = cds[b]!;
        const x = GAME_W - 600 - i * 0, y = GAME_H - 90 - i * 44;
        g.fillStyle(0x1d1a2b, 0.6);
        g.fillCircle(GAME_W - 40 - i * 46, GAME_H - 80, 18);
        if (v[0] > 0) {
          g.fillStyle(0xc3352c, 0.8);
          g.slice(GAME_W - 40 - i * 46, GAME_H - 80, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (v[0] / v[1]), false);
          g.fillPath();
        } else {
          g.lineStyle(3, 0xe2b14c, 1);
          g.strokeCircle(GAME_W - 40 - i * 46, GAME_H - 80, 18);
        }
        void x; void y;
      });
    }
  }
}
