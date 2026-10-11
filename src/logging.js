/**
 * 调试日志
 *
 * 全项目唯一的调试输出出口，受 `调试日志打印`（DEBUG 环境变量）开关控制。
 * 业务代码一律走 `log()`，不要直接用 `console.*`——裸 console 会在每次断连时刷屏。
 *
 * 真·运维错误（后台保存失败、CF 用量 API 失败等）才保留 console.error，
 * 那类需要无条件可见，不受 DEBUG 开关影响。
 *
 * `掩码敏感信息` 用于日志脱敏，避免把完整订阅地址、密钥写进日志。
 */

import { 调试日志打印 } from './state.js';

function log(...args) {
	if (调试日志打印) console.log(...args);
}

function 掩码敏感信息(文本, 前缀长度 = 3, 后缀长度 = 2) {
	if (!文本 || typeof 文本 !== 'string') return 文本;
	if (文本.length <= 前缀长度 + 后缀长度) return 文本; // 如果长度太短，直接返回

	const 前缀 = 文本.slice(0, 前缀长度);
	const 后缀 = 文本.slice(-后缀长度);
	const 星号数量 = 文本.length - 前缀长度 - 后缀长度;

	return `${前缀}${'*'.repeat(星号数量)}${后缀}`;
}

export { log, 掩码敏感信息 };
