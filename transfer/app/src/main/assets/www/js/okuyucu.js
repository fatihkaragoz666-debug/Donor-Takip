/* Antalya Transfer – Excel okuyucu.
 * xlsx-io.js'in zip açıcısını kullanır; ek olarak birleştirilmiş hücreleri, üstü çizili / kırmızı yazıyı,
 * dolgu rengini, gizli satır ve sayfaları okur. Sonuç:
 *   [{ name, hidden, rows: [[değer]], merged: [[true|undefined]], anchor: [[true|undefined]], st: [[{strike, red, fill}]] , hiddenRows: {satırNo:true} }]
 * Satır ve sütunlar 0'dan sayılır (Excel satır 1 → rows[0]).
 */
(function () {
  'use strict';
  var X = window.XLSXIO;

  function unesc(s) {
    if (!s) return '';
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
  function attr(a, name) { var m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(a || ''); return m ? unesc(m[1]) : null; }
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
  function refRC(ref) { return { c: colIndex(ref), r: parseInt(ref.replace(/^[A-Z]+/, ''), 10) }; }

  /* Renk: ARGB "FFFF0000" ya da indexed. Kırmızı mı? */
  var IDX = { 2: 'FF0000', 10: 'FF0000', 53: 'FF6600', 60: '993300' };
  function rgbOf(a) {
    if (!a) return null;
    var rgb = attr(a, 'rgb');
    if (rgb) return rgb.slice(-6).toUpperCase();
    var ix = attr(a, 'indexed');
    if (ix != null && IDX[ix]) return IDX[ix];
    return null;
  }
  function isRed(hex) {
    if (!hex || hex.length !== 6) return false;
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return r >= 170 && g <= 90 && b <= 90;
  }

  function parseStyles(xml) {
    var fonts = [], fills = [], xfs = [];
    if (!xml) return xfs;
    var fx = /<fonts[^>]*>([\s\S]*?)<\/fonts>/.exec(xml);
    if (fx) {
      var re = /<font\b[^>]*?(?:\/>|>([\s\S]*?)<\/font>)/g, m;
      while ((m = re.exec(fx[1]))) {
        var b = m[1] || '';
        var sm = /<strike(\s[^>]*)?\/?>/.exec(b);
        var strike = !!sm && !/val="(0|false)"/.test(sm[1] || '');
        var cm = /<color\s([^>]*?)\/?>/.exec(b);
        fonts.push({ strike: strike, red: isRed(rgbOf(cm && cm[1])) });
      }
    }
    var fl = /<fills[^>]*>([\s\S]*?)<\/fills>/.exec(xml);
    if (fl) {
      var re2 = /<fill\b[^>]*?(?:\/>|>([\s\S]*?)<\/fill>)/g, m2;
      while ((m2 = re2.exec(fl[1]))) {
        var fb = m2[1] || '';
        var solid = /patternType="solid"/.test(fb) || /<gradientFill/.test(fb);
        var fg = /<fgColor\s([^>]*?)\/?>/.exec(fb);
        var hex = rgbOf(fg && fg[1]);
        var themed = !!(fg && /theme=/.test(fg[1]));
        fills.push(solid && ((hex && hex !== 'FFFFFF') || themed) ? (hex || 'tema') : null);
      }
    }
    var cx = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
    if (cx) {
      var re3 = /<xf\s([^>]*?)(?:\/>|>)/g, m3;
      while ((m3 = re3.exec(cx[1]))) {
        var fo = fonts[parseInt(attr(m3[1], 'fontId') || '0', 10)] || {};
        var fi = fills[parseInt(attr(m3[1], 'fillId') || '0', 10)] || null;
        xfs.push({ strike: !!fo.strike, red: !!fo.red, fill: fi });
      }
    }
    return xfs;
  }

  function parseSST(xml) {
    var out = [];
    if (!xml) return out;
    var re = /<si>([\s\S]*?)<\/si>|<si\s*\/>/g, m;
    while ((m = re.exec(xml))) {
      var inner = m[1] || '';
      var t = texts(inner);
      // Zengin metin: bütün parçalar üstü çiziliyse metin üstü çizili sayılır
      var runs = inner.match(/<r>[\s\S]*?<\/r>/g) || [];
      var strike = false, red = false;
      if (runs.length) {
        var withText = runs.filter(function (r) { return /<t[^>]*>[^<]*\S[^<]*<\/t>/.test(r); });
        strike = withText.length > 0 && withText.every(function (r) { return /<strike(\s+val="(1|true)")?\s*\/>/.test(r); });
        red = withText.length > 0 && withText.every(function (r) { var c = /<color\s([^>]*?)\/?>/.exec(r); return c && isRed(rgbOf(c[1])); });
      }
      out.push({ t: t, strike: strike, red: red });
    }
    return out;
  }

  function parseSheetXml(xml, sst, xfs, maxCol) {
    var rows = [], st = [], merged = [], anchor = [], hiddenRows = {};
    var rowRe = /<row\s([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, rm;
    while ((rm = rowRe.exec(xml))) {
      var rn = parseInt(attr(rm[1], 'r') || '0', 10);
      if (!rn) continue;
      if (/(?:^|\s)hidden="(1|true)"/.test(rm[1])) hiddenRows[rn - 1] = true;
      var inner = rm[2] || '';
      var re = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, m;
      while ((m = re.exec(inner))) {
        var a = m[1], ref = attr(a, 'r');
        if (!ref) continue;
        var pos = refRC(ref);
        if (pos.c > maxCol) continue;
        var ci = m[2] || '', t = attr(a, 't'), v = null, sstFlags = null;
        var vm = /<v>([\s\S]*?)<\/v>/.exec(ci);
        if (t === 's') { var e = vm ? sst[parseInt(vm[1], 10)] : null; v = e ? e.t : ''; sstFlags = e; }
        else if (t === 'inlineStr') v = texts(ci);
        else if (t === 'str') v = vm ? unesc(vm[1]) : '';
        else if (t === 'b') v = vm ? vm[1] === '1' : false;
        else if (t === 'e') v = null;
        else v = vm ? parseFloat(vm[1]) : null;
        var r0 = pos.r - 1, c0 = pos.c - 1;
        var sx = xfs[parseInt(attr(a, 's') || '0', 10)] || {};
        var flags = { strike: !!(sx.strike || (sstFlags && sstFlags.strike)), red: !!(sx.red || (sstFlags && sstFlags.red)), fill: sx.fill || null };
        if (flags.strike || flags.red || flags.fill) (st[r0] = st[r0] || [])[c0] = flags;
        if (v === null || v === '') continue;
        (rows[r0] = rows[r0] || [])[c0] = v;
      }
    }
    // Birleştirilmiş hücreler: sol üst hücrenin değeri aralığın tamamına kopyalanır
    var mre = /<mergeCell\s+ref="([A-Z]+\d+):([A-Z]+\d+)"/g, mm;
    while ((mm = mre.exec(xml))) {
      var p1 = refRC(mm[1]), p2 = refRC(mm[2]);
      var r1 = p1.r - 1, c1 = p1.c - 1, r2 = p2.r - 1, c2 = Math.min(p2.c, maxCol) - 1;
      var val = rows[r1] && rows[r1][c1];
      var fl = st[r1] && st[r1][c1];
      (anchor[r1] = anchor[r1] || [])[c1] = { r2: r2, c2: c2 };
      for (var r = r1; r <= r2; r++) {
        for (var c = c1; c <= c2; c++) {
          if (r === r1 && c === c1) continue;
          (merged[r] = merged[r] || [])[c] = { r: r1, c: c1 };
          if (val != null && (!rows[r] || rows[r][c] == null)) (rows[r] = rows[r] || [])[c] = val;
          if (fl && (!st[r] || !st[r][c])) (st[r] = st[r] || [])[c] = fl;
        }
      }
    }
    return { rows: rows, st: st, merged: merged, anchor: anchor, hiddenRows: hiddenRows };
  }

  function read(buf, opt) {
    opt = opt || {};
    var maxCol = opt.maxCol || 40;
    var zip = X.readZip(buf);
    return Promise.all([zip.text('xl/workbook.xml'), zip.text('xl/_rels/workbook.xml.rels'), zip.text('xl/sharedStrings.xml'), zip.text('xl/styles.xml')])
      .then(function (r) {
        if (!r[0]) throw new Error('Dosya bir Excel çalışma kitabı değil.');
        var rels = {}, re = /<Relationship\s([^>]*?)\/?>/g, m;
        while ((m = re.exec(r[1] || ''))) rels[attr(m[1], 'Id')] = attr(m[1], 'Target');
        var list = [], re2 = /<sheet\s([^>]*?)\/?>/g;
        while ((m = re2.exec(r[0]))) {
          var target = (rels[attr(m[1], 'r:id')] || '').replace(/^\//, '');
          if (target.indexOf('xl/') !== 0) target = 'xl/' + target;
          list.push({ name: attr(m[1], 'name'), target: target, hidden: /state="(hidden|veryHidden)"/.test(m[1]) });
        }
        var sst = parseSST(r[2]), xfs = parseStyles(r[3]);
        return Promise.all(list.map(function (s) {
          return zip.text(s.target).then(function (xml) {
            var p = xml ? parseSheetXml(xml, sst, xfs, maxCol) : { rows: [], st: [], merged: [], anchor: [], hiddenRows: {} };
            p.name = s.name; p.hidden = s.hidden;
            return p;
          });
        }));
      });
  }

  window.OKUYUCU = { read: read };
})();
