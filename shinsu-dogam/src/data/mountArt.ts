// 영물 일러스트(사용자 제공 '영물 도감' 원본에서 추출) 배치 정보
// - 이미지: public/assets/mounts/<id>_<stage>.png (오른쪽을 바라봄, tools/extract_beasts.py 로 생성)
// - seat: 라이더가 앉는 위치 (이미지 폭/높이 대비 비율)
// - motion: 정지 일러스트에 생동감을 주는 변형 애니메이션 종류
//   quad = 네발 (다리 영역 흔들기), bird = 날개 퍼덕임, serpent = 몸통 물결, shell = 느린 거북 걸음

export type MotionKind = 'quad' | 'bird' | 'serpent' | 'shell';

export interface MountArtInfo {
  w: number;
  h: number;
  seat: [number, number];
  motion: MotionKind;
  /** 다리가 시작되는 높이 (비율). 이 아래만 흔든다 */
  legLine: number;
  /** 뒷다리/앞다리 경계 x (비율) */
  split: number;
  /** 날개 뿌리 높이 (bird) */
  wingRoot?: number;
  /** 화면 표시 배율 */
  scale: number;
}

const S = [1.0, 0.95, 0.86];

export const MOUNT_ART: Record<string, MountArtInfo> = {
  wolf_0: { w: 92, h: 78, seat: [0.45, 0.48], motion: 'quad', legLine: 0.62, split: 0.5, scale: S[0] * 1.05 },
  wolf_1: { w: 124, h: 110, seat: [0.42, 0.4], motion: 'quad', legLine: 0.64, split: 0.5, scale: S[1] },
  wolf_2: { w: 180, h: 180, seat: [0.45, 0.42], motion: 'quad', legLine: 0.62, split: 0.48, scale: S[2] },
  hawk_0: { w: 81, h: 84, seat: [0.5, 0.48], motion: 'bird', legLine: 0.8, split: 0.5, wingRoot: 0.5, scale: S[0] * 1.1 },
  hawk_1: { w: 112, h: 113, seat: [0.48, 0.44], motion: 'bird', legLine: 0.8, split: 0.5, wingRoot: 0.48, scale: S[1] },
  hawk_2: { w: 210, h: 191, seat: [0.6, 0.42], motion: 'bird', legLine: 0.82, split: 0.6, wingRoot: 0.45, scale: S[2] },
  cheongryong_0: { w: 129, h: 123, seat: [0.4, 0.58], motion: 'quad', legLine: 0.78, split: 0.55, scale: S[0] },
  cheongryong_1: { w: 195, h: 173, seat: [0.44, 0.55], motion: 'serpent', legLine: 0.8, split: 0.55, scale: S[1] },
  cheongryong_2: { w: 304, h: 197, seat: [0.55, 0.46], motion: 'serpent', legLine: 0.82, split: 0.6, scale: S[2] },
  jujak_0: { w: 108, h: 120, seat: [0.42, 0.5], motion: 'bird', legLine: 0.82, split: 0.5, wingRoot: 0.55, scale: S[0] },
  jujak_1: { w: 216, h: 173, seat: [0.45, 0.47], motion: 'bird', legLine: 0.8, split: 0.5, wingRoot: 0.45, scale: S[1] },
  jujak_2: { w: 329, h: 197, seat: [0.66, 0.44], motion: 'bird', legLine: 0.8, split: 0.65, wingRoot: 0.45, scale: S[2] },
  baekho_0: { w: 117, h: 111, seat: [0.45, 0.5], motion: 'quad', legLine: 0.66, split: 0.52, scale: S[0] },
  baekho_1: { w: 186, h: 143, seat: [0.5, 0.26], motion: 'quad', legLine: 0.62, split: 0.55, scale: S[1] },
  baekho_2: { w: 304, h: 176, seat: [0.5, 0.32], motion: 'quad', legLine: 0.66, split: 0.58, scale: S[2] },
  hyeonmu_0: { w: 110, h: 88, seat: [0.45, 0.3], motion: 'shell', legLine: 0.78, split: 0.5, scale: S[0] * 1.05 },
  hyeonmu_1: { w: 176, h: 153, seat: [0.4, 0.42], motion: 'shell', legLine: 0.82, split: 0.5, scale: S[1] },
  hyeonmu_2: { w: 313, h: 180, seat: [0.42, 0.26], motion: 'shell', legLine: 0.82, split: 0.55, scale: S[2] },
  girin_0: { w: 124, h: 144, seat: [0.45, 0.55], motion: 'quad', legLine: 0.7, split: 0.55, scale: S[0] },
  girin_1: { w: 192, h: 192, seat: [0.45, 0.42], motion: 'quad', legLine: 0.66, split: 0.55, scale: S[1] },
  girin_2: { w: 273, h: 199, seat: [0.5, 0.42], motion: 'quad', legLine: 0.68, split: 0.58, scale: S[2] },
  bonghwang_0: { w: 95, h: 111, seat: [0.45, 0.5], motion: 'bird', legLine: 0.82, split: 0.5, wingRoot: 0.55, scale: S[0] },
  bonghwang_1: { w: 171, h: 188, seat: [0.55, 0.45], motion: 'bird', legLine: 0.8, split: 0.55, wingRoot: 0.45, scale: S[1] },
  bonghwang_2: { w: 270, h: 236, seat: [0.62, 0.42], motion: 'bird', legLine: 0.8, split: 0.65, wingRoot: 0.42, scale: S[2] },
  haetae_0: { w: 122, h: 112, seat: [0.4, 0.42], motion: 'quad', legLine: 0.7, split: 0.5, scale: S[0] },
  haetae_1: { w: 188, h: 151, seat: [0.45, 0.35], motion: 'quad', legLine: 0.7, split: 0.55, scale: S[1] },
  haetae_2: { w: 327, h: 193, seat: [0.45, 0.36], motion: 'quad', legLine: 0.72, split: 0.58, scale: S[2] },
};

export function artKey(mountId: string, stage: number): string {
  return `${mountId}_${stage}`;
}
