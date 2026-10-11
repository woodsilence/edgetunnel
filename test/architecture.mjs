/**
 * 架构守卫
 *
 * 检查两件事：
 *   1. src/ 内不存在循环依赖
 *   2. 所有 import 路径都能解析到真实文件（拼错路径要能测出来）
 *
 * 这套测试存在的意义：循环依赖曾经有 135 条路径，靠人眼看不出来，
 * 也没有任何机制阻止它再长回来。清理之后必须有守卫，否则白做。
 *
 * 破环时若某个底层工具「就近定义」在高层模块里，就会立刻重新形成
 * 高层→低层的倒挂依赖并被本测试拦下。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

let failed = 0;
const chk = (name, ok, detail = '') => {
  console.log((ok ? '  ✔ ' : '  ✘ ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failed++;
};

// ── 收集文件 ──────────────────────────────────────────────
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.js')) files.push(p.split('\\').join('/'));
  }
})(SRC);
const set = new Set(files);

console.log('\n[1] import 路径可解析');
const graph = new Map();
const broken = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const deps = new Map();
  for (const m of src.matchAll(/from\s*['"](\.[^'"]+)['"]/g)) {
    let t = m[1];
    if (!t.endsWith('.js')) t += '.js';
    const abs = join(dirname(f), t).split('\\').join('/');
    if (!set.has(abs)) broken.push(f + ' → ' + m[1]);
    else deps.set(abs, m[0]);
  }
  graph.set(f, deps);
}
chk('无解析失败的 import', broken.length === 0, broken.join('; '));

// ── 环检测 ────────────────────────────────────────────────
console.log('\n[2] 无循环依赖');
const cycles = [];
const state = new Map();
function dfs(n, stack) {
  if (state.get(n) === 1) {
    cycles.push(stack.slice(stack.indexOf(n)).concat(n).join(' → '));
    return;
  }
  if (state.get(n) === 2) return;
  state.set(n, 1);
  stack.push(n);
  for (const dep of graph.get(n)?.keys() || []) dfs(dep, stack);
  stack.pop();
  state.set(n, 2);
}
for (const f of files) dfs(f, []);

const uniq = [...new Set(cycles.map(c => c.split(' → ').sort().join('|')))]
  .map(k => cycles.find(c => c.split(' → ').sort().join('|') === k));
chk('循环依赖数为 0', cycles.length === 0,
  uniq.length ? '\n      ' + uniq.join('\n      ') : `共 ${files.length} 个模块`);

if (failed) {
  console.error(`\n✘ 架构检查未通过（${failed} 项）`);
  process.exit(1);
}
console.log('\n✔ 架构检查全部通过');