/**
 * 内置前端资源 —— Apple 风格设计系统
 *
 * 设计要点（对齐 apple.com 的视觉语言）：
 *  1. 大留白：内容区最大宽度收窄，区块之间用「呼吸感」而非线条分隔；
 *  2. 克制的配色：只用一个系统蓝作为强调色，其余靠中性灰阶与字号/字重建立层次；
 *  3. 细腻层次：用极淡的分隔线（而非边框）划分区域，卡片几乎不使用阴影；
 *  4. 圆润：大圆角（卡片 18px / 控件 12px），按钮为胶囊形；
 *  5. 字体优先 SF Pro / 苹方，数字与标识符走等宽，标题字重偏轻、字距收紧。
 *
 * 浅色为主、深色跟随系统，两套都遵循同一套层次关系。
 */

/** 颜色/尺寸/字体等设计令牌 */
export const PANEL_CSS = `
/* ================= 设计令牌 ================= */
:root {
  /* 强调色：Apple 系统蓝 */
  --blue: #0071e3;
  --blue-hover: #0077ed;
  --blue-active: #006edb;
  --blue-soft: rgba(0,113,227,.10);
  --blue-soft-2: rgba(0,113,227,.16);

  /* 中性灰阶：暖调白灰，避免死白 */
  --canvas: #fbfbfd;        /* 页面底色 */
  --surface: #ffffff;       /* 卡片/面板 */
  --surface-2: #f5f5f7;     /* 次级填充（输入框、代码块） */
  --surface-3: #eeeef0;     /* 三级填充（hover） */

  /* 文字 */
  --ink: #1d1d1f;           /* 主文字 */
  --ink-2: #6e6e73;         /* 次要文字 */
  --ink-3: #86868b;         /* 三级文字/占位 */

  /* 分隔：极细、极淡 */
  --line: rgba(0,0,0,.08);
  --line-2: rgba(0,0,0,.05);
  --line-strong: rgba(0,0,0,.14);

  /* 语义色（低饱和，贴近系统色） */
  --green: #1d9a5b;
  --green-soft: rgba(29,154,91,.12);
  --orange: #b25000;
  --orange-soft: rgba(178,80,0,.12);
  --red: #d70015;
  --red-soft: rgba(215,0,21,.10);

  /* 圆角 */
  --r-lg: 18px;
  --r-md: 12px;
  --r-sm: 8px;
  --r-pill: 980px;

  /* 阴影：几乎不用，仅浮层 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,.07), 0 16px 40px rgba(0,0,0,.09);
  --shadow-pop: 0 8px 28px rgba(0,0,0,.14);

  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
          "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --blue: #2997ff;
    --blue-hover: #47a6ff;
    --blue-active: #1d8cff;
    --blue-soft: rgba(41,151,255,.16);
    --blue-soft-2: rgba(41,151,255,.24);

    --canvas: #000000;
    --surface: #1d1d1f;
    --surface-2: #2c2c2e;
    --surface-3: #3a3a3c;

    --ink: #f5f5f7;
    --ink-2: #a1a1a6;
    --ink-3: #86868b;

    --line: rgba(255,255,255,.10);
    --line-2: rgba(255,255,255,.06);
    --line-strong: rgba(255,255,255,.18);

    --green: #32d74b;
    --green-soft: rgba(50,215,75,.16);
    --orange: #ff9f0a;
    --orange-soft: rgba(255,159,10,.16);
    --red: #ff453a;
    --red-soft: rgba(255,69,58,.16);

    --shadow-sm: none;
    --shadow-md: none;
    --shadow-pop: 0 8px 28px rgba(0,0,0,.6);
  }
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
  background: var(--canvas);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: "tnum" on;
}

::selection { background: var(--blue-soft-2); }

/* ================= 版心 ================= */
.wrap { max-width: 940px; margin: 0 auto; padding: 40px 24px 96px; }
.wrap.narrow { max-width: 400px; }

/* ================= 页头 ================= */
header.top {
  display: flex; align-items: baseline; gap: 12px;
  padding-bottom: 20px; margin-bottom: 28px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}
header.top h1 {
  font-size: 28px; font-weight: 600; letter-spacing: -.022em;
  margin: 0; line-height: 1.2;
}
header.top .spacer { flex: 1; }
header.top .ver { color: var(--ink-3); font-size: 12.5px; font-family: var(--mono); }

@media (max-width: 640px) {
  header.top h1 { font-size: 24px; }
  .wrap { padding: 28px 18px 72px; }
}

/* ================= 卡片 ================= */
.card {
  background: var(--surface);
  border-radius: var(--r-lg);
  margin-bottom: 18px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--line-2);
}
.card > .head {
  padding: 18px 24px 14px;
  font-weight: 600; font-size: 16px; letter-spacing: -.01em;
  display: flex; align-items: center; gap: 10px;
}
.card > .head .spacer { flex: 1; }
.card > .head .sub { font-weight: 400; font-size: 13px; color: var(--ink-3); }
.card > .body { padding: 4px 24px 22px; }
.card > .body.flush { padding: 0 0 6px; }
.card > .body.lead { padding-top: 0; }

/* ================= 分段控件（替代标签页） ================= */
.seg {
  display: inline-flex; gap: 2px; padding: 3px;
  background: var(--surface-2); border-radius: var(--r-pill);
  margin-bottom: 28px; max-width: 100%;
  overflow-x: auto; scrollbar-width: none;
}
.seg::-webkit-scrollbar { display: none; }
.seg button {
  appearance: none; border: 0; background: none; cursor: pointer;
  font: inherit; font-size: 13.5px; font-weight: 500; color: var(--ink-2);
  padding: 7px 16px; border-radius: var(--r-pill); white-space: nowrap;
  transition: color .2s, background .2s;
}
.seg button:hover { color: var(--ink); }
.seg button[aria-selected="true"] {
  background: var(--surface); color: var(--ink); font-weight: 590;
  box-shadow: 0 1px 3px rgba(0,0,0,.10), 0 0 1px rgba(0,0,0,.06);
}
.tabpanel[hidden] { display: none; }

/* ================= 表单 ================= */
.field { margin-bottom: 18px; }
.field > label {
  display: block; font-size: 13px; font-weight: 590; color: var(--ink-2);
  margin-bottom: 7px; letter-spacing: -.005em;
}
.field .hint { font-size: 12.5px; color: var(--ink-3); margin-top: 6px; line-height: 1.45; }

input[type=text], input[type=password], input[type=number], select, textarea {
  width: 100%; padding: 11px 14px;
  font: inherit; font-size: 15px; color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-md);
  outline: none;
  transition: border-color .2s, box-shadow .2s, background .2s;
  -webkit-appearance: none; appearance: none;
}
textarea {
  font-family: var(--mono); font-size: 13px; line-height: 1.65;
  resize: vertical; min-height: 150px;
}
input::placeholder, textarea::placeholder { color: var(--ink-3); }
input:hover, select:hover, textarea:hover { border-color: var(--ink-3); }
input:focus, select:focus, textarea:focus {
  border-color: var(--blue); box-shadow: 0 0 0 3.5px var(--blue-soft);
}
input[readonly] { background: var(--surface-2); color: var(--ink-2); }
select {
  cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='14' viewBox='0 0 10 14'><path d='M1 1l4 4 4-4' stroke='%2386868b' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 38px;
}

.grid { display: grid; gap: 0 18px; }
.grid.two { grid-template-columns: 1fr 1fr; }
@media (max-width: 680px) { .grid.two { grid-template-columns: 1fr; } }

.row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

/* 开关：iOS 风格 */
.switch { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; margin: 0; font-size: 14.5px; }
.switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.switch .track {
  width: 50px; height: 30px; border-radius: var(--r-pill);
  background: var(--line-strong); position: relative;
  transition: background .25s cubic-bezier(.4,0,.2,1); flex: none;
}
.switch .track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 26px; height: 26px; border-radius: 50%; background: #fff;
  box-shadow: 0 2px 5px rgba(0,0,0,.2), 0 0 1px rgba(0,0,0,.16);
  transition: transform .25s cubic-bezier(.4,0,.2,1);
}
.switch input:checked + .track { background: var(--green); }
.switch input:checked + .track::after { transform: translateX(20px); }
.switch input:focus-visible + .track { box-shadow: 0 0 0 3.5px var(--blue-soft); }

/* ================= 按钮 ================= */
button.btn {
  appearance: none; cursor: pointer; font: inherit;
  font-size: 14.5px; font-weight: 500; letter-spacing: -.005em;
  padding: 10px 20px; border-radius: var(--r-pill);
  border: 1px solid transparent;
  background: var(--surface-2); color: var(--blue);
  transition: background .2s, color .2s, border-color .2s, opacity .2s, transform .08s;
  white-space: nowrap; -webkit-appearance: none;
}
button.btn:active:not(:disabled) { transform: scale(.975); }
button.btn:disabled { opacity: .4; cursor: not-allowed; }
button.btn.primary { background: var(--blue); color: #fff; }
button.btn.primary:hover:not(:disabled) { background: var(--blue-hover); }
button.btn.tinted { background: var(--blue-soft); color: var(--blue); }
button.btn.tinted:hover:not(:disabled) { background: var(--blue-soft-2); }
button.btn.quiet { background: transparent; color: var(--ink-2); }
button.btn.quiet:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
button.btn.danger { background: transparent; color: var(--red); }
button.btn.danger:hover:not(:disabled) { background: var(--red-soft); }
button.btn.sm { padding: 6px 14px; font-size: 13px; }

/* ================= 提示条 ================= */
.pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 11px; border-radius: var(--r-pill);
  font-size: 12px; font-weight: 590; letter-spacing: .005em;
  background: var(--surface-2); color: var(--ink-2);
}
.pill.ok { background: var(--green-soft); color: var(--green); }
.pill.err { background: var(--red-soft); color: var(--red); }
.pill.warn { background: var(--orange-soft); color: var(--orange); }

.notice {
  padding: 13px 17px; border-radius: var(--r-md); margin-bottom: 18px;
  font-size: 14px; font-weight: 450;
  background: var(--surface-2); color: var(--ink);
}
.notice.ok { background: var(--green-soft); color: var(--green); }
.notice.err { background: var(--red-soft); color: var(--red); }
.notice.warn { background: var(--orange-soft); color: var(--orange); }
.notice[hidden] { display: none; }

/* ================= 统计块 ================= */
.stats {
  display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr));
  gap: 14px; margin-bottom: 18px;
}
.stat {
  background: var(--surface); border-radius: var(--r-lg);
  padding: 18px 20px; border: 1px solid var(--line-2);
  box-shadow: var(--shadow-sm);
}
.stat .k {
  font-size: 12px; font-weight: 590; color: var(--ink-3);
  letter-spacing: .01em; margin-bottom: 6px;
}
.stat .v {
  font-size: 26px; font-weight: 600; letter-spacing: -.02em; line-height: 1.15;
}
.stat .v.mono { font-size: 14px; letter-spacing: -.01em; word-break: break-all; }
.stat .v small { font-size: 15px; color: var(--ink-3); font-weight: 400; }

/* ================= 表格 ================= */
table.data { width: 100%; border-collapse: collapse; font-size: 14px; }
table.data th, table.data td {
  padding: 13px 24px; text-align: left;
  border-bottom: 1px solid var(--line-2);
}
table.data th {
  color: var(--ink-3); font-weight: 590; font-size: 12px;
  letter-spacing: .01em; background: var(--surface);
}
table.data tbody tr:last-child td { border-bottom: 0; }
table.data td.mono { font-family: var(--mono); font-size: 13px; }
table.data th:first-child, table.data td:first-child { padding-left: 24px; }
table.data th:last-child, table.data td:last-child { padding-right: 24px; }

.scroll { max-height: 520px; overflow: auto; }

/* ================= 代码块 ================= */
pre.code {
  margin: 0; padding: 15px 17px;
  background: var(--surface-2); border-radius: var(--r-md);
  font-family: var(--mono); font-size: 12.5px; line-height: 1.7;
  color: var(--ink); overflow: auto; max-height: 360px;
  white-space: pre-wrap; word-break: break-all;
}
code { font-family: var(--mono); font-size: .92em; }

/* ================= 登录页 ================= */
.login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.login-card { width: 100%; max-width: 380px; }
.login-card .brand { text-align: center; margin-bottom: 30px; }
.login-card .brand .logo {
  width: 60px; height: 60px; border-radius: 17px; margin: 0 auto 18px;
  background: linear-gradient(160deg, var(--blue), #6f4bf2);
  display: grid; place-items: center; color: #fff;
  font-weight: 600; font-size: 25px; letter-spacing: -.02em;
  box-shadow: 0 8px 24px rgba(0,113,227,.30);
}
.login-card .brand h1 { font-size: 26px; margin: 0 0 6px; font-weight: 600; letter-spacing: -.022em; }
.login-card .brand p { margin: 0; color: var(--ink-3); font-size: 15px; }
.login-card .card { box-shadow: var(--shadow-md); }
.login-card .card > .body { padding: 26px 24px 24px; }

/* ================= 杂项 ================= */
.muted { color: var(--ink-2); }
.faint { color: var(--ink-3); }
.mono { font-family: var(--mono); }
.small { font-size: 13px; }
.tiny { font-size: 12px; }
.right { margin-left: auto; }
.stack > * + * { margin-top: 12px; }
.hairline { height: 1px; background: var(--line-2); margin: 20px 0; }
.empty { padding: 44px 24px; text-align: center; color: var(--ink-3); font-size: 14px; }
`;