/* ============================================================
 * Aether FM — 键盘: 虚拟琴键 · 电脑键盘 · Web MIDI 输入
 * ============================================================ */
"use strict";
(function () {

  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const BLACK = [1, 3, 6, 8, 10];
  const KB = (Aether.kb = {
    base: 48,               // 起始音 (C3)
    span: 25,               // 25 键 ≈ 2 个八度
    vel: 100,
    held: new Map(),        // midi → 来源
    sustain: false,
    sustained: new Set(),   // 空格延音挂起的音符
    els: new Map(),
    pointerHeld: null,
    midiAccess: null, midiInput: null,
  });

  const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
  KB.noteName = noteName;

  /* ---------------- 声音触发 ---------------- */
  async function press(midi, vel, src) {
    if (!(await Aether.audio.ensure())) return;
    if (KB.held.has(midi)) return;
    vel = vel != null ? vel : KB.vel / 127;
    KB.held.set(midi, src || "kb");
    Aether.audio.noteOn(midi, vel);
    updateKeyEl(midi, true);
    updateHeldInfo();
  }
  function release(midi) {
    if (!KB.held.has(midi)) return;
    KB.held.delete(midi);
    if (KB.sustain) KB.sustained.add(midi);
    else { Aether.audio.noteOff(midi); }
    updateKeyEl(midi, false);
    updateHeldInfo();
  }
  function releaseSustained() {
    for (const m of KB.sustained) { if (!KB.held.has(m)) Aether.audio.noteOff(m); }
    KB.sustained.clear();
  }
  KB.press = press;
  KB.release = release;

  function updateKeyEl(midi, on) {
    const el = KB.els.get(midi);
    if (el) el.classList.toggle("down", on);
  }
  function updateHeldInfo() {
    const el = document.getElementById("heldInfo");
    if (!el) return;
    const names = [...KB.held.keys()].sort((a, b) => a - b).map(noteName);
    el.textContent = names.length ? "● " + names.join(" ") : "";
  }

  /* ---------------- 虚拟琴键 ---------------- */
  function renderKeys() {
    const box = document.getElementById("kbKeys");
    box.innerHTML = "";
    KB.els.clear();
    const from = KB.base, to = KB.base + KB.span - 1;

    let whites = [];
    for (let m = from; m <= to; m++) if (!BLACK.includes(m % 12)) whites.push(m);
    const wPct = 100 / whites.length;

    whites.forEach((m, i) => {
      const el = document.createElement("div");
      el.className = "kb-white";
      el.style.left = `calc(${i * wPct}% + 1px)`;
      el.style.width = `calc(${wPct}% - 2px)`;
      el.innerHTML = `<span class="kb-n">${m % 12 === 0 ? noteName(m) : ""}</span>`;
      box.appendChild(el);
      KB.els.set(m, el);
    });

    for (let m = from; m <= to; m++) {
      if (!BLACK.includes(m % 12)) continue;
      // 左侧白键数量 → 位置
      let wIdx = 0;
      for (let q = from; q < m; q++) if (!BLACK.includes(q % 12)) wIdx++;
      const el = document.createElement("div");
      el.className = "kb-black";
      el.style.left = `calc(${wIdx * wPct}% - ${wPct * 0.3}%)`;
      el.style.width = `${wPct * 0.6}%`;
      el.innerHTML = `<span class="kb-n"></span>`;
      box.appendChild(el);
      KB.els.set(m, el);
    }

    document.getElementById("octLabel").textContent =
      `${noteName(KB.base)} – ${noteName(KB.base + KB.span - 1)}`;
  }

  function keyFromEvent(e) {
    const key = e.target.closest && e.target.closest(".kb-white,.kb-black");
    if (!key) return null;
    for (const [m, el] of KB.els) if (el === key) return m;
    return null;
  }

  /* ---------------- 电脑键盘 ---------------- */
  const KEYMAP = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
    KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15,
    Semicolon: 16,
  };

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  window.addEventListener("keydown", e => {
    if (isTyping(e)) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) { KB.sustain = true; }
      return;
    }
    if (e.code === "KeyZ" && !e.repeat) { shiftOctave(-1); return; }
    if (e.code === "KeyX" && !e.repeat) { shiftOctave(1); return; }
    const off = KEYMAP[e.code];
    if (off == null) return;
    e.preventDefault();
    if (e.repeat) return;
    press(KB.base + off, KB.vel / 127, "pc");
  });

  window.addEventListener("keyup", e => {
    if (e.code === "Space") { KB.sustain = false; releaseSustained(); return; }
    const off = KEYMAP[e.code];
    if (off == null) return;
    release(KB.base + off);
  });

  function shiftOctave(d) {
    KB.base = Math.min(96, Math.max(24, KB.base + d * 12));
    renderKeys();
    KB.held.clear();
    KB.sustained.clear();
    Aether.audio.allOff();
  }

  /* ---------------- Web MIDI ---------------- */
  async function refreshMidi() {
    const sel = document.getElementById("midiSel");
    if (!navigator.requestMIDIAccess) {
      sel.innerHTML = "<option value=''>此浏览器不支持 WebMIDI</option>";
      return;
    }
    try {
      KB.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      sel.innerHTML = "<option value=''>MIDI 访问被拒绝</option>";
      return;
    }
    sel.innerHTML = "<option value=''>内置键盘</option>";
    let i = 0;
    for (const input of KB.midiAccess.inputs.values()) {
      const opt = document.createElement("option");
      opt.value = input.id;
      opt.textContent = input.name || ("MIDI 输入 " + (++i));
      sel.appendChild(opt);
    }
    bindMidi(sel.value);
    if (KB.midiAccess.onstatechange === null) {
      KB.midiAccess.onstatechange = () => refreshMidi();
    }
  }

  function bindMidi(id) {
    if (!KB.midiAccess) return;
    if (KB.midiInput) { KB.midiInput.onmidimessage = null; KB.midiInput = null; }
    if (!id) return;
    const input = KB.midiAccess.inputs.get(id);
    if (!input) return;
    KB.midiInput = input;
    input.onmidimessage = msg => {
      const [st, d1, d2] = msg.data;
      const cmd = st & 0xf0;
      if (cmd === 0x90 && d2 > 0) press(d1, d2 / 127, "midi");
      else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) release(d1);
      else if (cmd === 0xb0 && d1 === 64) { // 延音踏板
        KB.sustain = d2 >= 64;
        if (!KB.sustain) releaseSustained();
      }
    };
  }

  /* ---------------- 初始化 ---------------- */
  KB.init = function () {
    renderKeys();

    // 虚拟琴键事件(委托, renderKeys 重建元素后仍有效)
    const box = document.getElementById("kbKeys");
    box.addEventListener("pointerdown", e => {
      const midi = keyFromEvent(e);
      if (midi == null) return;
      e.preventDefault();
      KB.pointerHeld = midi;
      press(midi, KB.vel / 127, "mouse");
    });
    box.addEventListener("pointerover", e => {
      if (KB.pointerHeld == null) return;
      const midi = keyFromEvent(e);
      if (midi == null || midi === KB.pointerHeld) return;
      release(KB.pointerHeld);
      KB.pointerHeld = midi;
      press(midi, KB.vel / 127, "mouse");
    });
    window.addEventListener("pointerup", () => {
      if (KB.pointerHeld != null) { release(KB.pointerHeld); KB.pointerHeld = null; }
    });

    document.getElementById("octDown").addEventListener("click", () => shiftOctave(-1));
    document.getElementById("octUp").addEventListener("click", () => shiftOctave(1));
    document.getElementById("velSlider").addEventListener("input", e => {
      KB.vel = +e.target.value;
    });
    document.getElementById("midiSel").addEventListener("change", e => bindMidi(e.target.value));
    document.getElementById("midiRefresh").addEventListener("click", refreshMidi);
    // MIDI 需要用户手势授权, 首次点击时尝试
    document.getElementById("midiSel").addEventListener("pointerdown", () => { refreshMidi(); }, { once: true });
  };
})();
