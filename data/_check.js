/* _check.js —— 数据质检：结构完整性 + 逐句字数=拼音词数 + 高风险多音字扫描
   用法：node data/_check.js            （扫描全部 db-*.js，输出问题清单与复核清单） */
'use strict';
var fs = require('fs');
var path = require('path');

var DYN = ['先秦', '汉', '魏晋', '南北朝', '唐', '五代十国', '宋', '金', '元', '明', '清', '近现代'];
var THEMES = ['山水田园', '边塞征战', '咏物言志', '思乡怀人', '送别友情', '爱情闺怨',
  '咏史怀古', '哲理禅意', '爱国忧民', '节令风物', '人生感怀', '民生疾苦'];
var ART = ['moon', 'sun', 'mountain', 'water', 'snow', 'rain', 'cloud', 'boat', 'pavilion',
  'house', 'person', 'bird', 'tree', 'willow', 'pine', 'plum', 'bamboo', 'flower',
  'reed', 'flag', 'wine', 'horse', 'bridge', 'night', 'autumn'];
/* 高风险多音字：出现时必须人工核对拼音 */
var RISK = '斜衰骑见胜重还卷咽教行将更间思论簪识得度曲传吹露燕朝长观兴令少好还舍纤裳醒胜差参与称创当弹得省盛重量数落为因为长朝乐血脉宿曾空石见绝说结解抉择殆殆殆殆殆殆殆'.split('');

var dir = __dirname;
var files = fs.readdirSync(dir).filter(function (f) { return /^db-.*\.js$/.test(f); }).sort();
if (!files.length) { console.log('未找到 db-*.js'); process.exit(1); }

var problems = [];
var review = [];
var stats = { poems: 0, lines: 0, chars: 0, authors: {}, dyn: {} };
var seen = {};

files.forEach(function (f) {
  var code = fs.readFileSync(path.join(dir, f), 'utf8');
  var sandbox = { window: {} };
  try {
    new Function('window', code)(sandbox.window);
  } catch (e) {
    problems.push(f + ' 语法/执行错误：' + e.message);
    return;
  }
  var db = sandbox.window.POEM_DB || [];
  if (!db.length) { problems.push(f + ' 没有数据'); return; }
  db.forEach(function (p, i) {
    var id = f + '#' + i + ' ' + (p.title || '?');
    ['title', 'author', 'dynasty', 'form', 'analysis', 'background'].forEach(function (k) {
      if (!p[k] || !String(p[k]).trim()) problems.push(id + ' 缺字段 ' + k);
    });
    if (DYN.indexOf(p.dynasty) < 0) problems.push(id + ' 朝代非法: ' + p.dynasty);
    (p.themes || []).forEach(function (t) { if (THEMES.indexOf(t) < 0) problems.push(id + ' 主题非法: ' + t); });
    if (!p.themes || !p.themes.length) problems.push(id + ' 无主题');
    (p.art || []).forEach(function (a) { if (ART.indexOf(a) < 0) problems.push(id + ' 意象非法: ' + a); });
    if (!p.art || !p.art.length) problems.push(id + ' 无意象');
    var key = (p.author || '') + '|' + (p.title || '');
    if (seen[key]) problems.push(id + ' 与 ' + seen[key] + ' 重复');
    seen[key] = id;
    stats.poems++; stats.authors[p.author] = (stats.authors[p.author] || 0) + 1;
    stats.dyn[p.dynasty] = (stats.dyn[p.dynasty] || 0) + 1;
    var allChars = (p.title || '').replace(/[^一-鿿]/g, '');
    (p.lines || []).forEach(function (L, li) {
      if (!L.text) { problems.push(id + ' 第' + (li + 1) + '句无 text'); return; }
      var han = L.text.replace(/[^一-鿿]/g, '');
      allChars += han;
      stats.lines++; stats.chars += han.length;
      if (!L.py) { problems.push(id + ' 第' + (li + 1) + '句无拼音'); return; }
      var py = String(L.py).trim();
      if (/[^a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]/.test(py)) {
        problems.push(id + ' 第' + (li + 1) + '句拼音含非法字符: ' + py.slice(0, 40));
      }
      var words = py.split(/\s+/).filter(Boolean);
      if (words.length !== han.length) {
        problems.push(id + ' 第' + (li + 1) + '句 字' + han.length + '≠音' + words.length + ' 「' + han + '」');
      }
      if (!L.note || String(L.note).length < 10) problems.push(id + ' 第' + (li + 1) + '句句解过短');
    });
    (p.special || []).forEach(function (s) {
      if (!s.ch || !s.py) { problems.push(id + ' special 缺字段'); return; }
      if (allChars.indexOf(s.ch) < 0) problems.push(id + ' special 字「' + s.ch + '」不在诗中');
    });
    /* 高风险字拼音扫描 */
    var uniq = {};
    for (var ci = 0; ci < allChars.length; ci++) {
      var ch = allChars[ci];
      if (RISK.indexOf(ch) >= 0 && !uniq[ch]) {
        uniq[ch] = 1;
        /* 找到该字在句中的拼音 */
        var found = [];
        (p.lines || []).forEach(function (L) {
          var han = L.text.replace(/[^一-鿿]/g, '');
          var pos = han.indexOf(ch);
          if (pos >= 0 && L.py) {
            var w = L.py.trim().split(/\s+/)[pos];
            if (w) found.push(L.text.replace(/[^一-鿿，。？！；：、]/g, '').slice(Math.max(0, pos - 3), pos + 4) + '→' + w);
          }
        });
        review.push((p.dynasty || '') + '·' + (p.author || '') + '《' + (p.title || '') + '》 ' + ch + ' : ' + found.join(' | '));
      }
    }
  });
});

console.log('========== 文件: ' + files.join(', '));
console.log('共 ' + stats.poems + ' 首 / ' + stats.lines + ' 句 / ' + stats.chars + ' 字');
console.log('朝代分布: ' + DYN.filter(function (d) { return stats.dyn[d]; }).map(function (d) { return d + stats.dyn[d]; }).join(' '));
console.log('作者 ' + Object.keys(stats.authors).length + ' 人');
console.log('========== 问题清单 (' + problems.length + ') ==========');
problems.forEach(function (x) { console.log('  ✗ ' + x); });
console.log('========== 高风险多音字复核 (' + review.length + ') ==========');
review.forEach(function (x) { console.log('  ? ' + x); });
process.exit(problems.length ? 1 : 0);
