/**
 * 行为基线测试 —— 重构前后一致性验证
 *
 * 原理：把 _worker.js 当作 ES module 加载，用伪造的 request/env 调用 fetch()，
 * 捕获状态码、响应头、响应体字节，输出稳定的哈希快照。
 * 重构后（模块化 + 打包）再跑一次，两份快照必须完全一致。
 *
 * 用法：node test/snapshot.mjs <worker文件路径> <输出文件>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const workerPath = process.argv[2];
const outPath = process.argv[3];

// 复制为 .mjs 以便 Node 以 ES module 方式加载（Workers 源码即 ESM）
const tmp = join(dirname(fileURLToPath(import.meta.url)), '_load.mjs');
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, readFileSync(workerPath, 'utf8'));

const worker = (await import(pathToFileURL(tmp).href + '?t=' + Date.now())).default;

// ---- 环境桩 ----
const env = {
  ADMIN: 'test-admin-pw',
  KEY: 'CMLiussss',
  UUID: '',
  PROXYIP: '',
  URL: '',
  DEBUG: '',
  OFF_LOG: '',
  BEST_SUB: '',
  KV: {
    async get(k) {
      if (k === 'log.json') return '[]';
      if (k === 'config.json') return null;
      if (k === 'sub.json') return null;
      return null;
    },
    async put() { },
    async list() { return { keys: [] }; },
  },
};

function mkRequest(pathname, opts = {}) {
  const {
    method = 'GET', headers = {}, body = null, cf = { colo: 'TEST' },
  } = opts;
  const url = `https://vless.test${pathname}`;
  return {
    url, method, cf,
    headers: new Headers({ 'User-Agent': 'node-snapshot', ...headers }),
    body: body ? new ReadableStream({
      start(c) { c.enqueue(new Uint8Array(body)); c.close(); }
    }) : null,
    redirect: 'manual',
    async text() { return typeof body === 'string' ? body : ''; },
    async json() { return body ? JSON.parse(body) : {}; },
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
  };
}

const results = [];

/** 执行一个用例并记录结果 */
async function probe(name, pathname, opts) {
  const rec = { name, pathname };
  try {
    const res = await worker.fetch(mkRequest(pathname, opts), env, {});
    if (!res) { rec.result = 'NO_RESPONSE'; results.push(rec); return; }
    rec.status = res.status;
    const hdrs = {};
    for (const [k, v] of res.headers) hdrs[k.toLowerCase()] = v;
    rec.headers = hdrs;
    let buf;
    try { buf = new Uint8Array(await res.clone().arrayBuffer()); }
    catch { buf = new Uint8Array(0); }
    rec.bodyLen = buf.length;
    rec.bodyHash = createHash('sha256').update(buf).digest('hex').slice(0, 16);
    // 记录 body 前 120 字节的可读片段（便于诊断差异）
    try { rec.bodyPreview = new TextDecoder().decode(buf.slice(0, 120)); }
    catch { rec.bodyPreview = '<binary>'; }
  } catch (e) {
    rec.error = `${e.name}: ${e.message}`;
  }
  results.push(rec);
}

// ---- 用例集 ----
await probe('version-no-uuid', '/version');
await probe('version-bad-uuid', '/version?uuid=00000000-0000-4000-8000-000000000000');
await probe('login-get', '/login');
await probe('login-wrong-pw', '/login', { method: 'POST', body: 'password=wrong' });
await probe('login-right-pw', '/login', { method: 'POST', body: 'password=test-admin-pw' });
await probe('admin-no-cookie', '/admin');
await probe('admin-log-json', '/admin/log.json');
await probe('root', '/');
await probe('random-page', '/some-random-page');
await probe('sub-no-token', '/sub');
await probe('sub-bad-token', '/sub?token=deadbeef');
await probe('quick-sub-key', '/CMLiussss');
await probe('ws-upgrade', '/ws', { headers: { Upgrade: 'websocket' } });
await probe('post-xhttp', '/xhttp', { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: [1, 2, 3] });
await probe('post-grpc', '/grpc', { method: 'POST', headers: { 'content-type': 'application/grpc' }, body: [0] });

// 输出快照
const snap = JSON.stringify(results, null, 2);
writeFileSync(outPath, snap);
const digest = createHash('sha256').update(snap).digest('hex');
console.log(`快照已写入: ${outPath}`);
console.log(`用例数: ${results.length}`);
console.log(`快照 SHA256: ${digest}`);