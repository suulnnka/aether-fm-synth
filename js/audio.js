/* ============================================================
 * Aether FM — 音频引擎
 * 声部池(fm-voice AudioWorklet) → FM输出总线 → 效果链 → 主输出
 * 效果实例按节点图按需创建;连线变化时重建拓扑。
 * ============================================================ */
"use strict";
window.Aether = window.Aether || {};

/* ---------- 效果参数规格 (graph.js 也使用) ---------- */
window.FX_SPECS = {
  chorus : { name:"合唱", color:"#39d98a", params:[
    { k:"rate",  label:"Rate",  min:0.05, max:8,    step:0.01, def:2.0,  fmt:"hz"  },
    { k:"depth", label:"Depth", min:0,    max:10,   step:0.05, def:3.5,  fmt:"ms1" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:50,   fmt:"pct" },
    { k:"voices",label:"Voices",min:1,    max:6,    step:1,    def:3,    fmt:"int" },
    { k:"base",  label:"Base",  min:5,    max:40,   step:0.5,  def:18,   fmt:"ms1" },
  ]},
  flanger: { name:"镶边", color:"#4fd1ff", params:[
    { k:"rate",  label:"Rate",  min:0.05, max:5,    step:0.01, def:0.3,  fmt:"hz"  },
    { k:"depth", label:"Depth", min:0,    max:10,   step:0.1,  def:2.5,  fmt:"ms1" },
    { k:"fb",    label:"FB",    min:0,    max:90,   step:1,    def:40,   fmt:"pct" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:50,   fmt:"pct" },
  ]},
  phaser : { name:"移相", color:"#9dff5a", params:[
    { k:"rate",  label:"Rate",  min:0.05, max:8,    step:0.01, def:0.6,  fmt:"hz"  },
    { k:"depth", label:"Depth", min:0,    max:100,  step:1,    def:60,   fmt:"pct" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:50,   fmt:"pct" },
  ]},
  tremolo: { name:"震音", color:"#2fbfd4", params:[
    { k:"rate",  label:"Rate",  min:0.1,  max:16,   step:0.1,  def:4.8,  fmt:"hz"  },
    { k:"depth", label:"Depth", min:0,    max:100,  step:1,    def:50,   fmt:"pct" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:70,   fmt:"pct" },
  ]},
  delay  : { name:"延时", color:"#ff9f43", params:[
    { k:"time",  label:"Time",  min:20,   max:1500, step:5,    def:300,  fmt:"ms"  },
    { k:"fb",    label:"FB",    min:0,    max:95,   step:1,    def:55,   fmt:"pct" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:30,   fmt:"pct" },
  ]},
  reverb : { name:"混响", color:"#5aa9ff", params:[
    { k:"size",  label:"Size",  min:0.3,  max:6,    step:0.1,  def:2.2,  fmt:"sec" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:35,   fmt:"pct" },
  ]},
  dist   : { name:"失真", color:"#ff5c5c", params:[
    { k:"drive", label:"Drive", min:1,    max:30,   step:0.1,  def:6,    fmt:"x"   },
    { k:"tone",  label:"Tone",  min:500,  max:12000,step:50,   def:6000, fmt:"hz2" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:60,   fmt:"pct" },
  ]},
  overdrive: { name:"过载", color:"#ff8c42", params:[
    { k:"drive", label:"Drive", min:1,    max:20,   step:0.1,  def:4,    fmt:"x"   },
    { k:"tone",  label:"Tone",  min:500,  max:12000,step:50,   def:5000, fmt:"hz2" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:70,   fmt:"pct" },
  ]},
  hardclip: { name:"硬削波", color:"#ff2e2e", params:[
    { k:"drive", label:"Drive", min:1,    max:30,   step:0.1,  def:5,    fmt:"x"   },
    { k:"tone",  label:"Tone",  min:500,  max:12000,step:50,   def:7000, fmt:"hz2" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:80,   fmt:"pct" },
  ]},
  filter : { name:"滤波", color:"#b18cff", params:[
    { k:"cutoff",label:"Cutoff",min:60,   max:14000,step:10,   def:4000, fmt:"hz2" },
    { k:"reso",  label:"Reso",  min:0.1,  max:18,   step:0.1,  def:2,    fmt:"x"   },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:100,  fmt:"pct" },
  ], types:["低通","高通","带通"] },
  eq     : { name:"均衡", color:"#ffd166", params:[
    { k:"low",   label:"Low",   min:-15,  max:15,   step:0.5,  def:0,    fmt:"db"  },
    { k:"mid",   label:"Mid",   min:-15,  max:15,   step:0.5,  def:0,    fmt:"db"  },
    { k:"high",  label:"High",  min:-15,  max:15,   step:0.5,  def:0,    fmt:"db"  },
    { k:"midF",  label:"Freq",  min:250,  max:4000, step:10,   def:1000, fmt:"hz2" },
  ]},
  comp   : { name:"压缩", color:"#e6ff5c", params:[
    { k:"thr",   label:"Thr",   min:-50,  max:0,    step:1,    def:-20,  fmt:"db"  },
    { k:"ratio", label:"Ratio", min:1,    max:20,   step:0.1,  def:4,    fmt:"x"   },
    { k:"atk",   label:"Atk",   min:1,    max:100,  step:1,    def:10,   fmt:"ms"  },
    { k:"rel",   label:"Rel",   min:10,   max:500,  step:5,    def:120,  fmt:"ms"  },
    { k:"gain",  label:"Gain",  min:0,    max:24,   step:1,    def:6,    fmt:"db"  },
  ]},
  quant  : { name:"量化", color:"#63f2ff", params:[
    { k:"bits",  label:"Bits",  min:2,    max:16,   step:1,    def:8,    fmt:"int" },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:100,  fmt:"pct" },
  ]},
  decim  : { name:"降采样", color:"#c77dff", params:[
    { k:"rate",  label:"Rate",  min:500,  max:20000,step:50,   def:8000, fmt:"hz2", log:true },
    { k:"mix",   label:"Mix",   min:0,    max:100,  step:1,    def:100,  fmt:"pct" },
  ]},
  grain  : { name:"粒子", color:"#ff6b9d", params:[
    { k:"size",   label:"Size",   min:10,  max:400, step:1,   def:60, fmt:"ms"  },
    { k:"density",label:"Density",min:0.5, max:40,  step:0.5, def:15, fmt:"x1"  },
    { k:"mix",    label:"Mix",    min:0,   max:100, step:1,   def:35, fmt:"pct" },
    { k:"grains", label:"Grains", min:1,   max:16,  step:1,   def:8,  fmt:"int" },
    { k:"spread", label:"Spread", min:0,   max:100, step:1,   def:15, fmt:"pct" },
    { k:"pitch",  label:"Pitch",  min:0.25,max:4,   step:0.01,def:1,  fmt:"x2"  },
  ]},
};

