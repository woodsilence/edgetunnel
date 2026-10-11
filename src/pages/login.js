/**
 * 内置登录页
 *
 * 与 Worker 的 `/login` 路由契约：
 *   GET  /login        → 返回本页
 *   POST /login        → body 为 application/x-www-form-urlencoded 的 password=xxx
 *                        密码正确 → {success:true} + Set-Cookie: auth=…
 *                        密码错误 → 200 但 {success:false}
 *
 * 提交后由 Worker 下发 HttpOnly Cookie，故此处不接触密钥。
 */
import { page } from './assets.js';

export const LOGIN_HTML = page('edgetunnel · 管理登录', `
<div class="login-wrap">
  <div class="login-card">
    <div class="brand">
      <div class="logo">E</div>
      <h1>edgetunnel</h1>
      <p>边缘隧道管理面板</p>
    </div>

    <div class="card">
      <div class="body">
        <div id="msg" class="notice" hidden></div>
        <div class="field">
          <label for="pw">管理员密码</label>
          <input id="pw" type="password" autocomplete="current-password"
                 placeholder="请输入 ADMIN 密码" autofocus>
        </div>
        <button id="submit" class="btn primary" style="width:100%">登录</button>
        <p class="hint" style="text-align:center;margin:14px 0 0">
          密码由环境变量 <code class="mono">ADMIN</code> 决定
        </p>
      </div>
    </div>
  </div>
</div>

<script>
(function () {
  var pw = document.getElementById('pw');
  var btn = document.getElementById('submit');
  var msg = document.getElementById('msg');

  function notify(text, kind) {
    msg.textContent = text;
    msg.className = 'notice ' + (kind || '');
    msg.hidden = false;
  }

  async function submit() {
    if (!pw.value) { notify('请输入密码', 'warn'); pw.focus(); return; }
    btn.disabled = true;
    btn.textContent = '登录中…';
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'password=' + encodeURIComponent(pw.value)
      });
      const data = await res.json().catch(function () { return {}; });
      if (data.success) {
        notify('登录成功，正在跳转…', 'ok');
        location.replace('/admin');
        return;
      }
      notify('密码错误，请重试', 'err');
      pw.select();
    } catch (e) {
      notify('网络异常：' + e.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '登录';
    }
  }

  btn.addEventListener('click', submit);
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
})();
</script>
`);