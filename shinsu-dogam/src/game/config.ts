export const GAME_W = 1280;
export const GAME_H = 720;
export const GRAVITY = 1900;
export const MAX_FALL = 1150;

export const FONT_TITLE = '"Gowun Batang", "Noto Serif KR", "Batang", serif';
export const FONT_UI = '"Gowun Dodum", "Gowun Batang", "Noto Serif KR", sans-serif';

export const COLORS = {
  ink: '#1d1a2b',
  paper: '#f2e6cc',
  gold: '#e2b14c',
  red: '#c3352c',
  jade: '#2f8a7a',
  text: '#2a2030',
  textLight: '#f6ead0',
  hp: 0xd63c34,
  exp: 0x3f8fe0,
};

const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const DEBUG = q.has('debug');
export const AUTOTEST = q.has('autotest');
/** 개발·테스트용: ?stage=1-3 으로 해당 구간을 바로 시작 (?debug 와 함께 사용) */
export const START_STAGE = q.get('stage');

export const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
