// 게임 진행 로직 단위 테스트 (node --test, Node 22.18+ 타입 제거 기능 사용)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, newSave, migrate, expToNext, STONE_EXP, SAVE_KEY, type StorageLike } from '../../src/systems/state.ts';
import { MOUNTS, MOUNT_ORDER, SKILLS, mountStats } from '../../src/data/mounts.ts';
import { PRODUCTS } from '../../src/data/products.ts';
import { COSMETICS } from '../../src/data/cosmetics.ts';
import { STAGES } from '../../src/data/maps/wolha.ts';
import { MONSTERS } from '../../src/data/monsters.ts';
import { MOUNT_ART } from '../../src/data/mountArt.ts';
import { ITEMS } from '../../src/data/items.ts';
import { QUESTS } from '../../src/data/quests.ts';
import { SERVER_PRICES } from '../../functions/api/_shared.ts';

class MemStorage implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

test('경험치 곡선: 레벨이 오를수록 필요 경험치 증가', () => {
  for (let l = 1; l < 40; l++) assert.ok(expToNext(l + 1) > expToNext(l));
  let sum = 0;
  for (let l = 1; l < 10; l++) sum += expToNext(l);
  assert.ok(sum > 400 && sum < 900, `Lv10까지 ${sum}`);
});

test('새 저장 데이터는 늑대 1레벨로 시작', () => {
  const s = newSave();
  assert.equal(s.activeMount, 'wolf');
  assert.equal(s.mounts.wolf?.level, 1);
  assert.equal(s.mounts.wolf?.stage, 0);
});

test('경험치 획득 → 레벨업 + 이벤트', () => {
  const g = new GameState(null);
  const events: string[] = [];
  g.on((e) => events.push(e.type));
  const ups = g.addExp(expToNext(1) + expToNext(2) + 1);
  assert.equal(ups, 2);
  assert.equal(g.active.level, 3);
  assert.equal(g.active.exp, 1);
  assert.ok(events.includes('levelUp'));
});

test('진화: 레벨 부족 → 재료 부족 → 진화 성공 (재료 소모, 기록 남김)', () => {
  const g = new GameState(null);
  assert.equal(g.canEvolve('wolf').reason, 'level');
  g.data.mounts.wolf!.level = 10;
  assert.equal(g.canEvolve('wolf').reason, 'material');
  g.addItem('spirit_stone', 5);
  g.addItem('gold', 200);
  assert.ok(g.canEvolve('wolf').ok);
  assert.ok(g.evolve('wolf'));
  assert.equal(g.active.stage, 1);
  assert.equal(g.count('spirit_stone'), 0);
  assert.equal(g.count('gold'), 0);
  assert.equal(g.active.history.at(-1)?.stage, 1);
  // 각성체는 Lv.30 필요
  assert.equal(g.canEvolve('wolf').reason, 'level');
});

test('영기석 수련은 영기석을 경험치로 바꾼다', () => {
  const g = new GameState(null);
  g.addItem('spirit_stone', 3);
  g.train('wolf', 1);
  assert.equal(g.count('spirit_stone'), 2);
  const total = g.active.exp + (g.active.level > 1 ? expToNext(1) : 0);
  assert.equal(total, STONE_EXP);
  assert.equal(g.train('wolf', 99) >= 0, true);
  assert.equal(g.count('spirit_stone'), 0);
});

test('능력치는 레벨과 성장 단계에 따라 증가', () => {
  const d = MOUNTS.cheongryong;
  const a = mountStats(d, 1, 0), b = mountStats(d, 10, 1), c = mountStats(d, 30, 2);
  assert.ok(a.maxHp < b.maxHp && b.maxHp < c.maxHp);
  assert.ok(a.atk < b.atk && b.atk < c.atk);
});

