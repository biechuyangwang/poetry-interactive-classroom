/* ============================================================
   poemui.js —— 诗词专题站前端逻辑（纯 ES5，无依赖）
   依赖：index.html 中先加载数据文件（window.POEM_DB）；插画读取 images/<朝代-作者-篇名>.webp（gen/ 批量生成），缺图为占位符
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var DYN_ORDER = ['先秦', '汉', '魏晋', '南北朝', '唐', '五代十国', '宋', '金', '元', '明', '清', '近现代'];
  var THEMES_ALL = ['山水田园', '边塞征战', '咏物言志', '思乡怀人', '送别友情', '爱情闺怨',
    '咏史怀古', '哲理禅意', '爱国忧民', '节令风物', '人生感怀', '民生疾苦'];
  var ART_CN = {
    moon: '明月', sun: '红日', mountain: '山峦', water: '水泽', snow: '飞雪', rain: '烟雨',
    cloud: '云雾', boat: '孤舟', pavilion: '亭台', house: '屋舍', person: '行人', bird: '雁阵',
    tree: '林木', willow: '垂柳', pine: '苍松', plum: '寒梅', bamboo: '修竹', flower: '野花',
    reed: '芦苇', flag: '旌旗', wine: '杯酌', horse: '骏马', bridge: '小桥', night: '夜色', autumn: '秋叶'
  };
  var ART_KEYS = (function () { var a = [], k; for (k in ART_CN) if (ART_CN.hasOwnProperty(k)) a.push(k); return a; })();

  /* ---------- 工具 ---------- */
  var ACC = { 'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i', 'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v', 'ü': 'v' };
  function stripAcc(s) {
    return String(s || '').toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, function (c) { return ACC[c] || c; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var PUNC_RE = /[\s　，。？！；：、·—…「」『』《》（）()[\]{},.?!;:'""]/;
  function isPunc(ch) { return PUNC_RE.test(ch); }
  function normText(s) {
    var out = [], i, ch;
    s = String(s || '').toLowerCase();
    for (i = 0; i < s.length; i++) { ch = s[i]; if (!isPunc(ch)) out.push(ch); }
    return out.join('');
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---------- 数据加载与规范化 ---------- */
  var DB = [];
  function normDB() {
    var raw = window.POEM_DB || [], i, j, p, seen = {};
    for (i = 0; i < raw.length; i++) {
      p = raw[i];
      if (!p || !p.title || !p.lines || !p.lines.length) continue;
      var id = (p.dynasty || '') + '-' + p.author + '-' + p.title;
      if (seen[id]) continue;
      seen[id] = 1;
      var np = {
        id: id,
        title: p.title, author: p.author || '佚名',
        dynasty: DYN_ORDER.indexOf(p.dynasty) >= 0 ? p.dynasty : (p.dynasty || '唐'),
        form: p.form || '诗',
        themes: (p.themes || []).filter(function (t) { return THEMES_ALL.indexOf(t) >= 0; }),
        lines: [],
        analysis: p.analysis || '',
        background: p.background || '',
        special: [], art: []
      };
      for (j = 0; j < p.lines.length; j++) {
        var L = p.lines[j];
        if (!L || !L.text) continue;
        np.lines.push({ text: L.text, py: L.py || '', note: L.note || '' });
      }
      if (!np.lines.length) continue;
      var sp = p.special || [];
      for (j = 0; j < sp.length; j++) {
        if (sp[j] && sp[j].ch && sp[j].py) np.special.push({ ch: sp[j].ch, py: sp[j].py, why: sp[j].why || '' });
      }
      var artA = p.art || [];
      for (j = 0; j < artA.length; j++) if (ART_KEYS.indexOf(artA[j]) >= 0 && np.art.indexOf(artA[j]) < 0) np.art.push(artA[j]);
      /* 预构建检索串：篇名、作者、每句各自独立，精确子串只在字段内匹配 */
      np._fld = [normText(np.title), normText(np.author)];
      np._lns = np.lines.map(function (L2) { return normText(L2.text); });
      for (j = 0; j < np._lns.length; j++) np._fld.push(np._lns[j]);
      np._pys = np.lines.map(function (L2) { return stripAcc(L2.py).replace(/[^a-z0-9]/g, ''); });
      /* 意象默认 */
      if (!np.art.length) np.art = ['mountain', 'water', 'tree'];
      DB.push(np);
    }
    /* 按朝代排序 */
    DB.sort(function (a, b) {
      var d = DYN_ORDER.indexOf(a.dynasty) - DYN_ORDER.indexOf(b.dynasty);
      if (d !== 0) return d;
      return a.author.localeCompare(b.author, 'zh') || a.title.localeCompare(b.title, 'zh');
    });
  }

  /* ---------- 状态 ---------- */
  var ST = { dyn: {}, poet: {}, th: {}, form: {}, q: '', view: 'list', cur: null };
  function anySel() {
    var k;
    for (k in ST.dyn) if (ST.dyn[k]) return true;
    for (k in ST.poet) if (ST.poet[k]) return true;
    for (k in ST.th) if (ST.th[k]) return true;
    for (k in ST.form) if (ST.form[k]) return true;
    return !!ST.q;
  }

  /* ---------- 检索 ---------- */
  function subseqIn(hay, q) { /* 句内子序列：允许跳字但保序、不跨句 */
    var i, pos = 0;
    for (i = 0; i < q.length; i++) {
      pos = hay.indexOf(q[i], pos);
      if (pos < 0) return false;
      pos++;
    }
    return true;
  }
  function matchPoem(p, qRaw) {
    if (!qRaw) return true;
    var q = normText(qRaw);
    if (!q) return true;
    var i;
    for (i = 0; i < p._fld.length; i++) { if (p._fld[i].indexOf(q) >= 0) return true; }
    var qp = stripAcc(qRaw).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (qp.length >= 2) {
      for (i = 0; i < p._pys.length; i++) { if (p._pys[i].indexOf(qp) >= 0) return true; }
    }
    if (q.length >= 2 && q.length <= 8) { /* 模糊跳字：仅限单句或标题内保序匹配，不跨句 */
      var j;
      if (subseqIn(normText(p.title + p.author), q)) return true;
      for (j = 0; j < p._lns.length; j++) {
        if (subseqIn(p._lns[j], q)) return true;
      }
    }
    return false;
  }
  function passDim(p) {
    var k, okD = true, okP = true, okT = true, okF = true, hasD = false, hasP = false, hasT = false, hasF = false;
    for (k in ST.dyn) if (ST.dyn[k]) { hasD = true; if (p.dynasty === k) { okD = true; break; } else okD = false; }
    if (!hasD) okD = true;
    for (k in ST.poet) if (ST.poet[k]) { hasP = true; if (p.author === k) { okP = true; break; } else okP = false; }
    if (!hasP) okP = true;
    for (k in ST.th) if (ST.th[k]) { hasT = true; if (p.themes.indexOf(k) >= 0) { okT = true; break; } else okT = false; }
    if (!hasT) okT = true;
    for (k in ST.form) if (ST.form[k]) { hasF = true; if (formKey(p.form) === k) { okF = true; break; } else okF = false; }
    if (!hasF) okF = true;
    return okD && okP && okT && okF;
  }
  function formKey(f) {
    f = f || '';
    if (f.indexOf('散曲') === 0) return '散曲';
    if (f.charAt(0) === '曲') return '戏曲';
    if (f.charAt(0) === '词') return '词';
    if (f.charAt(0) === '文') return '古文';
    if (f.charAt(0) === '赋') return '赋';
    if (f.indexOf('现代诗') >= 0) return '现代诗';
    if (f.indexOf('楚辞') >= 0) return '楚辞';
    if (f.indexOf('乐府') >= 0) return '乐府';
    if (f.indexOf('四言') >= 0) return '四言诗';
    if (f.indexOf('绝句') >= 0) return f.charAt(0) === '五' ? '五言绝句' : '七言绝句';
    if (f.indexOf('律诗') >= 0) return f.charAt(0) === '五' ? '五言律诗' : '七言律诗';
    if (f.indexOf('古体') >= 0 || f.indexOf('古诗') >= 0) return '古体诗';
    return '其他';
  }
  function currentList() {
    var out = [], i;
    for (i = 0; i < DB.length; i++) if (passDim(DB[i]) && matchPoem(DB[i], ST.q)) out.push(DB[i]);
    return out;
  }

  /* ---------- 高亮：把匹配字符标 mark（原文含标点版） ---------- */
  function highlight(text, qRaw) {
    var q = normText(qRaw);
    if (!q) return esc(text);
    /* 先在 norm 域定位子串，再映射回原文 */
    var map = [], norm = [], i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i].toLowerCase();
      if (!isPunc(ch)) { norm.push(ch); map.push(i); }
    }
    var hay = norm.join(''), at = hay.indexOf(q), out = '', last = 0, s, e;
    if (at < 0 && q.length >= 2) { /* 退化：子序列 */
      var pos = 0, idxs = [];
      for (i = 0; i < q.length; i++) { pos = hay.indexOf(q[i], pos); if (pos < 0) { idxs = []; break; } idxs.push(pos); pos++; }
      if (idxs.length) {
        var mark = {};
        for (i = 0; i < idxs.length; i++) mark[idxs[i]] = 1;
        out = '';
        var nIdx = 0;
        for (i = 0; i < text.length; i++) {
          ch = text[i].toLowerCase();
          var isChar = !isPunc(ch);
          if (isChar && mark[nIdx]) out += '<mark>' + esc(text[i]) + '</mark>';
          else out += esc(text[i]);
          if (isChar) nIdx++;
        }
        return out;
      }
      return esc(text);
    }
    s = map[at]; e = map[at + q.length - 1];
    out = esc(text.slice(0, s)) + '<mark>' + esc(text.slice(s, e + 1)) + '</mark>' + esc(text.slice(e + 1));
    return out;
  }

  /* ---------- 渲染：筛选条 ---------- */
  function renderFilter(list) {
    var box = $('filterbar'), i, k, c;
    if (!box) return;
    box.innerHTML = '';
    /* 朝代 */
    var dynCount = {}, poetCount = {}, thCount = {}, formCount = {};
    var others = [], j;
    for (i = 0; i < DB.length; i++) {
      var p = DB[i];
      if (matchPoem(p, ST.q)) others.push(p);
    }
    for (i = 0; i < others.length; i++) {
      p = others[i];
      var ok = true;
      for (k in ST.poet) if (ST.poet[k] && p.author !== k) ok = false;
      for (k in ST.th) if (ST.th[k] && p.themes.indexOf(k) < 0) ok = false;
      for (k in ST.form) if (ST.form[k] && formKey(p.form) !== k) ok = false;
      if (ok) dynCount[p.dynasty] = (dynCount[p.dynasty] || 0) + 1;
      ok = true;
      for (k in ST.dyn) if (ST.dyn[k] && p.dynasty !== k) ok = false;
      for (k in ST.th) if (ST.th[k] && p.themes.indexOf(k) < 0) ok = false;
      for (k in ST.form) if (ST.form[k] && formKey(p.form) !== k) ok = false;
      if (ok) poetCount[p.author] = (poetCount[p.author] || 0) + 1;
      ok = true;
      for (k in ST.dyn) if (ST.dyn[k] && p.dynasty !== k) ok = false;
      for (k in ST.poet) if (ST.poet[k] && p.author !== k) ok = false;
      for (k in ST.form) if (ST.form[k] && formKey(p.form) !== k) ok = false;
      if (ok) { for (j = 0; j < p.themes.length; j++) thCount[p.themes[j]] = (thCount[p.themes[j]] || 0) + 1; formCount[formKey(p.form)] = (formCount[formKey(p.form)] || 0) + 1; }
    }
    function group(label, counts, orderKeys, stateObj, scrollCls) {
      var g = el('div', 'fgroup');
      g.appendChild(el('div', 'flabel', label));
      var opts = el('div', 'fopts' + (scrollCls ? ' ' + scrollCls : ''));
      var keys = orderKeys || Object.keys(counts);
      var i2, k2, total = 0;
      for (i2 = 0; i2 < keys.length; i2++) if (counts[keys[i2]]) total++;
      for (i2 = 0; i2 < keys.length; i2++) {
        k2 = keys[i2];
        if (!counts[k2]) continue;
        var chip = el('button', 'chip small' + (stateObj[k2] ? ' on' : ''),
          esc(k2) + '<span style="opacity:.55;font-size:11px;margin-left:4px">' + counts[k2] + '</span>');
        chip.setAttribute('data-k', k2);
        chip.onclick = (function (kk) {
          return function () { stateObj[kk] = !stateObj[kk]; render(); };
        })(k2);
        opts.appendChild(chip);
      }
      if (!total) opts.appendChild(el('span', 'count', '无'));
      g.appendChild(opts);
      return g;
    }
    box.appendChild(group('朝代', dynCount, DYN_ORDER, ST.dyn));
    var poetNames = Object.keys(poetCount).sort(function (a, b) { return poetCount[b] - poetCount[a]; });
    box.appendChild(group('诗人', poetCount, poetNames, ST.poet, 'poetscroll'));
    box.appendChild(group('主题', thCount, THEMES_ALL, ST.th));
    var formOrder = ['四言诗', '楚辞', '乐府', '五言绝句', '七言绝句', '五言律诗', '七言律诗', '古体诗', '古文', '赋', '词', '散曲', '戏曲', '现代诗', '其他'];
    box.appendChild(group('体裁', formCount, formOrder, ST.form));
  }

  /* ---------- 渲染：列表 ---------- */
  function renderList() {
    var list = currentList();
    var hero = $('hero'), flt = $('filterbar'), wrap = $('listwrap');
    hero.style.display = '';
    flt.style.display = '';
    wrap.style.display = '';
    renderFilter(list);
    var meta = $('listmeta');
    meta.innerHTML = '';
    var n = el('span', null, '共收录 <b style="color:#a03c2e">' + DB.length + '</b> 首' +
      (list.length !== DB.length ? ' · 命中 <b style="color:#a03c2e">' + list.length + '</b> 首' : '') +
      (ST.q ? ' · 搜索「' + esc(ST.q) + '」' : ' · 覆盖先秦至近现代'));
    meta.appendChild(n);
    var right = el('span', null, '');
    var rst = el('button', 'tbtn', '重置筛选');
    rst.style.cssText = 'background:#3a372f;border-color:#3a372f;color:#f2ecdc;padding:4px 12px;font-size:13px';
    rst.onclick = resetFilter;
    right.appendChild(rst);
    meta.appendChild(right);
    var cards = $('cards');
    cards.innerHTML = '';
    if (!list.length) {
      cards.appendChild(el('div', 'empty', '未寻得诗句 —— 试试换个关键词，或放宽筛选条件。'));
      return;
    }
    var i;
    for (i = 0; i < list.length; i++) {
      var p = list[i];
      var first = p.lines[0].text + (p.lines[1] ? '，' + p.lines[1].text : '');
      /* 搜索命中句优先展示：标题/首行未含关键词时，显示含关键词的诗句 */
      if (ST.q) {
        var qn = normText(ST.q);
        if (qn && normText(p.title + p.author + first).indexOf(qn) < 0) {
          var j;
          for (j = 0; j < p.lines.length; j++) {
            if (normText(p.lines[j].text).indexOf(qn) >= 0) { first = p.lines[j].text; break; }
          }
        }
      }
      var c = el('div', 'card');
      c.innerHTML =
        '<div class="ct">' + highlight(p.title, ST.q) + '</div>' +
        '<div class="ca">' + esc(p.dynasty) + ' · ' + highlight(p.author, ST.q) + ' · ' + esc(p.form) + '</div>' +
        '<div class="cfirst">' + highlight(first, ST.q) + '</div>' +
        '<div class="cth">' + p.themes.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
      c.onclick = (function (pp) { return function () { location.hash = 'p=' + encodeURIComponent(pp.id); }; })(p);
      cards.appendChild(c);
    }
  }

  /* ---------- 渲染：详情 ---------- */
  function findById(id) {
    var i;
    for (i = 0; i < DB.length; i++) if (DB[i].id === id) return DB[i];
    return null;
  }
  function renderDetail(p) {
    var hero = $('hero'), flt = $('filterbar'), wrap = $('listwrap'), det = $('detail');
    hero.style.display = 'none';
    flt.style.display = 'none';
    wrap.style.display = 'none';
    det.style.display = '';
    det.innerHTML = '';
    var list = currentListOrAll();
    var idx = -1, i;
    for (i = 0; i < list.length; i++) if (list[i].id === p.id) { idx = i; break; }

    var top = el('div', 'dtop');
    var nav = el('div', 'dnav');
    var back = el('button', 'dbtn', '← 返回列表');
    back.onclick = function () { location.hash = ''; };
    nav.appendChild(back);
    if (idx > 0) {
      var pv = el('button', 'dbtn', '← 上一首');
      pv.onclick = (function (q) { return function () { location.hash = 'p=' + encodeURIComponent(list[q - 1].id); }; })(idx);
      nav.appendChild(pv);
    }
    if (idx >= 0 && idx < list.length - 1) {
      var nx = el('button', 'dbtn', '下一首 →');
      nx.onclick = (function (q) { return function () { location.hash = 'p=' + encodeURIComponent(list[q + 1].id); }; })(idx);
      nav.appendChild(nx);
    }
    top.appendChild(nav);
    var rd = el('button', 'dbtn', '🎲 随机一首');
    rd.onclick = randomPoem;
    top.appendChild(rd);
    det.appendChild(top);

    var head = el('div', 'dhead');
    head.innerHTML = '<h2>' + esc(p.title) + '</h2>' +
      '<div class="meta">' + esc(p.dynasty) + '<span class="dot">·</span>' + esc(p.author) +
      '<span class="dot">·</span>' + esc(p.form) + '</div>';
    det.appendChild(head);

    /* AI 插画置于诗前：先观画，再品诗。images/<朝代-作者-篇名>.webp（gen/ 批量生成），
       文件名规则与 gen/batch.js safeName 一致，缺图显示占位符 */
    var art = el('div', 'artcard');
    art.innerHTML = '<h3>AI 插画</h3>';
    var stage = el('div', 'artstage');
    var ph = el('div', 'placeholder', '<span class="phseal">画</span>AI 插画绘制中<br>成图后此处自动呈现');
    stage.appendChild(ph);
    var img = document.createElement('img');
    img.className = 'artimg';
    img.alt = p.title + ' 插画';
    img.style.display = 'none';
    img.onload = function () { ph.style.display = 'none'; img.style.display = 'block'; };
    img.onerror = function () { img.style.display = 'none'; ph.style.display = ''; };
    img.src = 'images/' + encodeURIComponent(String(p.id).replace(/[\\/:*?"<>|]/g, '_')) + '.webp';
    stage.appendChild(img);
    art.appendChild(stage);
    art.appendChild(el('div', 'arttools', '<span class="lbl">意象：' + p.art.map(function (a) { return ART_CN[a] || a; }).join(' · ') + '</span>'));
    det.appendChild(art);

    var vs = el('div', 'verses');
    var spMap = {}, j;
    for (j = 0; j < p.special.length; j++) spMap[p.special[j].ch] = p.special[j];
    for (j = 0; j < p.lines.length; j++) {
      var L = p.lines[j];
      var chars = L.text.split('');
      var pys = L.py ? L.py.split(/\s+/) : [];
      var html = '', k, pi = 0;
      for (k = 0; k < chars.length; k++) {
        var ch = chars[k];
        if (isPunc(ch)) { html += '<span style="color:#8a7f66">' + esc(ch) + '</span>'; continue; }
        var sp = spMap[ch];
        var py = pys[pi] || '';
        pi++;
        html += '<ruby' + (sp ? ' class="sp" title="' + esc(sp.py + '　' + sp.why) + '"' : '') + '>' +
          esc(ch) + '<rt>' + esc(py) + '</rt></ruby>';
      }
      var v = el('div', 'verse');
      v.appendChild(el('div', 'vrow', html));
      if (L.note) v.appendChild(el('div', 'vnote', esc(L.note)));
      vs.appendChild(v);
    }
    det.appendChild(vs);

    var tools = el('div', 'toolrow');
    var b1 = el('button', 'dbtn on', '拼音：开');
    b1.onclick = function () {
      document.body.classList.toggle('nopy');
      var on = !document.body.classList.contains('nopy');
      b1.innerHTML = '拼音：' + (on ? '开' : '关');
      b1.className = 'dbtn' + (on ? ' on' : '');
    };
    var b2 = el('button', 'dbtn on', '逐句解析：开');
    b2.onclick = function () {
      document.body.classList.toggle('nonote');
      var on = !document.body.classList.contains('nonote');
      b2.innerHTML = '逐句解析：' + (on ? '开' : '关');
      b2.className = 'dbtn' + (on ? ' on' : '');
    };
    tools.appendChild(b1); tools.appendChild(b2);
    det.appendChild(tools);

    if (p.special.length) {
      var sc = el('div', 'dcard');
      var ul = '<ul class="speclist">';
      for (j = 0; j < p.special.length; j++) {
        var s = p.special[j];
        ul += '<li><b>' + esc(s.ch) + '</b>　读 <b>' + esc(s.py) + '</b>　' + esc(s.why) + '</li>';
      }
      ul += '</ul>';
      sc.innerHTML = '<h3>特殊读音与通假</h3>' + ul;
      det.appendChild(sc);
    }

    if (p.analysis) det.appendChild(el('div', 'dcard', '<h3>意境赏析</h3><p>' + esc(p.analysis) + '</p>'));
    if (p.background) det.appendChild(el('div', 'dcard', '<h3>创作背景</h3><p>' + esc(p.background) + '</p>'));

    window.scrollTo(0, 0);
  }
  function currentListOrAll() {
    var l = currentList();
    return l.length ? l : DB;
  }
  function randomPoem() {
    var l = currentListOrAll();
    var p;
    do { p = l[Math.floor(Math.random() * l.length)]; } while (l.length > 1 && ST.cur && p.id === ST.cur.id);
    location.hash = 'p=' + encodeURIComponent(p.id);
  }

  function resetFilter() {
    ST.dyn = {}; ST.poet = {}; ST.th = {}; ST.form = {}; ST.q = '';
    var si = $('searchbox');
    if (si) si.value = '';
    render();
  }

  /* ---------- 主渲染 / 路由 ---------- */
  function render() {
    ST.view = ST.cur ? 'detail' : 'list';
    if (ST.cur) {
      var p = findById(ST.cur);
      if (!p) { ST.cur = null; ST.view = 'list'; } else { renderDetail(p); renderStats(); return; }
    }
    renderList();
    renderStats();
  }
  function renderStats() {
    var s = $('stats');
    if (!s) return;
    var poets = {}, i;
    for (i = 0; i < DB.length; i++) poets[DB[i].author] = 1;
    s.innerHTML = '收录 <b>' + DB.length + '</b> 首 · <b>' + Object.keys(poets).length + '</b> 位诗人 · ' +
      '自诗经楚辞至当代新诗 · 逐字注音 · 逐句解析 · AI 插画';
  }
  function route() {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('p=') === 0) ST.cur = decodeURIComponent(h.slice(2));
    else ST.cur = null;
    render();
  }

  /* ---------- 启动 ---------- */
  function boot() {
    if (!window.POEM_DB || !window.POEM_DB.length) {
      document.body.insertBefore(el('div', null, ''), document.body.firstChild);
      var w = el('div', null, '⚠ 数据未能加载：请确认 data 文件夹下的 db-*.js 与页面在同一目录。');
      w.style.cssText = 'background:#d03b3b;color:#fff;padding:10px 18px';
      document.body.insertBefore(w, document.body.firstChild);
      return;
    }
    normDB();
    var si = $('searchbox'), tmr = 0;
    if (si) {
      si.oninput = function () {
        clearTimeout(tmr);
        tmr = setTimeout(function () { ST.q = si.value; if (ST.cur) location.hash = ''; else render(); }, 180);
      };
      si.onkeydown = function (e) { if ((e.keyCode || e.which) === 13) { ST.q = si.value; if (ST.cur) location.hash = ''; else render(); } };
    }
    var rb = $('randombtn');
    if (rb) rb.onclick = randomPoem;
    var hb = $('homebtn');
    if (hb) hb.onclick = function () { location.hash = ''; };
    window.addEventListener('hashchange', route);
    route();
  }
  if (document.readyState === 'complete') boot();
  else if (window.addEventListener) window.addEventListener('load', boot);

  window.PoemUI = { DB: function () { return DB; }, random: randomPoem, reset: resetFilter };
})();
