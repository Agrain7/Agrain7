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
import { regionOf } from '../../data/regions.ts';
import { addPassXp, computeStars } from '../../systems/live.ts';
import { prewarmMonster, releaseMonster } from '../textures.ts';
import { MONSTER_ART, monsterImageKey } from '../../data/monsterArt.ts';
import { SCENES, BARKS, type Line } from '../../data/story.ts';
import { MONSTERS } from '../../data/monsters.ts';
import { MOUNTS } from '../../data/mounts.ts';
import { ITEMS } from '../../data/items.ts';
import { QUESTS } from '../../data/quests.ts';
import { audio } from '../../systems/audio.ts';
import { analytics } from '../../services/analytics/Analytics.ts';
import { overlayQueue } from '../overlayQueue.ts';
import { GAME_W, GAME_H, DEBUG, STORY_ON } from '../config.ts';
import { prewarmMount } from '../textures.ts';
import { ULT_GAIN } from '../../data/beastSkills.ts';
import type { GameEvent } from '../../systems/state.ts';

export class WorldScene extends Phaser.Scene {
  map!: StageMap;
  level!: Level;
  player!: Player;
  combat!: Combat;
  monsters: Monster[] = [];
  boss?: Boss;
  private bd!: Backdrop;
  private fg!: Phaser.GameObjects.TileSprite;
  private solidRects: Rect[] = [];
  private platRects: Rect[] = [];
  private respawn = { x: 0, y: 0 };
  private startTime = 0;
  private cleared = false;
  /** 이번 돌파가 처음인가 (종장 판단) */
  private firstClear = false;
  private bossStarted = false;
  private saveT = 30;
  private shrineMsgT = 0;
  private swapCD = 0;
  private defeatsThisRun = 0;
  private camOffX = -200;
  private unsub: (() => void) | null = null;
  private fainting = false;
  /** 필살기 연출 중 시간 정지 (적·적 투사체 멈춤) */
  freezeT = 0;
  private faintsThisRun = 0;

  constructor() {
    super('World');
  }

  init(data: { stage?: string }) {
    this.map = stageById(data.stage ?? store.state.data.currentStage) ?? STAGES[0];
  }

  /** 지역 테마 배경(참고 화면 조각의 색 보정판)은 필요할 때만 불러온다 */
  preload() {
    const sky = this.map.sky;
    const want: [string, string][] = [[`ref_${sky}_cliffs`, `assets/backgrounds/${sky}_cliffs.png`]];
    for (const n of ['sky', 'clouds', 'forest']) want.push([`scn_${sky}_${n}`, `assets/scenery/${sky}_${n}.png`]);
    for (const [k, f] of want) if (!this.textures.exists(k)) this.load.image(k, f);
    // 이 지역 보스 그림
    const bossId = this.map.boss ? regionOf(this.map.id).bossId : null;
    if (bossId && MONSTER_ART[bossId] && !this.textures.exists(monsterImageKey(bossId))) this.load.image(monsterImageKey(bossId), MONSTER_ART[bossId].file);
  }

  create() {
    const map = this.map;
    this.monsters = [];
    this.boss = undefined;
    this.cleared = false;
    this.bossStarted = false;
    this.fainting = false;
    this.defeatsThisRun = 0;
    this.faintsThisRun = 0;
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
    // 지역 분위기: 지형·장식에 지역 색을 곱한다 (용궁은 푸르게, 화염 계곡은 붉게, 설원은 희게)
    const region = regionOf(map.id);
    if (region.groundTint !== 0xffffff) {
      for (const o of this.children.list) {
        const d = o as Phaser.GameObjects.Image;
        if (d.depth <= -6 && d.depth >= -14 && typeof d.setTint === 'function') {
          d.setTint(region.groundTint);
          if (region.groundMode === 'screen') d.setTintMode(Phaser.TintModes.SCREEN);
        }
      }
    }
    if (region.sky === 'fire') for (const h of map.hazards) this.add.particles(h.x + h.w / 2, h.y, 'fx_fire', { x: { min: -h.w / 2, max: h.w / 2 }, speedY: { min: -90, max: -40 }, lifespan: 600, scale: { start: 0.5, end: 0 }, frequency: 90, blendMode: 'ADD' }).setDepth(-6);
    if (map.boss && region.bossId !== 'boss') prewarmMonster(this, region.bossId);
    this.addWeather(region.sky);
    this.respawn = { x: map.spawn.x, y: map.spawn.y };
    this.player = new Player(this, map.spawn.x, map.spawn.y);
    // 전경 수풀 (참고 화면 아래쪽의 어두운 잎사귀, 카메라보다 빠르게 흐름)
    this.fg = this.add.tileSprite(0, GAME_H - 104, GAME_W, 150, 'fg_leaves').setOrigin(0).setScrollFactor(0).setDepth(30).setAlpha(0.92);
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
    // 이야기: 지역 첫 구간이면 도착 장면(장 제목 카드가 구간 제목을 겸함), 그 밖의 구간은 처음 달릴 때 짧은 한마디 (멈추지 않음)
    const stR = regionOf(map.id);
    this.firstClear = false;
    const fresh = !store.state.data.stages[map.id]?.cleared;
    const arrive = fresh && map.id === `${stR.n}-1` && STORY_ON && !store.state.storySeen(`r${stR.n}_arrive`);
    if (arrive) this.time.delayedCall(350, () => this.story(`r${stR.n}_arrive`, `${map.name} ${map.id} · ${map.subtitle}`));
    else this.time.delayedCall(50, () => this.hudTitle(`${map.name} ${map.id}`, map.subtitle));
    if (fresh && BARKS[map.id]) this.time.delayedCall(3000, () => this.bark(BARKS[map.id]));
    // 보유 영물 애니메이션을 미리 만들어 둔다 (교체 시 끊김 방지, 구간 시작 연출 동안 한 마리씩)
    store.state.ownedMounts()
      .filter((m) => m.id !== store.state.data.activeMount)
      .slice(0, 5)
      .forEach((m, i) => this.time.delayedCall(600 + i * 200, () => prewarmMount(this, m.id, m.stage, m.skin)));
    if (DEBUG) this.setupDebug();
  }

