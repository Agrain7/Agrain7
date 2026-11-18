// 분석 이벤트 기록. 초기 단계: 브라우저 로컬에만 저장(최근 500건) — 외부 전송 없음, 개인정보 없음.
// 추후 Cloudflare Web Analytics / 자체 수집 서버 등 provider를 연결할 수 있게 인터페이스만 분리했다.

export type AnalyticsEvent =
  | 'game_start' | 'tutorial_complete' | 'stage_start' | 'stage_clear' | 'monster_defeat' | 'mount_unlock'
  | 'mount_level_up' | 'mount_evolve' | 'codex_entry' | 'shop_view' | 'purchase_start' | 'purchase_success'
  | 'purchase_refund' | 'session_end';

export interface AnalyticsProvider { send(name: AnalyticsEvent, props: Record<string, unknown>, at: number): void }

const KEY = 'shinsu-dogam.analytics';
const MAX = 500;

export class Analytics {
  private providers: AnalyticsProvider[] = [];
  readonly sessionId = Math.random().toString(36).slice(2, 10);
  private started = Date.now();

  addProvider(p: AnalyticsProvider) {
    this.providers.push(p);
  }

  track(name: AnalyticsEvent, props: Record<string, unknown> = {}) {
    const at = Date.now();
    const rec = { name, props, at, s: this.sessionId };
    try {
      const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
      list.push(rec);
      localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    } catch {
      /* 저장소 사용 불가 시 무시 */
    }
    for (const p of this.providers) {
      try { p.send(name, props, at); } catch { /* 무시 */ }
    }
    if (import.meta.env?.DEV) console.debug('[analytics]', name, props);
  }

  sessionSeconds() {
    return Math.round((Date.now() - this.started) / 1000);
  }

  static dump(): unknown[] {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
  }
}

export const analytics = new Analytics();
