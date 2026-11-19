// 전통 서책 느낌의 UI 위젯 (한지 패널, 옻칠 버튼)
import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, COLORS } from '../game/config.ts';
import { audio } from '../systems/audio.ts';

/** 글꼴 측정값 캐시: Phaser 는 글자 객체를 만들 때마다 글꼴 높이를 픽셀로 재서 느리다 (휴대폰에서 데미지 숫자마다 멈칫).
 *  같은 글꼴·크기·굵기·테두리는 한 번만 재고 그 값을 넘긴다. */
const metricsCache = new Map<string, { ascent: number; descent: number; fontSize: number }>();
/** 목록을 끌어 넘기는 중이면 단추가 눌리지 않게 (ui/scroll.ts 가 설정) */
export const dragGuard = { moved: false };

/** 눌렀을 때 (끌어 넘긴 경우는 무시) */
export function tap(obj: Phaser.GameObjects.GameObject & { setInteractive: (o?: Phaser.Types.Input.InputConfiguration) => unknown }, fn: () => void) {
  obj.setInteractive({ useHandCursor: true });
  obj.on('pointerdown', () => { dragGuard.moved = false; });
  obj.on('pointerup', () => { if (dragGuard.moved) return; audio.unlock(); fn(); });
  return obj;
}

/** 알약 모양 탭/분류 단추 (선택: 붉은 옻칠 + 금테, 보통: 한지) */
export interface Pill extends Phaser.GameObjects.Container { setActive2(on: boolean): Pill }
export function pill(scene: Phaser.Scene, x: number, y: number, w: number, label: string, active: boolean, onTap: () => void, size = 17): Pill {
  const c = scene.add.container(x, y) as Pill;
  const bg = scene.add.nineslice(0, 0, active ? 'ui_tab_on' : 'ui_tab', undefined, w, 44, 22, 22, 0, 0);
  const t = txt(scene, 0, 1, label, size, active ? '#fff4dc' : '#5a3a22', { title: true }).setOrigin(0.5);
  c.add([bg, t]);
  c.setSize(w, 44);
  tap(bg, () => { audio.play('select'); onTap(); });
  bg.on('pointerover', () => c.setScale(1.04));
  bg.on('pointerout', () => c.setScale(1));
  c.setActive2 = (on: boolean) => { bg.setTexture(on ? 'ui_tab_on' : 'ui_tab'); t.setColor(on ? '#fff4dc' : '#5a3a22'); return c; };
  return c;
}

/** 한지 카드 (선택·잠김·어두운 판) */
export function card(scene: Phaser.Scene, x: number, y: number, w: number, h: number, kind: 'normal' | 'sel' | 'dark' | 'lock' = 'normal') {
  const key = kind === 'normal' ? 'ui_card' : `ui_card_${kind}`;
  return scene.add.nineslice(x, y, key, undefined, w, h, 18, 18, 18, 18).setOrigin(0, 0);
}

/** 그림을 상자 안에 맞춰 넣기 (튀어나오지 않게): 가운데 아래 기준 */
export function fitInto(img: Phaser.GameObjects.Image, cx: number, bottom: number, maxW: number, maxH: number, maxScale = 2) {
  const s = Math.min(maxScale, maxW / Math.max(1, img.width), maxH / Math.max(1, img.height));
  return img.setOrigin(0.5, 1).setScale(s).setPosition(cx, bottom);
}

