/**
 * 本地预览服务器
 *
 * 用 Node http 承载打包后的 Worker，让管理面板在浏览器里跑真实接口，
 * 便于开发期目视检查 UI（file:// 下 fetch 会被 CORS 拦掉）。
 *
 * 用法：node scripts/preview.mjs [端口]   默认 8791
 */
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8791;

const tmp = join(ROOT, 'test', '_preview-worker.mjs');
writeFileSync(tmp, readFileSync(join(ROOT, '_worker.js'), 'utf8'));
const worker = (await import(pathToFileURL(tmp).href)).default;

const ADMIN = 'demo-pass', KEY = 'demo-key';
const UUID = '90cd4a77-141a-43c9-991b-08263cfe9c10';
const HOST = 'vless.example.com';

const enc = new TextEncoder();
const nodeMD5 = s => createHash('md5').update(Buffer.from(enc.encode(s))).digest('hex');
const authCookie = nodeMD5(nodeMD5(`${'Mozilla/5.0'}${KEY}${ADMIN}`).slice(7, 27));

// 演示用 KV 内容
const DEMO_LOGS = JSON.stringify([
  { datetime: new Date(Date.now() - 120000).toISOString(), reqType: 'Get_SUB', ip: '203.0.113.7', ua: 'Clash/1.18.0', remarks: '订阅拉取' },
  { datetime: new Date(Date.now() - 900000).toISOString(), reqType: 'Proxy', ip: '198.51.100.22', ua: 'v2rayN/6.23', remarks: '反代连接' },
  { datetime: new Date(Date.now() - 3600000).toISOString(), reqType: 'Admin_Login', ip: '203.0.113.7', ua: 'Mozilla/5.0', remarks: '面板登录' },
]);
const DEMO_IPS = '1.1.1.1:443#Sydney\n8.8.8.8:443#Google\nhttps://cf.090227.xyz/sub';

const KV = {
  async get(k) {
    if (k === 'config.json') return null;               // 使用默认配置
    if (k === 'log.json') return DEMO_LOGS;
    if (k === 'ADD.txt') return DEMO_IPS;
    return null;
  },
  async put() { },
  async list() { return { keys: [] }; },
};

const env = { ADMIN, KEY, UUID, HOST, KV };
const ctx = { waitUntil() { } };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // 预览环境自动带上合法 Cookie，省去手工登录
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach(x => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  headers.set('User-Agent', 'Mozilla/5.0');
  headers.set('Cookie', `auth=${authCookie}`);

  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }

  const fake = {
    url: 'http://localhost' + url.pathname + url.search,
    method: req.method,
    cf: { colo: 'HKG', asn: 13335, country: 'HK' },
    headers, body, redirect: 'manual',
    async text() { return body ? body.toString('utf8') : ''; },
    async json() { return body ? JSON.parse(body.toString('utf8')) : {}; },
  };

  try {
    const out = await worker.fetch(fake, env, ctx);
    const buf = Buffer.from(await out.arrayBuffer());
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(buf);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('预览服务器错误: ' + e.stack);
  }
});

mkdirSync(join(ROOT, 'preview'), { recursive: true });
server.listen(PORT, () => {
  console.log(`预览服务已启动：http://localhost:${PORT}/admin`);
  console.log(`  管理员密码 ${ADMIN} / KEY ${KEY}（预览环境已自动注入 Cookie）`);
});