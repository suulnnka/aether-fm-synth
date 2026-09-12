/* ============================================================
 * Aether FM — 节点图
 * 算子(OP) / FM输出 / 效果(FX) / 主输出(Master) 节点 + 连线
 * 交互: 拖动节点 · 端口拖线 · 双击删线 · 滑块拖动 · 滚轮缩放 · 平移
 * ============================================================ */
"use strict";
(function () {

  const OP_COLORS = ["#39d98a", "#f5c542", "#ff9f43", "#ff6b9d", "#4ecdc4", "#b18cff", "#5aa9ff", "#ff5c5c"];
  const FMT = {
    int  : v => String(Math.round(v)),
    pct  : v => Math.round(v) + "%",
    db   : v => (v > 0 ? "+" : "") + Math.round(v) + "dB",
    ms   : v => v < 1000 ? Math.round(v) + "ms" : (v / 1000).toFixed(2) + "s",
    ms1  : v => v < 10 ? v.toFixed(1) + "ms" : Math.round(v) + "ms",
    hz   : v => Math.round(v) + "Hz",
    hz2  : v => v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(Math.round(v)),
    x    : v => v.toFixed(1) + "x",
    x1   : v => v.toFixed(1) + "/s",
    x2   : v => "×" + v.toFixed(2),
    sec  : v => v.toFixed(1) + "s",
    cent : v => (v > 0 ? "+" : "") + Math.round(v) + "¢",
    lin  : v => Math.round(v * 100) + "%",
    ratio: v => v.toFixed(2),
  };
  const fmtOf = f => FMT[f] || (v => v.toFixed(2));

  const OP_PARAMS = [
    { k: "ratio",   label: "Ratio",  min: 0.25, max: 16,   step: 0.01, def: 1,    fmt: "ratio", log: true },
    { k: "fixedHz", label: "Freq",   min: 20,   max: 6000, step: 1,    def: 220,  fmt: "hz"  },
    { k: "detune",  label: "Detune", min: -50,  max: 50,   step: 0.5,  def: 0,    fmt: "cent" },
    { k: "level",   label: "Level",  min: 0,    max: 99,   step: 1,    def: 80,   fmt: "int"  },
    { k: "fb",      label: "FB",     min: 0,    max: 99,   step: 1,    def: 0,    fmt: "int"  },
    { k: "fcut",    label: "Cutoff", min: 60,   max: 14000,step: 10,   def: 8000, fmt: "hz2", log: true },
    { k: "a",       label: "A",      min: 0,    max: 4000, step: 5,    def: 5,    fmt: "ms"   },
    { k: "d",       label: "D",      min: 5,    max: 4000, step: 5,    def: 400,  fmt: "ms"   },
    { k: "s",       label: "S",      min: 0,    max: 99,   step: 1,    def: 70,   fmt: "int"  },
    { k: "r",       label: "R",      min: 10,   max: 8000, step: 10,   def: 600,  fmt: "ms"   },
  ];

  const G = (Aether.Graph = {
    nodes: new Map(),
    cables: [],          // {from, to, el:{glow,core,hit}}
    fmOut: null, master: null,
    pan: { x: 0, y: 0 }, zoom: 1,
    opCounter: 0, fxCounter: 0,
    onChange: null,      // main.js 挂接: 用于刷新保存状态等
    _wiresPending: false,
  });

  let viewport, world, wiresSvg, nodesEl;

  /* ================= 工具 ================= */
  G.toast = msg => Aether.toast(msg);

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function toWorld(cx, cy) {
    const w = world.getBoundingClientRect();
    return { x: (cx - w.left) / G.zoom, y: (cy - w.top) / G.zoom };
  }

  function portPos(node, dir) {
    const p = node.el.querySelector(`.port.${dir}`);
    if (!p) return { x: node.x + 100, y: node.y + 40 };
    const r = p.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  function applyView() {
    world.style.transform = `translate(${G.pan.x}px,${G.pan.y}px) scale(${G.zoom})`;
  }

  G.requestWires = function () {
    if (G._wiresPending) return;
    G._wiresPending = true;
    requestAnimationFrame(() => { G._wiresPending = false; G.drawWires(); });
  };

  /* ================= 连线绘制 ================= */
  function cablePath(x1, y1, x2, y2) {
    const dx = Math.min(180, Math.max(40, Math.abs(x2 - x1) * 0.5));
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }

  G.drawWires = function () {
    wiresSvg.textContent = "";

    // 节点内的装饰细线(仿参考图的滑块圆点连线)
    for (const node of G.nodes.values()) {
      if (node.type !== "op") continue;
      const dots = [...node.el.querySelectorAll(".prow")]
        .filter(r => r.offsetHeight > 0)
        .map(r => {
          const d = r.querySelector(".pd"), rect = d.getBoundingClientRect();
          return toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
        });
      if (dots.length < 2) continue;
      let d = `M ${dots[0].x} ${dots[0].y}`;
      for (let i = 1; i < dots.length; i++) {
        const a = dots[i - 1], b = dots[i];
        const mx = (a.x + b.x) / 2;
        d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
      }
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", node.color);
      p.setAttribute("stroke-width", "1");
      p.setAttribute("opacity", node.p.enabled === false ? "0.04" : "0.12");
      wiresSvg.appendChild(p);
    }

    // 实际连线
    for (const c of G.cables) {
      const fn = G.nodes.get(c.from), tn = G.nodes.get(c.to);
      if (!fn || !tn) continue;
      const a = portPos(fn, "out"), b = portPos(tn, "in");
      const d = cablePath(a.x, a.y, b.x, b.y);
      const mk = cls => {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", d);
        p.setAttribute("class", cls);
        wiresSvg.appendChild(p);
        return p;
      };
      const glow = mk("cable");
      glow.setAttribute("stroke", fn.color); glow.setAttribute("stroke-width", "6");
      glow.setAttribute("opacity", "0.16");
      const core = mk("cable");
      core.setAttribute("stroke", fn.color); core.setAttribute("stroke-width", "2.2");
      if (c.sel) { core.setAttribute("stroke", "#eaf6ff"); core.setAttribute("stroke-width", "3"); }
      const hit = mk("cable-hit");
      hit.__cable = c;
      c.el = { glow, core, hit };
      // 端口状态
      fn.el.querySelector(".port.out")?.classList.add("connected");
      tn.el.querySelector(".port.in")?.classList.add("connected");
    }

    // 拖拽中的临时连线
    if (drag && drag.type === "cable") {
      const fn = G.nodes.get(drag.from);
      if (fn) {
        const a = portPos(fn, "out"), b = drag.cur;
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", cablePath(a.x, a.y, b.x, b.y));
        p.setAttribute("class", "cable");
        p.setAttribute("id", "tempCable");
        p.setAttribute("stroke", fn.color); p.setAttribute("stroke-width", "2.2");
        p.setAttribute("opacity", "0.8");
        wiresSvg.appendChild(p);
      }
    }
  };

  /* ================= 节点 ================= */
  function makeSliderRow(node, spec) {
    const row = el("div", "prow", node.bodyEl);
    row.dataset.k = spec.k;
    el("span", "pl", row).textContent = spec.label;
    const track = el("div", "pt", row);
    const dot = el("i", "pd", track);
    const val = el("span", "pv", row);
    const f = fmtOf(spec.fmt);
    const p = node.p;

    const isLog = !!spec.log && spec.min > 0;
    const toFrac = v => isLog
      ? (Math.log(v / spec.min) / Math.log(spec.max / spec.min))
      : (v - spec.min) / (spec.max - spec.min);
    const fromFrac = fr => isLog
      ? spec.min * Math.pow(spec.max / spec.min, fr)
      : spec.min + fr * (spec.max - spec.min);

    function render() {
      const v = p[spec.k];
      dot.style.left = (Math.min(1, Math.max(0, toFrac(v))) * 100) + "%";
      val.textContent = f(v);
    }
    node.renderers.push(render);

    row.addEventListener("pointerdown", e => {
      e.stopPropagation(); e.preventDefault();
      const rect = track.getBoundingClientRect();
      const set = cx => {
        let fr = (cx - rect.left) / rect.width;
        fr = Math.min(1, Math.max(0, fr));
        let v = fromFrac(fr);
        v = Math.round(v / spec.step) * spec.step;
        v = Math.min(spec.max, Math.max(spec.min, v));
        v = +v.toFixed(4);
        if (v !== p[spec.k]) {
          p[spec.k] = v;
          render();
          G.paramChanged(node, spec.k);
        }
      };
      set(e.clientX);
      const mv = ev => set(ev.clientX);
      const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", mv);
      window.addEventListener("pointerup", up);
    });

    render();
    return row;
  }

  function makeWaveRow(node) {
    const row = el("div", "wave-row", node.bodyEl);
    ["Sin", "Tri", "Sqr", "Saw"].forEach((n, i) => {
      const b = el("button", "", row);
      b.textContent = n;
      if ((node.p.wave | 0) === i) b.classList.add("on");
      b.addEventListener("pointerdown", e => e.stopPropagation());
      b.addEventListener("click", e => {
        e.stopPropagation();
        node.p.wave = i;
        [...row.children].forEach((c, j) => c.classList.toggle("on", j === i));
        G.paramChanged(node, "wave");
      });
    });
    return row;
  }

  function makeSegRow(node, options, key) {
    const row = el("div", "wave-row", node.bodyEl);
    options.forEach((n, i) => {
      const b = el("button", "", row);
      b.textContent = n;
      if ((node.p[key] | 0) === i) b.classList.add("on");
      b.addEventListener("pointerdown", e => e.stopPropagation());
      b.addEventListener("click", e => {
        e.stopPropagation();
        node.p[key] = i;
        [...row.children].forEach((c, j) => c.classList.toggle("on", j === i));
        G.paramChanged(node, key);
      });
    });
    return row;
  }

  function addPort(node, dir) {
    const p = el("div", `port ${dir}`, node.el);
    p.dataset.node = node.id;
    p.dataset.dir = dir;
    p.title = dir === "out" ? "输出 (拖出连线)" : "输入";
    return p;
  }

  function baseNode(id, type, x, y, color, title) {
    const node = {
      id, type, x, y, color, title,
      p: {}, renderers: [], el: null, bodyEl: null,
    };
    const e = el("div", "node " + type, nodesEl);
    e.style.setProperty("--ac", color);
    e.dataset.id = id;
    e.style.left = x + "px"; e.style.top = y + "px";
    node.el = e;

    const head = el("div", "n-head", e);
    const dot = el("span", "n-dot", head);
    dot.title = "启用/关闭 (点击)";
    const ttl = el("span", "n-title", head);
    ttl.textContent = title;
    el("span", "n-sp", head);
    node.headEl = head; node.dotEl = dot; node.titleEl = ttl;

    const body = el("div", "n-body", e);
    node.bodyEl = body;

    // 启用开关
    dot.addEventListener("pointerdown", e => e.stopPropagation());
    dot.addEventListener("click", e => {
      e.stopPropagation();
      node.p.enabled = node.p.enabled === false;
      refreshEnabled(node);
      G.paramChanged(node, "enabled");
    });
    function refreshEnabled(n) {
      n.el.classList.toggle("off", n.p.enabled === false);
    }
    node.refreshEnabled = refreshEnabled;

    // 重命名
    ttl.addEventListener("dblclick", e => {
      e.stopPropagation();
      ttl.contentEditable = "true";
      ttl.focus();
      document.getSelection().selectAllChildren(ttl);
    });
    ttl.addEventListener("blur", () => {
      ttl.contentEditable = "false";
      const t = ttl.textContent.trim().slice(0, 8);
      ttl.textContent = t || node.title;
      node.title = ttl.textContent;
      G.onChange && G.onChange();
    });
    ttl.addEventListener("keydown", ev => {
      if (ev.key === "Enter") { ev.preventDefault(); ttl.blur(); }
      ev.stopPropagation();
    });

    G.nodes.set(id, node);
    return node;
  }

  /* ---- OP 节点 ---- */
  G.addOp = function (opts = {}) {
    if (G.opCount() >= 8) { G.toast("最多 8 个算子"); return null; }
    const idx = ++G.opCounter;
    const id = opts.id || ("op" + idx);
    const color = opts.color || OP_COLORS[(idx - 1) % OP_COLORS.length];
    const x = opts.x != null ? opts.x : 40 + (G.opCount() % 2) * 285;
    const y = opts.y != null ? opts.y : 30 + Math.floor(G.opCount() / 2) * 300;

    const node = baseNode(id, "op", x, y, color, opts.title || ("OP" + idx));
    for (const s of OP_PARAMS) node.p[s.k] = opts.p && opts.p[s.k] !== undefined ? opts.p[s.k] : s.def;
    node.p.wave = opts.p && opts.p.wave !== undefined ? opts.p.wave : 0;
    node.p.freqMode = opts.p && opts.p.freqMode !== undefined ? opts.p.freqMode : 0;
    node.p.sync = opts.p && opts.p.sync !== undefined ? !!opts.p.sync : true;
    node.p.filter = opts.p && opts.p.filter !== undefined ? (opts.p.filter | 0) : 0;
    node.p.enabled = opts.p && opts.p.enabled !== undefined ? opts.p.enabled : true;

    const xBtn = el("button", "n-hbtn n-x", node.headEl);
    xBtn.textContent = "×"; xBtn.title = "删除算子";
    xBtn.addEventListener("pointerdown", e => e.stopPropagation());
    xBtn.addEventListener("click", e => { e.stopPropagation(); G.removeNode(id); });

    // 开关行: Fixed(固定频率) / Sync(相位同步) / 输出滤波循环按钮
    const trow = el("div", "toggle-row", node.bodyEl);
    const mkCheck = (label, title) => {
      const lb = el("label", "tcb", trow);
      lb.title = title;
      const cb = el("input", "", lb);
      cb.type = "checkbox";
      lb.appendChild(document.createTextNode(label));
      cb.addEventListener("pointerdown", e => e.stopPropagation());
      return cb;
    };
    const cbFixed = mkCheck("Fixed", "固定频率模式(不勾选=按比率跟随音高)");
    const cbSync = mkCheck("Sync", "相位同步: 音符触发时相位归零");
    const flBtn = el("button", "flt-btn", trow);
    flBtn.title = "输出滤波: 不启用 → 低通 → 高通 循环切换";
    flBtn.addEventListener("pointerdown", e => e.stopPropagation());
    flBtn.addEventListener("click", e => {
      e.stopPropagation();
      node.p.filter = ((node.p.filter | 0) + 1) % 3;
      refreshRows();
      G.paramChanged(node, "filter");
    });
    cbFixed.addEventListener("change", () => {
      node.p.freqMode = cbFixed.checked ? 1 : 0;
      refreshRows();
      G.paramChanged(node, "freqMode");
    });
    cbSync.addEventListener("change", () => {
      node.p.sync = cbSync.checked;
      G.paramChanged(node, "sync");
    });

    const rowEls = {};
    makeWaveRow(node);
    for (const s of OP_PARAMS) rowEls[s.k] = makeSliderRow(node, s);
    addPort(node, "in");
    addPort(node, "out");

    function refreshRows() {
      cbFixed.checked = !!node.p.freqMode;
      cbSync.checked = node.p.sync !== false;
      const fl = node.p.filter | 0;
      flBtn.textContent = fl === 1 ? "LP" : fl === 2 ? "HP" : "FLT·OFF";
      flBtn.classList.toggle("on", fl > 0);
      rowEls.ratio.style.display = node.p.freqMode ? "none" : "";
      rowEls.fixedHz.style.display = node.p.freqMode ? "" : "none";
      rowEls.fcut.style.display = fl ? "" : "none";
    }
    node.syncMode = refreshRows;
    refreshRows();
    node.refreshEnabled(node);
    return node;
  };

  G.addFmOut = function (opts = {}) {
    const node = baseNode("fmout", "fmout", opts.x ?? 660, opts.y ?? 150, "#ff9f43", "FM输出");
    node.p.level = opts.p && opts.p.level !== undefined ? opts.p.level : 0.8;
    node.p.enabled = true;
    const info = el("div", "", node.bodyEl);
    info.style.cssText = "font-size:10px;color:#54657f;margin-bottom:6px;line-height:1.5";
    info.textContent = "载波在此汇合 → 后级效果";
    makeSliderRow(node, { k: "level", label: "Level", min: 0, max: 1.5, step: 0.01, def: 0.8, fmt: "lin" });
    addPort(node, "in");
    addPort(node, "out");
    G.fmOut = node;
    return node;
  };

  G.addFx = function (fxType, opts = {}) {
    const spec = window.FX_SPECS[fxType];
    if (!spec) return null;
    const idx = ++G.fxCounter;
    const id = opts.id || ("fx" + idx);
    const node = baseNode(id, "fx", opts.x ?? 980, opts.y ?? 30 + G.fxCount() * 250, spec.color, opts.title || spec.name);
    node.fxType = fxType;
    for (const s of spec.params) node.p[s.k] = opts.p && opts.p[s.k] !== undefined ? opts.p[s.k] : s.def;
    if (fxType === "filter") node.p.type = opts.p && opts.p.type !== undefined ? opts.p.type : 0;
    node.p.enabled = opts.p && opts.p.enabled !== undefined ? opts.p.enabled : true;

    const xBtn = el("button", "n-hbtn n-x", node.headEl);
    xBtn.textContent = "×"; xBtn.title = "删除效果";
    xBtn.addEventListener("pointerdown", e => e.stopPropagation());
    xBtn.addEventListener("click", e => { e.stopPropagation(); G.removeNode(id); });

    if (spec.types) makeSegRow(node, spec.types, "type");
    for (const s of spec.params) makeSliderRow(node, s);
    addPort(node, "in");
    addPort(node, "out");
    node.refreshEnabled(node);
    return node;
  };

  G.addMaster = function (opts = {}) {
    const node = baseNode("master", "master", opts.x ?? 1300, opts.y ?? 150, "#e8f1ff", "主输出");
    node.p.vol = opts.p && opts.p.vol !== undefined ? opts.p.vol : 0.85;
    node.p.enabled = true;
    makeSliderRow(node, { k: "vol", label: "音量", min: 0, max: 1.5, step: 0.01, def: 0.85, fmt: "lin" });
    const meter = el("div", "meter", node.bodyEl);
    meter.innerHTML = "<i></i>";
    node.meterEl = meter.firstChild;
    addPort(node, "in");
    G.master = node;
    return node;
  };

  G.opCount = () => [...G.nodes.values()].filter(n => n.type === "op").length;
  G.fxCount = () => [...G.nodes.values()].filter(n => n.type === "fx").length;

  G.opsOrdered = function () {
    return [...G.nodes.values()].filter(n => n.type === "op")
      .sort((a, b) => (parseInt(a.id.slice(2)) || 0) - (parseInt(b.id.slice(2)) || 0));
  };
  G.fxList = function () {
    return [...G.nodes.values()].filter(n => n.type === "fx");
  };

  G.removeNode = function (id) {
    const n = G.nodes.get(id);
    if (!n) return;
    if (id === "fmout" || id === "master") return;
    G.cables = G.cables.filter(c => c.from !== id && c.to !== id);
    n.el.remove();
    G.nodes.delete(id);
    if (Aether.audio) Aether.audio.removeFx(id);
    G.syncAudio();
    G.requestWires();
    G.onChange && G.onChange();
  };

  /* ---- 参数变化分发 ---- */
  let syncTimer = null;
  G.syncAudio = function () {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { if (Aether.audio) Aether.audio.syncPatch(); }, 40);
  };

  G.paramChanged = function (node, key) {
    if (node.type === "op" || node.type === "fmout" || node.type === "master" || key === "enabled") {
      G.syncAudio();
    }
    if (node.type === "fx") {
      if (key === "enabled") { G.syncAudio(); }
      else if (Aether.audio && !["mix"].includes(key)) Aether.audio.setFxParam(node.id, key, node.p[key]);
      if (key === "mix" && Aether.audio) Aether.audio.setFxParam(node.id, "mix", node.p.mix);
    }
    if (node.type === "op" && key === "freqMode") node.syncMode();
    G.requestWires();
    G.onChange && G.onChange();
  };

  /* ---- 连线管理 ---- */
  G.canConnect = function (fromId, toId) {
    if (fromId === toId) return "不能连接到自身";
    const fn = G.nodes.get(fromId), tn = G.nodes.get(toId);
    if (!fn || !tn) return "无效节点";
    if (G.cables.some(c => c.from === fromId && c.to === toId)) return "连线已存在";
    const ft = fn.type, tt = tn.type;
    if (ft === "op") {
      if (tt === "op" || tt === "fmout") return null;
      return "算子请先接入 FM输出, 效果接在 FM输出之后";
    }
    if (ft === "fmout") {
      if (tt === "fx" || tt === "master") return null;
      return "FM输出只能连接效果或主输出";
    }
    if (ft === "fx") {
      if (tt === "op" || tt === "fmout") return "效果只能向后连接";
      if (tt === "master") return null;
      // fx → fx: 环路检测
      const seen = new Set([toId]);
      const stack = [toId];
      while (stack.length) {
        const cur = stack.pop();
        if (cur === fromId) return "会造成反馈环路";
        for (const c of G.cables) if (c.from === cur && !seen.has(c.to)) { seen.add(c.to); stack.push(c.to); }
      }
      return null;
    }
    return "该节点不能输出";
  };

  G.addCable = function (from, to) {
    const err = G.canConnect(from, to);
    if (err) { G.toast(err); return false; }
    G.cables.push({ from, to, sel: false });
    G.syncAudio();
    G.requestWires();
    G.onChange && G.onChange();
    return true;
  };

  G.removeCable = function (c) {
    G.cables = G.cables.filter(x => x !== c);
    G.syncAudio();
    G.requestWires();
    G.onChange && G.onChange();
  };

  /* ---- 声部配置 ---- */
  Aether.buildVoiceConfig = function () {
    const ops = G.opsOrdered();
    const idxOf = new Map(ops.map((n, i) => [n.id, i]));
    const conns = [], carriers = [];
    for (const c of G.cables) {
      if (c.from.startsWith("op") && c.to.startsWith("op") && idxOf.has(c.from) && idxOf.has(c.to))
        conns.push([idxOf.get(c.from), idxOf.get(c.to)]);
      if (c.from.startsWith("op") && c.to === "fmout" && idxOf.has(c.from))
        carriers.push(idxOf.get(c.from));
    }
    return {
      ops: ops.map(n => ({
        w: n.p.wave | 0, ratio: n.p.ratio, det: n.p.detune, lvl: n.p.level,
        fb: n.p.fb, a: n.p.a / 1000, d: n.p.d / 1000, s: n.p.s / 99, r: n.p.r / 1000,
        fm: n.p.freqMode === 1, fhz: n.p.fixedHz, en: n.p.enabled !== false,
        sy: n.p.sync !== false, fl: n.p.filter | 0, fc: n.p.fcut || 8000,
      })),
      conns, carriers,
    };
  };

  /* ================= 序列化 ================= */
  G.serialize = function () {
    return {
      version: 1,
      ops: G.opsOrdered().map(n => ({ title: n.title, color: n.color, x: n.x, y: n.y, p: { ...n.p } })),
      fmout: { x: G.fmOut.x, y: G.fmOut.y, p: { level: G.fmOut.p.level } },
      effects: G.fxList().map(n => ({ fxType: n.fxType, title: n.title, x: n.x, y: n.y, p: { ...n.p } })),
      master: { x: G.master.x, y: G.master.y, p: { vol: G.master.p.vol } },
      cables: G.cables.map(c => ({ f: c.from, t: c.to })),
    };
  };

  G.clearAll = function () {
    for (const n of [...G.nodes.values()]) n.el.remove();
    G.nodes.clear(); G.cables = [];
    G.fmOut = null; G.master = null;
    G.opCounter = 0; G.fxCounter = 0;
    if (Aether.audio) for (const id of [...Aether.audio.fx.keys()]) Aether.audio.removeFx(id);
  };

  G.applyPatch = function (patch, opts = {}) {
    G.clearAll();
    patch.ops.forEach(o => G.addOp({ id: undefined, title: o.title, color: o.color, x: o.x, y: o.y, p: o.p }));
    // 重新顺序编号 id
    // addOp 内部用 opCounter 自增, 顺序即数组顺序, cables 依赖 id → 需要按位置对应:
    const opIds = G.opsOrdered().map(n => n.id);
    G.addFmOut({ x: patch.fmout.x, y: patch.fmout.y, p: patch.fmout.p });
    (patch.effects || []).forEach(e => G.addFx(e.fxType, { title: e.title, x: e.x, y: e.y, p: e.p }));
    const fxIds = G.fxList().map(n => n.id);
    G.addMaster({ x: patch.master.x, y: patch.master.y, p: patch.master.p });

    const resolve = t => {
      if (t === "fmout" || t === "master") return t;
      const m = /^(op|fx)(\d+)$/.exec(t);
      if (!m) return null;
      const n = +m[2] - 1;
      return m[1] === "op" ? opIds[n] : fxIds[n];
    };
    for (const c of (patch.cables || [])) {
      const f = resolve(c.f), t = resolve(c.t);
      if (f && t && G.nodes.has(f) && G.nodes.has(t)) G.cables.push({ from: f, to: t, sel: false });
    }
    G.syncAudio();
    G.requestWires();
    if (opts.fit !== false) G.fitView();
    G.onChange && G.onChange();
  };

  /* ================= 视图 ================= */
  G.fitView = function () {
    const vr = viewport.getBoundingClientRect();
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    for (const n of G.nodes.values()) {
      x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y);
      x2 = Math.max(x2, n.x + 250); y2 = Math.max(y2, n.y + n.el.offsetHeight || 300);
    }
    if (x1 > x2) { G.pan = { x: 20, y: 20 }; G.zoom = 1; applyView(); return; }
    const bw = x2 - x1, bh = y2 - y1;
    G.zoom = Math.min(1.15, Math.max(0.35, Math.min((vr.width - 60) / bw, (vr.height - 60) / bh)));
    G.pan.x = (vr.width - bw * G.zoom) / 2 - x1 * G.zoom;
    G.pan.y = (vr.height - bh * G.zoom) / 2 - y1 * G.zoom;
    applyView();
  };

  function zoomAt(cx, cy, factor) {
    const nz = Math.min(2, Math.max(0.35, G.zoom * factor));
    const w = toWorld(cx, cy);
    G.pan.x = cx - w.x * nz;
    G.pan.y = cy - w.y * nz;
    G.zoom = nz;
    applyView();
  }

  /* ================= 交互 ================= */
  let drag = null; // {type:'pan'|'node'|'cable'|'slider', ...}

  function onPointerDown(e) {
    if (e.button === 1) { drag = { type: "pan", sx: e.clientX, sy: e.clientY, px: G.pan.x, py: G.pan.y }; e.preventDefault(); return; }

    const hit = e.target.closest ? e.target.closest("path.cable-hit") : null;
    if (hit && hit.__cable) {
      const c = hit.__cable;
      if (e.detail >= 2 || e.button === 2) { G.removeCable(c); }
      else {
        G.cables.forEach(x => x.sel = false);
        c.sel = !c.sel;
        G.requestWires();
      }
      e.stopPropagation();
      return;
    }

    const port = e.target.closest(".port");
    if (port) {
      e.stopPropagation();
      if (port.dataset.dir === "out") {
        drag = { type: "cable", from: port.dataset.node, cur: toWorld(e.clientX, e.clientY) };
        G.requestWires();
      } else {
        // 点输入端口: 若临时线存在则完成连线
        if (drag && drag.type === "cable") completeCable(port);
      }
      return;
    }

    const nodeEl = e.target.closest(".node");
    if (nodeEl) {
      const node = G.nodes.get(nodeEl.dataset.id);
      if (!node) return;
      if (e.target.closest(".prow") || e.target.closest("button") || e.target.closest(".n-dot") || e.target.closest(".n-title")) return;
      const w = toWorld(e.clientX, e.clientY);
      drag = { type: "node", node, dx: w.x - node.x, dy: w.y - node.y };
      nodeEl.classList.add("dragging");
      nodesEl.appendChild(nodeEl); // 置顶
      e.preventDefault();
      return;
    }

    // 背景平移
    drag = { type: "pan", sx: e.clientX, sy: e.clientY, px: G.pan.x, py: G.pan.y };
    viewport.classList.add("panning");
  }

  function completeCable(portEl) {
    const to = portEl.dataset.node;
    const from = drag.from;
    if (to && from) G.addCable(from, to);
    drag = null;
    document.querySelectorAll(".port.hot").forEach(p => p.classList.remove("hot"));
    G.requestWires();
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (drag.type === "pan") {
      G.pan.x = drag.px + (e.clientX - drag.sx);
      G.pan.y = drag.py + (e.clientY - drag.sy);
      applyView();
    } else if (drag.type === "node") {
      const w = toWorld(e.clientX, e.clientY);
      drag.node.x = Math.round(w.x - drag.dx);
      drag.node.y = Math.round(w.y - drag.dy);
      drag.node.el.style.left = drag.node.x + "px";
      drag.node.el.style.top = drag.node.y + "px";
      G.requestWires();
    } else if (drag.type === "cable") {
      drag.cur = toWorld(e.clientX, e.clientY);
      document.querySelectorAll(".port.hot").forEach(p => p.classList.remove("hot"));
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const port = t && t.closest && t.closest(".port.in");
      if (port) port.classList.add("hot");
      G.requestWires();
    }
  }

  function onPointerUp(e) {
    if (drag && drag.type === "cable") {
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const port = t && t.closest && t.closest(".port.in");
      if (port) completeCable(port);
      else { drag = null; document.querySelectorAll(".port.hot").forEach(p => p.classList.remove("hot")); G.requestWires(); }
    }
    if (drag && drag.type === "node") drag.node.el.classList.remove("dragging");
    if (drag && drag.type === "pan") viewport.classList.remove("panning");
    drag = null;
  }

  function cancelDrag() {
    if (!drag) return;
    if (drag.type === "node") drag.node.el.classList.remove("dragging");
    if (drag.type === "pan") viewport.classList.remove("panning");
    if (drag.type === "cable") document.querySelectorAll(".port.hot").forEach(p => p.classList.remove("hot"));
    drag = null;
    G.requestWires();
  }

  /* ---- 多指(触摸屏): 单指=原有交互, 双指=捏合缩放+平移 ---- */
  const vPts = new Map(); // pointerId → {x,y}
  let pinch = null;       // {d0, mid0, zoom0, pan0}

  function vpDown(e) {
    vPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType !== "mouse") e.preventDefault();
    if (vPts.size === 2) {
      cancelDrag();
      const [a, b] = [...vPts.values()];
      pinch = {
        d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)),
        mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        zoom0: G.zoom, pan0: { ...G.pan },
      };
      viewport.classList.add("panning");
      return;
    }
    if (vPts.size > 2) return;
    onPointerDown(e);
  }

  function vpMove(e) {
    if (vPts.has(e.pointerId)) vPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && vPts.size >= 2) {
      const [a, b] = [...vPts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = Math.min(2, Math.max(0.35, pinch.zoom0 * d / pinch.d0));
      // 初始中点的世界坐标跟随双指中心移动
      const w = {
        x: (pinch.mid0.x - pinch.pan0.x) / pinch.zoom0,
        y: (pinch.mid0.y - pinch.pan0.y) / pinch.zoom0,
      };
      G.zoom = z;
      G.pan.x = mid.x - w.x * z;
      G.pan.y = mid.y - w.y * z;
      applyView();
      return;
    }
    if (!pinch) onPointerMove(e);
  }

  function vpUp(e) {
    vPts.delete(e.pointerId);
    if (pinch) {
      if (vPts.size < 2) { pinch = null; viewport.classList.remove("panning"); }
      return;
    }
    onPointerUp(e);
  }

  /* ================= 初始化 ================= */
  G.init = function () {
    viewport = document.getElementById("viewport");
    world = document.getElementById("world");
    wiresSvg = document.getElementById("wires");
    nodesEl = document.getElementById("nodes");

    viewport.addEventListener("pointerdown", vpDown);
    window.addEventListener("pointermove", vpMove);
    window.addEventListener("pointerup", vpUp);
    window.addEventListener("pointercancel", vpUp);
    // 触摸板/鼠标: 滚动=平移, Ctrl+滚轮(触摸板捏合)=缩放
    viewport.addEventListener("wheel", e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0025));
      } else {
        G.pan.x -= e.deltaX;
        G.pan.y -= e.deltaY;
        applyView();
      }
    }, { passive: false });
    viewport.addEventListener("gesturestart", e => e.preventDefault());
    viewport.addEventListener("contextmenu", e => e.preventDefault());

    document.getElementById("zoomCtl").addEventListener("click", e => {
      const z = e.target.dataset.z;
      if (!z) return;
      if (z === "fit") G.fitView();
      else {
        const r = viewport.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, z === "in" ? 1.2 : 1 / 1.2);
      }
    });

    // 电平表动画
    (function meterLoop() {
      if (G.master && G.master.meterEl) {
        const rms = Aether.audio.rms ? Aether.audio.rms() : 0;
        const db = 20 * Math.log10(Math.max(rms, 1e-5));
        const pct = Math.min(100, Math.max(0, (db + 48) / 48 * 100));
        G.master.meterEl.style.width = pct + "%";
      }
      requestAnimationFrame(meterLoop);
    })();
  };

  window.addEventListener("resize", () => { /* viewport 自适应, 无需处理 */ });
})();
