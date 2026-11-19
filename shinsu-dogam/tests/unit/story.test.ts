// 이야기 대본 검사: 화자·장면 목록·보스 그림·한마디 구간·글 길이·고서 순서, 저장 v4 → v5
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, SCENE_ORDER, CHAPTERS, BARKS, LORE } from '../../src/data/story.ts';
import { MOUNTS } from '../../src/data/mounts.ts';
import { REGIONS } from '../../src/data/regions.ts';
import { STAGES } from '../../src/data/maps/wolha.ts';
import { MONSTER_ART } from '../../src/data/monsterArt.ts';
import { migrate, newSave, SAVE_VERSION } from '../../src/systems/state.ts';

const SPEAKERS = new Set(['haram', 'narr', 'boss', ...Object.keys(MOUNTS)]);

test('모든 장면이 회상 목록에 있고, 목록의 장면은 모두 존재', () => {
  assert.deepEqual([...SCENE_ORDER].sort(), Object.keys(SCENES).sort());
});

test('화자는 하람·해설·보스·영물 9종 중 하나, 보스 대사가 있는 장면은 보스 그림이 있음', () => {
  for (const sc of Object.values(SCENES)) {
    assert.ok(CHAPTERS.some((c) => c.n === sc.chapter), `${sc.id}: 장 번호`);
    assert.ok(sc.lines.length > 0, sc.id);
    for (const l of sc.lines) {
      assert.ok(SPEAKERS.has(l.who), `${sc.id}: ${l.who}`);
      // 대화 상자(2줄 반)에 들어가는 길이
      assert.ok(l.text.length <= 70, `${sc.id}: 너무 긴 대사 (${l.text.length}자) ${l.text}`);
    }
    if (sc.lines.some((l) => l.who === 'boss')) assert.ok(sc.bossId && MONSTER_ART[sc.bossId] && sc.bossName, `${sc.id}: 보스 그림`);
  }
});

test('지역마다 도착·보스·정화 장면, 보스 장면의 보스는 그 지역 보스', () => {
  for (const R of REGIONS) {
    for (const k of ['arrive', 'boss', 'purified']) assert.ok(SCENES[`r${R.n}_${k}`], `r${R.n}_${k}`);
    assert.equal(SCENES[`r${R.n}_boss`].bossId, R.bossId);
    assert.equal(SCENES[`r${R.n}_boss`].bossName, R.bossName);
  }
  assert.ok(SCENES.prologue && SCENES.ending);
  for (const id of ['hawk', 'cheongryong', 'jujak']) assert.ok(SCENES[`meet_${id}`], id);
});

test('정화 장면에서 말하는 수호 영물 = 그 지역 수호 영물', () => {
  for (const R of REGIONS) {
    if (!R.guardian) continue;
    assert.ok(SCENES[`r${R.n}_purified`].lines.some((l) => l.who === R.guardian), `${R.name} → ${R.guardian}`);
  }
});

test('달리는 중 한마디: 실제 구간(x-2~x-5), 한 줄에 들어가는 길이', () => {
  const ids = new Set(STAGES.map((s) => s.id));
  for (const [id, l] of Object.entries(BARKS)) {
    assert.ok(ids.has(id), id);
    assert.ok(!id.endsWith('-1') && !id.endsWith('-6'), `${id}: 도착·보스 구간에는 한마디 대신 장면`);
    assert.ok(SPEAKERS.has(l.who), l.who);
    assert.ok(l.text.length <= 34, `${id}: ${l.text.length}자`);
  }
});

test('고서 기록: 필요한 조각 수가 늘어나는 순서, 전체 고서 조각 수 안', () => {
  const pages = STAGES.reduce((n, s) => n + s.pickups.filter((p) => p.type === 'lore_page').length + s.chests.filter((c) => c.loot.lore_page).length, 0);
  for (let i = 1; i < LORE.length; i++) assert.ok(LORE[i].need > LORE[i - 1].need);
  assert.ok(LORE[LORE.length - 1].need <= pages, `마지막 기록 ${LORE[LORE.length - 1].need}장 / 게임 전체 ${pages}장`);
});

test('저장 v4 → v5: 이야기 기록 추가, 기존 진행 유지', () => {
  const old = { ...newSave(), version: 4 } as Record<string, unknown>;
  delete old.story;
  (old.stages as Record<string, unknown>)['1-1'] = { cleared: true, chests: [], pickups: [] };
  const m = migrate(old);
  assert.equal(m.version, SAVE_VERSION);
  assert.deepEqual(m.story.seen, []);
  assert.ok(m.stages['1-1'].cleared);
  const again = migrate({ ...m, story: { seen: ['prologue'] } });
  assert.deepEqual(again.story.seen, ['prologue']);
});
