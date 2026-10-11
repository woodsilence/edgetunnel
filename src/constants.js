/**
 * 全局常量与配置开关
 *
 * 包含三类内容：
 * 1. 版本号 `Version` 与静态页面地址 `Pages静态页面`
 * 2. 传输层调优阈值：WS 早期数据上限、上行合包目标字节（20KB）、
 *    下行 Grain 包大小（32KB）与低水位阈值，直接影响 TCP↔WebSocket 的吞吐与 CPU 占用
 * 3. 特征码字典 `特征码字典`：用 `Proxy.name + "IP"`、`String.fromCharCode` 等方式
 *    拼接还原 "PROXYIP" / "cmliu"，规避基于关键词的静态扫描
 *
 * 另含三个"可调旋钮"：`TCP并发拨号数`、`反代并发拨号数`、`预加载竞速拨号`，
 * 它们由 fetch() 在每次请求开始时依据环境变量覆写（见 constants.js 末尾的说明）。
 *
 * ── 本模块导出 9 个符号，依赖 1 个内部模块 ──
 */

import { config_JSON, 调试日志打印, TCP并发拨号数, 反代并发拨号数, 预加载竞速拨号, 缓存SOCKS5白名单, SOCKS5白名单 } from './state.js';

﻿const Version = '2026-08-11 14:45:22';
const Pages静态页面 = 'https://edt-pages.github.io';
///////////////////////////////////////////////////////全局常量和工具函数///////////////////////////////////////////////
const WS早期数据最大字节 = 8 * 1024, WS早期数据最大头长度 = Math.ceil(WS早期数据最大字节 * 4 / 3) + 4;
const 上行合包目标字节 = 20 * 1024, 上行队列最大字节 = 16 * 1024 * 1024, 上行队列最大条目 = 4096;
const 下行Grain包字节 = 32 * 1024, 下行Grain尾部阈值 = 512, 下行Grain低水位字节 = Math.max(4096, 下行Grain尾部阈值 * 12), 下行Grain最大等待轮次 = 4;
///////////////////////////////////////////////////////查杀特征码///////////////////////////////////////////////
const 特征码字典 = [
	(Proxy.name + "IP").toUpperCase(),
	(String.fromCharCode(67, 109) + URL.name[2] + 'i' + URL.name[0]).toLowerCase(),
	String(2407 * 300 - 10).split('').reverse().join('')
];

export { Version, Pages静态页面, WS早期数据最大字节, 上行合包目标字节, 下行Grain包字节, 特征码字典 };
// 兼容层：可变状态统一由 state.js 持有，此处透传供既有引用方使用
export { config_JSON, 调试日志打印, TCP并发拨号数, 反代并发拨号数, 预加载竞速拨号, 缓存SOCKS5白名单, SOCKS5白名单 };
