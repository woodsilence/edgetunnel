/**
 * 内置提示页
 *
 * 分别对应原先从外部 Pages 拉取的 /noADMIN 与 /noKV：
 *   - noADMIN：未配置 ADMIN 环境变量
 *   - noKV   ：未绑定 KV 命名空间
 * 两者原本返回 404，这里沿用相同状态码，仅替换展示内容。
 */
import { page } from './assets.js';

/** 通用提示页骨架 */
function noticePage(title, badge, heading, desc, hint) {
  return page(title, `
<div class="login-wrap">
  <div class="login-card" style="max-width:440px">
    <div class="brand">
      <div class="logo">!</div>
      <h1>${heading}</h1>
      <p>${desc}</p>
    </div>
    <div class="card">
      <div class="body">
        <div class="row" style="justify-content:center;margin-bottom:14px">
          <span class="badge ${badge.kind}">${badge.text}</span>
        </div>
        <div style="font-size:13px;line-height:1.75">${hint}</div>
      </div>
    </div>
  </div>
</div>`);
}

/** 未配置 ADMIN */
export const NO_ADMIN_HTML = noticePage(
  'edgetunnel · 未完成配置',
  { kind: 'err', text: '未配置' },
  '尚未设置管理员密码',
  'Worker 检测到 ADMIN 环境变量为空',
  `
  <p class="muted" style="margin:0 0 10px">请在 Cloudflare 控制台中为该 Worker 添加环境变量：</p>
  <pre class="code">变量名：ADMIN
变量值：你的管理密码</pre>
  <p class="muted" style="margin:14px 0 0;font-size:12.5px">
    设置后重新部署，然后访问 <code class="mono">/login</code> 即可进入管理面板。
    注意：修改 ADMIN 会同时轮换客户端 UUID 与订阅地址。
  </p>
  `
);

/** 未绑定 KV */
export const NO_KV_HTML = noticePage(
  'edgetunnel · 未绑定 KV',
  { kind: 'err', text: '缺少 KV' },
  '尚未绑定 KV 命名空间',
  '配置、日志与优选 IP 均依赖 KV 存储',
  `
  <p class="muted" style="margin:0 0 10px">在 Cloudflare 控制台的「绑定」中新增：</p>
  <pre class="code">类型：KV Namespace
变量名：KV</pre>
  <p class="muted" style="margin:14px 0 0;font-size:12.5px">
    变量名必须为 <code class="mono">KV</code>（不可修改）。绑定后重新部署即可。
  </p>
  `
);