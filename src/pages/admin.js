/**
 * 内置管理面板
 *
 * 严格对齐 Worker 已有的后台 API（未新增后端接口）：
 *   GET  /admin/config.json        读取配置        → config_JSON
 *   POST /admin/config.json        保存配置        {…} → {success:true}
 *   GET  /admin/init               重置为默认值    → config_JSON（含 init 提示）
 *   POST /admin/cf.json            保存 CF 凭据    {Email,GlobalAPIKey} 或 {AccountID,APIToken} 或 {UsageAPI} 或 {init:true}
 *   GET  /admin/cf.json            读取 request.cf
 *   POST /admin/tg.json            保存 TG 通知    {BotToken,ChatID} 或 {init:true}
 *   POST /admin/ADD.txt            保存优选 IP     纯文本
 *   GET  /admin/ADD.txt            读取优选 IP     纯文本
 *   GET  /admin/log.json           读取日志        → 数组
 *   GET  /admin/getADDAPI?url=&port=  校验优选 API → {success,data}
 *   GET  /admin/check?socks5=…     代理连通性检测  → {success,proxy,ip,loc,responseTime}
 *   GET  /admin/getCloudflareUsage?Email=&GlobalAPIKey=…  查询账户用量
 *   POST /logout                   退出登录
 */
import { page } from './frame.js';

