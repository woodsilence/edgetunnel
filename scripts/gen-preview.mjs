/**
 * 生成静态预览 HTML
 *
 * 把真实 Worker 渲染出的面板 HTML 与真实 config.json 一并落盘，
 * 并注入演示数据，使 file:// 下也能完整呈现各标签页效果
 * （浏览器直接打开静态文件时 fetch 不可用，数据由注入提供）。
 *
 * 用法：node scripts/gen-preview.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'preview'), { recursive: true });

const tmp = join(ROOT, 'test', '_preview-worker.mjs');
writeFileSync(tmp, readFileSync(join(ROOT, '_worker.js'), 'utf8'));
const worker = (await import(pathToFileURL(tmp).href)).default;

const ADMIN = 'demo-pass', KEY = 'demo-key';
const UUID = '90cd4a77-141a-43c9-991b-08263cfe9c10';
const HOST = 'vless.example.com';

const enc = new TextEncoder();
const nodeMD5 = s => createHash('md5').update(Buffer.from(enc.encode(s))).digest('hex');
const UA = 'Mozilla/5.0';
const authCookie = nodeMD5(nodeMD5(`${UA}${KEY}${ADMIN}`).slice(7, 27));

const DEMO_LOGS = [
  { datetime: new Date(Date.now() - 120000).toISOString(), reqType: 'Get_SUB', ip: '203.0.113.7', ua: 'Clash/1.18.0', remarks: '订阅拉取' },
  { datetime: new Date(Date.now() - 900000).toISOString(), reqType: 'Proxy', ip: '198.51.100.22', ua: 'v2rayN/6.23', remarks: '反代连接' },
  { datetime: new Date(Date.now() - 3600000).toISOString(), reqType: 'Admin_Login', ip: '203.0.113.7', ua: UA, remarks: '面板登录' },
  { datetime: new Date(Date.now() - 86400000).toISOString(), reqType: 'WS', ip: '192.0.2.55', ua: 'Shadowrocket/2.1', remarks: 'WebSocket 建连' },
];
const DEMO_IPS = '1.1.1.1:443#Sydney\n8.8.8.8:443#Google\nhttps://cf.090227.xyz/sub\ncdn.example.net:8443#自建';

const KV = {
  async get(k) {
    if (k === 'config.json') return null;
    if (k === 'log.json') return JSON.stringify(DEMO_LOGS);
    if (k === 'ADD.txt') return DEMO_IPS;
    return null;
  },
  async put() { }, async list() { return { keys: [] }; },
};

const env = { ADMIN, KEY, UUID, HOST, KV };
const ctx = { waitUntil() { } };
const mk = (u, h = {}) => ({
  url: 'https://vless.example.com' + u, method: 'GET',
  cf: { colo: 'HKG', asn: 13335, country: 'HK' },
  headers: new Headers({ 'User-Agent': UA, ...h }),
  redirect: 'manual', async text() { return ''; }, async json() { return {}; },
});

// 取真实渲染出的面板与配置
const adminHtml = await (await worker.fetch(mk('/admin', { Cookie: `auth=${authCookie}` }), env, ctx)).text();
const cfg = await (await worker.fetch(mk('/admin/config.json', { Cookie: `auth=${authCookie}` }), env, ctx)).json();
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
  var __realFetch = window.fetch;
  window.fetch = function (url, opts) {
    var u = String(url && url.url ? url.url : url);
    if (u.indexOf('/admin/config.json') >= 0) {
      return Promise.resolve(new Response(JSON.stringify(__CFG), { headers: { 'content-type': 'application/json' } }));
    }
    if (u.indexOf('/admin/log.json') >= 0) {
      return Promise.resolve(new Response(JSON.stringify(__DEMO_LOGS), { headers: { 'content-type': 'application/json' } }));
    }
    if (u.indexOf('/admin/ADD.txt') >= 0) {
      return Promise.resolve(new Response(__DEMO_IPS, { headers: { 'content-type': 'text/plain' } }));
    }
    return __realFetch.apply(this, arguments);
  };
  var __CFG__ = ${JSON.stringify(cfg)};
`;

let html = adminHtml.replace('var CFG = null;', 'var CFG = __CFG__;');
html = html.replace('<script>\n(function () {\n\'use strict\';', '<script>\n' + stub + '\n(function () {\n\'use strict\';');

writeFileSync(join(ROOT, 'preview', 'admin.html'), html);

// 登录页
const loginHtml = await (await worker.fetch(mk('/login'), env, ctx)).text();
writeFileSync(join(ROOT, 'preview', 'login.html'), loginHtml);

// 两个提示页。它们不是按路径触发的，而是由 env 条件触发：
//   未配置密码页：!管理员密码 —— 管理员密码取值链含 env.UUID/KEY，故 env 必须完全为空
//   未绑定 KV  页：有 ADMIN 但无 KV 绑定
const mkPage = async (label, env) => {
  const res = await worker.fetch(mk('/'), env, ctx);
  return { status: res.status, html: await res.text(), label };
};

const noAdmin = await mkPage('no-admin', {});
const noKv = await mkPage('no-kv', { ADMIN });

if (noAdmin.status !== 404 || !noAdmin.html.includes('尚未设置管理员密码')) {
  throw new Error('未配置密码页未按预期命中（status=' + noAdmin.status + '）');
}
if (noKv.status !== 404 || !noKv.html.includes('尚未绑定 KV 命名空间')) {
  throw new Error('未绑定 KV 页未按预期命中（status=' + noKv.status + '）');
}
writeFileSync(join(ROOT, 'preview', 'no-admin.html'), noAdmin.html);
writeFileSync(join(ROOT, 'preview', 'no-kv.html'), noKv.html);

writeFileSync(join(ROOT, 'preview', 'config.json'), JSON.stringify(cfg, null, 2));

console.log('✔ preview/admin.html   已生成（含演示数据）');
console.log('✔ preview/login.html   已生成');
console.log(`✔ preview/no-admin.html 已生成（${noAdmin.status}）`);
console.log(`✔ preview/no-kv.html    已生成（${noKv.status}）`);
console.log('✔ preview/config.json   已生成');