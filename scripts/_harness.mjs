/**
 * 预览 / 调试共用的测试脚手架
 *
 * gen-preview.mjs（产出静态 HTML）与 preview.mjs（起本地 http 服务）
 * 需要同一套「假 CF 环境」：一致的 ADMIN/UUID、同一套鉴权 Cookie 算法、
 * 同样的请求对象构造。这份东西集中在这里，两边不再各抄一份。
 *
 * 本模块只服务于开发期预览，不参与 _worker.js 的打包。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 预览环境固定使用这组凭据，两处必须一致，否则 Cookie 算不出来 */
export const DEMO = {
  ADMIN: 'demo-pass',
  KEY: 'demo-key',
  UUID: '90cd4a77-141a-43c9-991b-08263cfe9c10',
  HOST: 'vless.example.com',
};

export const DEMO_LOGS = [
  { datetime: new Date(Date.now() - 120000).toISOString(), reqType: 'Get_SUB', ip: '203.0.113.7', ua: 'Clash/1.18.0', remarks: '订阅拉取' },
  { datetime: new Date(Date.now() - 900000).toISOString(), reqType: 'Proxy', ip: '198.51.100.22', ua: 'v2rayN/6.23', remarks: '反代连接' },
  { datetime: new Date(Date.now() - 3600000).toISOString(), reqType: 'Admin_Login', ip: '203.0.113.7', ua: 'Mozilla/5.0', remarks: '面板登录' },
  { datetime: new Date(Date.now() - 86400000).toISOString(), reqType: 'WS', ip: '192.0.2.55', ua: 'Shadowrocket/2.1', remarks: 'WebSocket 建连' },
];

export const DEMO_IPS =
  '1.1.1.1:443#Sydney\n8.8.8.8:443#Google\nhttps://cf.090227.xyz/sub\ncdn.example.net:8443#自建';

const enc = new TextEncoder();
const nodeMD5 = s => createHash('md5').update(Buffer.from(enc.encode(s))).digest('hex');

export const UA = 'Mozilla/5.0';

/** 面板鉴权 Cookie 的算法与 Worker 侧一致（MD5MD5），两边算出的值才能对上 */
export const AUTH_COOKIE = nodeMD5(nodeMD5(`${UA}${DEMO.KEY}${DEMO.ADMIN}`).slice(7, 27));

export const COOKIE_HEADER = `auth=${AUTH_COOKIE}`;

/**
 * 载入打包后的 Worker
 *
 * _worker.js 是 CommonJS/ESM 混用的产物，先落一份 .mjs 再动态 import，
 * 否则 Node 会按 .js 扩展名走 CJS 解析而失败。
 */
export async function loadWorker() {
  const tmp = join(ROOT, 'test', '_preview-worker.mjs');
  writeFileSync(tmp, readFileSync(join(ROOT, '_worker.js'), 'utf8'));
  return (await import(pathToFileURL(tmp).href)).default;
}

/**
 * 假的 request.cf
 *
 * city / asOrganization 一并给全，这样面板的「接入网络」与行内 title
 * 在预览里能走到完整形态，而不是只看到光秃秃的 AS 编号。
 */
export const CF_INFO = {
  colo: 'HKG',
  country: 'HK',
  city: 'Hong Kong',
  asn: 13335,
  asOrganization: 'Cloudflare, Inc.',
};

/** 构造一个够用的 Request 替身，覆盖面板与静态路由所需的字段 */
export function makeRequest(pathname, { headers = {}, method = 'GET', body = null } = {}) {
  return {
    url: 'https://' + DEMO.HOST + pathname,
    method,
    cf: { ...CF_INFO },
    headers: new Headers({ 'User-Agent': UA, ...headers }),
    body,
    redirect: 'manual',
    async text() { return body ? body.toString('utf8') : ''; },
    async json() { return body ? JSON.parse(body.toString('utf8')) : {}; },
  };
}

/** 空实现的 KV：仅供静态预览注入数据用（要真正落盘请用 preview.mjs） */
export function makeStaticKV() {
  const mem = new Map([
    ['log.json', JSON.stringify(DEMO_LOGS)],
    ['ADD.txt', DEMO_IPS],
  ]);
  return {
    async get(k) { return mem.has(k) ? mem.get(k) : null; },
    async put(k, v) { mem.set(k, v); },
    async list() { return { keys: [...mem.keys()].map(name => ({ name })) }; },
  };
}

/** 带合法 Cookie 的 env，供面板类接口直接调用 */
export function makeEnv(kv = makeStaticKV()) {
  return { ADMIN: DEMO.ADMIN, KEY: DEMO.KEY, UUID: DEMO.UUID, HOST: DEMO.HOST, KV: kv };
}

export const CTX = { waitUntil() { } };

/** 便捷方法：以正确 Cookie 请求面板类接口 */
export function adminFetch(worker, env, pathname, opts) {
  return worker.fetch(
    makeRequest(pathname, { ...opts, headers: { Cookie: COOKIE_HEADER, ...(opts?.headers || {}) } }),
    env,
    CTX
  );
}

export { ROOT };