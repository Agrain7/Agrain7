// 게임 시작 (글꼴 로드 방식은 진입점별로 다름: main.ts=자체 호스팅, main-artifact.ts=Google Fonts)
import Phaser from 'phaser';
import { GAME_W, GAME_H } from './game/config.ts';
import { BootScene } from './game/scenes/BootScene.ts';
import { TitleScene } from './game/scenes/TitleScene.ts';
import { IntroScene } from './game/scenes/IntroScene.ts';
import { EndingScene } from './game/scenes/EndingScene.ts';
import { MapScene } from './game/scenes/MapScene.ts';
import { WorldScene } from './game/scenes/WorldScene.ts';
import { HudScene } from './game/scenes/HudScene.ts';
import { MenuScene } from './game/scenes/MenuScene.ts';
import { OverlayScene } from './game/scenes/OverlayScene.ts';
import { store } from './game/ctx.ts';
import { analytics } from './services/analytics/Analytics.ts';

export function startGame() {
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#14121d',
  // 물리 단계 수는 월드가 화면 주사율(60·90·120·144Hz)에 맞춘다 (WorldScene.syncPhysicsRate).
  // 60Hz 고정 물리는 120Hz 화면(갤럭시 폴드 커버·S 시리즈·아이폰 Pro 등)에서 영물이 한 프레임 걸러 움직여 끊겨 보였다.
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 4 },
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scene: [BootScene, TitleScene, IntroScene, MapScene, WorldScene, HudScene, MenuScene, OverlayScene, EndingScene],
});

// 탭을 닫거나 숨길 때 자동 저장 + 세션 종료 기록
const flush = () => {
  store.state.data.playTimeSec += analytics.sessionSeconds();
  store.state.save();
};
window.addEventListener('pagehide', () => {
  analytics.track('session_end', { seconds: analytics.sessionSeconds() });
  flush();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.state.save();
});

// 디버그·자동 테스트용 핸들 (게임 데이터 읽기 전용 + 간단한 조작)
(window as unknown as Record<string, unknown>).__SD__ = { game, store, analytics };
return game;
}
