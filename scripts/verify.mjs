/**
 * 行为一致性比对：monolith vs 模块化产物
 * 逐用例对比状态码、响应头、响应体哈希
 */
import { readFileSync } from 'node:fs';
const base = JSON.parse(readFileSync('ref/baseline.json', 'utf8'));
const cur = JSON.parse(readFileSync('ref/current.json', 'utf8'));

if (base.length !== cur.length) {
  console.log(`用例数不同: ${base.length} vs ${cur.length}`);
  process.exit(1);
}

/** 这些响应头来自真实网络请求（GitHub Pages），每次都会变化，与代码无关 */
const VOLATILE_HEADERS = new Set([
  'age', 'date', 'expires', 'etag', 'last-modified', 'x-fastly-request-id',
  'x-github-request-id', 'x-timer', 'x-cache', 'x-cache-hits', 'x-served-by',
  'via', 'x-proxy-cache', 'x-origin-cache', 'cache-control', 'connection',
]);

/** 过滤掉非确定性响应头后再比对 */
function stableHeaders(h) {
  const o = {};
  for (const [k, v] of Object.entries(h || {})) {
    if (!VOLATILE_HEADERS.has(k)) o[k] = v;
  }
  return o;
}

let diff = 0;
for (let i = 0; i < base.length; i++) {
  const a = base[i], b = cur[i];
  const fields = ['name', 'status', 'error', 'bodyLen', 'bodyHash'];
  const changed = fields.filter(f => String(a[f]) !== String(b[f]));
  const ha = JSON.stringify(stableHeaders(a.headers));
  const hb = JSON.stringify(stableHeaders(b.headers));
  const hdrDiff = ha !== hb;

  if (changed.length || hdrDiff) {
    diff++;
    console.log(`\n✘ ${a.name}`);
    for (const f of changed) {
      console.log(`    ${f}: ${JSON.stringify(a[f])}  →  ${JSON.stringify(b[f])}`);
    }
    if (hdrDiff) console.log(`    headers:\n      - ${ha}\n      + ${hb}`);
  }
}

console.log(`\n${base.length - diff}/${base.length} 用例一致`);
if (diff) {
  console.log('存在差异，需逐项确认是否为非确定性因素（如随机路径/时间戳）');
  process.exit(1);
}
console.log('✔ 行为完全一致');