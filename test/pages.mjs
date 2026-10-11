/**
 * 内置页面校验：确认 /login、/admin、/noADMIN、/noKV 均由本地返回，
 * 且管理面板在合法 Cookie 下可正常渲染。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(ROOT, 'test', '_page.mjs');
writeFileSync(tmp, readFileSync(join(ROOT, '_worker.js'), 'utf8'));
const w = (await import(pathToFileURL(tmp).href)).default;

const enc = new TextEncoder();
const nodeMD5 = s => createHash('md5').update(Buffer.from(enc.encode(s))).digest('hex');
const md5md5 = s => nodeMD5(nodeMD5(s).slice(7, 27));

const ADMIN = 'pw', KEY = 'K', UA = 'PageTest/1.0';
const authCookie = md5md5(`${UA}${KEY}${ADMIN}`);

let fail = 0;
const chk = (label, ok, extra = '') => {
  if (!ok) fail++;
  console.log(`  ${ok ? '✔' : '✘'} ${label}${extra ? '  ' + extra : ''}`);
};

const KV = { async get(k) { return k === 'log.json' ? '[]' : null; }, async put() { }, async list() { return { keys: [] }; } };
const ctx = { waitUntil() { } };
const mk = (p, h = {}, env = {}) => ({
  url: `https://x.test${p}`, method: 'GET', cf: { colo: 'T' },
  headers: new Headers({ 'User-Agent': UA, ...h }),
  redirect: 'manual', async text() { return ''; }, async json() { return {}; },
});
const full = { ADMIN, KEY, KV };

console.log('\n[1] 登录页');
const login = await w.fetch(mk('/login'), full, ctx);
const loginBody = await login.text();
chk('/login 返回 200', login.status === 200);
chk('由本地提供（不含 GitHub 头）', !(login.headers.get('server') || '').match(/GitHub/i));
chk('含 no-store', /no-store/.test(login.headers.get('cache-control') || ''));
chk('含 X-Frame-Options', login.headers.get('x-frame-options') === 'SAMEORIGIN');
chk('含 nosniff', login.headers.get('x-content-type-options') === 'nosniff');
chk('含登录表单', /id="pw"/.test(loginBody) && /type="password"/.test(loginBody));
chk('标题正确', /管理登录/.test(loginBody));

console.log('\n[2] 管理面板鉴权');
const noCookie = await w.fetch(mk('/admin'), full, ctx);
chk('无 Cookie → 302 跳登录', noCookie.status === 302);

const badCookie = await w.fetch(mk('/admin', { Cookie: 'auth=deadbeef' }), full, ctx);
chk('错误 Cookie → 302', badCookie.status === 302);

const okAdmin = await w.fetch(mk('/admin', { Cookie: `auth=${authCookie}` }), full, ctx);
const adminBody = await okAdmin.text();
chk('正确 Cookie → 200', okAdmin.status === 200);
chk('由本地提供（不含 GitHub 头）', !(okAdmin.headers.get('server') || '').match(/GitHub/i));
chk('含概览标签页', /data-panel="overview"/.test(adminBody));
chk('含基础配置表单', /id="c-host"/.test(adminBody) && /id="c-uuid"/.test(adminBody));
chk('含订阅标签页', /data-panel="subscribe"/.test(adminBody));
chk('含优选与代理标签页', /data-panel="proxy"/.test(adminBody));
chk('含日志标签页', /data-panel="logs"/.test(adminBody));
chk('调用 config.json 接口', adminBody.includes('/admin/config.json'));
chk('调用 ADD.txt 接口', adminBody.includes('/admin/ADD.txt'));
chk('调用 log.json 接口', adminBody.includes('/admin/log.json'));
chk('调用代理检测接口', adminBody.includes('/admin/check'));
chk('调用优选 API 校验', adminBody.includes('/admin/getADDAPI'));
chk('支持暗色模式', /prefers-color-scheme/.test(adminBody));

console.log('\n[3] 未配置 / 未绑定提示页');
// 注意：管理员密码的取值链包含 env.KEY（上游既有行为），
// 因此要触发「未配置密码」分支，必须给一个完全不含任何口令类变量的 env。
const noPwd = await w.fetch(mk('/anything'), { DEBUG: '1' }, ctx);
const noPwdBody = await noPwd.text();
chk('无任何口令变量 → 404', noPwd.status === 404);
chk('提示页说明如何配置 ADMIN', /ADMIN/.test(noPwdBody) && /变量名/.test(noPwdBody));

const noKV = await w.fetch(mk('/anything'), { ADMIN, KEY }, ctx);
const noKVBody = await noKV.text();
chk('有口令但无 KV → 404', noKV.status === 404);
chk('提示页说明如何绑定 KV', /KV Namespace/.test(noKVBody));

console.log(fail ? `\n✘ ${fail} 项失败` : '\n✔ 内置页面全部校验通过');
process.exit(fail ? 1 : 0);