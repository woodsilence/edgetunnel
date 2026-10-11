/**
 * 把「外部 Pages 代理」改为「内置页面」
 *
 * 改的是 ref/monolith.js（流水线切片来源），而不是生成产物 ——
 * 产物每次重建都会被覆盖，改源才持久。
 *
 * 四处路由：
 *   1. /noADMIN → 内置未配置密码页
 *   2. /login   → 内置登录页
 *   3. /admin   → 内置管理面板
 *   4. /noKV    → 内置未绑定 KV 页
 *
 * 状态码保持原样（noADMIN/noKV 仍为 404），以免改变既有探测行为。
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join('ref', 'monolith.js');
let t = fs.readFileSync(FILE, 'utf8');
const before = t;

const edits = [
  // 1. /noADMIN
  [
    "if (!管理员密码) return fetch(Pages静态页面 + '/noADMIN').then(r => { const headers = new Headers(r.headers); headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); headers.set('Pragma', 'no-cache'); headers.set('Expires', '0'); return new Response(r.body, { status: 404, statusText: r.statusText, headers }) });",
    'if (!管理员密码) return 未配置密码页();',
  ],
  // 2. /login 页面
  [
    "return fetch(Pages静态页面 + '/login');",
    'return 登录页();',
  ],
  // 3. /admin 面板
  [
    "return fetch(Pages静态页面 + '/admin' + url.search);",
    'return 管理面板(url);',
  ],
  // 4. /noKV
  [
    "} else if (!envUUID) return fetch(Pages静态页面 + '/noKV').then(r => { const headers = new Headers(r.headers); headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); headers.set('Pragma', 'no-cache'); headers.set('Expires', '0'); return new Response(r.body, { status: 404, statusText: r.statusText, headers }) });",
    '} else if (!envUUID) return 未绑定KV页();',
  ],
];

let ok = true;
for (const [from, to] of edits) {
  if (!t.includes(from)) {
    console.error('✘ 未匹配：\n' + from.slice(0, 100));
    ok = false;
    continue;
  }
  t = t.replace(from, to);
}

if (!ok) process.exit(1);

fs.writeFileSync(FILE, t);
console.log('✔ monolith.js 已切换为内置页面（4 处）');
console.log('  残留 Pages静态页面 引用：', (t.match(/Pages静态页面/g) || []).length, '（仅常量定义处应保留）');