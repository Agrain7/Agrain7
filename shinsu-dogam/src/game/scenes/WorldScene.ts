// 실제 플레이 장면: 영물을 타고 월하산맥을 탐험한다
import Phaser from 'phaser';
import { Backdrop } from '../world/Backdrop.ts';
import { Level, overlaps, type Rect } from '../world/Level.ts';
import { Player } from '../entities/Player.ts';
import { Monster } from '../entities/Monster.ts';
import { Boss } from '../entities/Boss.ts';
import { Combat } from '../combat/Combat.ts';
import { controls } from '../controls.ts';
import { store } from '../ctx.ts';
import { STAGES, stageById, type StageMap } from '../../data/maps/wolha.ts';
import { MONSTERS } from '../../data/monsters.ts';
import { MOUNTS } from '../../data/mounts.ts';
import { ITEMS } from '../../data/items.ts';
import { QUESTS } from '../../data/quests.ts';
import { audio } from '../../systems/audio.ts';
import { analytics } from '../../services/analytics/Analytics.ts';
import { overlayQueue } from '../overlayQueue.ts';
import { GAME_W, GAME_H, DEBUG } from '../config.ts';
import type { GameEvent } from '../../systems/state.ts';

export class WorldScene extends Phaser.Scene {
  map!: StageMap;
  level!: Level;
  player!: Player;
  combat!: Combat;
  monsters: Monster[] = [];
  boss?: Boss;
  private bd!: Backdrop;
  private solidRects: Rect[] = [];
  private platRects: Rect[] = [];
  private respawn = { x: 0, y: 0 };
  private startTime = 0;
  private cleared = false;
  private bossStarted = false;
  private saveT = 30;
  private shrineMsgT = 0;
  private swapCD = 0;
  private defeatsThisRun = 0;
  private camOffX = -200;
  private unsub: (() => void) | null = null;
  private fainting = false;

  constructor() {
    super('World');
  }

  init(data: { stage?: string }) {
    this.map = stageById(data.stage ?? store.state.data.currentStage) ?? STAGES[0];
  }

