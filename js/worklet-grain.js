/* ============================================================
 * Aether FM — 粒子(颗粒)效果处理器 (AudioWorklet)
 * 环形缓冲最近 2 秒输入,按密度随机发射颗粒:
 * 随机读取最近区域、Hann 窗、可移调/失谐,叠加后与干声混合。
 * ============================================================ */
"use strict";
if (typeof AudioWorkletProcessor === "function") {

  class GrainProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      const sr = sampleRate;
      this.sr = sr;
      this.N = sr * 2;                 // 环形缓冲 2s
      this.buf = new Float32Array(this.N);
      this.wIdx = 0;
      this.p = { size: 0.08, density: 8, mix: 0.35, grains: 6, pitch: 1, spread: 0.15 };
      this.grains = [];                // {t(已读秒,向前=过去更远), len, rate, amp, pan}
      this.nextAt = 0;
      this.clock = 0;
      this.port.onmessage = e => {
        if (e.data.type === "p") Object.assign(this.p, e.data.p);
      };
    }

    spawn() {
      if (this.grains.length >= Math.max(1, this.p.grains | 0)) return;
      const size = Math.min(0.5, Math.max(0.005, this.p.size));
      const spread = this.p.spread;
      this.grains.push({
        t: Math.random() * size * 0.9,             // 从颗粒窗口内随机处开始
        len: size,
        rate: this.p.pitch * (1 + (Math.random() * 2 - 1) * spread),
        amp: 0.6 + Math.random() * 0.4
      });
    }

    process(inputs, outputs) {
      const inp = inputs[0] && inputs[0][0];
      const out = outputs[0][0];
      if (!out) return true;
      const N = out.length;
      const mix = this.p.mix;
      const dens = Math.max(0, this.p.density);

      for (let n = 0; n < N; n++) {
        const x = inp ? inp[n] : 0;
        this.buf[this.wIdx] = x;

        // 发射颗粒
        if (dens > 0 && this.clock >= this.nextAt) {
          this.spawn();
          this.nextAt = this.clock + (1 / dens) * (0.5 + Math.random() * 0.5);
        }

        // 叠加颗粒
        let g = 0;
        const invSr = 1 / this.sr;
        for (let i = this.grains.length - 1; i >= 0; i--) {
          const gr = this.grains[i];
          const pos = gr.t * this.sr;
          const i0 = pos | 0, fr = pos - i0;
          const a = this.buf[(this.wIdx - i0 + this.N * 2) % this.N];
          const b = this.buf[(this.wIdx - i0 - 1 + this.N * 2) % this.N];
          const smp = a + (b - a) * fr;
          // Hann 窗
          const ph = gr.t / gr.len;
          const win = 0.5 - 0.5 * Math.cos(Math.PI * 2 * ph);
          g += smp * win * gr.amp;
          gr.t += gr.rate * invSr;
          if (gr.t >= gr.len) this.grains.splice(i, 1);
        }

        out[n] = x * (1 - mix) + g * mix * (0.9 / Math.sqrt(Math.max(1, this.p.grains)));
        this.wIdx = (this.wIdx + 1) % this.N;
        this.clock += invSr;
      }
      return true;
    }
  }

  registerProcessor("aether-grain", GrainProcessor);
}
