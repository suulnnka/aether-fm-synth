/* ============================================================
 * Aether FM — 音色: 出厂预设 · 随机(开盲盒) · 保存/载入
 * ============================================================ */
"use strict";
(function () {

  const PR = (Aether.presets = {
    factory: {},
    saves: {},
  });
  const LS_KEY = "aetherfm.saves";

  /* ---- 位置布局 ---- */
  const opPos = i => ({ x: 40 + (i % 2) * 292, y: 30 + Math.floor(i / 2) * 312 });
  const fxPos = i => ({ x: 1010, y: 30 + i * 250 });
  const FM_POS = { x: 690, y: 180 };
  const M_POS = { x: 1320, y: 180 };

  function op(p, i) {
    return { title: "OP" + (i + 1), color: ["#39d98a", "#f5c542", "#ff9f43", "#ff6b9d", "#4ecdc4", "#b18cff", "#5aa9ff", "#ff5c5c"][i % 8], ...opPos(i), p };
  }
  function fx(type, p, i) {
    return { fxType: type, title: null, ...fxPos(i), p };
  }
  function build(name, opParams, cablePairs, effectList, extra = {}) {
    const patch = {
      name,
      ops: opParams.map(op),
      fmout: { ...FM_POS, p: { level: extra.fmLevel ?? 0.8 } },
      effects: (effectList || []).map((e, i) => fx(e[0], e[1], i)),
      master: { ...M_POS, p: { vol: extra.vol ?? 0.85 } },
      cables: cablePairs.map(([f, t]) => ({ f, t })),
    };
    // 自动串联: FM输出 → fx1 → fx2 → ... → 主输出
    const n = (effectList || []).length;
    if (n > 0) {
      patch.cables.push({ f: "fmout", t: "fx1" });
      for (let i = 1; i < n; i++) patch.cables.push({ f: `fx${i}`, t: `fx${i + 1}` });
      patch.cables.push({ f: `fx${n}`, t: "master" });
    } else {
      patch.cables.push({ f: "fmout", t: "master" });
    }
    return patch;
  }

  /* ================= 出厂音色 ================= */
  PR.factory = {
    "电钢琴 DX": build("电钢琴 DX", [
      { wave: 0, ratio: 1,    detune: 0,  level: 85, fb: 0,  a: 0,  d: 900,  s: 25, r: 650 },
      { wave: 0, ratio: 14,   detune: 0,  level: 58, fb: 0,  a: 0,  d: 260,  s: 0,  r: 220 },
      { wave: 0, ratio: 1,    detune: 7,  level: 62, fb: 0,  a: 0,  d: 1300, s: 28, r: 850 },
      { wave: 0, ratio: 1,    detune: 0,  level: 42, fb: 0,  a: 0,  d: 480,  s: 18, r: 320 },
      { wave: 0, ratio: 7,    detune: 0,  level: 28, fb: 0,  a: 0,  d: 160,  s: 0,  r: 160 },
      { wave: 0, ratio: 7.21, detune: 0,  level: 24, fb: 0,  a: 0,  d: 200,  s: 0,  r: 200 },
    ], [
      ["op2", "op1"], ["op4", "op3"], ["op5", "op1"], ["op6", "op3"],
      ["op1", "fmout"], ["op3", "fmout"],
    ], [
      ["chorus", { rate: 1.6, depth: 2.5, mix: 35, voices: 3, base: 16 }],
      ["delay", { time: 320, fb: 28, mix: 16 }],
    ]),

    "酸性贝斯": build("酸性贝斯", [
      { wave: 3, ratio: 1,   detune: 0, level: 92, fb: 16, a: 0, d: 320, s: 62, r: 160 },
      { wave: 2, ratio: 2,   detune: 0, level: 42, fb: 0,  a: 0, d: 160, s: 30, r: 100 },
      { wave: 0, ratio: 0.5, detune: 0, level: 72, fb: 0,  a: 0, d: 500, s: 78, r: 200 },
      { wave: 0, ratio: 5,   detune: 0, level: 22, fb: 0,  a: 0, d: 120, s: 0,  r: 80 },
      { wave: 0, ratio: 1,   detune: 0, level: 60, fb: 0,  a: 0, d: 400, s: 70, r: 150 },
      { wave: 0, ratio: 1,   detune: 0, level: 40, fb: 0,  a: 0, d: 400, s: 70, r: 150 },
    ], [
      ["op2", "op1"], ["op4", "op1"],
      ["op1", "fmout"], ["op3", "fmout"],
    ], [
      ["dist", { drive: 4.5, tone: 5200, mix: 45 }],
    ], { vol: 0.8 }),

    "合成铜管": build("合成铜管", [
      { wave: 3, ratio: 1, detune: 0,  level: 84, fb: 10, a: 70,  d: 420, s: 76, r: 260 },
      { wave: 3, ratio: 1, detune: 4,  level: 52, fb: 8,  a: 60,  d: 320, s: 62, r: 260 },
      { wave: 3, ratio: 1, detune: -9, level: 58, fb: 0,  a: 90,  d: 420, s: 74, r: 260 },
      { wave: 0, ratio: 2, detune: 0,  level: 34, fb: 0,  a: 80,  d: 300, s: 50, r: 240 },
      { wave: 0, ratio: 3, detune: 0,  level: 24, fb: 0,  a: 220, d: 300, s: 40, r: 240 },
      { wave: 0, ratio: 1, detune: 0,  level: 50, fb: 0,  a: 100, d: 400, s: 70, r: 260 },
    ], [
      ["op2", "op1"], ["op4", "op3"], ["op5", "op1"],
      ["op1", "fmout"], ["op3", "fmout"],
    ], [
      ["chorus", { rate: 0.9, depth: 2, mix: 40, voices: 2, base: 14 }],
    ]),

    "灵钟": build("灵钟", [
      { wave: 0, ratio: 1,    detune: 0,  level: 80, fb: 0, a: 0, d: 2600, s: 0, r: 2600 },
      { wave: 0, ratio: 3.53, detune: 0,  level: 66, fb: 0, a: 0, d: 1300, s: 0, r: 1100 },
      { wave: 0, ratio: 2.99, detune: 5,  level: 38, fb: 0, a: 0, d: 2200, s: 0, r: 2400 },
      { wave: 0, ratio: 7.21, detune: 0,  level: 48, fb: 0, a: 0, d: 900,  s: 0, r: 900 },
      { wave: 0, ratio: 9.3,  detune: 0,  level: 26, fb: 0, a: 0, d: 700,  s: 0, r: 700 },
      { wave: 0, ratio: 1,    detune: 0,  level: 50, fb: 0, a: 0, d: 800,  s: 60, r: 400 },
    ], [
      ["op2", "op1"], ["op4", "op3"], ["op5", "op1"],
      ["op1", "fmout"], ["op3", "fmout"],
    ], [
      ["reverb", { size: 3.2, mix: 45 }],
      ["delay", { time: 420, fb: 42, mix: 22 }],
    ]),

    "梦境铺底": build("梦境铺底", [
      { wave: 0, ratio: 1, detune: -8, level: 58, fb: 0,  a: 1400, d: 800, s: 82, r: 2000 },
      { wave: 0, ratio: 2, detune: 0,  level: 30, fb: 0,  a: 1200, d: 800, s: 70, r: 1800 },
      { wave: 0, ratio: 1, detune: 8,  level: 58, fb: 0,  a: 1600, d: 800, s: 82, r: 2200 },
      { wave: 0, ratio: 1, detune: 0,  level: 26, fb: 0,  a: 1500, d: 800, s: 66, r: 2000 },
      { wave: 0, ratio: 4.01, detune: 0, level: 18, fb: 0, a: 2000, d: 800, s: 60, r: 2000 },
      { wave: 0, ratio: 1, detune: 0,  level: 55, fb: 0,  a: 800,  d: 400, s: 90, r: 1200 },
    ], [
      ["op2", "op1"], ["op4", "op3"], ["op5", "op1"], ["op5", "op3"], ["op6", "op3"],
      ["op1", "fmout"], ["op3", "fmout"],
    ], [
      ["chorus", { rate: 0.6, depth: 4.5, mix: 65, voices: 4, base: 22 }],
      ["reverb", { size: 4.5, mix: 55 }],
    ], { vol: 0.8 }),

    "管风琴": build("管风琴", [
      { wave: 0, ratio: 1, detune: 0, level: 80, fb: 0, a: 6,  d: 200, s: 99, r: 140 },
      { wave: 0, ratio: 6, detune: 0, level: 24, fb: 0, a: 6,  d: 200, s: 99, r: 140 },
      { wave: 0, ratio: 2, detune: 0, level: 58, fb: 0, a: 6,  d: 200, s: 99, r: 140 },
      { wave: 0, ratio: 8, detune: 0, level: 14, fb: 0, a: 6,  d: 200, s: 99, r: 140 },
      { wave: 0, ratio: 3, detune: 0, level: 44, fb: 0, a: 6,  d: 200, s: 99, r: 140 },
      { wave: 0, ratio: 1, detune: 0, level: 50, fb: 0, a: 6,  d: 200, s: 99, r: 140 },
    ], [
      ["op2", "op1"], ["op4", "op3"],
      ["op1", "fmout"], ["op3", "fmout"], ["op5", "fmout"],
    ], [
      ["chorus", { rate: 5.5, depth: 1.2, mix: 28, voices: 2, base: 8 }],
      ["tremolo", { rate: 5.2, depth: 22, mix: 70 }],
    ]),

    "同步主音": build("同步主音", [
      { wave: 3, ratio: 1, detune: 0,  level: 90, fb: 35, a: 8,  d: 320, s: 70, r: 220 },
      { wave: 2, ratio: 3, detune: 0,  level: 68, fb: 0,  a: 8,  d: 260, s: 78, r: 200 },
      { wave: 3, ratio: 1, detune: 11, level: 46, fb: 0,  a: 12, d: 320, s: 66, r: 220 },
      { wave: 0, ratio: 1, detune: 0,  level: 30, fb: 0,  a: 10, d: 200, s: 60, r: 200 },
      { wave: 0, ratio: 1, detune: 0,  level: 50, fb: 0,  a: 10, d: 300, s: 70, r: 200 },
      { wave: 0, ratio: 1, detune: 0,  level: 50, fb: 0,  a: 10, d: 300, s: 70, r: 200 },
    ], [
      ["op2", "op1"], ["op4", "op3"],
      ["op1", "fmout"], ["op3", "fmout"],
    ], [
      ["dist", { drive: 8, tone: 7200, mix: 65 }],
      ["delay", { time: 230, fb: 35, mix: 20 }],
    ]),
  };

  /* ================= 随机音色 (开盲盒) ================= */
  const RATIOS = [0.5, 1, 1.414, 1.5, 2, 2.5, 3, 3.99, 5.04, 7, 9.19];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const ARCHETYPES = {
    拨弦: { carriers: [1, 2], mods: [1, 3], wave: [0, 0, 1], env: n => ({ a: rnd(0, 8), d: rnd(250, 1400), s: rnd(0, 18), r: rnd(200, 900) }), fxPool: ["delay", "chorus", "reverb", "comp"] },
    贝斯: { carriers: [1], mods: [1, 2], wave: [3, 2, 0], env: n => ({ a: rnd(0, 5), d: rnd(90, 400), s: rnd(30, 70), r: rnd(80, 300) }), fxPool: ["dist", "filter", "comp", "eq", "overdrive", "hardclip"] },
    铺底: { carriers: [2, 3], mods: [1, 3], wave: [0, 1, 3], env: n => ({ a: rnd(700, 2400), d: rnd(500, 900), s: rnd(70, 96), r: rnd(1400, 3000) }), fxPool: ["chorus", "reverb", "grain", "phaser", "flanger"] },
    钟琴: { carriers: [1, 2], mods: [2, 3], wave: [0, 0, 2], env: n => ({ a: 0, d: rnd(1300, 3400), s: 0, r: rnd(1500, 3400) }), fxPool: ["reverb", "delay", "flanger"] },
    主音: { carriers: [1], mods: [1, 2], wave: [3, 2, 1], env: n => ({ a: rnd(4, 60), d: rnd(220, 620), s: rnd(58, 85), r: rnd(160, 520) }), fxPool: ["dist", "delay", "filter", "comp", "eq", "overdrive", "hardclip"] },
  };

  PR.random = function () {
    const arch = pick(Object.entries(ARCHETYPES));
    const [archName, A] = arch;
    const nOps = 3 + Math.floor(Math.random() * 3); // 3..5
    const carriers = [];
    const mods = [];
    const ratios = [...RATIOS].sort(() => Math.random() - 0.5);

    for (let i = 0; i < nOps; i++) {
      const isCarrier = i < A.carriers[0] ? true : (mods.length < A.mods[Math.floor(Math.random() * A.mods.length)] ? i % 2 === 1 : carriers.length < A.carriers[A.carriers.length - 1]);
      if (isCarrier && carriers.length < 3) carriers.push(i);
      else mods.push(i);
    }
    if (!carriers.length) carriers.push(0);

    const opParams = [];
    for (let i = 0; i < nOps; i++) {
      const isC = carriers.includes(i);
      const env = A.env(i);
      opParams.push({
        wave: isC ? pick(A.wave) : (Math.random() < 0.75 ? 0 : pick(A.wave)),
        ratio: isC ? pick([1, 1, 0.5, 2]) : ratios[i % ratios.length],
        detune: Math.round(rnd(-12, 12)),
        level: Math.round(isC ? rnd(55, 92) : rnd(20, 72)),
        fb: isC && Math.random() < 0.45 ? Math.round(rnd(5, 38)) : 0,
        a: Math.round(env.a), d: Math.round(env.d), s: Math.round(env.s), r: Math.round(env.r),
      });
    }

    const cables = [];
    for (const m of mods) cables.push([`op${m + 1}`, `op${pick(carriers) + 1}`]);
    for (const c of carriers) cables.push([`op${c + 1}`, "fmout"]);

    // 随机效果链
    const nFx = 1 + Math.floor(Math.random() * 2);
    const pool = [...A.fxPool, "tremolo"];
    const effectList = [];
    const used = new Set();
    for (let i = 0; i < nFx; i++) {
      const type = pick(pool.filter(t => !used.has(t))) || pick(pool);
      used.add(type);
      const p = {};
      for (const s of window.FX_SPECS[type].params) p[s.k] = +(s.min + Math.random() * (s.max - s.min) * 0.7).toFixed(2);
      effectList.push([type, p]);
    }
    // 效果链依次串联
    for (let i = 0; i < effectList.length - 1; i++) {
      // fx→fx 连线由 applyPatch 的 id 规则处理: fx1→fx2
    }
    const patch = build(`${archName}·盲盒`, opParams, cables, effectList, { fmLevel: +rnd(0.7, 1).toFixed(2) });
    // fx 串联线
    for (let i = 0; i < effectList.length - 1; i++) patch.cables.push({ f: `fx${i + 1}`, t: `fx${i + 2}` });
    return patch;
  };

  /* ================= 保存 / 载入 ================= */
  PR.loadSaves = function () {
    try { PR.saves = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch (e) { PR.saves = {}; }
  };

  PR.saveCurrent = function (name) {
    const patch = Aether.Graph.serialize();
    PR.saves[name] = patch;
    localStorage.setItem(LS_KEY, JSON.stringify(PR.saves));
    PR.refreshList();
  };

  PR.refreshList = function () {
    const sel = document.getElementById("presetSel");
    sel.innerHTML = "";
    const g1 = document.createElement("optgroup"); g1.label = "出厂音色";
    for (const name of Object.keys(PR.factory)) {
      const o = document.createElement("option"); o.value = "f:" + name; o.textContent = name;
      g1.appendChild(o);
    }
    sel.appendChild(g1);
    const names = Object.keys(PR.saves);
    if (names.length) {
      const g2 = document.createElement("optgroup"); g2.label = "我的保存";
      for (const name of names) {
        const o = document.createElement("option"); o.value = "s:" + name; o.textContent = "★ " + name;
        g2.appendChild(o);
      }
      sel.appendChild(g2);
    }
    const cur = document.createElement("option");
    cur.value = ""; cur.textContent = "— 当前音色 —"; cur.disabled = true; cur.hidden = true;
    sel.insertBefore(cur, sel.firstChild);
    sel.value = "";
  };

  PR.init = function () {
    PR.loadSaves();
    PR.refreshList();

    document.getElementById("presetSel").addEventListener("change", e => {
      const v = e.target.value;
      if (!v) return;
      const [kind, ...rest] = v.split(":");
      const name = rest.join(":");
      const patch = kind === "f" ? PR.factory[name] : PR.saves[name];
      if (patch) {
        Aether.Graph.applyPatch(JSON.parse(JSON.stringify(patch)));
        Aether.toast("已载入「" + name + "」");
      }
      e.target.value = "";
    });

    document.getElementById("randBtn").addEventListener("click", async () => {
      if (!(await Aether.audio.ensure())) return;
      Aether.Graph.applyPatch(PR.random());
      Aether.toast("🎲 盲盒开启! 不满意就再抽一次");
    });

    document.getElementById("saveBtn").addEventListener("click", () => {
      Aether.promptText("保存音色 · 输入名称", "我的音色 " + (Object.keys(PR.saves).length + 1), name => {
        if (!name) return;
        PR.saveCurrent(name.trim());
        Aether.toast("已保存「" + name.trim() + "」");
      });
    });
  };
})();
