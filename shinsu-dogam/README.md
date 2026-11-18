# 신수도감 (神獸圖鑑) · DIVINE BEASTS ATLAS

> 영물을 타고, 동방의 세계를 누비다.

한국 전통 영물을 타고 탐험하는 **2D 횡스크롤 라이딩 어드벤처** 웹게임입니다. (PC·모바일 브라우저)

- 영물 9종 × 3단계(유체·성장체·각성체) 일러스트 — 사용자 제공 '영물 도감' 원화를 그대로 잘라 사용
- 첫 지역 **월하산맥** 1-1 ~ 1-6 (보스 '흑운 산군' 포함)
- 현재 획득 가능: **늑대 · 매 · 청룡** (나머지 6종은 도감에 실루엣 + 데이터·기술 구현 완료, 다음 지역에서 획득 예정)
- 영물 성장·진화, 청룡 각성 후 자유 비행, 도감, 퀘스트, 소지품, 상점(테스트 결제), 자동 저장

---

## 1. 바로 실행해 보기 (개발 지식이 없어도 됩니다)

### 준비물 (한 번만)
1. **Node.js 22 이상** 설치: <https://nodejs.org> 에서 LTS 버전을 내려받아 설치합니다.
2. 이 폴더(`shinsu-dogam`)를 컴퓨터에 받습니다.

### 실행
터미널(맥: 터미널 / 윈도우: PowerShell)을 열고 이 폴더로 이동한 뒤:

```bash
npm install      # 처음 한 번만 (필요한 프로그램 내려받기)
npm run dev      # 게임 서버 실행
```

화면에 나오는 주소(보통 `http://localhost:5173`)를 크롬·엣지·사파리에서 열면 게임이 시작됩니다.
같은 와이파이의 휴대폰에서는 `Network:` 로 표시된 주소로 접속하면 터치로 플레이할 수 있습니다. (가로 화면)

### 조작법
| | PC | 모바일 |
|---|---|---|
| 이동 | A / D 또는 ← → | 왼쪽 아래 ← → |
| 점프 | Space (길게 누르면 더 높이 / 매는 활공) | ↑ 버튼 |
| 공격 (가까우면 근접, 멀면 원거리 · 누르고 있으면 연속) | J | 파랑 소용돌이 |
| 특수 기술 | K | 빨강 소용돌이 |
| 필살기 (게이지 100%) | U | 연꽃 |
| 돌진·회피 | L | 바람 버튼 |
| 영물 교체 | Q | 오른쪽 위 교체 버튼 |
| 메뉴 | Esc | 일시정지 버튼 |
| 비행 (청룡 각성체) | 공중에서 Space 한 번 더 → Space/W 상승, S 하강 | ↑ 유지 상승, ↓ 하강 |

---

## 2. 명령어 모음

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (코드 수정 시 자동 새로고침) |
| `npm run build` | 배포용 파일 생성 → `dist/` 폴더 |
| `npm run preview` | 만든 배포용 파일을 미리보기 |
| `npm test` | 게임 로직 단위 테스트 (24개) |
| `npm run test:e2e` | 실제 브라우저로 플레이 흐름 자동 검사 23항목 (빌드 후 실행, 결과 스크린샷 `test-results/`) |
| `python3 tools/extract_beasts.py` | 도감 원화 → 영물 27장 (기린 얼굴 채움·늑대/백호 입 다물기 보정 포함) |
| `python3 tools/extract_boar.py && python3 tools/make_monsters.py` | 참고 화면 산돼지 3마리 + 비행 요괴·보스(원화 색 변환) → `public/assets/monsters/` |
| `python3 tools/extract_backdrop.py` | 참고 화면 궁궐 절벽 원경(황혼·안개) + HUD 초상 |
| `python3 tools/extract_scenery.py` | 참고 화면 하늘·달·구름·숲·돌다리·정자·현수막 → `public/assets/scenery/` |
| `npm run typecheck` | 타입 검사 |
| `python3 tools/pack_sprites.py` | 받은 그림(`art-in/`) 검사·변환 → 게임에 자동 적용 ([ART_REQUEST](docs/ART_REQUEST.md)) |
| `npm run build:artifact` | Claude 아티팩트(웹 페이지) 게시용 한 장짜리 페이지 생성 → `dist-artifact/` (Phaser는 CDN, 글꼴은 Google Fonts) |

