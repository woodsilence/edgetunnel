/**
 * 本地预览服务器
 *
 * 用 Node http 承载打包后的 Worker，让管理面板在浏览器里跑真实接口，
 * 便于开发期目视检查 UI（file:// 下 fetch 会被 CORS 拦掉）。
 *
 * 与 gen-preview.mjs 共用 scripts/_harness.mjs 里的假 CF 环境；
 * 区别只在于本脚本的 KV 会真正落盘，因此保存配置、写入日志都是可验证的。
 *
 * 用法：node scripts/preview.mjs [端口]   默认 8791
 *       删掉 preview/_kv.json 即可清空演示数据
 */
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, DEMO, UA, COOKIE_HEADER, CTX, CF_INFO, DEMO_LOGS, DEMO_IPS, loadWorker } from './_harness.mjs';

const PORT = Number(process.argv[2]) || 8791;
const worker = await loadWorker();

/**
 * 演示用 KV：内存 Map + 落盘，保证「保存配置」刷新后仍在。
 * 若 put 是空实现，保存看似成功但刷新即丢，很容易误判成保存功能坏了。
 */
const KV_FILE = join(ROOT, 'preview', '_kv.json');

function loadKV() {
  const mem = new Map();
  try {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(KV_FILE, 'utf8')))) mem.set(k, v);
  } catch {
    // 首次运行没有缓存文件，属于正常情况
  }
  // 仅在缺失时播种，已有数据不覆盖，免得重启就丢掉刚保存的配置
  if (!mem.has('log.json')) mem.set('log.json', JSON.stringify(DEMO_LOGS));
  if (!mem.has('ADD.txt')) mem.set('ADD.txt', DEMO_IPS);
  return mem;
}

const mem = loadKV();
const persist = () => {
  try { writeFileSync(KV_FILE, JSON.stringify(Object.fromEntries(mem), null, 2)); } catch { }
};

const KV = {
  async get(k) { return mem.has(k) ? mem.get(k) : null; },
  async put(k, v) { mem.set(k, v); persist(); },
  async delete(k) { mem.delete(k); persist(); },
  async list() { return { keys: [...mem.keys()].map(name => ({ name })) }; },
};

const env = { ADMIN: DEMO.ADMIN, KEY: DEMO.KEY, UUID: DEMO.UUID, HOST: DEMO.HOST, KV };

/** 把 Node 的 req 头转成 Headers，并强制覆盖预览环境关心的两项 */
function toHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(nodeHeaders)) {
    if (Array.isArray(v)) v.forEach(x => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  headers.set('User-Agent', UA);
  // 自动注入合法 Cookie，省去手工登录
  headers.set('Cookie', COOKIE_HEADER);
  return headers;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }

  const fake = {
    // 必须用 https：Worker 对 http: 请求会一律 301 跳到 https（见 index.js 的
    // url.protocol === 'http:' 分支），本地明文预览会被重定向到无法访问的地址。
    url: 'https://localhost' + url.pathname + url.search,
    method: req.method,
    cf: { ...CF_INFO },
    headers: toHeaders(req.headers),
    body,
    redirect: 'manual',
    async text() { return body ? body.toString('utf8') : ''; },
    async json() { return body ? JSON.parse(body.toString('utf8')) : {}; },
  };

  try {
    const out = await worker.fetch(fake, env, CTX);
    const buf = Buffer.from(await out.arrayBuffer());
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(buf);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('预览服务器错误: ' + e.stack);
  }
});

mkdirSync(join(ROOT, 'preview'), { recursive: true });
server.listen(PORT, () => {
  console.log(`预览服务已启动：http://localhost:${PORT}/admin`);
  console.log(`  管理员密码 ${DEMO.ADMIN} / KEY ${DEMO.KEY}（已自动注入 Cookie，无需登录）`);
  console.log(`  清空数据：删除 ${KV_FILE}`);
});