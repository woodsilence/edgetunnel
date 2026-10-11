/**
 * 生成静态预览 HTML
 *
 * 把真实 Worker 渲染出的面板 HTML 与真实 config.json 一并落盘，
 * 并注入演示数据，使 file:// 下也能完整呈现各标签页效果
 * （浏览器直接打开静态文件时 fetch 不可用，数据由注入提供）。
 *
 * 需要能保存、跑真实后端的话用 preview.mjs（起本地 http 服务）。
 * 两者共用 scripts/_harness.mjs 里的假 CF 环境。
 *
 * 用法：node scripts/gen-preview.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, DEMO, DEMO_LOGS, DEMO_IPS, CTX,
  loadWorker, makeRequest, makeEnv, adminFetch,
} from './_harness.mjs';

const OUT = join(ROOT, 'preview');
mkdirSync(OUT, { recursive: true });

const worker = await loadWorker();
const env = makeEnv();

// 取真实渲染出的面板与配置
const adminHtml = await (await adminFetch(worker, env, '/admin')).text();
const cfg = await (await adminFetch(worker, env, '/admin/config.json')).json();
const cfInfo = await (await adminFetch(worker, env, '/admin/cf.json')).json();
cfg.TIME = new Date().toISOString();
cfg.加载时间 = '3.21ms';
cfg.随机路径 = true;
cfg.ECH = true;

// 注入演示数据：CFG 预置 + fetch 打桩，让静态页各标签页都能显示内容
const stub = `
  // ---- 预览注入（仅用于静态预览，真实环境下为 no-op）----
  var __DEMO_LOGS = ${JSON.stringify(DEMO_LOGS)};
  var __DEMO_IPS = ${JSON.stringify(DEMO_IPS)};
  var __CFG = ${JSON.stringify(cfg)};
  var __CFINFO = ${JSON.stringify(cfInfo)};
  var __realFetch = window.fetch;
  window.fetch = function (url, opts) {
    var u = String(url && url.url ? url.url : url);
    if (u.indexOf('/admin/config.json') >= 0) {
      return Promise.resolve(new Response(JSON.stringify(__CFG), { headers: { 'content-type': 'application/json' } }));
    }
    if (u.indexOf('/admin/cf.json') >= 0) {
      return Promise.resolve(new Response(JSON.stringify(__CFINFO), { headers: { 'content-type': 'application/json' } }));
    }
    if (u.indexOf('/admin/log.json') >= 0) {
      return Promise.resolve(new Response(JSON.stringify(__DEMO_LOGS), { headers: { 'content-type': 'application/json' } }));
    }
    if (u.indexOf('/admin/ADD.txt') >= 0) {
      return Promise.resolve(new Response(__DEMO_IPS, { headers: { 'content-type': 'text/plain' } }));
    }
    return __realFetch.apply(this, arguments);
  };
`;

const ANCHOR = 'var CFG = null;';
if (!adminHtml.includes(ANCHOR)) {
  throw new Error('面板结构已变：找不到 ' + ANCHOR + '，预览注入点需同步更新');
}

// CFG 预置 + 打桩代码都要插到 IIFE 之前，顺序不能反
const html = adminHtml
  .replace(ANCHOR, 'var CFG = __CFG;')
  .replace('<script>\n(function () {\n\'use strict\';', '<script>\n' + stub + '\n(function () {\n\'use strict\';');

writeFileSync(join(OUT, 'admin.html'), html);

// 登录页
const loginHtml = await (await worker.fetch(makeRequest('/login'), env, CTX)).text();
writeFileSync(join(OUT, 'login.html'), loginHtml);

// 两个提示页。它们不是按路径触发的，而是由 env 条件触发：
//   未配置密码页：!管理员密码 —— 管理员密码取值链含 env.UUID/KEY，故 env 必须完全为空
//   未绑定 KV  页：有 ADMIN 但无 KV 绑定
async function grabNotice(pageEnv, expected) {
  const res = await worker.fetch(makeRequest('/'), pageEnv, CTX);
  const body = await res.text();
  if (res.status !== 404 || !body.includes(expected)) {
    throw new Error(`提示页未按预期命中：期望 404 且包含「${expected}」，实际 ${res.status}`);
  }
  return body;
}

writeFileSync(join(OUT, 'no-admin.html'), await grabNotice({}, '尚未设置管理员密码'));
writeFileSync(join(OUT, 'no-kv.html'), await grabNotice({ ADMIN: DEMO.ADMIN }, '尚未绑定 KV 命名空间'));

writeFileSync(join(OUT, 'config.json'), JSON.stringify(cfg, null, 2));

console.log('✔ preview/admin.html    已生成（含演示数据）');
console.log('✔ preview/login.html    已生成');
console.log('✔ preview/no-admin.html 已生成（404）');
console.log('✔ preview/no-kv.html    已生成（404）');
console.log('✔ preview/config.json   已生成');