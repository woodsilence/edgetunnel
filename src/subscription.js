/**
 * 订阅生成与配置热补丁
 *
 * - `读取config_JSON`：从 KV 读取配置，缺项补默认值，env 优先级高于 KV
 * - `base64SecretEncode` / `base64SecretDecode`：用 userID 做密钥的
 *   base64+AES 混淆，用于在订阅里安全携带代理参数
 * - `Clash订阅配置文件热补丁` / `Singbox订阅配置文件热补丁` / `Surge订阅配置文件热补丁`：
 *   拉取上游订阅后，按客户端格式注入/改写节点、传输参数、DNS 策略、ECH 等
 * - `请求日志记录`：把订阅/代理请求写入 KV 供后台面板展示
 *
 * ── 本模块导出 13 个符号，依赖 5 个内部模块 ──
 */

import { config_JSON, 特征码字典 } from './constants.js';
import { SOCKS5白名单 } from './state.js';
import { 获取叉HTTPPadding标识 } from './transport/xhttp.js';
import { log, 掩码敏感信息 } from './logging.js';
import { MD5MD5 } from './utils/hash.js';
import { 随机路径 } from './paths.js';
import { 整理成数组 } from './net/ips.js';;
import { getCloudflareUsage } from './web.js';

function base64SecretEncode(plaintext, secret) {
	const encoder = new TextEncoder();
	const data = encoder.encode(plaintext);
	const key = encoder.encode(secret);
	const mixed = new Uint8Array(data.length);

	for (let i = 0; i < data.length; i++) {
		mixed[i] = data[i] ^ key[i % key.length];
	}

	// 将 Uint8Array 转换为可被 btoa 处理的字符串
	let binary = '';
	for (let i = 0; i < mixed.length; i++) {
		binary += String.fromCharCode(mixed[i]);
	}
	return btoa(binary);
}

/**
 * 带秘钥的 Base64 解码
 * @param {string} encoded - 经秘钥处理过的 Base64 字符串
 * @param {string} secret - 秘钥字符串（必须与编码时相同）
 * @returns {string} 解码后的原始明文字符串
 */
function base64SecretDecode(encoded, secret) {
	const binary = atob(encoded);
	const mixed = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		mixed[i] = binary.charCodeAt(i);
	}

	const encoder = new TextEncoder();
	const key = encoder.encode(secret);
	const data = new Uint8Array(mixed.length);

	for (let i = 0; i < mixed.length; i++) {
		data[i] = mixed[i] ^ key[i % key.length];
	}

	const decoder = new TextDecoder();
	return decoder.decode(data);
}

function 获取传输协议配置(配置 = {}) {
	const 是gRPC = 配置.传输协议 === 'grpc';
	const { 头: 本机Padding头, 键: 本机Padding键 } = 获取叉HTTPPadding标识(配置.UUID);
	const 叉混淆JSON = {
		"xPaddingObfsMode": true,
		"xPaddingMethod": "tokenish",
		"xPaddingPlacement": "queryInHeader",
		"xPaddingHeader": 本机Padding头,
		"xPaddingKey": 本机Padding键
	};
	return {
		type: 是gRPC ? (配置.gRPC模式 === 'multi' ? 'grpc&mode=multi' : 'grpc&mode=gun') : (配置.传输协议 === 'xhttp' ? `xhttp&mode=stream-one&extra=${encodeURIComponent(JSON.stringify(叉混淆JSON))}` : 'ws'),
		路径字段名: 是gRPC ? 'serviceName' : 'path',
		域名字段名: 是gRPC ? 'authority' : 'host'
	};
}

function 获取传输路径参数值(配置 = {}, 节点路径 = '/', 作为优选订阅生成器 = false) {
	const 路径值 = 作为优选订阅生成器 ? '/' : (配置.随机路径 ? 随机路径(节点路径) : 节点路径);
	if (配置.传输协议 !== 'grpc') return 路径值;
	return 路径值.split('?')[0] || '/';
}

