/**
 * 页面外壳
 *
 * 只负责把 <head>/<body> 骨架与设计样式拼起来，不含具体内容。
 * 样式来自 assets.js 的 PANEL_CSS。
 */
import { PANEL_CSS } from './assets.js';

/**
 * 把 HTML 片段包成完整文档
 * @param {string} title 页面标题
 * @param {string} body  页面主体
 * @returns {string} 完整 HTML
 */
export function page(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>${PANEL_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}