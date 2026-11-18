// 전통 서책 느낌의 UI 위젯 (한지 패널, 옻칠 버튼)
import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, COLORS } from '../game/config.ts';
import { audio } from '../systems/audio.ts';

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 20, color: string = COLORS.text, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> & { title?: boolean } = {}) {
  const { title, ...rest } = opts;
  const t = scene.add.text(x, y, s, {
    fontFamily: title ? FONT_TITLE : FONT_UI,
    fontSize: `${size}px`,
    color,
    ...rest,
  });
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
    if (!c.enabled) return;
    c.setScale(0.97);
  });
  bg.on('pointerup', () => {
    if (!c.enabled) return;
    c.setScale(1);
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

/** 화면 중앙 상단 알림 */
export function toast(scene: Phaser.Scene, msg: string, color: string = COLORS.textLight, y = 120, dur = 1800) {
  const t = txt(scene, scene.scale.width / 2, y, msg, 24, color, { stroke: '#1d1a2b', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setDepth(1000).setScrollFactor(0);
  t.setAlpha(0);
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
  const close = () => layer.destroy();
  const by = button(scene, W / 2 - 100, H / 2 + 60, 170, 54, yes, () => { close(); onYes(); }, 'primary');
  const bn = button(scene, W / 2 + 100, H / 2 + 60, 170, 54, no, close);
  layer.add([dim, p, t, by, bn]);
  return layer;
}