/** 제목 + 금빛 구름 장식 */
export function sectionTitle(scene: Phaser.Scene, x: number, y: number, s: string, size = 24, sub?: string) {
  const c = scene.add.container(0, 0);
  const t = txt(scene, x, y, s, size, COLORS.text, { title: true });
  c.add(t);
  const g = scene.add.graphics();
  g.fillStyle(0xb8322a, 1);
  g.fillRect(x - 14, y + size * 0.28, 5, size * 0.62);
  c.add(g);
  if (sub) c.add(txt(scene, x + t.width + 12, y + size * 0.36, sub, Math.round(size * 0.6), '#8a6a4a'));
  return c;
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 20, color: string = COLORS.text, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> & { title?: boolean } = {}) {
  const { title, ...rest } = opts;
  const family = title ? FONT_TITLE : FONT_UI;
  const mkey = `${family}|${size}|${rest.fontStyle ?? ''}|${rest.strokeThickness ?? 0}|${JSON.stringify(rest.padding ?? '')}`;
  const cached = metricsCache.get(mkey);
  const t = scene.add.text(x, y, s, {
    fontFamily: family,
    fontSize: `${size}px`,
    color,
    ...rest,
    ...(cached ? { metrics: cached } : {}),
  });
  if (!cached) {
    const m = t.getTextMetrics();
    if (m && m.fontSize > 0) metricsCache.set(mkey, { ascent: m.ascent, descent: m.descent, fontSize: m.fontSize });
  }
  t.setResolution(Math.min(2, window.devicePixelRatio || 1));
  return t;
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, dark = false) {
  return scene.add.nineslice(x, y, dark ? 'ui_panel_dark' : 'ui_panel', undefined, w, h, 28, 28, 28, 28).setOrigin(0, 0);
}

export interface Btn extends Phaser.GameObjects.Container {
  setLabel(s: string): Btn;
  setEnabled(on: boolean): Btn;
  enabled: boolean;
}

export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, kind: 'normal' | 'primary' = 'normal', size = 20): Btn {
  const c = scene.add.container(x, y) as Btn;
  const bg = scene.add.nineslice(0, 0, kind === 'primary' ? 'ui_btn_primary' : 'ui_btn', undefined, w, h, 14, 14, 14, 14);
  const t = txt(scene, 0, 1, label, size, COLORS.textLight).setOrigin(0.5);
  c.add([bg, t]);
  c.setSize(w, h);
  c.enabled = true;
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => c.enabled && c.setScale(1.04));
  bg.on('pointerout', () => c.setScale(1));
  bg.on('pointerdown', () => {
    dragGuard.moved = false;
    if (!c.enabled) return;
    c.setScale(0.97);
  });
  bg.on('pointerup', () => {
    if (!c.enabled) return;
    c.setScale(1);
    if (dragGuard.moved) return; // 목록을 끌어 넘긴 것
    audio.unlock();
    audio.play('select');
    onClick();
  });
  c.setLabel = (s: string) => {
    t.setText(s);
    return c;
  };
  c.setEnabled = (on: boolean) => {
    c.enabled = on;
    bg.setTexture(on ? (kind === 'primary' ? 'ui_btn_primary' : 'ui_btn') : 'ui_btn_disabled');
    t.setAlpha(on ? 1 : 0.6);
    return c;
  };
  return c;
}

export function bar(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, back = 0x231e33) {
  const g = scene.add.graphics();
  let ratio = 1;
  const draw = () => {
    g.clear();
    g.fillStyle(back, 0.85);
    g.fillRoundedRect(x, y, w, h, h / 2);
    if (ratio > 0) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x + 2, y + 2, Math.max(h - 4, (w - 4) * ratio), h - 4, (h - 4) / 2);
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(x + 4, y + 3, Math.max(0, (w - 8) * ratio), (h - 4) / 3, 2);
    }
    g.lineStyle(2, 0xe2b14c, 1);
    g.strokeRoundedRect(x, y, w, h, h / 2);
  };
  draw();
  return {
    g,
    set(r: number) {
      const nr = Phaser.Math.Clamp(r, 0, 1);
      if (Math.abs(nr - ratio) > 0.001) {
        ratio = nr;
        draw();
      }
    },
  };
}