  private cleanup() {
    this.unsub?.();
    this.unsub = null;
    this.combat?.destroy();
    for (const m of this.monsters) if (!m.dead) m.destroy();
    this.monsters = [];
    this.player?.destroy();
    // 큰 보스 그림은 구간을 떠나면 내려 둔다
    const bossId = this.map?.boss ? regionOf(this.map.id).bossId : null;
    if (bossId && bossId !== 'boss') releaseMonster(this, bossId);
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
    m.baseTint = regionOf(this.map.id).monsterTint;
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
  /** 이야기 장면을 연출 줄에 올린다 (이미 봤거나 자동 테스트면 건너뜀) */
  private story(id: string, sub?: string) {
    if (!STORY_ON || !SCENES[id] || store.state.storySeen(id)) return false;
    overlayQueue.push({ type: 'story', id, sub });
    return true;
  }
  /** 달리는 중 한마디 (말하는 영물이 아직 동료가 아니면 생략) */
  private bark(l: Line) {
    if (!STORY_ON || this.cleared) return;
    if (l.who !== 'haram' && l.who !== 'narr' && l.who !== 'boss' && !store.state.owns(l.who)) return;
    this.events.emit('hud-bark', l.who, l.text);
  }

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
        this.story(`meet_${e.mount}`);
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
    if (this.player.ultT <= 0) this.player.ult = Math.min(100, this.player.ult + ULT_GAIN.kill);
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
    this.combat.softFlash(0xfff5dc, 0.3, 700);
    this.tweens.add({ targets: b.spr, alpha: 0, duration: 2200, delay: 600 });
    this.time.addEvent({ delay: 120, repeat: 18, callback: () => this.combat.sparks(b.x + Phaser.Math.Between(-80, 80), b.y + Phaser.Math.Between(-80, 40), 8) });
    const R = regionOf(this.map.id);
    const firstTime = !st.data.stats.bosses.includes(b.def.id);
    st.recordDefeat(b.def.id);
    const gold = b.def.gold[0], stones = b.def.drops[0]?.qty[0] ?? 8;
    st.addItem('gold', gold);
    st.addItem('spirit_stone', stones);
    st.addItem('moon_petal', 5);
    addPassXp(st, 300);
    this.events.emit('boss-hp', 0, 1, false);
    overlayQueue.push({ type: 'purified', name: b.def.name, region: R.name, reward: `영기석 +${stones} · 월하 꽃잎 +5 · 금화 +${gold}`, guardian: firstTime && R.guardian && !st.owns(R.guardian) ? R.guardian : undefined });
    if (firstTime) this.story(`r${R.n}_purified`);
    // 정화된 수호 영물이 동료가 된다
    // (월드가 정화 연출로 멈추므로 지연 호출 대신 바로 — 합류 연출은 정화 연출 다음 차례로 뜬다)
    if (R.guardian && !st.owns(R.guardian)) st.obtainMount(R.guardian);
    // 경험치는 정화·합류 연출 다음에 (진화 안내가 정화 장면보다 먼저 뜨지 않게)
    st.addExp(b.exp);
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
    this.firstClear = first;
    const exp = Math.round(this.map.clearExp * (first ? 1 : 0.5));
    const gold = 30 + this.map.tier * 20;
    const idx = STAGES.findIndex((s) => s.id === this.map.id);
    const next = STAGES[idx + 1]?.id;
    st.clearStage(this.map.id, time);
    st.addItem('gold', gold);
    st.addExp(exp);
    // 별: ★ 돌파 · ★ 보물 상자 모두 · ★ 쓰러지지 않고
    const recNow = st.data.stages[this.map.id]!;
    const allChests = this.map.chests.every((c) => recNow.chests.includes(c.id));
    const stars = computeStars(allChests, this.faintsThisRun === 0);
    recNow.stars = Math.max(recNow.stars ?? 0, stars);
    st.data.stats.clears = (st.data.stats.clears ?? 0) + 1;
    addPassXp(st, first ? 120 : 60);
    if (next) st.data.currentStage = next;
    if (this.map.id === '1-1' && !st.data.tutorialDone) {
      st.data.tutorialDone = true;
      analytics.track('tutorial_complete', { time });
    }
    st.save();
    audio.play('clear');
    analytics.track('stage_clear', { stage: this.map.id, time: Math.round(time), first });
    const rec = st.data.stages[this.map.id];
    overlayQueue.push({ type: 'clear', stageId: this.map.id, region: this.map.name, stars, time, exp, gold, defeats: this.defeatsThisRun, chests: `${rec?.chests.length ?? 0}/${this.map.chests.length}`, first, next });
  }

