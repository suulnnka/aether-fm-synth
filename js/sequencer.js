/* ============================================================
 * Aether FM — 音序器 (纵向钢琴卷帘)
 * 左键: 画/移动音符, 右缘: 改长度, 右键/双击: 删除
 * 音符按所选音阶吸附; 时间按网格吸附; 循环长度不限(自动扩展)
 * ============================================================ */
"use strict";
(function () {

  const SC = (Aether.seq = {
    notes: [], nid: 1,
    playing: false,
    bpm: 120,
    ppb: 28, ROW: 16,
    PITCH_MIN: 24, PITCH_MAX: 107,   // C1..B7
    snap: 0.25,
    scaleKey: "major", root: 0,
    loopBars: 8, autoLoop: true,
    extraBeats: 0,   // 无限长度: 超出音符范围的额外可书写拍数
    metro: false,
    lastDur: 1,
    startCtx: 0, startBeat: 0, scheduledUntil: 0,
    pausedBeat: 0,
    timer: null, dirty: true,
  });

  const SCALES = {
    chromatic: { name: "半音阶(自由)", iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    major:     { name: "大调",       iv: [0, 2, 4, 5, 7, 9, 11] },
    minor:     { name: "自然小调",   iv: [0, 2, 3, 5, 7, 8, 10] },
    harmonic:  { name: "和声小调",   iv: [0, 2, 3, 5, 7, 8, 11] },
    pentM:     { name: "大调五声",   iv: [0, 2, 4, 7, 9] },
    pentm:     { name: "小调五声",   iv: [0, 3, 5, 7, 10] },
    blues:     { name: "布鲁斯",     iv: [0, 3, 5, 6, 7, 10] },
    dorian:    { name: "多利亚",     iv: [0, 2, 3, 5, 7, 9, 10] },
  };
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const BLACK = [1, 3, 6, 8, 10];
  const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);

  let scrollEl, canvas, ctx2d, keysCanvas, kctx, spacer;

  /* ---------------- 音阶 ---------------- */
  SC.inScale = function (m) {
    const iv = SCALES[SC.scaleKey].iv;
    return iv.includes(((m - SC.root) % 12 + 12) % 12);
  };
  SC.snapPitch = function (m) {
    if (SC.inScale(m)) return m;
    for (let d = 1; d <= 6; d++) {
      if (SC.inScale(m - d)) return m - d;
      if (SC.inScale(m + d)) return m + d;
    }
    return m;
  };

  const snapFloor = b => Math.floor(b / SC.snap + 1e-6) * SC.snap;
  const snapRound = b => Math.round(b / SC.snap) * SC.snap;

  function loopBeats() {
    if (!SC.autoLoop) return SC.loopBars * 4;
    let end = 16;
    for (const n of SC.notes) end = Math.max(end, n.start + n.dur);
    return Math.ceil(end / 4) * 4;
  }
  SC.loopBeats = loopBeats;

  function contentBeats() {
    let end = loopBeats() + 16;
    for (const n of SC.notes) end = Math.max(end, n.start + n.dur + 16);
    return Math.max(end + SC.extraBeats, 64);
  }

  // 接近视口右缘时自动扩展可书写区域(音序长度不限)
  function extendContentIfNeeded() {
    const visibleEndBeat = (scrollEl.scrollLeft + scrollEl.clientWidth) / SC.ppb;
    if (visibleEndBeat > contentBeats() - 8) {
      SC.extraBeats += 128;   // 每次 +32 小节
      updateSpacer();
      return true;
    }
    return false;
  }

  /* ---------------- 坐标 ---------------- */
  const beatToX = b => b * SC.ppb - scrollEl.scrollLeft;
  const midiToY = m => (SC.PITCH_MAX - m) * SC.ROW - scrollEl.scrollTop;
  const xToBeat = x => (x + scrollEl.scrollLeft) / SC.ppb;
  const yToMidi = y => SC.PITCH_MAX - Math.floor((y + scrollEl.scrollTop) / SC.ROW);

  function updateSpacer() {
    spacer.style.width = Math.ceil(contentBeats() * SC.ppb) + "px";
    spacer.style.height = (SC.PITCH_MAX - SC.PITCH_MIN + 1) * SC.ROW + "px";
  }

  /* ---------------- 绘制 ---------------- */
  function draw() {
    // 面板首次可见时, 把视图滚到音符区域(隐藏时无法滚动)
    if (!SC._scrolledInit && canvas.clientHeight > 10) {
      SC._scrolledInit = true;
      scrollEl.scrollTop = (SC.PITCH_MAX - 72) * SC.ROW;
      scrollEl.scrollLeft = 0;
    }
    extendContentIfNeeded();
    const W = canvas.width = canvas.clientWidth * devicePixelRatio;
    const H = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx2d.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const w = W / devicePixelRatio, h = H / devicePixelRatio;
    if (!w || !h) return;
    const free = SC.scaleKey === "chromatic";
    const lb = loopBeats();

    ctx2d.fillStyle = "#0a0e15"; ctx2d.fillRect(0, 0, w, h);

    // 行
    for (let m = SC.PITCH_MAX; m >= SC.PITCH_MIN; m--) {
      const y = midiToY(m);
      if (y > h || y + SC.ROW < 0) continue;
      const black = BLACK.includes(m % 12);
      ctx2d.fillStyle = black ? "#0d1119" : "#111623";
      ctx2d.fillRect(0, y, w, SC.ROW);
      if (!free && !SC.inScale(m)) { ctx2d.fillStyle = "rgba(0,0,0,0.42)"; ctx2d.fillRect(0, y, w, SC.ROW); }
      ctx2d.fillStyle = "rgba(255,255,255,0.025)";
      ctx2d.fillRect(0, y + SC.ROW - 1, w, 1);
    }

    // 纵线 & 小节号
    const b0 = Math.floor(xToBeat(0)), b1 = Math.ceil(xToBeat(w));
    for (let b = b0; b <= b1; b++) {
      if (b < 0) continue;
      const x = beatToX(b);
      const isBar = b % 4 === 0;
      ctx2d.fillStyle = isBar ? "rgba(140,170,220,0.22)" : "rgba(120,150,200,0.07)";
      ctx2d.fillRect(x, 0, 1, h);
      if (isBar && SC.ppb > 14) {
        ctx2d.fillStyle = "#44536b"; ctx2d.font = "10px Consolas";
        ctx2d.fillText(String(b / 4 + 1), x + 4, 12);
      }
    }
    // 循环末端
    const lx = beatToX(lb);
    if (lx >= 0 && lx <= w) {
      ctx2d.fillStyle = "rgba(57,217,138,0.65)";
      ctx2d.fillRect(lx - 1, 0, 2, h);
    }

    // 音符
    for (const n of SC.notes) {
      const x = beatToX(n.start), y = midiToY(n.midi);
      const nw = Math.max(3, n.dur * SC.ppb - 1);
      if (x + nw < 0 || x > w || y + SC.ROW < 0 || y > h) continue;
      ctx2d.fillStyle = "rgba(53,224,176,0.28)";
      ctx2d.fillRect(x + 1, y + 2, nw, SC.ROW - 3);
      ctx2d.fillStyle = "#35e0b0";
      ctx2d.fillRect(x + 1, y + 2, Math.min(4, nw), SC.ROW - 3);
      ctx2d.strokeStyle = "#9df5d5"; ctx2d.lineWidth = 1;
      ctx2d.strokeRect(x + 1.5, y + 2.5, nw - 1, SC.ROW - 4);
      if (n === hoverNote && hoverEdge) { ctx2d.fillStyle = "#ffffff"; ctx2d.fillRect(x + nw - 3, y + 2, 3, SC.ROW - 3); }
      if (nw > 26 && SC.ROW >= 14) {
        ctx2d.fillStyle = "rgba(6,20,15,0.9)"; ctx2d.font = "9px Consolas";
        ctx2d.fillText(noteName(n.midi), x + 7, y + SC.ROW - 4);
      }
    }

    // 播放头
    if (SC.playing) {
      const pb = playheadBeat();
      const px = beatToX(pb);
      if (px >= -2 && px <= w + 2) {
        ctx2d.fillStyle = "rgba(255,240,150,0.9)";
        ctx2d.fillRect(px - 1, 0, 2, h);
        ctx2d.fillStyle = "rgba(255,240,150,0.15)";
        ctx2d.fillRect(px - 8, 0, 16, h);
      }
      // 跟随滚动
      if (px > w * 0.86 || px < 0) scrollEl.scrollLeft = Math.max(0, pb * SC.ppb - w * 0.15);
    }

    drawKeys();
    SC.dirty = false;
  }

  function drawKeys() {
    const W = keysCanvas.width = keysCanvas.clientWidth * devicePixelRatio;
    const H = keysCanvas.height = keysCanvas.clientHeight * devicePixelRatio;
    kctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const w = W / devicePixelRatio, h = H / devicePixelRatio;
    const free = SC.scaleKey === "chromatic";
    kctx.fillStyle = "#0d1119"; kctx.fillRect(0, 0, w, h);
    for (let m = SC.PITCH_MAX; m >= SC.PITCH_MIN; m--) {
      const y = midiToY(m);
      if (y > h || y + SC.ROW < 0) continue;
      const black = BLACK.includes(m % 12);
      const inS = free || SC.inScale(m);
      kctx.fillStyle = black ? (inS ? "#161d2b" : "#10141d") : (inS ? "#dfe7f2" : "#8b95a6");
      kctx.fillRect(0, y + 1, w, SC.ROW - 2);
      if (m % 12 === 0) {
        kctx.fillStyle = "#33445f"; kctx.font = "bold 9px Consolas";
        kctx.fillText(noteName(m), w - 24, y + SC.ROW - 4);
      }
    }
  }

  /* ---------------- 播放调度 ---------------- */
  function playheadBeat() {
    const beats = (Aether.audio.ctx.currentTime - SC.startCtx) * SC.bpm / 60 + SC.startBeat;
    const lb = loopBeats();
    return ((beats % lb) + lb) % lb;
  }

  function tick() {
    if (!SC.playing || !Aether.audio.ready) return;
    const now = Aether.audio.ctx.currentTime;
    const bps = SC.bpm / 60;
    const lb = loopBeats();
    const horizon = (now + 0.22 - SC.startCtx) * bps + SC.startBeat;

    for (const n of SC.notes) {
      if (n.start >= lb) continue;
      let k = Math.ceil((SC.scheduledUntil - n.start) / lb - 1e-9);
      if (k < 0) k = 0;
      for (; ; k++) {
        const occ = n.start + k * lb;
        if (occ >= horizon - 1e-9) break;
        if (occ >= SC.scheduledUntil - 1e-9 && occ >= 0) {
          const when = SC.startCtx + (occ - SC.startBeat) / bps;
          if (when >= now - 0.01) Aether.audio.scheduleNote(n.midi, Math.max(when, now), Math.max(0.03, n.dur / bps), n.vel || 0.9);
        }
      }
    }
    // 节拍器
    if (SC.metro) {
      for (let b = Math.ceil(SC.scheduledUntil - 1e-9); b < horizon; b++) {
        if (b < 0) continue;
        const occ = ((b % lb) + lb) % lb;
        const when = SC.startCtx + (b - SC.startBeat) / bps;
        if (when >= now - 0.01) Aether.audio.click(Math.max(when, now), occ % 4 === 0);
      }
    }
    SC.scheduledUntil = horizon;
  }

  SC.play = async function () {
    if (!(await Aether.audio.ensure())) return;
    if (SC.playing) return;
    SC.playing = true;
    SC.startCtx = Aether.audio.ctx.currentTime + 0.06;
    SC.startBeat = 0;
    SC.scheduledUntil = 0;
    SC.timer = setInterval(tick, 40);
    SC.dirty = true;
    document.getElementById("playBtn").classList.add("on");
    document.getElementById("playBtn").textContent = "❚❚ 播放中";
  };

  SC.stop = function () {
    SC.playing = false;
    clearInterval(SC.timer);
    Aether.audio.allOff();
    SC.dirty = true;
    scrollEl.scrollLeft = 0;
    document.getElementById("playBtn").classList.remove("on");
    document.getElementById("playBtn").textContent = "▶ 播放";
  };

  SC.toggle = () => SC.playing ? SC.stop() : SC.play();

  /* ---------------- 编辑交互 ---------------- */
  let dragN = null;      // {note, mode:'move'|'size'|'new', grabB, grabM}
  let hoverNote = null, hoverEdge = false;

  function noteAt(x, y) {
    for (let i = SC.notes.length - 1; i >= 0; i--) {
      const n = SC.notes[i];
      const nx = beatToX(n.start), nw = n.dur * SC.ppb;
      const ny = midiToY(n.midi);
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + SC.ROW) return n;
    }
    return null;
  }

  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const beat = xToBeat(x), midi = yToMidi(y);

    if (e.button === 2) {
      const n = noteAt(x, y);
      if (n) { SC.notes = SC.notes.filter(q => q !== n); SC.dirty = true; }
      return;
    }
    if (e.button === 1) return;

    const n = noteAt(x, y);
    // 双击/双触删除(手动检测, 兼容触摸屏 pointerdown 无 detail 计数)
    const now = performance.now();
    const dbl = !!(n && SC._lastTap && SC._lastTap.note === n && now - SC._lastTap.t < 350);
    SC._lastTap = n ? { note: n, t: now } : null;
    if (n) {
      const nx = beatToX(n.start), nw = n.dur * SC.ppb;
      if (x > nx + nw - 8) {
        dragN = { note: n, mode: "size" };
        if (dbl || e.detail >= 2) { SC.notes = SC.notes.filter(q => q !== n); dragN = null; SC.dirty = true; }
      } else if (dbl || e.detail >= 2) {
        SC.notes = SC.notes.filter(q => q !== n); SC.dirty = true; return;
      } else {
        dragN = { note: n, mode: "move", grabB: beat - n.start, grabM: n.midi - midi };
      }
    } else {
      // 新建音符
      const m = SC.snapPitch(Math.min(SC.PITCH_MAX, Math.max(SC.PITCH_MIN, midi)));
      const note = { id: SC.nid++, start: Math.max(0, snapFloor(beat)), dur: Math.max(SC.snap, SC.lastDur), midi: m, vel: 0.9 };
      SC.notes.push(note);
      dragN = { note, mode: "new" };   // "new": 若随即转为双指平移, 此音符会被撤销
      Aether.kb.press(m, 0.9, "roll");
      setTimeout(() => Aether.kb.release(m), 160);
    }
    SC.dirty = true;
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const beat = xToBeat(x), midi = Math.min(SC.PITCH_MAX, Math.max(SC.PITCH_MIN, yToMidi(y)));

    if (!dragN) {
      const n = noteAt(x, y);
      hoverNote = n;
      hoverEdge = false;
      if (n) {
        const nx = beatToX(n.start), nw = n.dur * SC.ppb;
        hoverEdge = x > nx + nw - 8;
        canvas.style.cursor = hoverEdge ? "ew-resize" : "move";
      } else canvas.style.cursor = "crosshair";
      return;
    }

    const n = dragN.note;
    if (dragN.mode === "move") {
      n.start = Math.max(0, snapRound(beat - dragN.grabB));
      const m2 = SC.snapPitch(midi + dragN.grabM);
      if (m2 !== n.midi) { n.midi = m2; Aether.kb.press(m2, 0.9, "roll"); setTimeout(() => Aether.kb.release(m2), 120); }
    } else { // size / new
      n.dur = Math.max(SC.snap, snapRound(beat - n.start) || SC.snap);
      SC.lastDur = n.dur;
      n.start = Math.max(0, dragN.mode === "new" ? n.start : n.start);
    }
    SC.dirty = true;
  }

  function onUp() {
    dragN = null;
    updateSpacer();
    SC.dirty = true;
  }

  /* ---------------- 键位预览列 ---------------- */
  function keysDown(e) {
    const rect = keysCanvas.getBoundingClientRect();
    const m = yToMidi(e.clientY - rect.top);
    if (m < SC.PITCH_MIN || m > SC.PITCH_MAX) return;
    Aether.kb.press(m, 0.9, "roll");
    const up = () => { Aether.kb.release(m); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointerup", up);
  }

  /* ---------------- 控件 ---------------- */
  function buildControls() {
    const scaleSel = document.getElementById("scaleSel");
    for (const [k, s] of Object.entries(SCALES)) {
      const o = document.createElement("option"); o.value = k; o.textContent = s.name;
      scaleSel.appendChild(o);
    }
    scaleSel.value = SC.scaleKey;
    const rootSel = document.getElementById("rootSel");
    NAMES.forEach((n, i) => {
      const o = document.createElement("option"); o.value = i; o.textContent = n;
      rootSel.appendChild(o);
    });

    scaleSel.addEventListener("change", e => { SC.scaleKey = e.target.value; SC.dirty = true; });
    rootSel.addEventListener("change", e => { SC.root = +e.target.value; SC.dirty = true; });
    document.getElementById("snapSel").addEventListener("change", e => { SC.snap = +e.target.value; });
    document.getElementById("loopBars").addEventListener("change", e => {
      SC.loopBars = Math.min(999, Math.max(1, +e.target.value || 8)); SC.dirty = true; updateSpacer();
    });
    document.getElementById("autoLoop").addEventListener("change", e => { SC.autoLoop = e.target.checked; SC.dirty = true; });
    document.getElementById("metroChk").addEventListener("change", e => { SC.metro = e.target.checked; });
    document.getElementById("zoomH").addEventListener("input", e => {
      SC.ppb = +e.target.value; SC.dirty = true; updateSpacer();
    });
    document.getElementById("clearNotes").addEventListener("click", () => {
      SC.notes = []; SC.dirty = true;
    });

    const bpm = document.getElementById("bpmInput");
    bpm.addEventListener("change", () => {
      const v = Math.min(300, Math.max(20, +bpm.value || 120));
      bpm.value = v;
      if (SC.playing) {
        const cur = playheadBeat();
        SC.startBeat = cur;
        SC.startCtx = Aether.audio.ctx.currentTime;
        SC.scheduledUntil = cur;
      }
      SC.bpm = v;
    });
  }

  /* ---------------- 初始化 ---------------- */
  SC.init = function () {
    scrollEl = document.getElementById("rollScroll");
    canvas = document.getElementById("rollCanvas");
    ctx2d = canvas.getContext("2d");
    keysCanvas = document.getElementById("keysCanvas");
    kctx = keysCanvas.getContext("2d");
    spacer = document.getElementById("rollSpacer");

    updateSpacer();
    buildControls();

    // 指针跟踪: 单指=编辑音符, 双指=平移卷帘
    const rollPts = new Map();
    const centroid = m => {
      let x = 0, y = 0;
      for (const p of m.values()) { x += p.x; y += p.y; }
      return { x: x / m.size, y: y / m.size };
    };
    let panPrev = null;

    canvas.addEventListener("pointerdown", e => {
      rollPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (rollPts.size === 2) {
        // 第二根手指落下 → 取消编辑转为平移; 刚新建、尚未拖拽的音符一并撤销
        if (dragN && dragN.mode === "new") SC.notes = SC.notes.filter(q => q !== dragN.note);
        dragN = null;
        panPrev = centroid(rollPts);
        SC.dirty = true;
        return;
      }
      if (rollPts.size > 2) return;
      onDown(e);
    });
    canvas.addEventListener("pointermove", e => {
      if (rollPts.has(e.pointerId)) rollPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (rollPts.size >= 2 && panPrev) {
        const c = centroid(rollPts);
        extendContentIfNeeded();
        scrollEl.scrollLeft -= c.x - panPrev.x;
        scrollEl.scrollTop -= c.y - panPrev.y;
        panPrev = c;
        SC.dirty = true;
        return;
      }
      if (rollPts.size <= 1) onMove(e);
    });
    const rollUp = e => {
      rollPts.delete(e.pointerId);
      if (rollPts.size < 2) panPrev = null;
      if (rollPts.size === 0) onUp(e);
    };
    window.addEventListener("pointerup", rollUp);
    window.addEventListener("pointercancel", rollUp);
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    keysCanvas.addEventListener("pointerdown", keysDown);
    scrollEl.addEventListener("scroll", () => { SC.dirty = true; });
    // 触摸板/鼠标: 滚轮=横向, Shift+滚轮=纵向, Ctrl+滚轮(捏合)=时间缩放
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // 触摸板捏合: 归一化 deltaMode、单事件限幅、降低灵敏度
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= 100;
        dy = Math.max(-60, Math.min(60, dy));
        SC.ppb = Math.min(64, Math.max(8, SC.ppb * Math.exp(-dy * 0.0035)));
        document.getElementById("zoomH").value = SC.ppb;
        updateSpacer();
      } else if (e.shiftKey) {
        scrollEl.scrollTop += e.deltaY;
      } else {
        // 先扩展再滚动: 贴边时滚动事件不会再触发, 必须在这里检查
        extendContentIfNeeded();
        scrollEl.scrollLeft += (e.deltaY + e.deltaX);
      }
      SC.dirty = true;
    }, { passive: false });

    (function loop() {
      if (SC.playing || SC.dirty) draw();
      requestAnimationFrame(loop);
    })();

    // 示例乐句 (C 大调五声)
    const demo = [
      [0, 1, 60], [1, 1, 64], [2, 1, 67], [3, 1, 72],
      [4, 2, 69], [6, 1, 67], [7, 1, 64],
      [8, 1, 65], [9, 1, 64], [10, 1, 62], [11, 1, 60],
      [12, 3, 60],
    ];
    for (const [s, d, m] of demo) SC.notes.push({ id: SC.nid++, start: s, dur: d, midi: m, vel: 0.9 });
    SC.dirty = true;
  };
})();
