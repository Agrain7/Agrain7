# FIREFLY_PROMPTS — Adobe Firefly 에셋 제작 지침

> 이 작업 환경에서는 Adobe Firefly에 접속할 수 없어 **이미지를 생성하지 않았다.** 아래는 사용자가 Firefly(또는 다른 도구)로 직접 만들 때 쓰는 프롬프트와 사양이다.
> 상업적 사용 가능 여부는 사용하는 Firefly 플랜과 그 시점의 약관으로 확인할 것.

## 0. 공통 규칙
- 기존 영물 원화(`assets-src/reference/beasts_codex.png`)와 **같은 디자인·같은 화풍**을 유지한다. 권리가 확인된 경우에만 Firefly의 스타일 참조(Style reference)에 원화를 넣는다.
- 측면 시점, **오른쪽을 바라봄**, 단색 배경(나중에 제거) 또는 투명, 캐릭터 1개만, 잘림 없이 전신.
- 금지어(네거티브로 명시): 3D render, isometric, top-down, pixel art, western fantasy armor, photorealistic, text, watermark.
- 같은 캐릭터의 프레임은 같은 시드·같은 스타일 참조·같은 크기로 생성 → 원점(발 위치) 맞춰 시트로 정리.

### 공통 스타일 문구 (영문 프롬프트 뒤에 붙임)
```
2D hand-painted Korean traditional fantasy illustration, minhwa and dancheong inspired ornaments,
clean bold dark-brown outlines, rich saturated colors, soft cel shading, golden cloud swirl motifs,
red knot tassels, side view facing right, full body, plain off-white background, game sprite, high detail
```

## 1. 라이더 '하람' (최우선)
```
Chibi young Korean girl explorer riding a mount, sitting astride, side view facing right,
black hair in a low bun with a golden binyeo hairpin and a long red daenggi ribbon flowing back,
white jeogori with red goreum ribbon, red chima skirt, white beoseon socks, small norigae tassel at the waist,
big friendly eyes, holding reins forward, + 공통 스타일
```
프레임: 앉기(호흡 4) · 몸 숙여 달리기(4, 댕기 휘날림) · 손 뻗기(2) · 피격 움찔(1) · 환호(2). 크기 160×180, 엉덩이(안장 접점)를 원점으로.
의상 변형: 색동 소매 / 남색 무사 철릭 + 붉은 머리띠 / 연보라 선녀 날개옷 + 하늘색 피백 / 녹원삼 금박 예복 / 털 배자 겨울옷.

## 2. 영물 프레임 애니메이션 (예: 늑대 각성체)
```
Spirit wolf mount, awakened form: white and silver fur, flowing blue spirit-flame mane and tail,
blue cloud-pattern markings, golden harness with jade ornaments and red tassels,
running gallop pose frame {N} of 8, legs {pose}, + 공통 스타일
```
동작별 포즈 지시: 달리기 8(앞다리 뻗음→모음→뒷다리 차기…), 대기 6, 점프 상승·하강 각 1, 착지 2, 공격(물기·할퀴기) 5, 피격 1, 돌진 3, (조류·용) 활공 4·비행 6.
단계별 차이(크기·비율·뿔·갈기·깃털·장식)는 원화를 그대로 따른다.

## 3. 월하산맥 배경 (레이어 분리, 가로 2048px 이음매 없이)
| 레이어 | 프롬프트 |
|---|---|
| 하늘 | `twilight sky gradient deep indigo to lavender to peach horizon, faint stars, huge pale golden full moon, korean painting style, no landscape` |
| 원경 산맥 | `distant layered misty blue-violet mountain range, sansuhwa ink wash, soft fog bands at the bottom, seamless horizontal tile, transparent sky` |
| 중경 | `tall moss-topped rock cliffs with traditional korean palace pavilions (giwa roof tiles, red pillars, dancheong) on top, pine trees, gaps for waterfalls, seamless horizontal tile, transparent background` |
| 폭포 | `narrow white-blue waterfall stream texture, vertical seamless tile` |
| 근경 | `cherry blossom and red plum trees with dark painterly branches, bushes, seamless horizontal tile, transparent background` |
| 전경 | `foreground grass tufts and hanging blossom branches, sparse, transparent background` |
| 지형 타일 | `stone ground tile with grass edge and tiny flowers, side view platformer tile, seamless 256px` |
| 장식 | 정자(누각), 석등(불 꺼짐/켜짐), 돌다리 아치, 홍살문(골), 용신 사당, 보물 상자(닫힘/열림), 엽전, 여의주 조각, 고서 조각 |

## 4. 몬스터·보스
```
Corrupted mountain boar spirit, dark charcoal body, white bristle mane with red swirl curse markings,
glowing red eyes, ivory tusks, side view facing right, + 공통 스타일
```
- 산속 도깨비 짐승: 청록 털뭉치, 외뿔, 큰 입과 송곳니, 방울 귀걸이
- 어둠의 여우 정령: 보랏빛 여우, 흰 가면 문양, 꼬리 3개 끝에 보라 불꽃
- 작은 비행 요괴: 먹물 몸, 외눈, 이마에 노란 부적
- 바위 정령: 이끼 덮인 바위 더미, 청록으로 빛나는 균열과 눈, 바위 주먹
- 보스 흑운 산군: 거대한 산군(호랑이·사자형) 요괴, 검은 구름 갈기, 붉은 줄무늬 뼈 가면, 끊어진 금 사슬, 붉게 빛나는 눈
프레임: 걷기 6, 공격 6, 피격 1 (보스: 대기 4, 돌진 6, 내려찍기 6, 포효 4, 기절 2)

## 5. UI
`traditional korean hanji paper panel with dark wood and gold hoemun corner ornaments, 9-slice friendly, flat front view`,
`round lacquered dark button with gold rim, empty center`, 아이콘(공격·기술·돌진·점프·화살표).

## 6. 생성 후 처리
1. 배경 제거(투명) → 오른쪽 방향 확인 → 프레임 원점 정렬
2. `docs/ASSET_MANIFEST.md`, `docs/ASSET_LICENSES.md` 에 도구·플랜·날짜·프롬프트 기록
3. [ASSET_PLAN.md](ASSET_PLAN.md) 3절의 방법으로 교체
