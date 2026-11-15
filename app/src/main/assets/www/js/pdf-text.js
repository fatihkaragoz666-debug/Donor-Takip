/* Donör Takip – PDF'ten yazı çıkarma (kütüphanesiz).
 * Yazısı seçilebilen PDF'lerde (ör. "Microsoft Print to PDF" ile üretilen TÜRKÖK Organizasyon Talebi) her yazı parçasını
 * sayfadaki konumuyla birlikte döndürür. Taranmış (resim) PDF'lerde yazı bulunamaz.
 */
(function (root) {
  'use strict';
  var P = {};
  var X = root.XLSXIO;

  function latin1(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return s;
  }
  function mul(a, b) { // 2B dönüşüm matrisi çarpımı [a b c d e f]
    return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
      a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  }

  /* ---- nesneler ---- */
  function parseObjects(u8) {
    var s = latin1(u8), objs = {}, re = /(\d+)\s+(\d+)\s+obj\b/g, m;
    while ((m = re.exec(s))) {
      var num = +m[1], start = re.lastIndex, end = s.indexOf('endobj', start);
      if (end < 0) end = s.length;
      var body = s.slice(start, end), si = body.indexOf('stream');
      var o = { num: num, dict: si >= 0 ? body.slice(0, si) : body, stream: null };
      if (si >= 0 && /^stream\r?\n/.test(body.slice(si))) {
        var ds = start + si + (body.charAt(si + 6) === '\r' ? 8 : 7);
        o.streamStart = ds;
        var es = s.indexOf('endstream', ds);
        o.streamEnd = es < 0 ? end : es;
      }
      objs[num] = o;
      re.lastIndex = end;
    }
    return { s: s, u8: u8, objs: objs };
  }
  function resolveLength(doc, o) {
    var m = /\/Length\s+(\d+)\s+(\d+)\s+R/.exec(o.dict);
    if (m && doc.objs[+m[1]]) { var v = /(\d+)/.exec(doc.objs[+m[1]].dict); if (v) return +v[1]; }
    m = /\/Length\s+(\d+)/.exec(o.dict);
    return m ? +m[1] : null;
  }
  function streamBytes(doc, o) {
    if (o.streamStart == null) return Promise.resolve(new Uint8Array(0));
    var len = resolveLength(doc, o), end = len != null && o.streamStart + len <= doc.u8.length ? o.streamStart + len : o.streamEnd;
    var raw = doc.u8.subarray(o.streamStart, end);
    if (/\/Filter\s*\/FlateDecode|\/Filter\s*\[\s*\/FlateDecode\s*\]/.test(o.dict)) {
      return X.inflateRaw(raw.subarray(2), raw.length * 6).catch(function () { return new Uint8Array(0); });
    }
    if (/\/Filter/.test(o.dict)) return Promise.resolve(new Uint8Array(0)); // desteklenmeyen filtre (ör. resim)
    return Promise.resolve(raw);
  }
  function ref(dict, key) { var m = new RegExp('/' + key + '\\s+(\\d+)\\s+\\d+\\s+R').exec(dict); return m ? +m[1] : null; }
  function subDict(text, key) { // /Key << ... >>  (iç içe << >> destekli)
    var i = text.indexOf('/' + key);
    while (i >= 0) {
      var j = i + key.length + 1;
      while (/\s/.test(text.charAt(j))) j++;
      if (text.substr(j, 2) === '<<') {
        var depth = 0, k = j;
        for (; k < text.length; k++) {
          if (text.substr(k, 2) === '<<') { depth++; k++; } else if (text.substr(k, 2) === '>>') { depth--; k++; if (depth === 0) break; }
        }
        return text.slice(j + 2, k - 1);
      }
      var r = /^(\d+)\s+\d+\s+R/.exec(text.slice(j));
      if (r) return { ref: +r[1] };
      i = text.indexOf('/' + key, i + 1);
    }
    return null;
  }
  function dictOf(doc, d) { if (d && typeof d === 'object' && d.ref != null) return doc.objs[d.ref] ? doc.objs[d.ref].dict : ''; return d || ''; }

  /* ---- ToUnicode CMap ---- */
  function hexToStr(h) { var s = ''; for (var i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16)); if (h.length === 2) s = String.fromCharCode(parseInt(h, 16)); return s; }
  function parseCMap(txt) {
    var map = {}, bytes = 1, m;
    var cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(txt); if (cs) bytes = cs[1].length / 2;
    var reC = /beginbfchar([\s\S]*?)endbfchar/g;
    while ((m = reC.exec(txt))) {
      var re2 = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g, p;
      while ((p = re2.exec(m[1]))) map[parseInt(p[1], 16)] = hexToStr(p[2]);
    }
    var reR = /beginbfrange([\s\S]*?)endbfrange/g;
    while ((m = reR.exec(txt))) {
      var re3 = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g, q;
      while ((q = re3.exec(m[1]))) {
        var lo = parseInt(q[1], 16), hi = parseInt(q[2], 16);
        if (q[4] != null) {
          var base = q[4], last = parseInt(base.slice(-4) || base, 16), pre = hexToStr(base.slice(0, -4));
          for (var c = lo; c <= hi && c - lo < 5000; c++) map[c] = pre + String.fromCharCode(last + (c - lo));
        } else {
          var arr = q[5].match(/<([0-9a-fA-F]*)>/g) || [];
          for (var c2 = lo; c2 <= hi && c2 - lo < arr.length; c2++) map[c2] = hexToStr(arr[c2 - lo].slice(1, -1));
        }
      }
    }
    return { map: map, bytes: bytes };
  }
  var WIN = { 128: '€', 138: 'Š', 140: 'Œ', 145: '‘', 146: '’', 147: '“', 148: '”', 150: '–', 151: '—', 154: 'š', 156: 'œ', 159: 'Ÿ', 208: 'Ğ', 221: 'İ', 222: 'Ş', 240: 'ğ', 253: 'ı', 254: 'ş' };
  function decodeWith(font, bytes) {
    var out = '';
    if (font && font.cmap) {
      var n = font.cmap.bytes || (font.type0 ? 2 : 1);
      for (var i = 0; i + n <= bytes.length; i += n) {
        var code = 0; for (var k = 0; k < n; k++) code = code * 256 + bytes[i + k];
        out += font.cmap.map[code] != null ? font.cmap.map[code] : '';
      }
      return out;
    }
    for (var j = 0; j < bytes.length; j++) out += WIN[bytes[j]] || String.fromCharCode(bytes[j]);
    return out;
  }

  /* ---- içerik akışı ---- */
  function tokenize(s) {
    var toks = [], i = 0, n = s.length;
    while (i < n) {
      var c = s.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      if (c === '%') { while (i < n && s.charAt(i) !== '\n' && s.charAt(i) !== '\r') i++; continue; }
      if (c === '(') {
        var depth = 1, j = i + 1, b = [];
        while (j < n && depth > 0) {
          var ch = s.charAt(j);
          if (ch === '\\') {
            var nx = s.charAt(j + 1);
            if (/[0-7]/.test(nx)) { var oct = /^[0-7]{1,3}/.exec(s.substr(j + 1, 3))[0]; b.push(parseInt(oct, 8) & 255); j += 1 + oct.length; continue; }
            var esc = { n: 10, r: 13, t: 9, b: 8, f: 12 }[nx];
            if (nx === '\r' || nx === '\n') { j += 2; if (nx === '\r' && s.charAt(j) === '\n') j++; continue; }
            b.push(esc != null ? esc : nx.charCodeAt(0) & 255); j += 2; continue;
          }
          if (ch === '(') depth++;
          else if (ch === ')') { depth--; if (depth === 0) break; }
          b.push(ch.charCodeAt(0) & 255); j++;
        }
        toks.push({ t: 'str', v: b }); i = j + 1; continue;
      }
      if (c === '<' && s.charAt(i + 1) !== '<') {
        var e = s.indexOf('>', i), hx = s.slice(i + 1, e).replace(/\s+/g, '');
        if (hx.length % 2) hx += '0';
        var bb = []; for (var k = 0; k < hx.length; k += 2) bb.push(parseInt(hx.substr(k, 2), 16));
        toks.push({ t: 'str', v: bb }); i = e + 1; continue;
      }
      if (c === '<' || c === '>') { toks.push({ t: 'op', v: s.substr(i, 2) }); i += 2; continue; }
      if (c === '[' || c === ']') { toks.push({ t: c }); i++; continue; }
      if (c === '/') { var m = /^\/[^\s\/\[\]()<>{}%]*/.exec(s.slice(i, i + 128)); toks.push({ t: 'name', v: m[0].slice(1) }); i += m[0].length; continue; }
      var w = /^[^\s\/\[\]()<>{}%]+/.exec(s.slice(i, i + 64))[0];
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) toks.push({ t: 'num', v: parseFloat(w) });
      else {
        toks.push({ t: 'op', v: w });
        if (w === 'ID') { var ei = s.indexOf('EI', i + 2); i = ei < 0 ? n : ei + 2; continue; } // satır içi resim
      }
      i += w.length;
    }
    return toks;
  }
  function runContent(text, fonts, page, items) {
    var toks = tokenize(text), stack = [], ctm = [1, 0, 0, 1, 0, 0], gs = [], tm = [1, 0, 0, 1, 0, 0], tlm = tm, font = null, size = 1, lead = 0;
    var arr = null;
    function emit(parts) {
      var str = '';
      parts.forEach(function (p) {
        if (typeof p === 'number') { if (p < -250) str += ' '; }
        else str += decodeWith(font, p);
      });
      if (!str.replace(/\s/g, '')) return;
      var m = mul([size, 0, 0, size, 0, 0], mul(tm, ctm));
      items.push({ page: page, x: m[4], y: m[5], s: str.replace(/\s{3,}/g, '\t').replace(/[ \u00a0]+/g, ' ').replace(/ ?\t ?/g, '\t').trim(), size: Math.abs(m[3]) || size });
    }
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.t === '[') { arr = []; continue; }
      if (t.t === ']') { stack.push({ t: 'arr', v: arr }); arr = null; continue; }
      if (arr) { arr.push(t.t === 'num' ? t.v : t.v); continue; }
      if (t.t !== 'op') { stack.push(t); continue; }
      var op = t.v, a = stack, nums = function (k) { return a.slice(-k).map(function (z) { return z.v; }); };
      switch (op) {
        case 'q': gs.push(ctm.slice()); break;
        case 'Q': if (gs.length) ctm = gs.pop(); break;
        case 'cm': ctm = mul(nums(6), ctm); break;
        case 'BT': tm = tlm = [1, 0, 0, 1, 0, 0]; break;
        case 'Tf': font = fonts[(a[a.length - 2] || {}).v] || null; size = (a[a.length - 1] || {}).v || 1; break;
        case 'TL': lead = nums(1)[0]; break;
        case 'Tm': tm = tlm = nums(6); break;
        case 'Td': tlm = mul([1, 0, 0, 1].concat(nums(2)), tlm); tm = tlm; break;
        case 'TD': { var v = nums(2); lead = -v[1]; tlm = mul([1, 0, 0, 1, v[0], v[1]], tlm); tm = tlm; break; }
        case 'T*': tlm = mul([1, 0, 0, 1, 0, -lead], tlm); tm = tlm; break;
        case 'Tj': if (a.length) emit([a[a.length - 1].v]); break;
        case "'": tlm = mul([1, 0, 0, 1, 0, -lead], tlm); tm = tlm; if (a.length) emit([a[a.length - 1].v]); break;
        case '"': tlm = mul([1, 0, 0, 1, 0, -lead], tlm); tm = tlm; if (a.length) emit([a[a.length - 1].v]); break;
        case 'TJ': if (a.length && a[a.length - 1].t === 'arr') emit(a[a.length - 1].v); break;
      }
      stack = [];
    }
  }

  P.extract = function (buf) {
    var u8 = new Uint8Array(buf);
    if (latin1(u8.subarray(0, 8)).indexOf('%PDF') < 0) return Promise.reject(new Error('Dosya bir PDF değil.'));
    var doc = parseObjects(u8);
    // sayfa sırası: Root → Pages → Kids
    var pages = [];
    var trailerRoot = /\/Root\s+(\d+)\s+\d+\s+R/.exec(doc.s);
    function walk(num, depth) {
      var o = doc.objs[num]; if (!o || depth > 20) return;
      if (/\/Type\s*\/Page\b(?!s)/.test(o.dict)) { pages.push(o); return; }
      var kids = /\/Kids\s*\[([^\]]*)\]/.exec(o.dict);
      if (kids) (kids[1].match(/(\d+)\s+\d+\s+R/g) || []).forEach(function (r) { walk(+r.split(/\s+/)[0], depth + 1); });
    }
    if (trailerRoot && doc.objs[+trailerRoot[1]]) { var pr = ref(doc.objs[+trailerRoot[1]].dict, 'Pages'); if (pr != null) walk(pr, 0); }
    if (!pages.length) Object.keys(doc.objs).forEach(function (k) { var o = doc.objs[k]; if (/\/Type\s*\/Page\b(?!s)/.test(o.dict)) pages.push(o); });
    var fontCache = {};
    function loadFont(num) {
      if (fontCache[num]) return fontCache[num];
      var o = doc.objs[num], f = { type0: /\/Subtype\s*\/Type0/.test(o ? o.dict : ''), cmap: null };
      var tu = o ? ref(o.dict, 'ToUnicode') : null;
      fontCache[num] = (tu != null && doc.objs[tu] ? streamBytes(doc, doc.objs[tu]).then(function (b) { f.cmap = parseCMap(latin1(b)); return f; }) : Promise.resolve(f));
      return fontCache[num];
    }
    var items = [];
    return pages.reduce(function (prom, pg, pi) {
      return prom.then(function () {
        var res = dictOf(doc, subDict(pg.dict, 'Resources'));
        var fd = dictOf(doc, subDict(res, 'Font')), fonts = {}, fl = [];
        var reF = /\/([^\s\/<>\[\]]+)\s+(\d+)\s+\d+\s+R/g, m;
        while ((m = reF.exec(fd))) (function (name, num) { fl.push(loadFont(num).then(function (f) { fonts[name] = f; })); })(m[1], +m[2]);
        var cont = [], cr = /\/Contents\s*\[([^\]]*)\]/.exec(pg.dict);
        if (cr) cont = (cr[1].match(/(\d+)\s+\d+\s+R/g) || []).map(function (r) { return +r.split(/\s+/)[0]; });
        else { var c1 = ref(pg.dict, 'Contents'); if (c1 != null) cont = [c1]; }
        return Promise.all(fl).then(function () {
          return Promise.all(cont.map(function (c) { return doc.objs[c] ? streamBytes(doc, doc.objs[c]) : new Uint8Array(0); }));
        }).then(function (parts) {
          runContent(parts.map(latin1).join('\n'), fonts, pi + 1, items);
        });
      });
    }, Promise.resolve()).then(function () { return P.layout(items, pages.length); });
  };

  // Aynı satırdaki parçaları birleştir: yukarıdan aşağıya, soldan sağa
  P.layout = function (items, nPages) {
    var lines = [];
    for (var p = 1; p <= nPages; p++) {
      var its = items.filter(function (it) { return it.page === p; });
      // y yönü: sayfada y yukarı doğru artıyorsa büyükten küçüğe sırala
      its.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      var cur = null;
      its.forEach(function (it) {
        if (cur && Math.abs(cur.y - it.y) <= Math.max(2, it.size * 0.35)) cur.items.push(it);
        else { cur = { page: p, y: it.y, items: [it] }; lines.push(cur); }
      });
    }
    lines.forEach(function (l) { l.items.sort(function (a, b) { return a.x - b.x; }); l.text = l.items.map(function (i) { return i.s; }).join('  '); });
    return { items: items, lines: lines, text: lines.map(function (l) { return l.text; }).join('\n') };
  };

  /* ---- TÜRKÖK "Hücresel Ürün Toplama / Taşıma Hizmeti Organizasyon Talebi" formundan Donör Kayıt alanları ---- */
  var AYLAR = { ocak: 1, 'şubat': 2, subat: 2, mart: 3, nisan: 4, 'mayıs': 5, mayis: 5, haziran: 6, temmuz: 7, 'ağustos': 8, agustos: 8, 'eylül': 9, eylul: 9, ekim: 10, 'kasım': 11, kasim: 11, 'aralık': 12, aralik: 12 };
  function lower(s) { return String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase(); }
  function datesIn(text) {
    var out = [], re = /(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})|(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/g, m;
    while ((m = re.exec(text))) {
      if (m[1]) { var ay = AYLAR[lower(m[2])]; if (ay) out.push(root.DT.serial(+m[3], ay, +m[1])); }
      else out.push(root.DT.serial(+m[6], +m[5], +m[4]));
    }
    return out;
  }
  P.parseTalep = function (res, lists) {
    var DT = root.DT, f = {}, info = {}, warn = [];
    var L1 = res.lines.filter(function (l) { return l.page === 1; });
    if (!L1.length) L1 = res.lines;
    var all = L1.map(function (l) { return l.text; }).join('\n');
    var idx = function (re, from) { for (var i = from || 0; i < L1.length; i++) if (re.test(L1[i].text)) return i; return -1; };
    var next = function (i) { return i >= 0 && i + 1 < L1.length ? L1[i + 1] : null; };
    var firstCol = function (l) { return l ? String(l.items[0].s).split('\t')[0].trim() : ''; };
    if (!all.replace(/\s/g, '')) return { fields: f, info: info, warn: ['PDF’te yazı bulunamadı. Taranmış (resim) bir belge olabilir.'], empty: true };
    // numaralar
    var iH = idx(/TÜRKÖK Hasta Numarası/i), hk = iH >= 0 && next(iH) ? (/\b[A-Z]{1,3}\d{3,}[A-Z]?\b/.exec(next(iH).text) || [])[0] : null;
    hk = hk || (/\bKK\d{3,}P\b/.exec(all) || [])[0];
    if (hk) f.hk = hk;
    var dno = (/\bT\d{14}\b/.exec(all) || [])[0]; if (dno) f.dno = dno;
    // yöntem
    var iY = idx(/toplama yöntemi/i), yt = iY >= 0 && next(iY) ? lower(next(iY).text) : '';
    var yl = (lists.yontem || []);
    var pick = function (word) { for (var k = 0; k < yl.length; k++) if (lower(yl[k]).indexOf(word) >= 0) return yl[k]; return null; };
    if (yt.indexOf('perifer') >= 0) f.yontem = pick('perifer') || 'PERİFERİK';
    else if (yt.indexOf('kemik') >= 0) f.yontem = pick('kemik') || 'KEMİK İLİĞİ';
    // toplama merkezi → hastane
    var iM = idx(/Ürün Toplama Merkezi/i);
    if (iM >= 0 && next(iM)) {
      var merkez = firstCol(next(iM)); info.merkez = merkez;
      var t = DT.normKey(merkez.replace(/\([^)]*\)/g, ' ')), best = null;
      (lists.hastane || []).forEach(function (h) {
        var k = DT.normKey(h.ad), pos = t.indexOf(k);
        if (k && pos >= 0 && (!best || pos < best.pos || (pos === best.pos && k.length > best.len))) best = { ad: h.ad, pos: pos, len: k.length };
      });
      if (best) f.hastane = best.ad; else warn.push('Hastane listede bulunamadı: ' + merkez);
    }
    // tarihler: sağlık kontrolü · toplama · son izlem
    var iT = idx(/Sağlık Kontrol Tarihi/i);
    if (iT >= 0) {
      var ds = datesIn(next(iT) ? next(iT).text : '');
      if (ds[0] != null) f.sk = ds[0];
      if (ds[1] != null) f.top = ds[1];
      if (ds[2] != null) info.sonIzlem = ds[2];
    }
    // donör
    var iA = idx(/Donör Adı Soyadı/i);
    if (iA >= 0 && next(iA)) { var ad = firstCol(next(iA)).replace(/\s+\d{11}\b.*$/, '').replace(/\s+\d{1,2}[.\/]\d{1,2}[.\/]\d{4}.*$/, '').trim(); if (ad && !/\d/.test(ad)) f.ad = ad.toLocaleUpperCase('tr-TR'); }
    var iP = idx(/Telefon\s*:?\s*\(GSM1\)/i);
    if (iP >= 0 && next(iP)) {
      var tm = /(?:\+?90\s*)?0?\s*\(?(5\d{2})\)?\s*(\d{3})\s*(\d{2})\s*(\d{2})/.exec(next(iP).text);
      if (tm) f.tel = '0 ' + tm[1] + ' ' + tm[2] + ' ' + tm[3] + ' ' + tm[4];
    }
    var iR = idx(/İlçe\s*\/\s*İl/i), iD = idx(/HASTA BİLGİLERİ/i, iR >= 0 ? iR : 0);
    if (iR >= 0) {
      var colX = 300, parts = [];
      for (var r = iR + 1; r < (iD >= 0 ? iD : L1.length); r++) L1[r].items.forEach(function (it) { if (it.x >= colX && it.s.trim()) parts.push(it.s.trim()); });
      if (parts.length >= 2) f.ikamet = (parts[0] + '/' + parts[1]).toLocaleUpperCase('tr-TR');
      else if (parts.length === 1) f.ikamet = parts[0].toLocaleUpperCase('tr-TR');
    }
    // hasta: nakil merkezi (D bölümündeki)
    var iN = idx(/Nakil Merkezi\s*:/i, iD >= 0 ? iD : 0);
    if (iN >= 0) {
      var nm = [];
      for (var q = iN + 1; q < L1.length && nm.length < 2; q++) {
        var l = L1[q], left = l.items.filter(function (it) { return it.x < 300; }).map(function (it) { return it.s.split('\t')[0].trim(); }).join(' ').trim();
        if (!left || /Mahalle|Cadde|Sokak|No\s*:|TÜRKÖK|Koordinat/i.test(left)) break;
        nm.push(left);
      }
      if (nm.length) { f.bolge = nm[0]; info.nakilTam = nm.join(' '); }
    }
    var kg = /Hasta\s*Kg\s*:\s*([\d.,]+)/i.exec(all); if (kg) info.kg = parseFloat(kg[1].replace(',', '.'));
    var tk = /Hizmet Takip No\s*:\s*(TK-[\d-]+)/i.exec(all); if (tk) info.takipNo = tk[1];
    if (f.top != null && info.sonIzlem != null && info.sonIzlem !== f.top + 20) f.sonIzlemManual = info.sonIzlem;
    return { fields: f, info: info, warn: warn };
  };

  root.PDFText = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
