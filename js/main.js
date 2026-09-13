/* ============================================================
 * Aether FM — 主入口
 * ============================================================ */
"use strict";

Aether.toast = function (msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(Aether._toastTimer);
  Aether._toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
};

/* ---- 通用文本输入弹窗 ---- */
Aether.promptText = function (title, def, cb) {
  const back = document.getElementById("modalBack");
  const body = document.getElementById("modalBody");
  document.getElementById("modalTitle").textContent = title;
  body.innerHTML = "<input type='text' id='promptInput'>";
  const input = body.querySelector("#promptInput");
  input.value = def || "";
  back.classList.remove("hidden");
  input.focus();
  input.select();
  const ok = () => {
    back.classList.add("hidden");
    cb(input.value.trim() || null);
  };
  input.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") ok();
    if (e.key === "Escape") back.classList.add("hidden");
  });
  document.getElementById("modalOk").onclick = ok;
};

/* ---- 数值编辑弹窗(与组件风格统一) ---- */
Aether.promptNumber = function (title, value, min, max, fmtText, cb) {
  const back = document.getElementById("modalBack");
  const body = document.getElementById("modalBody");
  document.getElementById("modalTitle").textContent = title;
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <input id="promptNum" type="text" inputmode="decimal" autocomplete="off"
        style="flex:1;background:#141b26;border:1px solid #35507a;color:#eaf3ff;border-radius:var(--ctl-r);
               padding:9px 12px;font-size:18px;font-family:Consolas,monospace;outline:none;
               box-shadow:0 0 12px rgba(57,217,138,.12) inset;text-align:right;">
      <span style="font-size:var(--fs-xs);color:var(--ink-4);white-space:nowrap;">${min} ~ ${max}</span>
    </div>`;
  const input = body.querySelector("#promptNum");
  input.value = fmtText;
  back.classList.remove("hidden");
  input.focus(); input.select();
  const okBtn = document.getElementById("modalOk");
  okBtn.textContent = "确定";
  const commit = () => {
    let v = parseFloat(input.value.replace(",", "."));
    back.classList.add("hidden");
    okBtn.textContent = "知道了";
    if (isNaN(v)) return;
    v = Math.min(max, Math.max(min, v));
    cb(v);
  };
  input.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { back.classList.add("hidden"); okBtn.textContent = "知道了"; }
  });
  okBtn.onclick = commit;
};

/* ---- 确认框 ---- */
Aether.confirmBox = function (title, cb) {
  const back = document.getElementById("modalBack");
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = "";
  back.classList.remove("hidden");
  const okBtn = document.getElementById("modalOk");
  okBtn.textContent = "确定";
  okBtn.onclick = () => { back.classList.add("hidden"); cb(); okBtn.textContent = "知道了"; };
};

/* ---- 帮助 ---- */
function showHelp() {
  const back = document.getElementById("modalBack");
  document.getElementById("modalTitle").textContent = "帮助 · Aether FM 合成器工作站";
  document.getElementById("modalBody").innerHTML = `
  <h4>◈ 节点图</h4>
  <b>算子 (OP)</b> 是 FM 核心: 拖动 <b>算子OUT → 另一算子IN</b> = 调制(载波/调制器关系), 拖到 <b>FM输出</b> = 作为载波发声。
  <br>· 每个算子: 波形 Sin/Tri/Sqr/Saw · Ratio 频率比 · Detune 失谐 · Level 电平 · FB 自反馈 · A/D/S/R 包络
  <br>· <b>Fixed</b> 勾选 = 固定频率模式(不随音高); <b>Sync</b> 勾选 = 相位同步(音符触发时相位归零, 取消则各算子自由运行)
  <br>· <b>FLT</b> 按钮 = 算子输出滤波, 点击循环 不启用 → 低通 → 高通, 启用后出现 Cutoff 滑条(会影响调制输出)
  <br>· 底部 <b>▾ 高级</b> 展开面板: <b>ADSR 可视化图形</b>(拖拽手柄)+ A/D/S/R 旋钮(双击复位) · <b>LFO</b> 开关(波形/速率/深度, 调制该算子音高)
  <br>· 左侧圆点关闭/启用算子; 双击标题重命名; <kbd>×</kbd> 删除
  <br>· <b>＋算子</b> 最多 8 个; <b>＋效果</b> 添加后处理(参考现代 FM 复刻插件机架): 合唱 / 镶边 / 移相 / 震音 / 延时 / 混响 / 失真 / 过载 / 硬削波 / 滤波 / 均衡 / 压缩 / 量化 / 降采样 / 粒子
  <br>· 连线: 从右侧圆点拖到目标左侧圆点; <b>双击连线删除</b>; 效果之间可串联, 最后接 <b>主输出</b>(不接主输出也可, 自动直通)
  <br>· 鼠标滚轮 / 触摸板双指滑动 = 平移 · Ctrl+滚轮 / 触摸板捏合 = 缩放 · 触摸屏: 单指拖动, 双指捏合缩放、双指平移 · 允许反馈环(回路按单采样延迟处理)
  <h4>◈ 演奏</h4>
  底部虚拟琴键鼠标点击/滑动; 电脑键盘 <kbd>A W S E D F T G Y H U J K</kbd>(黑键 <kbd>W E T Y U O P</kbd>) 演奏, <kbd>Z</kbd>/<kbd>X</kbd> 切换八度, 按住 <kbd>空格</kbd> 延音。
  <br>触摸屏: 琴键支持<b>多指和弦</b>与<b>滑动滑奏</b>。
  <br>顶栏 <b>MIDI</b> 下拉选择真实 MIDI 键盘 (Chrome/Edge 支持 WebMIDI), 支持延音踏板。
  <h4>◈ 音序器</h4>
  纵向钢琴卷帘: 左键画音符并拖动, 拖音符<b>右缘</b>改长度, <b>右键/双击</b>删除; 最左侧琴键列点击试听。
  <br>触摸屏: 双指平移卷帘, 双指捏合调整时间缩放, <b>双击音符</b>删除。
  <br>· <b>音阶吸附</b>: 选择音阶与根音后, 音符自动吸附到调内音级 (选"半音阶"则自由)
  <br>· <b>吸附</b>: 时间网格 1/16 ~ 小节; <b>小节</b>: 循环长度, 开"自动长度"则跟随最后音符, 可无限长
  <br>· 顶栏 <kbd>▶</kbd> 播放 / <kbd>■</kbd> 停止, <kbd>回车</kbd> 切换播放; BPM 顶栏调整; <b>节拍器</b> 可开关; 顶栏 <b>曲目</b> 下拉可加载内置经典曲目
  <h4>◈ 音色</h4>
  顶栏预设下拉载入出厂音色; <kbd>💾保存</kbd> 存入浏览器; <kbd>🎲随机</kbd> 开盲盒随机生成音色。
  `;
  back.classList.remove("hidden");
  document.getElementById("modalOk").onclick = () => back.classList.add("hidden");
}

/* ---- 启动 ---- */
(function main() {
  // 节点图
  Aether.Graph.init();
  // 默认音色: 电钢琴
  Aether.presets.init();
  Aether.Graph.applyPatch(JSON.parse(JSON.stringify(Aether.presets.factory["电钢琴"])));

  // 键盘 & 音序器
  Aether.kb.init();
  Aether.seq.init();

  // 停靠区 Tab
  document.querySelectorAll("#dockTabs .dt").forEach(btn => {
    btn.addEventListener("click", () => {
      // 收起状态下点 Tab → 先展开停靠区, 否则切了也看不见面板
      const dock = document.getElementById("dock");
      if (dock.classList.contains("collapsed")) document.getElementById("dockToggle").click();
      document.querySelectorAll("#dockTabs .dt").forEach(b => b.classList.toggle("active", b === btn));
      document.getElementById("kbPanel").classList.toggle("hidden", btn.dataset.tab !== "kb");
      document.getElementById("seqPanel").classList.toggle("hidden", btn.dataset.tab !== "seq");
      Aether.seq.dirty = true;
    });
  });

  // 停靠区高度拖拽(收起时禁用)
  const dock = document.getElementById("dock");
  const grip = document.getElementById("dockGrip");
  grip.addEventListener("pointerdown", e => {
    if (dock.classList.contains("collapsed")) return;
    e.preventDefault();
    const startY = e.clientY, startH = dock.offsetHeight;
    const mv = ev => {
      dock.style.flexBasis = Math.min(window.innerHeight * 0.75, Math.max(110, startH - (ev.clientY - startY))) + "px";
      Aether.seq.dirty = true;
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  });

  // 停靠区收起 / 展开
  const dockToggle = document.getElementById("dockToggle");
  dockToggle.addEventListener("click", () => {
    const h = Math.max(180, dock.offsetHeight);   // 先记录展开高度(收起类会让高度塌到最小值)
    const collapsed = dock.classList.toggle("collapsed");
    if (collapsed) {
      dock.dataset.h = h + "px";
      dock.style.flexBasis = "";
      dockToggle.textContent = "▴";
      dockToggle.title = "展开面板";
    } else {
      dock.style.flexBasis = dock.dataset.h || "275px";
      dockToggle.textContent = "▾";
      dockToggle.title = "收起面板";
    }
    Aether.seq.dirty = true;
  });

  // 传输
  document.getElementById("playBtn").addEventListener("click", () => Aether.seq.toggle());
  document.getElementById("stopBtn").addEventListener("click", () => Aether.seq.stop());

  // ＋算子
  document.getElementById("addOpBtn").addEventListener("click", async () => {
    if (!(await Aether.audio.ensure())) return;
    const n = Aether.Graph.addOp({ x: 40 + Math.random() * 60, y: 30 + Math.random() * 200 });
    if (n) { Aether.Graph.syncAudio(); Aether.toast("已新增算子 " + n.title); }
  });

  // ＋效果 菜单
  const dd = document.getElementById("addFxDd");
  const menu = document.getElementById("addFxMenu");
  for (const [key, spec] of Object.entries(window.FX_SPECS)) {
    const b = document.createElement("button");
    b.innerHTML = `<span style="color:${spec.color};text-shadow:0 0 8px ${spec.color}">●</span> ${spec.name}`;
    b.addEventListener("click", async () => {
      dd.classList.remove("open");
      if (!(await Aether.audio.ensure())) return;
      const n = Aether.Graph.addFx(key, { x: 1000 + Math.random() * 80, y: 30 + Math.random() * 160 });
      if (n) { Aether.Graph.syncAudio(); Aether.toast("已添加效果「" + spec.name + "」, 从 FM输出 拉线过来即可使用"); }
    });
    menu.appendChild(b);
  }
  dd.querySelector("button").addEventListener("click", e => {
    e.stopPropagation();
    dd.classList.toggle("open");
  });
  window.addEventListener("pointerdown", e => {
    if (!dd.contains(e.target)) dd.classList.remove("open");
  });

  // 经典曲目下拉
  const songSel = document.getElementById("songSel");
  for (const s of Aether.songs.list) {
    const o = document.createElement("option");
    o.value = s.id; o.textContent = s.name;
    songSel.appendChild(o);
  }
  // 删除已保存音色
  const delBtn = document.getElementById("delPresetBtn");
  const presetSel = document.getElementById("presetSel");
  presetSel.addEventListener("change", () => {
    delBtn.classList.toggle("hidden", !Aether.presets.lastSelectedSave);
  });
  delBtn.addEventListener("click", () => {
    const name = Aether.presets.lastSelectedSave;
    if (!name) return;
    Aether.confirmBox("删除音色「" + name + "」?", () => {
      delete Aether.presets.saves[name];
      localStorage.setItem("aetherfm.saves", JSON.stringify(Aether.presets.saves));
      Aether.presets.refreshList();
      Aether.presets.lastSelectedSave = null;
      delBtn.classList.add("hidden");
      Aether.toast("已删除「" + name + "」");
    });
    document.getElementById("modalOk").textContent = "删除";
  });

  songSel.addEventListener("change", () => {
    const s = Aether.songs.list.find(x => x.id === songSel.value);
    if (!s) return;
    Aether.seq.loadSong(s);
    if (document.getElementById("dock").classList.contains("collapsed"))
      document.getElementById("dockToggle").click();
    document.querySelector('.dt[data-tab="seq"]').click();
    Aether.toast("已加载「" + s.name + "」· " + Aether.seq.notes.length + " 个音符, 点播放试听");
    songSel.value = "";
  });

  // 连接方式下拉(经典算法, 附小图)
  const algoDd = document.getElementById("algoDd");
  const algoMenu = document.getElementById("algoMenu");
  function drawAlgoCv(cv, alg) {
    const W = 46, H = 48, DPR = Math.min(2, devicePixelRatio || 1);
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const g = cv.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, H);
    const bx = 22, bw = 16, bh = 5, dy = 7.2, y0 = 3;
    const yOf = op => y0 + (op - 1) * dy;
    const isC = op => alg.carriers.includes(op);
    for (let op = 1; op <= 6; op++) {
      const y = yOf(op);
      if (isC(op)) {
        g.strokeStyle = "#39d98a"; g.lineWidth = 1;
        g.beginPath(); g.moveTo(bx - 3, y + bh / 2); g.lineTo(10, y + bh / 2); g.stroke();
        g.fillStyle = "#39d98a";
        g.beginPath(); g.arc(9, y + bh / 2, 1.5, 0, 7); g.fill();
      }
      g.fillStyle = isC(op) ? "#1d3a2c" : "#141b28";
      g.fillRect(bx, y, bw, bh);
      g.strokeStyle = isC(op) ? "#39d98a" : "#3a4c6d"; g.lineWidth = 0.8;
      g.strokeRect(bx, y, bw, bh);
      g.fillStyle = isC(op) ? "#9df5c9" : "#7f93b3";
      g.font = "6px Consolas";
      g.fillText(String(op), bx + 6, y + bh - 1.2);
    }
    for (const [f, t] of alg.mods) {
      const yF = yOf(f) + bh / 2, yT = yOf(t) + bh / 2;
      g.strokeStyle = "#5aa9ff"; g.fillStyle = "#5aa9ff"; g.lineWidth = 1;
      if (t === f - 1) {
        const cx = bx + bw / 2;
        g.beginPath(); g.moveTo(cx, yOf(f)); g.lineTo(cx, yOf(t) + bh + 1); g.stroke();
        g.beginPath(); g.moveTo(cx - 1.5, yOf(t) + bh + 2); g.lineTo(cx + 1.5, yOf(t) + bh + 2); g.lineTo(cx, yOf(t) + bh); g.closePath(); g.fill();
      } else {
        g.beginPath();
        g.moveTo(bx + bw, yF); g.lineTo(W - 2, yF); g.lineTo(W - 2, yT); g.lineTo(bx + bw + 3, yT);
        g.stroke();
        g.beginPath(); g.moveTo(bx + bw + 1, yT); g.lineTo(bx + bw + 3, yT - 1.5); g.lineTo(bx + bw + 3, yT + 1.5); g.closePath(); g.fill();
      }
    }
  }
  Aether.Graph.ALGORITHMS.forEach((alg, idx) => {
    const item = document.createElement("button");
    item.className = "algo-item";
    item.title = alg.name;
    const cv = document.createElement("canvas");
    item.appendChild(cv);
    const span = document.createElement("span");
    span.textContent = alg.name;
    item.appendChild(span);
    item.addEventListener("click", async () => {
      algoDd.classList.remove("open");
      if (!(await Aether.audio.ensure())) return;
      const warns = Aether.Graph.applyAlgorithm(idx) || [];
      Aether.toast("已应用连接方式:" + alg.name + (warns.length ? " · 注意: " + warns.join(",") : ""));
    });
    algoMenu.appendChild(item);
    drawAlgoCv(cv, alg);
  });
  algoDd.querySelector("button").addEventListener("click", e => {
    e.stopPropagation();
    dd.classList.remove("open");
    algoDd.classList.toggle("open");
  });
  window.addEventListener("pointerdown", e => {
    if (!algoDd.contains(e.target)) algoDd.classList.remove("open");
  });

  // 帮助
  document.getElementById("helpBtn").addEventListener("click", showHelp);
  document.getElementById("modalBack").addEventListener("pointerdown", e => {
    if (e.target.id === "modalBack") e.target.classList.add("hidden");
  });

  // 首次任意交互启动音频
  const kick = () => {
    Aether.audio.ensure();
    window.removeEventListener("pointerdown", kick);
    window.removeEventListener("keydown", kick);
  };
  window.addEventListener("pointerdown", kick);
  window.addEventListener("keydown", kick);

  // 防止拖动时选中文本
  document.addEventListener("dragstart", e => e.preventDefault());
})();
