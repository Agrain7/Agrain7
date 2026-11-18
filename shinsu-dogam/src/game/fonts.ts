// 웹폰트 사전 로드: 게임에서 쓰는 모든 글자를 모아 해당 글자 묶음(unicode-range)만 내려받는다.
import { MOUNTS, SKILLS } from '../data/mounts.ts';
import { MONSTERS } from '../data/monsters.ts';
import { ITEMS } from '../data/items.ts';
import { PRODUCTS } from '../data/products.ts';
import { QUESTS } from '../data/quests.ts';
import { STAGES, FUTURE_REGIONS } from '../data/maps/wolha.ts';
import { COSMETICS } from '../data/cosmetics.ts';
import { UI_TEXT } from './uiText.ts';

export function gameText(): string {
  const all = JSON.stringify([MOUNTS, SKILLS, MONSTERS, ITEMS, PRODUCTS, QUESTS, STAGES, FUTURE_REGIONS, COSMETICS, UI_TEXT]);
  const set = new Set<string>();
  for (const ch of all) set.add(ch);
  for (let c = 32; c < 127; c++) set.add(String.fromCharCode(c));
  return [...set].join('');
}

export async function loadFonts(timeoutMs = 6000) {
  if (!('fonts' in document)) return;
  const text = gameText();
  const loads = [
    document.fonts.load('700 32px "Gowun Batang"', text),
    document.fonts.load('400 20px "Gowun Dodum"', text),
    document.fonts.load('700 32px "Noto Serif KR"', '神獸圖鑑靑龍朱雀白虎玄武麒麟鳳凰月下狼靑雲鷹'),
  ];
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, timeoutMs))]);
}
