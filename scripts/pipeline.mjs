#!/usr/bin/env node
/**
 * 一键流水线：从单体版重建整个 src/ 并打包
 *
 *   extract.mjs           识别 180 个顶层声明及其行区间
 *   plan-modules.mjs      校验模块划分是否覆盖全部声明
 *   generate-modules.mjs  切片生成 src/**.js（含文档头与自动 import/export）
 *   gen-entry.mjs         切出 fetch() 方法体
 *   assemble-index.mjs    装配入口（共享状态改走 state.js）
 *   postprocess.cjs       修补可变状态/局部别名/index import
 *   build.mjs             esbuild 打包回 _worker.js
 *
 * 用法：node scripts/pipeline.mjs [--check]
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const steps = [
  'extract.mjs',
  'plan-modules.mjs',
  'generate-modules.mjs',
  'gen-entry.mjs',
  'assemble-index.mjs',
  'postprocess.cjs',
];

console.log('═══ edgetunnel 构建流水线 ═══\n');

for (const s of steps) {
  process.stdout.write(`▶ ${s}\n`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', s)], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.stdout) process.stdout.write(r.stdout.split('\n').map(l => '  ' + l).join('\n'));
  if (r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr);
    console.error(`\n✘ ${s} 失败`);
    process.exit(1);
  }
}

// 补一步：把 clean entry-body 重新切出（gen-entry 会写入改写版，这里确保是干净版）
console.log('\n▶ build.mjs');
const args = [join(ROOT, 'scripts', 'build.mjs')];
if (check) args.push('--check');
const b = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (b.stdout) process.stdout.write(b.stdout.split('\n').map(l => '  ' + l).join('\n'));
if (b.stderr) process.stderr.write(b.stderr);
if (b.status !== 0) { console.error('\n✘ 构建失败'); process.exit(1); }

console.log('\n═══ 完成 ═══');