test('퀘스트: 1-2 돌파 → 매 획득', () => {
  const g = new GameState(null);
  g.clearStage('1-2', 60);
  assert.ok(g.data.quests.q_hawk.done);
  assert.ok(g.claimQuest('q_hawk'));
  assert.ok(g.owns('hawk'));
  assert.equal(g.claimQuest('q_hawk'), false, '보상은 한 번만');
});

test('퀘스트: 이동 거리 + 보상 아이템 지급', () => {
  const g = new GameState(null);
  g.addDistance(30000); // 300m
  g.updateQuests();
  assert.ok(g.data.quests.q_first_steps.done);
  const before = g.count('gold');
  g.claimQuest('q_first_steps');
  assert.equal(g.count('gold'), before + 50);
});

test('스테이지 잠금은 순서대로 풀린다', () => {
  const g = new GameState(null);
  assert.ok(g.isUnlocked('1-1'));
  assert.equal(g.isUnlocked('1-2'), false);
  g.clearStage('1-1', 30);
  assert.ok(g.isUnlocked('1-2'));
});

test('저장 → 불러오기 왕복', () => {
  const st = new MemStorage();
  const g = new GameState(st);
  g.addItem('gold', 123);
  g.obtainMount('cheongryong');
  assert.ok(g.save());
  const g2 = GameState.load(st);
  assert.equal(g2.count('gold'), 123);
  assert.ok(g2.owns('cheongryong'));
  assert.ok(g2.hasSave());
});

test('구버전 저장 데이터 변환 (성장 기록 추가, 알 수 없는 영물 제거)', () => {
  const old = { version: 1, activeMount: 'unknown', mounts: { wolf: { id: 'wolf', level: 5, exp: 3, stage: 0, obtainedAt: 1 }, unknown: { id: 'unknown' } }, inventory: { gold: 7 } };
  const m = migrate(old);
  assert.equal(m.activeMount, 'wolf');
  assert.ok(m.mounts.wolf!.history.length === 1);
  assert.equal((m.mounts as Record<string, unknown>).unknown, undefined);
  assert.equal(m.inventory.gold, 7);
  assert.equal(migrate('garbage').activeMount, 'wolf');
});

test('손상된 저장 데이터는 새 게임으로 안전하게 처리', () => {
  const st = new MemStorage();
  st.setItem(SAVE_KEY, '{not json');
  const g = GameState.load(st);
  assert.equal(g.active.id, 'wolf');
});

test('꾸미기: 지급·장착·환불 회수', () => {
  const g = new GameState(null);
  g.obtainMount('cheongryong');
  g.grantCosmetics(['skin_cheongryong_gold', 'outfit_fairy', 'trail_cloud']);
  assert.ok(g.equip('skin_cheongryong_gold'));
  assert.ok(g.equip('outfit_fairy'));
  assert.ok(g.equip('trail_cloud'));
  assert.equal(g.data.mounts.cheongryong!.skin, 'skin_cheongryong_gold');
  g.revokeCosmetics(['skin_cheongryong_gold', 'outfit_fairy', 'trail_cloud']);
  assert.equal(g.data.mounts.cheongryong!.skin, undefined);
  assert.equal(g.data.cosmetics.outfit, 'outfit_default');
  assert.equal(g.data.cosmetics.trail, null);
  assert.equal(g.equip('skin_wolf_snow'), false, '보유하지 않은 스킨은 장착 불가');
});

test('데이터 무결성: 9종 영물·기술·일러스트', () => {
  assert.equal(MOUNT_ORDER.length, 9);
  for (const id of MOUNT_ORDER) {
    const d = MOUNTS[id];
    assert.equal(d.stages.length, 3);
    for (const s of d.stages) {
      assert.ok(SKILLS[s.attack], `${id} 공격 ${s.attack}`);
      assert.ok(SKILLS[s.special], `${id} 기술 ${s.special}`);
      assert.ok(MOUNT_ART[`${id}_${s.stage}`], `${id}_${s.stage} 일러스트 정보`);
    }
    assert.deepEqual(d.stages.map((s) => s.minLevel), [1, 10, 30]);
  }
  // 이번 빌드에서 획득 가능한 영물은 MVP 3종
  assert.deepEqual(MOUNT_ORDER.filter((id) => MOUNTS[id].obtainable), ['wolf', 'hawk', 'cheongryong']);
  // 청룡 각성체는 자유 비행
  assert.ok(MOUNTS.cheongryong.stages[2].movement.flight);
  assert.ok(!MOUNTS.cheongryong.stages[0].movement.flight);
});

