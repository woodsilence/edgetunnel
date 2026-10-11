/**
 * 分层提取器
 *
 * 把单体 _worker.js 按「声明区间」切成若干职责模块：
 *  - 每个顶层声明（const/let/function/class/async function）连同其注释与区间被完整搬运；
 *  - 跨模块引用由 esbuild 在打包时自动解析（只补 import 做不到的 live-binding 场景）。
 *
 * 关键设计：为了让 esbuild 能正确处理，先把所有符号收集出来，
 * 再按模块生成显式 import/export。这样单文件产物与原版行为一致。
 *
 * 运行：node scripts/extract.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const L = readFileSync(join(ROOT, 'ref', 'monolith.js'), 'utf8').replace(/^﻿/, '').split(/\r?\n/);

/**
 * 找到所有顶层声明的 [start,end] 行号（1-based，end 闭合）。
 * 顶层 = 行首无空白，且以声明关键字开头，或 export default。
 */
function topLevelDecls() {
  const decls = [];
  let i = 0;
  while (i < L.length) {
    const line = L[i];
    const isDecl = /^(export default|const |let |function |async function |class )/.test(line) && !/^\s/.test(line);
    if (!isDecl) { i++; continue; }

    // 找到声明名
    let name = null;
    if (line.startsWith('export default')) {
      name = '__default__';
      // export default { ... } 可能跨行直到闭合大括号
      let depth = 0, end = i, started = false;
      for (let j = i; j < L.length; j++) {
        for (const ch of L[j]) {
          if (ch === '{') { depth++; started = true; }
          else if (ch === '}') depth--;
        }
        if (started && depth === 0) { end = j; break; }
        if (j === i && !L[j].includes('{')) { end = j; break; }
      }
      decls.push({ name, start: i + 1, end: end + 1, kind: 'default' });
      i = end + 1;
      continue;
    }

    const m = line.match(/^(?:const|let|function|async function|class)\s+([A-Za-z_$一-龥][\w$一-龥]*)/);
    name = m ? m[1] : null;

    // 声明结束：从本行起做括号深度追踪，遇到深度归零的 ';' 或 '}' 行结束
    let depth = 0, hasBracket = false, end = i;
    for (let j = i; j < L.length; j++) {
      const t = L[j];
      for (const ch of t) {
        if ('([{'.includes(ch)) { depth++; hasBracket = true; }
        else if (')]}'.includes(ch)) depth--;
      }
      if (hasBracket && depth <= 0) { end = j; break; }
      if (!hasBracket && /;\s*$/.test(t)) { end = j; break; }
      // 无括号且是函数声明头但下行为空 —— 单行定义结束
      if (!hasBracket && /^(?:const|let)\s/.test(t) && !t.trimEnd().endsWith(',') && j > i) {
        // 多行数组/对象字面量已由 hasBracket 处理；这里只兜底单行
        end = j; break;
      }
    }
    decls.push({ name, start: i + 1, end: end + 1, kind: line.split(/\s+/)[0] });
    i = end + 1;
  }
  return decls;
}

const decls = topLevelDecls();
console.log('识别到顶层声明:', decls.length);
console.log('未命名声明:', decls.filter(d => !d.name).length);

// 导出结果供后续使用
writeFileSync(join(ROOT, 'ref', 'decls.json'), JSON.stringify(decls, null, 2));

// 打印前若干以便核对
for (const d of decls.slice(0, 15)) console.log(String(d.start).padStart(5), String(d.end).padStart(5), d.kind.padEnd(18), d.name);