/**
 * 生成后的后处理：修补三处「拆分模块特有」的问题
 *
 * 1. constants.js —— 可变状态提升到 state.js，此处改为透传
 * 2. subscription.js —— 读取config_JSON 内部改用局部变量，避免给 import 绑定赋值
 * 3. index.js —— 按真实归属重写 import
 *
 * 之所以做成脚本而非手工编辑：generate-modules.mjs 可重复执行，
 * 手工改动会被覆盖；后处理保证「生成 → 修补」流水线可重放。
 */
const fs = require('fs');

const MODULES = JSON.parse(fs.readFileSync('ref/modules.json', 'utf8'));
const decls = JSON.parse(fs.readFileSync('ref/decls.json', 'utf8'));

/** 符号 → 模块文件 */
const owner = new Map();
for (const m of MODULES) {
  for (const [a, b] of m.ranges) {
    for (const d of decls) if (d.start >= a && d.end <= b && d.name) owner.set(d.name, m.file);
  }
}
// 符号归属完全由 modules.json 推导，不做任何人工覆盖
// Version 是第 1 行的 `const Version = '...'`（提取器未收录，这里补上）
owner.set('Version', 'src/constants.js');

// state.js 持有的可变状态（由 index 统一提交，不从其它模块 import）
const STATE = new Set([
  '初始化共享状态', 'config_JSON', '调试日志打印', '预加载竞速拨号',
  '反代并发拨号数', 'TCP并发拨号数', '缓存SOCKS5白名单', 'SOCKS5白名单',
]);

const log = (ok, msg) => console.log(`  ${ok ? '✔' : '✘'} ${msg}`);

// ─────────────────────────────────────────────────────────────
// 1. constants.js：去掉本地可变状态，改为从 state.js 透传
// ─────────────────────────────────────────────────────────────
{
  let t = fs.readFileSync('src/constants.js', 'utf8');
  const MUTABLE = ['config_JSON', '调试日志打印', 'TCP并发拨号数', '反代并发拨号数', '预加载竞速拨号', '缓存SOCKS5白名单', 'SOCKS5白名单'];

  // 删掉本地的 let 声明行
  t = t.split('\n').filter(line => {
    if (!/^let /.test(line)) return true;
    return !MUTABLE.some(m => line.startsWith(`let ${m}`));
  }).join('\n');

  // 插入前先清掉生成器可能已加入的 state.js import，避免重复声明
  t = t.replace(/^import \{[^}]*\} from '\.\/state\.js';\n/gm, '');
  const imp = `import { ${MUTABLE.join(', ')} } from './state.js';`;
  t = t.replace(/(\*\/\n)\n/, `$1\n${imp}\n`);

  // 末尾追加透传导出：先从生成器产出的 export 中剔除可变状态，避免重复导出
  const m = t.match(/^export \{([^}]*)\};/m);
  if (m) {
    const original = m[1].split(',').map(s => s.trim()).filter(Boolean);
    const pure = original.filter(s => !MUTABLE.includes(s));
    const lines = [];
    if (pure.length) lines.push(`export { ${pure.join(', ')} };`);
    lines.push('// 兼容层：可变状态统一由 state.js 持有，此处透传供既有引用方使用');
    lines.push(`export { ${MUTABLE.join(', ')} };`);
    t = t.replace(m[0], lines.join('\n'));
  }
  fs.writeFileSync('src/constants.js', t);
  log(true, 'constants.js 已改为从 state.js 透传可变状态');
}

