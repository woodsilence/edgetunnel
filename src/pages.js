/**
 * 页面出口
 *
 * 统一把内置 HTML 以 Response 返回，并附上「禁止缓存」的响应头
 * （管理页与登录态相关，不能被 CDN 或浏览器缓存）。
 */
import { LOGIN_HTML } from './pages/login.js';
import { ADMIN_HTML } from './pages/admin.js';
import { NO_ADMIN_HTML, NO_KV_HTML } from './pages/errors.js';

/** 不缓存响应头：后台内容绝不能被中间层留存 */
const NO_STORE = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  // 基础安全头：面板含敏感配置，禁止被内嵌到第三方页面
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
};

const html = (markup) => new Response(markup, { status: 200, headers: NO_STORE });

export const 登录页 = () => html(LOGIN_HTML);
export const 管理面板 = (url) => html(ADMIN_HTML);
export const 未配置密码页 = () => new Response(NO_ADMIN_HTML, { status: 404, headers: NO_STORE });
export const 未绑定KV页 = () => new Response(NO_KV_HTML, { status: 404, headers: NO_STORE });