function Clash订阅配置文件热补丁(Clash_原始订阅内容, config_JSON = {}) {
	const uuid = config_JSON?.UUID || null;
	const ECH启用 = Boolean(config_JSON?.ECH);
	const HOSTS = Array.isArray(config_JSON?.HOSTS) ? [...config_JSON.HOSTS] : [];
	const ECH_SNI = config_JSON?.ECHConfig?.SNI || null;
	const ECH_DNS = config_JSON?.ECHConfig?.DNS;
	const 需要处理ECH = Boolean(uuid && ECH启用);
	const gRPCUserAgent = (typeof config_JSON?.gRPCUserAgent === 'string' && config_JSON.gRPCUserAgent.trim()) ? config_JSON.gRPCUserAgent.trim() : null;
	const 需要处理gRPC = config_JSON?.传输协议 === "grpc" && Boolean(gRPCUserAgent);
	const gRPCUserAgentYAML = gRPCUserAgent ? JSON.stringify(gRPCUserAgent) : null;
	let clash_yaml = Clash_原始订阅内容.replace(/mode:\s*Rule\b/g, 'mode: rule');

	const baseDnsBlock = `dns:
  enable: true
  default-nameserver:
    - 223.5.5.5
    - 119.29.29.29
    - 114.114.114.114
  use-hosts: true
  nameserver:
    - https://sm2.doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - 8.8.4.4
    - 208.67.220.220
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4
      - 127.0.0.1/32
      - 0.0.0.0/32
    domain:
      - '+.google.com'
      - '+.facebook.com'
      - '+.youtube.com'
`;

	const 添加InlineGrpcUserAgent = (text) => text.replace(/grpc-opts:\s*\{([\s\S]*?)\}/i, (all, inner) => {
		if (/grpc-user-agent\s*:/i.test(inner)) return all;
		let content = inner.trim();
		if (content.endsWith(',')) content = content.slice(0, -1).trim();
		const patchedContent = content ? `${content}, grpc-user-agent: ${gRPCUserAgentYAML}` : `grpc-user-agent: ${gRPCUserAgentYAML}`;
		return `grpc-opts: {${patchedContent}}`;
	});
	const 匹配到gRPC网络 = (text) => /(?:^|[,{])\s*network:\s*(?:"grpc"|'grpc'|grpc)(?=\s*(?:[,}\n#]|$))/mi.test(text);
	const 获取代理类型 = (nodeText) => nodeText.match(/type:\s*(\w+)/)?.[1] || 'vl' + 'ess';
	const 获取凭据值 = (nodeText, isFlowStyle) => {
		const credentialField = 获取代理类型(nodeText) === 'trojan' ? 'password' : 'uuid';
		const pattern = new RegExp(`${credentialField}:\\s*${isFlowStyle ? '([^,}\\n]+)' : '([^\\n]+)'}`);
		return nodeText.match(pattern)?.[1]?.trim() || null;
	};
	const 插入NameserverPolicy = (yaml, hostsEntries) => {
		if (/^\s{2}nameserver-policy:\s*(?:\n|$)/m.test(yaml)) {
			return yaml.replace(/^(\s{2}nameserver-policy:\s*\n)/m, `$1${hostsEntries}\n`);
		}
		const lines = yaml.split('\n');
		let dnsBlockEndIndex = -1;
		let inDnsBlock = false;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/^dns:\s*$/.test(line)) {
				inDnsBlock = true;
				continue;
			}
			if (inDnsBlock && /^[a-zA-Z]/.test(line)) {
				dnsBlockEndIndex = i;
				break;
			}
		}
		const nameserverPolicyBlock = `  nameserver-policy:\n${hostsEntries}`;
		if (dnsBlockEndIndex !== -1) lines.splice(dnsBlockEndIndex, 0, nameserverPolicyBlock);
		else lines.push(nameserverPolicyBlock);
		return lines.join('\n');
	};
	const 添加Flow格式gRPCUserAgent = (nodeText) => {
		if (!匹配到gRPC网络(nodeText) || /grpc-user-agent\s*:/i.test(nodeText)) return nodeText;
		if (/grpc-opts:\s*\{/i.test(nodeText)) return 添加InlineGrpcUserAgent(nodeText);
		return nodeText.replace(/\}(\s*)$/, `, grpc-opts: {grpc-user-agent: ${gRPCUserAgentYAML}}}$1`);
	};
	const 添加Block格式gRPCUserAgent = (nodeLines, topLevelIndent) => {
		const 顶级缩进 = ' '.repeat(topLevelIndent);
		let grpcOptsIndex = -1;
		for (let idx = 0; idx < nodeLines.length; idx++) {
			const line = nodeLines[idx];
			if (!line.trim()) continue;
			const indent = line.search(/\S/);
			if (indent !== topLevelIndent) continue;
			if (/^\s*grpc-opts:\s*(?:#.*)?$/.test(line) || /^\s*grpc-opts:\s*\{.*\}\s*(?:#.*)?$/.test(line)) {
				grpcOptsIndex = idx;
				break;
			}
		}
		if (grpcOptsIndex === -1) {
			let insertIndex = -1;
			for (let j = nodeLines.length - 1; j >= 0; j--) {
				if (nodeLines[j].trim()) {
					insertIndex = j;
					break;
				}
			}
			if (insertIndex >= 0) nodeLines.splice(insertIndex + 1, 0, `${顶级缩进}grpc-opts:`, `${顶级缩进}  grpc-user-agent: ${gRPCUserAgentYAML}`);
			return nodeLines;
		}
		const grpcLine = nodeLines[grpcOptsIndex];
		if (/^\s*grpc-opts:\s*\{.*\}\s*(?:#.*)?$/.test(grpcLine)) {
			if (!/grpc-user-agent\s*:/i.test(grpcLine)) nodeLines[grpcOptsIndex] = 添加InlineGrpcUserAgent(grpcLine);
			return nodeLines;
		}
		let blockEndIndex = nodeLines.length;
		let 子级缩进 = topLevelIndent + 2;
		let 已有gRPCUserAgent = false;
		for (let idx = grpcOptsIndex + 1; idx < nodeLines.length; idx++) {
			const line = nodeLines[idx];
			const trimmed = line.trim();
			if (!trimmed) continue;
			const indent = line.search(/\S/);
			if (indent <= topLevelIndent) {
				blockEndIndex = idx;
				break;
			}
			if (indent > topLevelIndent && 子级缩进 === topLevelIndent + 2) 子级缩进 = indent;
			if (/^grpc-user-agent\s*:/.test(trimmed)) {
				已有gRPCUserAgent = true;
				break;
			}
		}
		if (!已有gRPCUserAgent) nodeLines.splice(blockEndIndex, 0, `${' '.repeat(子级缩进)}grpc-user-agent: ${gRPCUserAgentYAML}`);
		return nodeLines;
	};
	const 添加Block格式ECHOpts = (nodeLines, topLevelIndent) => {
		let insertIndex = -1;
		for (let j = nodeLines.length - 1; j >= 0; j--) {
			if (nodeLines[j].trim()) {
				insertIndex = j;
				break;
			}
		}
		if (insertIndex < 0) return nodeLines;
		const indent = ' '.repeat(topLevelIndent);
		const echOptsLines = [`${indent}ech-opts:`, `${indent}  enable: true`];
		if (ECH_SNI) echOptsLines.push(`${indent}  query-server-name: ${ECH_SNI}`);
		nodeLines.splice(insertIndex + 1, 0, ...echOptsLines);
		return nodeLines;
	};

	if (!/^dns:\s*(?:\n|$)/m.test(clash_yaml)) clash_yaml = baseDnsBlock + clash_yaml;
	if (ECH_SNI && !HOSTS.includes(ECH_SNI)) HOSTS.push(ECH_SNI);

	if (ECH启用 && HOSTS.length > 0) {
		const hostsEntries = HOSTS.map(host => `    "${host}": ${ECH_DNS ? ECH_DNS : ''}`).join('\n');
		clash_yaml = 插入NameserverPolicy(clash_yaml, hostsEntries);
	}

	if (!需要处理ECH && !需要处理gRPC) return clash_yaml;

	const lines = clash_yaml.split('\n');
	const processedLines = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		const trimmedLine = line.trim();

		if (trimmedLine.startsWith('- {')) {
			let fullNode = line;
			let braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
			while (braceCount > 0 && i + 1 < lines.length) {
				i++;
				fullNode += '\n' + lines[i];
				braceCount += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
			}
			if (需要处理gRPC) fullNode = 添加Flow格式gRPCUserAgent(fullNode);
			if (需要处理ECH && 获取凭据值(fullNode, true) === uuid.trim()) {
				fullNode = fullNode.replace(/\}(\s*)$/, `, ech-opts: {enable: true${ECH_SNI ? `, query-server-name: ${ECH_SNI}` : ''}}}$1`);
			}
			processedLines.push(fullNode);
			i++;
		} else if (trimmedLine.startsWith('- name:')) {
			let nodeLines = [line];
			let baseIndent = line.search(/\S/);
			let topLevelIndent = baseIndent + 2;
			i++;
			while (i < lines.length) {
				const nextLine = lines[i];
				const nextTrimmed = nextLine.trim();
				if (!nextTrimmed) {
					nodeLines.push(nextLine);
					i++;
					break;
				}
				const nextIndent = nextLine.search(/\S/);
				if (nextIndent <= baseIndent && nextTrimmed.startsWith('- ')) {
					break;
				}
				if (nextIndent < baseIndent && nextTrimmed) {
					break;
				}
				nodeLines.push(nextLine);
				i++;
			}
			let nodeText = nodeLines.join('\n');
			if (需要处理gRPC && 匹配到gRPC网络(nodeText)) {
				nodeLines = 添加Block格式gRPCUserAgent(nodeLines, topLevelIndent);
				nodeText = nodeLines.join('\n');
			}
			if (需要处理ECH && 获取凭据值(nodeText, false) === uuid.trim()) nodeLines = 添加Block格式ECHOpts(nodeLines, topLevelIndent);
			processedLines.push(...nodeLines);
		} else {
			processedLines.push(line);
			i++;
		}
	}

	return processedLines.join('\n');
}

async function Singbox订阅配置文件热补丁(SingBox_原始订阅内容, config_JSON = {}) {
	const uuid = config_JSON?.UUID || null;
	const fingerprint = config_JSON?.Fingerprint || "chrome";
	const ECH启用 = Boolean(config_JSON?.ECH);
	const ECH_SNI = config_JSON?.ECHConfig?.SNI || "cloudflare-ech.com";
	const sb_json_text = SingBox_原始订阅内容.replace('1.1.1.1', '8.8.8.8').replace('1.0.0.1', '8.8.4.4');
	try {
		const config = JSON.parse(sb_json_text);
		const 数组化 = value => value === undefined || value === null ? [] : (Array.isArray(value) ? value : [value]);
		const 确保Route = () => config.route = config.route && typeof config.route === 'object' ? config.route : {};
		const 获取DNS规则服务器 = rule => rule && typeof rule === 'object' && !Array.isArray(rule) && typeof rule.server === 'string' ? rule.server : null;
		const 添加规则集 = (type, code) => {
			if (!code || typeof code !== 'string') return null;
			const route = 确保Route(), tag = `${type}-${code}`, ruleSet = Array.isArray(route.rule_set) ? route.rule_set : 数组化(route.rule_set);
			if (!ruleSet.some(item => item?.tag === tag)) {
				const legacyOptions = type === 'geoip' ? route.geoip : route.geosite;
				ruleSet.push({ tag, type: 'remote', format: 'binary', url: `https://raw.githubusercontent.com/SagerNet/sing-${type}/rule-set/${tag}.srs`, ...(legacyOptions?.download_detour ? { download_detour: legacyOptions.download_detour } : {}) });
				config.experimental = config.experimental && typeof config.experimental === 'object' ? config.experimental : {};
				config.experimental.cache_file = config.experimental.cache_file && typeof config.experimental.cache_file === 'object' ? config.experimental.cache_file : {};
				config.experimental.cache_file.enabled ??= true;
			}
			route.rule_set = ruleSet;
			return tag;
		};

		const 迁移规则集字段 = rule => {
			if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return rule;
			if (rule.type === 'logical' && Array.isArray(rule.rules)) {
				rule.rules = rule.rules.map(迁移规则集字段);
				return rule;
			}
			const tags = [];
			for (const geoip of 数组化(rule.geoip)) {
				if (typeof geoip !== 'string') continue;
				if (geoip.toLowerCase() === 'private') rule.ip_is_private = true;
				else tags.push(添加规则集('geoip', geoip));
			}
			for (const sourceGeoip of 数组化(rule.source_geoip)) {
				if (typeof sourceGeoip !== 'string') continue;
				tags.push(添加规则集('geoip', sourceGeoip));
				rule.rule_set_ip_cidr_match_source = true;
			}
			for (const geosite of 数组化(rule.geosite)) if (typeof geosite === 'string') tags.push(添加规则集('geosite', geosite));
			if (tags.length) rule.rule_set = [...new Set([...数组化(rule.rule_set), ...tags].filter(Boolean))];
			delete rule.geoip;
			delete rule.source_geoip;
			delete rule.geosite;
			return rule;
		};

		const 迁移DNS规则 = (rule, rcodeServerMap) => {
			rule = 迁移规则集字段(rule);
			if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return rule;
			if (rule.type === 'logical' && Array.isArray(rule.rules)) {
				rule.rules = rule.rules.map(childRule => 迁移DNS规则(childRule, rcodeServerMap));
				return rule;
			}
			const serverTag = 获取DNS规则服务器(rule);
			if (serverTag && rcodeServerMap.has(serverTag)) {
				for (const key of ['server', 'strategy', 'disable_cache', 'rewrite_ttl', 'client_subnet', 'timeout']) delete rule[key];
				rule.action = 'predefined';
				rule.rcode = rcodeServerMap.get(serverTag);
			} else if (serverTag && !rule.action) rule.action = 'route';
			return rule;
		};

		if (Array.isArray(config.inbounds)) {
			for (const inbound of config.inbounds) {
				if (!inbound || typeof inbound !== 'object' || inbound.type !== 'tun') continue;
				for (const migration of [
					{ targetKey: 'address', sourceKeys: ['inet4_address', 'inet6_address'] },
					{ targetKey: 'route_address', sourceKeys: ['inet4_route_address', 'inet6_route_address'] },
					{ targetKey: 'route_exclude_address', sourceKeys: ['inet4_route_exclude_address', 'inet6_route_exclude_address'] }
				]) {
					const values = 数组化(inbound[migration.targetKey]);
					for (const sourceKey of migration.sourceKeys) values.push(...数组化(inbound[sourceKey]));
					if (values.length) inbound[migration.targetKey] = [...new Set(values)];
					for (const sourceKey of migration.sourceKeys) delete inbound[sourceKey];
				}
				if (inbound.tag) {
					const addedRules = [];
					if (inbound.domain_strategy) addedRules.push({ inbound: inbound.tag, action: 'resolve', strategy: inbound.domain_strategy });
					if (inbound.sniff) {
						const sniffRule = { inbound: inbound.tag, action: 'sniff' };
						if (inbound.sniff_timeout) sniffRule.timeout = inbound.sniff_timeout;
						addedRules.push(sniffRule);
					}
					if (addedRules.length) {
						const route = 确保Route();
						route.rules = [...addedRules, ...数组化(route.rules)];
					}
				}
				delete inbound.sniff;
				delete inbound.sniff_timeout;
				delete inbound.domain_strategy;
			}
		}

		if (config?.route && typeof config.route === 'object' && Array.isArray(config.route.rules)) {
			const 修补路由规则 = rule => {
				rule = 迁移规则集字段(rule);
				if (rule?.type === 'logical' && Array.isArray(rule.rules)) rule.rules = rule.rules.map(修补路由规则);
				else if (rule && typeof rule === 'object' && !Array.isArray(rule) && rule.outbound && !rule.action) rule.action = 'route';
				return rule;
			};
			config.route.rules = config.route.rules.map(修补路由规则);
		}

		const dns = config?.dns;
		if (dns && typeof dns === 'object') {
			const legacyFakeIP = dns.fakeip && typeof dns.fakeip === 'object' ? dns.fakeip : null;
			const rcodeServerMap = new Map();
			const DNS地址协议类型 = { 'tcp:': 'tcp', 'udp:': 'udp', 'tls:': 'tls', 'quic:': 'quic', 'https:': 'https', 'h3:': 'h3' };
			const RCode映射 = { success: 'NOERROR', format_error: 'FORMERR', server_failure: 'SERVFAIL', name_error: 'NXDOMAIN', not_implemented: 'NOTIMP', refused: 'REFUSED' };
			let hasFakeIPServer = false;

			if (Array.isArray(dns.servers)) {
				const migratedServers = [];
				for (const originalServer of dns.servers) {
					if (!originalServer || typeof originalServer !== 'object' || Array.isArray(originalServer)) {
						migratedServers.push(originalServer);
						continue;
					}

					const server = { ...originalServer };
					let parsedAddress = null, parsedRCode = '', rawAddress = typeof server.address === 'string' ? server.address.trim() : '';
					if (rawAddress) {
						const lowerAddress = rawAddress.toLowerCase();
						if (lowerAddress === 'fakeip') parsedAddress = { type: 'fakeip' };
						else if (lowerAddress === 'local') parsedAddress = { type: 'local' };
						else if (lowerAddress.startsWith('rcode://')) {
							parsedAddress = { type: 'rcode' };
							parsedRCode = rawAddress.slice('rcode://'.length).toLowerCase();
						}
						else if (lowerAddress.startsWith('dhcp://')) {
							const dhcpInterface = rawAddress.slice('dhcp://'.length);
							parsedAddress = dhcpInterface && dhcpInterface.toLowerCase() !== 'auto' ? { type: 'dhcp', interface: dhcpInterface } : { type: 'dhcp' };
						} else {
							try {
								const addressURL = new URL(rawAddress);
								const type = DNS地址协议类型[addressURL.protocol.toLowerCase()];
								if (type) {
									const parsedServer = addressURL.hostname?.startsWith('[') && addressURL.hostname.endsWith(']') ? addressURL.hostname.slice(1, -1) : addressURL.hostname;
									parsedAddress = {
										type,
										server: parsedServer || addressURL.host || rawAddress,
										...(addressURL.port ? { server_port: Number(addressURL.port) } : {}),
										...((type === 'https' || type === 'h3') && addressURL.pathname && addressURL.pathname !== '/dns-query' ? { path: addressURL.pathname } : {})
									};
								}
							} catch (_) { }
							if (!parsedAddress) parsedAddress = { type: 'udp', server: rawAddress };
						}
					}

					if (parsedAddress?.type === 'rcode') {
						const rcode = RCode映射[parsedRCode] || 'NOERROR';
						if (typeof server.tag === 'string' && server.tag) {
							rcodeServerMap.set(server.tag, rcode);
							rcodeServerMap.set(server.tag.startsWith('dns_') ? server.tag.slice(4) : `dns_${server.tag}`, rcode);
						}
						continue;
					}

					if (parsedAddress) {
						delete server.address;
						Object.assign(server, parsedAddress);
					}
					if (server.address_resolver !== undefined && server.domain_resolver === undefined) server.domain_resolver = server.address_resolver;
					if (server.address_strategy !== undefined && server.domain_strategy === undefined) server.domain_strategy = server.address_strategy;
					delete server.address_resolver;
					delete server.address_strategy;
					if (server.detour === 'DIRECT') delete server.detour;

					if (server.type === 'fakeip') {
						hasFakeIPServer = true;
						if (legacyFakeIP) {
							for (const key of ['inet4_range', 'inet6_range']) {
								if (legacyFakeIP[key] !== undefined && server[key] === undefined) server[key] = legacyFakeIP[key];
							}
						}
					}
					migratedServers.push(server);
				}
				dns.servers = migratedServers;
			}

			if (legacyFakeIP && !hasFakeIPServer && legacyFakeIP.enabled !== false) {
				const fakeIPServer = { type: 'fakeip', tag: 'fakeip' };
				for (const rule of Array.isArray(dns.rules) ? dns.rules : []) {
					const serverTag = 获取DNS规则服务器(rule);
					if (serverTag && serverTag.toLowerCase().includes('fakeip')) {
						fakeIPServer.tag = serverTag;
						break;
					}
				}
				for (const key of ['inet4_range', 'inet6_range']) {
					if (legacyFakeIP[key] !== undefined) fakeIPServer[key] = legacyFakeIP[key];
				}
				if (Array.isArray(dns.servers)) dns.servers.push(fakeIPServer);
				else dns.servers = [fakeIPServer];
			}

			if (Array.isArray(dns.rules)) {
				const migratedRules = [];
				for (const rule of dns.rules) {
					const serverTag = 获取DNS规则服务器(rule);
					const outbound = 数组化(rule?.outbound);
					const DNS路由选项字段 = new Set(['outbound', 'server', 'action', 'strategy', 'disable_cache', 'rewrite_ttl', 'client_subnet', 'timeout']);
					const isOutboundAnyDNSRule = rule && typeof rule === 'object' && !Array.isArray(rule) && rule.type !== 'logical'
						&& serverTag && outbound.includes('any') && Object.keys(rule).every(key => DNS路由选项字段.has(key));
					if (isOutboundAnyDNSRule) {
						const route = 确保Route();
						if (route.default_domain_resolver === undefined) {
							const resolver = { server: serverTag };
							for (const key of ['strategy', 'disable_cache', 'rewrite_ttl', 'client_subnet', 'timeout']) {
								if (rule[key] !== undefined) resolver[key] = rule[key];
							}
							route.default_domain_resolver = Object.keys(resolver).length === 1 ? resolver.server : resolver;
						}
						continue;
					}
					migratedRules.push(迁移DNS规则(rule, rcodeServerMap));
				}
				dns.rules = migratedRules;
			}

			delete dns.fakeip;
			delete dns.independent_cache;
		}

		if (config?.route && typeof config.route === 'object') {
			delete config.route.geoip;
			delete config.route.geosite;
		}
		if (config?.ntp?.detour === 'DIRECT') delete config.ntp.detour;

		if (Array.isArray(config.outbounds)) {
			const outboundTags = new Set(config.outbounds.map(outbound => outbound?.tag).filter(Boolean));
			const 引用REJECT = value => value === 'REJECT' || (value && typeof value === 'object' && (Array.isArray(value) ? value.some(引用REJECT) : Object.values(value).some(引用REJECT)));
			if (!outboundTags.has('REJECT') && 引用REJECT({ outbounds: config.outbounds, route: config.route })) config.outbounds.push({ type: 'block', tag: 'REJECT' });
		}

		// --- UUID 匹配节点的 TLS 热补丁 (utls & ech) ---
		if (uuid) {
			config.outbounds?.forEach(outbound => {
				// 仅处理包含 uuid 或 password 且匹配的节点
				if ((outbound.uuid && outbound.uuid === uuid) || (outbound.password && outbound.password === uuid)) {
					// 确保 tls 对象存在
					if (!outbound.tls) {
						outbound.tls = { enabled: true };
					}

					// 添加/更新 utls 配置
					if (fingerprint) {
						outbound.tls.utls = {
							enabled: true,
							fingerprint: fingerprint
						};
					}

					// 如果提供了 ech_config，添加/更新 ech 配置
					if (ECH启用) {
						outbound.tls.ech = {
							enabled: true,
							query_server_name: ECH_SNI,// 等待 1.13.0+ 版本上线
							//config: `-----BEGIN ECH CONFIGS-----\n${ech_config}\n-----END ECH CONFIGS-----`
						};
					}
				}
			});
		}

		return JSON.stringify(config, null, 2);
	} catch (e) {
		log("Singbox热补丁执行失败:", e);
		return JSON.stringify(JSON.parse(sb_json_text), null, 2);
	}
}

function Surge订阅配置文件热补丁(content, url, config_JSON) {
	const 每行内容 = content.includes('\r\n') ? content.split('\r\n') : content.split('\n');
	const 完整节点路径 = config_JSON.随机路径 ? 随机路径(config_JSON.完整节点路径) : config_JSON.完整节点路径;
	let 输出内容 = "";
	for (let x of 每行内容) {
		if (x.includes('= tro' + 'jan,') && !x.includes('ws=true') && !x.includes('ws-path=')) {
			const host = x.split("sni=")[1].split(",")[0];
			const 备改内容 = `sni=${host}, skip-cert-verify=${config_JSON.跳过证书验证}`;
			const 正确内容 = `sni=${host}, skip-cert-verify=${config_JSON.跳过证书验证}, ws=true, ws-path=${完整节点路径.replace(/,/g, '%2C')}, ws-headers=Host:"${host}"`;
			输出内容 += x.replace(new RegExp(备改内容, 'g'), 正确内容).replace("[", "").replace("]", "") + '\n';
		} else {
			输出内容 += x + '\n';
		}
	}

	输出内容 = `#!MANAGED-CONFIG ${url} interval=${config_JSON.优选订阅生成.SUBUpdateTime * 60 * 60} strict=false` + 输出内容.substring(输出内容.indexOf('\n'));
	return 输出内容;
}

async function 请求日志记录(env, request, 访问IP, 请求类型 = "Get_SUB", config_JSON, 是否写入KV日志 = true) {
	try {
		const 当前时间 = new Date();
		const 日志内容 = { TYPE: 请求类型, IP: 访问IP, ASN: `AS${request.cf.asn || '0'} ${request.cf.asOrganization || 'Unknown'}`, CC: `${request.cf.country || 'N/A'} ${request.cf.city || 'N/A'}`, URL: request.url, UA: request.headers.get('User-Agent') || 'Unknown', TIME: 当前时间.getTime() };
		if (config_JSON.TG.启用) {
			try {
				const TG_TXT = await env.KV.get('tg.json');
				const TG_JSON = JSON.parse(TG_TXT);
				if (TG_JSON?.BotToken && TG_JSON?.ChatID) {
					const 请求时间 = new Date(日志内容.TIME).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
					const 请求URL = new URL(日志内容.URL);
					const msg = `<b>#${config_JSON.优选订阅生成.SUBNAME} 日志通知</b>\n\n` +
						`📌 <b>类型：</b>#${日志内容.TYPE}\n` +
						`🌐 <b>IP：</b><code>${日志内容.IP}</code>\n` +
						`📍 <b>位置：</b>${日志内容.CC}\n` +
						`🏢 <b>ASN：</b>${日志内容.ASN}\n` +
						`🔗 <b>域名：</b><code>${请求URL.host}</code>\n` +
						`🔍 <b>路径：</b><code>${请求URL.pathname + 请求URL.search}</code>\n` +
						`🤖 <b>UA：</b><code>${日志内容.UA}</code>\n` +
						`📅 <b>时间：</b>${请求时间}\n` +
						`${config_JSON.CF.Usage.success ? `📊 <b>请求用量：</b>${config_JSON.CF.Usage.total}/${config_JSON.CF.Usage.max} <b>${((config_JSON.CF.Usage.total / config_JSON.CF.Usage.max) * 100).toFixed(2)}%</b>\n` : ''}`;
					await fetch(`https://api.telegram.org/bot${TG_JSON.BotToken}/sendMessage?chat_id=${TG_JSON.ChatID}&parse_mode=HTML&text=${encodeURIComponent(msg)}`, {
						method: 'GET',
						headers: {
							'Accept': 'text/html,application/xhtml+xml,application/xml;',
							'Accept-Encoding': 'gzip, deflate, br',
							'User-Agent': 日志内容.UA || 'Unknown',
						}
					});
				}
			} catch (error) { log(`读取tg.json出错: ${error.message}`) }
		}
		是否写入KV日志 = ['1', 'true'].includes(env.OFF_LOG) ? false : 是否写入KV日志;
		if (!是否写入KV日志) return;
		let 日志数组 = [];
		const 现有日志 = await env.KV.get('log.json'), KV容量限制 = 4;//MB
		if (现有日志) {
			try {
				日志数组 = JSON.parse(现有日志);
				if (!Array.isArray(日志数组)) { 日志数组 = [日志内容] }
				else if (请求类型 !== "Get_SUB") {
					const 三十分钟前时间戳 = 当前时间.getTime() - 30 * 60 * 1000;
					if (日志数组.some(log => log.TYPE !== "Get_SUB" && log.IP === 访问IP && log.URL === request.url && log.UA === (request.headers.get('User-Agent') || 'Unknown') && log.TIME >= 三十分钟前时间戳)) return;
					日志数组.push(日志内容);
					while (JSON.stringify(日志数组, null, 2).length > KV容量限制 * 1024 * 1024 && 日志数组.length > 0) 日志数组.shift();
				} else {
					日志数组.push(日志内容);
					while (JSON.stringify(日志数组, null, 2).length > KV容量限制 * 1024 * 1024 && 日志数组.length > 0) 日志数组.shift();
				}
			} catch (e) { 日志数组 = [日志内容] }
		} else { 日志数组 = [日志内容] }
		await env.KV.put('log.json', JSON.stringify(日志数组, null, 2));
	} catch (error) { console.error(`日志记录失败: ${error.message}`) }
}

const DoH缓存 = {};
const DoH缓存最大条目 = 256;
const DoH记录类型映射 = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28, SRV: 33, HTTPS: 65 };
async function DoH查询(域名, 记录类型, DoH解析服务 = "https://cloudflare-dns.com/dns-query") {
	const 规范化域名 = String(域名 || '').trim().toLowerCase().replace(/\.$/, '');
	const 规范化记录类型 = String(记录类型 || '').trim().toUpperCase();
	const 缓存键 = `${规范化域名}:${规范化记录类型}`;
	const qtype = DoH记录类型映射[规范化记录类型] || 1;
	const 当前时间戳 = Date.now();
	const 现缓存项 = DoH缓存[缓存键];
	if (现缓存项 && 当前时间戳 < 现缓存项.过期时间) {
		log(`[DoH查询] 命中缓存 ${域名} ${记录类型} via ${DoH解析服务}`);
		return 现缓存项.data.map(data => ({ type: qtype, data }));
	}
	const 开始时间 = performance.now();
	log(`[DoH查询] 开始查询 ${域名} ${记录类型} via ${DoH解析服务}`);
	try {
		// 记录类型字符串转数值
		// 编码域名为 DNS wire format labels
		const 编码域名 = (name) => {
			const parts = name.endsWith('.') ? name.slice(0, -1).split('.') : name.split('.');
			const bufs = [];
			for (const label of parts) {
				const enc = new TextEncoder().encode(label);
				bufs.push(new Uint8Array([enc.length]), enc);
			}
			bufs.push(new Uint8Array([0]));
			const total = bufs.reduce((s, b) => s + b.length, 0);
			const result = new Uint8Array(total);
			let off = 0;
			for (const b of bufs) { result.set(b, off); off += b.length }
			return result;
		};

		// 构建 DNS 查询报文
		const qname = 编码域名(规范化域名);
		const query = new Uint8Array(12 + qname.length + 4);
		const qview = new DataView(query.buffer);
		qview.setUint16(0, crypto.getRandomValues(new Uint16Array(1))[0]); // ID (random per RFC 1035)
		qview.setUint16(2, 0x0100);  // Flags: RD=1 (递归查询)
		qview.setUint16(4, 1);       // QDCOUNT
		query.set(qname, 12);
		qview.setUint16(12 + qname.length, qtype);
		qview.setUint16(12 + qname.length + 2, 1); // QCLASS = IN

		// 通过 POST 发送 dns-message 请求
		log(`[DoH查询] 发送查询报文 ${域名} via ${DoH解析服务} (type=${qtype}, ${query.length}字节)`);
		const response = await fetch(DoH解析服务, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/dns-message',
				'Accept': 'application/dns-message',
			},
			body: query,
		});
		if (!response.ok) {
			log(`[DoH查询] 请求失败 ${域名} ${记录类型} via ${DoH解析服务} 响应代码:${response.status}`);
			return [];
		}

		// 解析 DNS 响应报文
		const buf = new Uint8Array(await response.arrayBuffer());
		const dv = new DataView(buf.buffer);
		const qdcount = dv.getUint16(4);
		const ancount = dv.getUint16(6);
		log(`[DoH查询] 收到响应 ${域名} ${记录类型} via ${DoH解析服务} (${buf.length}字节, ${ancount}条应答)`);

		// 解析域名（处理指针压缩）
		const 解析域名 = (pos) => {
			const labels = [];
			let p = pos, jumped = false, endPos = -1, safe = 128;
			while (p < buf.length && safe-- > 0) {
				const len = buf[p];
				if (len === 0) { if (!jumped) endPos = p + 1; break }
				if ((len & 0xC0) === 0xC0) {
					if (!jumped) endPos = p + 2;
					p = ((len & 0x3F) << 8) | buf[p + 1];
					jumped = true;
					continue;
				}
				labels.push(new TextDecoder().decode(buf.slice(p + 1, p + 1 + len)));
				p += len + 1;
			}
			if (endPos === -1) endPos = p + 1;
			return [labels.join('.'), endPos];
		};

		// 跳过 Question Section
		let offset = 12;
		for (let i = 0; i < qdcount; i++) {
			const [, end] = 解析域名(offset);
			offset = /** @type {number} */ (end) + 4; // +4 跳过 QTYPE + QCLASS
		}

		// 解析 Answer Section
		const answers = [];
		for (let i = 0; i < ancount && offset < buf.length; i++) {
			const [name, nameEnd] = 解析域名(offset);
			offset = /** @type {number} */ (nameEnd);
			const type = dv.getUint16(offset); offset += 2;
			offset += 2; // CLASS
			const ttl = dv.getUint32(offset); offset += 4;
			const rdlen = dv.getUint16(offset); offset += 2;
			const rdata = buf.slice(offset, offset + rdlen);
			offset += rdlen;

			let data;
			if (type === 1 && rdlen === 4) {
				// A 记录
				data = `${rdata[0]}.${rdata[1]}.${rdata[2]}.${rdata[3]}`;
			} else if (type === 28 && rdlen === 16) {
				// AAAA 记录
				const segs = [];
				for (let j = 0; j < 16; j += 2) segs.push(((rdata[j] << 8) | rdata[j + 1]).toString(16));
				data = segs.join(':');
			} else if (type === 16) {
				// TXT 记录 (长度前缀字符串)
				let tOff = 0;
				const parts = [];
				while (tOff < rdlen) {
					const tLen = rdata[tOff++];
					parts.push(new TextDecoder().decode(rdata.slice(tOff, tOff + tLen)));
					tOff += tLen;
				}
				data = parts.join('');
			} else if (type === 5) {
				// CNAME 记录
				const [cname] = 解析域名(offset - rdlen);
				data = cname;
			} else {
				data = Array.from(rdata).map(b => b.toString(16).padStart(2, '0')).join('');
			}
			answers.push({ name, type, TTL: ttl, data, rdata });
		}
		const 耗时 = (performance.now() - 开始时间).toFixed(2);
		log(`[DoH查询] 查询完成 ${域名} ${记录类型} via ${DoH解析服务} ${耗时}ms 共${answers.length}条结果${answers.length > 0 ? '\n' + answers.map((a, i) => `  ${i + 1}. ${a.name} type=${a.type} TTL=${a.TTL} data=${a.data}`).join('\n') : ''}`);
		// DoH 缓存至少保留 5 分钟，响应 TTL 更长时尊重响应 TTL；空响应使用 5 分钟负缓存
		const 相关记录 = answers.filter(answer => answer.type === qtype);
		const 最小TTL = 相关记录.length > 0 ? Math.min(...相关记录.map(a => a.TTL)) : 0;
		const 缓存TTL = Math.max(最小TTL, 5 * 60);
		const 缓存过期时间 = Date.now() + 缓存TTL * 1000;
		const 缓存数据 = 相关记录.map(answer => answer.data);
		if (缓存数据.length > 0 || answers.length === 0) {
			if (Object.keys(DoH缓存).length >= DoH缓存最大条目) {
				const 清理时间戳 = Date.now();
				for (const [缓存条目键, 缓存条目] of Object.entries(DoH缓存)) {
					if (清理时间戳 >= 缓存条目.过期时间) delete DoH缓存[缓存条目键];
				}
				if (Object.keys(DoH缓存).length >= DoH缓存最大条目) {
					delete DoH缓存[Object.keys(DoH缓存)[0]];
				}
			}
			DoH缓存[缓存键] = { data: 缓存数据, 过期时间: 缓存过期时间 };
			log(`[DoH查询] 写入缓存 ${域名} ${记录类型} TTL=${缓存TTL}s${缓存数据.length === 0 ? '（空结果）' : ''}`);
		}
		return answers;
	} catch (error) {
		const 耗时 = (performance.now() - 开始时间).toFixed(2);
		log(`[DoH查询] 查询失败 ${域名} ${记录类型} via ${DoH解析服务} ${耗时}ms:`, error);
		return [];
	}
}

