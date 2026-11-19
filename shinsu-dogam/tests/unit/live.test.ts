// 매일 찾게 하는 요소 (출석·일일 임무·수행록·정기권·원정·별) 단위 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, migrate, SAVE_VERSION } from '../../src/systems/state.ts';
import * as L from '../../src/systems/live.ts';

const T0 = new Date(2026, 10, 20, 10, 0, 0).getTime();
const DAY = 86400_000;
const fresh = () => new GameState(null);

test('출석: 하루 한 번, 7일 주기, 날이 바뀌면 다시', () => {
  const st = fresh();
  assert.equal(L.claimLogin(st, T0), 0);
  assert.equal(st.count('gold'), 200);
  assert.equal(L.claimLogin(st, T0 + 3600_000), -1, '같은 날 두 번 안 됨');
  for (let d = 1; d < 7; d++) assert.equal(L.claimLogin(st, T0 + d * DAY), d);
  assert.ok(st.ownsCosmetic('decor_knot'), '7일째 장식');
  assert.equal(L.claimLogin(st, T0 + 7 * DAY), 0, '8일째는 다시 1일째 보상');
});

test('일일 임무: 하루 3개, 그날 진행만 셈, 모두 하면 보너스', () => {
  const st = fresh();
  st.data.stats.defeats = 100; // 어제까지의 기록은 세지 않는다
  L.ensureDaily(st, T0);
  assert.equal(st.data.daily.missions.length, 3);
  assert.equal(new Set(st.data.daily.missions.map((m) => m.id)).size, 3);
  for (const m of st.data.daily.missions) assert.equal(L.missionProgress(st, m), 0);
  // 오늘 진행
  st.data.stats.defeats += 15; st.data.stats.clears += 2; st.data.stats.coins += 40; st.data.stats.ults += 3; st.data.stats.distance += 800;
  const gold0 = st.count('gold');
  for (const m of st.data.daily.missions) assert.ok(L.claimMission(st, m.id));
  assert.equal(st.count('gold') - gold0, 360);
  assert.ok(!L.claimMission(st, st.data.daily.missions[0].id), '두 번 받기 안 됨');
  assert.ok(L.claimBonus(st));
  assert.ok(!L.claimBonus(st));
  // 다음 날: 새 임무, 보너스 다시
  L.ensureDaily(st, T0 + DAY);
  assert.ok(st.data.daily.missions.every((m) => !m.claimed));
  assert.ok(!st.data.daily.bonusClaimed);
});

test('수행록: 경험으로 단계, 무료는 누구나·프리미엄은 구매 후, 지난 단계도 받기', () => {
  const st = fresh();
  L.addPassXp(st, 300 * 5 + 10);
  assert.equal(L.passLevel(st.data.pass.xp), 5);
  assert.ok(L.claimPass(st, 'free', 3));
  assert.ok(!L.claimPass(st, 'free', 3));
  assert.ok(!L.claimPass(st, 'free', 6), '아직 못 오른 단계');
  assert.ok(!L.claimPass(st, 'prem', 5), '프리미엄 미구매');
  st.data.pass.premium = true;
  assert.ok(L.claimPass(st, 'prem', 5));
  assert.ok(st.ownsCosmetic('trail_footprint'), '5단계 프리미엄 꾸미기');
  assert.equal(L.passClaimable(st), 4 + 4, '무료 1·2·4·5 + 프리미엄 1~4');
  L.addPassXp(st, 999999);
  assert.equal(L.passLevel(st.data.pass.xp), 30, '최대 30단계');
  // 프리미엄 한정 스킨은 실제 꾸미기 아이템
  for (let lv = 1; lv <= 30; lv++) for (const c of L.passPremium(lv).cosmetics ?? []) assert.ok(c.startsWith('skin_') || c.startsWith('trail_') || c.startsWith('decor_') || c.startsWith('outfit_'));
});

test('달빛 정기권: 즉시 영기석 10, 30일 동안 하루 한 번', () => {
  const st = fresh();
  assert.ok(!L.claimMonthly(st, T0));
  L.activateMonthly(st, T0);
  assert.equal(st.count('spirit_stone'), 10);
  assert.ok(L.claimMonthly(st, T0));
  assert.ok(!L.claimMonthly(st, T0 + 1000));
  assert.ok(L.claimMonthly(st, T0 + DAY));
  assert.equal(L.monthlyDaysLeft(st, T0 + DAY), 29);
  assert.ok(!L.claimMonthly(st, T0 + 31 * DAY), '기간 끝');
  // 연장
  L.activateMonthly(st, T0 + 10 * DAY);
  assert.equal(L.monthlyDaysLeft(st, T0 + 10 * DAY), 50);
});

test('원정: 탑승 중인 영물 불가, 시간이 지나야 보상, 원정 중에는 탈 수 없음', () => {
  const st = fresh();
  assert.ok(L.canStartExpedition(st, 'wolf'), '탑승 중');
  st.obtainMount('hawk');
  assert.equal(L.canStartExpedition(st, 'hawk'), null);
  assert.ok(L.startExpedition(st, 'hawk', 4, T0));
  assert.ok(!st.setActive('hawk'), '원정 중에는 탑승 불가');
  assert.deepEqual(st.rideableMounts().map((m) => m.id), ['wolf']);
  assert.equal(L.claimExpedition(st, 'hawk', T0 + 3 * 3600_000), null, '아직');
  const gold0 = st.count('gold');
  const r = L.claimExpedition(st, 'hawk', T0 + 4 * 3600_000 + 1);
  assert.ok(r && r.gold > 0 && r.stones >= 1);
  assert.equal(st.count('gold') - gold0, r!.gold);
  assert.ok(!st.data.expeditions.hawk);
  assert.ok(st.setActive('hawk'));
});

test('별과 지역 보상: ★6·12·18 한 번씩', () => {
  const st = fresh();
  assert.equal(L.computeStars(false, false), 1);
  assert.equal(L.computeStars(true, true), 3);
  for (const id of ['2-1', '2-2', '2-3']) st.data.stages[id] = { cleared: true, chests: [], pickups: [], stars: 2 };
  assert.equal(L.regionStars(st, 2), 6);
  assert.ok(L.claimRegion(st, 2, 0));
  assert.ok(!L.claimRegion(st, 2, 0));
  assert.ok(!L.claimRegion(st, 2, 1), '★12 아직');
  assert.equal(L.regionStars(st, 1), 0, '다른 지역과 섞이지 않음');
});

test('저장 v2 → v3: 새 항목이 채워지고 기존 진행은 그대로', () => {
  const v2 = { version: 2, activeMount: 'wolf', mounts: { wolf: { id: 'wolf', level: 7, exp: 3, stage: 0, obtainedAt: 1, history: [] } }, inventory: { gold: 55 }, stages: { '1-1': { cleared: true, chests: [], pickups: [] } }, stats: { distance: 10, defeats: 2, chests: 0, deaths: 0, bosses: [] } };
  const d = migrate(v2);
  assert.equal(d.version, SAVE_VERSION);
  assert.equal(d.mounts.wolf!.level, 7);
  assert.equal(d.inventory.gold, 55);
  assert.ok(d.stages['1-1'].cleared);
  assert.equal(d.daily.loginDays, 0);
  assert.equal(d.pass.xp, 0);
  assert.deepEqual(d.expeditions, {});
  assert.equal(d.stats.clears, 0);
  assert.equal(d.stats.coins, 0);
});