개발용 주소 옵션: `?debug` (숫자키 1~5 치트), `?debug&stage=1-4` (해당 구간 바로 시작)

---

## 3. 배포 (Cloudflare Pages 기준)

1. `npm run build` → `dist/` 폴더가 만들어집니다.
2. Cloudflare 대시보드 → Workers & Pages → Pages → **Direct Upload** 로 `dist` 폴더를 올리거나,
   GitHub 저장소를 연결해 빌드 명령 `npm run build`, 출력 폴더 `dist`, 루트 폴더 `shinsu-dogam` 으로 설정합니다.
3. 정적 파일만으로 동작하므로 서버 비용 없이 게임을 공개할 수 있습니다.

자세한 내용: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

> ⚠️ 실제 유료 판매는 아직 꺼져 있습니다. 상점은 **테스트 모드**(실제 청구 없음)이며,
> 토스페이먼츠 실결제는 사업자 등록·PG 계약·서버 검증 배포 후에 켭니다. → [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)

---

## 4. 폴더 구조

```
shinsu-dogam/
├─ index.html                 게임 페이지
├─ public/assets/mounts/      영물 일러스트 27장 (원화에서 추출, 투명 배경, 오른쪽 방향)
├─ public/assets/monsters/    몬스터 (참고 화면 산돼지 3마리 + 비행 요괴·보스)
├─ public/assets/backgrounds/ 참고 화면 궁궐 절벽 원경 (황혼·안개)
├─ public/assets/scenery/     참고 화면 하늘·달·구름·숲·돌다리·정자·현수막
├─ assets-src/reference/      사용자 제공 원본 참고 이미지 2장
├─ src/
│  ├─ main.ts                 게임 시작점 (Phaser 설정)
│  ├─ data/                   영물·몬스터·맵·상품·퀘스트·아이템 데이터 (새 콘텐츠는 여기에 추가)
│  ├─ systems/                진행 상태·저장·경험치·진화·퀘스트·도감 (Phaser 없이 테스트 가능), 사운드
│  ├─ services/               결제(테스트/토스 골격), 분석 이벤트
│  ├─ art/                    2D 일러스트 생성 (배경·지형·라이더·몬스터·UI·효과, 영물 일러스트 애니메이션 변형)
│  ├─ game/scenes/            화면: 부팅·타이틀·인트로·지도·월드·HUD·메뉴·연출
│  ├─ game/entities/          라이더+영물, 몬스터, 보스
│  ├─ game/combat/            전투·기술·투사체
│  ├─ game/world/             지형 생성, 패럴랙스 배경
│  └─ ui/                     한지 패널·버튼 등 UI 위젯
├─ functions/api/             토스페이먼츠 서버 검증 골격 (Cloudflare Pages Functions, 미배포)
├─ tools/                     원화 추출 스크립트, 개발용 스크린샷 도구
├─ tests/unit, tests/e2e      자동 테스트
└─ docs/                      기획·아트·경제·에셋·테스트·출시 문서
```

## 5. 문서
- [PROJECT_PLAN](docs/PROJECT_PLAN.md) · [GAME_DESIGN_DOCUMENT](docs/GAME_DESIGN_DOCUMENT.md) · [ART_GUIDE](docs/ART_GUIDE.md)
- [ECONOMY_DESIGN](docs/ECONOMY_DESIGN.md) · [LEGAL_AND_RELEASE_RESEARCH](docs/LEGAL_AND_RELEASE_RESEARCH.md)
- [ASSET_PLAN](docs/ASSET_PLAN.md) · [ASSET_MANIFEST](docs/ASSET_MANIFEST.md) · [ASSET_LICENSES](docs/ASSET_LICENSES.md) · [FIREFLY_PROMPTS](docs/FIREFLY_PROMPTS.md)
- **[ART_REQUEST — 판매 전 필요한 그림·준비물](docs/ART_REQUEST.md)**
- [DEVELOPMENT_LOG](docs/DEVELOPMENT_LOG.md) · [TEST_REPORT](docs/TEST_REPORT.md) · [RELEASE_CHECKLIST](docs/RELEASE_CHECKLIST.md) · [DEPLOYMENT](docs/DEPLOYMENT.md)
