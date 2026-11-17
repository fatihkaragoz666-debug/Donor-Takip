/* Donör Takip – PDF rapor yazıcı (kütüphanesiz).
 * Rapor modeli (başlık, KPI kutuları, tablolar, grafikler) A4 PDF'e dönüştürülür.
 * Türkçe karakterler için "DT Rapor" yazı tipi (js/pdf-font.js) gömülür.
 */
(function (root) {
  'use strict';
  var PDFR = {};
  var S = function (v) { return v == null ? '' : String(v); };

  /* ---------------- yazı tipi ---------------- */
  var FONTS = null;
  function fonts() {
    if (FONTS) return FONTS;
    var src = root.PDF_FONT;
    if (!src) throw new Error('PDF yazı tipi yüklenemedi');
    FONTS = {};
    ['R', 'B'].forEach(function (k) {
      var f = src[k], map = {}, uni = [];
      f.cmap.split(',').forEach(function (p) {
        var a = p.split(':'), cp = parseInt(a[0], 16), g = parseInt(a[1], 16);
        map[cp] = g; if (uni[g] == null) uni[g] = cp;
      });
      FONTS[k] = { src: f, map: map, uni: uni, w: f.w, q: map[0x3f] || 0, used: {} };
    });
    return FONTS;
  }
  var ZW = { 0x200b: 1, 0x200c: 1, 0x200d: 1, 0xfeff: 1, 0xad: 1 };
  var SP = { 0x00a0: 0x20, 0x202f: 0x20, 0x2009: 0x20, 0x2007: 0x20, 0x2002: 0x20, 0x2003: 0x20, 0x09: 0x20, 0x0a: 0x20, 0x0d: 0x20 };
  function gids(f, str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var cp = str.codePointAt(i);
      if (cp > 0xffff) i++;
      if (ZW[cp]) continue;
      if (SP[cp]) cp = SP[cp];
      var g = f.map[cp];
      if (g == null) {
        var base = String.fromCodePoint(cp).normalize('NFD').codePointAt(0);
        g = f.map[base];
        if (g == null) g = f.q;
      }
      out.push(g);
    }
    return out;
  }
  function width(str, size, bold) {
    var f = fonts()[bold ? 'B' : 'R'], g = gids(f, S(str)), t = 0;
    for (var i = 0; i < g.length; i++) t += f.w[g[i]] || 0;
    return t * size / 1000;
  }
  PDFR.width = width;
  function fit(str, w, size, bold) {
    str = S(str);
    if (width(str, size, bold) <= w + 0.05) return str;
    var lo = 0, hi = str.length;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (width(str.slice(0, m) + '…', size, bold) <= w) lo = m; else hi = m - 1; }
    return lo ? str.slice(0, lo).replace(/\s+$/, '') + '…' : '';
  }
  function wrap(str, w, size, bold, maxLines) {
    var words = S(str).replace(/\s+/g, ' ').trim().split(' '), lines = [], cur = '';
    if (!words[0]) return [''];
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (width(t, size, bold) <= w + 0.05) { cur = t; continue; }
      if (cur) { lines.push(cur); cur = ''; }
      var wd = words[i];
      while (width(wd, size, bold) > w && wd.length > 1) {
        var k = wd.length - 1; while (k > 1 && width(wd.slice(0, k), size, bold) > w) k--;
        lines.push(wd.slice(0, k)); wd = wd.slice(k);
      }
      cur = wd;
    }
    if (cur) lines.push(cur);
    if (maxLines && lines.length > maxLines) { var rest = lines.slice(maxLines - 1).join(' '); lines = lines.slice(0, maxLines - 1); lines.push(fit(rest, w, size, bold)); }
    return lines;
  }
  PDFR.wrap = wrap;

  /* ---------------- renkler ---------------- */
  var C = { ink: '#1d2733', ink2: '#4a5764', ink3: '#7b8794', line: '#d9dee3', soft: '#f4f6f9', head: '#1F3A5F', accent: '#C8102E', tot: '#e8edf3', kpi: '#f6f8fa' };
  PDFR.COLORS = C;
  function rgb(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) || [0, '00', '00', '00'];
    return [m[1], m[2], m[3]].map(function (x) { return (parseInt(x, 16) / 255).toFixed(3).replace(/\.?0+$/, '') || '0'; }).join(' ');
  }
  var n2 = function (v) { return (Math.round(v * 100) / 100).toString(); };

  /* ---------------- sayfa düzeni ---------------- */
  function Doc(model, fmt) {
    this.m = model; this.fmt = fmt;
    this.W = model.landscape ? 841.89 : 595.28; this.H = model.landscape ? 595.28 : 841.89;
    this.ml = 36; this.mr = 36; this.mt = 34; this.mb = 40;
    this.cw = this.W - this.ml - this.mr;
    this.pages = []; this.page = null; this.y = 0;
  }
  var P = Doc.prototype;
  P.newPage = function () {
    this.page = []; this.pages.push(this.page);
    this.y = this.mt;
    // üst bilgi: kurum ve rapor adı
    this.text('Türk Kızılay · OABKM Donör Takip', this.ml, this.y, 7, false, C.ink3);
    var r = this.m.title + (this.m.period ? '  ·  ' + this.m.period : '');
    this.text(r, this.W - this.mr - width(r, 7, false), this.y, 7, false, C.ink3);
    this.line(this.ml, this.y + 4, this.W - this.mr, this.y + 4, C.line, 0.6);
    this.y += 16;
  };
  P.bottom = function () { return this.H - this.mb; };
  P.space = function (h) { if (!this.page || this.y + h > this.bottom()) this.newPage(); };
  P.op = function (s) { if (!this.dry) this.page.push(s); };
  P.text = function (str, x, y, size, bold, color) {
    if (this.dry) return;
    str = S(str); if (!str) return;
    var f = fonts()[bold ? 'B' : 'R'], g = gids(f, str), hex = '';
    for (var i = 0; i < g.length; i++) { f.used[g[i]] = 1; hex += ('000' + g[i].toString(16)).slice(-4); }
    this.page.push(rgb(color || C.ink) + ' rg BT /' + (bold ? 'F2' : 'F1') + ' ' + n2(size) + ' Tf 1 0 0 1 ' + n2(x) + ' ' + n2(this.H - y) + ' Tm <' + hex + '> Tj ET');
  };
  P.rect = function (x, y, w, h, fill, stroke, lw) {
    if (this.dry) return;
    var s = (fill ? rgb(fill) + ' rg ' : '') + (stroke ? rgb(stroke) + ' RG ' + n2(lw || 0.5) + ' w ' : '') + n2(x) + ' ' + n2(this.H - y - h) + ' ' + n2(w) + ' ' + n2(h) + ' re ' + (fill && stroke ? 'B' : fill ? 'f' : 'S');
    this.page.push(s);
  };
  P.line = function (x1, y1, x2, y2, color, lw) {
    if (this.dry) return;
    this.page.push(rgb(color || C.line) + ' RG ' + n2(lw || 0.5) + ' w ' + n2(x1) + ' ' + n2(this.H - y1) + ' m ' + n2(x2) + ' ' + n2(this.H - y2) + ' l S');
  };

  /* ---------------- bloklar ---------------- */
  P.cover = function () {
    var m = this.m;
    this.newPage();
    this.text(m.title, this.ml, this.y + 14, 19, true, C.head);
    this.y += 22;
    if (m.period) { this.text('Dönem: ' + m.period, this.ml, this.y + 9, 10, true, C.ink2); this.y += 13; }
    (m.info || []).forEach(function (l) { this.text(l, this.ml, this.y + 8, 8, false, C.ink3); this.y += 11; }, this);
    this.rect(this.ml, this.y + 3, 54, 2.2, C.accent);
    this.rect(this.ml + 54, this.y + 3.6, this.cw - 54, 0.8, C.line);
    this.y += 16;
  };
  P.heading = function (b, x, w) {
    var flow = x == null; x = x == null ? this.ml : x; w = w || this.cw;
    if (flow) this.space(16 + 100);
    this.rect(x, this.y + 1.5, 3, 11, C.accent);
    this.text(fit(b.text, w - 8, 11, true), x + 8, this.y + 11, 11, true, C.head);
    if (b.sub) this.text(b.sub, x + 10 + width(b.text, 11, true) + 6, this.y + 11, 7.5, false, C.ink3);
    this.y += 19;
    return 19;
  };
  P.caption = function (t, x, w) {
    this.text(fit(t, w, 9, true), x, this.y + 9, 9, true, C.ink);
    this.y += 14;
  };
  P.note = function (b, x, w) {
    var flow = x == null; x = x == null ? this.ml : x; w = w || this.cw;
    var lines = wrap(b.text, w, 7.3, false), h = lines.length * 9.5 + 4;
    if (flow) this.space(h);
    lines.forEach(function (l, i) { this.text(l, x, this.y + 7.5 + i * 9.5, 7.3, false, C.ink3); }, this);
    this.y += h;
    return h;
  };
  P.kpis = function (b, x, w) {
    var flow = x == null; x = x == null ? this.ml : x; w = w || this.cw;
    var items = b.items, n = items.length, per = b.per || (this.m.landscape ? Math.min(n, 6) : (n <= 4 ? n : n % 4 === 0 ? 4 : n <= 6 ? 3 : 4));
    var gap = 7, bw = (w - gap * (per - 1)) / per, rows = Math.ceil(n / per), bh = 46, h = rows * bh + (rows - 1) * gap + 10;
    if (flow) this.space(h);
    var y0 = this.y;
    items.forEach(function (it, i) {
      var r = Math.floor(i / per), c = i % per, bx = x + c * (bw + gap), by = y0 + r * (bh + gap);
      this.rect(bx, by, bw, bh, C.kpi, C.line, 0.5);
      this.rect(bx, by, bw, 2.2, it.c || C.head);
      var v = this.fmt(it.v, it.f), size = 15;
      while (size > 9 && width(v, size, true) > bw - 12) size -= 0.5;
      this.text(v, bx + 7, by + 21, size, true, C.ink);
      wrap(it.l, bw - 12, 7.2, false, 2).forEach(function (l, k) { this.text(l, bx + 7, by + 32 + k * 8.6, 7.2, false, C.ink2); }, this);
    }, this);
    this.y = y0 + h;
    return h;
  };
  // tablo sütun genişlikleri: sayılar içeriğine sığar (başlık kelime kelime kaydırılır), metin sütunları kalan alanı paylaşır
  P.colWidths = function (b, w, fs) {
    var cols = b.cols, self = this, pad = 10, hfs = fs - 0.4;
    var sample = b.rows.length > 400 ? b.rows.slice(0, 400) : b.rows;
    var isNum = cols.map(function (c) { return c.f && c.f !== 'txt'; });
    var info = cols.map(function (c, ci) {
      var cw = 0;
      sample.forEach(function (r) { var v = r.v || r; var tw = width(self.fmt(v[ci], c.f), fs, !!r.bold); if (tw > cw) cw = tw; });
      if (b.tot) { var tw = width(self.fmt(b.tot[ci], c.f), fs, true); if (tw > cw) cw = tw; }
      var hw = width(c.t, hfs, true), word = 0;
      S(c.t).split(/\s+/).forEach(function (wd) { var x2 = width(wd, hfs, true); if (x2 > word) word = x2; });
      var nat = Math.max(cw, hw) + pad;
      var min = isNum[ci] ? Math.max(cw, word) + pad : Math.max(Math.min(cw, 42), word) + pad;
      return { nat: Math.max(nat, min), min: min };
    });
    var nat = info.map(function (i) { return i.nat; }), total = nat.reduce(function (a, v) { return a + v; }, 0);
    if (total <= w) {
      var txt = nat.reduce(function (a, v, i) { return a + (isNum[i] ? 0 : v); }, 0), extra = w - total;
      return nat.map(function (v, i) { return txt ? (isNum[i] ? v : v + extra * v / txt) : v + extra * v / total; });
    }
    // daraltma sırası: en geniş metin sütunları (su seviyesi gibi) → sayı sütunlarının başlık fazlası → metin sütunları 30 pt'ye → orantılı
    var ws = nat.slice(), need = total - w;
    var txtIdx = [], numIdx = [];
    cols.forEach(function (c, i) { (isNum[i] ? numIdx : txtIdx).push(i); });
    var mins = info.map(function (i) { return i.min; });
    need = squeeze(ws, mins, txtIdx, need);
    if (need > 0) need = squeeze(ws, mins, numIdx, need);
    if (need > 0) need = squeeze(ws, ws.map(function (v, i) { return isNum[i] ? v : Math.min(v, 30); }), txtIdx, need);
    var sumW = ws.reduce(function (a2, v) { return a2 + v; }, 0);
    if (sumW > w + 0.01) return ws.map(function (v) { return v * w / sumW; });
    if (sumW < w && txtIdx.length) { var big = txtIdx.reduce(function (m, i) { return ws[i] > ws[m] ? i : m; }, txtIdx[0]); ws[big] += w - sumW; }
    return ws;
  };
  // idx sütunlarını en genişten başlayarak alt sınırlarına kadar daraltır; karşılanamayan miktarı döndürür
  function squeeze(ws, lows, idx, need) {
    if (!idx.length || need <= 0) return need;
    var cur = 0, low = 0, mx = 0;
    idx.forEach(function (i) { cur += ws[i]; low += Math.min(lows[i], ws[i]); if (ws[i] > mx) mx = ws[i]; });
    var target = cur - need;
    if (target <= low) { idx.forEach(function (i) { ws[i] = Math.min(lows[i], ws[i]); }); return target < low ? low - target : 0; }
    var lo = 0, hi = mx;
    for (var k = 0; k < 40; k++) {
      var L = (lo + hi) / 2, t = 0;
      idx.forEach(function (i) { t += Math.max(Math.min(lows[i], ws[i]), Math.min(ws[i], L)); });
      if (t > target) hi = L; else lo = L;
    }
    idx.forEach(function (i) { ws[i] = Math.max(Math.min(lows[i], ws[i]), Math.min(ws[i], lo)); });
    return 0;
  }
  P.table = function (b, x, w) {
    var flow = x == null; x = x == null ? this.ml : x; w = w || this.cw;
    var fs = b.fs || (b.rows.length > 30 ? 7.4 : 7.8), self = this, cols = b.cols;
    var cw = this.colWidths(b, w, fs);
    var hfs = fs - 0.4, padX = 4.5, lh = fs + 2.4;
    var headLines = cols.map(function (c, i) { return wrap(c.t, cw[i] - padX * 2, hfs, true, 3); });
    var hh = Math.max.apply(null, headLines.map(function (l) { return l.length; })) * (hfs + 1.8) + 7;
    var rowInfo = function (r) {
      var v = r.v || r, n = 1;
      var cells = cols.map(function (c, i) {
        var t = self.fmt(v[i], c.f), avail = cw[i] - padX * 2;
        if (c.wrap) { var ls = wrap(t, avail, fs, !!r.bold, c.wrap === true ? 3 : c.wrap); if (ls.length > n) n = ls.length; return ls; }
        return [fit(t, avail, fs, !!r.bold)];
      });
      return { cells: cells, h: n * lh + 6.5, bold: !!r.bold, muted: !!r.muted, color: r.color };
    };
    var drawHead = function () {
      self.rect(x, self.y, w, hh, b.headColor || C.head);
      var cx = x;
      cols.forEach(function (c, i) {
        headLines[i].forEach(function (l, k) {
          var tw = width(l, hfs, true), tx = c.a === 'c' || (!c.a && c.f && c.f !== 'txt') ? cx + cw[i] - padX - tw : cx + padX;
          if (c.a === 'c') tx = cx + (cw[i] - tw) / 2;
          self.text(l, tx, self.y + 4 + (k + 1) * (hfs + 1.8) - 1.6, hfs, true, '#ffffff');
        });
        cx += cw[i];
      });
      self.y += hh;
    };
    var drawRow = function (ri, info, tot) {
      if (tot) self.rect(x, self.y, w, info.h, C.tot);
      else if (ri % 2 === 1) self.rect(x, self.y, w, info.h, C.soft);
      var cx = x, col = info.muted ? C.ink3 : info.color || C.ink;
      cols.forEach(function (c, i) {
        info.cells[i].forEach(function (l, k) {
          var tw = width(l, fs, info.bold || tot), right = !c.a && c.f && c.f !== 'txt' || c.a === 'r';
          var tx = right ? cx + cw[i] - padX - tw : c.a === 'c' ? cx + (cw[i] - tw) / 2 : cx + padX;
          self.text(l, tx, self.y + 3.2 + (k + 1) * lh - 2.2, fs, info.bold || tot, col);
        });
        cx += cw[i];
      });
      if (tot) self.line(x, self.y, x + w, self.y, C.ink3, 0.6);
      self.y += info.h;
    };
    var infos = b.rows.map(rowInfo), totInfo = b.tot ? rowInfo({ v: b.tot, bold: true }) : null;
    var capH = b.title ? 14 : 0, noteLines = b.note ? wrap(b.note, w, 7.3, false) : [];
    var bodyH = infos.reduce(function (a, r) { return a + r.h; }, 0) + (totInfo ? totInfo.h : 0);
    var full = capH + hh + bodyH + (b.rows.length ? 0 : 16) + (noteLines.length ? noteLines.length * 9.5 + 4 : 0) + 10;
    if (!flow) {
      var y0 = this.y;
      if (b.title) this.caption(b.title, x, w);
      drawHead();
      infos.forEach(function (r, i) { drawRow(i, r); });
      if (!b.rows.length) { this.text(b.empty || 'Kayıt yok', x + padX, this.y + 11, fs, false, C.ink3); this.y += 16; }
      if (totInfo) drawRow(0, totInfo, true);
      noteLines.forEach(function (l) { this.text(l, x, this.y + 9, 7.3, false, C.ink3); this.y += 9.5; }, this);
      this.y = y0 + full;
      return full;
    }
    // akış: başlık + ilk satırlar aynı sayfada; sayfa geçişinde başlık satırı tekrar
    var first = infos.slice(0, 3).reduce(function (a, r) { return a + r.h; }, 0);
    this.space(Math.min(full, capH + hh + first + 4));
    if (b.title) this.caption(b.title, x, w);
    drawHead();
    infos.forEach(function (r, i) {
      if (this.y + r.h > this.bottom()) {
        this.newPage();
        if (b.title) { this.text(fit(b.title + ' (devam)', w, 8, true), x, this.y + 8, 8, true, C.ink3); this.y += 12; }
        drawHead();
      }
      drawRow(i, r);
    }, this);
    if (!b.rows.length) { this.text(b.empty || 'Kayıt yok', x + padX, this.y + 11, fs, false, C.ink3); this.y += 16; }
    if (totInfo) { if (this.y + totInfo.h > this.bottom()) { this.newPage(); drawHead(); } drawRow(0, totInfo, true); }
    if (noteLines.length) { this.space(noteLines.length * 9.5 + 4); noteLines.forEach(function (l) { this.text(l, x, this.y + 9, 7.3, false, C.ink3); this.y += 9.5; }, this); this.y += 4; }
    this.y += 10;
    return full;
  };
  function nice(max) {
    if (max <= 0) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(max))), f = max / e;
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    if (e < 1 && n * e < 1) return 1;
    return n * e;
  }
  P.bars = function (b, x, w) {
    var flow = x == null; x = x == null ? this.ml : x; w = w || this.cw;
    var ch = b.h || 120, capH = b.title ? 14 : 0, legH = b.series.length > 1 ? 12 : 0, h = capH + legH + ch + 16 + 8;
    if (flow) this.space(h);
    var y0 = this.y, self = this;
    if (b.title) this.caption(b.title, x, w);
    var max = 0; b.series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    var stp = nice(max / 4 || 1), top = Math.max(stp, Math.ceil(max * 1.04 / stp) * stp), ticks = Math.round(top / stp), sf = b.short || function (v) { return self.fmt(v, b.f === 'tl' || b.f === 'tl0' ? 'kisa' : 'int'); };
    var axisW = Math.max(width(sf(top), 6.5, false), 10) + 6, px = x + axisW, pw = w - axisW;
    if (legH) {
      var lx = x + w; b.series.slice().reverse().forEach(function (s) { var tw = width(s.name, 7, false); lx -= tw + 16; self.rect(lx, self.y + 1.5, 7, 7, s.color); self.text(s.name, lx + 10, self.y + 8, 7, false, C.ink2); });
      this.y += legH;
    }
    var cy = this.y, base = cy + ch;
    var fr = []; for (var q = 0; q <= ticks; q++) fr.push(q / ticks);
    fr.forEach(function (f) {
      var gy = base - f * ch;
      self.line(px, gy, px + pw, gy, f === 0 ? C.ink3 : '#e6eaee', f === 0 ? 0.6 : 0.4);
      var lab = sf(top * f); self.text(lab, px - 4 - width(lab, 6.5, false), gy + 2.3, 6.5, false, C.ink3);
    });
    var n = b.labels.length, gw = pw / Math.max(n, 1), ns = b.series.length;
    var bw = Math.min(26, Math.max(2, (gw * 0.78) / ns)), totalBars = n * ns;
    var step = n > 16 && width(b.labels.join(''), 6.5, false) > pw * 0.9 ? 2 : 1;
    b.labels.forEach(function (l, i) {
      var gx = px + i * gw + (gw - bw * ns) / 2;
      b.series.forEach(function (s, k) {
        var v = s.values[i] || 0, bh = top ? v / top * ch : 0;
        if (bh > 0) self.rect(gx + k * bw + 0.4, base - bh, bw - 0.8, bh, s.color);
        if (v && totalBars <= 36 && bw >= 9) { var t = sf(v); var tw = width(t, 5.8, false); if (tw <= bw + 6) self.text(t, gx + k * bw + bw / 2 - tw / 2, base - bh - 2, 5.8, false, C.ink2); }
      });
      if (i % step === 0) { var t2 = fit(l, gw * step - 2, 6.5, false), tw2 = width(t2, 6.5, false); self.text(t2, px + i * gw + gw / 2 - tw2 / 2, base + 9, 6.5, false, C.ink2); }
    });
    this.y = y0 + h;
    return h;
  };
  P.hbars = function (b, x, w) {
    var flow = x == null; x = x == null ? this.ml : x; w = w || this.cw;
    var rows = b.rows.filter(function (r) { return r[1] > 0; }), self = this, rh = 13, capH = b.title ? 14 : 0;
    var h = capH + Math.max(rows.length, 1) * rh + 10;
    if (flow) this.space(Math.min(h, capH + rh * 4));
    var y0 = this.y;
    if (b.title) this.caption(b.title, x, w);
    if (!rows.length) { this.text(b.empty || 'Veri yok', x, this.y + 9, 7.5, false, C.ink3); this.y = y0 + h; return h; }
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    var lw = Math.min(w * 0.38, Math.max.apply(null, rows.map(function (r) { return width(r[0], 7.3, false); })) + 6);
    var vals = rows.map(function (r) { return self.fmt(r[1], b.f); }), vw = Math.max.apply(null, vals.map(function (v) { return width(v, 7, true); })) + 6;
    var bwMax = w - lw - vw;
    rows.forEach(function (r, i) {
      if (flow && this.y + rh > this.bottom()) this.newPage();
      var bl = Math.max(1, r[1] / max * bwMax);
      this.text(fit(r[0], lw - 6, 7.3, false), x, this.y + 9, 7.3, false, C.ink);
      this.rect(x + lw, this.y + 2.5, bl, 8, r[2] || b.color || C.head);
      this.text(vals[i], x + lw + bl + 4, this.y + 9, 7, true, C.ink2);
      this.y += rh;
    }, this);
    this.y += 10;
    if (!flow) this.y = y0 + h;
    return h;
  };
  P.measure = function (b, w) {
    var saveY = this.y, savePage = this.page; this.dry = true; this.y = 0;
    var h = this.block(b, 0, w);
    this.dry = false; this.y = saveY; this.page = savePage;
    return h;
  };
  P.block = function (b, x, w) {
    switch (b.type) {
      case 'h': return this.heading(b, x, w);
      case 'note': return this.note(b, x, w);
      case 'kpis': return this.kpis(b, x, w);
      case 'table': return this.table(b, x, w);
      case 'bars': return this.bars(b, x, w);
      case 'hbars': return this.hbars(b, x, w);
      case 'break': if (x == null && this.y > this.mt + 40) this.newPage(); return 0;
      case 'row': return this.row(b, x, w);
      default: return 0;
    }
  };
  P.row = function (b, x, w) {
    var items = b.items.filter(function (it) { return it && it.pdf !== false; });
    if (x != null || !items.length) { items.forEach(function (it) { this.block(it, x, w); }, this); return 0; }
    var gap = 16, iw = (this.cw - gap * (items.length - 1)) / items.length, self = this;
    var hs = items.map(function (it) { return self.measure(it, iw); }), h = Math.max.apply(null, hs);
    if (h > this.bottom() - this.mt - 30) { items.forEach(function (it) { this.block(it); }, this); return 0; }
    this.space(h);
    var y0 = this.y;
    items.forEach(function (it, i) { self.y = y0; self.block(it, self.ml + i * (iw + gap), iw); });
    this.y = y0 + h;
    return h;
  };

  /* ---------------- PDF dosyası ---------------- */
  var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  function bytesOf(s) { return enc.encode(s); }
  function b64bytes(b64) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function deflate(u8) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var cs = new CompressionStream('deflate'), w = cs.writable.getWriter();
      w.write(u8); w.close();
      return new Response(cs.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); }, function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function utf16hex(s) {
    var hx = 'FEFF';
    for (var i = 0; i < s.length; i++) hx += ('000' + s.charCodeAt(i).toString(16)).slice(-4).toUpperCase();
    return '<' + hx + '>';
  }
  function toUnicode(f) {
    var lines = [], gs = [];
    f.uni.forEach(function (cp, g) { if (cp != null) gs.push([g, cp]); });
    for (var i = 0; i < gs.length; i += 100) {
      var ch = gs.slice(i, i + 100);
      lines.push(ch.length + ' beginbfchar');
      ch.forEach(function (p) {
        var u = String.fromCodePoint(p[1]), hx = '';
        for (var k = 0; k < u.length; k++) hx += ('000' + u.charCodeAt(k).toString(16)).slice(-4);
        lines.push('<' + ('000' + p[0].toString(16)).slice(-4) + '> <' + hx + '>');
      });
      lines.push('endbfchar');
    }
    return '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n' +
      '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <ffff>\nendcodespacerange\n' + lines.join('\n') +
      '\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
  }
  P.assemble = function () {
    var self = this, F = fonts(), objs = [], streams = [];
    var add = function (body, stream) { objs.push({ body: body, stream: stream || null }); return objs.length; };
    var catalog = add(''), pagesId = add(''), info = add('');
    var fontIds = {};
    ['R', 'B'].forEach(function (k) {
      var f = F[k], src = f.src;
      var file = add('<< /Length1 ' + src.len1 + ' /Filter /FlateDecode', b64bytes(src.b64));
      var desc = add('<< /Type /FontDescriptor /FontName /' + src.name + ' /Flags 32 /FontBBox [' + src.bbox.join(' ') + '] /ItalicAngle 0 /Ascent ' + src.asc +
        ' /Descent ' + src.desc + ' /CapHeight ' + src.cap + ' /StemV ' + (k === 'B' ? 120 : 80) + ' /FontFile2 ' + file + ' 0 R >>');
      var cid = add('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /' + src.name + ' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ' + desc +
        ' 0 R /DW 500 /W [0 [' + src.w.join(' ') + ']] /CIDToGIDMap /Identity >>');
      var tu = add('<<', bytesOf(toUnicode(f)));
      fontIds[k] = add('<< /Type /Font /Subtype /Type0 /BaseFont /' + src.name + ' /Encoding /Identity-H /DescendantFonts [' + cid + ' 0 R] /ToUnicode ' + tu + ' 0 R >>');
    });
    var pageIds = [];
    var N = this.pages.length;
    this.pages.forEach(function (ops, i) {
      // alt bilgi
      self.page = ops;
      var yb = self.H - self.mb + 16;
      self.line(self.ml, yb - 9, self.W - self.mr, yb - 9, C.line, 0.6);
      self.text(self.m.footer || '', self.ml, yb, 7, false, C.ink3);
      var pn = 'Sayfa ' + (i + 1) + ' / ' + N;
      self.text(pn, self.W - self.mr - width(pn, 7, false), yb, 7, false, C.ink3);
      var content = add('<<', bytesOf(ops.join('\n')));
      streams.push(content);
      pageIds.push(add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + n2(self.W) + ' ' + n2(self.H) + '] /Resources << /Font << /F1 ' + fontIds.R + ' 0 R /F2 ' + fontIds.B +
        ' 0 R >> /ProcSet [/PDF /Text] >> /Contents ' + content + ' 0 R >>'));
    });
    objs[catalog - 1].body = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R /Lang (tr-TR) /ViewerPreferences << /DisplayDocTitle true >> >>';
    objs[pagesId - 1].body = '<< /Type /Pages /Kids [' + pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') + '] /Count ' + pageIds.length + ' >>';
    var d = new Date(), p2 = function (v) { return (v < 10 ? '0' : '') + v; };
    var ds = 'D:' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
    objs[info - 1].body = '<< /Title ' + utf16hex(this.m.title + (this.m.period ? ' · ' + this.m.period : '')) + ' /Producer (Donor Takip) /Creator ' + utf16hex('Donör Takip') + ' /CreationDate (' + ds + ') >>';
    // içerik akışları sıkıştırılır (destekleniyorsa)
    return Promise.all(streams.map(function (id) { return deflate(objs[id - 1].stream).then(function (z) { if (z && z.length < objs[id - 1].stream.length) { objs[id - 1].stream = z; objs[id - 1].body = '<< /Filter /FlateDecode'; } }); }))
      .then(function () {
        var chunks = [], off = 0, xref = [];
        var push = function (u) { chunks.push(u); off += u.length; };
        push(bytesOf('%PDF-1.4\n')); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
        objs.forEach(function (o, i) {
          xref.push(off);
          if (o.stream) {
            push(bytesOf((i + 1) + ' 0 obj\n' + o.body + ' /Length ' + o.stream.length + ' >>\nstream\n'));
            push(o.stream);
            push(bytesOf('\nendstream\nendobj\n'));
          } else push(bytesOf((i + 1) + ' 0 obj\n' + o.body + '\nendobj\n'));
        });
        var xs = off, x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
        xref.forEach(function (o) { x += ('000000000' + o).slice(-10) + ' 00000 n \n'; });
        x += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xs + '\n%%EOF\n';
        push(bytesOf(x));
        var out = new Uint8Array(off), p = 0;
        chunks.forEach(function (c) { out.set(c, p); p += c.length; });
        return out;
      });
  };

  /** model: { title, period, info:[satır], footer, landscape, blocks:[…] } · fmt(değer, biçim) → metin */
  PDFR.build = function (model, fmt) {
    return new Promise(function (res) { res(); }).then(function () {
      var doc = new Doc(model, fmt);
      doc.cover();
      model.blocks.forEach(function (b) { if (b && b.pdf !== false) doc.block(b); });
      model.sayfa = doc.pages.length;
      return doc.assemble();
    });
  };

  PDFR._Doc = Doc;
  root.PDFR = PDFR;
  if (typeof module !== 'undefined' && module.exports) module.exports = PDFR;
})(typeof window !== 'undefined' ? window : globalThis);
