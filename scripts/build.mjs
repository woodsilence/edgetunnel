/**
 * 构建：把 src/ 打包回单文件 _worker.js
 *
 * 产物必须与 ref/monolith.js 行为一致 —— 用 test/snapshot.mjs 比对。
 * 保持单文件产物的目的：兼容「粘贴进 CF Workers 编辑器」与「上传 Pages 压缩包」
 * 两种官方部署方式，二者都要求入口是一个 _worker.js。
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

await build({
  entryPoints: [join(ROOT, 'src', 'index.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  outfile: join(ROOT, 'ref', 'bundle.js'),
  legalComments: 'none',
  banner: {
    js: '/* edgetunnel —— 本文件由 src/ 源码经 esbuild 自动生成，请勿直接编辑。\n * 源码入口：src/index.js　构建：npm run build　校验：npm run check */',
  },
  logLevel: 'warning',
});

const bundled = readFileSync(join(ROOT, 'ref', 'bundle.js'), 'utf8');
if (!check) {
  writeFileSync(join(ROOT, '_worker.js'), bundled);
  console.log('✔ 已写入 _worker.js');
}
console.log(`  产物大小: ${(bundled.length / 1024).toFixed(1)} KB`);
console.log(`  单体版:   ${(readFileSync(join(ROOT, 'ref', 'monolith.js'), 'utf8').length / 1024).toFixed(1)} KB`);