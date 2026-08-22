/* ============================================================
   inkpaint.js —— 诗词水墨意境画生成引擎（纯 Canvas 2D，无依赖，ES5）
   用法：InkPaint.paint(canvas, {
           seed: 12345,            // 种子，同 seed 同画
           art: ['moon','mountain','water'], // 意象标签
           title: '静夜思', author: '李白',
           tint: false              // true=浅绛设色
         });
   ============================================================ */
(function () {
  'use strict';

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h = (h ^ s.charCodeAt(i)) >>> 0; h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  var INK = {
    jiao: [24, 23, 21],   // 焦墨
    nong: [44, 43, 40],   // 浓墨
    zhong: [74, 72, 67],  // 重墨
    dan: [139, 135, 125], // 淡墨
    qing: [196, 191, 178],// 清墨
    zhu: [158, 62, 38],   // 朱砂（印 / 日）
    zhe: [176, 106, 60],  // 赭石（浅绛）
    hua: [123, 143, 163], // 花青（浅绛）
    nuan: [204, 150, 40]  // 暖光（夜窗灯火）
  };
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(c1, c2, t) { return [Math.round(c1[0] + (c2[0] - c1[0]) * t), Math.round(c1[1] + (c2[1] - c1[1]) * t), Math.round(c1[2] + (c2[2] - c1[2]) * t)]; }
  function inkOf(rng, level) { // level 0 焦 ~ 4 清，抖动出墨色变化
    var base = [INK.jiao, INK.nong, INK.zhong, INK.dan, INK.qing][level] || INK.zhong;
    var t = rng() * 0.12 - 0.06;
    return mix(base, [255, 250, 238], Math.max(0, t));
  }

  /* 干笔飞白线：拆成多段，每段 alpha 抖动 */
  function dryStroke(ctx, x1, y1, x2, y2, w, color, alpha, rng) {
    var segs = 3 + Math.floor(rng() * 4), i, t1, t2, ax, ay, bx, by;
    for (i = 0; i < segs; i++) {
      t1 = i / segs; t2 = (i + 1) / segs;
      if (rng() < 0.12) continue; // 缺口=飞白
      ax = x1 + (x2 - x1) * t1; ay = y1 + (y2 - y1) * t1;
      bx = x1 + (x2 - x1) * t2; by = y1 + (y2 - y1) * t2;
      ctx.strokeStyle = rgba(color, alpha * (0.55 + rng() * 0.45));
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
  }

  var P; // 当前画笔上下文包

  /* ---------- 宣纸 ---------- */
  function paper(W, H, tint) {
    var g = P.ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, tint ? '#f6efe0' : '#f4efe2');
    g.addColorStop(1, tint ? '#f2e8d4' : '#efe9da');
    P.ctx.fillStyle = g;
    P.ctx.fillRect(0, 0, W, H);
    var i, x, y, rng = P.rng;
    // 纤维噪点
    for (i = 0; i < 900; i++) {
      x = rng() * W; y = rng() * H;
      P.ctx.fillStyle = rgba(INK.zhong, 0.015 + rng() * 0.02);
      P.ctx.fillRect(x, y, 1, 1);
    }
    for (i = 0; i < 60; i++) { // 纤维长丝
      x = rng() * W; y = rng() * H;
      P.ctx.strokeStyle = rgba(INK.dan, 0.03);
      P.ctx.lineWidth = 0.6;
      P.ctx.beginPath(); P.ctx.moveTo(x, y); P.ctx.lineTo(x + 8 + rng() * 26, y + rng() * 2 - 1); P.ctx.stroke();
    }
    // 老化斑
    for (i = 0; i < 8; i++) {
      x = rng() * W; y = rng() * H; var r = 12 + rng() * 34;
      var rg = P.ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba([190, 168, 128], 0.05));
      rg.addColorStop(1, rgba([190, 168, 128], 0));
      P.ctx.fillStyle = rg; P.ctx.beginPath(); P.ctx.arc(x, y, r, 0, 6.29); P.ctx.fill();
    }
  }

  /* ---------- 天色 ---------- */
  function skyWash(W, H, art) {
    var ctx = P.ctx, rng = P.rng, g;
    if (art.night) {
      g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
      g.addColorStop(0, rgba(INK.zhong, 0.16));
      g.addColorStop(1, rgba(INK.zhong, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.7);
    }
    if (art.snow) {
      g = ctx.createLinearGradient(0, 0, 0, H * 0.8);
      g.addColorStop(0, rgba([150, 152, 158], 0.12));
      g.addColorStop(1, rgba([150, 152, 158], 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.8);
    }
    if (art.rain) {
      var i;
      ctx.strokeStyle = rgba(INK.zhong, 0.10);
      for (i = 0; i < 90; i++) {
        var x = rng() * W, y = rng() * H * 0.72, l = 14 + rng() * 26;
        ctx.lineWidth = rng() < 0.3 ? 1.2 : 0.7;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.25, y + l); ctx.stroke();
      }
    }
    if (art.autumn && !art.night) {
      g = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      g.addColorStop(0, rgba(INK.zhe, 0.06));
      g.addColorStop(1, rgba(INK.zhe, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.6);
    }
  }

  /* ---------- 远山（含山脚雾化） ---------- */
  function farMountains(W, hy, hasWater) {
    var ctx = P.ctx, rng = P.rng, layers = hasWater ? 2 + (rng() < 0.6 ? 1 : 0) : 2 + (rng() < 0.5 ? 1 : 0), i, k;
    for (i = 0; i < layers; i++) {
      var t = i / Math.max(1, layers - 1);           // 0 最远
      var baseY = hy - (layers - i) * (18 + rng() * 16);
      var amp = 90 + (1 - t) * 120 * rng() + 30;
      var topMin = baseY - amp;
      var col = P.tint && i === layers - 1 ? mix(inkOf(rng, 2), INK.zhe, 0.22) : inkOf(rng, i === layers - 1 ? 2 : 3);
      var alpha = 0.16 + t * 0.22;
      var g = ctx.createLinearGradient(0, topMin, 0, baseY + (hasWater ? 26 : 60));
      g.addColorStop(0, rgba(col, alpha));
      g.addColorStop(0.72, rgba(col, alpha * 0.55));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-30, baseY + 40);
      var x = -30, peak = true;
      while (x < W + 30) {
        var step = W / (4 + rng() * 4);
        var nx = x + step;
        var py = peak ? baseY - amp * (0.45 + rng() * 0.55) : baseY - amp * (0.1 + rng() * 0.2);
        ctx.quadraticCurveTo(x + step * 0.5, py - (peak ? amp * 0.35 : -amp * 0.1), nx, peak ? py : baseY - amp * 0.12);
        peak = !peak; x = nx;
      }
      ctx.lineTo(W + 30, baseY + 40); ctx.closePath(); ctx.fill();
      if (i === layers - 1) { // 最近山层加皴
        for (k = 0; k < 22; k++) {
          var cx = rng() * W, cy = baseY - rng() * amp * 0.5;
          dryStroke(P.ctx, cx, cy, cx + 8 + rng() * 22, cy + 10 + rng() * 20, 0.8, col, 0.12, rng);
        }
      }
    }
  }

  /* ---------- 云雾横带 ---------- */
  function mist(W, hy) {
    var ctx = P.ctx, rng = P.rng, i;
    var n = 2 + Math.floor(rng() * 3);
    for (i = 0; i < n; i++) {
      var y = hy - 30 - rng() * 110, h = 22 + rng() * 42;
      var g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(244,239,226,0)');
      g.addColorStop(0.5, 'rgba(244,239,226,' + (0.55 + rng() * 0.3) + ')');
      g.addColorStop(1, 'rgba(244,239,226,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-10, y, W + 20, h);
    }
  }

  /* ---------- 水面 ---------- */
  function water(W, hy, H) {
    var ctx = P.ctx, rng = P.rng, i;
    var g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, rgba(INK.zhong, 0.05));
    g.addColorStop(1, rgba(INK.zhong, 0));
    ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy);
    var rows = 14 + Math.floor(rng() * 8);
    for (i = 0; i < rows; i++) {
      var t = i / rows;
      var y = hy + 8 + t * (H - hy - 30) * (0.35 + rng() * 0.65);
      var len = 30 + rng() * 150;
      var x = rng() * (W - len);
      ctx.strokeStyle = rgba(inkOf(rng, 3), 0.32 * (1 - t * 0.6));
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y + (rng() - 0.5) * 3, x + len, y); ctx.stroke();
    }
  }

  /* ---------- 月 / 日 ---------- */
  function moon(W, hy) {
    var ctx = P.ctx, rng = P.rng;
    var x = rng() < 0.5 ? W * (0.16 + rng() * 0.12) : W * (0.7 + rng() * 0.12);
    var y = 60 + rng() * 60, r = 26 + rng() * 14, i;
    for (i = 4; i >= 1; i--) { // 月晕
      var rg = ctx.createRadialGradient(x, y, r * 0.4, x, y, r + i * 16);
      rg.addColorStop(0, rgba(INK.dan, 0.10));
      rg.addColorStop(1, rgba(INK.dan, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r + i * 16, 0, 6.29); ctx.fill();
    }
    var g2 = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.2, x, y, r);
    g2.addColorStop(0, 'rgba(252,249,240,0.98)');
    g2.addColorStop(0.8, rgba(INK.qing, 0.5));
    g2.addColorStop(1, rgba(INK.qing, 0.25));
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
    ctx.strokeStyle = rgba(INK.zhong, 0.28); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.stroke();
    // 月中淡影（桂影）
    ctx.fillStyle = rgba(INK.dan, 0.10);
    ctx.beginPath(); ctx.arc(x + r * 0.25, y - r * 0.15, r * 0.30, 0, 6.29); ctx.fill();
  }
  function sunDisc(W, hy) {
    var ctx = P.ctx, rng = P.rng;
    var x = rng() < 0.5 ? W * 0.2 : W * 0.74, y = 70 + rng() * 50, r = 24 + rng() * 10, i;
    var c = P.tint ? INK.zhu : mix(INK.zhu, [210, 150, 90], 0.35);
    for (i = 3; i >= 1; i--) {
      var rg = ctx.createRadialGradient(x, y, r * 0.5, x, y, r + i * 20);
      rg.addColorStop(0, rgba(c, 0.08)); rg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r + i * 20, 0, 6.29); ctx.fill();
    }
    ctx.fillStyle = rgba(c, 0.55); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
  }

  /* ---------- 树木家族 ---------- */
  function branch(x, y, ang, len, w, depth, col, alpha, leafFn) {
    var ctx = P.ctx, rng = P.rng;
    var nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
    dryStroke(ctx, x, y, nx, ny, w, col, alpha, rng);
    if (depth <= 0) { if (leafFn) leafFn(nx, ny, ang); return; }
    var n = rng() < 0.2 ? 3 : 2, i;
    for (i = 0; i < n; i++) {
      branch(nx, ny, ang + (rng() - 0.5) * 1.5 + (i === 0 ? -0.15 : 0.15), len * (0.6 + rng() * 0.2), w * 0.62, depth - 1, col, alpha, leafFn);
    }
  }
  function bareTree(x, y, h, leafFn) {
    var col = inkOf(P.rng, 1);
    branch(x, y, -Math.PI / 2 + (P.rng() - 0.5) * 0.3, h * 0.42, h * 0.045, 4, col, 0.7, leafFn);
  }
  function pineTree(x, y, h) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1), i, j;
    var w = h * 0.06;
    // 主干两段折
    var x1 = x, y1 = y, x2 = x + (rng() - 0.5) * h * 0.2, y2 = y - h * 0.5;
    var x3 = x2 + (rng() - 0.5) * h * 0.24, y3 = y2 - h * 0.5;
    dryStroke(ctx, x1, y1, x2, y2, w, col, 0.8, rng);
    dryStroke(ctx, x2, y2, x3, y3, w * 0.8, col, 0.8, rng);
    // 横枝 + 针簇
    var twigs = [[x1, y1 - h * 0.18], [x2, y2 + h * 0.06], [x2, y2 - h * 0.1], [x3, y3 + h * 0.06]];
    for (i = 0; i < twigs.length; i++) {
      var dir = (i % 2 === 0 ? 1 : -1) * (0.6 + rng() * 0.5);
      var tx = twigs[i][0] + dir * h * 0.3, ty = twigs[i][1] - rng() * h * 0.1;
      dryStroke(ctx, twigs[i][0], twigs[i][1], tx, ty, w * 0.5, col, 0.7, rng);
      // 针叶扇面
      var nn = 16 + Math.floor(rng() * 10);
      ctx.strokeStyle = rgba(inkOf(rng, 2), 0.5);
      ctx.lineWidth = 0.8;
      for (j = 0; j < nn; j++) {
        var a2 = (j / nn - 0.5) * Math.PI * 0.9;
        var l2 = h * (0.05 + rng() * 0.05);
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(a2) * l2 * Math.sign(dir), ty + Math.sin(a2) * l2); ctx.stroke();
      }
    }
  }
  function willowTree(x, y, h) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1), i, j;
    dryStroke(ctx, x, y, x + (rng() - 0.5) * 8, y - h * 0.62, h * 0.05, col, 0.75, rng);
    var cx = x + (rng() - 0.5) * 10, cy = y - h * 0.62;
    var n = 6 + Math.floor(rng() * 5);
    for (i = 0; i < n; i++) {
      var sx = cx + (i / n - 0.5) * h * 0.5, sy = cy + rng() * 6;
      var drop = h * (0.3 + rng() * 0.25);
      ctx.strokeStyle = rgba(inkOf(rng, 2), 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + (rng() - 0.5) * 26, sy + drop * 0.55, sx + (rng() - 0.5) * 40, sy + drop);
      ctx.stroke();
      for (j = 0; j < 4; j++) { // 柳叶点
        var ly = sy + drop * (0.4 + rng() * 0.55);
        ctx.fillStyle = rgba(P.tint ? mix(inkOf(rng, 3), [96, 128, 82], 0.5) : inkOf(rng, 3), 0.4);
        ctx.fillRect(sx + (rng() - 0.5) * 34, ly, 2, 1.4);
      }
    }
  }
  function plumTree(x, y, h) {
    var ctx = P.ctx, rng = P.rng;
    var petal = P.tint ? INK.zhu : [246, 242, 235];
    bareTree(x, y, h, function (bx, by) {
      var i, nn = 3 + Math.floor(rng() * 4);
      for (i = 0; i < nn; i++) {
        var r = 2 + rng() * 2.6;
        ctx.fillStyle = rgba(petal, 0.85);
        ctx.beginPath(); ctx.arc(bx + (rng() - 0.5) * 12, by + (rng() - 0.5) * 12, r, 0, 6.29); ctx.fill();
        ctx.fillStyle = rgba(INK.dan, 0.5);
        ctx.beginPath(); ctx.arc(bx + (rng() - 0.5) * 12, by + (rng() - 0.5) * 12, r * 0.3, 0, 6.29); ctx.fill();
      }
    });
  }
  function bambooClump(x, y, h) {
    var ctx = P.ctx, rng = P.rng, i, j;
    var stalks = 2 + Math.floor(rng() * 2);
    var leafC = P.tint ? mix(INK.zhong, [74, 110, 70], 0.55) : inkOf(rng, 2);
    for (i = 0; i < stalks; i++) {
      var bx = x + i * (6 + rng() * 8), top = y - h * (0.75 + rng() * 0.25);
      var segs = 4, yy = y, xx = bx;
      var lean = (rng() - 0.5) * 0.1;
      var k;
      for (k = 0; k < segs; k++) {
        var ny2 = yy - (y - top) / segs, nx2 = xx + lean * (y - top) / segs * (0.6 + k * 0.2);
        ctx.strokeStyle = rgba(inkOf(rng, 2), 0.65);
        ctx.lineWidth = 2.4 - k * 0.4;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(nx2, ny2); ctx.stroke();
        ctx.strokeStyle = rgba(INK.jiao, 0.5); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(nx2 - 2.4, ny2); ctx.lineTo(nx2 + 2.4, ny2); ctx.stroke(); // 竹节
        yy = ny2; xx = nx2;
      }
      var leaves = 4 + Math.floor(rng() * 4);
      for (j = 0; j < leaves; j++) {
        var lx = xx + (rng() - 0.5) * 34, ly = yy + rng() * h * 0.3;
        var la = rng() * Math.PI - Math.PI; // 叶撇：三条弧
        var ll = 10 + rng() * 12, k2;
        for (k2 = -1; k2 <= 1; k2++) {
          ctx.strokeStyle = rgba(leafC, 0.55);
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(lx + Math.cos(la + k2 * 0.22) * ll * 0.5, ly + Math.sin(la + k2 * 0.22) * ll * 0.5 - 3,
            lx + Math.cos(la + k2 * 0.28) * ll, ly + Math.sin(la + k2 * 0.28) * ll);
          ctx.stroke();
        }
      }
    }
  }

  /* ---------- 建筑 / 桥 / 舟 / 人 / 物件 ---------- */
  function pavilion(x, y, s) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1);
    dryStroke(ctx, x - s * 0.3, y, x - s * 0.3, y - s * 0.62, s * 0.045, col, 0.7, rng);
    dryStroke(ctx, x + s * 0.3, y, x + s * 0.3, y - s * 0.62, s * 0.045, col, 0.7, rng);
    ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(x - s * 0.52, y - s * 0.6);
    ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.86, x, y - s * 0.88);
    ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.86, x + s * 0.52, y - s * 0.6); ctx.stroke();
    ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(x - s * 0.44, y - s * 0.56);
    ctx.quadraticCurveTo(x, y - s * 0.74, x + s * 0.44, y - s * 0.56); ctx.stroke();
    dryStroke(ctx, x, y - s * 0.88, x, y - s * 1.0, s * 0.03, col, 0.8, rng);
  }
  function house(x, y, s, lit) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1);
    ctx.fillStyle = rgba(inkOf(rng, 3), 0.25);
    ctx.fillRect(x - s * 0.5, y - s * 0.6, s, s * 0.6);
    dryStroke(ctx, x - s * 0.5, y - s * 0.6, x - s * 0.5, y, s * 0.03, col, 0.6, rng);
    dryStroke(ctx, x + s * 0.5, y - s * 0.6, x + s * 0.5, y, s * 0.03, col, 0.6, rng);
    ctx.strokeStyle = rgba(col, 0.85); ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(x - s * 0.64, y - s * 0.56);
    ctx.lineTo(x, y - s * 0.92); ctx.lineTo(x + s * 0.64, y - s * 0.56); ctx.stroke();
    if (lit) {
      ctx.fillStyle = rgba(INK.nuan, 0.75);
      ctx.fillRect(x - s * 0.12, y - s * 0.42, s * 0.14, s * 0.16);
      var rg = ctx.createRadialGradient(x - s * 0.05, y - s * 0.34, 0, x - s * 0.05, y - s * 0.34, s * 0.5);
      rg.addColorStop(0, rgba(INK.nuan, 0.25)); rg.addColorStop(1, rgba(INK.nuan, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x - s * 0.05, y - s * 0.34, s * 0.5, 0, 6.29); ctx.fill();
    } else {
      ctx.fillStyle = rgba(col, 0.5); ctx.fillRect(x - s * 0.12, y - s * 0.42, s * 0.14, s * 0.16);
    }
  }
  function bridge(x, y, s) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1), i;
    ctx.strokeStyle = rgba(col, 0.85); ctx.lineWidth = s * 0.055;
    ctx.beginPath(); ctx.moveTo(x - s * 0.6, y);
    ctx.quadraticCurveTo(x, y - s * 0.5, x + s * 0.6, y); ctx.stroke();
    ctx.lineWidth = s * 0.035;
    for (i = -2; i <= 2; i++) {
      var bx = x + i * s * 0.2, by = y - s * 0.5 * (1 - Math.abs(i) * 0.32);
      dryStroke(ctx, bx, by - s * 0.14, bx, by, s * 0.022, col, 0.7, rng);
    }
    ctx.beginPath(); ctx.moveTo(x - s * 0.6, y);
    ctx.quadraticCurveTo(x, y - s * 0.42, x + s * 0.6, y); ctx.stroke();
  }
  function boat(x, y, s, hasPerson) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1);
    /* 船体轮廓（上缘 + 底弧）先构成闭合形，填淡墨再描边 */
    ctx.beginPath();
    ctx.moveTo(x - s * 0.55, y - s * 0.06);
    ctx.quadraticCurveTo(x, y + s * 0.26, x + s * 0.6, y - s * 0.1);
    ctx.quadraticCurveTo(x, y + s * 0.1, x - s * 0.55, y - s * 0.06);
    ctx.closePath();
    ctx.fillStyle = rgba(col, 0.16);
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = s * 0.07;
    ctx.beginPath(); ctx.moveTo(x - s * 0.55, y - s * 0.06);
    ctx.quadraticCurveTo(x, y + s * 0.26, x + s * 0.6, y - s * 0.1); ctx.stroke();
    ctx.lineWidth = s * 0.035;
    ctx.beginPath(); ctx.moveTo(x - s * 0.46, y - s * 0.04);
    ctx.quadraticCurveTo(x, y + s * 0.1, x + s * 0.5, y - s * 0.12); ctx.stroke();
    if (rng() < 0.75) { // 船篷（孤舟蓑笠意象）
      ctx.fillStyle = rgba(col, 0.3);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.18, y - s * 0.06);
      ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.38, x + s * 0.38, y - s * 0.05);
      ctx.closePath(); ctx.fill();
      if (hasPerson) figure(x - s * 0.32, y - s * 0.04, s * 0.5, true);
    } else if (hasPerson) {
      figure(x - s * 0.05, y - s * 0.06, s * 0.5, true);
    }
    if (rng() < 0.6) { // 蓑衣钓竿
      dryStroke(ctx, x + s * 0.32, y - s * 0.04, x + s * 0.74, y - s * 0.42, s * 0.022, col, 0.6, rng);
    }
    ctx.strokeStyle = rgba(inkOf(rng, 3), 0.3); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x - s * 0.7, y + s * 0.14);
    ctx.quadraticCurveTo(x, y + s * 0.22, x + s * 0.7, y + s * 0.1); ctx.stroke();
  }
  function figure(x, y, s, sitting) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1);
    ctx.fillStyle = rgba(col, 0.9);
    ctx.beginPath(); ctx.arc(x, y - s * 0.92, s * 0.11, 0, 6.29); ctx.fill(); // 头
    ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.78);
    if (sitting) { ctx.lineTo(x + s * 0.05, y - s * 0.3); }
    else { ctx.lineTo(x, y - s * 0.06); }
    ctx.stroke();
    ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.moveTo(x - s * 0.16, y - s * 0.55); ctx.lineTo(x + s * 0.16, y - s * 0.55); ctx.stroke(); // 臂
    ctx.lineCap = 'butt';
  }
  function birds(x, y, n) {
    var ctx = P.ctx, rng = P.rng, i;
    for (i = 0; i < n; i++) {
      var t = i - (n - 1) / 2;
      var bx = x + Math.abs(t) * 26 + rng() * 8, by = y + Math.abs(t) * 9 + (rng() - 0.5) * 8;
      var s2 = 5 + rng() * 3;
      ctx.strokeStyle = rgba(inkOf(rng, 2), 0.6 + rng() * 0.25);
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(bx - s2, by);
      ctx.quadraticCurveTo(bx - s2 * 0.3, by - s2 * 0.75, bx, by - s2 * 0.15);
      ctx.quadraticCurveTo(bx + s2 * 0.3, by - s2 * 0.75, bx + s2, by); ctx.stroke();
    }
  }
  function reeds(x, y, h) {
    var ctx = P.ctx, rng = P.rng, i;
    var n = 7 + Math.floor(rng() * 6);
    for (i = 0; i < n; i++) {
      var bx = x + (rng() - 0.5) * 44, top = h * (0.6 + rng() * 0.4);
      var bend = (rng() - 0.5) * 46;
      ctx.strokeStyle = rgba(inkOf(rng, 2), 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, y);
      ctx.quadraticCurveTo(bx + bend * 0.4, y - top * 0.6, bx + bend, y - top); ctx.stroke();
      ctx.fillStyle = rgba(inkOf(rng, 2), 0.45);
      ctx.fillRect(bx + bend - 1, y - top - 5, 2, 7); // 穗
    }
  }
  function horse(x, y, s) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1);
    ctx.strokeStyle = rgba(col, 0.6); ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.34);
    ctx.quadraticCurveTo(x, y - s * 0.52, x + s * 0.42, y - s * 0.36); ctx.stroke(); // 背
    ctx.beginPath(); ctx.moveTo(x + s * 0.42, y - s * 0.36);
    ctx.quadraticCurveTo(x + s * 0.62, y - s * 0.5, x + s * 0.66, y - s * 0.62); ctx.stroke(); // 颈
    ctx.beginPath(); ctx.moveTo(x + s * 0.66, y - s * 0.62);
    ctx.quadraticCurveTo(x + s * 0.76, y - s * 0.6, x + s * 0.78, y - s * 0.52); ctx.stroke(); // 头
    var i;
    for (i = 0; i < 4; i++) {
      dryStroke(ctx, x - s * 0.4 + i * s * 0.28, y - s * 0.3, x - s * 0.42 + i * s * 0.28, y, s * 0.05, col, 0.55, rng);
    }
    ctx.lineCap = 'butt';
  }
  function banner(x, y, h) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1);
    dryStroke(ctx, x, y, x, y - h, 1.6, col, 0.75, rng);
    ctx.fillStyle = P.tint ? rgba(INK.zhu, 0.6) : rgba(col, 0.5);
    ctx.beginPath(); ctx.moveTo(x, y - h);
    ctx.lineTo(x + 16 + rng() * 10, y - h + 6 + rng() * 4);
    ctx.lineTo(x, y - h + 16); ctx.closePath(); ctx.fill();
  }
  function wineSet(x, y) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1);
    dryStroke(ctx, x - 26, y, x + 26, y, 2.4, col, 0.6, rng); // 案
    dryStroke(ctx, x - 20, y, x - 20, y + 12, 2, col, 0.5, rng);
    dryStroke(ctx, x + 20, y, x + 20, y + 12, 2, col, 0.5, rng);
    var i;
    for (i = 0; i < 2; i++) { // 两只耳杯
      var cx = x - 8 + i * 18;
      ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse ? ctx.ellipse(cx, y - 5, 7, 3, 0, 0, 6.29) : ctx.arc(cx, y - 5, 5, 0, 6.29); ctx.stroke();
    }
    // 酒壶
    ctx.strokeStyle = rgba(col, 0.8);
    ctx.beginPath(); ctx.moveTo(x + 36, y - 2); ctx.lineTo(x + 36, y - 14); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 36, y - 14, 5, Math.PI, 0); ctx.stroke();
  }

  /* ---------- 雪 ---------- */
  function snowfall(W, H) {
    var ctx = P.ctx, rng = P.rng, i;
    for (i = 0; i < 300; i++) {
      var x = rng() * W, y = rng() * H, r = 0.8 + rng() * 2.4;
      ctx.fillStyle = 'rgba(255,253,247,' + (0.45 + rng() * 0.5) + ')';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
    }
  }
  function snowGround(W, hy) {
    var ctx = P.ctx, rng = P.rng;
    var g = ctx.createLinearGradient(0, hy - 20, 0, hy + 40);
    g.addColorStop(0, 'rgba(250,248,242,0)');
    g.addColorStop(0.5, 'rgba(250,248,242,0.85)');
    g.addColorStop(1, 'rgba(250,248,242,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, hy - 20, W, 62);
  }

  /* ---------- 落款与印 ---------- */
  function inscription(W, H, title, author) {
    var ctx = P.ctx, rng = P.rng;
    var chars = (title || '').replace(/[·\s]/g, '').split('');
    if (chars.length > 10) chars = chars.slice(0, 10);
    chars.push('·', '图');
    var x = W - 46, y0 = 52, lh = 30;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '26px KaiTi, STKaiti, FZKai-Z03, serif';
    var i;
    for (i = 0; i < chars.length; i++) {
      ctx.fillStyle = rgba(inkOf(rng, 1), 0.9);
      ctx.fillText(chars[i], x, y0 + i * lh);
    }
    var yy = y0 + chars.length * lh + 14;
    if (author) {
      ctx.font = '17px KaiTi, STKaiti, serif';
      var ac = author.split('');
      for (i = 0; i < Math.min(ac.length, 4); i++) {
        ctx.fillStyle = rgba(inkOf(rng, 2), 0.8);
        ctx.fillText(ac[i], x, yy + i * 20);
      }
      yy += Math.min(ac.length, 4) * 20 + 12;
    }
    // 朱印（阴文：红底白字）
    var s = 22;
    ctx.fillStyle = rgba(INK.zhu, 0.88);
    ctx.fillRect(x - s / 2, yy, s, s);
    ctx.fillStyle = 'rgba(246,240,228,0.95)';
    ctx.font = '13px KaiTi, STKaiti, serif';
    ctx.fillText('诗', x, yy + s / 2 - 1);
    ctx.strokeStyle = 'rgba(246,240,228,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(x - s / 2 + 1.5, yy + 1.5, s - 3, s - 3);
  }

  /* ---------- 边框 ---------- */
  function frame(W, H) {
    var ctx = P.ctx;
    ctx.strokeStyle = rgba(INK.zhong, 0.28); ctx.lineWidth = 1;
    ctx.strokeRect(12.5, 12.5, W - 25, H - 25);
    ctx.strokeStyle = rgba(INK.zhong, 0.12);
    ctx.strokeRect(17.5, 17.5, W - 35, H - 35);
  }

  /* ---------- 主入口 ---------- */
  function paint(cv, opts) {
    opts = opts || {};
    var W = 920, H = 580;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = '100%'; cv.style.height = 'auto';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    var seed = (opts.seed == null) ? 12345 : opts.seed;
    var rng = mulberry32(seed);
    var tint = !!opts.tint;
    var artArr = opts.art || [];
    var art = {};
    var i;
    for (i = 0; i < artArr.length; i++) art[artArr[i]] = true;
    if (opts.night) art.night = true;

    P = { ctx: ctx, rng: rng, tint: tint };

    var hy = H * (0.60 + rng() * 0.08); // 水平线 / 地面线
    var hasWater = art.water;

    paper(W, H, tint);
    skyWash(W, H, art);
    if (art.mountain) farMountains(W, hy, hasWater);
    if (art.cloud) mist(W, hy);
    if (art.moon) moon(W, hy);
    if (art.sun) sunDisc(W, hy);
    if (hasWater) water(W, hy, H);
    if (art.snow) snowGround(W, hy);

    /* 近景排布：左右各留位，避免居中 */
    var groundY = hasWater ? hy + 26 : H * 0.88;
    var nearArts = [];
    var bigs = ['tree', 'pine', 'willow', 'plum', 'bamboo', 'pavilion', 'house', 'bridge', 'mountain'];
    var k;
    for (k in art) if (art.hasOwnProperty(k) && bigs.indexOf(k) >= 0) nearArts.push(k);
    var slotL = { x: W * (0.10 + rng() * 0.06), used: false };
    var slotR = { x: W * (0.84 + rng() * 0.08), used: false };
    function slot() {
      var s = rng() < 0.5 && !slotL.used ? slotL : (!slotR.used ? slotR : (slotL.used ? slotR : slotL));
      s.used = true; return s.x;
    }
    var placedBigs = 0;
    for (i = 0; i < nearArts.length && placedBigs < 2; i++) {
      var t2 = nearArts[i];
      if (t2 === 'mountain' && art.mountain) { // 近景山石一角
        var mx = slot();
        rockOutcrop(mx, groundY, H);
        placedBigs++; continue;
      }
      var sx = slot();
      var sH = 150 + rng() * 110;
      if (t2 === 'tree') { bareTree(sx, groundY + 6, sH, art.autumn ? autumnLeafFn() : null); }
      else if (t2 === 'pine') { pineTree(sx, groundY + 6, sH); }
      else if (t2 === 'willow') { willowTree(sx, groundY + 6, sH); }
      else if (t2 === 'plum') { plumTree(sx, groundY + 6, sH * 0.8); }
      else if (t2 === 'bamboo') { bambooClump(sx, groundY + 6, sH); }
      else if (t2 === 'pavilion') { pavilion(sx, groundY + 4, 70 + rng() * 30); }
      else if (t2 === 'house') { house(sx, groundY + 4, 66 + rng() * 26, art.night); }
      else if (t2 === 'bridge') { bridge(sx, hy - 6, 90 + rng() * 40); }
      placedBigs++;
    }
    if (!nearArts.length) { // 无大树时给一角坡石
      rockOutcrop(rng() < 0.5 ? W * 0.1 : W * 0.88, groundY, H);
    }
    if (art.reed) reeds(W * (0.14 + rng() * 0.7), groundY, 90 + rng() * 60);
    if (art.boat) boat(W * (0.3 + rng() * 0.4), hasWater ? hy + 44 + rng() * 30 : groundY - 4, 74 + rng() * 26, true);
    if (art.person && !art.boat) figure(W * (0.3 + rng() * 0.4), groundY, 34 + rng() * 10, rng() < 0.3);
    if (art.horse) horse(W * (0.3 + rng() * 0.4), groundY - 2, 40 + rng() * 14);
    if (art.bird) birds(W * (0.22 + rng() * 0.3), H * (0.16 + rng() * 0.1), 4 + Math.floor(rng() * 4));
    if (art.flag) banner(W * (0.5 + (rng() - 0.5) * 0.3), groundY - 120 - rng() * 60, 60 + rng() * 30);
    if (art.wine) wineSet(W * (0.2 + rng() * 0.25), groundY - 4);
    if (art.flower) {
      var fi;
      for (fi = 0; fi < 9; fi++) {
        var fx = W * (0.08 + rng() * 0.84), fy = groundY + rng() * (H - groundY) * 0.5;
        ctx.fillStyle = rgba(P.tint ? mix(INK.zhu, [230, 200, 180], 0.35) : INK.qing, 0.7);
        ctx.beginPath(); ctx.arc(fx, fy, 2.4 + rng() * 2, 0, 6.29); ctx.fill();
        ctx.strokeStyle = rgba(inkOf(rng, 3), 0.4); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(fx, fy + 3); ctx.lineTo(fx + (rng() - 0.5) * 4, fy + 10 + rng() * 6); ctx.stroke();
      }
    }
    if (art.autumn) fallingLeaves(W, H, groundY);
    if (art.snow) snowfall(W, H);
    if (art.night && !art.moon && !art.house) { // 无月之夜补星子
      var si;
      for (si = 0; si < 26; si++) {
        ctx.fillStyle = rgba(INK.zhong, 0.35 + rng() * 0.3);
        ctx.fillRect(rng() * W, rng() * H * 0.4, 1.2, 1.2);
      }
    }
    inscription(W, H, opts.title || '', opts.author || '');
    frame(W, H);
  }

  function autumnLeafFn() {
    var ctx = P.ctx, rng = P.rng;
    return function (x, y) {
      var i, n = 3 + Math.floor(rng() * 4);
      for (i = 0; i < n; i++) {
        ctx.fillStyle = rgba(P.tint ? mix(INK.zhe, [200, 120, 50], 0.4) : mix(inkOf(rng, 3), INK.zhe, 0.35), 0.5);
        ctx.save();
        ctx.translate(x + (rng() - 0.5) * 16, y + (rng() - 0.5) * 16);
        ctx.rotate(rng() * 6.28);
        ctx.beginPath(); ctx.ellipse ? ctx.ellipse(0, 0, 5, 2.2, 0, 0, 6.29) : ctx.arc(0, 0, 3, 0, 6.29);
        ctx.fill(); ctx.restore();
      }
    };
  }
  function fallingLeaves(W, H, groundY) {
    var ctx = P.ctx, rng = P.rng, i;
    for (i = 0; i < 16; i++) {
      var x = rng() * W, y = rng() * groundY;
      ctx.fillStyle = rgba(P.tint ? mix(INK.zhe, [210, 130, 60], 0.45) : mix(inkOf(rng, 3), INK.zhe, 0.4), 0.3 + rng() * 0.3);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rng() * 6.28);
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(0, 0, 5.5, 2.4, 0, 0, 6.29); else ctx.arc(0, 0, 3, 0, 6.29);
      ctx.fill(); ctx.restore();
    }
  }
  function rockOutcrop(x, y, H) {
    var ctx = P.ctx, rng = P.rng, col = inkOf(rng, 1);
    var w = 150 + rng() * 90, h = 70 + rng() * 60;
    var g = ctx.createLinearGradient(x - w / 2, y - h, x + w / 2, y);
    g.addColorStop(0, rgba(col, 0.42));
    g.addColorStop(1, rgba(col, 0.12));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + 16);
    ctx.quadraticCurveTo(x - w * 0.42, y - h * 0.72, x - w * 0.1, y - h);
    ctx.quadraticCurveTo(x + w * 0.3, y - h * 0.82, x + w * 0.5, y - h * 0.3);
    ctx.quadraticCurveTo(x + w * 0.52, y, x + w / 2, y + 16);
    ctx.closePath(); ctx.fill();
    var i;
    for (i = 0; i < 26; i++) { // 皴
      var cx = x - w * 0.35 + rng() * w * 0.8, cy = y - rng() * h * 0.9;
      dryStroke(ctx, cx, cy, cx + 6 + rng() * 20, cy + 8 + rng() * 18, 0.9, col, 0.14, rng);
    }
  }

  window.InkPaint = { paint: paint, hashStr: hashStr, mulberry32: mulberry32 };
})();
