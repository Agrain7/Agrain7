// 손가락으로 끌어 넘기는 목록 (세로·가로). 휴대폰 터치·마우스 끌기·휠·관성·스크롤 막대.
// 잘라 보이기: 목록 전용 카메라를 화면의 목록 칸에만 띄우고, 목록 내용은 화면 밖 먼 좌표에 둔다
//  → 칸 밖으로 튀어나오지 않고, 칸 밖에서는 눌리지도 않는다 (Phaser 4 마스크 필터보다 가볍다).
import Phaser from 'phaser';
import { dragGuard, scrollCams, scrollsHidden } from './widgets.ts';

let regionSeq = 0;

/** 목록 카메라는 자기 목록만 그린다: 화면 고정(scrollFactor 0) 배경·알림 글자 등이 목록 칸 안에 겹쳐 그려지지 않게,
 *  매 프레임 그리기 직전에 목록 내용이 아닌 것에 '목록 카메라 제외' 표시를 붙인다 */
const registry = new WeakMap<Phaser.Scene, { cams: Set<Phaser.Cameras.Scene2D.Camera>; contents: Set<Phaser.GameObjects.GameObject> }>();
function register(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera, content: Phaser.GameObjects.GameObject) {
  let r = registry.get(scene);
  if (!r) {
    const rr = { cams: new Set<Phaser.Cameras.Scene2D.Camera>(), contents: new Set<Phaser.GameObjects.GameObject>() };
    r = rr;
    registry.set(scene, rr);
    scene.events.on('prerender', () => {
      if (!rr.cams.size) return;
      let bits = 0;
      for (const c of rr.cams) bits |= c.id;
      for (const ch of scene.children.list) if (!rr.contents.has(ch)) ch.cameraFilter |= bits;
    });
  }
  r.cams.add(cam);
  r.contents.add(content);
}
function unregister(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera, content: Phaser.GameObjects.GameObject) {
  const r = registry.get(scene);
  r?.cams.delete(cam);
  r?.contents.delete(content);
}
/** 입력 사건이 일어난 시각 (처리 지연과 무관) */
const evTime = (p: Phaser.Input.Pointer) => (p.event && p.event.timeStamp > 0 ? p.event.timeStamp : performance.now());

export interface ScrollOpts { horizontal?: boolean; /** 처음 위치 */ start?: number; bar?: boolean }

export class ScrollArea {
  readonly content: Phaser.GameObjects.Container;
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  private ox: number;
  private oy: number;
  private size = 0;
  pos = 0;
  private vel = 0;
  private dragging = false;
  private startPos = 0;
  private startPt = 0;
  private lastPt = 0;
  private lastT = 0;
  private bar?: Phaser.GameObjects.Graphics;
  private readonly horiz: boolean;
  private handlers: [string, (...a: never[]) => void][] = [];
  private dead = false;

