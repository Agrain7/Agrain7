// 절차적 효과음·배경음 (WebAudio). 외부 음원 파일 없이 동작하며 저작권 문제가 없다.
// 배경음: 국악 5음계(황·태·중·임·남 ≈ 평조) 기반의 가야금풍 뜯는 소리 + 낮은 지속음.

type SfxName = 'jump' | 'land' | 'attack' | 'hit' | 'hurt' | 'coin' | 'levelup' | 'evolve' | 'chest' | 'skill' | 'dash' | 'thunder' | 'select' | 'boss' | 'pearl' | 'clear';

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private bgmTimer: number | null = null;
  private step = 0;
  music = 0.5;
  sfx = 0.7;

  /** 사용자 입력 후 호출 (브라우저 자동재생 정책) */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain.connect(this.master);
      this.setVolumes(this.music, this.sfx);
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(music: number, sfx: number) {
    this.music = music;
    this.sfx = sfx;
    if (!this.ctx) return;
    this.musicGain.gain.value = music * 0.35;
    this.sfxGain.gain.value = sfx * 0.6;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, dest?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq = 1200, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
  }

  play(name: SfxName) {
    if (!this.ctx || this.sfx <= 0) return;
    switch (name) {
      case 'jump': this.tone(330, 0.16, 'triangle', 0.25, 260); break;
      case 'land': this.noise(0.08, 0.25, 400); break;
      case 'attack': this.noise(0.1, 0.35, 2400); break;
      case 'hit': this.noise(0.08, 0.4, 900); this.tone(160, 0.1, 'square', 0.15, -60); break;
      case 'hurt': this.tone(220, 0.25, 'sawtooth', 0.2, -120); break;
      case 'coin': this.tone(988, 0.08, 'triangle', 0.18); this.tone(1318, 0.12, 'triangle', 0.18, 0, 0.06); break;
      case 'pearl': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.2, 0, i * 0.07)); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, 0, i * 0.08)); break;
      case 'evolve': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.2, 0, i * 0.12)); this.noise(1.2, 0.08, 3000, 0.2); break;
      case 'chest': [587, 740, 880].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.2, 0, i * 0.06)); break;
      case 'skill': this.tone(520, 0.3, 'sine', 0.2, 400); this.noise(0.2, 0.15, 3000); break;
      case 'dash': this.noise(0.15, 0.25, 1800); break;
      case 'thunder': this.noise(0.5, 0.5, 300); this.tone(90, 0.4, 'sawtooth', 0.2, -40); break;
      case 'select': this.tone(660, 0.07, 'triangle', 0.15); break;
      case 'boss': this.tone(98, 0.8, 'sawtooth', 0.25, -30); this.noise(0.6, 0.2, 200); break;
      case 'clear': [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, 0, i * 0.11)); break;
    }
  }

  /** 가야금풍 뜯는 소리 */
  private pluck(freq: number, delay: number, vol = 0.18) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'triangle';
    o2.type = 'sine';
    o.frequency.value = freq;
    o2.frequency.value = freq * 2.01;
    // 농현 (살짝 떨림)
    o.frequency.setValueAtTime(freq, t + 0.15);
    o.frequency.linearRampToValueAtTime(freq * 1.015, t + 0.35);
    o.frequency.linearRampToValueAtTime(freq, t + 0.55);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(600, t + 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.7);
    o2.stop(t + 1.7);
  }

  startMusic(mood: 'calm' | 'boss' = 'calm') {
    this.stopMusic();
    if (!this.ctx) return;
    // 평조 5음: D E G A B (+옥타브)
    const scale = mood === 'boss' ? [146.8, 155.6, 196, 220, 233.1, 293.7] : [293.7, 329.6, 392, 440, 493.9, 587.3, 659.3];
    const beat = mood === 'boss' ? 0.32 : 0.5;
    const tick = () => {
      if (!this.ctx) return;
      const s = this.step++;
      // 단순한 장단 (세마치 느낌: 3박 단위)
      if (s % 3 !== 2 || Math.random() < 0.3) {
        const idx = Math.floor((Math.sin(s * 0.7) * 0.5 + 0.5) * (scale.length - 1) + (Math.random() < 0.3 ? 1 : 0)) % scale.length;
        this.pluck(scale[idx], 0, mood === 'boss' ? 0.16 : 0.12);
      }
      if (s % 12 === 0) this.pluck(scale[0] / 2, 0, 0.14);
      if (mood === 'boss' && s % 3 === 0) this.tone(55, 0.2, 'sine', 0.25, 0, 0, this.musicGain);
    };
    this.bgmTimer = window.setInterval(tick, beat * 1000);
  }

  stopMusic() {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const audio = new AudioSystem();
export type { SfxName };
