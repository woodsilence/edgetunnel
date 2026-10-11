/**
 * 跨模块共享的运行期状态
 *
 * 背景：单体版本里这些是文件顶部的 `let`，由 fetch() 在每次请求开始时写入，
 * 被传输层 / 出站层 / 订阅层跨文件读取。拆分为 ES module 后，
 * `export let` 保持**实时绑定**——导入方读到的始终是最新值，
 * 与单体版的读写语义完全一致，无需 setter/getter 样板。
 *
 * 安全性：Cloudflare Workers 每个 isolate 实例服务于若干请求，
 * 这些值在同一 isolate 内由 env 决定（同环境），不存在跨用户串号问题；
 * 这与单体版的共享语义相同，未引入新的并发风险。
 */

/** 当前生效的配置对象（来自 KV config.json，或由默认值 + env 覆写而来） */
export let config_JSON;

/** 是否输出调试日志（DEBUG 环境变量控制，默认关闭） */
export let 调试日志打印 = false;

/** 预加载竞速拨号：先用 DoH 解析目标域名再并发拨号（默认关闭） */
export let 预加载竞速拨号 = false;

/** 直连目标的并发拨号路数（默认 2；中国移动网络自动降为 1） */
export let TCP并发拨号数 = 2;

/** 反代 IP 的并发拨号路数（默认 1） */
export let 反代并发拨号数 = 1;

/** SOCKS5 白名单缓存：避免每次请求重复解析 GO2SOCKS5 环境变量 */
export let 缓存SOCKS5白名单 = null;

/** SOCKS5 白名单（默认内置若干 CDN 域名，可由 GO2SOCKS5 环境变量追加） */
export let SOCKS5白名单 = [
  '*tapecontent.net', '*cloudatacdn.com', '*loadshare.org',
  '*cdn-centaurus.com', 'scholar.google.com',
];

/**
 * 批量写入共享状态。
 * fetch() 在解析完 env 后调用一次，把入口计算出的值一次性写入本模块，
 * 避免赋值语句散落在各模块中。
 *
 * @param {{config_JSON?: any, 调试日志打印?: boolean, 预加载竞速拨号?: boolean,
 *          TCP并发拨号数?: number, 反代并发拨号数?: number,
 *          缓存SOCKS5白名单?: any, SOCKS5白名单?: string[]}} 值
 */
export function 初始化共享状态(值 = {}) {
  if ('config_JSON' in 值) config_JSON = 值.config_JSON;
  if ('调试日志打印' in 值) 调试日志打印 = 值.调试日志打印;
  if ('预加载竞速拨号' in 值) 预加载竞速拨号 = 值.预加载竞速拨号;
  if ('TCP并发拨号数' in 值) TCP并发拨号数 = 值.TCP并发拨号数;
  if ('反代并发拨号数' in 值) 反代并发拨号数 = 值.反代并发拨号数;
  if ('缓存SOCKS5白名单' in 值) 缓存SOCKS5白名单 = 值.缓存SOCKS5白名单;
  if ('SOCKS5白名单' in 值) SOCKS5白名单 = 值.SOCKS5白名单;
}