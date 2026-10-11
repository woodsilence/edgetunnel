// 把面板 JS 里的标签页选择器从 .tabs 改为 .seg（分段控件）
const fs = require('fs');
const f = 'src/pages/admin.js';
let t = fs.readFileSync(f, 'utf8');

const before = t;
t = t.split("querySelectorAll('.tabs button')").join("querySelectorAll('.seg button')");
t = t.split(".tabs button:hover").join(".seg button:hover");

fs.writeFileSync(f, t);
console.log('剩余 .tabs 引用:', (t.match(/\.tabs/g) || []).length);
console.log('.seg button 引用:', (t.match(/\.seg button/g) || []).length);
console.log(before === t ? '无变化' : '已更新');