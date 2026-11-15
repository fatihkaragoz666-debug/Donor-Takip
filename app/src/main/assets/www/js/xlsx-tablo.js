/* Donör Takip – kullanıcının kendi Excel tablosunun (şablon) güncel verilerle aynısını üretir.
 * Şablondaki sayfalar, formüller, biçimler, resimler ve grafikler olduğu gibi kalır; yalnızca uygulamada
 * tutulan giriş hücreleri (Donör Kayıt, personel seçimleri, ek görevler, ek konsültasyon, ajanda, arşivler,
 * listeler, kapanış) güncellenir. Değişmeyen zip parçaları sıkıştırılmış hâliyle kopyalanır.
 */
(function (root) {
  'use strict';
  var X = root.XLSXIO, DT = root.DT, T = {};
  var dec = new TextDecoder('utf-8'), enc = new TextEncoder();
  var S = function (v) { return v == null ? '' : String(v); };

  /* ---------------- zip: ham okuma / yazma ---------------- */
  function readEntries(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Şablon bir Excel (.xlsx) dosyası değil.');
    var n = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), list = [];
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Şablonun zip dizini bozuk.');
      var e = {
        flags: dv.getUint16(p + 8, true), method: dv.getUint16(p + 10, true), time: dv.getUint16(p + 12, true), date: dv.getUint16(p + 14, true),
        crc: dv.getUint32(p + 16, true), csize: dv.getUint32(p + 20, true), usize: dv.getUint32(p + 24, true),
        extAttr: dv.getUint32(p + 38, true), off: dv.getUint32(p + 42, true)
      };
      if (e.csize === 0xFFFFFFFF || e.usize === 0xFFFFFFFF || e.off === 0xFFFFFFFF) throw new Error('Şablon çok büyük (zip64 desteklenmiyor).');
      var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      e.nameBytes = u8.slice(p + 46, p + 46 + nl);
      e.name = dec.decode(e.nameBytes);
      var lnl = dv.getUint16(e.off + 26, true), lel = dv.getUint16(e.off + 28, true), ds = e.off + 30 + lnl + lel;
      e.data = u8.subarray(ds, ds + e.csize);
      list.push(e);
      p += 46 + nl + el + cl;
    }
    return list;
  }
  function entryText(e) {
    if (e.method === 0) return Promise.resolve(dec.decode(e.data));
    return X.inflateRaw(e.data, e.usize).then(function (b) { return dec.decode(b); });
  }
  function deflateRaw(u8) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var cs = new CompressionStream('deflate-raw');
      return new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer()
        .then(function (b) { return new Uint8Array(b); }).catch(function () { return null; });
    } catch (err) { return Promise.resolve(null); }
  }
  function setText(e, text) {
    var raw = enc.encode(text);
    e.crc = X.crc32(raw); e.usize = raw.length;
    return deflateRaw(raw).then(function (z) {
      if (z && z.length < raw.length) { e.method = 8; e.data = z; } else { e.method = 0; e.data = raw; }
    });
  }
  function writeZip(list) {
    var parts = [], central = [], off = 0;
    list.forEach(function (e) {
      var flags = e.flags & 0x0800;   // UTF-8 ad bayrağı kalır; veri tanımlayıcı kullanılmaz
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, flags, true); h.setUint16(8, e.method, true);
      h.setUint16(10, e.time, true); h.setUint16(12, e.date, true); h.setUint32(14, e.crc, true);
      h.setUint32(18, e.data.length, true); h.setUint32(22, e.usize, true); h.setUint16(26, e.nameBytes.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), e.nameBytes, e.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, flags, true); c.setUint16(10, e.method, true);
      c.setUint16(12, e.time, true); c.setUint16(14, e.date, true); c.setUint32(16, e.crc, true); c.setUint32(20, e.data.length, true);
      c.setUint32(24, e.usize, true); c.setUint16(28, e.nameBytes.length, true); c.setUint32(38, e.extAttr || 0, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), e.nameBytes);
      off += 30 + e.nameBytes.length + e.data.length;
    });
    var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var z = new DataView(new ArrayBuffer(22));
    z.setUint32(0, 0x06054b50, true); z.setUint16(8, list.length, true); z.setUint16(10, list.length, true);
    z.setUint32(12, cdSize, true); z.setUint32(16, off, true);
    var all = parts.concat(central, [new Uint8Array(z.buffer)]);
    var out = new Uint8Array(off + cdSize + 22), q = 0;
    all.forEach(function (a) { out.set(a, q); q += a.length; });
    return out;
  }

  /* ---------------- hücre yazımı ---------------- */
  function escX(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  }
  var E = { t: 'e' };
  function txt(v) { v = S(v); return v.trim() === '' ? E : { t: 's', v: v }; }
  function num(v) { return v == null || v === '' || isNaN(+v) ? E : { t: 'n', v: +v }; }
  function numOrTxt(v) { v = S(v).trim(); return /^-?\d+(\.\d+)?$/.test(v) ? num(v) : txt(v); }
  function cellXml(ref, sAttr, sp) {
    var a = '<c r="' + ref + '"' + (sAttr != null ? ' s="' + sAttr + '"' : '');
    if (sp.t === 'e') return a + '/>';
    if (sp.t === 'n') return a + '><v>' + sp.v + '</v></c>';
    if (sp.t === 'f') return a + '><f>' + sp.f + '</f></c>';   // formül şablondaki (XML'e kaçırılmış) metinle yazılır
    var v = escX(sp.v), pre = /^\s|\s$|\n/.test(sp.v) ? ' xml:space="preserve"' : '';
    return a + ' t="inlineStr"><is><t' + pre + '>' + v + '</t></is></c>';
  }
  function same(cell, sp) {
    var empty = !cell || (!cell.f && (cell.v == null || cell.v === '' || cell.v === false));
    if (sp.t === 'e') return empty;
    if (sp.t === 'f') return !!(cell && cell.f);
    if (!cell || cell.f) return false;
    if (sp.t === 'n') return typeof cell.v === 'number' && Math.abs(cell.v - sp.v) < 1e-9;
    if (sp.t === 's') return typeof cell.v === 'string' ? cell.v.trim() === S(sp.v).trim() : S(cell.v) === S(sp.v).trim();
    return false;
  }
  // Bir sayfadaki değişiklikler: { satır: { sütun: spec } }
  function Changes(cur) { this.cur = cur || {}; this.ch = {}; this.n = 0; }
  Changes.prototype.set = function (r, c, sp, overF) {
    var cell = this.cur[r] && this.cur[r][c];
    if (cell && cell.f && sp.t !== 'f' && !overF) return;   // formül hücresinin üstüne yazılmaz
    if (same(cell, sp)) return;
    (this.ch[r] = this.ch[r] || {})[c] = sp; this.n++;
  };

  var ROW_RE = /<row\b([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g;
  var CELL_RE = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
  function attrOf(a, n) { var m = new RegExp('(?:^|\\s)' + n + '="([^"]*)"').exec(a); return m ? m[1] : null; }
  function cellsOfRow(body) {
    var out = [], m; CELL_RE.lastIndex = 0;
    while ((m = CELL_RE.exec(body))) {
      var ref = attrOf(m[1], 'r'); if (!ref) continue;
      out.push({ col: X.colIndex(ref), s: attrOf(m[1], 's'), xml: m[0], inner: m[3] || '' });
    }
    return out;
  }
  // Ham formül metni (XML'deki hâliyle)
  function rawFormula(xml, ref) {
    var i = xml.indexOf('<c r="' + ref + '"');
    if (i < 0) return null;
    var j = xml.indexOf('</c>', i), k = xml.indexOf('/>', i), gt = xml.indexOf('>', i);
    if (k >= 0 && k < gt) return null;
    var cell = xml.slice(i, j), m = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(cell);
    return m ? m[1] : null;
  }

  /* Paylaşılan formülleri (Excel'in kaydettiği dosyalarda) her hücreye açık yazar; böylece hücre değiştirmek güvenli olur. */
  function shiftFormula(f, dr, dc) {
    var out = '', i = 0;
    while (i < f.length) {
      var ch = f.charAt(i);
      if (ch === '"' || ch === "'") { var j = f.indexOf(ch, i + 1); while (j >= 0 && f.charAt(j + 1) === ch) j = f.indexOf(ch, j + 2); j = j < 0 ? f.length - 1 : j; out += f.slice(i, j + 1); i = j + 1; continue; }
      var m = /^(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_(])/.exec(f.slice(i, i + 16));
      var prev = i ? f.charAt(i - 1) : '';
      if (m && !/[A-Za-z0-9_.]/.test(prev)) {
        var col = m[1] ? m[2] : X.colName(X.colIndex(m[2]) + dc), row = m[3] ? +m[4] : +m[4] + dr;
        out += m[1] + col + m[3] + row; i += m[0].length; continue;
      }
      out += ch; i++;
    }
    return out;
  }
  function unshare(xml) {
    if (xml.indexOf('t="shared"') < 0) return xml;
    var masters = {}, re = /<c\b[^>]*?\br="([A-Z]+)(\d+)"[^>]*>(?:(?!<\/c>)[\s\S])*?<f\b([^>]*?)\bt="shared"([^>]*)>([\s\S]*?)<\/f>/g, m;
    while ((m = re.exec(xml))) {
      var at = m[3] + m[4], si = attrOf(at, 'si');
      if (attrOf(at, 'ref') && si != null) masters[si] = { c: X.colIndex(m[1]), r: +m[2], f: m[5] };
    }
    return xml.replace(/<c\b([^>]*?)\br="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g, function (all, a1, cl, rw, a2, inner) {
      if (inner.indexOf('t="shared"') < 0) return all;
      var fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(inner); if (!fm) return all;
      var si = attrOf(fm[1], 'si'), ms = masters[si]; if (!ms) return all;
      var f = shiftFormula(ms.f, +rw - ms.r, X.colIndex(cl) - ms.c);
      return '<c' + a1 + ' r="' + cl + rw + '"' + a2 + '>' + inner.replace(fm[0], '<f>' + f + '</f>') + '</c>';
    });
  }

  function patchSheet(xml, chg, styleRow) {
    var rows = Object.keys(chg.ch).map(Number);
    if (!rows.length) return xml;
    xml = unshare(xml);
    var done = {}, styleCells = null;
    var buildCells = function (rn, existing, ch) {
      var map = {};
      existing.forEach(function (c) { map[c.col] = c; });
      Object.keys(ch).forEach(function (k) {
        var col = +k, old = map[col], s = old ? old.s : (styleCells && styleCells[col] ? styleCells[col] : null);
        map[col] = { col: col, s: s, xml: cellXml(X.colName(col) + rn, s, ch[k]) };
      });
      return Object.keys(map).map(Number).sort(function (a, b) { return a - b; }).map(function (c) { return map[c].xml; }).join('');
    };
    if (styleRow) {
      var sm = new RegExp('<row\\b[^>]*?\\br="' + styleRow + '"[^>]*>([\\s\\S]*?)<\\/row>').exec(xml);
      if (sm) { styleCells = {}; cellsOfRow(sm[1]).forEach(function (c) { styleCells[c.col] = c.s; }); }
    }
    var out = xml.replace(ROW_RE, function (m, attrs, tail, body) {
      var rn = +(/\br="(\d+)"/.exec(attrs) || [0, 0])[1], ch = chg.ch[rn];
      if (!ch) return m;
      done[rn] = 1;
      return '<row' + attrs.replace(/\s+spans="[^"]*"/, '') + '>' + buildCells(rn, cellsOfRow(body || ''), ch) + '</row>';
    });
    var missing = rows.filter(function (r) { return !done[r]; }).sort(function (a, b) { return a - b; });
    if (missing.length) {
      var starts = [], re = /<row\b[^>]*?\br="(\d+)"/g, m;
      while ((m = re.exec(out))) starts.push({ r: +m[1], at: m.index });
      var endAt = out.indexOf('</sheetData>');
      if (endAt < 0) { out = out.replace('<sheetData/>', '<sheetData></sheetData>'); endAt = out.indexOf('</sheetData>'); }
      var ins = [];
      missing.forEach(function (r) {
        var pos = endAt;
        for (var k = 0; k < starts.length; k++) if (starts[k].r > r) { pos = starts[k].at; break; }
        ins.push({ at: pos, xml: '<row r="' + r + '">' + buildCells(r, [], chg.ch[r]) + '</row>' });
      });
      for (var q = ins.length - 1; q >= 0; q--) out = out.slice(0, ins[q].at) + ins[q].xml + out.slice(ins[q].at);
      var maxR = missing[missing.length - 1];
      out = out.replace(/<dimension ref="([A-Z]+\d+):([A-Z]+)(\d+)"\/>/, function (d, a, bc, br) { return +br < maxR ? '<dimension ref="' + a + ':' + bc + maxR + '"/>' : d; });
    }
    return out;
  }

  /* ---------------- alanlar ---------------- */
  function rowNums(sh) { return Object.keys(sh || {}).map(Number).sort(function (a, b) { return a - b; }); }

  function areaDonorKayit(xml, ctx) {
    var cur = X.parseSheet(xml, ctx.sst, { maxCol: 30 }), chg = new Changes(cur), st = ctx.state;
    var headRow = 5, cols = {};
    for (var r = 1; r <= 12; r++) if (cur[r] && cur[r][1] && X.headerKey(cur[r][1].v) === 'HASTA KODU') { headRow = r; break; }
    var hr = cur[headRow] || {};
    Object.keys(hr).forEach(function (c) { var k = X.HEADERS[X.headerKey(hr[c].v)]; if (k && !(k in cols)) cols[k] = +c; });
    if (!cols.hk || !cols.top) throw new Error("Şablondaki 'Donör Kayıt' sayfasının başlıkları tanınmadı.");
    var rows = rowNums(cur), last = rows.length ? rows[rows.length - 1] : headRow;
    var cap = last - headRow;
    if (st.donors.length > cap) ctx.warn.push(cap + ' satırlık Donör Kayıt sayfasına ' + st.donors.length + ' donör sığmadı; fazlası yazılmadı.');
    var off = headRow - 1;
    var refOf = function (col) {
      if (!col) return null;
      for (var i = 0; i < rows.length; i++) {
        var rr = rows[i]; if (rr <= headRow) continue;
        var c = cur[rr][col]; if (c && c.f) { var f = rawFormula(xml, X.colName(col) + rr); if (f) return { r0: rr, f: f }; }
      }
      return null;
    };
    var refJ = refOf(cols.asi), refN = refOf(cols.sonIzlem);
    var gen = function (ref, r) {
      if (!ref) return null;
      if (r === ref.r0) return ref.f;
      return ref.f.replace(/([A-Z]{1,3}\$?)(\d+)(?!\d)/g, function (m, c, n) { n = +n; return n === ref.r0 ? c + r : n === ref.r0 - off ? c + (r - off) : m; });
    };
    var TEXT = ['hk', 'dno', 'ad', 'tel', 'ikamet', 'yontem', 'hastane', 'aciklama', 'bolge', 'personel', 'ulasim', 'konaklama', 'tasiyan'];
    var DATES = ['sk', 'top', 'idmBas', 'idmBit'];
    for (var rn = headRow + 1; rn <= last; rn++) {
      var d = st.donors[rn - headRow - 1] || null;
      TEXT.forEach(function (k) { if (cols[k]) chg.set(rn, cols[k], txt(d ? d[k] : '')); });
      DATES.forEach(function (k) { if (cols[k]) chg.set(rn, cols[k], num(d ? d[k] : null)); });
      if (cols.idm) chg.set(rn, cols.idm, d && d.idm ? txt('✓') : E);
      if (cols.asi) {
        if (d && d.asiManual === 'YOK') chg.set(rn, cols.asi, txt('Aşı yok'), true);
        else if (d && typeof d.asiManual === 'number') chg.set(rn, cols.asi, num(d.asiManual), true);
        else { var fj = gen(refJ, rn); if (fj) chg.set(rn, cols.asi, { t: 'f', f: fj }, true); }
      }
      if (cols.sonIzlem) {
        if (d && d.sonIzlemManual != null) chg.set(rn, cols.sonIzlem, num(d.sonIzlemManual), true);
        else { var fn = gen(refN, rn); if (fn) chg.set(rn, cols.sonIzlem, { t: 'f', f: fn }, true); }
      }
    }
    ctx.report.donor = Math.min(st.donors.length, cap);
    return chg;
  }

  // Haftalık Program: K sütunundaki personel seçimleri (ad + görünmez görev kodu)
  var ZW0 = '​', ZW1 = '‌';
  function zwCode(P) { var b = ('0000000000000000' + P.toString(2)).slice(-16); return b.replace(/0/g, ZW0).replace(/1/g, ZW1); }
  T.zwCode = zwCode;
  function areaHaftalikProgram(xml, ctx) {
    var cur = X.parseSheet(xml, ctx.sst, { maxCol: 11, maxRow: 400 }), chg = new Changes(cur);
    var ws = DT.weekStart(ctx.today);
    // Haftanın görüntülenen başlangıcı (I2): güncel haftaya alınır
    if (cur[2] && cur[2][9] && !cur[2][9].f) chg.set(2, 9, num(ws));
    var anchors = {}, rows = rowNums(cur), n = 0;
    rows.forEach(function (r) {
      var a = cur[r][1]; if (!a || !a.f) return;
      var f = rawFormula(xml, 'A' + r) || '', m = /^Hafta_Bas\+(\d+)$/.exec(f.trim());
      if (m) anchors[r] = +m[1];
    });
    // Excel'deki sıra: o günün görevleri (akşam aşıları dahil, yurt dışı taşıma hariç) anahtar sırasıyla;
    // I3'te personel seçiliyse yalnızca onun görevleri
    var hafPers = cur[3] && cur[3][9] && !cur[3][9].f ? S(cur[3][9].v).trim() : '';
    var ov = ctx.state.overrides || {}, cache = {};
    var dayTasks = function (date) {
      if (!cache[date]) cache[date] = ctx.pool.filter(function (t) { return t.date === date && !(t.slot === 7 && t.yd) && (!hafPers || DT.eqi(t.pers, hafPers)); });
      return cache[date];
    };
    rows.forEach(function (r) {
      var a = cur[r][1]; if (!a || !a.f) return;
      var f = rawFormula(xml, 'A' + r) || '';
      var m = /MATCH\(INT\(\$A\$(\d+)\)&amp;"\|(\d+)"/.exec(f) || /MATCH\(INT\(\$A\$(\d+)\)&"\|(\d+)"/.exec(f);
      if (!m || !(+m[1] in anchors)) return;
      var date = ws + anchors[+m[1]], t = dayTasks(date)[+m[2] - 1], sp = E;
      if (t) {
        var x = ctx.D[t.i], key = x.d.id + '|' + t.slot;
        if (Object.prototype.hasOwnProperty.call(ov, key) && S(ov[key]).trim()) { sp = txt(S(ov[key]).trim() + zwCode(t.i * 12 + t.slot)); n++; }
      }
      chg.set(r, 11, sp);
    });
    ctx.report.personel = n;
    return chg;
  }

  function areaRows(xml, ctx, o) {
    // o: {minCol, maxCol, r1, r2, list, row(item) → {col: spec}}
    var cur = X.parseSheet(xml, ctx.sst, { minCol: o.minCol, maxCol: o.maxCol, minRow: o.r1, maxRow: o.r2 }), chg = new Changes(cur);
    var list = o.list || [], cap = o.r2 - o.r1 + 1;
    if (list.length > cap) ctx.warn.push(o.ad + ': ' + list.length + ' kayıttan ' + cap + ' tanesi tabloya sığdı.');
    var filled = 0;
    rowNums(cur).forEach(function (r) { var row = cur[r]; for (var c in row) if (row[c] && !row[c].f && row[c].v != null && row[c].v !== '') { filled = Math.max(filled, r); break; } });
    var end = Math.min(o.r2, Math.max(filled, o.r1 + Math.min(list.length, cap) - 1));
    for (var r = o.r1; r <= end; r++) {
      var item = list[r - o.r1], vals = item ? o.row(item) : {};
      for (var c = o.minCol; c <= o.maxCol; c++) if (!o.skip || o.skip.indexOf(c) < 0) chg.set(r, c, vals[c] || E);
    }
    return chg;
  }

  // Ajanda: her gün = başlık satırı + saat satırları (08:00…) + saatsiz "•" satırları
  function areaAjanda(xml, ctx) {
    var cur = X.parseSheet(xml, ctx.sst, { maxCol: 7, minRow: 6 }), chg = new Changes(cur);
    var slot = {}, free = {}, head = {}, filled = [];
    rowNums(cur).forEach(function (r) {
      var row = cur[r], a = row[1]; if (!a || typeof a.v !== 'number') return;
      var date = Math.floor(a.v), c = row[3], cv = c ? S(c.v).trim() : '';
      if (c && c.f) { if (!(date in head)) head[date] = r; }
      else if (/^\d{1,2}:\d{2}$/.test(cv)) slot[date + '|' + cv.padStart(5, '0')] = r;
      else if (c) (free[date] = free[date] || []).push(r);
      var dd = row[4]; if (dd && !dd.f && S(dd.v).trim()) filled.push(r);
    });
    var want = {}, lost = 0, used = {};
    var notes = (ctx.state.ajanda || []).filter(function (n) { return n.tarih != null && S(n.not).trim(); });
    var place = function (n, r) {
      var w = want[r];
      if (!w) want[r] = { not: S(n.not), personel: S(n.personel), durum: S(n.durum), tur: S(n.tur) };
      else { w.not += ' · ' + S(n.not); w.personel = w.personel || S(n.personel); w.durum = w.durum || S(n.durum); w.tur = w.tur || S(n.tur); }
    };
    var rest = [];
    notes.forEach(function (n) { var r = slot[n.tarih + '|' + S(n.saat)]; if (r && !want[r]) place(n, r); else rest.push(n); });
    rest.forEach(function (n) {
      var fr = free[n.tarih] || [], r = null;
      for (var i = 0; i < fr.length; i++) if (!want[fr[i]]) { r = fr[i]; break; }
      if (r == null) r = fr.length ? fr[fr.length - 1] : slot[n.tarih + '|' + S(n.saat)];
      if (r == null) { lost++; return; }
      place(n, r);
    });
    if (lost) ctx.warn.push(lost + ' ajanda notu tablonun tarih aralığı dışında kaldı.');
    var isHead = {}; Object.keys(head).forEach(function (k) { isHead[head[k]] = 1; });
    var put = function (r, w) {
      var hd = !!isHead[r];
      chg.set(r, 4, w ? txt(w.not) : E);
      chg.set(r, 5, w && w.personel ? txt(w.personel) : hd ? txt('PERSONEL') : E);
      chg.set(r, 6, w && w.durum ? txt(w.durum) : hd ? txt('DURUM') : E);
      chg.set(r, 7, w && w.tur ? txt(w.tur) : hd ? txt('TÜR') : E);
    };
    filled.forEach(function (r) { if (!want[r]) put(r, null); });
    Object.keys(want).forEach(function (r) { put(+r, want[r]); });
    ctx.report.ajanda = notes.length - lost;
    return chg;
  }

  function areaListeler(xml, ctx) {
    var cur = X.parseSheet(xml, ctx.sst, { maxCol: 40, maxRow: 230 }), chg = new Changes(cur), L = ctx.state.lists, ci = X.colIndex;
    var column = function (c, r1, r2, vals, fn) { for (var r = r1; r <= r2; r++) chg.set(r, ci(c), (fn || txt)(vals[r - r1])); };
    if (L.personel) column('J', 3, 22, L.personel);
    if (L.hastane) { column('L', 3, 22, L.hastane.map(function (x) { return x.ad; })); column('T', 3, 22, L.hastane.map(function (x) { return x.prog; })); }
    if (L.yontem) column('E', 3, 8, L.yontem);
    if (L.ulasim) column('N', 3, 22, L.ulasim);
    if (L.konaklama) column('P', 3, 22, L.konaklama);
    if (L.asiCift) column('AJ', 3, 12, L.asiCift);
    if (L.tatiller) {
      var tt = L.tatiller;
      column('G', 3, 230, tt.map(function (x) { return x.tarih; }), num); column('H', 3, 230, tt.map(function (x) { return x.ad; }));
    }
    if (L.tasAnahtar) { column('AF', 3, 152, L.tasAnahtar.map(function (x) { return x.kelime; })); column('AG', 3, 152, L.tasAnahtar.map(function (x) { return x.sehir; })); }
    if (L.basAnahtar) { column('AL', 3, 152, L.basAnahtar.map(function (x) { return x.kelime; })); column('AM', 3, 152, L.basAnahtar.map(function (x) { return x.baslik; })); }
    if (L.isTuru) { column('Y', 3, 14, L.isTuru); column('Z', 3, 14, L.isTuru.map(function (t) { return DT.ANA_GRUP[t] || ''; })); }
    if (L.prog && DT.PROG_KEYS) column('W', 3, 2 + DT.PROG_KEYS.length, DT.PROG_KEYS.map(function (pk) { return L.prog[pk[0]]; }));
    return chg;
  }

  function single(xml, ctx, ref, sp) {
    var c = X.colIndex(ref), r = +ref.replace(/^[A-Z]+/, '');
    var cur = X.parseSheet(xml, ctx.sst, { minCol: c, maxCol: c, minRow: r, maxRow: r }), chg = new Changes(cur);
    chg.set(r, c, sp);
    return chg;
  }

  /* ---------------- ana işlem ---------------- */
  // tpl: ArrayBuffer (şablon .xlsx) · state, D, pool: uygulamanın verisi · today: Excel tarih sayısı
  T.build = function (tpl, state, D, pool, today) {
    var u8 = new Uint8Array(tpl), list = readEntries(u8), byName = {};
    list.forEach(function (e) { byName[e.name] = e; });
    var ctx = { state: state, D: D, pool: pool, today: today, warn: [], report: {}, sst: [] };
    var need = function (n) { if (!byName[n]) throw new Error('Şablonda ' + n + ' yok.'); return entryText(byName[n]); };
    var sheets = {};
    return Promise.all([need('xl/workbook.xml'), need('xl/_rels/workbook.xml.rels'), byName['xl/sharedStrings.xml'] ? entryText(byName['xl/sharedStrings.xml']) : null])
      .then(function (r) {
        var wb = r[0], rels = {}, m, re = /<Relationship\s([^>]*?)\/?>/g;
        while ((m = re.exec(r[1]))) rels[attrOf(m[1], 'Id')] = attrOf(m[1], 'Target');
        var re2 = /<sheet\s([^>]*?)\/?>/g;
        while ((m = re2.exec(wb))) {
          var tg = S(rels[attrOf(m[1], 'r:id')]).replace(/^\//, '');
          if (tg.indexOf('xl/') !== 0) tg = 'xl/' + tg;
          var nm = attrOf(m[1], 'name'); nm = nm ? nm.replace(/&amp;/g, '&').replace(/&#(\d+);/g, function (q, d) { return String.fromCharCode(+d); }) : nm;
          sheets[nm] = tg;
        }
        if (!sheets['Donör Kayıt']) throw new Error("Şablonda 'Donör Kayıt' sayfası yok.");
        if (r[2]) { var sr = /<si>([\s\S]*?)<\/si>|<si\s*\/>/g, q; while ((q = sr.exec(r[2]))) ctx.sst.push(q[1] ? q[1].replace(/<rPh[\s\S]*?<\/rPh>/g, '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') : ''); }
        ctx.wb = wb;
        var st = state, gun = function (t) { return t != null ? DT.gun(t) : ''; };
        var jobs = [
          ['Donör Kayıt', areaDonorKayit],
          ['Haftalık Program', areaHaftalikProgram],
          ['Çalışma Programı', function (x, c) {
            return areaRows(x, c, { ad: 'Ek görevler', minCol: 5, maxCol: 8, r1: 6, r2: 305, list: st.ekGorevler,
              row: function (e) { return { 5: num(e.tarih), 6: txt(e.personel), 7: txt(e.hastaKodu), 8: txt(e.islem) }; } });
          }],
          ['Ek Konsültasyon', function (x, c) {
            return areaRows(x, c, { ad: 'Ek konsültasyon', minCol: 4, maxCol: 7, r1: 6, r2: 1005, list: st.ekKons,
              row: function (e) { return { 4: txt(e.hastaKodu), 5: num(e.tarih), 6: txt(e.bolum), 7: txt(e.personel) }; } });
          }],
          ['Ajanda', areaAjanda],
          ['Görev Kayıtları', function (x, c) {
            var ch = areaRows(x, c, { ad: 'Görev kayıtları', minCol: 2, maxCol: 13, r1: 6, r2: 30005, list: st.gorevKayit,
              row: function (g) { return { 2: num(g.tarih), 3: txt(gun(g.tarih)), 4: txt(g.personel), 5: txt(g.tur), 6: txt(g.aciklama), 7: txt(g.kaynak), 8: num(g.hafta),
                9: txt(g.nereden), 10: txt(g.nereye), 11: txt(g.yon), 12: txt(g.sehir), 13: txt(g.yontem) }; } });
            c.report.gorev = (st.gorevKayit || []).length; return ch;
          }, 6],
          ['Taşıma Kayıtları', function (x, c) {
            return areaRows(x, c, { ad: 'Taşıma kayıtları', minCol: 2, maxCol: 16, r1: 6, r2: 2000, list: st.tasimaKayit,
              row: function (t) { var p = t.tarih != null ? DT.parts(t.tarih) : null;
                return { 2: num(t.tarih), 3: txt(gun(t.tarih)), 4: txt(p ? p.y + '-' + ('0' + p.m).slice(-2) : ''), 5: txt(t.personel), 6: txt(t.nereden), 7: txt(t.nereye),
                  8: txt(t.kapsam), 9: txt(t.yon), 10: txt(t.sehir), 11: txt(t.yontem), 12: txt(t.kurye), 13: txt(t.ekip), 14: txt(t.not), 15: txt(t.ifade), 16: numOrTxt(t.benzersiz) }; } });
          }, 6],
          ['Haftalık Kapanış', function (x, c) { return st.kapanis && st.kapanis.kesim != null ? single(x, c, 'K4', num(st.kapanis.kesim)) : new Changes(); }],
          ['Dashboard', function (x, c) { return st.settings && typeof st.settings.esik === 'number' ? single(x, c, 'D164', num(st.settings.esik)) : new Changes(); }],
          ['Listeler', areaListeler]
        ];
        return jobs.reduce(function (p, job) {
          return p.then(function () {
            var e = byName[sheets[job[0]]];
            if (!e) { if (job[0] === 'Donör Kayıt') throw new Error('Donör Kayıt sayfası okunamadı.'); return; }
            return entryText(e).then(function (xml) {
              var chg = job[1](xml, ctx);
              if (!chg || !chg.n) return;
              ctx.report[job[0]] = chg.n;
              return setText(e, patchSheet(xml, chg, job[2]));
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        // Excel açılışta yeniden hesaplasın; hesap zinciri (varsa) atılır
        var jobs = [];
        var wbE = byName['xl/workbook.xml'], wb = ctx.wb, wb2 = wb;
        if (/<calcPr\b/.test(wb2)) { if (!/fullCalcOnLoad=/.test(wb2)) wb2 = wb2.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"'); }
        else wb2 = /<\/definedNames>/.test(wb2) ? wb2.replace('</definedNames>', '</definedNames><calcPr fullCalcOnLoad="1"/>') : wb2.replace('</sheets>', '</sheets><calcPr fullCalcOnLoad="1"/>');
        if (wb2 !== wb) jobs.push(setText(wbE, wb2));
        if (byName['xl/calcChain.xml']) {
          list = list.filter(function (e) { return e.name !== 'xl/calcChain.xml'; });
          jobs.push(entryText(byName['[Content_Types].xml']).then(function (t) { return setText(byName['[Content_Types].xml'], t.replace(/<Override[^>]*calcChain[^>]*\/>/g, '')); }));
          jobs.push(entryText(byName['xl/_rels/workbook.xml.rels']).then(function (t) { return setText(byName['xl/_rels/workbook.xml.rels'], t.replace(/<Relationship[^>]*calcChain[^>]*\/>/g, '')); }));
        }
        return Promise.all(jobs);
      })
      .then(function () { return { bytes: writeZip(list), warn: ctx.warn, report: ctx.report }; });
  };

  // Şablon geçerli mi (Donör Kayıt sayfası var mı)?
  T.check = function (buf) {
    return X.openWorkbook(buf).then(function (wb) {
      if (wb.sheetNames.indexOf('Donör Kayıt') < 0) throw new Error("Bu dosyada 'Donör Kayıt' sayfası yok; Donör Takip tablosu değil.");
      return true;
    });
  };
  T.fileName = function (tplName, today) {
    var base = S(tplName || 'Donör Takip').replace(/\.xls[xm]?$/i, '').replace(/[ _-]*\d{1,2}[.\-_]\d{1,2}[.\-_]\d{4}$/, '').trim() || 'Donör Takip';
    var p = DT.parts(today);
    return base + ' ' + ('0' + p.d).slice(-2) + '.' + ('0' + p.m).slice(-2) + '.' + p.y + '.xlsx';
  };
  T._shiftFormula = shiftFormula; T._unshare = unshare; T._patchSheet = patchSheet; T._Changes = Changes;

  root.XLSXTablo = T;
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof window !== 'undefined' ? window : globalThis);
