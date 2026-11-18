// 간단한 자동 진행 봇: 오른쪽으로 달리며 틈·벽 앞에서 점프. 기본 늑대로 구간 완주 가능 여부 확인용.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const stages = (process.argv[2] ?? '1-1,1-2,1-3,1-5').split(',');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const id of stages) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://localhost:5173/?debug&stage=${id}`);
  await page.waitForFunction(() => window.__SD_READY__ === true, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const res = await page.evaluate(async () => {
    const l = window.__SD__.game.loop;
    setInterval(() => { l.inFocus = true; l._coolDown = 0; }, 100);
    const g = window.__SD__.game;
    const s = window.__SD__.store.state;
    s.data.mounts.wolf.level = 12; // 몬스터에 쓰러지지 않을 정도 (이동 능력은 유체 그대로)
    const w = g.scene.getScene('World');
    w.player.rebuild(true);
    const v = window.__SD__.game.registry; void v;
    const ctl = (await import('/src/game/controls.ts')).controls;
    window.__botLimit = 70000;
    const start = performance.now();
    let maxX = 0, faints = 0, falls = 0, lastY = 0;
    return await new Promise((resolve) => {
      const tick = setInterval(() => {
        const W = g.scene.getScene('World');
        if (!W || !W.player) return;
        const p = W.player;
        if (W.cleared || s.data.stages[W.map.id]?.cleared) { clearInterval(tick); resolve({ ok: true, t: Math.round((performance.now() - start) / 1000), maxX, faints, falls }); return; }
        if (performance.now() - start > (window.__botLimit ?? 150000)) { clearInterval(tick); resolve({ ok: false, t: 150, x: Math.round(p.x), maxX: Math.round(maxX), faints, falls }); return; }
        // 오버레이(연출) 닫기
        if (!g.scene.isActive('World') && g.scene.isActive('Overlay')) { const o = g.scene.getScene('Overlay'); if (o.busy) { o.done?.(); } }
        maxX = Math.max(maxX, p.x);
        if (p.y < lastY - 400) falls++;
        lastY = p.y;
        ctl.virtual.right = true;
        const ahead = p.x + 70;
        const groundAhead = W.groundAt(ahead, p.bottom + 8);
        const wallAhead = W.solidAt(p.x + p.body.width / 2 + 24, p.bottom - 20);
        const monsterNear = W.monsters.some((m) => !m.dead && m.x > p.x && m.x - p.x < 140 && Math.abs(m.y - p.y) < 80);
        ctl.virtual.attack = monsterNear && !ctl.virtual.attack;
        const wantJump = p.grounded && (!groundAhead || wallAhead);
        // 상승 기류 안에서는 점프 유지 (표지판 안내대로)
        ctl.virtual.jump = wantJump || p.inUpdraft || (!p.grounded && p.body.velocity.y < 0 && ctl.virtual.jump);
      }, 30);
    });
  });
  console.log(id, JSON.stringify(res), errs.length ? 'ERR ' + errs[0] : '');
  await page.close();
}
await browser.close();
