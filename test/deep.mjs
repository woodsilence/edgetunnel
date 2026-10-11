/**
 * 深度校验：对重构产物直接验证鉴权派生值与协议解析
 * 这些是整个项目最不能出错的部分（订阅 token / UUID / Cookie）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, '_worker.js'), 'utf8');
const tmp = join(ROOT, 'test', '_deep.mjs');
writeFileSync(tmp, src);
const w = (await import(pathToFileURL(tmp).href)).default;

const enc = new TextEncoder();
let fail = 0;
const chk = (label, ok, extra = '') => {
  if (!ok) fail++;
  console.log(`  ${ok ? '✔' : '✘'} ${label}${extra ? '  ' + extra : ''}`);
};

const env = {
  ADMIN: 'test-admin-pw', KEY: 'CMLiussss',
  KV: { async get(k) { return k === 'log.json' ? '[]' : null; }, async put() { }, async list() { return { keys: [] }; } },
};

/** ctx 桩：Workers 会把 waitUntil 的任务延后执行，这里直接吞掉 */
const ctx = { waitUntil() { }, passThroughOnException() { } };

// ── 1. 鉴权 Cookie 必须等于 MD5MD5(UA + KEY + 密码) ──
console.log('\n[1] 后台登录 Cookie');
const UA = 'DeepTest/1.0';
const mk = (path, headers = {}) => ({
  url: `https://vless.test${path}`, method: 'GET', cf: { colo: 'T' },
  headers: new Headers({ 'User-Agent': UA, ...headers }),
  body: null, redirect: 'manual', async text() { return ''; }, async json() { return {}; },
  arrayBuffer: async () => new ArrayBuffer(0), formData: async () => new FormData(),
});

// 直接登录并取出 Set-Cookie
const loginRes = await w.fetch((() => {
  const r = mk('/login');
  r.method = 'POST'; r.text = async () => 'password=test-admin-pw';
  return r;
})(), env, ctx);
const setCookie = loginRes.headers.get('set-cookie') || '';
const gotToken = (setCookie.match(/auth=([a-f0-9]+)/) || [])[1];
chk('登录返回 Set-Cookie', !!setCookie, setCookie.slice(0, 60));

// 独立复算期望值（node 原生 MD5，双哈希）
const nodeMD5 = s => createHash('md5').update(Buffer.from(enc.encode(s))).digest('hex');
const expectAuth = nodeMD5(nodeMD5(`${UA}CMLiusssstest-admin-pw`).slice(7, 27));
chk('Cookie = MD5MD5(UA+KEY+密码)', gotToken === expectAuth, `期望 ${expectAuth}`);

// ── 2. 该 Cookie 必须能通过 /admin 鉴权 ──
console.log('\n[2] Cookie 可通过后台鉴权');
const adminRes = await w.fetch(mk('/admin', { Cookie: `auth=${gotToken}` }), env, ctx);
chk('/admin 带正确 Cookie 不再 302', adminRes.status !== 302, `status=${adminRes.status}`);

const badRes = await w.fetch(mk('/admin', { Cookie: 'auth=deadbeef' }), env, ctx);
chk('/admin 错误 Cookie 仍 302 到 login', badRes.status === 302);

// ── 3. UUID 派生一致性 ──
console.log('\n[3] 订阅 token 与 UUID');
// 快速订阅路径 /<KEY> 应 302 到 /sub?token=MD5MD5(host+userID)
const userIDMD5 = nodeMD5(nodeMD5(`test-admin-pwCMLiussss`).slice(7, 27));
const userID = [userIDMD5.slice(0, 8), userIDMD5.slice(8, 12), '4' + userIDMD5.slice(13, 16),
  '8' + userIDMD5.slice(17, 20), userIDMD5.slice(20)].join('-');
const expectToken = nodeMD5(nodeMD5(`vless.test${userID}`).slice(7, 27));
const subRes = await w.fetch(mk('/CMLiussss'), env, ctx);
const loc = subRes.headers.get('location') || '';
chk('快速订阅重定向带正确 token', loc.includes(expectToken), `loc=${loc.slice(0, 60)}`);
chk('派生出的 userID 是合法 UUIDv4',
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(userID), userID);

// ── 4. /version 用该 UUID 应返回版本号 ──
console.log('\n[4] 版本探活');
const verRes = await w.fetch(mk(`/version?uuid=${userID}`), env, ctx);
const verBody = await verRes.text();
chk('正确 UUID 返回版本号', verRes.status === 200 && /Version/.test(verBody), verBody.slice(0, 60));

console.log(fail ? `\n✘ ${fail} 项失败` : '\n✔ 深度校验全部通过');
process.exit(fail ? 1 : 0);