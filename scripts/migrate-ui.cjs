/**
 * 把管理面板标记迁移到 Apple 风格组件词汇
 * 纯字符串替换，覆盖类名与少量属性
 */
const fs = require('fs');

for (const file of ['src/pages/admin.js', 'src/pages/login.js', 'src/pages/errors.js']) {
  let t = fs.readFileSync(file, 'utf8');
  const before = t;

  // 类名迁移
  const map = [
    // 卡片内容区
    [/<div class="body tight">/g, '<div class="body flush">'],
    // 徽章 → pill
    [/<span class="badge([^"]*)">/g, '<span class="pill$1">'],
    // 按钮色调
    [/class="btn primary"/g, 'class="btn primary"'],
    [/class="btn ghost sm"/g, 'class="btn quiet sm"'],
    [/class="btn sm"/g, 'class="btn quiet sm"'],
    [/class="btn danger"/g, 'class="btn danger"'],
    // 提示条
    [/<div id="msg" class="notice" hidden><\/div>/g, '<div id="msg" class="notice" hidden></div>'],
    // 提示条类名（JS 里）
    [/className = 'notice ' \+/g, "className = 'notice ' +"],
    [/msg\.className = 'notice ' \+ \(kind \|\| ''\);/g, "msg.className = 'notice ' + (kind || '');"],
  ];
  for (const [from, to] of map) t = t.replace(from, to);

  fs.writeFileSync(file, t);
  console.log(`${file}: ${before === t ? '无变化' : '已迁移'}`);
}