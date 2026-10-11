/**
 * 内置前端资源
 *
 * 面板改为内嵌自建，不再依赖外部 GitHub Pages（edt-pages.github.io）。
 * 好处：
 *   1. UI 完全自控，可随项目一起版本化；
 *   2. 不依赖第三方站点可用性，登录页/后台不会因上游挂掉而打不开；
 *   3. 省掉一次外部回源，登录更快。
 *
 * 所有资源以「源码字符串」形式保存在本模块中，由 src/pages.js 提供给 index.js。
 * 之所以用 JS 字符串而不是 import 静态文件：Workers 部署只上传单个 _worker.js，
 * 静态资源需要一并打包进来，写成字符串最直观也最可靠。
 */

/** 面板通用样式：设计令牌 + 组件库 + 布局骨架 */
export const PANEL_CSS = `
/* ============ 设计令牌 ============ */
:root {
  --bg: #0b0f17;
  --bg-elev: #131926;
  --bg-elev-2: #1a2233;
  --bg-hover: #212b3f;
  --border: #263148;
  --border-strong: #35435f;
  --text: #e6ecf7;
  --text-dim: #97a3b8;
  --text-faint: #64708a;
  --primary: #4f8cff;
  --primary-hover: #6ba0ff;
  --primary-dim: rgba(79,140,255,.14);
  --success: #35d07f;
  --success-dim: rgba(53,208,127,.14);
  --warn: #f5a524;
  --warn-dim: rgba(245,165,36,.14);
  --danger: #f5484a;
  --danger-dim: rgba(245,72,74,.14);
  --radius: 10px;
  --radius-sm: 7px;
  --shadow: 0 8px 28px rgba(0,0,0,.36);
  --mono: ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --sans: -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB",
          "Microsoft YaHei",Roboto,Helvetica,Arial,sans-serif;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #f6f8fc;
    --bg-elev: #ffffff;
    --bg-elev-2: #f0f3f9;
    --bg-hover: #e8edf6;
    --border: #dde3ee;
    --border-strong: #c3ccdd;
    --text: #16202f;
    --text-dim: #5a6580;
    --text-faint: #8b95ab;
    --primary-dim: rgba(79,140,255,.12);
    --shadow: 0 8px 28px rgba(20,35,70,.10);
  }
}

* { box-sizing: border-box; }

html, body { height: 100%; }

body {
  margin: 0;
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

/* ============ 布局 ============ */
.wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 64px; }
.wrap.narrow { max-width: 420px; }

header.top {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 22px; flex-wrap: wrap;
}
header.top h1 { font-size: 19px; margin: 0; font-weight: 650; letter-spacing: -.01em; }
header.top .spacer { flex: 1; }
header.top .ver { color: var(--text-faint); font-size: 12px; font-family: var(--mono); }

/* ============ 卡片 ============ */
.card {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 16px;
  overflow: hidden;
}
.card > .head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  font-weight: 600; font-size: 14px;
}
.card > .head .spacer { flex: 1; }
.card > .body { padding: 18px; }
.card > .body.tight { padding: 0; }

/* ============ 标签页 ============ */
.tabs { display: flex; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.tabs button {
  appearance: none; border: 0; background: none; cursor: pointer;
  padding: 10px 14px; font: inherit; font-weight: 550; color: var(--text-dim);
  border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .15s;
}
.tabs button:hover { color: var(--text); }
.tabs button[aria-selected="true"] { color: var(--primary); border-bottom-color: var(--primary); }
.tabpanel[hidden] { display: none; }

/* ============ 表单 ============ */
.field { margin-bottom: 16px; }
.field > label { display: block; font-size: 12.5px; font-weight: 600; color: var(--text-dim); margin-bottom: 6px; }
.field .hint { font-size: 11.5px; color: var(--text-faint); margin-top: 5px; line-height: 1.5; }

input[type=text], input[type=password], input[type=number], select, textarea {
  width: 100%; padding: 9px 11px; font: inherit; font-size: 13.5px;
  color: var(--text); background: var(--bg-elev-2);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  outline: none; transition: border-color .15s, box-shadow .15s;
}
textarea { font-family: var(--mono); font-size: 12.5px; line-height: 1.55; resize: vertical; min-height: 120px; }
input:focus, select:focus, textarea:focus {
  border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-dim);
}
input::placeholder, textarea::placeholder { color: var(--text-faint); }
select { cursor: pointer; appearance: none;
  background-image: linear-gradient(45deg,transparent 50%,var(--text-faint) 50%),linear-gradient(135deg,var(--text-faint) 50%,transparent 50%);
  background-position: calc(100% - 15px) 50%, calc(100% - 10px) 50%;
  background-size: 5px 5px,5px 5px; background-repeat: no-repeat; padding-right: 32px;
}

.grid { display: grid; gap: 0 16px; }
.grid.two { grid-template-columns: 1fr 1fr; }
@media (max-width: 620px) { .grid.two { grid-template-columns: 1fr; } }

.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* 开关 */
.switch { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; margin: 0; }
.switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.switch .track {
  width: 38px; height: 22px; border-radius: 11px; background: var(--border-strong);
  position: relative; transition: background .18s; flex: none;
}
.switch .track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%; background: #fff;
  transition: transform .18s; box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
.switch input:checked + .track { background: var(--primary); }
.switch input:checked + .track::after { transform: translateX(16px); }
.switch input:focus-visible + .track { box-shadow: 0 0 0 3px var(--primary-dim); }

/* ============ 按钮 ============ */
button.btn {
  appearance: none; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 600;
  padding: 9px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong); background: var(--bg-elev-2); color: var(--text);
  transition: background .15s, border-color .15s, opacity .15s; white-space: nowrap;
}
button.btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--border-strong); }
button.btn:disabled { opacity: .5; cursor: not-allowed; }
button.btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
button.btn.primary:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); }
button.btn.danger { color: var(--danger); border-color: var(--danger); background: var(--danger-dim); }
button.btn.danger:hover:not(:disabled) { background: var(--danger); color: #fff; }
button.btn.ghost { background: none; border-color: transparent; color: var(--text-dim); }
button.btn.ghost:hover:not(:disabled) { background: var(--bg-hover); color: var(--text); }
button.btn.sm { padding: 6px 11px; font-size: 12.5px; }

/* ============ 徽章 / 提示 ============ */
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 20px;
  font-size: 11.5px; font-weight: 600; letter-spacing: .01em;
  background: var(--bg-elev-2); color: var(--text-dim); border: 1px solid var(--border);
}
.badge.ok { background: var(--success-dim); color: var(--success); border-color: transparent; }
.badge.err { background: var(--danger-dim); color: var(--danger); border-color: transparent; }

.notice {
  padding: 11px 14px; border-radius: var(--radius-sm); margin-bottom: 14px;
  font-size: 13px; border: 1px solid transparent;
}
.notice.ok { background: var(--success-dim); color: var(--success); }
.notice.err { background: var(--danger-dim); color: var(--danger); }
.notice.warn { background: var(--warn-dim); color: var(--warn); }
.notice[hidden] { display: none; }

/* ============ 表格 ============ */
table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
table.data th, table.data td { padding: 9px 14px; text-align: left; border-bottom: 1px solid var(--border); }
table.data th { color: var(--text-dim); font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; background: var(--bg-elev-2); }
table.data tr:last-child td { border-bottom: 0; }
table.data td.mono, table.data td .mono { font-family: var(--mono); font-size: 12px; }
table.data tbody tr:hover { background: var(--bg-hover); }

.scroll { max-height: 460px; overflow: auto; }

/* ============ 统计卡 ============ */
.stats { display: grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: 12px; margin-bottom: 16px; }
.stat { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 15px 16px; }
.stat .k { font-size: 11.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 5px; }
.stat .v { font-size: 21px; font-weight: 660; font-family: var(--mono); letter-spacing: -.02em; }
.stat .v small { font-size: 13px; color: var(--text-faint); font-weight: 500; }

/* ============ 代码块 ============ */
pre.code {
  margin: 0; padding: 13px 15px; background: var(--bg-elev-2);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-family: var(--mono); font-size: 12px; line-height: 1.6;
  overflow: auto; max-height: 340px; white-space: pre-wrap; word-break: break-all;
}

/* ============ 登录页 ============ */
.login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.login-card { width: 100%; max-width: 380px; }
.login-card .brand { text-align: center; margin-bottom: 24px; }
.login-card .brand .logo {
  width: 46px; height: 46px; border-radius: 12px; margin: 0 auto 13px;
  background: linear-gradient(135deg,var(--primary),#7c5cff);
  display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 19px;
  box-shadow: 0 6px 18px rgba(79,140,255,.3);
}
.login-card .brand h1 { font-size: 19px; margin: 0 0 5px; font-weight: 650; }
.login-card .brand p { margin: 0; color: var(--text-dim); font-size: 13px; }

/* ============ 杂项 ============ */
.muted { color: var(--text-dim); }
.faint { color: var(--text-faint); }
.mono { font-family: var(--mono); }
.small { font-size: 12px; }
.right { margin-left: auto; }
.stack > * + * { margin-top: 12px; }
.divider { height: 1px; background: var(--border); margin: 18px 0; }
.empty { padding: 34px 20px; text-align: center; color: var(--text-faint); font-size: 13px; }

@media (max-width: 620px) {
  .wrap { padding: 18px 14px 48px; }
  header.top h1 { font-size: 17px; }
  table.data th, table.data td { padding: 8px 10px; }
}
`;

/**
 * 把 HTML 片段包成完整文档
 * @param {string} title 页面标题
 * @param {string} body  页面主体
 */
export function page(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>${title}</title>
<style>${PANEL_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}