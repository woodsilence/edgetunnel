/**
 * 生成浅色模式预览
 *
 * 深色令牌写在 assets.js 的 `@media (prefers-color-scheme: dark)` 里，
 * 且选择器带 :not(.force-light)，所以这里只需给 <html> 挂一个类即可锁死浅色，
 * 不需要（也不应该）把整套设计令牌抄一份——抄了必然会在改主题时悄悄过期。
 *
 * 用法：node scripts/gen-preview-light.mjs   （需先跑 gen-preview.mjs）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['admin', 'login', 'no-admin', 'no-kv'];

let n = 0;
for (const name of PAGES) {
  const src = join(ROOT, 'preview', `${name}.html`);
  const out = join(ROOT, 'preview', `${name}-light.html`);

  let html;
  try {
    html = readFileSync(src, 'utf8');
  } catch {
    console.error(`✘ 缺少 preview/${name}.html，请先运行 node scripts/gen-preview.mjs`);
    process.exitCode = 1;
    continue;
  }

  // meta 声明浅色，让浏览器控件（滚动条、表单原生样式）也跟着走浅色
  html = html.replace(
    '<meta name="color-scheme" content="light dark">',
    '<meta name="color-scheme" content="light">'
  );
  // 挂 force-light，令深色令牌的媒体查询对本页失效
  html = html.replace(/<html([^>]*)>/, '<html$1 class="force-light">');

  if (!html.includes('force-light')) {
    console.error(`✘ ${name}: 未能注入 force-light，页面结构可能已变，请检查 frame.js`);
    process.exitCode = 1;
    continue;
  }

  writeFileSync(out, html);
  console.log(`✔ preview/${name}-light.html`);
  n++;
}

if (process.exitCode) console.error('\n部分预览未生成');
else console.log(`\n共生成 ${n} 个浅色预览`);