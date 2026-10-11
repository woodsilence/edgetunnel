/**
 * 主程序入口 —— 请求分发器
 *
 * edgetunnel 的唯一 Worker 入口。职责：解析环境变量 → 派生鉴权凭据 →
 * 按请求特征分派到传输层 / 管理面板 / 伪装页。
 *
 * ── 分发顺序（短路判断，命中即返回）─────────────────────────────
 *   1. `/version`                        版本探活（用 UUID 前后段做轻量校验）
 *   2. `Upgrade: websocket`              → 传输层 处理WS请求
 *   3. POST 且非 admin/login             → 二级判别：
 *        命中叉HTTP padding 特征         → 处理叉HTTP请求
 *        content-type: application/grpc  → 处理gRPC请求
 *   4. 其余                              → 快速订阅 / 登录 / 管理面板 / 伪装页
 *
 * ── 鉴权模型 ──────────────────────────────────────────────────
 * 所有派生物都源自同一个种子：MD5MD5(管理员密码 + 加密秘钥)。
 *   - userID      客户端建连用的 UUID（VLESS/Trojan/SS 首包比对）
 *   - 订阅TOKEN    /sub 接口访问令牌（= MD5MD5(host + userID)）
 *   - auth Cookie 后台面板登录态（= MD5MD5(UA + 秘钥 + 密码)）
 * 因此修改 ADMIN 或 KEY 会同时轮换节点 UUID 与订阅地址；
 * 设置 UUID 环境变量则强制固定节点凭据。
 *
 * ── 共享状态 ──────────────────────────────────────────────────
 * 拆分模块后，跨文件的可变状态（调试开关、并发路数、SOCKS5 白名单等）
 * 统一收敛到 state.js。本方法开头按 env 算出本请求取值，
 * 再经 初始化共享状态() 一次性提交，语义与单体版完全一致。
 *
 * ── 部署形态 ──────────────────────────────────────────────────
 * 本模块经 esbuild 打包回单文件 _worker.js，以适配
 * 「粘贴进 CF Workers 编辑器 / 上传 Pages 压缩包」的部署方式。
 */

import { 初始化共享状态, 缓存SOCKS5白名单, SOCKS5白名单, 调试日志打印, 预加载竞速拨号, 反代并发拨号数, TCP并发拨号数, config_JSON } from './state.js';
import { 特征码字典, Pages静态页面 } from './constants.js';
import { MD5MD5 } from './utils/bytes.js';
import { log, 整理成数组, 识别运营商 } from './common.js';
import { 处理WS请求 } from './transport/ws.js';
import { 处理gRPC请求 } from './transport/grpc.js';
import { 处理叉HTTP请求, 获取叉HTTPPadding标识 } from './transport/xhttp.js';
import { 反代参数获取, 获取SOCKS5账号, 获取代理默认端口 } from './proxy-config.js';
import { nginx, html1101, getCloudflareUsage } from './web.js';
import { 创建请求TCP连接器 } from './outbound/forward.js';
import { TlsClient } from './net/tls.js';
import { 读取config_JSON, 请求日志记录 } from './subscription.js';

/**
 * 读取配置并发布到共享状态。
 *
 * 拆分模块后 config_JSON 来自 state.js 的实时绑定，不能直接赋值；
 * 这里把「读取 + 发布」收敛成一步，调用点保持简洁。
 */
async function 载入配置(env, host, userID, UA, 重置配置 = false) {
	初始化共享状态({ config_JSON: await 读取config_JSON(env, host, userID, UA, 重置配置) });
	return config_JSON;
}

export default {
/*__ENTRY_BODY__*/
};