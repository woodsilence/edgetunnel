/**
 * 将入口主体装配进 src/index.js
 *
 * 背景：单体版把这些变量声明在文件顶层 `let`，fetch() 可直接赋值。
 * 拆分到 ES module 后，import 进来的绑定**不可赋值**（ESM 规定），
 * 因此改为：先算到局部变量（__ 前缀），再调用 初始化共享状态() 一次性提交。
 * 语义与单体版完全一致 —— 每次请求开头按 env 覆写一次。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let body = readFileSync(join(ROOT, 'ref', 'entry-body.js'), 'utf8');

const T = '\t\t';   // fetch() 方法体缩进
const TT = '\t\t\t'; // 对象字面量成员缩进

// 共享状态提交块（用数组拼接，避免模板字符串里 '}' 与 '${' 的歧义）
const STATE_BLOCK = [
  T + '// SOCKS5 白名单：首次请求解析 GO2SOCKS5 后缓存，后续请求直接复用',
  T + 'let __SOCKS5白名单 = 缓存SOCKS5白名单 === null ? SOCKS5白名单 : 缓存SOCKS5白名单;',
  T + 'let __缓存SOCKS5白名单 = 缓存SOCKS5白名单;',
  T + 'if (__缓存SOCKS5白名单 === null) {',
  TT + 'if (env.GO2SOCKS5) __SOCKS5白名单 = [...new Set(__SOCKS5白名单.concat(await 整理成数组(env.GO2SOCKS5)))];',
  TT + '__缓存SOCKS5白名单 = __SOCKS5白名单;',
  T + '}',
  '',
  T + '// 一次性提交本请求的运行期状态（拆分模块后跨文件共享状态统一走 state.js）',
  T + '初始化共享状态({',
  TT + '调试日志打印: __调试日志打印,',
  TT + '预加载竞速拨号: __预加载竞速拨号,',
  TT + '反代并发拨号数: __反代并发拨号数,',
  TT + 'TCP并发拨号数: __TCP并发拨号数,',
  TT + '缓存SOCKS5白名单: __缓存SOCKS5白名单,',
  TT + 'SOCKS5白名单: __SOCKS5白名单,',
  T + '});',
].join('\n');

/** 精确替换 */
function mustReplace(from, to) {
  if (!body.includes(from)) {
    console.error('✘ 未匹配:\n' + JSON.stringify(from.slice(0, 120)));
    process.exit(1);
  }
  body = body.replace(from, to);
}

mustReplace(
  T + "调试日志打印 = ['1', 'true'].includes(env.DEBUG) || 调试日志打印;",
  T + "const __调试日志打印 = ['1', 'true'].includes(env.DEBUG) || 调试日志打印;"
);
mustReplace(
  T + "预加载竞速拨号 = ['1', 'true'].includes(env.PRELOAD_RACE_DIAL) || 预加载竞速拨号;",
  T + "const __预加载竞速拨号 = ['1', 'true'].includes(env.PRELOAD_RACE_DIAL) || 预加载竞速拨号;"
);
mustReplace(
  T + '反代并发拨号数 = Math.max(1, Number(env.PROXY_CONCURRENT_DIAL) || 反代并发拨号数);',
  T + 'let __反代并发拨号数 = Math.max(1, Number(env.PROXY_CONCURRENT_DIAL) || 反代并发拨号数);'
);
mustReplace(
  T + 'TCP并发拨号数 = Math.max(1, Number(env.TCP_CONCURRENT_DIAL) || TCP并发拨号数);',
  T + 'let __TCP并发拨号数 = Math.max(1, Number(env.TCP_CONCURRENT_DIAL) || TCP并发拨号数);'
);
mustReplace(
  T + "if (!env.TCP_CONCURRENT_DIAL && TCP并发拨号数 !== 1 && 识别运营商(request) === 'cmcc') TCP并发拨号数 = 1;",
  T + "if (!env.TCP_CONCURRENT_DIAL && __TCP并发拨号数 !== 1 && 识别运营商(request) === 'cmcc') __TCP并发拨号数 = 1;"
);
mustReplace(
  T + 'if (缓存SOCKS5白名单 === null) {\n' +
  TT + 'if (env.GO2SOCKS5) SOCKS5白名单 = [...new Set(SOCKS5白名单.concat(await 整理成数组(env.GO2SOCKS5)))];\n' +
  TT + '缓存SOCKS5白名单 = SOCKS5白名单;\n' +
  T + '} else SOCKS5白名单 = 缓存SOCKS5白名单;',
  STATE_BLOCK
);

const tpl = readFileSync(join(ROOT, 'scripts', 'index.template.js'), 'utf8');
if (!tpl.includes('/*__ENTRY_BODY__*/')) {
  console.error('✘ 模板缺少 /*__ENTRY_BODY__*/ 标记');
  process.exit(1);
}
const out = tpl.replace('/*__ENTRY_BODY__*/', body.trimEnd());
writeFileSync(join(ROOT, 'src', 'index.js'), out);
console.log('✔ index.js 已装配，行数:', out.split('\n').length);