(function () {
  const A = (Aether.audio = {
    ctx: null, ready: false,
    voices: [], maxVoices: 10,
    fmBus: null,          // FM输出总线 (声部汇合 + Level)
    masterGain: null, limiter: null, analyser: null, metroGain: null,
    fx: new Map(),        // fxId → 实例
    meterBuf: null,
  });

  /* ---------------- 初始化 ---------------- */
  A.init = async function () {
    if (A.ready) return;
    // 系统一律使用 96kHz(设备不支持时浏览器自动重采样到硬件频率)
    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive", sampleRate: 96000 });
    } catch (e) {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    }
    A.ctx = ctx;
    await Promise.all([
      ctx.audioWorklet.addModule("js/worklet-fm.js"),
      ctx.audioWorklet.addModule("js/worklet-grain.js"),
      ctx.audioWorklet.addModule("js/worklet-fx.js"),
    ]);

    A.fmBus = ctx.createGain();
    A.fmBus.gain.value = 0.8;

    A.masterGain = ctx.createGain();
    A.masterGain.gain.value = 0.85;

    A.limiter = ctx.createDynamicsCompressor();
    A.limiter.threshold.value = -8; A.limiter.knee.value = 6;
    A.limiter.ratio.value = 12; A.limiter.attack.value = 0.003; A.limiter.release.value = 0.25;

    A.analyser = ctx.createAnalyser();
    A.analyser.fftSize = 1024;
    A.meterBuf = new Float32Array(A.analyser.fftSize);

    A.metroGain = ctx.createGain();
    A.metroGain.gain.value = 0.12;

    A.fmBus.connect(A.masterGain);
    A.metroGain.connect(A.masterGain);
    A.masterGain.connect(A.limiter);
    A.limiter.connect(A.analyser);
    A.analyser.connect(ctx.destination);

    for (let i = 0; i < A.maxVoices; i++) A.makeVoice();

    A.ready = true;
    if (Aether.Graph) {
      try { A.syncPatch(); } catch (e) { console.error("syncPatch", e); }
    }
    if (ctx.state === "suspended") await ctx.resume();
  };

  A.ensure = async function () {
    if (!A.ready) {
      try { await A.init(); }
      catch (e) { console.error(e); Aether.toast("音频初始化失败: " + e.message); return false; }
    }
    if (A.ctx.state === "suspended") {
      try { await A.ctx.resume(); } catch (e) {}
      // resume 返回后时钟可能仍停在 0(输出流延迟启动), 等它真正走动
      for (let i = 0; i < 20 && A.ctx.currentTime === 0; i++) {
        await new Promise(r => setTimeout(r, 25));
      }
    }
    return true;
    return true;
  };

  /* ---------------- 声部池 ---------------- */
  A.makeVoice = function () {
    const v = { node: null, busy: false, midi: null, startedAt: 0, releasedAt: null };
    const node = new AudioWorkletNode(A.ctx, "fm-voice", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
    node.port.onmessage = e => { if (e.data.type === "ended") { v.busy = false; v.midi = null; v.releasedAt = null; } };
    node.connect(A.fmBus);
    v.node = node;
    A.voices.push(v);
    if (A.ready && Aether.Graph && Aether.buildVoiceConfig)
      node.port.postMessage(Object.assign({ type: "config" }, Aether.buildVoiceConfig()));
    return v;
  };

  A.allocVoice = function () {
    let v = A.voices.find(x => !x.busy);
    if (!v) {
      // 抢占: 优先已释放的, 其次最早开始/最早释放的
      v = A.voices.reduce((best, x) => {
        const t = x.releasedAt != null ? x.releasedAt : x.startedAt + 1e6;
        const bt = best.releasedAt != null ? best.releasedAt : best.startedAt + 1e6;
        return t < bt ? x : best;
      }, A.voices[0]);
      v.node.port.postMessage({ type: "panic" });
    }
    return v;
  };

  A.noteOn = function (midi, vel = 0.9) {
    if (!A.ready) return;
    const t = A.ctx.currentTime;
    const v = A.allocVoice();
    v.busy = true; v.midi = midi; v.startedAt = t; v.releasedAt = null;
    v.node.port.postMessage({ type: "on", when: t, note: midi, vel });
  };

  A.noteOff = function (midi) {
    if (!A.ready) return;
    const t = A.ctx.currentTime;
    for (const v of A.voices) {
      if (v.busy && v.midi === midi && v.releasedAt == null) {
        v.node.port.postMessage({ type: "off", when: t });
        v.releasedAt = t;
      }
    }
  };

  A.scheduleNote = function (midi, when, dur, vel = 0.9) {
    if (!A.ready) return;
    const v = A.allocVoice();
    v.busy = true; v.midi = midi; v.startedAt = when; v.releasedAt = when + dur;
    v.node.port.postMessage({ type: "on", when, note: midi, vel });
    v.node.port.postMessage({ type: "off", when: when + dur });
  };

  A.allOff = function () {
    if (!A.ready) return;
    for (const v of A.voices) {
      if (v.busy) v.node.port.postMessage({ type: "panic" });
      v.busy = false; v.midi = null; v.releasedAt = null;
    }
  };

  A.click = function (when, accent) {
    if (!A.ready) return;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.frequency.value = accent ? 1600 : 1050;
    g.gain.setValueAtTime(1, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.035);
    o.connect(g); g.connect(A.metroGain);
    o.start(when); o.stop(when + 0.06);
  };

  A.rms = function () {
    if (!A.ready) return 0;
    A.analyser.getFloatTimeDomainData(A.meterBuf);
    let s = 0;
    for (let i = 0; i < A.meterBuf.length; i += 4) { const x = A.meterBuf[i]; s += x * x; }
    return Math.sqrt(s / (A.meterBuf.length / 4));
  };

  /* ---------------- 补丁同步 ---------------- */
  A.syncPatch = function () {
    if (!A.ready || !Aether.Graph) return;
    const cfg = Aether.buildVoiceConfig();
    for (const v of A.voices) v.node.port.postMessage(Object.assign({ type: "config" }, cfg));
    const fm = Aether.Graph.fmOut;
    if (fm) A.fmBus && A.fmBus.gain.setTargetAtTime(fm.p.level, A.ctx.currentTime, 0.02);
    const m = Aether.Graph.master;
    if (m) A.masterGain.gain.setTargetAtTime(m.p.vol, A.ctx.currentTime, 0.02);

    // 效果实例对账(新增/删除/参数)
    for (const n of Aether.Graph.fxList()) {
      const inst = A.ensureFx(n.id, n.fxType);
      inst.setEnabled(n.p.enabled !== false);
      for (const spec of window.FX_SPECS[n.fxType].params) {
        if (n.p[spec.k] !== undefined) inst.setParam(spec.k, n.p[spec.k]);
      }
    }
    for (const id of [...A.fx.keys()]) {
      if (!Aether.Graph.nodes.has(id)) A.removeFx(id);
    }
    A.rebuildRouting();
  };

  A.setFxParam = function (id, key, val) {
    const inst = A.fx.get(id);
    if (inst) inst.setParam(key, val);
  };

  /* ---------------- 效果实例 ---------------- */
  A.ensureFx = function (id, type) {
    let inst = A.fx.get(id);
    if (inst && inst.type !== type) A.removeFx(id);
    if (!A.fx.has(id)) {
      inst = makeFx(A.ctx, type);
      A.fx.set(id, inst);
    }
    return A.fx.get(id);
  };

  A.removeFx = function (id) {
    const inst = A.fx.get(id);
    if (!inst) return;
    inst.setEnabled(false);
    try { inst.input.disconnect(); inst.out.disconnect(); } catch (e) {}
    A.fx.delete(id);
  };

  A.audioOutOf = function (nodeId) {
    if (nodeId === "fmout") return A.fmBus;
    if (nodeId === "master") return null;
    const n = Aether.Graph.nodes.get(nodeId);
    if (n && n.type === "fx") { A.ensureFx(nodeId, n.fxType); return A.fx.get(nodeId).out; }
    return null;
  };

  A.audioInOf = function (nodeId) {
    if (nodeId === "master") return A.masterGain;
    if (nodeId === "fmout") return null; // 算子→FM输出 在声部内部处理
    const n = Aether.Graph.nodes.get(nodeId);
    if (n && n.type === "fx") { A.ensureFx(nodeId, n.fxType); return A.fx.get(nodeId).input; }
    return null;
  };

  A.rebuildRouting = function () {
    if (!A.ready || !Aether.Graph) return;
    A.fmBus.disconnect();
    for (const inst of A.fx.values()) { try { inst.out.disconnect(); } catch (e) {} }

    // fmOut 的所有下游
    const wired = new Set();
    const connectOut = (outNode, inNode) => { try { outNode.connect(inNode); } catch (e) {} };
    for (const c of Aether.Graph.cables) {
      const from = A.audioOutOf(c.from), to = A.audioInOf(c.to);
      if (!from || !to) continue;
      connectOut(from, to);
      if (c.from === "fmout") wired.add("fmout-wired");
    }
    // fmOut 未连任何效果 → 直通主输出
    if (!wired.has("fmout-wired")) A.fmBus.connect(A.masterGain);
  };

  /* ---------------- 各效果子图 ---------------- */
  // 统一架构: input → dry → out ; input → [内部链] → wet → out
  // setEnabled(false) 时: 内部链拆除, dry=1 wet=0 (旁路)
  function makeFx(ctx, type) {
    const input = ctx.createGain(), out = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
    input.connect(dry); dry.connect(out); wet.connect(out);

    const inst = {
      type, input, out, dry, wet, params: {}, bypassed: true,
      E: {},                 // 内部节点
      build: null, unbuild: null, apply: null, // 子类型钩子
    };

    const spec = window.FX_SPECS[type];
    for (const p of spec.params) inst.params[p.k] = p.def;

    const isGrain = type === "grain"; // 粒子的干湿在 worklet 内部
    const defaultMix = () => inst.params.mix ?? 100;

    inst.setEnabled = function (on) {
      on = !!on;
      if (on === !inst.bypassed) {
        if (on && inst.apply) inst.apply();
        return;
      }
      if (on) {
        if (inst.build) inst.build();
        if (isGrain) { dry.gain.value = 0; wet.gain.value = 1; }
        else {
          const m = defaultMix() / 100;
          if (type === "chorus") { dry.gain.value = 1; wet.gain.value = m; } // 合唱叠加式
          else { dry.gain.value = 1 - m; wet.gain.value = m; }
        }
        inst.bypassed = false;
        if (inst.apply) inst.apply();
      } else {
        if (inst.unbuild) inst.unbuild();
        dry.gain.value = 1; wet.gain.value = 0;
        inst.bypassed = true;
      }
    };

    inst.setParam = function (k, v) {
      inst.params[k] = v;
      if (inst.bypassed) {
        // 旁路时仅合唱的 wet 需要记忆, 其余等启用时 apply
        return;
      }
      if (k === "mix" && !isGrain) {
        const m = v / 100;
        if (type === "chorus") wet.gain.setTargetAtTime(m, ctx.currentTime, 0.02);
        else { dry.gain.setTargetAtTime(1 - m, ctx.currentTime, 0.02); wet.gain.setTargetAtTime(m, ctx.currentTime, 0.02); }
      }
      if (inst.apply) inst.apply();
    };

    /* ============ 子类型 ============ */
    if (type === "chorus") {
      inst.build = function () {
        inst.unbuild && inst.unbuild();
        inst.E.delays = []; inst.E.lfos = [];
        const nv = Math.round(inst.params.voices ?? 3);
        const rate = inst.params.rate ?? 2;
        const depth = (inst.params.depth ?? 3.5) / 1000;
        const base = (inst.params.base ?? 18) / 1000;
        for (let i = 0; i < nv; i++) {
          const d = ctx.createDelay(0.2);
          d.delayTime.value = base + i * 0.004;
          const lfo = ctx.createOscillator(); lfo.type = "sine";
          lfo.frequency.value = Math.max(0.02, rate * (1 + (i - nv / 2) * 0.13));
          const lg = ctx.createGain(); lg.gain.value = depth;
          lfo.connect(lg); lg.connect(d.delayTime);
          input.connect(d); d.connect(wet);
          lfo.start();
          inst.E.delays.push(d); inst.E.lfos.push(lfo);
        }
      };
      inst.unbuild = function () {
        inst.E.lfos && inst.E.lfos.forEach(o => { try { o.stop(); } catch (e) {} });
        inst.E.delays && inst.E.delays.forEach(d => { try { d.disconnect(); } catch (e) {} });
        inst.E.lfos = []; inst.E.delays = [];
      };
      inst.apply = function () {
        // 参数变化 → 重建延迟线(节点少, 代价可忽略)
        if (!inst.bypassed) inst.build();
      };
    }

    if (type === "tremolo") {
      inst.build = function () {
        const vca = ctx.createGain();
        const lfo = ctx.createOscillator(); lfo.type = "sine";
        const lg = ctx.createGain();
        const dc = ctx.createConstantSource();
        lfo.connect(lg); lg.connect(vca.gain); dc.connect(vca.gain);
        input.connect(vca); vca.connect(wet);
        lfo.start(); dc.start();
        inst.E = { vca, lfo, lg, dc };
      };
      inst.unbuild = function () {
        const E = inst.E;
        if (E.lfo) { try { E.lfo.stop(); E.dc.stop(); } catch (e) {} }
        try { E.vca && E.vca.disconnect(); } catch (e) {}
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.lfo) return;
        const t = ctx.currentTime;
        E.lfo.frequency.setTargetAtTime(inst.params.rate, t, 0.02);
        E.lg.gain.setTargetAtTime((inst.params.depth / 100) / 2, t, 0.02);
        E.dc.offset.setTargetAtTime(1 - (inst.params.depth / 100) / 2, t, 0.02);
      };
    }

    if (type === "delay") {
      inst.build = function () {
        const dl = ctx.createDelay(2.0);
        const fb = ctx.createGain();
        input.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet);
        inst.E = { dl, fb };
      };
      inst.unbuild = function () {
        try { inst.E.dl && inst.E.dl.disconnect(); inst.E.fb && inst.E.fb.disconnect(); } catch (e) {}
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.dl) return;
        const t = ctx.currentTime;
        E.dl.delayTime.setTargetAtTime(inst.params.time / 1000, t, 0.05);
        E.fb.gain.setTargetAtTime(inst.params.fb / 100, t, 0.02);
      };
    }

    if (type === "reverb") {
      const makeIR = seconds => {
        const sr = ctx.sampleRate, len = Math.floor(sr * Math.max(0.1, seconds));
        const ir = ctx.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
          const d = ir.getChannelData(ch);
          let lp = 0;
          for (let i = 0; i < len; i++) {
            const t = i / len;
            const noise = Math.random() * 2 - 1;
            lp += (noise - lp) * 0.28;
            d[i] = lp * Math.pow(1 - t, 2.2) * Math.min(1, i / (sr * 0.005));
          }
        }
        return ir;
      };
      inst.build = function () {
        const cv = ctx.createConvolver();
        input.connect(cv); cv.connect(wet);
        inst.E = { cv };
      };
      inst.unbuild = function () {
        try { inst.E.cv && inst.E.cv.disconnect(); } catch (e) {}
        inst.E = {};
      };
      inst.apply = function () {
        if (inst.E.cv) inst.E.cv.buffer = makeIR(inst.params.size);
      };
    }

    /* ---- 失真家族: 软削波(tanh) / 过载(不对称二极管) / 硬削波(clamp) ---- */
    if (type === "dist" || type === "overdrive" || type === "hardclip") {
      const makeCurve = drive => {
        const n = 1024, c = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * 2 - 1;
          if (type === "dist") {
            c[i] = Math.tanh(x * drive) / Math.tanh(drive);            // 对称软削波
          } else if (type === "overdrive") {
            const k = Math.max(0.25, drive / 4);                       // 驱动=曲线曲率
            c[i] = x >= 0 ? 1 - Math.exp(-x * k) : -(1 - Math.exp(x * k));
          } else {
            c[i] = Math.max(-1, Math.min(1, x));                       // 砖墙硬削波
          }
        }
        return c;
      };
      inst.build = function () {
        const pre = ctx.createGain();
        const sh = ctx.createWaveShaper(); sh.oversample = "2x";
        const tone = ctx.createBiquadFilter(); tone.type = "lowpass";
        input.connect(pre); pre.connect(sh); sh.connect(tone); tone.connect(wet);
        inst.E = { pre, sh, tone };
      };
      inst.unbuild = function () {
        const E = inst.E;
        [E.pre, E.sh, E.tone].forEach(n => n && n.disconnect && n.disconnect());
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.pre) return;
        const t = ctx.currentTime;
        E.pre.gain.setTargetAtTime(type === "overdrive" ? 1 : inst.params.drive, t, 0.02);
        E.sh.curve = makeCurve(inst.params.drive);
        E.tone.frequency.setTargetAtTime(inst.params.tone, t, 0.02);
      };
    }

    if (type === "filter") {
      inst.build = function () {
        const bq = ctx.createBiquadFilter();
        input.connect(bq); bq.connect(wet);
        inst.E = { bq };
      };
      inst.unbuild = function () {
        try { inst.E.bq && inst.E.bq.disconnect(); } catch (e) {}
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.bq) return;
        const t = ctx.currentTime;
        E.bq.type = ["lowpass", "highpass", "bandpass"][inst.params.type | 0] || "lowpass";
        E.bq.frequency.setTargetAtTime(inst.params.cutoff, t, 0.02);
        E.bq.Q.setTargetAtTime(inst.params.reso, t, 0.02);
      };
    }

    if (type === "grain") {
      inst.build = function () {
        const gn = new AudioWorkletNode(ctx, "aether-grain", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        input.connect(gn); gn.connect(wet);
        inst.E = { gn };
      };
      inst.unbuild = function () {
        try { inst.E.gn && inst.E.gn.disconnect(); } catch (e) {}
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.gn) return;
        E.gn.port.postMessage({ type: "p", p: {
          size: inst.params.size / 1000, density: inst.params.density,
          mix: inst.params.mix / 100, grains: inst.params.grains,
          pitch: inst.params.pitch, spread: inst.params.spread / 100,
        }});
      };
    }

    if (type === "quant" || type === "decim") {
      inst.build = function () {
        const gn = new AudioWorkletNode(ctx, "aether-crush", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        input.connect(gn); gn.connect(wet);
        inst.E = { gn };
      };
      inst.unbuild = function () {
        try { inst.E.gn && inst.E.gn.disconnect(); } catch (e) {}
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.gn) return;
        E.gn.port.postMessage({ type: "p", p: type === "quant"
          ? { bits: inst.params.bits, rateHz: ctx.sampleRate }        // 只量化
          : { bits: 24, rateHz: inst.params.rate }                    // 只降采样
        });
      };
    }

    if (type === "flanger") {
      inst.build = function () {
        inst.unbuild && inst.unbuild();
        const dl = ctx.createDelay(0.02);
        dl.delayTime.value = 0.0015;
        const fb = ctx.createGain(); fb.gain.value = (inst.params.fb ?? 40) / 100;
        const lfo = ctx.createOscillator(); lfo.type = "sine";
        lfo.frequency.value = inst.params.rate ?? 0.3;
        const lg = ctx.createGain(); lg.gain.value = (inst.params.depth ?? 2.5) / 1000;
        lfo.connect(lg); lg.connect(dl.delayTime);
        input.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet);
        lfo.start();
        inst.E = { dl, fb, lfo, lg };
      };
      inst.unbuild = function () {
        const E = inst.E;
        if (E.lfo) { try { E.lfo.stop(); } catch (e) {} }
        [E.dl, E.fb, E.lg].forEach(n => n && n.disconnect && n.disconnect());
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.dl) return;
        const t = ctx.currentTime;
        E.lfo.frequency.setTargetAtTime(inst.params.rate, t, 0.02);
        E.lg.gain.setTargetAtTime(inst.params.depth / 1000, t, 0.02);
        E.fb.gain.setTargetAtTime(inst.params.fb / 100, t, 0.02);
      };
    }

    if (type === "phaser") {
      inst.build = function () {
        inst.unbuild && inst.unbuild();
        const bases = [300, 800, 1600, 3200];
        const aps = bases.map(f => {
          const ap = ctx.createBiquadFilter();
          ap.type = "allpass"; ap.frequency.value = f; ap.Q.value = 0.7;
          return ap;
        });
        let prev = input;
        for (const ap of aps) { prev.connect(ap); prev = ap; }
        prev.connect(wet);
        const lfo = ctx.createOscillator(); lfo.type = "sine";
        lfo.frequency.value = inst.params.rate ?? 0.6;
        const lg = ctx.createGain(); lg.gain.value = (inst.params.depth ?? 60) * 12;
        lfo.connect(lg);
        for (const ap of aps) lg.connect(ap.frequency);
        lfo.start();
        inst.E = { aps, lfo, lg };
      };
      inst.unbuild = function () {
        const E = inst.E;
        E.aps && E.aps.forEach(a => a.disconnect());
        if (E.lfo) { try { E.lfo.stop(); } catch (e) {} }
        E.lg && E.lg.disconnect();
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.lfo) return;
        const t = ctx.currentTime;
        E.lfo.frequency.setTargetAtTime(inst.params.rate, t, 0.02);
        E.lg.gain.setTargetAtTime(inst.params.depth * 12, t, 0.02);
      };
    }

    if (type === "eq") {
      inst.build = function () {
        const low = ctx.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 200;
        const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = inst.params.midF ?? 1000; mid.Q.value = 0.9;
        const high = ctx.createBiquadFilter(); high.type = "highshelf"; high.frequency.value = 4000;
        input.connect(low); low.connect(mid); mid.connect(high); high.connect(wet);
        inst.E = { low, mid, high };
      };
      inst.unbuild = function () {
        const E = inst.E;
        [E.low, E.mid, E.high].forEach(n => n && n.disconnect && n.disconnect());
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.low) return;
        const t = ctx.currentTime;
        E.low.gain.setTargetAtTime(inst.params.low, t, 0.02);
        E.mid.gain.setTargetAtTime(inst.params.mid, t, 0.02);
        E.mid.frequency.setTargetAtTime(inst.params.midF, t, 0.02);
        E.high.gain.setTargetAtTime(inst.params.high, t, 0.02);
      };
    }

    if (type === "comp") {
      inst.build = function () {
        const cp = ctx.createDynamicsCompressor();
        cp.knee.value = 12;
        const makeup = ctx.createGain(); makeup.gain.value = 1;
        input.connect(cp); cp.connect(makeup); makeup.connect(wet);
        inst.E = { cp, makeup };
      };
      inst.unbuild = function () {
        const E = inst.E;
        [E.cp, E.makeup].forEach(n => n && n.disconnect && n.disconnect());
        inst.E = {};
      };
      inst.apply = function () {
        const E = inst.E; if (!E.cp) return;
        const t = ctx.currentTime, P = inst.params;
        E.cp.threshold.setTargetAtTime(P.thr, t, 0.02);
        E.cp.ratio.setTargetAtTime(P.ratio, t, 0.02);
        E.cp.attack.setTargetAtTime(P.atk / 1000, t, 0.02);
        E.cp.release.setTargetAtTime(P.rel / 1000, t, 0.02);
        E.makeup.gain.setTargetAtTime(Math.pow(10, P.gain / 20), t, 0.02);
      };
    }

    // 滤波类型(分段按钮, graph.js 特殊处理)
    if (type === "filter") inst.params.type = 0;

    return inst;
  }
})();
