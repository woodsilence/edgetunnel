/**
 * MD5 一致性回归：确认纯 JS MD5 仍与 Node 原生 MD5 逐字节一致
 * 覆盖两条被实际调用的路径：十六进制（订阅/UUID/Cookie）与原始字节（SS/TURN）
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, '_worker.js'), 'utf8');
const tmp = join(ROOT, 'test', '_md5.mjs');
writeFileSync(tmp, src);

const enc = new TextEncoder();

// 从打包产物中抽出 MD5 实现，验证与原生一致
// esbuild 会把非 ASCII 标识符转义为 \uXXXX，先解码再抽取
const decoded = src.replace(/\\u([0-9a-fA-F]{4})/g,
  (_, h) => String.fromCharCode(parseInt(h, 16)));

const primStart = decoded.indexOf('const MD5移位表 = [') >= 0
  ? decoded.indexOf('const MD5移位表 = [')
  : decoded.indexOf('var MD5移位表 = [');
const primEnd = decoded.indexOf('\n}', decoded.indexOf('function MD5转十六进制')) + 2;
if (primStart === -1 || primEnd < 2) {
  console.error('✘ 未在打包产物中定位到 MD5 实现');
  process.exit(1);
}
const prim = decoded.slice(primStart, primEnd);
const api = new Function('TextEncoder', prim + '\nreturn { MD5计算字节, MD5转十六进制 };')(TextEncoder);

const nodeHex = s => createHash('md5').update(Buffer.from(enc.encode(s))).digest('hex');
const nodeRaw = s => new Uint8Array(createHash('md5').update(Buffer.from(enc.encode(s))).digest());

let fail = 0, n = 0;
const chk = (label, ok) => { n++; if (!ok) { fail++; console.log('  ✘ ' + label); } };

// 十六进制路径
for (const s of ['', 'a', '123456', 'CMLiussss', 'adminKEY', 'x'.repeat(1000), '管理员密码KEY', '🔐emoji']) {
  chk(`hex:${s.slice(0, 16)}`, api.MD5转十六进制(enc.encode(s)) === nodeHex(s));
}
// 原始字节路径
for (const s of ['', 'secret', 'user:realm:pass', 'x'.repeat(64)]) {
  chk(`raw:${s.slice(0, 16)}`, Buffer.compare(Buffer.from(api.MD5计算字节(enc.encode(s))), Buffer.from(nodeRaw(s))) === 0);
}
// 边界长度（直接比较字节，避免 UTF-8 往返转换失真）
for (let i = 0; i <= 130; i++) {
  const b = new Uint8Array(randomBytes(i));
  const ref = new Uint8Array(createHash('md5').update(Buffer.from(b)).digest());
  chk(`boundary:${i}`, Buffer.compare(Buffer.from(api.MD5计算字节(b)), Buffer.from(ref)) === 0);
}

console.log(`${n - fail}/${n} 通过`);
if (fail) { console.log('✘ MD5 回归！'); process.exit(1); }
console.log('✔ 打包产物中的 MD5 与原生完全一致');