async function 读取config_JSON(env, hostname, userID, UA = "Mozilla/5.0", 重置配置 = false) {
	// 本函数返回配置对象，交由调用方发布到 state.js；
	// 全程使用局部变量，避免给 import 进来的实时绑定赋值。
	let 局部配置 = null;
	const _p = 特征码字典[0];
	const host = hostname, Ali_DoH = "https://dns.alidns.com/dns-query", ECH_SNI = "cloudflare-ech.com", 占位符 = '{{IP:PORT}}', 初始化开始时间 = performance.now(), 默认配置JSON = {
		TIME: new Date().toISOString(),
		HOST: host,
		HOSTS: [hostname],
		UUID: userID,
		PATH: "/",
		协议类型: "v" + "le" + "ss",
		传输协议: "ws",
		gRPC模式: "gun",
		gRPCUserAgent: UA,
		跳过证书验证: false,
		启用0RTT: false,
		TLS分片: null,
		随机路径: false,
		ECH: false,
		ECHConfig: {
			DNS: Ali_DoH,
			SNI: ECH_SNI,
		},
		SS: {
			加密方式: "aes-128-gcm",
			TLS: true,
		},
		Fingerprint: "chrome",
		优选订阅生成: {
			local: true, // true: 基于本地的优选地址  false: 优选订阅生成器
			本地IP库: {
				随机IP: true, // 当 随机IP 为true时生效，启用随机IP的数量，否则使用KV内的ADD.txt
				随机数量: 16,
				指定端口: -1,
			},
			SUB: null,
			SUBNAME: "edge" + "tunnel",
			SUBUpdateTime: 3, // 订阅更新时间（小时）
			TOKEN: await MD5MD5(hostname + userID),
		},
		订阅转换配置: {
			SUBAPI: `https://SUBAPI.${特征码字典[1]}ssss.net`,
			SUBCONFIG: `https://raw.githubusercontent.com/${特征码字典[1]}/ACL4SSR/refs/heads/main/Clash/config/ACL4SSR_Online_Mini_MultiMode_CF.ini`,
			SUBEMOJI: false,
			SUBLIST: false, //仅输出节点信息
			UDP: false, // 启用 UDP
			XUDP: false, // 启用 XUDP
			TLS13: false, // 启用 TLS 1.3
			APPEND_TYPE: false, // 插入节点类型
			SORT: false, // 基础节点排序
		},
		反代: {
			[_p]: "auto",
			SOCKS5: {
				启用: null,
				全局: false,
				账号: '',
				白名单: SOCKS5白名单,
			},
			路径模板: {
				[_p]: "proxyip=" + 占位符,
				SOCKS5: {
					全局: "socks5://" + 占位符,
					标准: "socks5=" + 占位符
				},
				HTTP: {
					全局: "http://" + 占位符,
					标准: "http=" + 占位符
				},
				HTTPS: {
					全局: "https://" + 占位符,
					标准: "https=" + 占位符
				},
				TURN: {
					全局: "turn://" + 占位符,
					标准: "turn=" + 占位符
				},
				SSTP: {
					全局: "sstp://" + 占位符,
					标准: "sstp=" + 占位符
				},
			},
		},
		TG: {
			启用: false,
			BotToken: null,
			ChatID: null,
		},
		CF: {
			Email: null,
			GlobalAPIKey: null,
			AccountID: null,
			APIToken: null,
			UsageAPI: null,
			Usage: {
				success: false,
				pages: 0,
				workers: 0,
				total: 0,
				max: 100000,
			},
		}
	};

	try {
		let configJSON = await env.KV.get('config.json');
		if (!configJSON || 重置配置 == true) {
			await env.KV.put('config.json', JSON.stringify(默认配置JSON, null, 2));
			局部配置 = 默认配置JSON;
		} else {
			局部配置 = JSON.parse(configJSON);
		}
	} catch (error) {
		log(`读取局部配置出错: ${error.message}`);
		局部配置 = 默认配置JSON;
	}

	if (!局部配置.订阅转换配置.SUBLIST) 局部配置.订阅转换配置.SUBLIST = false;
	if (!局部配置.订阅转换配置.UDP) 局部配置.订阅转换配置.UDP = false;
	if (!局部配置.订阅转换配置.XUDP) 局部配置.订阅转换配置.XUDP = false;
	if (!局部配置.订阅转换配置.TLS13) 局部配置.订阅转换配置.TLS13 = false;
	if (!局部配置.订阅转换配置.APPEND_TYPE) 局部配置.订阅转换配置.APPEND_TYPE = false;
	if (!局部配置.订阅转换配置.SORT) 局部配置.订阅转换配置.SORT = false;
	if (!局部配置.gRPCUserAgent) 局部配置.gRPCUserAgent = UA;
	局部配置.HOST = host;
	if (!局部配置.HOSTS) 局部配置.HOSTS = [hostname];
	if (env.HOST) 局部配置.HOSTS = (await 整理成数组(env.HOST)).map(h => h.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0]);
	局部配置.UUID = userID;
	if (!局部配置.随机路径) 局部配置.随机路径 = false;
	if (!局部配置.启用0RTT) 局部配置.启用0RTT = false;

	if (env.PATH) 局部配置.PATH = env.PATH.startsWith('/') ? env.PATH : '/' + env.PATH;
	else if (!局部配置.PATH) 局部配置.PATH = '/';

	if (!局部配置.gRPC模式) 局部配置.gRPC模式 = 'gun';
	if (!局部配置.SS) 局部配置.SS = { 加密方式: "aes-128-gcm", TLS: false };

	if (!局部配置.反代.路径模板?.[_p]) {
		局部配置.反代.路径模板 = {
			[_p]: "proxyip=" + 占位符,
			SOCKS5: {
				全局: "socks5://" + 占位符,
				标准: "socks5=" + 占位符
			},
			HTTP: {
				全局: "http://" + 占位符,
				标准: "http=" + 占位符
			},
			HTTPS: {
				全局: "https://" + 占位符,
				标准: "https=" + 占位符
			},
			TURN: {
				全局: "turn://" + 占位符,
				标准: "turn=" + 占位符
			},
			SSTP: {
				全局: "sstp://" + 占位符,
				标准: "sstp=" + 占位符
			},
		};
	}
	if (!局部配置.反代.路径模板.HTTPS) 局部配置.反代.路径模板.HTTPS = { 全局: "https://" + 占位符, 标准: "https=" + 占位符 };
	if (!局部配置.反代.路径模板.TURN) 局部配置.反代.路径模板.TURN = { 全局: "turn://" + 占位符, 标准: "turn=" + 占位符 };
	if (!局部配置.反代.路径模板.SSTP) 局部配置.反代.路径模板.SSTP = { 全局: "sstp://" + 占位符, 标准: "sstp=" + 占位符 };

	const 代理配置 = 局部配置.反代.路径模板[局部配置.反代.SOCKS5.启用?.toUpperCase()];

	let 路径反代参数 = '';
	if (代理配置 && 局部配置.反代.SOCKS5.账号) 路径反代参数 = (局部配置.反代.SOCKS5.全局 ? 代理配置.全局 : 代理配置.标准).replace(占位符, 局部配置.反代.SOCKS5.账号);
	else if (局部配置.反代[_p] !== 'auto') 路径反代参数 = 局部配置.反代.路径模板[_p].replace(占位符, 局部配置.反代[_p]);

	let 反代查询参数 = '';
	if (路径反代参数.includes('?')) {
		const [反代路径部分, 反代查询部分] = 路径反代参数.split('?');
		路径反代参数 = 反代路径部分;
		反代查询参数 = 反代查询部分;
	}

	局部配置.PATH = 局部配置.PATH.replace(路径反代参数, '').replace('//', '/');
	const normalizedPath = 局部配置.PATH === '/' ? '' : 局部配置.PATH.replace(/\/+(?=\?|$)/, '').replace(/\/+$/, '');
	const [路径部分, ...查询数组] = normalizedPath.split('?');
	const 查询部分 = 查询数组.length ? '?' + 查询数组.join('?') : '';
	const 最终查询部分 = 反代查询参数 ? (查询部分 ? 查询部分 + '&' + 反代查询参数 : '?' + 反代查询参数) : 查询部分;
	局部配置.完整节点路径 = (路径部分 || '/') + (路径部分 && 路径反代参数 ? '/' : '') + 路径反代参数 + 最终查询部分 + (局部配置.启用0RTT ? (最终查询部分 ? '&' : '?') + 'ed=2560' : '');

	if (!局部配置.TLS分片 && 局部配置.TLS分片 !== null) 局部配置.TLS分片 = null;
	const TLS分片参数 = 局部配置.TLS分片 == 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : 局部配置.TLS分片 == 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '';
	if (!局部配置.Fingerprint) 局部配置.Fingerprint = "chrome";
	if (!局部配置.ECH) 局部配置.ECH = false;
	if (!局部配置.ECHConfig) 局部配置.ECHConfig = { DNS: Ali_DoH, SNI: ECH_SNI };
	const ECHLINK参数 = 局部配置.ECH ? `&ech=${encodeURIComponent((局部配置.ECHConfig.SNI ? 局部配置.ECHConfig.SNI + '+' : '') + 局部配置.ECHConfig.DNS)}` : '';
	const { type: 传输协议, 路径字段名, 域名字段名 } = 获取传输协议配置(局部配置);
	const 传输路径参数值 = 获取传输路径参数值(局部配置, 局部配置.完整节点路径);
	局部配置.LINK = 局部配置.协议类型 === 'ss'
		? `${局部配置.协议类型}://${btoa(局部配置.SS.加密方式 + ':' + userID)}@${host}:${局部配置.SS.TLS ? '443' : '80'}?plugin=v2${encodeURIComponent(`ray-plugin;mode=websocket;host=${host};path=${((局部配置.完整节点路径.includes('?') ? 局部配置.完整节点路径.replace('?', '?enc=' + 局部配置.SS.加密方式 + '&') : (局部配置.完整节点路径 + '?enc=' + 局部配置.SS.加密方式)) + (局部配置.SS.TLS ? ';tls' : ''))};mux=0`) + ECHLINK参数}#${encodeURIComponent(局部配置.优选订阅生成.SUBNAME)}`
		: `${局部配置.协议类型}://${userID}@${host}:443?security=tls&type=${传输协议 + ECHLINK参数}&${域名字段名}=${host}&fp=${局部配置.Fingerprint}&sni=${host}&${路径字段名}=${encodeURIComponent(传输路径参数值) + TLS分片参数}&encryption=none#${encodeURIComponent(局部配置.优选订阅生成.SUBNAME)}`;
	局部配置.优选订阅生成.TOKEN = await MD5MD5(hostname + userID);

	const 初始化TG_JSON = { BotToken: null, ChatID: null };
	局部配置.TG = { 启用: 局部配置.TG.启用 ? 局部配置.TG.启用 : false, ...初始化TG_JSON };
	try {
		const TG_TXT = await env.KV.get('tg.json');
		if (!TG_TXT) {
			await env.KV.put('tg.json', JSON.stringify(初始化TG_JSON, null, 2));
		} else {
			const TG_JSON = JSON.parse(TG_TXT);
			局部配置.TG.ChatID = TG_JSON.ChatID ? TG_JSON.ChatID : null;
			局部配置.TG.BotToken = TG_JSON.BotToken ? 掩码敏感信息(TG_JSON.BotToken) : null;
		}
	} catch (error) {
		log(`读取tg.json出错: ${error.message}`);
	}

	const 初始化CF_JSON = { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null };
	局部配置.CF = { ...初始化CF_JSON, Usage: { success: false, pages: 0, workers: 0, total: 0, max: 100000 } };
	try {
		const CF_TXT = await env.KV.get('cf.json');
		if (!CF_TXT) {
			await env.KV.put('cf.json', JSON.stringify(初始化CF_JSON, null, 2));
		} else {
			const CF_JSON = JSON.parse(CF_TXT);
			if (CF_JSON.UsageAPI) {
				try {
					const response = await fetch(CF_JSON.UsageAPI);
					const Usage = await response.json();
					局部配置.CF.Usage = Usage;
				} catch (err) {
					console.error(`请求 CF_JSON.UsageAPI 失败: ${err.message}`);
				}
			} else {
				局部配置.CF.Email = CF_JSON.Email ? CF_JSON.Email : null;
				局部配置.CF.GlobalAPIKey = CF_JSON.GlobalAPIKey ? 掩码敏感信息(CF_JSON.GlobalAPIKey) : null;
				局部配置.CF.AccountID = CF_JSON.AccountID ? 掩码敏感信息(CF_JSON.AccountID) : null;
				局部配置.CF.APIToken = CF_JSON.APIToken ? 掩码敏感信息(CF_JSON.APIToken) : null;
				局部配置.CF.UsageAPI = null;
				const Usage = await getCloudflareUsage(CF_JSON.Email, CF_JSON.GlobalAPIKey, CF_JSON.AccountID, CF_JSON.APIToken);
				局部配置.CF.Usage = Usage;
			}
		}
	} catch (error) {
		console.error(`读取cf.json出错: ${error.message}`);
	}

	局部配置.加载时间 = (performance.now() - 初始化开始时间).toFixed(2) + 'ms';
	return 局部配置;
}

export { DoH缓存, DoH缓存最大条目, DoH记录类型映射 };
export { base64SecretEncode, base64SecretDecode, 获取传输协议配置, 获取传输路径参数值, Clash订阅配置文件热补丁, Singbox订阅配置文件热补丁, Surge订阅配置文件热补丁, 请求日志记录, DoH查询, 读取config_JSON };
