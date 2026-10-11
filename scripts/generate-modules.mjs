/**
 * 模块生成器
 *
 * 读取 ref/modules.json 的划分方案，把单体切片写入 src/**.js，并自动推导
 * 每个模块的 import / export：
 *   - 该模块定义的顶层符号 → export（供其它模块引用）
 *   - 该模块引用但未定义的符号 → 从其归属模块 import
 *   - \`export default\` 单独留在 src/index.js 作为入口
 *
 * 变量声明（const/let）为满足 ESM 链接规则统一导出；
 * 跨模块读取的是"实时绑定"，赋值行为与单体版完全一致。
 *
 * 运行：node scripts/generate-modules.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = JSON.parse(readFileSync(join(ROOT, 'ref', 'modules.json'), 'utf8'));
const decls = JSON.parse(readFileSync(join(ROOT, 'ref', 'decls.json'), 'utf8'));
const L = readFileSync(join(ROOT, 'ref', 'monolith.js'), 'utf8').split(/\r?\n/);

const slice = (a, b) => {
  const out = L.slice(a - 1, b);
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
};

/** 符号 → 归属模块 */
const owner = new Map();
for (const m of MODULES) {
  for (const [a, b] of m.ranges) {
    for (const d of decls) {
      if (d.start >= a && d.end <= b && d.name) owner.set(d.name, m);
    }
  }
}

const entry = decls.find(d => d.kind === 'default');
// 入口对象里引用到的所有外部符号也要 import
const entryDecl = entry;

const RESERVED = new Set([
  'WebSocketPair', 'Response', 'Request', 'Headers', 'URL', 'TextEncoder', 'TextDecoder',
  'ReadableStream', 'WritableStream', 'TransformStream', 'IdentityTransformStream',
  'Uint8Array', 'ArrayBuffer', 'DataView', 'Map', 'Set', 'Promise', 'Math', 'JSON',
  'crypto', 'performance', 'console', 'fetch', 'setTimeout', 'clearTimeout', 'Date', 'Error',
  'FormData', 'WebSocket', 'Proxy', 'Buffer', 'atob', 'btoa', 'String', 'Number', 'Object',
  'Array', 'Boolean', 'RegExp', 'Symbol', 'globalThis', 'structuredClone', 'AbortController',
  'DataView', 'Intl', 'isNaN', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'URLSearchParams', 'BigInt', 'Int8Array', 'Uint16Array', 'Uint32Array', 'Int32Array',
  'Float32Array', 'Float64Array', 'queueMicrotask',
]);

/** 收集一个代码片段里引用到的所有已知符号 */
function referenced(text) {
  const found = new Set();
  for (const [name] of owner) {
    if (RESERVED.has(name)) continue;
    // 中文标识符直接子串匹配即可；英文符号用词边界更严谨
    if (/[一-龥]/.test(name)) {
      if (text.includes(name)) found.add(name);
    } else {
      if (new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).test(text)) found.add(name);
    }
  }
  return found;
}

/**
 * 额外归属：单体版里一行 `let a, b, c` 会声明多个变量，
 * 而顶层声明提取器只记录了首个名字。这些"多变量声明"中的其余名字
 * 在模块化后统一由 state.js 持有（可变状态收敛处）。
 */
const MULTI_DECL_OWNERS = new Map([
  ['调试日志打印', 'src/state.js'],
  ['缓存SOCKS5白名单', 'src/state.js'],
  ['SOCKS5白名单', 'src/state.js'],
  ['TCP并发拨号数', 'src/state.js'],
  ['反代并发拨号数', 'src/state.js'],
  ['预加载竞速拨号', 'src/state.js'],
]);
for (const [n, f] of MULTI_DECL_OWNERS) owner.set(n, { id: 'state', file: f });

let generated = 0;
const manifest = [];

for (const m of MODULES) {
  const bodyParts = [];
  for (const [a, b] of m.ranges) bodyParts.push(slice(a, b));
  const body = bodyParts.join('\n\n');

  // 本模块定义的符号
  const defined = [];
  for (const [a, b] of m.ranges) {
    for (const d of decls) if (d.start >= a && d.end <= b && d.name) defined.push(d.name);
  }

  // 本模块引用但非自己定义的符号 → 需要 import
  const needs = [...referenced(body)].filter(n => !defined.includes(n));

  // 按归属模块分组
  const importsBy = new Map();
  for (const n of needs) {
    const o = owner.get(n);
    if (!o) continue;
    if (!importsBy.has(o.id)) importsBy.set(o.id, { mod: o, names: [] });
    importsBy.get(o.id).names.push(n);
  }

  // 生成 import 语句（相对路径）
  const importLines = [];
  for (const { mod, names } of importsBy.values()) {
    const rel = './' + relative(dirname(m.file), mod.file).replace(/\\/g, '/');
    importLines.push(`import { ${names.join(', ')} } from '${rel}';`);
  }

  // 生成 export 语句
  const exportLines = [];
  const consts = defined.filter(n => {
    const d = decls.find(x => x.name === n);
    return d && (d.kind === 'const' || d.kind === 'let');
  });
  const funcs = defined.filter(n => {
    const d = decls.find(x => x.name === n);
    return d && d.kind !== 'const' && d.kind !== 'let';
  });
  if (consts.length) exportLines.push(`export { ${consts.join(', ')} };`);
  if (funcs.length) exportLines.push(`export { ${funcs.join(', ')} };`);

  const content = [
    `/**`,
    ...m.doc.split('\n').map(l => ` * ${l}`.trimEnd()),
    ` *`,
    ` * ── 本模块导出 ${defined.length} 个符号，依赖 ${importsBy.size} 个内部模块 ──`,
    ` */`,
    '',
    ...importLines,
    ...(importLines.length ? [''] : []),
    body,
    '',
    ...exportLines,
    '',
  ].join('\n');

  const p = join(ROOT, m.file);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  generated++;
  manifest.push({ file: m.file, defines: defined.length, imports: importsBy.size, id: m.id });
}

console.log(`已生成 ${generated} 个模块:\n`);
for (const x of manifest) {
  console.log(`  ${x.file.padEnd(32)} 定义 ${String(x.defines).padStart(3)}  依赖 ${x.imports} 模块  [${x.id}]`);
}
writeFileSync(join(ROOT, 'ref', 'manifest.json'), JSON.stringify(manifest, null, 2));