/** 모달(확인 창 등)이 떠 있는 동안 끌어 넘기는 목록(별도 카메라)을 숨긴다 — 목록이 창 위로 그려지거나 눌리지 않게 */
export const scrollCams = new WeakMap<Phaser.Scene, Set<Phaser.Cameras.Scene2D.Camera>>();
const modalDepth = new WeakMap<Phaser.Scene, number>();
export function setScrollsHidden(scene: Phaser.Scene, hidden: boolean) {
  const d = Math.max(0, (modalDepth.get(scene) ?? 0) + (hidden ? 1 : -1));
  modalDepth.set(scene, d);
  for (const cam of scrollCams.get(scene) ?? []) cam.setVisible(d === 0);
}
export function scrollsHidden(scene: Phaser.Scene) { return (modalDepth.get(scene) ?? 0) > 0; }
/** 장면을 새로 열 때 (이전에 닫히지 않은 창의 숨김 상태가 남지 않게) */
export function resetScrolls(scene: Phaser.Scene) { modalDepth.set(scene, 0); scrollCams.get(scene)?.clear(); }

/** 알림 글자처럼 잠깐 뜨는 것을 목록 카메라보다 위에 그린다 (전용 맨 위 카메라) */
const tops = new WeakMap<Phaser.Scene, { cam: Phaser.Cameras.Scene2D.Camera; objs: Set<Phaser.GameObjects.GameObject> }>();
function liftAboveScrolls(scene: Phaser.Scene, o: Phaser.GameObjects.GameObject) {
  if (!scrollCams.get(scene)?.size) return;
  let t = tops.get(scene);
  if (!t || !scene.cameras.cameras.includes(t.cam)) {
    const cam = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    cam.transparent = true;
    cam.inputEnabled = false;
    const tt = { cam, objs: new Set<Phaser.GameObjects.GameObject>() };
    t = tt;
    tops.set(scene, tt);
    const pre = () => {
      const arr = scene.cameras.cameras;
      const i = arr.indexOf(cam);
      if (i < 0) { scene.events.off('prerender', pre); return; }
      if (i !== arr.length - 1) { arr.splice(i, 1); arr.push(cam); }
      for (const ch of scene.children.list) {
        if (tt.objs.has(ch)) {
          let f = 0;
          for (const c2 of arr) if (c2 !== cam) f |= c2.id;
          ch.cameraFilter = f;
        } else ch.cameraFilter |= cam.id;
      }
    };
    scene.events.on('prerender', pre);
  }
  const tt = t;
  tt.objs.add(o);
  o.once('destroy', () => tt.objs.delete(o));
}

/** 화면 중앙 상단 알림 */
export function toast(scene: Phaser.Scene, msg: string, color: string = COLORS.textLight, y = 120, dur = 1800) {
  const t = txt(scene, scene.scale.width / 2, y, msg, 24, color, { stroke: '#1d1a2b', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(1000).setScrollFactor(0);
  t.setAlpha(0);
  liftAboveScrolls(scene, t);
  scene.tweens.add({ targets: t, alpha: 1, y: y - 10, duration: 220 });
  scene.tweens.add({ targets: t, alpha: 0, y: y - 30, delay: dur, duration: 400, onComplete: () => t.destroy() });
  return t;
}

/** 확인 대화상자 */
export function confirmBox(scene: Phaser.Scene, msg: string, onYes: () => void, yes = '확인', no = '취소') {
  const W = scene.scale.width, H = scene.scale.height;
  const layer = scene.add.container(0, 0).setDepth(2000);
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive();
  const p = panel(scene, W / 2 - 260, H / 2 - 120, 520, 240);
  const t = txt(scene, W / 2, H / 2 - 40, msg, 22, COLORS.text, { align: 'center', wordWrap: { width: 460 } }).setOrigin(0.5);
  setScrollsHidden(scene, true);
  const close = () => { layer.destroy(); setScrollsHidden(scene, false); };
  const by = button(scene, W / 2 - 100, H / 2 + 60, 170, 54, yes, () => { close(); onYes(); }, 'primary');
  const bn = button(scene, W / 2 + 100, H / 2 + 60, 170, 54, no, close);
  layer.add([dim, p, t, by, bn]);
  return layer;
}