  private faint() {
    if (this.fainting) return;
    this.fainting = true;
    this.faintsThisRun++;
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
    p.blinkT = 1.5;
    p.locked = false;
    this.fainting = false;
    this.cameras.main.fadeIn(400, 10, 8, 16);
  }

  private swapMount() {
    const st = store.state;
    const owned = st.rideableMounts();
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
    const nn = owned[(i + 2) % owned.length];
    prewarmMount(this, nn.id, nn.stage, nn.skin);
  }

  openMenu(tab = 'stable') {
    if (this.cleared || this.fainting) return;
    controls.reset();
    store.state.save();
    this.scene.launch('Menu', { tab, from: 'World' });
    this.scene.pause();
    this.scene.pause('Hud');
  }

  /** 최근 프레임 간격 (화면 주사율 추정) */
  private frameGaps: number[] = [];
  /** 물리 단계 수를 화면 주사율에 맞춘다: 한 프레임에 물리 한 번 → 120Hz 화면에서도 매 프레임 고르게 움직임 */
  private syncPhysicsRate() {
    const raw = this.game.loop.rawDelta;
    if (raw > 0 && raw < 50) this.frameGaps.push(raw);
    if (this.frameGaps.length < 90) return;
    const g = [...this.frameGaps].sort((a, b) => a - b);
    this.frameGaps.length = 0;
    const hz = 1000 / g[Math.floor(g.length / 2)];
    const want = hz > 132 ? 144 : hz > 105 ? 120 : hz > 80 ? 90 : 60;
    const world = this.physics.world;
    if (world.fps !== want) world.setFPS(want);
  }

