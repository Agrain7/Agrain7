// 키보드 + 터치 입력 통합. 터치 버튼(HUD)은 hold 상태를 직접 기록하고, 여기서 눌림(edge)을 계산한다.
import Phaser from 'phaser';

export type Btn = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'special' | 'dash' | 'menu' | 'swap';
const BTNS: Btn[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'dash', 'menu', 'swap'];

export class Controls {
  held: Record<Btn, boolean> = Object.fromEntries(BTNS.map((b) => [b, false])) as Record<Btn, boolean>;
  pressed: Record<Btn, boolean> = Object.fromEntries(BTNS.map((b) => [b, false])) as Record<Btn, boolean>;
  touch: Record<Btn, boolean> = Object.fromEntries(BTNS.map((b) => [b, false])) as Record<Btn, boolean>;
  /** 자동 테스트/데모용 가상 입력 */
  virtual: Record<Btn, boolean> = Object.fromEntries(BTNS.map((b) => [b, false])) as Record<Btn, boolean>;
  private prev: Record<Btn, boolean> = Object.fromEntries(BTNS.map((b) => [b, false])) as Record<Btn, boolean>;
  private keys: Partial<Record<Btn, Phaser.Input.Keyboard.Key[]>> = {};
  usedTouch = false;

  bindKeyboard(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const map: Record<Btn, number[]> = {
      left: [K.A, K.LEFT], right: [K.D, K.RIGHT], up: [K.W, K.UP], down: [K.S, K.DOWN],
      jump: [K.SPACE], attack: [K.J, K.Z], special: [K.K, K.X], dash: [K.L, K.SHIFT, K.C], menu: [K.ESC, K.P], swap: [K.Q, K.TAB],
    };
    for (const b of BTNS) this.keys[b] = map[b].map((code) => kb.addKey(code, true, false));
  }

  update() {
    for (const b of BTNS) {
      const k = this.keys[b]?.some((key) => key.isDown) ?? false;
      const now = k || this.touch[b] || this.virtual[b];
      this.held[b] = now;
      this.pressed[b] = now && !this.prev[b];
      this.prev[b] = now;
    }
    // 위 방향키도 점프로 취급 (비행 중엔 상승)
    if (this.pressed.up) this.pressed.jump = this.pressed.jump || false;
  }

  reset() {
    for (const b of BTNS) {
      this.touch[b] = false;
      this.virtual[b] = false;
      this.held[b] = false;
      this.pressed[b] = false;
      this.prev[b] = false;
    }
  }

  get axis() {
    return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
  }
}

export const controls = new Controls();
