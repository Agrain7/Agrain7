// 이야기 대화창: 한지 상자 + 붉은 이름패 + 하람 초상(왼쪽) + 영물/보스 원화(오른쪽) + 글자 한 자씩.
// 누르면 다음 (글자가 나오는 중이면 끝까지), 건너뛰기 · 자동. 영물의 말은 '마음의 목소리'로 표시한다.
import Phaser from 'phaser';
import { txt, button, card, fitInto, setScrollsHidden } from './widgets.ts';
import { SCENES, CHAPTERS, type Line, type StoryScene } from '../data/story.ts';
import { MOUNTS } from '../data/mounts.ts';
import { MONSTER_ART, monsterImageKey } from '../data/monsterArt.ts';
import type { MountId } from '../data/types.ts';
import { ensurePortrait } from '../game/textures.ts';
import { store } from '../game/ctx.ts';
import { GAME_W, GAME_H } from '../game/config.ts';
import { audio } from '../systems/audio.ts';
import { analytics } from '../services/analytics/Analytics.ts';

export interface DialogueOpts {
  /** 서장처럼 배경 위에 큰 글씨로 해설 (상자 없이) */
  cinematic?: boolean;
  /** 장 제목 카드를 먼저 */
  chapterCard?: boolean;
  /** 장 제목 카드 아래 작은 줄 (예: 월하산맥 1-1 · 산자락의 오솔길) */
  cardSub?: string;
  /** 뒤를 어둡게 (0~1) */
  dim?: number;
  depth?: number;
  /** 메뉴처럼 끌어 넘기는 목록이 있는 장면이면 숨김 */
  hideScrolls?: boolean;
  onDone: () => void;
}

let autoMode = false;
const BOX = { x: 70, y: 520, w: GAME_W - 140, h: 176 };
const CPS = 42; // 초당 글자

/** 장면 재생 (본 것으로 기록). 없는 id 면 바로 onDone */
export function playStory(scene: Phaser.Scene, id: string, opts: DialogueOpts) {
  const sc = SCENES[id];
  if (!sc) { opts.onDone(); return null; }
  store.state.markStory(id);
  store.state.save();
  analytics.track('story_view', { id });
  return new Dialogue(scene, sc, opts);
}

export class Dialogue {
  private layer: Phaser.GameObjects.Container;
  private i = -1;
  private full = '';
  private shown = 0;
  private typing?: Phaser.Time.TimerEvent;
  private autoT?: Phaser.Time.TimerEvent;
  private box!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Text;
  private plate!: Phaser.GameObjects.Container;
  private center!: Phaser.GameObjects.Text;
  private haram!: Phaser.GameObjects.Container;
  private beast?: Phaser.GameObjects.Image;
  private beastWho: string | null = null;
  private arrow!: Phaser.GameObjects.Text;
  private autoBtn!: ReturnType<typeof button>;
  private cardOn = false;
  private ended = false;
  private keys: [string, () => void][] = [];

