# DEPLOYMENT — 배포 방법

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

## 2. 실결제 활성화 (판매 단계 — 아직 하지 말 것)
선행 조건: 사업자 등록, 통신판매업 신고, 이용약관·개인정보 처리방침·환불 정책 게시, 토스페이먼츠 가맹 심사 → [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)

1. 계정·서버 저장(Supabase 등) 연결 — 구매 내역을 사용자 계정에 기록
2. `functions/api/` (Cloudflare Pages Functions) 배포:
   - 바인딩 `ORDERS` (KV 또는 DB로 교체), 시크릿 `TOSS_SECRET_KEY` (대시보드의 Secret 변수로만, 코드·저장소에 넣지 않음)
   - `POST /api/orders` 주문 생성(서버가 금액 결정) → 결제창 → `POST /api/payments/confirm` 금액 검증 + 토스 승인 API → 소유권 기록 → `POST /api/payments/cancel` 환불
3. 클라이언트: `src/services/payment/PaymentService.ts` 의 `payments` 를 `TossPaymentProvider` 로 교체, 클라이언트 키는 `VITE_TOSS_CLIENT_KEY`
4. **토스 테스트 키로 결제·취소·중복 승인·금액 위조 시나리오를 모두 시험한 뒤** 라이브 키로 전환
5. 서버 가격표(`functions/api/_shared.ts`)와 `src/data/products.ts` 일치 여부는 `npm test` 가 검사한다

⚠️ 서버 함수 코드는 토스 공식 문서의 승인 흐름(paymentKey·orderId·amount, 시크릿 키 Basic 인증)을 따라 작성했으나 **실제 호출로 검증하지 않았다.** 연동 시 최신 공식 문서로 다시 확인할 것.

## 3. 버전 관리
- 원화 교체·밸런스 변경 후: `npm test && npm run build && npm run test:e2e` 통과 확인 → 배포
- 저장 데이터 형식을 바꾸면 `src/systems/state.ts` 의 `SAVE_VERSION` 을 올리고 `migrate` 에 변환 추가
