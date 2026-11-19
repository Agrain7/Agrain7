// 판매(출시) 빌드 만들기
//   node tools/release.mjs            → 출시 후보(RC): 테스트 결제, 약관은 초안 표시 — 점검·시연용
//   node tools/release.mjs --live     → 판매 빌드: 토스 실결제 (사업자 정보·결제 키가 모두 있어야 만들어짐)
// 하는 일: 사업자 정보 점검 → 약관·개인정보·환불 페이지 생성 → 단위 테스트 → 빌드 → release/ 에 배포 묶음(zip)
// 결제 키: 환경변수 VITE_TOSS_CLIENT_KEY (클라이언트 키만. 시크릿 키는 Cloudflare 대시보드 Secret 으로 — 여기서 쓰지 않음)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const live = process.argv.includes('--live');
const cfg = JSON.parse(readFileSync('release.config.json', 'utf8'));
const B = cfg.business;
const LABEL = { name: '상호', ceo: '대표자', regNo: '사업자등록번호', mailOrderNo: '통신판매업 신고번호', address: '사업장 주소', email: '고객센터 이메일', phone: '고객센터 전화', privacyOfficer: '개인정보 보호책임자' };
const missing = Object.keys(LABEL).filter((k) => !String(B[k] ?? '').trim());
const clientKey = process.env.VITE_TOSS_CLIENT_KEY ?? '';
const problems = [];
if (missing.length) problems.push(`release.config.json 사업자 정보 비어 있음: ${missing.map((k) => LABEL[k]).join(', ')}`);
if (!cfg.effectiveDate) problems.push('release.config.json effectiveDate (약관 시행일) 비어 있음');
if (live && !clientKey) problems.push('환경변수 VITE_TOSS_CLIENT_KEY 없음 (토스 클라이언트 키)');
if (live && /^test_/.test(clientKey)) console.log('⚠️  테스트 클라이언트 키로 만드는 중 — 결제 시험용. 실제 판매는 라이브 키(live_)로.');
if (live && problems.length) {
  console.error('\n판매 빌드를 만들 수 없습니다:\n - ' + problems.join('\n - ') + '\n');
  process.exit(1);
}

// 1) 약관 페이지
const fill = (s, extra = {}) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  const v = extra[k] ?? B[k] ?? cfg[k];
  return v === undefined || v === '' ? `<b style="color:#b8322a">[${LABEL[k] ?? k} 입력 필요]</b>` : String(v);
});
const layout = readFileSync('tools/legal/_layout.html', 'utf8');
const draft = problems.length || !live;
const notice = draft ? '<div class="draft">⚠️ 초안입니다. 사업자 정보 입력과 법률 전문가 검토를 마친 뒤 시행합니다.</div>' : '';
mkdirSync('public/legal', { recursive: true });
for (const [file, title] of [['terms', '이용약관'], ['privacy', '개인정보 처리방침'], ['refund', '환불 정책']]) {
  const body = fill(readFileSync(`tools/legal/${file}.html`, 'utf8'));
  writeFileSync(`public/legal/${file}.html`, fill(layout, { title, body, draftNotice: notice, effectiveDate: cfg.effectiveDate || '[시행일 입력 필요]' }));
}
console.log('✓ 약관·개인정보·환불 페이지', draft ? '(초안)' : '');

// 2) 테스트 + 빌드
execSync('npm test', { stdio: 'inherit' });
const env = { ...process.env, VITE_PAYMENT_MODE: live ? 'toss' : 'test', VITE_TOSS_CLIENT_KEY: live ? clientKey : '' };
execSync('npx tsc --noEmit && npx vite build', { stdio: 'inherit', env });

// 3) 배포 묶음
const ver = cfg.version;
const name = `shinsu-dogam-${ver}-${live ? 'live' : 'rc'}`;
const out = join('release', name);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('dist', join(out, 'dist'), { recursive: true });
cpSync('functions', join(out, 'functions'), { recursive: true });
cpSync('wrangler.toml', join(out, 'wrangler.toml'));
cpSync('docs/DEPLOYMENT.md', join(out, 'DEPLOYMENT.md'));
writeFileSync(join(out, 'RELEASE_INFO.txt'), [
  `신수도감 v${ver} (${live ? '판매 빌드 — 토스 실결제' : '출시 후보 — 테스트 결제'})`,
  `만든 날: ${new Date().toISOString()}`,
  '',
  problems.length ? '남은 일:\n - ' + problems.join('\n - ') : '사업자 정보: 입력됨',
  '',
  '배포: DEPLOYMENT.md 의 "판매 시작 순서"를 따라 Cloudflare Pages 에 dist + functions 를 올리고,',
  'KV(ORDERS)·Secret(TOSS_SECRET_KEY, ADMIN_TOKEN)을 설정합니다.',
].join('\n'));
const zip = `release/${name}.zip`;
rmSync(zip, { force: true });
execSync(`python3 -c "import shutil; shutil.make_archive('release/${name}', 'zip', 'release', '${name}')"`);
const files = readdirSync(join(out, 'dist')).length;
console.log(`\n✓ ${zip} (dist ${files}개 항목 + functions + wrangler.toml)`);
if (problems.length) console.log('\n남은 일 (판매 빌드 --live 전에):\n - ' + problems.join('\n - '));
if (!existsSync('.env.example')) console.log('참고: .env.example 를 보고 결제 키를 설정하세요');
