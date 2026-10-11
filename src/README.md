# edgetunnel 源码结构

本目录是 `_worker.js` 的**源码**。`_worker.js` 是由 esbuild 从这里打包生成的**部署产物**——
官方部署方式（粘贴进 CF Workers 编辑器 / 上传 Pages 压缩包）都要求入口是单个文件，
所以日常维护改的是 `src/`，改完执行 `npm run build` 重新生成 `_worker.js`。

> ⚠️ **不要直接编辑 `_worker.js`**：下一次构建会覆盖你的改动。

---

## 一、整体数据流

```
客户端 (v2rayN / Clash / Shadowrocket)
   │  VLESS / Trojan / Shadowsocks（携带 UUID 鉴权）
   ▼
Cloudflare Worker 边缘节点
   │
   ├─ src/index.js          入口：按请求特征分发
   ├─ src/transport/        传输层：WS / gRPC / 叉HTTP(XHTTP)
   ├─ src/protocol/         协议层：VLESS / Trojan / Shadowsocks
   ├─ src/outbound/         出站层：反代IP / SOCKS5 / HTTP / TURN / SSTP / 直连
   ├─ src/stream.js         流处理：Grain 合包与双向搬运
   ├─ src/net/tls.js        手写 TLS 客户端
   ├─ src/subscription.js   订阅生成与配置热补丁
   └─ src/web.js            伪装页面
```

**核心约束**：Workers 运行时只能开 TCP 洞（`request.fetcher.connect`）。
所有隧道协议最终都被翻译成一条 TCP 流，交给 `src/outbound/forward.js` 的 `forwardataTCP`。
各协议之间的差异，仅在于「怎么把 TLS / SOCKS / HTTP 套在这条 TCP 上」。

---

## 二、模块清单

| 模块 | 职责 | 关键符号 |
|---|---|---|
| `index.js` | 入口与请求分发 | `fetch()`、`载入配置()` |
| `state.js` | 跨模块共享的可变状态 | `config_JSON`、`初始化共享状态()` |
| `constants.js` | 常量与调优阈值 | `特征码字典`、合包大小 |
| `utils/bytes.js` | 字节工具 + 纯 JS MD5 | `拼接字节数据`、`MD5转十六进制` |
| `transport/ws.js` | WebSocket 传输 + 协议自动识别 | `处理WS请求` |
| `transport/grpc.js` | gRPC 传输 | `处理gRPC请求` |
| `transport/xhttp.js` | XHTTP 传输（抗探测） | `处理叉HTTP请求`、`校验叉HTTPPadding` |
| `protocol/vless.js` | VLESS 解析 | `解析魏烈思请求`、`UUID字节匹配` |
| `protocol/trojan.js` | Trojan 解析 | `解析木马请求` |
| `protocol/shadowsocks.js` | SS AEAD 加解密 | `SSAEAD加密`、`SS派生主密钥` |
| `outbound/forward.js` | 出站决策树 | `forwardataTCP`、`forwardataudp` |
| `outbound/proxies.js` | SOCKS5 / HTTP(S) 代理 | `socks5Connect`、`httpConnect` |
| `outbound/turn.js` | TURN 代理 | `turnConnect` |
| `outbound/sstp.js` | SSTP 代理 | `sstpConnect` |
| `stream.js` | Grain 合包与双向搬运 | `创建下行Grain发送器`、`connectStreams` |
| `net/tls.js` | 手写 TLS 客户端 | `TlsClient` |
| `subscription.js` | 订阅生成 / 配置热补丁 | `读取config_JSON`、`Clash订阅配置文件热补丁` |
| `proxy-config.js` | 反代参数解析 | `反代参数获取`、`获取SOCKS5账号` |
| `common.js` | 日志、随机路径、DoH、优选 API | `log`、`随机路径`、`DoH查询` |
| `speedtest.js` | 测速旁路 | `isSpeedTestSite` |
| `web.js` | 伪装页与杂项 | `nginx`、`html1101`、`sha224` |

---

## 三、几个必须知道的设计要点

### 1. 协议自动识别（`transport/ws.js`）

三种协议共用一个 WS 端口，靠首包嗅探分流：

```js
if (url.searchParams.get('enc'))  → 'ss'      // SS 无固定头部，必须显式声明
else if (bytes[56]===0x0d && bytes[57]===0x0a) → '木马'  // Trojan 密码哈希的固定尾部 CRLF
else                                  → '魏烈思'
```

### 2. 出站两级降级（`outbound/forward.js`）

```
URL 带代理参数? ──是──→ socks5Connect / httpConnect / turnConnect / sstpConnect
                  否 → connectProxyIP()：连反代IP数组（并发抢最快）
                         └─ 全失败 → connectDirect() 兜底直连
```

`TCP并发拨号数`（默认 2）与 `预加载竞速拨号`（DoH 预解析后多 IP 并发）用于降低首包时延。

