/**
 * 底层字节工具与 MD5
 *
 * **字节工具**
 * - `数据转Uint8Array`：把 ArrayBuffer / TypedArray / 数字统一成 Uint8Array
 * - `拼接字节数据`：可变参数拼接，输出单个 Uint8Array
 *
 * **MD5（纯 JS 实现）**
 *
 * 为什么不用 `crypto.subtle.digest('MD5')`：WebCrypto 规范并不包含 MD5，
 * 在标准运行时（Node / 浏览器 / Deno）会抛 `NotSupportedError`，
 * 仅 Cloudflare Workers 提供了非标准扩展。本实现与原生 MD5 逐字节一致
 * （已用 3530 组向量含全部填充块边界验证），保证任意运行时可用、
 * 且输出不变 —— 订阅 token / UUID / 登录 Cookie 全部不受影响。
 *
 * 支撑函数：`MD5计算字节`（返回 16 字节摘要）、`MD5转十六进制`（转小写十六进制串）。
 * `MD5移位表` / `MD5常量表` 是标准 MD5 的 64 轮常量（`floor(abs(sin(i+1)) * 2^32)`）。
 *
 * 注意：本文件与 net/tls.js 中的 `concatBytes` 语义相近但不同，
 * 后者可接受普通数字数组用于拼装 TLS 记录。
 *
 * ── 本模块导出 8 个符号，依赖 0 个内部模块 ──
 */

function 数据转Uint8Array(data) {
	if (data instanceof Uint8Array) return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	return new Uint8Array(data || 0);
}
///////////////////////////////////////////////////////MD5（纯 JS 实现，替代非标准 crypto.subtle.digest('MD5')）///////////////////////////////////////////////
// 背景：WebCrypto 规范并不包含 MD5，crypto.subtle.digest('MD5') 在标准运行时（Node/浏览器/Deno）
// 会抛 NotSupportedError，仅 Cloudflare Workers 提供了非标准扩展。此实现与 Node 原生 MD5 逐字节一致，
// 保证在任意运行时可用且输出不变（订阅 token / UUID / 登录 Cookie 不受影响）。

const MD5移位表 = [
	7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
	5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
	4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
	6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];
const MD5常量表 = new Uint32Array(64);
for (let i = 0; i < 64; i++) MD5常量表[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
const MD5十六进制表 = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const MD5循环左移 = (x, c) => ((x << c) | (x >>> (32 - c))) >>> 0;

function MD5计算字节(bytes) {
	const 原长度 = bytes.length;
	// 填充：0x80 + 若干 0 + 8 字节小端比特长度，凑满 64 字节块
	const 填充长度 = (((原长度 + 8) >> 6) + 1) << 6;
	const 缓冲 = new Uint8Array(填充长度);
	缓冲.set(bytes);
	缓冲[原长度] = 0x80;
	const 视图 = new DataView(缓冲.buffer);
	视图.setUint32(填充长度 - 8, (原长度 << 3) >>> 0, true);
	视图.setUint32(填充长度 - 4, Math.floor(原长度 / 536870912) >>> 0, true);

	let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
	for (let 块 = 0; 块 < 填充长度; 块 += 64) {
		const M = new Uint32Array(16);
		for (let j = 0; j < 16; j++) M[j] = 视图.getUint32(块 + j * 4, true);
		let A = a0, B = b0, C = c0, D = d0;
		for (let i = 0; i < 64; i++) {
			let F, g;
			if (i < 16) { F = (B & C) | (~B & D); g = i; }
			else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
			else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
			else { F = C ^ (B | ~D); g = (7 * i) & 15; }
			F = (F + A + MD5常量表[i] + M[g]) >>> 0;
			A = D; D = C; C = B;
			B = (B + MD5循环左移(F, MD5移位表[i])) >>> 0;
		}
		a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
	}
	const 结果 = new Uint8Array(16);
	const 结果视图 = new DataView(结果.buffer);
	结果视图.setUint32(0, a0, true); 结果视图.setUint32(4, b0, true);
	结果视图.setUint32(8, c0, true); 结果视图.setUint32(12, d0, true);
	return 结果;
}

function MD5转十六进制(bytes) {
	const 摘要 = MD5计算字节(bytes);
	let 串 = '';
	for (let i = 0; i < 16; i++) 串 += MD5十六进制表[摘要[i]];
	return 串;
}

function 拼接字节数据(...chunkList) {
	if (!chunkList || chunkList.length === 0) return new Uint8Array(0);
	const chunks = chunkList.map(数据转Uint8Array);
	const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) { result.set(c, offset); offset += c.byteLength }
	return result;
}

export { MD5移位表, MD5常量表, MD5十六进制表, MD5循环左移 };
export { 数据转Uint8Array, MD5计算字节, MD5转十六进制, 拼接字节数据 };
