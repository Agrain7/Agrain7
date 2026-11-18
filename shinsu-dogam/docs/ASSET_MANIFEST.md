# ASSET_MANIFEST — 에셋 목록

최종 갱신: 2026-11-18

## 1. 원본 참고 이미지
| 파일 | 내용 | 출처 |
|---|---|---|
| `assets-src/reference/beasts_codex.png` | 영물 도감 9종×3단계 (1536×1024) | 사용자 제공 (대화 첨부 45633.png) |
| `assets-src/reference/gameplay_reference.png` | '신수연기' 포스터, 가운데 플레이 장면 (1536×1024) | 사용자 제공 (대화 첨부 45634.png) — 화면 구성 참고용, 게임에 직접 사용하지 않음 |

## 2. 영물 일러스트 (게임에서 직접 사용)
생성: `python3 tools/extract_beasts.py` (원본 → 투명 PNG, 크기 정보 `public/assets/mounts/beasts.json`)
라이더 좌석·애니메이션 파라미터: `src/data/mountArt.ts`

| 파일 | 내용 | 크기(px) | 처리 |
|---|---|---|---|
| `assets/mounts/cheongryong_0.png` | 청룡 유체 | 129×123 | 원본 좌표 (100, 158, 233, 292) → 배경 제거·좌우 반전 |
| `assets/mounts/cheongryong_1.png` | 청룡 성장체 | 195×173 | 원본 좌표 (254, 118, 449, 298) → 배경 제거·좌우 반전 |
| `assets/mounts/cheongryong_2.png` | 청룡 각성체 | 304×197 | 원본 좌표 (440, 107, 744, 304) → 배경 제거·좌우 반전 |
| `assets/mounts/baekho_0.png` | 백호 유체 | 117×111 | 원본 좌표 (98, 380, 222, 496) → 배경 제거·좌우 반전 |
| `assets/mounts/baekho_1.png` | 백호 성장체 | 186×143 | 원본 좌표 (238, 352, 426, 501) → 배경 제거·좌우 반전 |
| `assets/mounts/baekho_2.png` | 백호 각성체 | 304×176 | 원본 좌표 (440, 328, 744, 504) → 배경 제거·좌우 반전 |
| `assets/mounts/jujak_0.png` | 주작 유체 | 108×120 | 원본 좌표 (855, 172, 963, 297) → 배경 제거·좌우 반전 |
| `assets/mounts/jujak_1.png` | 주작 성장체 | 216×173 | 원본 좌표 (968, 124, 1185, 302) → 배경 제거·좌우 반전 |
| `assets/mounts/jujak_2.png` | 주작 각성체 | 329×197 | 원본 좌표 (1186, 107, 1516, 304) → 배경 제거·좌우 반전 |
| `assets/mounts/hyeonmu_0.png` | 현무 유체 | 110×88 | 원본 좌표 (851, 400, 966, 496) → 배경 제거·좌우 반전 |
| `assets/mounts/hyeonmu_1.png` | 현무 성장체 | 176×153 | 원본 좌표 (994, 344, 1173, 502) → 배경 제거·좌우 반전 |
| `assets/mounts/hyeonmu_2.png` | 현무 각성체 | 313×180 | 원본 좌표 (1203, 327, 1516, 507) → 배경 제거·좌우 반전 |
| `assets/mounts/girin_0.png` | 기린 유체 | 124×144 | 원본 좌표 (108, 576, 242, 726) → 배경 제거·좌우 반전 |
| `assets/mounts/girin_1.png` | 기린 성장체 | 192×192 | 원본 좌표 (258, 534, 451, 730) → 배경 제거·좌우 반전 |
| `assets/mounts/girin_2.png` | 기린 각성체 | 273×199 | 원본 좌표 (469, 532, 744, 731) → 배경 제거·좌우 반전 |
| `assets/mounts/bonghwang_0.png` | 봉황 유체 | 95×111 | 원본 좌표 (103, 820, 206, 940) → 배경 제거·좌우 반전 |
| `assets/mounts/bonghwang_1.png` | 봉황 성장체 | 171×188 | 원본 좌표 (212, 776, 384, 966) → 배경 제거·좌우 반전 |
| `assets/mounts/bonghwang_2.png` | 봉황 각성체 | 270×236 | 원본 좌표 (392, 754, 662, 990) → 배경 제거·좌우 반전 |
| `assets/mounts/haetae_0.png` | 해태 유체 | 122×112 | 원본 좌표 (854, 598, 979, 716) → 배경 제거·좌우 반전 |
| `assets/mounts/haetae_1.png` | 해태 성장체 | 188×151 | 원본 좌표 (996, 562, 1186, 723) → 배경 제거·좌우 반전 |
| `assets/mounts/haetae_2.png` | 해태 각성체 | 327×193 | 원본 좌표 (1189, 532, 1516, 725) → 배경 제거·좌우 반전 |
| `assets/mounts/wolf_0.png` | 늑대 유체 | 92×78 | 원본 좌표 (700, 843, 796, 941) → 배경 제거·좌우 반전 |
| `assets/mounts/wolf_1.png` | 늑대 성장체 | 124×110 | 원본 좌표 (796, 820, 922, 939) → 배경 제거·좌우 반전 |
| `assets/mounts/wolf_2.png` | 늑대 각성체 | 180×180 | 원본 좌표 (916, 796, 1096, 977) → 배경 제거·좌우 반전 |
| `assets/mounts/hawk_0.png` | 매 유체 | 81×84 | 원본 좌표 (1107, 843, 1193, 933) → 배경 제거·좌우 반전 |
| `assets/mounts/hawk_1.png` | 매 성장체 | 112×113 | 원본 좌표 (1196, 816, 1311, 936) → 배경 제거·좌우 반전 |
| `assets/mounts/hawk_2.png` | 매 각성체 | 210×191 | 원본 좌표 (1307, 769, 1517, 960) → 배경 제거·좌우 반전 |

