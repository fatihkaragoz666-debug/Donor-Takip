/* Donör Takip – Excel (.xlsx) okuma ve yazma.
 * Harici kütüphane yok: zip okuma/yazma, inflate ve sayfa XML ayrıştırma burada.
 */
(function (root) {
  'use strict';
  var X = {};
  var DT = root.DT;

  /* ---------------- inflate (RFC 1951) ---------------- */
  var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function huff(lengths, n) {
    var count = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(n), i;
    for (i = 0; i < n; i++) count[lengths[i]]++;
    count[0] = 0;
    for (i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (i = 0; i < n; i++) if (lengths[i]) sym[offs[lengths[i]]++] = i;
    return { count: count, sym: sym };
  }
  var FIXED_L, FIXED_D;
  (function () {
    var l = new Uint8Array(288), i;
    for (i = 0; i < 144; i++) l[i] = 8;
    for (; i < 256; i++) l[i] = 9;
    for (; i < 280; i++) l[i] = 7;
    for (; i < 288; i++) l[i] = 8;
    FIXED_L = huff(l, 288);
    var d = new Uint8Array(30); for (i = 0; i < 30; i++) d[i] = 5;
    FIXED_D = huff(d, 30);
  })();

  X.inflateRawJS = function (src, sizeHint) {
    var out = new Uint8Array(Math.max(1024, sizeHint || src.length * 4)), op = 0;
    var ip = 0, bitbuf = 0, bitcnt = 0;
    function need(n) {
      if (op + n <= out.length) return;
      var no = new Uint8Array(Math.max(out.length * 2, op + n)); no.set(out.subarray(0, op)); out = no;
    }
    function bits(n) {
      while (bitcnt < n) {
        if (ip >= src.length) throw new Error('Sıkıştırılmış veri beklenenden kısa');
        bitbuf |= src[ip++] << bitcnt; bitcnt += 8;
      }
      var v = bitbuf & ((1 << n) - 1); bitbuf >>>= n; bitcnt -= n; return v;
    }
    function decode(h) {
      var code = 0, first = 0, index = 0;
      for (var len = 1; len < 16; len++) {
        code |= bits(1);
        var c = h.count[len];
        if (code - c < first) return h.sym[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw new Error('Geçersiz Huffman kodu');
    }
    function codes(lc, dc) {
      for (;;) {
        var s = decode(lc);
        if (s < 256) { need(1); out[op++] = s; }
        else if (s === 256) return;
        else {
          s -= 257;
          if (s >= 29) throw new Error('Geçersiz uzunluk kodu');
          var len = LBASE[s] + bits(LEXT[s]);
          var ds = decode(dc);
          if (ds >= 30) throw new Error('Geçersiz mesafe kodu');
          var dist = DBASE[ds] + bits(DEXT[ds]);
          if (dist > op) throw new Error('Geçersiz mesafe');
          need(len);
          for (var k = 0; k < len; k++) { out[op] = out[op - dist]; op++; }
        }
      }
    }
    var last;
    do {
      last = bits(1);
      var type = bits(2);
      if (type === 0) {
        bitbuf = 0; bitcnt = 0;
        if (ip + 4 > src.length) throw new Error('Bozuk blok');
        var ln = src[ip] | (src[ip + 1] << 8); ip += 4;
        if (ip + ln > src.length) throw new Error('Bozuk blok');
        need(ln); out.set(src.subarray(ip, ip + ln), op); ip += ln; op += ln;
      } else if (type === 1) codes(FIXED_L, FIXED_D);
      else if (type === 2) {
        var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4, i;
        var cl = new Uint8Array(19);
        for (i = 0; i < hclen; i++) cl[CLORDER[i]] = bits(3);
        var clh = huff(cl, 19);
        var lens = new Uint8Array(hlit + hdist);
        for (i = 0; i < hlit + hdist;) {
          var sym = decode(clh);
          if (sym < 16) lens[i++] = sym;
          else {
            var rep = 0, val = 0;
            if (sym === 16) { if (i === 0) throw new Error('Bozuk uzunluk'); val = lens[i - 1]; rep = 3 + bits(2); }
            else if (sym === 17) rep = 3 + bits(3);
            else rep = 11 + bits(7);
            if (i + rep > hlit + hdist) throw new Error('Bozuk uzunluk');
            while (rep--) lens[i++] = val;
          }
        }
        codes(huff(lens.subarray(0, hlit), hlit), huff(lens.subarray(hlit), hdist));
      } else throw new Error('Geçersiz blok türü');
    } while (!last);
    return out.subarray(0, op);
  };

  X.inflateRaw = function (data, size) {
    if (typeof DecompressionStream !== 'undefined' && !X.forceJsInflate) {
      try {
        var ds = new DecompressionStream('deflate-raw');
        var stream = new Blob([data]).stream().pipeThrough(ds);
        return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); })
          .catch(function () { return X.inflateRawJS(data, size); });
      } catch (e) { /* desteklenmiyor */ }
    }
    return Promise.resolve().then(function () { return X.inflateRawJS(data, size); });
  };

  /* ---------------- zip okuma ---------------- */
  X.readZip = function (buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Dosya bir Excel (.xlsx) dosyası değil.');
    var n = dv.getUint16(eocd + 10, true), cd = dv.getUint32(eocd + 16, true);
    var entries = {}, dec = new TextDecoder('utf-8');
    for (var k = 0, p = cd; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Zip dizini bozuk');
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      var off = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      entries[name] = { method: method, csize: csize, usize: usize, off: off };
      p += 46 + nl + el + cl;
    }
    return {
      has: function (name) { return !!entries[name]; },
      names: Object.keys(entries),
      get: function (name) {
        var e = entries[name];
        if (!e) return Promise.resolve(null);
        var lnl = dv.getUint16(e.off + 26, true), lel = dv.getUint16(e.off + 28, true);
        var start = e.off + 30 + lnl + lel, data = u8.subarray(start, start + e.csize);
        if (e.method === 0) return Promise.resolve(data);
        if (e.method !== 8) return Promise.reject(new Error('Desteklenmeyen sıkıştırma'));
        return X.inflateRaw(data, e.usize);
      },
      text: function (name) {
        return this.get(name).then(function (b) { return b ? new TextDecoder('utf-8').decode(b) : null; });
      }
    };
  };

  /* ---------------- XML yardımcıları ---------------- */
  function unesc(s) {
    if (s.indexOf('&') >= 0) {
      s = s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, function (m, e) {
        if (e === 'lt') return '<'; if (e === 'gt') return '>'; if (e === 'amp') return '&';
        if (e === 'quot') return '"'; if (e === 'apos') return "'";
        if (e[1] === 'x') return String.fromCodePoint(parseInt(e.slice(2), 16));
        return String.fromCodePoint(parseInt(e.slice(1), 10));
      });
    }
    if (s.indexOf('_x') >= 0) s = s.replace(/_x([0-9A-Fa-f]{4})_/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); });
    return s;
  }
  function attr(a, name) { var m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(a); return m ? unesc(m[1]) : null; }
  function texts(xml) {
    var r = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g, m;
    xml = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
    while ((m = re.exec(xml))) r += m[1] ? unesc(m[1]) : '';
    return r;
  }
  function colIndex(ref) {
    var n = 0;
    for (var i = 0; i < ref.length; i++) { var c = ref.charCodeAt(i); if (c < 65 || c > 90) break; n = n * 26 + (c - 64); }
    return n;
  }
  X.colIndex = colIndex;
  function colName(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  X.colName = colName;

  function parseSST(xml) {
    var out = [], re = /<si>([\s\S]*?)<\/si>|<si\s*\/>/g, m;
    if (!xml) return out;
    while ((m = re.exec(xml))) out.push(m[1] ? texts(m[1]) : '');
    return out;
  }

  // Sayfa → { 'row': { col: {v, f} } }   (v: sayı | metin | boolean, f: formül var mı)
  function parseSheet(xml, sst, opt) {
    opt = opt || {};
    var rows = {}, re = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, m;
    var minC = opt.minCol || 1, maxC = opt.maxCol || 16384, maxR = opt.maxRow || 1048576, minR = opt.minRow || 1;
    while ((m = re.exec(xml))) {
      var a = m[1], ref = attr(a, 'r');
      if (!ref) continue;
      var c = colIndex(ref), r = parseInt(ref.replace(/^[A-Z]+/, ''), 10);
      if (r < minR || c < minC || c > maxC) continue;
      if (r > maxR) continue;
      var inner = m[2] || '', t = attr(a, 't'), v = null;
      var vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
      if (t === 's') v = vm ? (sst[parseInt(vm[1], 10)] || '') : '';
      else if (t === 'inlineStr') v = texts(inner);
      else if (t === 'str') v = vm ? unesc(vm[1]) : '';
      else if (t === 'b') v = vm ? vm[1] === '1' : false;
      else if (t === 'e') v = null;
      else v = vm ? parseFloat(vm[1]) : null;
      var f = /<f[\s>\/]/.test(inner);
      if (v === null && !f) continue;
      (rows[r] = rows[r] || {})[c] = { v: v, f: f };
    }
    return rows;
  }
  X.parseSheet = parseSheet;

  function openWorkbook(buf) {
    var zip = X.readZip(buf);
    return Promise.all([zip.text('xl/workbook.xml'), zip.text('xl/_rels/workbook.xml.rels'), zip.text('xl/sharedStrings.xml')])
      .then(function (r) {
        if (!r[0]) throw new Error('Dosya bir Excel çalışma kitabı değil.');
        var rels = {}, re = /<Relationship\s([^>]*?)\/?>/g, m;
        while ((m = re.exec(r[1] || ''))) rels[attr(m[1], 'Id')] = attr(m[1], 'Target');
        var sheets = {}, re2 = /<sheet\s([^>]*?)\/?>/g;
        while ((m = re2.exec(r[0]))) {
          var target = rels[attr(m[1], 'r:id')] || '';
          target = target.replace(/^\//, '');
          if (target.indexOf('xl/') !== 0) target = 'xl/' + target;
          sheets[attr(m[1], 'name')] = target;
        }
        var sst = parseSST(r[2]);
        return {
          sheetNames: Object.keys(sheets),
          sheet: function (name, opt) {
            if (!sheets[name]) return Promise.resolve(null);
            return zip.text(sheets[name]).then(function (xml) { return xml ? parseSheet(xml, sst, opt) : null; });
          }
        };
      });
  }
  X.openWorkbook = openWorkbook;

  /* ---------------- Donör Takip dosyasını içe aktarma ---------------- */
  var HEADERS = {
    'HASTA KODU': 'hk', 'DONÖR NUMARASI': 'dno', 'AD SOYAD': 'ad', 'TELEFON NO': 'tel', 'İKAMETİ': 'ikamet',
    'SAĞLIK KONTROLÜ TARİHİ': 'sk', 'YÖNTEMİ': 'yontem', 'HASTANE': 'hastane', 'AÇIKLAMA': 'aciklama',
    'AŞI BAŞLAMA TARİHİ': 'asi', 'KÖK HÜCRE TOPLAMA TARİHİ': 'top', 'NAKİL MERKEZİ BÖLGE': 'bolge',
    'İLGİLENEN PERSONEL': 'personel', 'SON İZLEM TARİHİ': 'sonIzlem', 'ULAŞIM TÜRÜ': 'ulasim', 'KONAKLAMA': 'konaklama',
    'TAŞIYAN PERSONEL': 'tasiyan', 'IDM ✓': 'idm', 'IDM BAŞLANGIÇ': 'idmBas', 'IDM BİTİŞ': 'idmBit'
  };
  var DEFAULT_COLS = ['hk', 'dno', 'ad', 'tel', 'ikamet', 'sk', 'yontem', 'hastane', 'aciklama', 'asi', 'top', 'bolge',
    'personel', 'sonIzlem', 'ulasim', 'konaklama', 'tasiyan', 'kontrol', 'idm', 'idmBas', 'idmBit'];
  var DATE_FIELDS = { sk: 1, top: 1, idmBas: 1, idmBit: 1 };

  function cellText(c) {
    if (!c || c.v == null) return '';
    if (typeof c.v === 'number') return String(Math.round(c.v * 1e9) / 1e9);
    if (typeof c.v === 'boolean') return c.v ? 'DOĞRU' : '';
    return String(c.v).trim();
  }
  function cellDate(c) {
    if (!c || c.v == null || c.v === '') return null;
    if (typeof c.v === 'number') return c.v > 0 ? Math.floor(c.v) : null;
    return DT.parseDateText(c.v);
  }
  function headerKey(s) { return DT.xtrim(String(s || '').replace(/\s+/g, ' ')).toUpperCase(); }

  X.importWorkbook = function (buf, defaults) {
    var report = { donors: 0, overrides: 0, ekGorevler: 0, lists: false, warnings: [] };
    return openWorkbook(buf).then(function (wb) {
      if (wb.sheetNames.indexOf('Donör Kayıt') < 0) throw new Error("Dosyada 'Donör Kayıt' sayfası bulunamadı.");
      return Promise.all([
        wb.sheet('Donör Kayıt', { maxCol: 30 }),
        wb.sheet('Listeler', { maxCol: 40, maxRow: 230 }),
        wb.sheet('Haftalık Program', { minCol: 27, maxCol: 28, maxRow: 207 }),
        wb.sheet('Haftalık Plan', { minCol: 95, maxCol: 96, maxRow: 126 }),
        wb.sheet('Çalışma Programı', { minCol: 5, maxCol: 8, minRow: 6, maxRow: 305 }),
        wb.sheet('Dashboard', { minCol: 4, maxCol: 4, minRow: 164, maxRow: 164 }),
        wb.sheet('Ek Konsültasyon', { minCol: 4, maxCol: 7, minRow: 6, maxRow: 1005 }),
        wb.sheet('Ajanda', { minCol: 1, maxCol: 7, minRow: 6 })
      ]);
    }).then(function (s) {
      var dk = s[0], li = s[1], hp = s[2], pl = s[3], cp = s[4], db = s[5], ek = s[6], aj = s[7];
      var state = DT.newState(defaults);
      // Başlık satırı ve sütunlar
      var headRow = 5, cols = {};
      for (var r = 1; r <= 12; r++) {
        var row = dk[r]; if (!row) continue;
        if (row[1] && headerKey(row[1].v) === 'HASTA KODU') { headRow = r; break; }
      }
      var hr = dk[headRow] || {};
      Object.keys(hr).forEach(function (c) { var k = HEADERS[headerKey(hr[c].v)]; if (k && !(k in cols)) cols[k] = +c; });
      if (Object.keys(cols).length < 8) { cols = {}; DEFAULT_COLS.forEach(function (k, i) { cols[k] = i + 1; }); }
      var rowNums = Object.keys(dk).map(Number).filter(function (n) { return n > headRow; }).sort(function (a, b) { return a - b; });
      var byExcelIdx = {};
      rowNums.forEach(function (rn) {
        var row = dk[rn], d = DT.emptyDonor(), any = false;
        var g = function (k) { return cols[k] ? row[cols[k]] : null; };
        ['hk', 'dno', 'ad', 'tel', 'ikamet', 'yontem', 'hastane', 'aciklama', 'bolge', 'personel', 'ulasim', 'konaklama', 'tasiyan']
          .forEach(function (k) { d[k] = cellText(g(k)); if (d[k]) any = true; });
        Object.keys(DATE_FIELDS).forEach(function (k) { d[k] = cellDate(g(k)); if (d[k] != null) any = true; });
        var asi = g('asi'), son = g('sonIzlem'), idm = g('idm');
        if (asi && !asi.f && typeof asi.v === 'number') { d.asiManual = Math.floor(asi.v); any = true; }
        else if (asi && !asi.f && typeof asi.v === 'string' && asi.v.trim() !== '') {
          d.asiManual = DT.parseDateText(asi.v) != null ? DT.parseDateText(asi.v) : 'YOK'; any = true;
        }
        if (son && !son.f && son.v != null && son.v !== '') { var sv = cellDate(son); if (sv != null) { d.sonIzlemManual = sv; any = true; } }
        if (idm && idm.v != null && idm.v !== '' && idm.v !== false && !idm.f) { d.idm = true; any = true; }
        if (!any) return;
        d.excelRow = rn;
        byExcelIdx[rn - headRow] = d;
        state.donors.push(d);
      });
      report.donors = state.donors.length;

      // Listeler
      if (li) {
        var L = state.lists;
        var col = function (c, r1, r2) { var out = []; for (var r = r1; r <= r2; r++) out.push(li[r] && li[r][c] ? li[r][c] : null); return out; };
        var txt = function (c, r1, r2) { return col(X.colIndex(c), r1, r2).map(cellText).filter(function (v) { return v !== ''; }); };
        var pers = txt('J', 3, 22); if (pers.length) L.personel = pers;
        var hosp = col(X.colIndex('L'), 3, 22), hprog = col(X.colIndex('T'), 3, 22), H = [];
        hosp.forEach(function (c, i) { var a = cellText(c); if (a) H.push({ ad: a, prog: cellText(hprog[i]) }); });
        if (H.length) L.hastane = H;
        var y = txt('E', 3, 8); if (y.length) L.yontem = y;
        var u = txt('N', 3, 22); if (u.length) L.ulasim = u;
        var k = txt('P', 3, 22); if (k.length) L.konaklama = k;
        var ac = txt('AJ', 3, 12); L.asiCift = ac;
        var tt = col(X.colIndex('G'), 3, 230), ta = col(X.colIndex('H'), 3, 230), T = [];
        tt.forEach(function (c, i) { var dd = cellDate(c); if (dd != null) T.push({ tarih: dd, ad: cellText(ta[i]) }); });
        if (T.length) L.tatiller = T;
        var pairs = function (c1, c2, f) {
          var a = col(X.colIndex(c1), 3, 152), b = col(X.colIndex(c2), 3, 152), out = [];
          a.forEach(function (c, i) { var kw = cellText(c); if (kw) { var e = { kelime: kw }; e[f] = cellText(b[i]); out.push(e); } });
          return out;
        };
        var tas = pairs('AF', 'AG', 'sehir'); if (tas.length) L.tasAnahtar = tas;
        var bas = pairs('AL', 'AM', 'baslik'); if (bas.length) L.basAnahtar = bas;
        var it = txt('Y', 3, 14); if (it.length) L.isTuru = it;
        var w = col(X.colIndex('W'), 3, 15);
        DT.PROG_KEYS.forEach(function (pk, i) { if (w[i] && w[i].v != null) L.prog[pk[0]] = cellText(w[i]); });
        report.lists = true;
      }

      // Haftalık Program / Haftalık Plan'da seçilen görev personeli
      var setOv = function (P, name) {
        if (!(P >= 1)) return;
        var di = Math.floor((P - 1) / 12) + 1, slot = (P - 1) % 12 + 1, d = byExcelIdx[di];
        if (!d) return;
        var key = d.id + '|' + slot;
        if (key in state.overrides) return;
        state.overrides[key] = name;
        report.overrides++;
      };
      [[hp, 27, 28], [pl, 95, 96]].forEach(function (src) {
        var sh = src[0]; if (!sh) return;
        Object.keys(sh).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
          var a = sh[r][src[1]], b = sh[r][src[2]];
          if (a && typeof a.v === 'number') setOv(Math.round(a.v), b ? cellText(b) : '');
        });
      });

      // Çalışma Programı · EK GÖREVLER
      if (cp) {
        Object.keys(cp).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
          var row = cp[r], t = cellDate(row[5]);
          var e = { id: DT.uid(), tarih: t, personel: cellText(row[6]), hastaKodu: cellText(row[7]), islem: cellText(row[8]) };
          if (t == null && !e.personel && !e.hastaKodu && !e.islem) return;
          state.ekGorevler.push(e); report.ekGorevler++;
        });
      }
      if (db && db[164] && db[164][4] && typeof db[164][4].v === 'number') state.settings.esik = db[164][4].v;
      // Ek Konsültasyon (D: hasta kodu, E: tarih, F: bölüm, G: personel)
      report.ekKons = 0;
      if (ek) {
        Object.keys(ek).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
          var row = ek[r], e = { id: DT.uid(), hastaKodu: cellText(row[4]), tarih: cellDate(row[5]), bolum: cellText(row[6]), personel: cellText(row[7]) };
          if (!e.hastaKodu && e.tarih == null) return;
          state.ekKons.push(e); report.ekKons++;
        });
      }
      // Ajanda (A: tarih, C: saat, D: not, E: personel, F: durum, G: tür)
      report.ajanda = 0;
      if (aj) {
        Object.keys(aj).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
          var row = aj[r], not = cellText(row[4]), t = cellDate(row[1]);
          if (!not || t == null || (row[4] && row[4].f)) return;
          var saat = row[3] ? row[3].v : '';
          if (typeof saat === 'number') { var mins = Math.round((saat % 1) * 1440); saat = ('0' + Math.floor(mins / 60)).slice(-2) + ':' + ('0' + mins % 60).slice(-2); }
          saat = /^\d{1,2}:\d{2}$/.test(String(saat || '').trim()) ? String(saat).trim().padStart(5, '0') : '';
          var dur = cellText(row[6]).toLocaleUpperCase('tr-TR');
          state.ajanda.push({ id: DT.uid(), tarih: t, saat: saat, not: not, personel: cellText(row[5]) === 'PERSONEL' ? '' : cellText(row[5]),
            durum: dur === 'DURUM' ? '' : dur, tur: cellText(row[7]) === 'TÜR' ? '' : cellText(row[7]) });
          report.ajanda++;
        });
      }
      // Elle yazılmış ama otomatik değerle aynı olan tarihler otomatik sayılır (toplama değişince güncellensin).
      state.donors.forEach(function (d) {
        delete d.excelRow;
        if (d.sonIzlemManual != null && d.top != null && d.sonIzlemManual === d.top + 20) d.sonIzlemManual = null;
        if (typeof d.asiManual === 'number' && d.top != null) {
          var auto = DT.derive({ lists: state.lists, donors: [Object.assign({}, d, { asiManual: null })] }, 0)[0];
          if (auto.asi === d.asiManual) d.asiManual = null;
        }
      });
      return { state: state, report: report };
    });
  };

  /* ---------------- zip yazma (sıkıştırmasız) ---------------- */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  X.zip = function (files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    var all = parts.concat(central, [new Uint8Array(e.buffer)]);
    var total = all.reduce(function (s, p) { return s + p.length; }, 0), out = new Uint8Array(total), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  };

  /* ---------------- xlsx yazma ---------------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }
  // sheets: [{name, cols:[width], rows:[[cell]], freezeRow, filterRow}] cell: string | number | {v, s, f, t}
  X.buildXlsx = function (sheets) {
    var files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
      '</Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>' });
    var defNames = '';
    sheets.forEach(function (s, i) {
      if (s.filterRow && s.rows.length > s.filterRow) {
        defNames += '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(s.name).replace(/'/g, "''") + '\'!$A$' + s.filterRow + ':$' + X.colName(s.cols.length) + '$' + s.rows.length + '</definedName>';
      }
    });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews><sheets>' +
      sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
      '</sheets>' + (defNames ? '<definedNames>' + defNames + '</definedNames>' : '') + '<calcPr calcId="191029"/></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' });
    // stiller: 0 normal · 1 tarih · 2 başlık satırı · 3 sayfa başlığı · 4 kaydırmalı metin · 5 gri (süreç durdu)
    files.push({ name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/></numFmts>' +
      '<fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="14"/><color rgb="FF0F4C5C"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF808080"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0F4C5C"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD9DEE3"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="7">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center" horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
      '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    sheets.forEach(function (s, si) {
      var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
      if (s.freezeRow) xml += '<sheetViews><sheetView workbookViewId="0"' + (si === 0 ? ' tabSelected="1"' : '') + '><pane ySplit="' + s.freezeRow + '" topLeftCell="A' + (s.freezeRow + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
      xml += '<sheetFormatPr defaultRowHeight="15"/><cols>' + s.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>';
      s.rows.forEach(function (row, ri) {
        var r = ri + 1, cells = '';
        (row || []).forEach(function (cell, ci) {
          if (cell == null || cell === '') return;
          var ref = X.colName(ci + 1) + r, o = typeof cell === 'object' ? cell : { v: cell };
          var st = o.s ? ' s="' + o.s + '"' : '';
          var fx = o.f ? '<f>' + esc(o.f) + '</f>' : '';
          if (typeof o.v === 'number') cells += '<c r="' + ref + '"' + st + '>' + fx + '<v>' + o.v + '</v></c>';
          else if (o.f) cells += '<c r="' + ref + '"' + st + ' t="str">' + fx + '<v>' + esc(o.v == null ? '' : o.v) + '</v></c>';
          else if (o.v != null && o.v !== '') cells += '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + esc(o.v) + '</t></is></c>';
        });
        if (cells) xml += '<row r="' + r + '"' + (s.heights && s.heights[ri] ? ' ht="' + s.heights[ri] + '" customHeight="1"' : '') + '>' + cells + '</row>';
      });
      xml += '</sheetData>';
      if (s.filterRow && s.rows.length > s.filterRow) xml += '<autoFilter ref="A' + s.filterRow + ':' + X.colName(s.cols.length) + s.rows.length + '"/>';
      xml += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
      xml += '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>';
      xml += '</worksheet>';
      files.push({ name: 'xl/worksheets/sheet' + (si + 1) + '.xml', data: xml });
    });
    return X.zip(files);
  };

  // Donör Kayıt sayfası (Excel dosyasıyla aynı sütunlar + DURUM) — uygulama bu dosyayı yeniden içe aktarabilir.
  X.exportDonors = function (state, D, today) {
    var head = ['HASTA KODU', 'DONÖR NUMARASI', 'AD SOYAD', 'TELEFON NO', 'İKAMETİ', 'SAĞLIK KONTROLÜ TARİHİ', 'YÖNTEMİ', 'HASTANE',
      'AÇIKLAMA', 'AŞI BAŞLAMA TARİHİ', 'KÖK HÜCRE TOPLAMA TARİHİ', 'NAKİL MERKEZİ BÖLGE', 'İLGİLENEN PERSONEL', 'SON İZLEM TARİHİ',
      'ULAŞIM TÜRÜ', 'KONAKLAMA', 'TAŞIYAN PERSONEL', 'KONTROL', 'IDM\n✓', 'IDM\nBAŞLANGIÇ', 'IDM\nBİTİŞ', 'DURUM'];
    var rows = [[], [{ v: 'Donör Kayıt', s: 3 }], ['Donör Takip uygulamasından aktarıldı · ' + DT.fmt(today) + ' · ' + D.length + ' donör'], [], head.map(function (h) { return { v: h, s: 2 }; })];
    D.forEach(function (x, i) {
      var d = x.d, r = 6 + i, g = x.stopped;
      var dt = function (v) { return v == null ? '' : { v: v, s: g ? 6 : 1 }; };
      var tx = function (v) { return v == null || v === '' ? '' : (g ? { v: v, s: 5 } : v); };
      var asiCell = '';
      if (d.asiManual === 'YOK') asiCell = tx('Aşı yok');
      else if (d.asiManual != null) asiCell = dt(d.asiManual);
      else if (d.top != null) {
        if (x.asiYok) asiCell = { v: 'Aşı yok', f: 'IF(K' + r + '="","","Aşı yok")', s: g ? 5 : 0 };
        else asiCell = { v: x.asi, f: 'IF(K' + r + '="","",K' + r + '-' + (d.top - x.asi) + ')', s: g ? 6 : 1 };
      }
      var sonCell = '';
      if (d.sonIzlemManual != null) sonCell = dt(d.sonIzlemManual);
      else if (d.top != null) sonCell = { v: x.sonIzlem, f: 'IF(ISNUMBER(K' + r + '),K' + r + '+20,"")', s: g ? 6 : 1 };
      rows.push([tx(d.hk), tx(d.dno), tx(d.ad), tx(d.tel), tx(d.ikamet), dt(d.sk), tx(d.yontem), tx(d.hastane), tx(d.aciklama),
        asiCell, dt(d.top), tx(d.bolge), tx(d.personel), sonCell, tx(d.ulasim), tx(d.konaklama), tx(d.tasiyan),
        tx(x.kontrol), d.idm ? '✓' : '', dt(d.idmBas), dt(d.idmBit), tx(x.durum)]);
    });
    var heights = []; heights[4] = 32;
    return X.buildXlsx([{ name: 'Donör Kayıt', cols: [12, 18, 24, 16, 22, 12, 12, 18, 34, 12, 12, 34, 14, 12, 12, 12, 14, 30, 6, 11, 11, 26],
      rows: rows, freezeRow: 5, filterRow: 5, heights: heights }]);
  };

  // Donör Raporu: yöneticiye gönderilecek temiz kopya (KONTROL ve IDM yok)
  X.exportReport = function (state, D, today, rows) {
    var head = ['HASTA KODU', 'DONÖR NUMARASI', 'AD SOYAD', 'TELEFON NO', 'İKAMETİ', 'SAĞLIK KONTROLÜ TARİHİ', 'YÖNTEMİ', 'HASTANE',
      'AÇIKLAMA', 'AŞI BAŞLAMA TARİHİ', 'KÖK HÜCRE TOPLAMA TARİHİ', 'NAKİL MERKEZİ BÖLGE', 'İLGİLENEN PERSONEL', 'SON İZLEM TARİHİ',
      'ULAŞIM TÜRÜ', 'KONAKLAMA', 'TAŞIYAN PERSONEL', 'DURUM'];
    rows = rows || D;
    var yap = rows.filter(function (x) { return x.durum === 'Toplama yapıldı'; }).length, dur = rows.filter(function (x) { return x.stopped; }).length;
    var out = [[], [{ v: 'Donör Raporu', s: 3 }], ['Rapor tarihi: ' + DT.fmt(today) + '   ·   ' + rows.length + ' donör   ·   Toplama yapıldı: ' + yap + '   ·   Devam eden: ' + (rows.length - yap - dur) + '   ·   Süreç durdu: ' + dur], [], head.map(function (h) { return { v: h, s: 2 }; })];
    rows.forEach(function (x) {
      var d = x.d, dt = function (v) { return v == null ? '' : { v: v, s: 1 }; };
      out.push([d.hk, d.dno, d.ad, d.tel, d.ikamet, dt(d.sk), d.yontem, d.hastane, d.aciklama,
        x.asiYok ? 'Aşı yok' : dt(x.asi), dt(d.top), d.bolge, d.personel, dt(x.sonIzlem), d.ulasim, d.konaklama, d.tasiyan, x.durum]);
    });
    var heights = []; heights[4] = 32;
    return X.buildXlsx([{ name: 'Donör Raporu', cols: [12, 18, 24, 16, 22, 12, 12, 18, 34, 12, 12, 34, 14, 12, 12, 12, 14, 26], rows: out, freezeRow: 5, filterRow: 5, heights: heights }]);
  };

  root.XLSXIO = X;
  if (typeof module !== 'undefined' && module.exports) module.exports = X;
})(typeof window !== 'undefined' ? window : globalThis);
