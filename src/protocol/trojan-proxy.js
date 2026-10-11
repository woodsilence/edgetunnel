/**
 * Trojan over 反代（换 IP / 反代链路）
 *
 * 当目标地址是反代而非真实站点时，不能走普通 TCP 拨号，需要先把 Trojan 握手
 * 首包原样送到反代 IP 上，再由反代续接后面的流量。
 *
 * `连接木马反代` 只负责「拨号 + 写入首包」这一步，**TCP 连接器由调用方注入**
 * （`TCP连接` 参数），因此本模块不依赖 outbound 层——这正是它能从
 * `protocol/trojan.js` 独立出来、从而断开 trojan↔forward 循环依赖的前提。
 *
 * `提取木马反代握手数据` 用于剥掉首包尾部的真实负载，只留握手部分单独透传。
 */

import { stripIPv6Brackets } from './../net/addr.js';
import { 有效数据长度 } from './../net/tcp.js';
import { 数据转Uint8Array } from './../utils/bytes.js';

async function 连接木马反代(首包数据, TCP连接, 木马反代目标) {
	if (!木马反代目标) throw new Error('trojan fallback is not configured');
	const socket = TCP连接({ hostname: stripIPv6Brackets(木马反代目标.hostname), port: 木马反代目标.port });
	let writer = null;
	try {
		if (socket.opened) await socket.opened;
		if (有效数据长度(首包数据) > 0) {
			writer = socket.writable.getWriter();
			await writer.write(数据转Uint8Array(首包数据));
		}
		return socket;
	} catch (error) {
		try { socket?.close?.() } catch (e) { }
		throw error;
	} finally {
		try { writer?.releaseLock() } catch (e) { }
	}
}

function 提取木马反代握手数据(首包数据, rawData) {
	const 首包 = 数据转Uint8Array(首包数据);
	const payload = 数据转Uint8Array(rawData);
	if (!payload.byteLength) return 首包;
	const 握手长度 = 首包.byteLength - payload.byteLength;
	if (握手长度 <= 0) return 首包;
	for (let i = 0; i < payload.byteLength; i++) {
		if (首包[握手长度 + i] !== payload[i]) return 首包;
	}
	return 首包.subarray(0, 握手长度);
}

export { 连接木马反代, 提取木马反代握手数据 };
