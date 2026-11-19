# DEPLOYMENT — 배포 방법

> 판매용 묶음 만들기: `npm run release` (출시 후보, 테스트 결제) · `npm run release:live` (판매 빌드 — 사업자 정보·결제 키가 있어야 만들어짐) → `release/*.zip`

## 1. 지금 바로 공개(무료 테스트 배포)
게임은 정적 파일만으로 동작한다(서버 불필요).

```bash
cd shinsu-dogam
npm install
npm run build        # dist/ 생성 (약 19MB: 대부분 글꼴 조각이며 브라우저는 필요한 조각만 받음)
```

### Cloudflare Pages
- **직접 업로드**: Cloudflare 대시보드 → Workers & Pages → 만들기 → Pages → 자산 업로드 → `dist` 폴더 끌어 놓기
- **GitHub 연동**: 저장소 연결 → 프레임워크 없음 → 빌드 명령 `npm run build` → 출력 디렉터리 `dist` → 루트 디렉터리 `shinsu-dogam` → 환경변수 `NODE_VERSION=22`
- 요금·한도는 바뀔 수 있으니 배포 시점에 Cloudflare 공식 요금 페이지를 확인한다 ([ECONOMY_DESIGN.md](ECONOMY_DESIGN.md) 출처 참고).

> 이 세션에서는 외부 서비스 가입·배포를 하지 않았다(사용자 승인 필요 작업).

### 다른 정적 호스팅
`vite.config.ts` 의 `base: './'` 설정으로 어느 하위 경로에 올려도 동작한다 (GitHub Pages, Netlify, Vercel, 일반 웹 서버).

## 2. 판매 시작 순서 (2026-11-19 — 코드는 준비됨, 아래 ①~⑥은 사장님이 하실 일)

**이미 되어 있는 것 (코드)**
- 토스페이먼츠 결제창 연동 (`src/services/payment/PaymentService.ts` `TossPaymentProvider`): 상점 구매 → 서버 주문 → 결제창 → 돌아오면 서버 승인 → 지급·장착 → 주소에서 결제 키 지움
- 서버 (`functions/api/`, Cloudflare Pages Functions): 주문(서버가 금액 결정·하루 5만 원 미만·계정당 1회 상품), 승인(금액 위조·중복 승인 차단, 토스 상태 DONE 확인), 구매 기록 조회(복구), 환불(관리자 토큰으로만)
- 구매 복구 코드: 회원가입 없이 무작위 코드로 서버 구매 기록과 연결 (설정 > 구매 복구 코드) — 다른 기기·저장 삭제 후 되찾기, 브라우저 저장을 고쳐 얻은 유료 상품은 회수
- 약관·개인정보 처리방침·환불 정책 **초안** (`tools/legal/` → `public/legal/`), 상점·설정에 사업자 정보 표시
- 판매 빌드에서 `?debug` 치트 꺼짐, 앱 설치 정보(manifest·아이콘), 공유 미리보기 이미지
- 테스트: 단위(서버 함수 포함), E2E 2종 — `npm test`, `npm run test:e2e`, `npm run test:e2e:pay` (토스·서버를 가짜로 대신한 결제 흐름)

**사장님이 하실 일**
1. **사업자 등록 · 통신판매업 신고** (세무사·구청 확인) → `release.config.json` 의 사업자 정보·약관 시행일을 채운다
2. **약관 검토**: `public/legal/*.html` 초안을 법률 전문가에게 검토받는다 (청약철회 제한 범위, 정기권·수행록 환불 방식, 국외 이전 고지 등)
3. **토스페이먼츠 가맹 신청** → 테스트 키(클라이언트·시크릿) 발급
4. **Cloudflare 가입** → Pages 프로젝트 만들기 → KV 네임스페이스 `ORDERS` 만들기 → `wrangler.toml` 의 KV id 채우기 → 대시보드 Secret 에 `TOSS_SECRET_KEY`(토스 시크릿 키), `ADMIN_TOKEN`(길고 무작위한 문자열) 입력
5. **테스트 키로 시험**: `VITE_TOSS_CLIENT_KEY=test_ck_… npm run release:live` → `release/shinsu-dogam-1.0.0-live.zip` 을 배포 → 실제 결제창에서 카드 결제·취소·결제창 닫기·새로고침·다른 기기 복구·환불(아래 예시)을 직접 해 본다
6. 시험이 끝나면 **라이브 키**로 다시 `npm run release:live` → 배포 → 판매 시작

환불 처리 (고객센터 요청을 받은 뒤):
```bash
curl -X POST https://<도메인>/api/payments/cancel -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "content-type: application/json" -d '{"orderId":"SD…","reason":"고객 요청"}'
```

⚠️ **확인하지 못한 것 (정직하게)**: 토스 SDK 주소·함수·파라미터와 승인·취소 API 형식은 공식 문서 기준으로 작성했지만, 이 개발 환경에서는 `docs.tosspayments.com` 에 접속할 수 없어 최신 문서로 다시 대조하지 못했고, 실제 토스 서버로 결제해 보지도 않았다 (테스트는 가짜 토스·가짜 서버로 흐름만 검증). **5번(테스트 키 시험)을 반드시 거친 뒤 판매**한다. Cloudflare 배포도 실제로 해 보지 않았다.

## 3. 버전 관리
- 원화 교체·밸런스 변경 후: `npm test && npm run build && npm run test:e2e` 통과 확인 → 배포
- 저장 데이터 형식을 바꾸면 `src/systems/state.ts` 의 `SAVE_VERSION` 을 올리고 `migrate` 에 변환 추가