  constructor(private scene: Phaser.Scene, readonly x: number, readonly y: number, readonly w: number, readonly h: number, opts: ScrollOpts = {}) {
    this.horiz = !!opts.horizontal;
    regionSeq = (regionSeq + 1) % 40;
    this.ox = 20000 + regionSeq * 3000;
    this.oy = 20000;
    this.content = scene.add.container(this.ox, this.oy);
    this.cam = scene.cameras.add(x, y, w, h).setScroll(this.ox, this.oy);
    this.cam.transparent = true;
    this.cam.setVisible(!scrollsHidden(scene));
    register(scene, this.cam, this.content);
    if (!scrollCams.has(scene)) scrollCams.set(scene, new Set());
    scrollCams.get(scene)!.add(this.cam);
    if (opts.bar !== false) this.bar = scene.add.graphics().setDepth(1000);
    this.pos = opts.start ?? 0;
    const inside = (p: Phaser.Input.Pointer) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    const on = <T extends (...a: never[]) => void>(ev: string, fn: T) => { scene.input.on(ev, fn); this.handlers.push([ev, fn]); };
    on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!inside(p) || !this.cam.visible) return;
      dragGuard.moved = false;
      this.dragging = true;
      this.vel = 0;
      this.startPos = this.pos;
      this.startPt = this.lastPt = this.horiz ? p.x : p.y;
      this.lastT = evTime(p);
    });
    on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      const cur = this.horiz ? p.x : p.y;
      if (Math.abs(cur - this.startPt) > 8) dragGuard.moved = true;
      if (!dragGuard.moved) return;
      // 손가락 속도 (입력 사건의 시각으로 재야 느린 폰에서도 정확) — 부드럽게 섞기
      const now = evTime(p);
      const dtm = Math.max(4, now - this.lastT);
      const inst = (this.lastPt - cur) / dtm; // px/ms
      this.vel = this.vel * 0.25 + inst * 0.75;
      this.lastPt = cur;
      this.lastT = now;
      this.setPos(this.startPos - (cur - this.startPt), true);
    });
    on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!dragGuard.moved || evTime(p) - this.lastT > 120) this.vel = 0; // 멈췄다가 뗐으면 관성 없음
      this.vel = Phaser.Math.Clamp(this.vel, -4, 4);
    });
    on('wheel', (p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
      if (!inside(p) || !this.cam.visible) return;
      this.vel = 0;
      this.setPos(this.pos + (this.horiz ? dx || dy : dy) * 0.6);
    });
    scene.events.on('update', this.tick, this);
    this.apply();
  }

  /** 내용 전체 길이 (세로 목록이면 높이) */
  setContentSize(n: number) {
    this.size = n;
    this.setPos(this.pos);
    return this;
  }
  get max() { return Math.max(0, this.size - (this.horiz ? this.w : this.h)); }
  add(o: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) {
    this.content.add(o);
    return this;
  }
  /** 이 항목이 보이도록 이동 (선택한 영물 등) */
  reveal(at: number, len: number) {
    const view = this.horiz ? this.w : this.h;
    if (at < this.pos) this.setPos(at - 12);
    else if (at + len > this.pos + view) this.setPos(at + len - view + 12);
  }
  private setPos(v: number, elastic = false) {
    const max = this.max;
    if (elastic) {
      // 끝에서 조금 늘어나는 느낌
      if (v < 0) v = v * 0.35;
      else if (v > max) v = max + (v - max) * 0.35;
    } else v = Phaser.Math.Clamp(v, 0, max);
    this.pos = v;
    this.apply();
  }
  private apply() {
    if (this.dead) return;
    if (this.horiz) this.cam.setScroll(this.ox + this.pos, this.oy);
    else this.cam.setScroll(this.ox, this.oy + this.pos);
    this.drawBar();
  }
  private tick(_t: number, dms: number) {
    if (this.dead || this.dragging) return;
    const max = this.max;
    if (this.pos < 0 || this.pos > max) {
      // 늘어난 끝을 되돌림
      const target = this.pos < 0 ? 0 : max;
      this.pos += (target - this.pos) * Math.min(1, dms / 90);
      if (Math.abs(target - this.pos) < 0.5) this.pos = target;
      this.vel = 0;
      this.apply();
      return;
    }
    if (Math.abs(this.vel) > 0.02) {
      this.setPos(this.pos + this.vel * dms);
      this.vel *= Math.pow(0.93, dms / 16.7);
    }
  }
  private drawBar() {
    const g = this.bar;
    if (!g) return;
    g.clear();
    const view = this.horiz ? this.w : this.h;
    if (this.size <= view + 1) return;
    const frac = view / this.size;
    const len = Math.max(30, view * frac);
    const t = Phaser.Math.Clamp(this.pos / Math.max(1, this.max), 0, 1) * (view - len);
    g.fillStyle(0x7a5a1e, 0.18);
    g.fillStyle(0xb8322a, 0.55);
    if (this.horiz) g.fillRoundedRect(this.x + t, this.y + this.h + 4, len, 5, 2.5);
    else g.fillRoundedRect(this.x + this.w + 5, this.y + t, 5, len, 2.5);
  }
  destroy() {
    if (this.dead) return;
    this.dead = true;
    for (const [ev, fn] of this.handlers) this.scene.input.off(ev, fn);
    this.scene.events.off('update', this.tick, this);
    scrollCams.get(this.scene)?.delete(this.cam);
    unregister(this.scene, this.cam, this.content);
    try { this.scene.cameras.remove(this.cam); } catch { /* 장면이 이미 닫힘 */ }
    this.content.destroy();
    this.bar?.destroy();
  }
}
