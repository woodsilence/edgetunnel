/**
 * 生成浅色模式预览
 *
 * 预览文件注入 <meta name="color-scheme" content="light"> 并把 prefers-color-scheme
 * 查询强制为 light，方便在没有系统主题切换的环境里目视检查浅色版效果。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const name of ['admin', 'login', 'no-admin', 'no-kv']) {
  let html = readFileSync(join(ROOT, 'preview', `${name}.html`), 'utf8');
  // 强制浅色：覆盖 meta 并在样式末尾追加 light 变量块
  html = html.replace('<meta name="color-scheme" content="light dark">',
    '<meta name="color-scheme" content="light">');
  html = html.replace('</style>', `
/* 强制浅色预览 */
@media (prefers-color-scheme: dark) { html:not(.force-light) { color-scheme: light; } }
:root {
  --blue:#0071e3; --blue-hover:#0077ed; --blue-active:#006edb;
  --blue-soft:rgba(0,113,227,.10); --blue-soft-2:rgba(0,113,227,.16);
  --canvas:#fbfbfd; --surface:#ffffff; --surface-2:#f5f5f7; --surface-3:#eeeef0;
  --ink:#1d1d1f; --ink-2:#6e6e73; --ink-3:#86868b;
  --line:rgba(0,0,0,.08); --line-2:rgba(0,0,0,.05); --line-strong:rgba(0,0,0,.14);
  --green:#1d9a5b; --green-soft:rgba(29,154,91,.12);
  --orange:#b25000; --orange-soft:rgba(178,80,0,.12);
  --red:#d70015; --red-soft:rgba(215,0,21,.10);
  --shadow-sm:0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.05);
  --shadow-md:0 4px 12px rgba(0,0,0,.07), 0 16px 40px rgba(0,0,0,.09);
}
html { color-scheme: light; }
</style>`);
  writeFileSync(join(ROOT, 'preview', `${name}-light.html`), html);
  console.log(`✔ preview/${name}-light.html`);
}