// ─────────────────────────────────────────────────────────────
// 2. subscription.js：读取config_JSON 内部局部化
// ─────────────────────────────────────────────────────────────
{
  let t = fs.readFileSync('src/subscription.js', 'utf8');
  const START = t.indexOf('async function 读取config_JSON(');
  if (START === -1) { console.log('  ! 未找到 读取config_JSON'); process.exit(1); }

  // 函数体范围：从声明行到其闭合大括号（用括号深度追踪，避开改名问题）
  let depth = 0, started = false, END = -1;
  for (let i = START; i < t.length; i++) {
    for (const ch of t[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') { depth--; if (started && depth === 0) { END = i + 1; break; } }
    }
    if (END !== -1) break;
  }
  let fn = t.slice(START, END);

  // 1) 函数体内所有 config_JSON 改为局部变量（幂等：已是局部名则跳过）
  fn = fn.replace(/\bconfig_JSON\b/g, '局部配置');
  // 2) 还原被误改的函数名
  fn = fn.replace(/function 读取局部配置\(/, 'function 读取config_JSON(');
  // 3) 确保局部声明存在（幂等）
  if (!/^\tlet 局部配置 = null;$/m.test(fn)) {
    fn = fn.replace(
      /(async function 读取config_JSON\([^\n]*\{\n)/,
      `$1\t// 本函数返回配置对象，交由调用方发布到 state.js；\n\t// 全程使用局部变量，避免给 import 进来的实时绑定赋值。\n\tlet 局部配置 = null;\n`
    );
  }
  t = t.slice(0, START) + fn + t.slice(END);
  fs.writeFileSync('src/subscription.js', t);

  const bad = (t.match(/^\s*config_JSON = /gm) || []).length;
  const hasDecl = t.includes('let 局部配置 = null;');
  log(bad === 0 && hasDecl, `subscription.js 已局部化（裸赋值 ${bad}，局部声明 ${hasDecl ? '有' : '缺失'}）`);
}

// ─────────────────────────────────────────────────────────────
// 3. index.js：按 owner 重写 import
// ─────────────────────────────────────────────────────────────
{
  let t = fs.readFileSync('src/index.js', 'utf8');

  // index 需要的符号：扫描 export default 之后的实际引用，按真实归属分组
  // （不再手工列举，避免遗漏 —— 例如 Version 就藏在多变量声明里）
  const bodyStart = t.indexOf('export default {');
  if (bodyStart === -1) { console.log('  ! 未找到 export default'); process.exit(1); }
  const header = t.slice(0, bodyStart);
  const body = t.slice(bodyStart);

  const LOCAL = new Set(['config_JSON', '管理员密码', '加密秘钥', 'userID']);
  const wanted = [...new Set(
    [...decls.map(d => d.name), 'Version']
      .filter(n => n && !LOCAL.has(n) && body.includes(n))
  )];

  // 按归属模块分组
  const byMod = new Map();
  for (const s of wanted) {
    if (STATE.has(s)) continue;
    const f = owner.get(s);
    if (!f) { console.log(`  ! ${s} 无归属，跳过`); continue; }
    if (!byMod.has(f)) byMod.set(f, []);
    byMod.get(f).push(s);
  }

  // 生成 import 块（按文件路径排序，路径相对 src/）
  const imports = [];
  for (const [file, names] of byMod) {
    let rel = './' + file.replace(/^src\//, '');
    imports.push(`import { ${names.join(', ')} } from '${rel}';`);
  }
  imports.push(`import { ${[...STATE].join(', ')} } from './state.js';`);

  // 只替换文件顶部的 import 区域（连续的 import 行），不动其余内容
  const importBlockRe = /import [\s\S]*?;\n(?=\n|\/\*\*|async function)/;
  const m = t.match(importBlockRe);
  if (!m) { console.log('  ! 未找到 import 区域'); process.exit(1); }
  t = t.replace(importBlockRe, imports.join('\n') + '\n');

  fs.writeFileSync('src/index.js', t);
  log(true, `index.js import 已按归属重建（${byMod.size} 个模块）`);
}

console.log('后处理完成');

// ─────────────────────────────────────────────────────────────
// 4. index.js：把 config_JSON 的直接赋值改为经 载入配置()
//    （放在最后，因为需要重新读回 index.js）
// ─────────────────────────────────────────────────────────────
{
  let t = fs.readFileSync('src/index.js', 'utf8');
  const before = (t.match(/^\s*config_JSON = /gm) || []).length;

  // 三处调用点：config_JSON = await 读取config_JSON(...)  →  await 载入配置(...)
  t = t.replace(
    /^(\s*)config_JSON = await 读取config_JSON\(env, host, userID, UA\);$/gm,
    '$1await 载入配置(env, host, userID, UA);'
  );
  t = t.replace(
    /^(\s*)config_JSON = await 读取config_JSON\(env, host, userID, UA, true\);$/gm,
    '$1await 载入配置(env, host, userID, UA, true);'
  );

  // 补上 载入配置 辅助函数（若模板尚未包含）
  if (!t.includes('async function 载入配置(')) {
    const HELPER = [
      '/**',
      ' * 读取配置并发布到共享状态。',
      ' *',
      ' * 拆分模块后 config_JSON 是 state.js 的实时绑定，不可直接赋值；',
      ' * 这里把「读取 + 发布」收敛成一步，调用点保持简洁。',
      ' *',
      ' * @param {any} env Worker 环境变量',
      ' * @param {string} host 订阅主域名',
      ' * @param {string} userID 派生 UUID',
      ' * @param {string} UA 请求 UA',
      ' * @param {boolean} [重置配置] 为 true 时忽略 KV 缓存并重置为默认值',
      ' */',
      'async function 载入配置(env, host, userID, UA, 重置配置 = false) {',
      '\t初始化共享状态({ config_JSON: await 读取config_JSON(env, host, userID, UA, 重置配置) });',
      '\treturn config_JSON;',
      '}',
      '',
      '',
    ].join('\n');
    t = t.replace('export default {', HELPER + 'export default {');
  }

  fs.writeFileSync('src/index.js', t);
  const after = (t.match(/^\s*config_JSON = /gm) || []).length;
  log(after === 0, `index.js config_JSON 赋值: ${before} → ${after}`);
}