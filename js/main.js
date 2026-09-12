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

/* ---- 帮助 ---- */
function showHelp() {
  const back = document.getElementById("modalBack");
  document.getElementById("modalTitle").textContent = "帮助 · Aether FM 合成器工作站";
  document.getElementById("modalBody").innerHTML = `
  <h4>◈ 节点图</h4>
  <b>算子 (OP)</b> 是 FM 核心: 拖动 <b>算子OUT → 另一算子IN</b> = 调制(载波/调制器关系), 拖到 <b>FM输出</b> = 作为载波发声。
  <br>· 每个算子: 波形 Sin/Tri/Sqr/Saw · Ratio 频率比 · Detune 失谐 · Level 电平 · FB 自反馈 · A/D/S/R 包络
  <br>· 标题右侧 <kbd>R</kbd> 切换 <b>比率/固定频率</b> 模式; 左侧圆点关闭/启用算子; 双击标题重命名; <kbd>×</kbd> 删除
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
  <br>· 顶栏 <kbd>▶</kbd> 或 <kbd>空格键外的任意时刻</kbd>点播放; BPM 顶栏调整; <b>节拍器</b> 可开关
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
  Aether.Graph.applyPatch(JSON.parse(JSON.stringify(Aether.presets.factory["电钢琴 DX"])));

  // 键盘 & 音序器
  Aether.kb.init();
  Aether.seq.init();

  // 停靠区 Tab
  document.querySelectorAll("#dockTabs .dt").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#dockTabs .dt").forEach(b => b.classList.toggle("active", b === btn));
      document.getElementById("kbPanel").classList.toggle("hidden", btn.dataset.tab !== "kb");
      document.getElementById("seqPanel").classList.toggle("hidden", btn.dataset.tab !== "seq");
      Aether.seq.dirty = true;
    });
  });

  // 停靠区高度拖拽
  const dock = document.getElementById("dock");
  const grip = document.getElementById("dockGrip");
  grip.addEventListener("pointerdown", e => {
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
