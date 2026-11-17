/* Donör Takip – Yemek kartı (MetropolCard / RestoPay) yüklemeleri.
 * "Yükleme Detay Raporu" Excel'i taranır; her yükleme donöre (ad soyad, yoksa telefon) bağlanır ve tarihine göre
 * aşamaya ayrılır: Sağlık kontrolü · Aşı + toplama · Toplama süreci · Diğer.
 * TCKN ve kart numarasının tamamı saklanmaz (kartın yalnızca son 4 hanesi).
 */
(function (root) {
  'use strict';
  var DT = root.DT, YK = {};
  var S = function (v) { return v == null ? '' : String(v); };
  var fold = DT.fold, xtrim = DT.xtrim;
  var key = function (s) { return fold(xtrim(s)).replace(/[^a-z0-9çğıöşüâîû]+/g, ' ').trim(); };
  var up = function (s) { return xtrim(s).replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR'); };
  var digits = function (s) { var d = S(s).replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };

  YK.ASAMA = ['Sağlık kontrolü', 'Aşı + toplama', 'Toplama süreci', 'Diğer'];
  YK.RENK = { 'Sağlık kontrolü': '#2F6FB0', 'Aşı + toplama': '#D99A2B', 'Toplama süreci': '#15803d', 'Diğer': '#8a8f98' };
  // aşama pencereleri (gün): sağlık kontrolü −3…+2; toplama süreci (aşı başlangıcı ya da toplama) −3 … toplama +3
  YK.PENCERE = { skOnce: 3, skSonra: 2, topOnce: 3, topSonra: 3 };

  /* ---------------- Excel'den okuma ---------------- */
  var BASLIK = { kullanici: ['kullanıcı no', 'kullanici no'], ad: ['ad soyad', 'adsoyad'], gsm: ['gsm', 'telefon'], birim: ['birim'], kisi: ['kisi aciklama', 'kişi açıklama'],
    siparis: ['siparisno', 'sipariş no', 'siparis no'], tutar: ['tutar'], fatura: ['fatura tutarı', 'fatura tutari'], tip: ['faturatipi', 'fatura tipi'], islem: ['islemtipi', 'işlemtipi', 'işlem tipi'],
    kart: ['kart numarası', 'kart numarasi'], not: ['note'], tarih: ['islemtarihi', 'işlemtarihi', 'işlem tarihi', 'islem tarihi', 'yükleme tarihi'], aciklama2: ['aciklama2', 'açıklama2'] };
  function sutunlar(row, X) {
    var m = {};
    Object.keys(row || {}).forEach(function (c) {
      var t = key(X.cellText(row[c]));
      Object.keys(BASLIK).forEach(function (k) { if (m[k] == null && BASLIK[k].some(function (b) { return key(b) === t; })) m[k] = +c; });
    });
    return m;
  }
  // "16-11-2026 15:20", "16.11.2026", "2026-11-16 15:20" ya da Excel tarih sayısı
  function tarihSaat(cell) {
    if (!cell) return null;
    var v = cell.v;
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var gun = Math.floor(v), dk = Math.round((v - gun) * 1440);
      return { tarih: gun, saat: dk ? ('0' + Math.floor(dk / 60)).slice(-2) + ':' + ('0' + dk % 60).slice(-2) : '' };
    }
    var s = S(v).trim(), m = /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})(?:[ T]+(\d{1,2}):(\d{2}))?/.exec(s), y, mo, d;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else { m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/.exec(s); if (!m) return null; y = +m[1]; mo = +m[2]; d = +m[3]; }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { tarih: DT.serial(y, mo, d), saat: m[4] != null ? ('0' + m[4]).slice(-2) + ':' + m[5] : '' };
  }
  function sayi(cell) {
    if (!cell) return NaN;
    if (typeof cell.v === 'number') return cell.v;
    var s = S(cell.v).replace(/[^\d,.\-]/g, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    return s === '' ? NaN : +s;
  }
  // dosyada yükleme detayı var mı? (Ad Soyad + Tutar + İşlem Tarihi başlıkları)
  function bul(wb, X) {
    var names = wb.sheetNames.slice(), i = 0;
    var dene = function () {
      if (i >= names.length) return Promise.resolve(null);
      var ad = names[i++];
      return wb.sheet(ad, { maxRow: 6, maxCol: 40 }).then(function (sh) {
        for (var r = 1; r <= 6; r++) { var m = sutunlar(sh[r], X); if (m.ad != null && m.tutar != null && m.tarih != null) return { sheet: ad, row: r }; }
        return dene();
      });
    };
    return dene();
  }
  YK.detect = function (buf) {
    var X = root.XLSXIO;
    return X.openWorkbook(buf).then(function (wb) { return bul(wb, X); }).then(function (f) { return !!f; }, function () { return false; });
  };
  YK.importWorkbook = function (buf) {
    var X = root.XLSXIO, wb0;
    return X.openWorkbook(buf).then(function (wb) { wb0 = wb; return bul(wb, X); }).then(function (f) {
      if (!f) throw new Error('Bu dosyada yükleme detayı (Ad Soyad, Tutar, İşlem Tarihi sütunları) bulunamadı.');
      return wb0.sheet(f.sheet, { maxCol: 40 }).then(function (sh) { return { sh: sh, row: f.row }; });
    }).then(function (o) {
      var sh = o.sh, m = sutunlar(sh[o.row], X), T = function (row, k) { return m[k] != null && row[m[k]] ? xtrim(X.cellText(row[m[k]])) : ''; };
      var out = [], atlanan = 0;
      Object.keys(sh).map(Number).filter(function (r) { return r > o.row; }).sort(function (a, b) { return a - b; }).forEach(function (rn) {
        var row = sh[rn], ts = tarihSaat(row[m.tarih]), t = sayi(row[m.tutar]);
        if (isNaN(t) && m.fatura != null) t = sayi(row[m.fatura]);
        var ad = up(T(row, 'ad'));
        if (!ts || isNaN(t) || !ad) { if (ad || ts) atlanan++; return; }
        var kart = T(row, 'kart').replace(/\D/g, '');
        out.push({ id: DT.uid(), tarih: ts.tarih, saat: ts.saat, ad: ad, kullanici: T(row, 'kullanici'), siparis: T(row, 'siparis'), tutar: Math.round(t * 100) / 100,
          tip: T(row, 'tip'), islem: T(row, 'islem'), not: T(row, 'not'), aciklama: T(row, 'birim') || T(row, 'kisi'), aciklama2: T(row, 'aciklama2'),
          kart4: kart ? kart.slice(-4) : '', tel: digits(T(row, 'gsm')), donorId: null, asama: null });
      });
      out.sort(function (a, b) { return a.tarih - b.tarih || S(a.saat).localeCompare(S(b.saat)); });
      var top = out.reduce(function (a, r) { return a + r.tutar; }, 0), iade = out.filter(function (r) { return r.tutar < 0; });
      return { rows: out, rapor: { satir: out.length, atlanan: atlanan, toplam: Math.round(top * 100) / 100, iade: iade.length,
        ilk: out.length ? out[0].tarih : null, son: out.length ? out[out.length - 1].tarih : null } };
    });
  };
  // aynı yükleme iki kez girmez: rapor tekrar ya da çakışan dönemle yüklenirse fazlası eklenir
  YK.anahtar = function (r) { return [r.tarih, r.saat, r.kullanici || key(r.ad), r.siparis, r.tutar, key(r.tip)].join('|'); };
  YK.merge = function (eski, yeni) {
    var cnt = {}, seen = {}, out = eski.slice(), eklenen = 0;
    eski.forEach(function (r) { var k = YK.anahtar(r); cnt[k] = (cnt[k] || 0) + 1; });
    yeni.forEach(function (r) { var k = YK.anahtar(r); seen[k] = (seen[k] || 0) + 1; if (seen[k] > (cnt[k] || 0)) { out.push(r); eklenen++; } });
    out.sort(function (a, b) { return a.tarih - b.tarih || S(a.saat).localeCompare(S(b.saat)); });
    return { list: out, eklenen: eklenen, ayni: yeni.length - eklenen };
  };

  /* ---------------- donör ve aşama ---------------- */
  function pencereler(x) {
    var d = x.d, P = YK.PENCERE, w = [];
    if (d.sk != null) w.push({ a: 'sk', bas: d.sk - P.skOnce, son: d.sk + P.skSonra, anc: d.sk });
    if (d.top != null) { var b = x.asiYok || x.asi == null ? d.top : Math.min(x.asi, d.top); w.push({ a: 'top', bas: b - P.topOnce, son: d.top + P.topSonra, anc: b, top: d.top }); }
    return w;
  }
  function uzaklik(w, t) { return t < w.bas ? w.bas - t : t > w.son ? t - w.son : 0; }
  function yakinlik(w, t) { return w.a === 'top' ? (t < w.anc ? w.anc - t : t > w.top ? t - w.top : 0) : Math.abs(t - w.anc); }
  function enIyi(x, t) {
    var best = null;
    pencereler(x).forEach(function (w) {
      var u = uzaklik(w, t), y = yakinlik(w, t);
      if (!best || u < best.u || (u === best.u && y < best.y)) best = { w: w, u: u, y: y };
    });
    return best;
  }
  function anahtarKelime(r) {
    var a = fold(r.aciklama || r.aciklama2), b = fold(r.aciklama2);
    var f = function (s) {
      if (/konsültasyon|konsultasyon/.test(s)) return 'Diğer';
      if (/(^|[^a-zçğıöşü])aşı|(^|[^a-zçğıöşü])asi /.test(s)) return 'Aşı + toplama';
      if (/toplama|kemik/.test(s)) return 'Toplama süreci';
      if (/sağlık kontrol|saglik kontrol|muayene/.test(s)) return 'Sağlık kontrolü';
      return null;
    };
    return f(a) || f(b) || 'Diğer';
  }
  /** her yükleme: { r, x (donör ya da null), asama, oto, sebep } · donörlere x.yk = { toplam, n, asama:{…} } */
  YK.derive = function (state, D) {
    var byId = {}, byName = {}, byTel = {};
    D.forEach(function (x) {
      byId[x.d.id] = x;
      var k = key(x.d.ad); if (k) (byName[k] = byName[k] || []).push(x);
      var tl = digits(x.d.tel); if (tl) (byTel[tl] = byTel[tl] || []).push(x);
      x.yk = { toplam: 0, n: 0, asama: {} };
    });
    var ekKons = {};
    (state.ekKons || []).forEach(function (e) { if (e.tarih != null && xtrim(e.hastaKodu)) (ekKons[fold(xtrim(e.hastaKodu))] = ekKons[fold(xtrim(e.hastaKodu))] || []).push(e.tarih); });
    var rows = (state.yemekKart || []).map(function (r) {
      var o = { r: r, x: null, asama: null, oto: true, sebep: '', tutar: +r.tutar || 0 };
      if (r.donorId && byId[r.donorId]) o.x = byId[r.donorId];
      else {
        var c = byName[key(r.ad)] || (r.tel && byTel[r.tel]) || [];
        if (c.length === 1) o.x = c[0];
        else if (c.length > 1) {
          var sec = null; c.forEach(function (x) { var b = enIyi(x, r.tarih); if (b && (!sec || b.u < sec.b.u || (b.u === sec.b.u && b.y < sec.b.y))) sec = { x: x, b: b }; });
          o.x = sec ? sec.x : c[c.length - 1];
        }
      }
      return o;
    });
    // aşama: tarih, donörün sağlık kontrolü / aşı / toplama tarihlerine göre
    var surec = {};
    rows.forEach(function (o) {
      var r = o.r, x = o.x;
      if (!x) { o.asama = anahtarKelime(r); o.sebep = 'Donör bulunamadı · açıklamaya göre'; return; }
      var ek = (ekKons[fold(xtrim(x.d.hk))] || []).filter(function (t) { return Math.abs(t - r.tarih) <= 2; });
      var b = enIyi(x, r.tarih);
      if (ek.length && (!b || b.u > 0)) { o.asama = 'Diğer'; o.sebep = 'Ek konsültasyon ' + DT.fmt(ek[0]); return; }
      if (!b || b.u > 0) {
        o.asama = 'Diğer';
        o.sebep = /konsültasyon|konsultasyon/.test(fold(r.aciklama + ' ' + r.aciklama2)) ? 'Ek konsültasyon (açıklamadan)' : 'Tarih sağlık kontrolü ve toplama dönemine uymuyor';
        return;
      }
      if (b.w.a === 'sk') { o.asama = 'Sağlık kontrolü'; o.sebep = 'Sağlık kontrolü ' + DT.fmt(x.d.sk); return; }
      o.asama = 'top'; o.surec = x.d.id + '|' + x.d.top;
      var s = surec[o.surec] = surec[o.surec] || { x: x, asiGunu: false };
      if (!x.asiYok && x.asi != null && r.tarih <= x.d.top - 2) s.asiGunu = true;
    });
    // toplama dönemindeki yüklemeler: aşı günlerinde yükleme varsa "Aşı + toplama", yalnızca toplama günlerindeyse "Toplama süreci"
    rows.forEach(function (o) {
      if (o.asama !== 'top') return;
      var s = surec[o.surec], x = o.x;
      o.asama = s.asiGunu ? 'Aşı + toplama' : 'Toplama süreci';
      o.sebep = s.asiGunu ? 'Aşı ' + DT.fmtShort(x.asi) + ' · toplama ' + DT.fmt(x.d.top) : (x.asiYok ? 'Kemik iliği · toplama ' : 'Toplama ') + DT.fmt(x.d.top);
    });
    rows.forEach(function (o) {
      if (o.r.asama && YK.ASAMA.indexOf(o.r.asama) >= 0) { o.otoAsama = o.asama; o.asama = o.r.asama; o.oto = false; o.sebep = 'Elle seçildi'; }
      if (o.x) { var y = o.x.yk; y.toplam += o.tutar; y.n++; y.asama[o.asama] = (y.asama[o.asama] || 0) + o.tutar; }
    });
    D.forEach(function (x) { x.yk.toplam = Math.round(x.yk.toplam * 100) / 100; });
    return rows;
  };

  root.YK = YK;
  if (typeof module !== 'undefined' && module.exports) module.exports = YK;
})(typeof window !== 'undefined' ? window : globalThis);
