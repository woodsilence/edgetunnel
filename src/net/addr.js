/**
 * 地址判定与连接超时
 *
 * 这几个函数原先定义在 `outbound/turn.js` 里，但与 TURN 协议并无关系，
 * 纯属就近定义。结果是 proxies / sstp / forward / trojan / index 为了用它们
 * 不得不依赖 outbound/turn.js，把 outbound 层内部拉成互相依赖。
 *
 * `CONNECT_TIMEOUT_MS` 原为 TURN 握手超时，实测对 TURN 与 SSTP 两条链路
 * 都能兜住，统一沿用该值；如需分开取值应先确认不会放宽兜底时机。
 */

function stripIPv6Brackets(hostname = '') {
	const host = String(hostname || '').trim();
	return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function isIPHostname(hostname = '') {
	const host = stripIPv6Brackets(hostname);
	const ipv4Regex = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
	if (ipv4Regex.test(host)) return true;
	if (!host.includes(':')) return false;
	try {
		new URL(`http://[${host}]/`);
		return true;
	} catch (e) {
		return false;
	}
}

export const CONNECT_TIMEOUT_MS = 9999;

async function withTimeout(promise, timeoutMs, message) {
	let timer;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs) })
		]);
	} finally {
		clearTimeout(timer);
	}
}

function isIPv4(value) {
	const parts = String(value || '').split('.');
	return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

export { stripIPv6Brackets, isIPHostname, isIPv4, withTimeout };