  update(_t: number, dms: number) {
    this.syncPhysicsRate();
    // 느린 기기에서도 타이머가 실제 시간과 비슷하게 흐르도록 (물리는 고정 간격으로 따로 계산)
    const dt = Math.min(dms, 100) / 1000;
    controls.update();
    const p = this.player;
    const st = store.state;
    const map = this.map;
    this.swapCD -= dt;
    if (controls.pressed.menu) return this.openMenu('stable');
    if (controls.pressed.swap && !p.locked) this.swapMount();
    p.update(dt);
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      for (const m of this.monsters) if (!m.dead) { m.body.setVelocity(0, 0); m.body.setAllowGravity(false); }
    } else {
      for (const m of this.monsters) if (!m.dead && !m.def.flying && !m.body.allowGravity && m.def.ai !== 'caster') m.body.setAllowGravity(true);
      for (const m of this.monsters) m.update(dt);
    }
    this.monsters = this.monsters.filter((m) => !(m.dead && !m.spr.active));
    if (this.freezeT <= 0) this.combat.update(dt);
    // 카메라: 진행 방향 쪽을 넓게
    this.camOffX = Phaser.Math.Linear(this.camOffX, -p.facing * 190, Math.min(1, dt * 2.8));
    this.cameras.main.setFollowOffset(this.camOffX, p.flying ? 0 : -40);
    // 카메라 따라가기 정도를 시간 기준으로 (60Hz·120Hz 화면에서 똑같이 부드럽게)
    const k = dt * 60;
    this.cameras.main.setLerp(1 - Math.pow(1 - 0.12, k), 1 - Math.pow(1 - 0.14, k));
    this.bd.update(this.cameras.main.scrollX, this.cameras.main.scrollY, dt);
    this.fg.tilePositionX = this.cameras.main.scrollX * 1.3;
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
        this.combat.softFlash(0xbef0ff, 0.25, 500);
      } else if (this.shrineMsgT <= 0) {
        this.shrineMsgT = 3;
        this.hudMsg(`용신 사당: 여의주 조각 ${n}/3 — 월하산맥 곳곳을 찾아보자`, '#bfe9ff');
      }
    }
    // 보스
    if (map.boss && !this.bossStarted && p.x > map.boss.arena[0] + 80) this.startBoss();
    if (this.boss) this.events.emit('boss-hp', Math.max(0, this.boss.hp), this.boss.maxHp, !this.boss.dead, this.boss.def.name);
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
    const R = regionOf(map.id);
    this.boss = new Boss(this, map.boss!.x, map.boss!.y, map.boss!.arena, R.bossId);
    this.physics.add.collider(this.boss.zone, this.level.solids);
    this.physics.add.collider(this.boss.zone, this.level.oneways);
    this.monsters.push(this.boss);
    audio.startMusic('boss');
    audio.play('boss');
    this.cameras.main.shake(500, 0.008);
    if (!store.state.data.stats.bosses.includes(R.bossId)) this.story(`r${R.n}_boss`);
    overlayQueue.push({ type: 'boss', title: R.bossName, sub: R.n === 6 ? '모든 어둠의 근원' : `어둠에 물든 ${R.name}의 수호 영물` });
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
        st.data.stats.coins = (st.data.stats.coins ?? 0) + 1;
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

  /** 지역 날씨: 눈·불티·물방울·꽃잎·안개 (화면에 고정, 가볍게) */
  private addWeather(kind: string) {
    const cfg: Record<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig & { key: string }> = {
      snow: { key: 'wisp', x: { min: -40, max: GAME_W + 40 }, y: -20, speedY: { min: 50, max: 110 }, speedX: { min: -40, max: 10 }, scale: { min: 0.6, max: 1.3 }, alpha: { start: 1, end: 0.7 }, lifespan: 8000, frequency: 40, tint: 0xffffff },
      fire: { key: 'wisp_gold', x: { min: 0, max: GAME_W }, y: GAME_H + 10, speedY: { min: -120, max: -60 }, speedX: { min: -20, max: 20 }, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, lifespan: 5000, frequency: 90, tint: 0xff8a3c, blendMode: 'ADD' },
      sea: { key: 'wisp', x: { min: 0, max: GAME_W }, y: GAME_H + 10, speedY: { min: -70, max: -30 }, speedX: { min: -10, max: 10 }, scale: { min: 0.2, max: 0.5 }, alpha: { start: 0.6, end: 0 }, lifespan: 9000, frequency: 160, tint: 0xc8f4ff },
      paradise: { key: 'petal', x: { min: -40, max: GAME_W + 40 }, y: -20, speedY: { min: 30, max: 70 }, speedX: { min: -40, max: 0 }, rotate: { min: 0, max: 360 }, scale: { min: 0.5, max: 0.9 }, lifespan: 12000, frequency: 260 },
      dusk: { key: 'petal', x: { min: -40, max: GAME_W + 40 }, y: -20, speedY: { min: 30, max: 60 }, speedX: { min: -40, max: 0 }, rotate: { min: 0, max: 360 }, scale: { min: 0.4, max: 0.8 }, lifespan: 12000, frequency: 700 },
      mist: { key: 'wisp', x: { min: 0, max: GAME_W }, y: { min: GAME_H * 0.4, max: GAME_H }, speedX: { min: -14, max: -4 }, scale: { min: 3, max: 6 }, alpha: { start: 0, end: 0.12 }, lifespan: 6000, frequency: 400, tint: 0xffffff },
    };
    const c = cfg[kind];
    if (!c || !this.textures.exists(c.key)) return;
    const { key, ...conf } = c;
    this.add.particles(0, 0, key, conf).setScrollFactor(0).setDepth(25);
  }

  /** OverlayScene에서 호출 */
  afterClear(goNext: boolean) {
    const next = STAGES[STAGES.findIndex((s) => s.id === this.map.id) + 1];
    this.scene.stop('Hud');
    // 마지막 구간을 처음 돌파: 종장 + 엔딩 크레디트
    if (this.map.id === '6-6' && this.firstClear && STORY_ON && !store.state.storySeen('ending')) { this.scene.start('Ending'); return; }
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

void QUESTS;
