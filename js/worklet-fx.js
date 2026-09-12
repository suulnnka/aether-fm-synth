/* ============================================================
 * Aether FM — 量化/降采样 效果处理器 (AudioWorklet)
 * bits  : 幅度量化位数(24 ≈ 关闭)
 * rateHz: 采样保持频率(= 采样率 ≈ 关闭降采样)
 * 与 aether-grain 相同的 dual-mode: 主线程预载为空操作。
 * ============================================================ */
"use strict";
if (typeof AudioWorkletProcessor === "function") {

  class CrushProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.bits = 16;
      this.rateHz = sampleRate;
      this.counter = 0;
      this.held = 0;
      this.port.onmessage = e => {
        if (e.data.type === "p") Object.assign(this, e.data.p);
      };
    }

    process(inputs, outputs) {
      const inp = inputs[0] && inputs[0][0];
      const out = outputs[0][0];
      if (!out) return true;
      const interval = Math.max(1, sampleRate / Math.max(200, this.rateHz));
      const levels = Math.pow(2, Math.max(1, this.bits) - 1);
      for (let n = 0; n < out.length; n++) {
        const x = inp ? inp[n] : 0;
        this.counter += 1;
        if (this.counter >= interval) {
          this.counter -= interval;
          this.held = Math.round(x * levels) / levels;
        }
        out[n] = this.held;
      }
      return true;
    }
  }

  registerProcessor("aether-crush", CrushProcessor);
}