### 3. 合包优化（`stream.js`）

Worker 里每次 `writer.write()` 都有固定开销，零碎小包会打爆 CPU：

- 上行：攒够 **20KB**（`上行合包目标字节`）再写入目标 socket
- 下行：攒够 **32KB**（`下行Grain包字节`），或尾部 512B 到达、或超时 1ms，才发一个 WS frame

### 4. 共享状态的 ESM 约束

单体版把可变状态声明在文件顶层 `let`，`fetch()` 直接赋值。拆成 module 后，
**import 进来的绑定不可赋值**（ESM 规定），因此统一收敛到 `state.js`：

```js
// index.js 中：先算到局部变量，再一次性提交
初始化共享状态({ config_JSON: ..., 调试日志打印: ..., TCP并发拨号数: ... });
```

`state.js` 用 `export let` 保持实时绑定，导入方读到的始终是最新值。

### 5. MD5 为什么是手写的（`utils/bytes.js`）

WebCrypto 规范**不包含 MD5**，`crypto.subtle.digest('MD5')` 在标准运行时抛
`NotSupportedError`，仅 Cloudflare Workers 提供了非标准扩展。手写实现与原生 MD5
逐字节一致（`npm run test:md5` 验证），因此任何运行时可用，且
**订阅 token / UUID / 登录 Cookie 全部不受影响**。

---

## 四、构建流水线

`npm run build` 会依次执行 `scripts/pipeline.mjs`：

| 步骤 | 作用 |
|---|---|
| `extract.mjs` | 识别顶层声明及其行区间 |
| `plan-modules.mjs` | 校验模块划分是否覆盖全部声明 |
| `generate-modules.mjs` | 切片生成 `src/**.js`（含文档头与自动 import/export） |
| `gen-entry.mjs` | 切出 `fetch()` 方法体 |
| `assemble-index.mjs` | 装配入口（共享状态改走 state.js） |
| `postprocess.cjs` | 修补可变状态 / 局部别名 / index import |
| `build.mjs` | esbuild 打包回 `_worker.js` |

> 这套脚本是从单体版**一次性抽取**时用的，保留了「行区间 → 模块」的映射，
> 便于回溯每个函数搬到了哪里。日常改代码直接编辑 `src/**.js` 再 `npm run build` 即可，
> **不需要**重跑 pipeline。

---

## 五、测试

| 命令 | 覆盖内容 |
|---|---|
| `npm run test:md5` | MD5 与 Node 原生逐字节一致（含全部填充块边界） |
| `npm run test:deep` | 鉴权派生：登录 Cookie、UUID、订阅 token、版本探活 |
| `npm run test:pages` | 内置面板与两个提示页的结构、路由、响应头 |
| `npm run test:regress` | 15 条请求用例与重构前的响应逐项比对 |
| `npm test` | 构建 + 上述全部 |

回归基线 `ref/baseline.json` 来自重构前的单体版（`ref/monolith.js`），
改动行为时**先跑 `npm run baseline` 更新基线并 review diff**，确认是有意为之。

### 本地预览

| 命令 | 说明 |
|---|---|
| `node scripts/preview.mjs [端口]` | 起本地服务（默认 8791），面板跑**真实后端**，保存/重置/日志均生效。已自动注入合法 Cookie，无需登录。清空数据删 `preview/_kv.json` |
| `node scripts/gen-preview.mjs` | 产出 `preview/*.html` 静态页，数据由注入提供，`file://` 双击可看 |
| `node scripts/gen-preview-light.mjs` | 由静态页派生浅色版（需先跑上一条） |

三者共用 `scripts/_harness.mjs` 里的假 CF 环境（凭据、鉴权 Cookie 算法、
请求对象构造），不要在各脚本里另抄一份。浅色版靠 `<html class="force-light">`
让 `assets.js` 的深色媒体查询失效，因此**不需要**在预览脚本里复制设计令牌。

> 沙箱与内置浏览器访问不到 `localhost`，`preview.mjs` 需在本机终端运行。

---

## 六、修改注意事项

1. **不要动 `net/tls.js` 里的 `concatBytes` / `tlsBytes`**：它们与 `utils/bytes.js`
   的 `拼接字节数据` 语义相近但不等价（前者接受普通数字数组用于拼装 TLS 记录）。
   涉及加密握手正确性，刻意保持独立。
2. **空 `catch {}` 有意保留**：绝大多数是 socket / reader 清理与断连兜底，
   静默是正确行为，加日志反而会在每次断连时刷屏。
3. **调试日志一律走 `log()`**：它受 `DEBUG` 环境变量控制。只有后台保存失败、
   CF 用量 API 失败这类运维错误才用 `console.error`。
4. `.gitignore` / `CHANGELOG` 是 GBK/UTF-8 混合编码，用编辑器修改时注意别写坏。