// Küçük Excel (.xlsx) yazıcı: sıkıştırmasız zip + SpreadsheetML. Dış kütüphane gerektirmez.
'use strict';
const Xlsx = (() => {
  const tablo = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = b => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = tablo[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const enc = new TextEncoder();

  function zip(dosyalar) {
    const parca = [], merkez = [];
    let ofset = 0;
    for (const f of dosyalar) {
      const ad = enc.encode(f.ad), v = enc.encode(f.metin), crc = crc32(v);
      const l = new DataView(new ArrayBuffer(30));
      l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true);
      l.setUint16(8, 0, true); l.setUint16(10, 0, true); l.setUint16(12, 0x21, true);
      l.setUint32(14, crc, true); l.setUint32(18, v.length, true); l.setUint32(22, v.length, true);
      l.setUint16(26, ad.length, true); l.setUint16(28, 0, true);
      parca.push(new Uint8Array(l.buffer), ad, v);
      const m = new DataView(new ArrayBuffer(46));
      m.setUint32(0, 0x02014b50, true); m.setUint16(4, 20, true); m.setUint16(6, 20, true);
      m.setUint16(8, 0x0800, true); m.setUint16(10, 0, true); m.setUint16(12, 0, true); m.setUint16(14, 0x21, true);
      m.setUint32(16, crc, true); m.setUint32(20, v.length, true); m.setUint32(24, v.length, true);
      m.setUint16(28, ad.length, true); m.setUint16(30, 0, true); m.setUint16(32, 0, true);
      m.setUint16(34, 0, true); m.setUint16(36, 0, true); m.setUint32(38, 0, true); m.setUint32(42, ofset, true);
      merkez.push(new Uint8Array(m.buffer), ad);
      ofset += 30 + ad.length + v.length;
    }
    const mBoy = merkez.reduce((s, p) => s + p.length, 0);
    const s = new DataView(new ArrayBuffer(22));
    s.setUint32(0, 0x06054b50, true); s.setUint16(4, 0, true); s.setUint16(6, 0, true);
    s.setUint16(8, dosyalar.length, true); s.setUint16(10, dosyalar.length, true);
    s.setUint32(12, mBoy, true); s.setUint32(16, ofset, true); s.setUint16(20, 0, true);
    const hepsi = [...parca, ...merkez, new Uint8Array(s.buffer)];
    const out = new Uint8Array(hepsi.reduce((t, p) => t + p.length, 0));
    let o = 0;
    for (const p of hepsi) { out.set(p, o); o += p.length; }
    return out;
  }

  const xe = s => String(s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const kolon = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const sayfaAdi = s => String(s).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Sayfa';

  function sayfaXml(sf) {
    const para = new Set(sf.paraKolon || []);
    const satir = sf.satirlar.map((r, ri) => {
      const h = r.map((v, ci) => {
        let ozelPara = false;
        if (v && typeof v === 'object') { ozelPara = !!v.para; v = v.v; }
        if (v === null || v === undefined || v === '') return '';
        const ref = kolon(ci) + (ri + 1);
        const stil = ri === 0 ? 1 : (typeof v === 'number' && (ozelPara || para.has(ci)) ? 2 : 0);
        if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${stil}"><v>${v}</v></c>`;
        return `<c r="${ref}" s="${stil}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
      }).join('');
      return `<row r="${ri + 1}">${h}</row>`;
    }).join('');
    const cols = sf.genislik ? `<cols>${sf.genislik.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      cols + `<sheetData>${satir}</sheetData></worksheet>`;
  }

  // sayfalar: [{ad, satirlar:[[...]], genislik:[...], paraKolon:[sütun no]}]
  function olustur(sayfalar) {
    const n = sayfalar.length;
    const dosyalar = [
      { ad: '[Content_Types].xml', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sayfalar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { ad: '_rels/.rels', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { ad: 'xl/workbook.xml', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sayfalar.map((s, i) => `<sheet name="${xe(sayfaAdi(s.ad))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { ad: 'xl/_rels/workbook.xml.rels', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sayfalar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { ad: 'xl/styles.xml', metin: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0 &quot;₺&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D1C1A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
      ...sayfalar.map((s, i) => ({ ad: `xl/worksheets/sheet${i + 1}.xml`, metin: sayfaXml(s) }))
    ];
    return zip(dosyalar);
  }

  return { olustur };
})();
