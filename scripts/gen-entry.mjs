/**
 * 切出 fetch() 方法体（干净切片，不做任何改写）
 *
 * modify 由 assemble-index.mjs 负责：把共享状态的直接赋值改走 state.js。
 * 这里必须产出「未改写」版本，否则重复运行会产生二次改写。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const L = readFileSync(join(ROOT, 'ref', 'monolith.js'), 'utf8').split(/\r?\n/);

// export default { 位于第 17 行，方法体为 18..528 行（1-based）
const body = L.slice(17, 528).join('\n');
writeFileSync(join(ROOT, 'ref', 'entry-body.js'), body);
console.log('✔ 入口方法体已切出，行数:', body.split('\n').length);