  create() {
    const map = this.map;
    this.monsters = [];
    this.boss = undefined;
    this.cleared = false;
    this.bossStarted = false;
    this.fainting = false;
    this.defeatsThisRun = 0;
    this.physics.world.setBounds(0, -600, map.width, map.height + 1000);
    this.physics.world.setBoundsCollision(true, true, false, false);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.width, map.height);
    this.bd = new Backdrop(this, map.sky, map.height - GAME_H);
    // 충돌 사각형 목록 (지점 판정용)
    this.solidRects = [
      ...map.ground.map((g) => ({ x: g.x0, y: g.top, w: g.x1 - g.x0, h: map.height - g.top + 200 })),
      ...map.blocks.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
    ];
    this.platRects = map.platforms.map((p) => ({ x: p.x, y: p.y, w: p.w, h: 16 }));
    this.level = new Level(this, map);
    this.respawn = { x: map.spawn.x, y: map.spawn.y };
    this.player = new Player(this, map.spawn.x, map.spawn.y);
    this.physics.world.enable(this.player.zone);
    this.physics.add.collider(this.player.zone, this.level.solids);
    this.physics.add.collider(this.player.zone, this.level.oneways);
    this.combat = new Combat(this);
    for (const m of map.monsters) this.spawnMonster(m.type, m.x, m.y);
    // 카메라
    cam.startFollow(this.player.zone, false, 0.12, 0.14, this.camOffX, -40);
    cam.setDeadzone(60, 90);
    cam.fadeIn(400, 20, 18, 29);
    // 입력
    controls.reset();
    controls.bindKeyboard(this);
    // HUD / 연출 씬
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    else this.scene.get('Hud').scene.restart();
    if (!this.scene.isActive('Overlay')) this.scene.launch('Overlay');
    this.scene.bringToTop('Hud');
    this.scene.bringToTop('Overlay');
    // 상태 이벤트
    this.unsub = store.state.on((e) => this.onGameEvent(e));
    this.events.once('shutdown', () => this.cleanup());
    this.events.on('resume', () => controls.reset());
    // 음악
    audio.startMusic(map.boss ? 'calm' : 'calm');
    this.startTime = this.time.now;
    this.saveT = 30;
    analytics.track('stage_start', { stage: map.id, mount: store.state.data.activeMount });
    this.time.delayedCall(50, () => this.hudTitle(`${map.name} ${map.id}`, map.subtitle));
    if (DEBUG) this.setupDebug();
  }

  private cleanup() {
    this.unsub?.();
    this.unsub = null;
    this.combat?.destroy();
    for (const m of this.monsters) if (!m.dead) m.destroy();
    this.monsters = [];
    this.player?.destroy();
    this.input.keyboard?.removeAllKeys(true);
  }

  // ---------------- 지형 질의 ----------------
  solidAt(x: number, y: number) {
    return this.solidRects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }
  groundAt(x: number, y: number) {
    return this.solidAt(x, y) || this.platRects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y - 6 && y <= r.y + 24);
  }
  groundY(x: number): number | null {
    let best: number | null = null;
    for (const r of [...this.solidRects, ...this.platRects]) {
      if (x >= r.x && x <= r.x + r.w && r.y > 200) best = best === null ? r.y : Math.max(best, Math.min(best, r.y));
    }
    const g = this.map.ground.find((gg) => x >= gg.x0 && x <= gg.x1);
    return g ? g.top : best;
  }

  spawnMonster(type: string, x: number, y: number) {
    const def = MONSTERS[type];
    if (!def) return;
    const m = new Monster(this, def, x, y, this.map.tier);
    this.physics.add.collider(m.zone, this.level.solids);
    if (!def.flying) this.physics.add.collider(m.zone, this.level.oneways);
    this.monsters.push(m);
    return m;
  }

  hudMsg(msg: string, color = '#f6ead0') {
    this.events.emit('hud-msg', msg, color);
  }
  private hudTitle(title: string, sub: string) {
    this.events.emit('hud-title', title, sub);
  }

  // ---------------- 게임 이벤트 ----------------
  private onGameEvent(e: GameEvent) {
    const st = store.state;
    switch (e.type) {
      case 'levelUp': {
        audio.play('levelup');
        if (e.mount === st.data.activeMount) {
          this.player.rebuild();
          this.player.hp = this.player.maxHp;
          this.combat.ring(this.player.x, this.player.y, 'fx_ring_gold', 1);
          this.combat.sparks(this.player.x, this.player.y, 20);
        }
        this.hudMsg(`레벨 업! ${MOUNTS[e.mount].name} Lv.${e.level}`, '#ffe08a');
        analytics.track('mount_level_up', { mount: e.mount, level: e.level });
        break;
      }
      case 'canEvolve': {
        const c = st.canEvolve(e.mount);
        if (c.ok) overlayQueue.push({ type: 'evolvePrompt', mount: e.mount, stage: e.stage });
        else if (c.reason === 'material') this.hudMsg(`진화 레벨 도달! 영기석 ${c.cost!.spiritStone}개·금화 ${c.cost!.gold}이 필요해요`, '#bfe9ff');
        break;
      }
      case 'evolved':
        if (e.mount === st.data.activeMount) this.player.rebuild();
        analytics.track('mount_evolve', { mount: e.mount, stage: e.stage });
        break;
      case 'mountObtained':
        overlayQueue.push({ type: 'acquire', mount: e.mount });
        analytics.track('mount_unlock', { mount: e.mount });
        analytics.track('codex_entry', { mount: e.mount });
        break;
      case 'questDone':
        if (e.quest.reward.mount) this.time.delayedCall(10, () => st.claimQuest(e.quest.id));
        else this.hudMsg(`퀘스트 완료: ${e.quest.name} (메뉴에서 보상 받기)`, '#c8f0c0');
        break;
      default:
        break;
    }
  }

  onMonsterDefeated(m: Monster) {
    const st = store.state;
    this.defeatsThisRun++;
    const [g0, g1] = m.def.gold;
    const gold = Phaser.Math.Between(g0, g1);
    st.recordDefeat(m.def.id);
    st.addItem('gold', gold);
    for (const d of m.def.drops) {
      if (Math.random() < d.chance) {
        const q = Phaser.Math.Between(d.qty[0], d.qty[1]);
        st.addItem(d.item, q);
        this.combat.floatText(m.x, m.y - 40, `${ITEMS[d.item]?.name ?? d.item} +${q}`, '#bfe9ff', 18);
      }
    }
    // 경험치 구슬 연출
    for (let i = 0; i < 5; i++) {
      const o = this.add.image(m.x + Phaser.Math.Between(-20, 20), m.y + Phaser.Math.Between(-20, 10), 'wisp_gold').setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: o, x: { from: o.x, to: this.player.x }, y: { from: o.y - 40, to: this.player.y }, duration: 420 + i * 70, ease: 'Cubic.in',
        onComplete: () => o.destroy(),
      });
    }
    this.combat.floatText(m.x, m.body.top - 30, `+${m.exp} EXP  +${gold}냥`, '#ffe08a', 18);
    st.addExp(m.exp);
    audio.play('coin');
    analytics.track('monster_defeat', { monster: m.def.id, stage: this.map.id });
  }

  onBossDefeated(b: Boss) {
    const st = store.state;
    this.player.locked = true;
    audio.stopMusic();
    audio.play('evolve');
    this.cameras.main.flash(600, 255, 245, 220);
    this.tweens.add({ targets: b.spr, alpha: 0, duration: 2200, delay: 600 });
    this.time.addEvent({ delay: 120, repeat: 18, callback: () => this.combat.sparks(b.x + Phaser.Math.Between(-80, 80), b.y + Phaser.Math.Between(-80, 40), 8) });
    st.recordDefeat('boss');
    st.addItem('gold', 300);
    st.addItem('spirit_stone', 8);
    st.addItem('moon_petal', 5);
    st.addExp(b.exp);
    this.events.emit('boss-hp', 0, 1, false);
    overlayQueue.push({ type: 'purified' });
    this.time.delayedCall(2600, () => {
      this.player.locked = false;
      audio.startMusic('calm');
    });
  }

  // ---------------- 진행 ----------------
  private stageClear() {
    if (this.cleared) return;
    this.cleared = true;
    const st = store.state;
    this.player.locked = true;
    const time = (this.time.now - this.startTime) / 1000;
    const first = !st.data.stages[this.map.id]?.cleared;
    const exp = Math.round(this.map.clearExp * (first ? 1 : 0.5));
    const gold = 30 + this.map.tier * 20;
    const idx = STAGES.findIndex((s) => s.id === this.map.id);
    const next = STAGES[idx + 1]?.id;
    st.clearStage(this.map.id, time);
    st.addItem('gold', gold);
    st.addExp(exp);
    if (next) st.data.currentStage = next;
    if (this.map.id === '1-1' && !st.data.tutorialDone) {
      st.data.tutorialDone = true;
      analytics.track('tutorial_complete', { time });
    }
    st.save();
    audio.play('clear');
    analytics.track('stage_clear', { stage: this.map.id, time: Math.round(time), first });
    const rec = st.data.stages[this.map.id];
    overlayQueue.push({ type: 'clear', stageId: this.map.id, time, exp, gold, defeats: this.defeatsThisRun, chests: `${rec?.chests.length ?? 0}/${this.map.chests.length}`, first, next });
  }

  private faint() {
    if (this.fainting) return;
    this.fainting = true;
    store.state.data.stats.deaths++;
    this.player.locked = true;
    audio.play('hurt');
    this.cameras.main.fadeOut(500, 10, 8, 16);
    overlayQueue.push({ type: 'faint' });
  }

  /** 기절·낙사 후 마지막 석등에서 다시 시작 */
  revive(full = true) {
    const p = this.player;
    // 보스전 중 기절하면 아레나 밖 석등에서 다시 시작하므로 전투를 초기화한다 (다시 들어가면 재시작)
    if (this.boss && !this.boss.dead) {
      this.boss.destroy();
      // 보스가 소환한 비행 요괴도 정리
      for (const m of this.monsters) if (m !== this.boss && !m.dead && m.def.id === 'bat') m.destroy();
      this.monsters = this.monsters.filter((m) => m !== this.boss && m.def.id !== 'bat');
      this.boss = undefined;
      this.bossStarted = false;
      this.level.openArena();
      this.events.emit('boss-hp', 0, 1, false);
      audio.startMusic('calm');
    }
    p.body.reset(this.respawn.x, this.respawn.y - 60);
    p.flying = false;
    p.diving = null;
    p.dashT = 0;
    if (full) p.hp = p.maxHp;
    p.invuln = 1.5;
    p.locked = false;
    this.fainting = false;
    this.cameras.main.fadeIn(400, 10, 8, 16);
  }

  private swapMount() {
    const st = store.state;
    const owned = st.ownedMounts();
    if (owned.length < 2 || this.swapCD > 0) return;
    const i = owned.findIndex((m) => m.id === st.data.activeMount);
    const n = owned[(i + 1) % owned.length];
    st.setActive(n.id);
    this.player.rebuild();
    this.swapCD = 0.8;
    this.combat.ring(this.player.x, this.player.y, 'fx_ring_white', 1);
    this.combat.dust(this.player.x, this.player.bottom, 10);
    audio.play('skill');
    this.hudMsg(`${MOUNTS[n.id].name}(으)로 교체!`);
  }

  openMenu(tab = 'stable') {
    if (this.cleared || this.fainting) return;
    controls.reset();
    store.state.save();
    this.scene.launch('Menu', { tab, from: 'World' });
    this.scene.pause();
    this.scene.pause('Hud');
  }

  update(_t: number, dms: number) {
    const dt = Math.min(dms, 50) / 1000;
    controls.update();
    const p = this.player;
    const st = store.state;
    const map = this.map;
    this.swapCD -= dt;
    if (controls.pressed.menu) return this.openMenu('stable');
    if (controls.pressed.swap && !p.locked) this.swapMount();
    p.update(dt);
    for (const m of this.monsters) m.update(dt);
    this.monsters = this.monsters.filter((m) => !(m.dead && !m.spr.active));
    this.combat.update(dt);
    // 카메라: 진행 방향 쪽을 넓게
    this.camOffX = Phaser.Math.Linear(this.camOffX, -p.facing * 190, Math.min(1, dt * 1.6));
    this.cameras.main.setFollowOffset(this.camOffX, p.flying ? 0 : -40);
    this.bd.update(this.cameras.main.scrollX, this.cameras.main.scrollY, dt);
    // 이동 거리
    const dx = Math.abs(p.x - p.lastX);
    if (dx < 60) st.addDistance(dx);
    p.lastX = p.x;
    const pr = p.rect();
    // 수집품
    for (const pk of this.level.pickups) {
      if (pk.taken) continue;
      const d = Phaser.Math.Distance.Between(p.x, p.y, pk.sprite.x, pk.sprite.y);
      if (pk.type === 'coin' && d < 110) {
        pk.sprite.x += (p.x - pk.sprite.x) * Math.min(1, dt * 10);
        pk.sprite.y += (p.y - pk.sprite.y) * Math.min(1, dt * 10);
      }
      if (d < 46 || overlaps(pr, { x: pk.sprite.x - 14, y: pk.sprite.y - 14, w: 28, h: 28 })) this.collect(pk);
    }
    // 상자
    for (const c of this.level.chests) {
      if (c.opened) continue;
      if (overlaps(pr, { x: c.x - 34, y: c.y - 60, w: 68, h: 60 })) this.openChest(c);
    }
    // 석등 (체크포인트)
    for (const cp of this.level.checkpoints) {
      // 석등을 지나치면(공중이어도 적당한 높이면) 불이 켜진다
      if (!cp.lit && p.x > cp.x - 30 && p.x < cp.x + 400 && p.bottom < cp.y + 30 && p.bottom > cp.y - 320) {
        cp.lit = true;
        cp.sprite.setTexture('lantern_on');
        this.respawn = { x: cp.x, y: cp.y - 20 };
        audio.play('chest');
        this.hudMsg('석등에 불을 밝혔다 · 자동 저장', '#ffe08a');
        st.save();
      }
    }
    // 가시
    for (const h of this.level.hazards) {
      if (overlaps(pr, h)) {
        if (p.hurt(10 + map.tier * 3, p.x - p.facing * 10)) p.body.setVelocityY(-560);
      }
    }
    // 용신 사당
    this.shrineMsgT -= dt;
    if (this.level.shrine && overlaps(pr, this.level.shrine) && !st.owns('cheongryong')) {
      const n = st.count('pearl_shard');
      if (n >= 3) {
        st.addItem('pearl_shard', -3);
        st.completeQuest('q_pearls');
        st.claimQuest('q_pearls');
        audio.play('pearl');
        this.cameras.main.flash(500, 190, 240, 255);
      } else if (this.shrineMsgT <= 0) {
        this.shrineMsgT = 3;
        this.hudMsg(`용신 사당: 여의주 조각 ${n}/3 — 월하산맥 곳곳을 찾아보자`, '#bfe9ff');
      }
    }
    // 보스
    if (map.boss && !this.bossStarted && p.x > map.boss.arena[0] + 80) this.startBoss();
    if (this.boss) this.events.emit('boss-hp', Math.max(0, this.boss.hp), this.boss.maxHp, !this.boss.dead);
    // 골
    const goalOpen = !map.boss || (this.boss?.dead ?? false);
    if (goalOpen && overlaps(pr, this.level.goal)) this.stageClear();
    // 낙사
    if (p.bottom > map.height + 40 && !this.fainting) {
      p.hp -= Math.round(p.maxHp * 0.15);
      audio.play('hurt');
      if (p.hp <= 0) this.faint();
      else {
        this.hudMsg('떨어졌다! 마지막 석등으로 돌아갑니다', '#ffb0a0');
        this.revive(false);
      }
    }
    if (p.hp <= 0 && !this.fainting) this.faint();
    // 자동 저장
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 30;
      st.save();
    }
  }

  private startBoss() {
    const map = this.map;
    this.bossStarted = true;
    this.level.closeArena(map.boss!.arena[0]);
    this.boss = new Boss(this, map.boss!.x, map.boss!.y, map.boss!.arena);
    this.physics.add.collider(this.boss.zone, this.level.solids);
    this.physics.add.collider(this.boss.zone, this.level.oneways);
    this.monsters.push(this.boss);
    audio.startMusic('boss');
    audio.play('boss');
    this.cameras.main.shake(500, 0.008);
    overlayQueue.push({ type: 'boss', title: '흑운 산군', sub: '어둠에 물든 월하산맥의 수호신' });
  }

  private collect(pk: Level['pickups'][number]) {
    const st = store.state;
    pk.taken = true;
    this.tweens.killTweensOf(pk.sprite);
    this.tweens.add({ targets: pk.sprite, y: pk.sprite.y - 30, alpha: 0, scale: 1.5, duration: 260, onComplete: () => pk.sprite.destroy() });
    if (pk.persistent) st.takePickup(this.map.id, pk.id);
    switch (pk.type) {
      case 'coin':
        st.addItem('gold', 2);
        audio.play('coin');
        break;
      case 'pearl_shard': {
        st.addItem('pearl_shard', 1);
        audio.play('pearl');
        const have = st.count('pearl_shard') + (st.owns('cheongryong') ? 3 : 0);
        this.hudMsg(`여의주 조각 획득! (${Math.min(3, have)}/3)`, '#bfe9ff');
        this.combat.ring(pk.x, pk.y, 'fx_ring_blue', 0.8);
        break;
      }
      case 'lore_page':
        if (!st.data.lorePages.includes(pk.id)) st.data.lorePages.push(pk.id);
        st.addItem('lore_page', 1);
        audio.play('chest');
        this.hudMsg('고서 조각 발견! 도감 기록이 늘어났다', '#ffe6a6');
        break;
      default:
        st.addItem('moon_petal', 1);
        audio.play('coin');
    }
    st.updateQuests();
  }

  private openChest(c: Level['chests'][number]) {
    const st = store.state;
    c.opened = true;
    this.tweens.killTweensOf(c.sprite);
    c.sprite.setTexture('chest_open').setScale(1);
    st.openChest(this.map.id, c.id);
    audio.play('chest');
    this.combat.sparks(c.x, c.y - 30, 18);
    const lines: string[] = [];
    for (const [item, q] of Object.entries(c.loot)) {
      if (item === 'lore_page') {
        const id = `lore-${c.id}`;
        if (!st.data.lorePages.includes(id)) st.data.lorePages.push(id);
      }
      st.addItem(item, q);
      lines.push(`${ITEMS[item]?.name ?? item} +${q}`);
    }
    this.combat.floatText(c.x, c.y - 80, lines.join('  '), '#ffe08a', 18);
    this.hudMsg('보물 상자를 열었다!', '#ffe08a');
    st.save();
  }

  /** OverlayScene에서 호출 */
  afterClear(goNext: boolean) {
    const next = STAGES[STAGES.findIndex((s) => s.id === this.map.id) + 1];
    this.scene.stop('Hud');
    if (goNext && next) this.scene.restart({ stage: next.id });
    else this.scene.start('Map');
  }

  // ---------------- 디버그 (?debug) ----------------
  private setupDebug() {
    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => store.state.addExp(500));
    kb.on('keydown-TWO', () => { store.state.addItem('spirit_stone', 30); store.state.addItem('gold', 3000); });
    kb.on('keydown-THREE', () => { for (const id of ['hawk', 'cheongryong'] as const) store.state.obtainMount(id); });
    kb.on('keydown-FOUR', () => this.stageClear());
    kb.on('keydown-FIVE', () => { for (const id of Object.keys(MOUNTS)) store.state.obtainMount(id as keyof typeof MOUNTS); });
    this.hudMsg('디버그: 1=EXP 2=재료 3=매·청룡 4=돌파 5=모든 영물', '#9be3ff');
  }
}

void QUESTS; void GAME_W;