export const ADMIN_HTML = page('edgetunnel · 管理面板', `
<div class="wrap">
  <header class="top">
    <h1>edgetunnel 管理面板</h1>
    <span class="badge" id="badge-node">节点加载中…</span>
    <span class="spacer"></span>
    <span class="ver" id="ver"></span>
    <button class="btn quiet sm" id="btn-refresh">刷新</button>
    <a class="btn quiet sm" href="/logout">退出</a>
  </header>

  <div id="msg" class="notice" hidden></div>

  <nav class="seg" role="tablist">
    <button role="tab" aria-selected="true"  data-tab="overview">概览</button>
    <button role="tab" aria-selected="false" data-tab="basic">基础</button>
    <button role="tab" aria-selected="false" data-tab="advanced">进阶</button>
    <button role="tab" aria-selected="false" data-tab="subscribe">订阅</button>
    <button role="tab" aria-selected="false" data-tab="proxy">优选</button>
    <button role="tab" aria-selected="false" data-tab="integrations">集成</button>
    <button role="tab" aria-selected="false" data-tab="logs">日志</button>
  </nav>

  <!-- ───────── 概览 ───────── -->
  <section class="tabpanel" data-panel="overview">
    <div class="stats">
      <div class="stat"><div class="k">协议</div><div class="v" id="o-proto">—</div></div>
      <div class="stat"><div class="k">传输</div><div class="v" id="o-trans">—</div></div>
      <div class="stat"><div class="k">UUID</div><div class="v mono" id="o-uuid" style="font-size:14px">—</div></div>
      <div class="stat"><div class="k">订阅条目</div><div class="v" id="o-count">—</div></div>
      <div class="stat"><div class="k">CF 机房</div><div class="v" id="o-colo" style="font-size:20px">—</div></div>
    </div>

    <div class="card">
      <div class="head">节点信息 <span class="spacer"></span><span class="badge" id="o-time">—</span></div>
      <div class="body">
        <table class="data"><tbody id="o-info"></tbody></table>
      </div>
    </div>

    <div class="card">
      <div class="head">快速操作</div>
      <div class="body">
        <div class="row">
          <button class="btn" id="q-copy-sub">复制订阅地址</button>
          <button class="btn" id="q-copy-uuid">复制 UUID</button>
          <button class="btn danger" id="q-reset">重置全部配置</button>
        </div>
        <p class="hint" style="margin-top:12px">
          重置会覆盖 KV 中的 config.json，且不可撤销。
        </p>
      </div>
    </div>
  </section>

  <!-- ───────── 基础配置 ───────── -->
  <section class="tabpanel" data-panel="basic" hidden>
    <div class="card">
      <div class="head">节点</div>
      <div class="body">
        <div class="grid two">
          <div class="field">
            <label>主域名 HOST</label>
            <input id="c-host" type="text" placeholder="example.com">
            <p class="hint">订阅中节点地址使用的域名，须已绑定自定义域。</p>
          </div>
          <div class="field">
            <label>UUID</label>
            <input id="c-uuid" type="text" class="mono" placeholder="留空则由密码自动派生">
            <p class="hint">填入则强制固定客户端凭据；留空则由 ADMIN+KEY 派生。</p>
          </div>
        </div>
        <div class="field">
          <label>完整节点路径</label>
          <input id="c-path" type="text" class="mono" placeholder="/">
          <p class="hint">WS/gRPC 的接入路径，建议使用较长的随机路径。</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="head">协议与传输</div>
      <div class="body">
        <div class="grid two">
          <div class="field">
            <label>协议类型</label>
            <select id="c-proto">
              <option value="vless">VLESS</option>
              <option value="trojan">Trojan</option>
              <option value="ss">Shadowsocks</option>
            </select>
          </div>
          <div class="field">
            <label>传输协议</label>
            <select id="c-trans">
              <option value="ws">WebSocket</option>
              <option value="grpc">gRPC</option>
              <option value="httpupgrade">HTTPUpgrade</option>
              <option value="xhttp">XHTTP（叉HTTP）</option>
            </select>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>gRPC 模式</label>
            <select id="c-grpcmode">
              <option value="gun">gun</option>
              <option value="multi">multi</option>
            </select>
          </div>
          <div class="field">
            <label>Shadowsocks 加密方式</label>
            <select id="c-ssmethod">
              <option value="aes-128-gcm">aes-128-gcm</option>
              <option value="aes-256-gcm">aes-256-gcm</option>
            </select>
            <p class="hint">仅在协议为 Shadowsocks 时生效。</p>
          </div>
        </div>
        <div class="row">
          <label class="switch"><input type="checkbox" id="c-sstls"><span class="track"></span>Shadowsocks 启用 TLS</label>
          <label class="switch"><input type="checkbox" id="c-skipcert"><span class="track"></span>跳过证书验证</label>
          <label class="switch"><input type="checkbox" id="c-0rtt"><span class="track"></span>启用 0-RTT</label>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="head">订阅输出</div>
      <div class="body">
        <div class="grid two">
          <div class="field">
            <label>节点备注名</label>
            <input id="c-subname" type="text" placeholder="EDT">
          </div>
          <div class="field">
            <label>TLS 分片</label>
            <select id="c-frag">
              <option value="">不启用</option>
              <option value="Shadowrocket">Shadowrocket</option>
              <option value="v2rayN">v2rayN</option>
            </select>
          </div>
        </div>
        <div class="row">
          <label class="switch"><input type="checkbox" id="c-b64"><span class="track"></span>Base64 编码订阅</label>
          <label class="switch"><input type="checkbox" id="c-sort"><span class="track"></span>按名称排序</label>
          <label class="switch"><input type="checkbox" id="c-randpath"><span class="track"></span>随机路径伪装</label>
        </div>
      </div>
    </div>
  </section>

  <!-- ───────── 进阶选项 ───────── -->
  <section class="tabpanel" data-panel="advanced" hidden>
    <div class="card">
      <div class="head">ECH（加密客户端问候）</div>
      <div class="body">
        <div class="row" style="margin-bottom:14px">
          <label class="switch"><input type="checkbox" id="c-ech"><span class="track"></span>启用 ECH</label>
        </div>
        <div class="grid two">
          <div class="field">
            <label>ECH SNI</label>
            <input id="c-echsni" type="text" placeholder="cloudflare-ech.com">
          </div>
          <div class="field">
            <label>ECH DNS</label>
            <input id="c-echdns" type="text" placeholder="https://dns.alidns.com/dns-query">
          </div>
        </div>
        <p class="hint">ECH 可隐藏真实 SNI，需要客户端与服务端同时支持。</p>
      </div>
    </div>

    <div class="card">
      <div class="head">反代路径模板</div>
      <div class="body">
        <p class="hint" style="margin-top:0">
          留空则使用内置模板。这些值会作为 <code class="mono">{{IP:PORT}}</code> 的前缀注入订阅节点路径。
        </p>
        <div id="proxy-templates"></div>
      </div>
    </div>
  </section>

  <!-- ───────── 订阅生成 ───────── -->
  <section class="tabpanel" data-panel="subscribe" hidden>
    <div class="card">
      <div class="head">订阅地址</div>
      <div class="body">
        <div class="field">
          <label>完整订阅链接</label>
          <input id="sub-url" type="text" class="mono" readonly>
          <p class="hint">客户端会自动按 UA 识别格式（Clash / Sing-box / Surge / v2rayN 等）。</p>
        </div>
        <div class="row">
          <button class="btn" id="s-copy">复制</button>
          <button class="btn" id="s-open">在新窗口打开</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="head">预览</div>
      <div class="body flush"><pre class="code" id="sub-preview">加载中…</pre></div>
    </div>
  </section>

  <!-- ───────── 优选与代理 ───────── -->
  <section class="tabpanel" data-panel="proxy" hidden>
    <div class="card">
      <div class="head">优选 IP 列表 <span class="spacer"></span><span class="badge" id="ip-count">—</span></div>
      <div class="body">
        <p class="hint" style="margin-top:0">
          每行一个，支持 <code class="mono">IP:端口#备注</code>、<code class="mono">https://优选API</code>、
          <code class="mono">sub://优选API</code>，以及 <code class="mono">域名</code>（<code class="mono">*</code> 会被替换为随机字符）。
        </p>
        <textarea id="p-ips" placeholder="1.1.1.1:443&#10;https://example.com/api"></textarea>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="p-save">保存</button>
          <button class="btn" id="p-load">重新载入</button>
          <span class="faint small" id="p-hint"></span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="head">优选 API 校验</div>
      <div class="body">
        <div class="row">
          <input id="a-url" type="text" placeholder="https://example.com/api.txt" style="flex:1;min-width:220px">
          <input id="a-port" type="text" placeholder="443" style="width:100px">
          <button class="btn" id="a-test">测试</button>
        </div>
        <div id="a-result" class="stack" style="margin-top:14px"></div>
      </div>
    </div>

    <div class="card">
      <div class="head">代理连通性检测</div>
      <div class="body">
        <div class="row">
          <select id="c-proto2" style="width:130px">
            <option value="socks5">SOCKS5</option>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="turn">TURN</option>
            <option value="sstp">SSTP</option>
          </select>
          <input id="c-addr" type="text" class="mono" placeholder="user:pass@host:port" style="flex:1;min-width:200px">
          <button class="btn" id="c-run">检测</button>
        </div>
        <div id="c-result" class="stack" style="margin-top:14px"></div>
      </div>
    </div>
  </section>

  <!-- ───────── 通知与用量 ───────── -->
  <section class="tabpanel" data-panel="integrations" hidden>
    <div class="card">
      <div class="head">Telegram 通知</div>
      <div class="body">
        <div class="grid two">
          <div class="field">
            <label>Bot Token</label>
            <input id="t-token" type="text" class="mono" placeholder="123456:ABC-DEF">
          </div>
          <div class="field">
            <label>Chat ID</label>
            <input id="t-chat" type="text" class="mono" placeholder="-1001234567890">
          </div>
        </div>
        <div class="row">
          <button class="btn primary" id="t-save">保存</button>
          <button class="btn danger" id="t-clear">清除</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="head">Cloudflare 凭据</div>
      <div class="body">
        <p class="hint" style="margin-top:0">用于查询账户用量。三选一保存即可。</p>
        <div class="grid two">
          <div class="field">
            <label>Account ID</label>
            <input id="cf-account" type="text" class="mono" placeholder="32 位十六进制">
          </div>
          <div class="field">
            <label>API Token</label>
            <input id="cf-token" type="text" class="mono" placeholder="CF API Token">
          </div>
        </div>
        <div class="divider"></div>
        <div class="field">
          <label>Email（与 Global API Key 搭配）</label>
          <input id="cf-email" type="text" placeholder="you@example.com">
        </div>
        <div class="field">
          <label>Global API Key</label>
          <input id="cf-key" type="password" class="mono" placeholder="Global API Key">
        </div>
        <div class="row">
          <button class="btn primary" id="cf-save-token">保存 Token 方式</button>
          <button class="btn" id="cf-save-key">保存 Key 方式</button>
        </div>
        <div id="cf-result" class="stack" style="margin-top:14px"></div>
      </div>
    </div>
  </section>

  <!-- ───────── 日志 ───────── -->
  <section class="tabpanel" data-panel="logs" hidden>
    <div class="card">
      <div class="head">请求日志 <span class="spacer"></span><span class="badge" id="log-count">—</span></div>
      <div class="body tight scroll">
        <table class="data">
          <thead><tr><th>时间</th><th>类型</th><th>IP</th><th>UA</th><th>备注</th></tr></thead>
          <tbody id="log-body"></tbody>
        </table>
        <div class="empty" id="log-empty">暂无日志</div>
      </div>
    </div>
  </section>

  <div class="row" style="margin-top:20px">
    <button class="btn primary" id="save-main" style="min-width:150px">保存配置</button>
    <span class="faint small">修改后需保存；节点订阅会在下次拉取时生效。</span>
  </div>
</div>

<script>
(function () {
'use strict';

var CFG = null;               // /admin/config.json 的内容
var GEO = null;               // /admin/cf.json 的内容，即本次请求命中的 CF 机房与访客来源
var MSG_TIMER = null;

/* ---------- 工具 ---------- */
function $(id) { return document.getElementById(id); }

/** 把 ISO 时间戳压成「MM-DD HH:mm」以便在徽章里显示 */
function 格式化时间(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 16).replace('T', ' ');
  var p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function notify(text, kind) {
  var el = $('msg');
  el.textContent = text;
  el.className = 'notice ' + (kind || '');
  el.hidden = false;
  if (MSG_TIMER) clearTimeout(MSG_TIMER);
  MSG_TIMER = setTimeout(function () { el.hidden = true; }, kind === 'err' ? 8000 : 3000);
}

async function api(url, opts) {
  var res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts));
  var ct = res.headers.get('content-type') || '';
  if (ct.indexOf('json') >= 0) return await res.json();
  var text = await res.text();
  return { _text: text, _status: res.status };
}

function jfetch(url, method, body) {
  return api(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify('已复制到剪贴板', 'ok');
  } catch (e) {
    // 非安全上下文下 clipboard API 不可用，退回选中提示
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); notify('已复制', 'ok'); }
    catch (_) { notify('复制失败，请手动选择', 'warn'); }
    document.body.removeChild(ta);
  }
}

/* ---------- 标签页 ---------- */
document.querySelectorAll('.seg button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var name = btn.dataset.tab;
    document.querySelectorAll('.seg button').forEach(function (b) {
      b.setAttribute('aria-selected', String(b === btn));
    });
    document.querySelectorAll('.tabpanel').forEach(function (p) {
      p.hidden = p.dataset.panel !== name;
    });
    if (name === 'logs') loadLogs();
    if (name === 'subscribe') loadSubPreview();
  });
});

/* ---------- 加载配置 ---------- */
async function loadConfig() {
  try {
    const data = await api('/admin/config.json');
    // 接口异常时不要清空已有内容，避免一次网络抖动把面板整个清零
    if (data && typeof data === 'object' && !data.error) {
      CFG = data;
      render();
    } else {
      notify('配置格式异常：' + (data && data.error ? data.error : '未知'), 'err');
    }
  } catch (e) {
    notify('加载配置失败：' + e.message + (CFG ? '（保留当前显示）' : ''), 'err');
  }
}

/* ---------- 机房 / 地区 ---------- */

// Cloudflare 机房用的是 IATA 三字码，这里补一张常用表用于可读性；
// 表里没有的直接显示原始码，不会因此丢信息。
var COLO_CITY = {
  HKG: '香港', TPE: '台北', NRT: '东京', KIX: '大阪', ICN: '首尔',
  SIN: '新加坡', BKK: '曼谷', KUL: '吉隆坡', SGN: '胡志明市', HAN: '河内',
  DAD: '岘港', PNH: '金边', MNL: '马尼拉', CGK: '雅加达', DPS: '登巴萨',
  SUB: '泗水', KTM: '加德满都', DAC: '达卡', MAA: '钦奈', BOM: '孟买',
  DEL: '德里', BLR: '班加罗尔', HYD: '海得拉巴', KHI: '卡拉奇',
  DXB: '迪拜', DOH: '多哈', RUH: '利雅得', JED: '吉达', TLV: '特拉维夫',
  IST: '伊斯坦布尔', MOW: '莫斯科', FRA: '法兰克福', DUS: '杜塞尔多夫',
  AMS: '阿姆斯特丹', BRU: '布鲁塞尔', LHR: '伦敦', MAN: '曼彻斯特',
  CDG: '巴黎', DUB: '都柏林', MAD: '马德里', BCN: '巴塞罗那', LIS: '里斯本',
  MXP: '米兰', FCO: '罗马', ZRH: '苏黎世', VIE: '维也纳', PRG: '布拉格',
  WAW: '华沙', ARN: '斯德哥尔摩', OSL: '奥斯陆', CPH: '哥本哈根', HEL: '赫尔辛基',
  SYD: '悉尼', MEL: '墨尔本', BNE: '布里斯班', PER: '珀斯', AKL: '奥克兰',
  GRU: '圣保罗', GIG: '里约热内卢', EZE: '布宜诺斯艾利斯', SCL: '圣地亚哥',
  LIM: '利马', MEX: '墨西哥城', YYZ: '多伦多', YUL: '蒙特利尔',
  SEA: '西雅图', PDX: '波特兰', SJC: '圣何塞', SMF: '萨克拉门托',
  LAX: '洛杉矶', SAN: '圣迭戈', PHX: '菲尼克斯', LAS: '拉斯维加斯',
  SLC: '盐湖城', DEN: '丹佛', DFW: '达拉斯', IAD: '华盛顿', EWR: '纽约',
  ATL: '亚特兰大', MIA: '迈阿密', ORD: '芝加哥', MSP: '明尼阿波利斯',
  AUS: '奥斯汀', IAH: '休斯顿', CLE: '克利夫兰', PIT: '匹兹堡', CMH: '哥伦布',
  IND: '印第安纳波利斯', STL: '圣路易斯', MCI: '堪萨斯城', BNA: '纳什维尔',
  CLT: '夏洛特', RDU: '罗利', BWI: '巴尔的摩', ANC: '安克雷奇', OGG: '毛伊岛',
  HNL: '檀香山', GUM: '关岛', PPT: '帕皮提', JNB: '约翰内斯堡', CPT: '开普敦',
  CAI: '开罗', LOS: '拉各斯', NBO: '内罗毕'
};

// 常见国家/地区代码 → 中文名；未收录时回退到代码本身
var CC_CN = {
  HK: '香港', MO: '澳门', TW: '台湾', JP: '日本', KR: '韩国', SG: '新加坡', MY: '马来西亚',
  TH: '泰国', VN: '越南', PH: '菲律宾', ID: '印尼', IN: '印度', PK: '巴基斯坦', BD: '孟加拉',
  AU: '澳大利亚', NZ: '新西兰', US: '美国', CA: '加拿大', GB: '英国', DE: '德国', FR: '法国',
  NL: '荷兰', RU: '俄罗斯', BR: '巴西', AR: '阿根廷', CL: '智利', PE: '秘鲁', MX: '墨西哥',
  AE: '阿联酋', SA: '沙特', TR: '土耳其', IL: '以色列', IT: '意大利', ES: '西班牙',
  SE: '瑞典', NO: '挪威', DK: '丹麦', FI: '芬兰', PL: '波兰', CZ: '捷克', AT: '奥地利',
  CH: '瑞士', BE: '比利时', IE: '爱尔兰', PT: '葡萄牙', ZA: '南非', EG: '埃及', NG: '尼日利亚',
  CN: '中国', KP: '朝鲜', MN: '蒙古', KH: '柬埔寨', LA: '老挝', MM: '缅甸', BN: '文莱'
};

function 地区名称(cc, city) {
  var 国家 = String(cc || '').toUpperCase();
  var 中文 = CC_CN[国家];
  var 城市名 = String(city || '').trim();
  if (中文 && 城市名 && 城市名 !== 中文) return 中文 + ' · ' + 城市名;
  return 中文 || 城市名 || 国家 || '—';
}

/**
 * 读取本次请求命中的 CF 机房与访客来源。
 *
 * 这里的 colo 不只是「你在哪」：Worker 用它拼反代 IP
 * （index.js 里 默认反代IP 由 request.cf.colo 开头拼成），
 * 所以它同时决定了隧道出口落在哪个机房，也就是订阅里节点的实际地区。
 */
async function loadGeo() {
  try {
    const data = await api('/admin/cf.json');
    if (data && typeof data === 'object' && !data.error) {
      GEO = data;
      renderOverview();
    }
  } catch (e) {
    // 地区信息属于锦上添花，取不到就保持「—」，不弹错误打扰用户
    GEO = null;
  }
}

function val(id, v) {
  var el = $(id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!v;
  else el.value = v === undefined || v === null ? '' : v;
}

function readConfig() {
  if (!CFG) CFG = {};
  CFG.HOST = $('c-host').value.trim();
  CFG.HOSTS = $('c-host').value.trim() ? [$('c-host').value.trim()] : [];
  CFG.UUID = $('c-uuid').value.trim();
  CFG.PATH = $('c-path').value.trim() || '/';
  CFG.协议类型 = $('c-proto').value;
  CFG.传输协议 = $('c-trans').value;
  CFG.gRPC模式 = $('c-grpcmode').value;
  CFG.跳过证书验证 = $('c-skipcert').checked;
  CFG.启用0RTT = $('c-0rtt').checked;
  CFG.随机路径 = $('c-randpath').checked;
  CFG.TLS分片 = $('c-frag').value || null;

  CFG.ECH = $('c-ech').checked;
  CFG.ECHConfig = {
    SNI: $('c-echsni').value.trim() || 'cloudflare-ech.com',
    DNS: $('c-echdns').value.trim() || 'https://dns.alidns.com/dns-query'
  };

  CFG.优选订阅生成 = CFG.优选订阅生成 || {};
  CFG.优选订阅生成.SUBNAME = $('c-subname').value.trim();

  CFG.订阅转换配置 = CFG.订阅转换配置 || {};
  CFG.订阅转换配置.SORT = $('c-sort').checked;

  CFG.SS = CFG.SS || {};
  CFG.SS.加密方式 = $('c-ssmethod').value;
  CFG.SS.TLS = $('c-sstls').checked;
  return CFG;
}

function render() {
  if (!CFG) return;
  val('c-host', CFG.HOST);
  val('c-uuid', CFG.UUID);
  val('c-path', CFG.PATH);
  val('c-proto', CFG.协议类型);
  val('c-trans', CFG.传输协议);
  val('c-grpcmode', CFG.gRPC模式);
  val('c-ssmethod', (CFG.SS || {}).加密方式);
  val('c-sstls', (CFG.SS || {}).TLS);
  val('c-skipcert', CFG.跳过证书验证);
  val('c-0rtt', CFG.启用0RTT);
  val('c-randpath', CFG.随机路径);
  val('c-subname', (CFG.优选订阅生成 || {}).SUBNAME);
  val('c-frag', CFG.TLS分片);
  val('c-sort', (CFG.订阅转换配置 || {}).SORT);
  val('c-ech', CFG.ECH);
  val('c-echsni', (CFG.ECHConfig || {}).SNI);
  val('c-echdns', (CFG.ECHConfig || {}).DNS);
  renderTemplates();
  renderOverview();
  buildSubUrl();
}

function renderOverview() {
  if (!CFG) return;
  $('o-proto').textContent = CFG.协议类型 || '—';
  $('o-trans').textContent = CFG.传输协议 || '—';
  $('o-uuid').textContent = CFG.UUID || '（自动派生）';

  var ips = ((CFG.优选订阅生成 || {}).本地IP库 || {});
  $('o-count').textContent = (ips.随机数量 || 0);
  $('o-time').textContent = 格式化时间(CFG.TIME);
  $('o-time').title = CFG.TIME || '';

  // 机房卡：colo 决定反代 IP，因而决定隧道出口落在哪个地区
  var colo = String((GEO || {}).colo || '').toUpperCase();
  var coloEl = $('o-colo');
  if (colo) {
    coloEl.textContent = colo;
    coloEl.title = 'Cloudflare 机房 ' + colo + '（' + (COLO_CITY[colo] || '未知地区') + '）';
  } else {
    coloEl.textContent = '—';
    coloEl.title = '';
  }

  var g = GEO || {};
  var 网络 = [g.asn ? 'AS' + g.asn : '', g.asOrganization || ''].filter(Boolean).join(' ');

  var rows = [
    ['CF 机房', colo ? colo + (COLO_CITY[colo] ? ' · ' + COLO_CITY[colo] : '') : '—'],
    ['访问来源', 地区名称(g.country, g.city)],
    ['接入网络', 网络 || '—'],
    ['主域名', CFG.HOST || '—'],
    ['节点路径', CFG.PATH || '/'],
    ['节点名称', (CFG.优选订阅生成 || {}).SUBNAME || '—'],
    ['ECH', CFG.ECH ? '已启用' : '未启用'],
    ['0-RTT', CFG.启用0RTT ? '已启用' : '未启用'],
    ['随机路径', CFG.随机路径 ? '已启用' : '未启用'],
    ['配置生成', CFG.TIME || '—'],
    ['加载耗时', CFG.加载时间 || '—']
  ];
  $('o-info').innerHTML = rows.map(function (r) {
    return '<tr><th style="width:150px">' + r[0] + '</th><td class="mono">' +
           String(r[1]).replace(/[<>&]/g, function (m) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]; }) +
           '</td></tr>';
  }).join('');
}

function renderTemplates() {
  var t = (CFG.反代 || {}).路径模板;
  var box = $('proxy-templates');
  if (!t) { box.innerHTML = '<p class="faint small">使用内置模板</p>'; return; }
  var labels = {
    proxyip: '反代 IP', SOCKS5: 'SOCKS5', HTTP: 'HTTP', HTTPS: 'HTTPS',
    TURN: 'TURN', SSTP: 'SSTP'
  };
  box.innerHTML = Object.keys(labels).map(function (k) {
    var v = t[k];
    if (v && typeof v === 'object') v = v.全局 || v.标准 || '';
    return '<div class="field"><label>' + labels[k] + '</label>' +
           '<input type="text" class="mono" data-tpl="' + k + '" value="' +
           String(v || '').replace(/"/g, '&quot;') + '"></div>';
  }).join('');
  box.querySelectorAll('input[data-tpl]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      readConfig();
      var k = inp.dataset.tpl;
      CFG.反代 = CFG.反代 || {}; CFG.反代.路径模板 = CFG.反代.路径模板 || {};
      if (typeof CFG.反代.路径模板[k] === 'object' && CFG.反代.路径模板[k]) {
        CFG.反代.路径模板[k].全局 = inp.value;
      } else {
        CFG.反代.路径模板[k] = inp.value;
      }
    });
  });
}

/* ---------- 订阅 ---------- */
function buildSubUrl() {
  var host = ($('c-host').value || location.hostname);
  var url = location.origin + '/sub?token=' + encodeURIComponent(
    (CFG && CFG.__token) || ''
  );
  // token 由后端校验；此处展示 host 部分即可，完整 token 需登录态下方可获取
  $('sub-url').value = location.origin + '/sub?token=<登录后自动生成>';
}

async function loadSubPreview() {
  var pre = $('sub-preview');
  try {
    var r = await api('/sub');
    if (r._text !== undefined) {
      pre.textContent = '（需要有效 token，请直接访问订阅地址）';
      return;
    }
    pre.textContent = JSON.stringify(r, null, 2).slice(0, 4000);
  } catch (e) {
    pre.textContent = '预览失败：' + e.message;
  }
}

/* ---------- 保存 ---------- */
$('save-main').addEventListener('click', async function () {
  var btn = this;
  readConfig();
  if (!CFG.UUID || !CFG.HOST) {
    notify('HOST 与 UUID 至少要填写一项（UUID 留空表示自动派生）', 'warn');
    return;
  }
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    var r = await jfetch('/admin/config.json', 'POST', CFG);
    if (r.success) { notify('配置已保存', 'ok'); loadConfig(); }
    else notify('保存失败：' + (r.error || '未知错误'), 'err');
  } catch (e) {
    notify('保存失败：' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '保存配置';
  }
});

$('q-reset').addEventListener('click', async function () {
  if (!confirm('确定要重置全部配置吗？此操作不可撤销。')) return;
  try {
    CFG = await api('/admin/init');
    notify('配置已重置为默认值', 'ok');
    render();
  } catch (e) { notify('重置失败：' + e.message, 'err'); }
});

$('btn-refresh').addEventListener('click', function () { loadConfig(); loadGeo(); notify('已刷新', 'ok'); });
$('q-copy-sub').addEventListener('click', function () { copy($('sub-url').value); });
$('q-copy-uuid').addEventListener('click', function () { copy($('c-uuid').value || ''); });
$('s-copy').addEventListener('click', function () { copy($('sub-url').value); });
$('s-open').addEventListener('click', function () { window.open('/sub', '_blank'); });

/* ---------- 优选 IP ---------- */
async function loadIPs() {
  try {
    var r = await api('/admin/ADD.txt');
    $('p-ips').value = r._text === 'null' ? '' : (r._text || '');
    var n = $('p-ips').value.split('\\n').filter(function (x) { return x.trim(); }).length;
    $('ip-count').textContent = n + ' 条';
    $('p-hint').textContent = '';
  } catch (e) { $('p-hint').textContent = '读取失败：' + e.message; }
}
$('p-load').addEventListener('click', loadIPs);
$('p-save').addEventListener('click', async function () {
  var btn = this; btn.disabled = true;
  try {
    await fetch('/admin/ADD.txt', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'text/plain' },
      body: $('p-ips').value
    });
    notify('优选 IP 已保存', 'ok');
    loadIPs();
  } catch (e) { notify('保存失败：' + e.message, 'err'); }
  finally { btn.disabled = false; }
});

/* ---------- 优选 API 校验 ---------- */
$('a-test').addEventListener('click', async function () {
  var box = $('a-result');
  var url = $('a-url').value.trim();
  if (!url) { notify('请输入优选 API 地址', 'warn'); return; }
  box.innerHTML = '<div class="notice">测试中…</div>';
  try {
    var r = await api('/admin/getADDAPI?url=' + encodeURIComponent(url) +
                       '&port=' + encodeURIComponent($('a-port').value || '443'));
    if (!r.success) { box.innerHTML = '<div class="notice err">' + (r.msg || '测试失败') + '</div>'; return; }
    var ips = (r.data || []).slice(0, 40);
    box.innerHTML = '<div class="notice ok">成功，返回 ' + (r.data || []).length + ' 条</div>' +
      '<pre class="code">' + ips.join('\\n').replace(/[<>&]/g, '') + '</pre>';
  } catch (e) { box.innerHTML = '<div class="notice err">' + e.message + '</div>'; }
});

/* ---------- 代理检测 ---------- */
$('c-run').addEventListener('click', async function () {
  var box = $('c-result');
  var proto = $('c-proto2').value;
  var addr = $('c-addr').value.trim();
  if (!addr) { notify('请输入代理地址', 'warn'); return; }
  box.innerHTML = '<div class="notice">检测中…</div>';
  try {
    var r = await api('/admin/check?' + proto + '=' + encodeURIComponent(addr));
    if (r.success) {
      box.innerHTML = '<table class="data"><tbody>' +
        '<tr><th>代理</th><td class="mono">' + r.proxy + '</td></tr>' +
        '<tr><th>出口 IP</th><td class="mono">' + r.ip + '</td></tr>' +
        '<tr><th>地区</th><td>' + r.loc + '</td></tr>' +
        '<tr><th>耗时</th><td>' + r.responseTime + ' ms</td></tr>' +
        '</tbody></table>';
    } else {
      box.innerHTML = '<div class="notice err">' + (r.error || '检测失败') + '</div>';
    }
  } catch (e) { box.innerHTML = '<div class="notice err">' + e.message + '</div>'; }
});

/* ---------- TG ---------- */
$('t-save').addEventListener('click', async function () {
  var body = { BotToken: $('t-token').value.trim(), ChatID: $('t-chat').value.trim() };
  if (!body.BotToken || !body.ChatID) { notify('请填写 Bot Token 与 Chat ID', 'warn'); return; }
  var r = await jfetch('/admin/tg.json', 'POST', body);
  notify(r.success ? 'TG 配置已保存' : ('保存失败：' + r.error), r.success ? 'ok' : 'err');
});
$('t-clear').addEventListener('click', async function () {
  if (!confirm('确定清除 Telegram 配置？')) return;
  var r = await jfetch('/admin/tg.json', 'POST', { init: true });
  notify(r.success ? '已清除' : ('失败：' + r.error), r.success ? 'ok' : 'err');
  $('t-token').value = ''; $('t-chat').value = '';
});

/* ---------- CF ---------- */
$('cf-save-token').addEventListener('click', async function () {
  var body = { AccountID: $('cf-account').value.trim(), APIToken: $('cf-token').value.trim() };
  if (!body.AccountID || !body.APIToken) { notify('请填写 Account ID 与 API Token', 'warn'); return; }
  var r = await jfetch('/admin/cf.json', 'POST', body);
  notify(r.success ? '已保存 Token 方式' : ('失败：' + r.error), r.success ? 'ok' : 'err');
});
$('cf-save-key').addEventListener('click', async function () {
  var body = { Email: $('cf-email').value.trim(), GlobalAPIKey: $('cf-key').value };
  if (!body.Email || !body.GlobalAPIKey) { notify('请填写 Email 与 Global API Key', 'warn'); return; }
  var r = await jfetch('/admin/cf.json', 'POST', body);
  if (r.success) { notify('已保存 Key 方式', 'ok'); $('cf-key').value = ''; }
  else notify('失败：' + r.error, 'err');
});

/* ---------- 日志 ---------- */
async function loadLogs() {
  var body = $('log-body'), empty = $('log-empty');
  try {
    var logs = await api('/admin/log.json');
    if (!Array.isArray(logs) || !logs.length) { empty.hidden = false; return; }
    empty.hidden = true;
    $('log-count').textContent = logs.length + ' 条';
    body.innerHTML = logs.slice(0, 300).map(function (l) {
      var esc = function (s) {
        return String(s === undefined || s === null ? '' : s)
          .replace(/[<>&"]/g, function (m) {
            return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[m];
          });
      };
      return '<tr><td class="mono small">' + esc(格式化时间(l.datetime || l.time || '')) + '</td>' +
             '<td><span class="pill">' + esc(l.reqType || l.type || '') + '</span></td>' +
             '<td class="mono small">' + esc(l.ip || '') + '</td>' +
             '<td class="small faint">' + esc((l.ua || '').slice(0, 40)) + '</td>' +
             '<td class="small muted">' + esc(l.remarks || l.note || '') + '</td></tr>';
    }).join('');
  } catch (e) {
    empty.hidden = false;
    empty.textContent = '日志加载失败：' + e.message;
  }
}

/* ---------- 初始化 ---------- */
loadConfig().then(function () {
  $('ver').textContent = CFG && CFG.VERSION ? ('v' + CFG.VERSION) : '';
  $('badge-node').textContent = (CFG && CFG.HOST) || '未配置';
  $('badge-node').className = CFG && CFG.HOST ? 'badge ok' : 'badge err';
  loadIPs();
});
// 地区信息与配置无关，单独并行拉取；失败静默，不影响面板其余部分
loadGeo();
})();
</script>
`);