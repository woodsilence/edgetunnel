/**
 * TCP 连接世代管理
 *
 * `remoteConnWrapper` 上带一个 generation 计数：每次重拨都会 +1，
 * 用来作废上一代 socket 与下行流的回调，避免旧连接回来时写进新连接的流。
 *
 * 这三个函数原先住在 `transport/xhttp.js`，但 ws / grpc / proxies / turn /
 * trojan / speedtest 全都要引它们，造成「高层模块依赖传输层」的倒挂依赖，
 * 是全项目循环依赖的主要来源。此处独立成与传输层无关的基础设施模块。
 *
 * `有效数据长度` 兼容 ArrayBuffer / TypedArray / Array 三种入参，
 * 因为上游读到的分片类型并不统一。
 */

function 有效数据长度(data) {
	if (!data) return 0;
	if (typeof data.byteLength === 'number') return data.byteLength;
	if (typeof data.length === 'number') return data.length;
	return 0;
}

function 失效TCP连接世代(remoteConnWrapper) {
	if (!remoteConnWrapper) return;
	remoteConnWrapper.generation = (Number.isInteger(remoteConnWrapper.generation) ? remoteConnWrapper.generation : 0) + 1;
	const socket = remoteConnWrapper.socket;
	remoteConnWrapper.socket = null;
	remoteConnWrapper.downlinkController = null;
	remoteConnWrapper.downlinkDrain = Promise.resolve();
	try { socket?.close?.() } catch (e) { }
}

function 开始TCP连接世代(remoteConnWrapper) {
	if (!Number.isInteger(remoteConnWrapper.generation)) remoteConnWrapper.generation = 0;
	const generation = ++remoteConnWrapper.generation;
	const previousSocket = remoteConnWrapper.socket;
	remoteConnWrapper.socket = null;
	const previousDownlink = remoteConnWrapper.downlinkController;
	remoteConnWrapper.downlinkController = null;
	const previousDrain = remoteConnWrapper.downlinkDrain || Promise.resolve();
	let currentDrain;
	try { currentDrain = previousDownlink?.停止并刷新?.() || Promise.resolve() }
	catch (error) { currentDrain = Promise.reject(error) }
	const downlinkDrain = Promise.all([previousDrain, currentDrain]);
	// Installation awaits this promise; attach a handler immediately in case draining fails before dialing completes.
	downlinkDrain.catch(() => { });
	remoteConnWrapper.downlinkDrain = downlinkDrain;
	try { previousSocket?.close?.() } catch (e) { }
	return { generation, downlinkDrain };
}

export { 有效数据长度, 失效TCP连接世代, 开始TCP连接世代 };