  constructor(private scene: Phaser.Scene, private sc: StoryScene, private opts: DialogueOpts) {
    const s = scene;
    this.layer = s.add.container(0, 0).setDepth(opts.depth ?? 3000);
    if (opts.hideScrolls) setScrollsHidden(s, true);
    // 누르는 판 (화면 전체) + 어둡게
    const hit = s.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0912, opts.dim ?? 0.45).setOrigin(0).setInteractive();
    hit.on('pointerup', () => this.advance());
    this.layer.add(hit);
    // 위·아래 먹 띠 (영화처럼)
    const top = s.add.rectangle(0, 0, GAME_W, 0, 0x0b0912, 0.92).setOrigin(0);
    this.layer.add(top);
    s.tweens.add({ targets: top, height: 40, duration: 380, ease: 'Cubic.out' });
    // 오른쪽: 영물/보스 그림 자리, 왼쪽: 하람 초상
    this.haram = s.add.container(170, 448).setAlpha(0);
    const ring = s.add.graphics();
    ring.fillStyle(0x2b2438, 0.35).fillCircle(4, 6, 76);
    ring.fillStyle(0xfbf3e2, 1).fillCircle(0, 0, 76);
    ring.lineStyle(5, 0xc9a24a, 1).strokeCircle(0, 0, 76);
    ring.lineStyle(2, 0xb8322a, 1).strokeCircle(0, 0, 69);
    this.haram.add(ring);
    if (s.textures.exists('ref_portrait')) this.haram.add(s.add.image(0, 0, 'ref_portrait').setDisplaySize(132, 132));
    this.layer.add(this.haram);
    // 대화 상자
    this.box = s.add.container(0, 0).setAlpha(0);
    this.box.add(card(s, BOX.x, BOX.y, BOX.w, BOX.h));
    const deco = s.add.tileSprite(BOX.x + 18, BOX.y + BOX.h - 16, BOX.w - 36, 22, 'ui_dancheong').setOrigin(0, 0).setScale(1, 0.32).setAlpha(0.85);
    this.box.add(deco);
    this.body = txt(s, BOX.x + 48, BOX.y + 40, '', 24, '#3a2a22', { wordWrap: { width: BOX.w - 110, useAdvancedWrap: true }, lineSpacing: 10 });
    this.box.add(this.body);
    this.arrow = txt(s, BOX.x + BOX.w - 44, BOX.y + BOX.h - 46, '▼', 20, '#b8322a').setOrigin(0.5).setAlpha(0);
    s.tweens.add({ targets: this.arrow, y: this.arrow.y + 5, yoyo: true, repeat: -1, duration: 420 });
    this.box.add(this.arrow);
    this.plate = s.add.container(BOX.x + 40, BOX.y - 2);
    this.box.add(this.plate);
    this.layer.add(this.box);
    // 서장용 큰 해설 글씨
    this.center = txt(s, GAME_W / 2, GAME_H / 2 - 40, '', 30, '#f6ead0', { title: true, align: 'center', wordWrap: { width: 980, useAdvancedWrap: true }, lineSpacing: 14, stroke: '#14121d', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
    this.layer.add(this.center);
    // 건너뛰기 · 자동 (e2e 도 1170,50 을 누른다)
    this.autoBtn = button(s, 1010, 50, 128, 44, autoMode ? '자동 ■' : '자동 ▶', () => this.toggleAuto(), autoMode ? 'primary' : 'normal', 16);
    const skip = button(s, 1170, 50, 160, 44, '건너뛰기 ≫', () => this.finish(), 'normal', 16);
    this.layer.add([this.autoBtn, skip]);
    // 키보드
    const kb = s.input.keyboard;
    const on = (ev: string, fn: () => void) => { kb?.on(ev, fn); this.keys.push([ev, fn]); };
    on('keydown-SPACE', () => this.advance());
    on('keydown-ENTER', () => this.advance());
    on('keydown-Z', () => this.advance());
    on('keydown-ESC', () => this.finish());
    if (opts.chapterCard) this.showChapter();
    else this.next();
  }

  private showChapter() {
    const s = this.scene;
    const ch = CHAPTERS.find((c) => c.n === this.sc.chapter);
    if (!ch) { this.next(); return; }
    this.cardOn = true;
    const c = s.add.container(GAME_W / 2, GAME_H / 2 - 30).setAlpha(0);
    const g = s.add.graphics();
    // 먹 붓 띠
    g.fillStyle(0x14121d, 0.72);
    g.fillRoundedRect(-360, -70, 720, 140, 24);
    g.lineStyle(2, 0xc9a24a, 0.9).lineBetween(-300, 40, 300, 40);
    c.add(g);
    c.add(txt(s, 0, -36, ch.head, 22, '#e2b14c', { title: true }).setOrigin(0.5));
    c.add(txt(s, 0, 6, ch.name, 40, '#f6ead0', { title: true, stroke: '#14121d', strokeThickness: 5 }).setOrigin(0.5));
    if (this.opts.cardSub) c.add(txt(s, 0, 56, this.opts.cardSub, 17, '#e8dcc4', { title: true }).setOrigin(0.5));
    this.layer.add(c);
    s.tweens.add({ targets: c, alpha: 1, duration: 600 });
    const go = () => {
      if (!this.cardOn) return;
      this.cardOn = false;
      s.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() });
      this.next();
    };
    this.cardGo = go;
    s.time.delayedCall(2000, go);
  }
  private cardGo?: () => void;

  private toggleAuto() {
    autoMode = !autoMode;
    this.autoBtn.setLabel(autoMode ? '자동 ■' : '자동 ▶');
    if (autoMode && this.shown >= this.full.length) this.scheduleAuto();
    if (!autoMode) this.autoT?.remove();
  }

  private advance() {
    if (this.ended) return;
    if (this.cardOn) { this.cardGo?.(); return; }
    if (this.shown < this.full.length) { this.completeLine(); return; }
    this.next();
  }

  private next() {
    this.autoT?.remove();
    this.i++;
    if (this.i >= this.sc.lines.length) { this.finish(); return; }
    const line = this.sc.lines[this.i];
    this.showLine(line);
  }

  private nameOf(line: Line): { name: string; voice: boolean } {
    if (line.who === 'haram') return { name: '하람', voice: false };
    if (line.who === 'boss') return { name: this.sc.bossName ?? '???', voice: false };
    if (line.who === 'narr') return { name: '', voice: false };
    const d = MOUNTS[line.who as MountId];
    return { name: `${d.name} ${d.hanja}`, voice: true };
  }

  private showLine(line: Line) {
    const s = this.scene;
    const narr = line.who === 'narr';
    const cine = narr && this.opts.cinematic;
    // 그림
    if (line.who === 'haram') this.focus('haram');
    else if (!narr) this.setBeast(line.who);
    if (!narr) this.focus(line.who === 'haram' ? 'haram' : 'beast');
    // 글씨 자리
    if (cine) {
      s.tweens.add({ targets: this.box, alpha: 0, duration: 200 });
      this.center.setText('').setAlpha(1);
    } else {
      if (this.box.alpha < 1) s.tweens.add({ targets: this.box, alpha: 1, duration: 220 });
      this.center.setAlpha(0);
    }
    // 이름패
    this.plate.removeAll(true);
    const { name, voice } = this.nameOf(line);
    if (name && !cine) {
      const boss = line.who === 'boss';
      const t = txt(s, 18, 0, name, 19, '#fff4dc', { title: true }).setOrigin(0, 0.5);
      const g = s.add.graphics();
      g.fillStyle(boss ? 0x2b2438 : 0xb8322a, 1).fillRoundedRect(0, -19, t.width + 36, 38, 10);
      g.lineStyle(2, 0xe2b14c, 1).strokeRoundedRect(0, -19, t.width + 36, 38, 10);
      this.plate.add([g, t]);
      if (voice) {
        const vt = txt(s, t.width + 58, 0, '마음의 목소리', 13, '#2f7f74', { title: true }).setOrigin(0, 0.5);
        const vg = s.add.graphics();
        vg.fillStyle(0xfbf3e2, 1).fillRoundedRect(t.width + 46, -13, vt.width + 24, 26, 13);
        vg.lineStyle(1.5, 0x2f7f74, 0.8).strokeRoundedRect(t.width + 46, -13, vt.width + 24, 26, 13);
        this.plate.add([vg, vt]);
      }
    }
    // 글자색
    const color = cine ? '#f6ead0' : narr ? '#7a5a3a' : line.who === 'boss' ? '#7a2a2a' : line.who === 'haram' ? '#3a2a22' : '#24505e';
    const target = cine ? this.center : this.body;
    target.setColor(color);
    if (!cine) {
      this.body.setFontFamily(narr ? '"Gowun Batang", serif' : '"Gowun Dodum", "Gowun Batang", sans-serif');
      this.body.setX(narr ? BOX.x + 64 : BOX.x + 48);
    }
    this.full = line.who !== 'narr' && line.who !== 'haram' && line.who !== 'boss' ? `‘${line.text}’` : line.text;
    this.shown = 0;
    target.setText('');
    this.arrow.setAlpha(0);
    if (line.shout) s.cameras.main.shake(260, 0.006);
    this.typing?.remove();
    this.typing = s.time.addEvent({
      delay: 1000 / CPS, loop: true, callback: () => {
        this.shown = Math.min(this.full.length, this.shown + 1);
        target.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) this.completeLine();
      },
    });
  }

  private completeLine() {
    this.typing?.remove();
    this.shown = this.full.length;
    const cine = this.sc.lines[this.i]?.who === 'narr' && this.opts.cinematic;
    (cine ? this.center : this.body).setText(this.full);
    this.arrow.setAlpha(cine ? 0 : 1);
    if (autoMode) this.scheduleAuto();
  }

  private scheduleAuto() {
    this.autoT?.remove();
    this.autoT = this.scene.time.delayedCall(1200 + this.full.length * 45, () => this.next());
  }

  /** 말하는 쪽을 밝게, 듣는 쪽을 흐리게 */
  private focus(who: 'haram' | 'beast') {
    const s = this.scene;
    s.tweens.killTweensOf(this.haram);
    if (who === 'haram') {
      s.tweens.add({ targets: this.haram, alpha: 1, scale: 1, duration: 200 });
      if (this.beast) this.beast.setTint(0x9a92a0);
    } else {
      if (this.haram.alpha > 0) s.tweens.add({ targets: this.haram, alpha: 0.55, scale: 0.92, duration: 200 });
      this.beast?.clearTint();
      if (this.beastWho === 'boss') this.beast?.setTint(0x8a7090);
    }
  }

  private setBeast(who: string) {
    if (this.beastWho === who && this.beast) return;
    const s = this.scene;
    const old = this.beast;
    if (old) s.tweens.add({ targets: old, alpha: 0, x: old.x + 40, duration: 220, onComplete: () => old.destroy() });
    this.beast = undefined;
    this.beastWho = who;
    let key: string | null = null;
    if (who === 'boss') {
      const id = this.sc.bossId ?? 'boss';
      key = monsterImageKey(id);
      if (!s.textures.exists(key)) {
        // 메뉴의 회상처럼 보스 그림을 아직 안 불렀으면 불러서 띄운다
        const art = MONSTER_ART[id];
        if (art) {
          s.load.image(key, art.file);
          s.load.once('complete', () => { if (!this.ended && this.beastWho === 'boss' && !this.beast) { this.beastWho = null; this.setBeast('boss'); } });
          s.load.start();
        }
        return;
      }
    } else {
      const id = who as MountId;
      const own = store.state.data.mounts[id];
      key = ensurePortrait(s, id, own?.stage ?? 0, 'normal', own?.skin);
    }
    const img = fitInto(s.add.image(0, 0, key), 1000, BOX.y + 30, 470, 340, 2.6).setAlpha(0);
    if (who === 'boss') img.setTint(0x8a7090);
    const baseX = img.x;
    img.x = baseX + 60;
    // 상자 뒤에 서도록 상자보다 먼저
    this.layer.addAt(img, this.layer.getIndex(this.box));
    s.tweens.add({ targets: img, alpha: 1, x: baseX, duration: 320, ease: 'Cubic.out' });
    s.tweens.add({ targets: img, y: img.y - 6, yoyo: true, repeat: -1, duration: 1500, ease: 'Sine.inOut', delay: 320 });
    this.beast = img;
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.typing?.remove();
    this.autoT?.remove();
    for (const [ev, fn] of this.keys) this.scene.input.keyboard?.off(ev, fn);
    audio.play('select');
    this.scene.tweens.add({
      targets: this.layer, alpha: 0, duration: 260, onComplete: () => {
        this.layer.destroy();
        if (this.opts.hideScrolls) setScrollsHidden(this.scene, false);
        this.opts.onDone();
      },
    });
  }
}