## 3. 코드로 생성되는 2D 에셋 (실행 시 Canvas 2D로 그림)
| 키 | 내용 | 생성 함수 |
|---|---|---|
| `bg_<sky>_sky/moon/clouds/mount0/mount1/cliffs/grove` | 하늘·달·구름띠·원경 산맥 2겹·절벽 궁궐·꽃나무 숲 (sky: dusk/night/mist) | `src/art/world.ts` |
| `waterfall` | 폭포 물줄기 (세로 스크롤) | `paintWaterfall` |
| `pavilion, lantern_on/off, tree_cherry/plum, pine, rock, grass, arch, shrine` | 월드 장식 | `src/art/world.ts` |
| `ground_*, top_*, plat_*` | 지형 몸체·풀 가장자리·발판(나무·구름·돌·돌다리) | `src/art/world.ts` |
| `chest, chest_open, coin, pearl, lore, petal, goal, thorns, wisp*` | 상자·엽전·여의주 조각·고서·꽃잎·홍살문·가시·영기 | `src/art/objects.ts` |
| `fx_*` | 베기·할퀴기·먼지·깃털·불꽃·물·빛·어둠 구슬·번개·고리·숨결·보호막·타격·회복·돌 | `src/art/objects.ts` |
| `ui_*, btn_*, icon_*` | 한지 패널·버튼·터치 버튼·아이템 아이콘 | `src/art/objects.ts` |
| `rider_<outfit>` | 라이더 하람 시트 (의상 6종, idle 4·run 4·attack 2·hit 1·cast 2·fly 4) | `src/art/rider.ts` |
| `mon_<id>` | 몬스터 시트 (산돼지·도깨비 짐승·여우 정령·비행 요괴·바위 정령·흑운 산군) | `src/art/monsters.ts` |
| `mount_<id>_<stage>_<skin>` | 영물 원화 변형 애니메이션 (idle 4·run 6·fly 6) | `src/art/mountFrames.ts` |
| `portrait_*` | 도감·상점용 원화(스킨 색조 적용)·실루엣 | `src/art/mountFrames.ts` |

## 4. 글꼴
| 글꼴 | 패키지 | 용도 |
|---|---|---|
| Gowun Batang 700 | @fontsource/gowun-batang 5.3.0 | 제목 |
| Gowun Dodum 400 | @fontsource/gowun-dodum 5.3.0 | 본문·UI |
| Noto Serif KR 700 | @fontsource/noto-serif-kr 5.3.x | 한자 (獬豸는 미포함 → 시스템 글꼴로 대체) |

## 5. 사운드
외부 파일 없음. `src/systems/audio.ts` 에서 WebAudio로 효과음 15종과 국악 5음계 배경음(필드·보스)을 실시간 합성.

## 6. 개발 도구 (게임 배포물에 포함되지 않음)
`tools/extract_beasts.py`, `tools/anchors.py`, `tools/art-preview.*`, `tools/play.mjs`, `tools/mobile.mjs`, `tools/shot.mjs`
