// page() 已移到 frame.js（避免与 assets.js 形成循环依赖）
const fs = require('fs');
for (const f of ['src/pages/login.js', 'src/pages/errors.js', 'src/pages/admin.js']) {
  let t = fs.readFileSync(f, 'utf8');
  t = t.split("import { page } from './assets.js'").join("import { page } from './frame.js'");
  fs.writeFileSync(f, t);
  console.log('✔', f);
}