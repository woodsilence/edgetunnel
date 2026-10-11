/**
 * 哈希派生
 *
 * `MD5MD5`：二次 MD5，派生订阅 token、客户端 UUID、登录 Cookie 三处凭据。
 *
 * 刻意与 `utils/bytes.js` 的 `MD5` 分开：后者是通用字节→十六进制原语，
 * 这里承载的是「怎么派生」的业务规则。二者语义不同，不要合并。
 *
 * 实现要点：WebCrypto 的 `crypto.subtle.digest` 按规范不含 MD5
 * （CF 运行时虽有非标准扩展，但不能依赖），故为纯 JS 实现，
 * 输出与 Node 原生 `crypto.createHash('md5')` 逐字节一致。
 */

import { MD5转十六进制 } from './bytes.js';

async function MD5MD5(文本) {
	const 编码器 = new TextEncoder();

	const 第一次十六进制 = MD5转十六进制(编码器.encode(文本));

	// 保持与历史实现完全一致：对第一次哈希取 [7,27) 共 20 个字符后再哈希
	const 第二次十六进制 = MD5转十六进制(编码器.encode(第一次十六进制.slice(7, 27)));

	return 第二次十六进制.toLowerCase();
}

export { MD5MD5 };