test('상점: 판매 상품은 실제 꾸미기 아이템을 지급하고 서버 가격표와 일치', () => {
  for (const p of PRODUCTS) {
    assert.ok(p.price > 0);
    if (!p.available) continue;
    assert.ok(p.grants.length > 0, `${p.id} 지급 아이템`);
    for (const g of p.grants) assert.ok(COSMETICS[g], `${p.id} → ${g}`);
    if (p.mount) assert.ok(MOUNTS[p.mount].obtainable, `${p.id}: 획득 불가 영물의 스킨을 판매하면 안 됨`);
    assert.equal(SERVER_PRICES[p.id]?.amount, p.price, `${p.id} 서버 가격`);
  }
  // 확률형 상품 없음
  assert.ok(PRODUCTS.every((p) => ['skin', 'decor', 'outfit', 'package', 'pass'].includes(p.category)));
});

test('스테이지 데이터: 6개 구간, 좌표가 맵 안에 있고 참조가 유효', () => {
  assert.deepEqual(STAGES.map((s) => s.id), ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6']);
  for (const s of STAGES) {
    const inside = (x: number, y: number) => x >= 0 && x <= s.width && y >= 0 && y <= s.height;
    assert.ok(inside(s.spawn.x, s.spawn.y), `${s.id} spawn`);
    assert.ok(inside(s.goal.x, s.goal.y), `${s.id} goal`);
    for (const m of s.monsters) { assert.ok(MONSTERS[m.type], `${s.id} ${m.type}`); assert.ok(inside(m.x, m.y)); }
    for (const c of s.chests) for (const k of Object.keys(c.loot)) assert.ok(ITEMS[k], `${s.id} loot ${k}`);
    // 시작 지점과 골은 지면 위
    const onGround = (x: number) => s.ground.some((g) => x >= g.x0 && x <= g.x1);
    assert.ok(onGround(s.spawn.x), `${s.id} spawn ground`);
    assert.ok(onGround(s.goal.x), `${s.id} goal ground`);
  }
  // 여의주 조각은 정확히 3개
  const shards = STAGES.flatMap((s) => s.pickups.filter((p) => p.type === 'pearl_shard'));
  assert.equal(shards.length, 3);
  assert.ok(STAGES.find((s) => s.id === '1-3')?.shrine);
  assert.ok(STAGES.find((s) => s.id === '1-6')?.boss);
});

test('스테이지 기본 경로: 지면 사이 틈은 발판 없이도 기본 점프(약 260px)로 건널 수 있거나 발판이 있다', () => {
  for (const s of STAGES) {
    const gs = [...s.ground].sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < gs.length; i++) {
      const gap = gs[i].x0 - gs[i - 1].x1;
      if (gap <= 0) continue;
      const bridged = s.platforms.some((p) => p.x <= gs[i - 1].x1 + 230 && p.x + p.w >= gs[i - 1].x1 - 10);
      assert.ok(gap <= 230 || bridged, `${s.id}: ${gs[i - 1].x1}~${gs[i].x0} 틈 ${gap}px`);
    }
  }
});

test('퀘스트 보상 참조 유효', () => {
  for (const q of QUESTS) {
    for (const k of Object.keys(q.reward.items ?? {})) assert.ok(ITEMS[k], `${q.id} → ${k}`);
    if (q.reward.mount) assert.ok(MOUNTS[q.reward.mount]);
  }
});
