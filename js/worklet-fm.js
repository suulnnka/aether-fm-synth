/* ============================================================
 * Aether FM — FM 声部处理器 (AudioWorklet)
 * 相位调制(PM)合成,与 DX7 同族:
 *   out[i] = wave(phase[i] + Σ modInput*index + selfFB)
 * 每个算子独立 ADSR 包络(调制算子的包络 = 调制指数包络)。
 * 连接按算子序号求值:序号 j <= i 的源使用其上一采样值,
 * 因此任意环路(含 A→B→A)都稳定为单采样反馈。
 * 本文件在主线程被 <script> 预载(空操作),由 addModule() 在
 * AudioWorklet 线程注册。
 * ============================================================ */
"use strict";
if (typeof AudioWorkletProcessor === "function") {

  const TAU = Math.PI * 2;
  const MODSCALE = 9.0;   // 调制指数上限(弧度)
  const FBSCALE  = 5.0;   // 自反馈强度
  const OUTSCALE = 0.5;

  const WAVES = [
    p => Math.sin(p),                                                  // Sin
    p => Math.asin(Math.sin(p)) * (2 / Math.PI),                       // Tri
    p => Math.tanh(5 * Math.sin(p)),                                   // Sqr
    p => { const x = p / TAU; return TAU * (x - Math.floor(x + 0.5)); } // Saw
  ];

  const OFF = 0, ATT = 1, DEC = 2, SUS = 3, REL = 4;

  class FMVoiceProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.ops = [];       // 参数 + 运行时状态
      this.conns = [];     // [fromIdx, toIdx]
      this.carriers = [];  // 输出到总线的算子序号
      this.incs = [];      // 每算子相位增量
      this.gate = false;
      this.note = 60;
      this.vel = 0.9;
      this.queue = [];     // 定时事件 {when, t, note, vel}
      this.started = false;
      this.endedPosted = false;
      this.port.onmessage = e => this.onMsg(e.data);
    }

    onMsg(d) {
      switch (d.type) {
        case "config": {
          const old = this.ops;
          this.ops = d.ops.map((o, i) => {
            const p = old[i] || { phase: 0, v: 0, st: OFF, prev: 0, lp: 0 };
            return {
              w: o.w | 0, ratio: o.ratio, det: o.det, lvl: o.lvl,
              fb: o.fb, a: Math.max(0.001, o.a), d: Math.max(0.005, o.d),
              s: o.s, r: Math.max(0.01, o.r), fm: !!o.fm, fhz: o.fhz, en: !!o.en,
              sy: o.sy !== false,                 // 相位同步(默认开)
              fl: o.fl | 0,                       // 输出滤波 0=关 1=低通 2=高通
              fc: o.fc || 8000,                   // 截止频率
              le: !!o.le, lw: o.lw | 0,           // LFO 开关 / 波形
              lr: o.lr || 4.5, ld: o.ld || 0,     // LFO 速率 / 深度(音分)
              phase: p.phase, v: p.v, st: p.st, prev: p.prev, lp: p.lp || 0, fa: 0,
              lfoPh: p.lfoPh || 0, linc: 0, lamp: 0
            };
          });
          this.conns = d.conns.map(c => [c[0] | 0, c[1] | 0]);
          this.carriers = d.carriers.map(c => c | 0);
          this.recalcIncs();
          break;
        }
        case "on":
          this.queue.push({ when: d.when || currentTime, t: 0, note: d.note | 0, vel: d.vel == null ? 0.9 : d.vel });
          this.started = true;
          this.endedPosted = false;
          break;
        case "off":
          this.queue.push({ when: d.when || currentTime, t: 1 });
          break;
        case "panic":
          for (const o of this.ops) { o.st = OFF; o.v = 0; o.prev = 0; }
          this.queue.length = 0;
          this.gate = false;
          this.started = false;
          break;
      }
    }

    recalcIncs() {
      const baseF = 440 * Math.pow(2, (this.note - 69) / 12);
      for (const o of this.ops) {
        const det = Math.pow(2, o.det / 1200);
        const f = o.fm ? o.fhz : baseF * o.ratio; // 固定频率模式不随音高
        o.inc = TAU * f * det / sampleRate;
        // 一阶滤波系数(每个采样点按 1-e^-ωt 逼近)
        o.fa = 1 - Math.exp(-TAU * Math.min(20000, o.fc) / sampleRate);
        // 每算子 LFO
        o.linc = TAU * Math.max(0.01, o.lr) / sampleRate;
        o.lamp = Math.pow(2, Math.min(1200, o.ld) / 1200) - 1; // 音分→频率倍率增量
      }
      this.incs = this.ops.map(o => o.inc);
    }

    fire(e) {
      if (e.t === 0) {
        this.gate = true;
        if ((e.note | 0) !== this.note) { this.note = e.note | 0; this.recalcIncs(); }
        this.vel = e.vel;
        for (const o of this.ops) {
          o.st = ATT; o.v = 0; o.prev = 0;
          if (o.sy) o.phase = 0;       // 相位同步: 触发时归零
          o.lfoPh = 0;                 // LFO 同步归零
        }
      } else {
        this.gate = false;
        for (const o of this.ops) if (o.st !== OFF) o.st = REL;
      }
    }

    process(inputs, outputs) {
      const out = outputs[0][0];
      if (!out) return true;
      out.fill(0);
      if (!this.started) return true;

      const N = out.length, sr = sampleRate, dt = 1 / sr;

      // 触发到期事件(块级精度, ≤~3ms)
      if (this.queue.length) {
        const tEnd = currentTime + N / sr;
        this.queue.sort((a, b) => a.when - b.when);
        while (this.queue.length && this.queue[0].when <= tEnd) {
          this.fire(this.queue.shift());
        }
      }

      const velAmp = 0.2 + 0.8 * Math.pow(this.vel, 1.3);
      let anyActive = false;

      for (let n = 0; n < N; n++) {
        let s = 0, activeOps = 0;

        for (let i = 0; i < this.ops.length; i++) {
          const o = this.ops[i];
          if (!o.en || o.st === OFF) { o.prev = 0; continue; }
          activeOps++;

          // --- ADSR ---
          if (o.st === ATT) {
            o.v += dt / o.a;
            if (o.v >= 1) { o.v = 1; o.st = DEC; }
          } else if (o.st === DEC) {
            o.v = o.s + (o.v - o.s) * Math.exp(-4 * dt / o.d);
            if (o.v - o.s < 0.001) o.st = SUS;
          } else if (o.st === REL) {
            o.v *= Math.exp(-4 * dt / o.r);
            if (o.v < 0.0008) { o.v = 0; o.st = OFF; }
          }

          // --- 相位 & 调制 ---
          let inc = this.incs[i];
          if (o.le && o.lamp > 0) {
            // 每算子 LFO → 频率(颤音), 波形取归一化 [-1,1]
            o.lfoPh += o.linc;
            if (o.lfoPh > 1e6) o.lfoPh %= TAU * 1000;
            let lv;
            if (o.lw === 0) lv = Math.sin(o.lfoPh);
            else if (o.lw === 1) lv = Math.asin(Math.sin(o.lfoPh)) * (2 / Math.PI);
            else if (o.lw === 2) lv = Math.sin(o.lfoPh) >= 0 ? 1 : -1;
            else { const x = o.lfoPh / TAU; lv = 2 * (x - Math.floor(x + 0.5)); }
            inc *= 1 + o.lamp * lv;
          }
          o.phase += inc;
          if (o.phase > 1e6) o.phase %= TAU * 1000;

          let m = 0;
          const conns = this.conns;
          for (let c = 0; c < conns.length; c++) {
            if (conns[c][1] !== i) continue;
            const src = this.ops[conns[c][0]];
            if (src && src.en) m += src.prev * MODSCALE;
          }
          if (o.fb > 0) m += o.prev * (o.fb / 99) * FBSCALE;

          let val = o.v * (o.lvl / 99) * WAVES[o.w & 3](o.phase + m);

          // --- 每算子输出滤波(一阶 LP/HP) ---
          if (o.fl) {
            o.lp += o.fa * (val - o.lp);
            if (o.fl === 1) val = o.lp;         // 低通
            else val = val - o.lp;              // 高通
          }

          o.prev = val;
          s += val;
        }

        if (this.gate || activeOps > 0) anyActive = true;
        out[n] = s * velAmp * OUTSCALE;
      }

      // 全部包络结束且无排队事件 → 通知主线程回收声部
      if (!anyActive && !this.gate && this.queue.length === 0 && !this.endedPosted) {
        this.endedPosted = true;
        this.port.postMessage({ type: "ended" });
      }
      return true;
    }
  }

  registerProcessor("fm-voice", FMVoiceProcessor);
}
