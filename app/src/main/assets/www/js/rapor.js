/* Donör Takip – Raporlar: tarih aralığına göre Donör, Harcama, İş yükü ve taşıma raporları ve Dashboard özeti.
 * Her rapor tek bir modelden üretilir: uygulamadaki önizleme, PDF (PDFR) ve Excel (XLSXIO.buildXlsx).
 */
(function (root) {
  'use strict';
  var DT = root.DT, HR = root.HR, RP = {};
  var S = DT.S, eqi = DT.eqi, xtrim = DT.xtrim;
  var AY3 = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var KAT_RENK = ['#2F6FB0', '#A3262A', '#D99A2B', '#5B3A8C', '#8a8f98'];
  var NAVY = '#1F3A5F';

  RP.TURLER = [
    ['donor', 'Donör raporu', 'Dönemdeki donörler: durum, hastane, yöntem, aylık dağılım ve donör listesi'],
    ['harcama', 'Harcama raporu', 'Dönemdeki harcamalar: kategori, harcama ve ulaşım türü, il, donör bazında'],
    ['isyuku', 'İş yükü ve taşıma raporu', 'Personel başına görevler, görev türleri ve ürün taşımaları'],
    ['ozet', 'Dashboard özeti', 'Dönemin sayıları ve grafikleri tek raporda: yöneticiye sunum için'],
    ['yemek', 'Yemek kartı raporu', 'Yemek kartı yüklemeleri: sağlık kontrolü, aşı + toplama, toplama süreci ve donör bazında'],
    ['mesai', 'Personel mesai raporu', 'Fazla mesai, resmi tatil, hafta sonu, yemek hakkı, izin ve görevlendirme; personel bazında ve gün gün']
  ];
  RP.ad = function (tur) { for (var i = 0; i < RP.TURLER.length; i++) if (RP.TURLER[i][0] === tur) return RP.TURLER[i][1]; return 'Rapor'; };
  var BASLIK = { donor: 'Donör Raporu', harcama: 'Harcama Raporu', isyuku: 'İş Yükü ve Taşıma Raporu', ozet: 'Dashboard Özeti', yemek: 'Yemek Kartı Raporu', mesai: 'Personel Mesai Raporu' };
  var DOSYA = { donor: 'Donor_Raporu', harcama: 'Harcama_Raporu', isyuku: 'Is_Yuku_Tasima_Raporu', ozet: 'Dashboard_Ozeti', yemek: 'Yemek_Karti_Raporu', mesai: 'Personel_Mesai_Raporu' };

  /* ---------------- biçimler ---------------- */
  var nf = function (v, d) { return (+v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  RP.fmt = function (v, f) {
    var bos = v == null || v === '' || (typeof v === 'number' && isNaN(v));
    if (f === 'intz' || f === 'tlz' || f === 'saz') { if (bos || v === 0) return '–'; f = f === 'intz' ? 'int' : f === 'tlz' ? 'tl' : 'sa'; }
    if (bos) return f && f !== 'txt' ? '–' : '';
    if (typeof v !== 'number') return S(v);
    switch (f) {
      case 'int': return nf(Math.round(v), 0);
      case 'tl': return nf(v, 2) + ' ₺';
      case 'tl0': return nf(Math.round(v), 0) + ' ₺';
      case 'pct': return nf(Math.round(v * 1000) / 10, Math.round(v * 1000) % 10 ? 1 : 0) + '%';
      case 'dec1': return nf(Math.round(v * 10) / 10, Math.round(v * 10) % 10 ? 1 : 0);
      case 'sa': return nf(v, 2);
      case 'date': return DT.fmt(v);
      case 'kisa': return v >= 1e6 ? nf(v / 1e6, 1).replace(/,0$/, '') + ' Mn' : v >= 1e3 ? nf(Math.round(v / 1e3), 0) + ' B' : nf(Math.round(v), 0);
      default: return S(v);
    }
  };
  var fmt = RP.fmt;
  var sum = function (a, f) { var t = 0; for (var i = 0; i < a.length; i++) t += f ? (+f(a[i]) || 0) : (+a[i] || 0); return t; };
  var div = function (a, b) { return b ? a / b : null; };

  /* ---------------- dönem ---------------- */
  RP.HAZIR = [['buay', 'Bu ay'], ['gecenay', 'Geçen ay'], ['son3', 'Son 3 ay'], ['buyil', 'Bu yıl'], ['gecenyil', 'Geçen yıl'], ['tumu', 'Tümü']];
  RP.hazir = function (k, today) {
    var p = DT.parts(today), y = p.y, m = p.m;
    switch (k) {
      case 'buay': return { from: DT.serial(y, m, 1), to: DT.serial(y, m + 1, 1) - 1 };
      case 'gecenay': return { from: DT.serial(y, m - 1, 1), to: DT.serial(y, m, 1) - 1 };
      case 'son3': return { from: DT.serial(y, m - 2, 1), to: DT.serial(y, m + 1, 1) - 1 };
      case 'buyil': return { from: DT.serial(y, 1, 1), to: DT.serial(y, 12, 31) };
      case 'gecenyil': return { from: DT.serial(y - 1, 1, 1), to: DT.serial(y - 1, 12, 31) };
      default: return { from: null, to: null };
    }
  };
  RP.donemAd = function (from, to) {
    if (from == null || to == null) return 'Tüm kayıtlar';
    if (from === to) return DT.fmt(from);
    var a = DT.parts(from), b = DT.parts(to);
    if (a.d === 1 && DT.serial(b.y, b.m, b.d + 1) === DT.serial(b.y, b.m + 1, 1)) {
      if (a.y === b.y && a.m === b.m) return DT.AYLAR[a.m - 1] + ' ' + a.y;
      if (a.m === 1 && b.m === 12) return a.y === b.y ? String(a.y) : a.y + ' – ' + b.y;
      return DT.AYLAR[a.m - 1] + (a.y !== b.y ? ' ' + a.y : '') + ' – ' + DT.AYLAR[b.m - 1] + ' ' + b.y;
    }
    return DT.fmt(from) + ' – ' + DT.fmt(to);
  };
  // "Tümü" seçilince verideki ilk ve son tarih
  function kapsam(c) {
    var mn = null, mx = null, f = function (s) { if (s == null) return; if (mn == null || s < mn) mn = s; if (mx == null || s > mx) mx = s; };
    c.D.forEach(function (x) { f(x.d.sk); f(x.d.top); });
    (c.state.harcama || []).forEach(function (r) { f(r.tarih); });
    (c.state.yemekKart || []).forEach(function (r) { f(r.tarih); });
    (c.state.gorevKayit || []).forEach(function (r) { f(r.tarih); });
    (c.state.tasimaKayit || []).forEach(function (r) { f(r.tarih); });
    if (c.state.mesai) Object.keys(c.state.mesai.gun || {}).forEach(function (k) { f(+k); });
    if (mn == null) mn = mx = c.today;
    return { from: DT.serial(DT.year(mn), 1, 1), to: DT.serial(DT.year(Math.max(mx, c.today)), 12, 31) };
  }
  // grafikler için dönem dilimleri: 45 güne kadar hafta hafta, 24 aya kadar ay ay, daha uzunsa yıl yıl
  function dilimler(from, to) {
    var a = DT.parts(from), b = DT.parts(to), n = (b.y - a.y) * 12 + b.m - a.m + 1, out = [];
    if (to - from + 1 <= 45) {
      for (var w = DT.weekStart(from); w <= to; w += 7) {
        var bas = Math.max(from, w), son = Math.min(to, w + 6);
        out.push({ ad: DT.fmtShort(bas), uzun: DT.fmtShort(bas) + ' – ' + DT.fmtShort(son), bas: bas, son: son });
      }
      out.tur = 'hafta';
    } else if (n <= 24) {
      var y = a.y, m = a.m, iki = a.y !== b.y;
      for (var i = 0; i < n; i++) {
        out.push({ ad: AY3[m - 1] + (iki ? ' ' + String(y).slice(2) : ''), uzun: DT.AYLAR[m - 1] + ' ' + y, bas: Math.max(from, DT.serial(y, m, 1)), son: Math.min(to, DT.serial(y, m + 1, 1) - 1) });
        m++; if (m > 12) { m = 1; y++; }
      }
      out.tur = 'ay';
    } else {
      for (var yy = a.y; yy <= b.y; yy++) out.push({ ad: String(yy), uzun: String(yy), bas: Math.max(from, DT.serial(yy, 1, 1)), son: Math.min(to, DT.serial(yy, 12, 31)) });
      out.tur = 'yil';
    }
    out.baslik = { hafta: 'Haftalara göre', ay: 'Aylara göre', yil: 'Yıllara göre' }[out.tur];
    out.sutun = { hafta: 'Hafta', ay: 'Ay', yil: 'Yıl' }[out.tur];
    return out;
  }
  var icinde = function (s, d) { return s != null && s >= d.bas && s <= d.son; };

  /* ---------------- yardımcı bloklar ---------------- */
  var H = function (text, sub) { return { type: 'h', text: text, sub: sub }; };
  var NOTE = function (text) { return { type: 'note', text: text }; };
  var ROW = function () { return { type: 'row', items: Array.prototype.slice.call(arguments).filter(Boolean) }; };
  var T = function (o) { o.type = 'table'; return o; };
  var col = function (t, f, o) { var c = { t: t, f: f || 'txt' }; if (o) for (var k in o) c[k] = o[k]; return c; };

  /* ================= 1 · DONÖR RAPORU ================= */
  var DURUM_SIRA = ['Kayıt açıldı', 'Sağlık kontrolü planlandı', 'Sağlık kontrolü yapıldı', 'Toplama planlandı', 'Aşı sürecinde', 'Toplama yapıldı',
    'Süreç durdu · iptal', 'Süreç durdu · erteleme', 'Süreç durdu · red', 'Süreç durdu · vazgeçti', 'Süreç durdu · hasta ex'];
  RP.DONOR_DURUM = [['all', 'Tümü'], ['devam', 'Devam eden'], ['yapildi', 'Toplama yapıldı'], ['durdu', 'Süreç durdu']];
  RP.OLCUT = [['her', 'Sağlık kontrolü ya da toplama tarihi'], ['top', 'Toplama tarihi'], ['sk', 'Sağlık kontrolü tarihi']];
  function donorRaporu(c, o) {
    var t = c.today, inR = function (s) { return s != null && s >= o.from && s <= o.to; }, f = o.filtre || {};
    var olcut = f.olcut || 'her';
    var list = c.D.filter(function (x) {
      if (!x.durum) return false;
      var d = x.d;
      if (!o.tumu) {
        var ok = olcut === 'sk' ? inR(d.sk) : olcut === 'top' ? inR(d.top) : (inR(d.sk) || inR(d.top));
        if (!ok) return false;
      }
      if (f.durum === 'devam' && (x.stopped || x.durum === 'Toplama yapıldı')) return false;
      if (f.durum === 'yapildi' && x.durum !== 'Toplama yapıldı') return false;
      if (f.durum === 'durdu' && !x.stopped) return false;
      if (f.hastane && !eqi(x.d.hastane, f.hastane)) return false;
      if (f.yontem && !eqi(x.d.yontem, f.yontem)) return false;
      return true;
    });
    var tarih = function (x) { return x.d.top != null ? x.d.top : x.d.sk; };
    list.sort(function (a, b) { var ta = tarih(a), tb = tarih(b); return (ta == null) - (tb == null) || (ta || 0) - (tb || 0) || a.i - b.i; });
    var skYap = function (x) { return x.d.sk != null && !x.skYapilmadi && x.d.sk <= t && inR(x.d.sk); };
    var topGer = function (x) { return x.d.top != null && !x.stopped && x.d.top <= t && inR(x.d.top); };
    var topPlan = function (x) { return x.d.top != null && !x.stopped && x.d.top > t && inR(x.d.top); };
    var cnt = function (a, fn) { var n = 0; a.forEach(function (x) { if (fn(x)) n++; }); return n; };
    var yap = cnt(list, function (x) { return x.durum === 'Toplama yapıldı'; }), dur = cnt(list, function (x) { return x.stopped; });
    var B = [];
    B.push({ type: 'kpis', items: [
      { v: list.length, f: 'int', l: 'Donör', c: NAVY },
      { v: cnt(list, skYap), f: 'int', l: 'Sağlık kontrolü yapılan (dönemde)', c: '#2F6FB0' },
      { v: cnt(list, topGer), f: 'int', l: 'Toplama gerçekleşen (dönemde)', c: '#15803d' },
      { v: cnt(list, topPlan), f: 'int', l: 'Planlanan toplama (dönemde)', c: '#86c79c' },
      { v: list.length - yap - dur, f: 'int', l: 'Süreci devam eden', c: '#D99A2B' },
      { v: dur, f: 'int', l: 'Süreç durdu', c: '#8a8f98' }] });
    // durum
    var durumlar = DURUM_SIRA.map(function (dd) { return [dd, cnt(list, function (x) { return x.durum === dd; })]; }).filter(function (r) { return r[1]; });
    B.push(H('Durum dağılımı', 'donörün bugünkü durumu'));
    B.push(ROW(T({ cols: [col('Durum'), col('Donör', 'int'), col('Pay', 'pct')], rows: durumlar.map(function (r) { return [r[0], r[1], div(r[1], list.length)]; }), tot: ['Toplam', list.length, list.length ? 1 : null] }),
      { type: 'hbars', rows: durumlar.map(function (r) { return [r[0], r[1], /durdu/.test(r[0]) ? '#8a8f98' : r[0] === 'Toplama yapıldı' ? '#15803d' : '#2F6FB0']; }), f: 'int', xlsx: false }));
    // aylık
    if (list.length) {
      var dl = dilimler(o.from, o.to);
      var ay = dl.map(function (d) {
        return { ad: d.ad, uzun: d.uzun, sk: cnt(list, function (x) { return icinde(x.d.sk, d); }), ger: cnt(list, function (x) { return !x.stopped && x.d.top != null && x.d.top <= t && icinde(x.d.top, d); }),
          plan: cnt(list, function (x) { return !x.stopped && x.d.top != null && x.d.top > t && icinde(x.d.top, d); }), dur: cnt(list, function (x) { return x.stopped && icinde(tarih(x), d); }) };
      });
      B.push(H(dl.baslik));
      if (dl.length > 1) B.push({ type: 'bars', labels: ay.map(function (a) { return a.ad; }), f: 'int', series: [
        { name: 'Sağlık kontrolü', color: '#2F6FB0', values: ay.map(function (a) { return a.sk; }) },
        { name: 'Toplama gerçekleşen', color: '#15803d', values: ay.map(function (a) { return a.ger; }) },
        { name: 'Planlanan toplama', color: '#86c79c', values: ay.map(function (a) { return a.plan; }) }], xlsx: false });
      B.push(T({ cols: [col(dl.sutun), col('Sağlık kontrolü', 'int'), col('Toplama gerçekleşen', 'int'), col('Planlanan toplama', 'int'), col('Süreç durdu', 'int')],
        rows: ay.map(function (a) { return [a.uzun, a.sk, a.ger, a.plan, a.dur]; }), tot: ['Toplam', sum(ay, function (a) { return a.sk; }), sum(ay, function (a) { return a.ger; }), sum(ay, function (a) { return a.plan; }), sum(ay, function (a) { return a.dur; })],
        note: 'Süreç durdu: toplama (yoksa sağlık kontrolü) tarihinin dilimine yazılır.' }));
    }
    // hastane, yöntem
    var grup = function (alan, liste) {
      var rows = liste.map(function (ad) { return { ad: ad, a: list.filter(function (x) { return eqi(x.d[alan], ad); }) }; });
      rows.push({ ad: 'Belirtilmemiş', a: list.filter(function (x) { return !xtrim(x.d[alan]); }) });
      var bilinen = {}; liste.forEach(function (ad) { bilinen[DT.fold(xtrim(ad))] = 1; });
      var diger = list.filter(function (x) { return xtrim(x.d[alan]) && !bilinen[DT.fold(xtrim(x.d[alan]))]; });
      if (diger.length) rows.push({ ad: 'Listede olmayan', a: diger });
      return rows.filter(function (r) { return r.a.length; });
    };
    var hs = grup('hastane', c.state.lists.hastane.map(function (e) { return e.ad; }));
    B.push(H('Hastane ve yöntem'));
    B.push(T({ cols: [col('Hastane'), col('Donör', 'int'), col('SK yapılan', 'intz'), col('Toplama gerç.', 'intz'), col('Planlanan', 'intz'), col('Devam eden', 'intz'), col('Süreç durdu', 'intz')],
      rows: hs.map(function (r) { var y = cnt(r.a, function (x) { return x.durum === 'Toplama yapıldı'; }), s = cnt(r.a, function (x) { return x.stopped; }); return [r.ad, r.a.length, cnt(r.a, skYap), cnt(r.a, topGer), cnt(r.a, topPlan), r.a.length - y - s, s]; }),
      tot: ['Toplam', list.length, cnt(list, skYap), cnt(list, topGer), cnt(list, topPlan), list.length - yap - dur, dur] }));
    var ys = grup('yontem', c.state.lists.yontem || []);
    var ik = [['Ankara içi', 1], ['Ankara dışı', 0], ['İkamet girilmemiş', '']].map(function (e) { var a = list.filter(function (x) { return x.ankara === e[1]; }); return [e[0], a.length, cnt(a, skYap), cnt(a, topGer)]; }).filter(function (r) { return r[1]; });
    B.push(ROW(T({ title: 'Yöntem', cols: [col('Yöntem'), col('Donör', 'int'), col('Toplama gerç.', 'intz'), col('Süreç durdu', 'intz')],
      rows: ys.map(function (r) { return [r.ad, r.a.length, cnt(r.a, topGer), cnt(r.a, function (x) { return x.stopped; })]; }) }),
    T({ title: 'İkamet', cols: [col('İkamet'), col('Donör', 'int'), col('SK yapılan', 'intz'), col('Toplama gerç.', 'intz')], rows: ik })));
    var nk = [['Yurt içi', 0], ['Yurt dışı', 1], ['Nakil merkezi girilmemiş', '']].map(function (e) { var a = list.filter(function (x) { return x.yd === e[1]; }); return [e[0], cnt(a, topGer), cnt(a, topPlan)]; }).filter(function (r) { return r[1] || r[2]; });
    if (nk.length) B.push(T({ cols: [col('Nakil merkezi'), col('Toplama gerçekleşen', 'int'), col('Planlanan toplama', 'int')], rows: nk }));
    // donör listesi
    var pdfCols = [col('#', 'int', { a: 'r' }), col('Hasta kodu'), col('Ad soyad'), col('İkamet'), col('Hastane'), col('Yöntem'), col('Sağlık k.', 'date', { a: 'c' }), col('Toplama', 'date', { a: 'c' }),
      col('Nakil merkezi', 'txt', { wrap: 2 }), col('Durum'), col('Açıklama', 'txt', { wrap: 2 })];
    B.push(Object.assign(H('Donör listesi', list.length + ' donör'), { pdf: o.ayrinti, xlsx: false }));
    var kisaDurum = function (dd) { return S(dd).replace('Süreç durdu · ', 'Durdu: ').replace('Sağlık kontrolü', 'SK'); };
    B.push(T({ cols: pdfCols, rows: list.map(function (x, i) { var d = x.d; return { v: [i + 1, d.hk, d.ad, d.ikamet, d.hastane, d.yontem, d.sk, d.top, d.bolge, kisaDurum(x.durum), d.aciklama], muted: x.stopped }; }),
      pdf: o.ayrinti, xlsx: false, uzun: true, empty: 'Bu dönemde donör yok' }));
    B.push(T({ sheet: 'Donörler', cols: [col('Hasta kodu'), col('Donör numarası'), col('Ad soyad'), col('Telefon'), col('İkamet'), col('Sağlık kontrolü', 'date'), col('Yöntem'), col('Hastane'),
      col('Açıklama'), col('Aşı başlama', 'date'), col('Toplama', 'date'), col('Nakil merkezi'), col('İlgilenen personel'), col('Son izlem', 'date'), col('Ulaşım'), col('Konaklama'), col('Taşıyan personel'), col('Durum')],
      xw: [12, 18, 24, 15, 22, 12, 12, 18, 34, 12, 12, 34, 14, 12, 12, 12, 14, 24],
      rows: list.map(function (x) { var d = x.d; return { v: [d.hk, d.dno, d.ad, d.tel, d.ikamet, d.sk, d.yontem, d.hastane, d.aciklama, x.asiYok ? 'Aşı yok' : x.asi, d.top, d.bolge, d.personel, x.sonIzlem, d.ulasim, d.konaklama, d.tasiyan, x.durum], muted: x.stopped }; }),
      pdf: false, html: false }));
    var fl = [];
    fl.push('Ölçüt: ' + (RP.OLCUT.filter(function (q) { return q[0] === olcut; })[0] || RP.OLCUT[0])[1] + (o.tumu ? '' : ' dönem içinde'));
    var fx = [];
    if (f.durum && f.durum !== 'all') fx.push('Durum: ' + RP.DONOR_DURUM.filter(function (q) { return q[0] === f.durum; })[0][1]);
    if (f.hastane) fx.push('Hastane: ' + f.hastane);
    if (f.yontem) fx.push('Yöntem: ' + f.yontem);
    if (fx.length) fl.push(fx.join(' · '));
    return { landscape: true, info: fl, blocks: B, ayrinti: { ad: 'Donör listesi', n: list.length },
      ozet: list.length + ' donör · toplama gerçekleşen ' + cnt(list, topGer) + ' · planlanan ' + cnt(list, topPlan) + ' · süreç durdu ' + dur,
      not: 'Süreç durdu: açıklamasında iptal, erteleme, red, vazgeç ya da hasta ex geçen donörler. Gri satırlar süreci duran donörlerdir.' };
  }

  /* ================= 2 · HARCAMA RAPORU ================= */
  function harcamaRaporu(c, o) {
    var tarihsiz = 0;
    var rows = c.hrows.filter(function (q) {
      if (o.tumu) return true;
      if (q.r.tarih == null) { tarihsiz++; return false; }
      return q.r.tarih >= o.from && q.r.tarih <= o.to;
    });
    var K = HR.KATEGORI, top = sum(rows, function (q) { return q.tutar; });
    var donors = {}; rows.forEach(function (q) { var k = q.x ? q.x.d.id : 'e:' + DT.fold(xtrim(q.r.ad)); var dd = donors[k] || (donors[k] = { x: q.x, ad: q.x ? q.x.d.ad : q.r.ad, kat: {}, toplam: 0, n: 0, gece: 0, rf: '' }); dd.toplam += q.tutar; dd.n++; dd.kat[q.r.kategori] = (dd.kat[q.r.kategori] || 0) + q.tutar; if (q.r.gece) dd.gece += +q.r.gece; var rf = S(q.r.refakatci).toLocaleUpperCase('tr-TR'); if (rf === 'VAR') dd.rf = 'Var'; else if (rf === 'YOK' && dd.rf !== 'Var') dd.rf = 'Yok'; });
    var dlist = Object.keys(donors).map(function (k) { return donors[k]; }).sort(function (a, b) { return b.toplam - a.toplam; });
    var eslesen = dlist.filter(function (d) { return d.x; });
    var dis = sum(rows, function (q) { return q.konum === 'Şehir Dışı' ? q.tutar : 0; });
    var B = [];
    B.push({ type: 'kpis', items: [
      { v: top, f: 'tl', l: 'Toplam harcama', c: '#A3262A' }, { v: rows.length, f: 'int', l: 'Harcama kalemi', c: NAVY },
      { v: eslesen.length, f: 'int', l: 'Harcama yapılan donör', c: '#2F6FB0' }, { v: div(top, eslesen.length || dlist.length), f: 'tl', l: 'Donör başı ortalama', c: '#D99A2B' },
      { v: div(dis, top), f: 'pct', l: 'Şehir dışı donörlerin payı', c: '#5B3A8C' }, { v: dlist.filter(function (d) { return d.rf === 'Var'; }).length, f: 'int', l: 'Refakatçili donör', c: '#8a8f98' }] });
    // kategori
    var kat = K.map(function (k, i) { var a = rows.filter(function (q) { return q.r.kategori === k; }); return [k, a.length, sum(a, function (q) { return q.tutar; }), KAT_RENK[i]]; });
    rows.forEach(function (q) { if (K.indexOf(q.r.kategori) < 0) { var r = kat.filter(function (z) { return z[0] === (q.r.kategori || 'Diğer'); })[0]; if (!r) { r = [q.r.kategori || 'Diğer', 0, 0, '#8a8f98']; kat.push(r); } r[1]++; r[2] += q.tutar; } });
    B.push(H('Kategoriye göre'));
    B.push(ROW(T({ cols: [col('Kategori'), col('Kalem', 'int'), col('Tutar', 'tl'), col('Pay', 'pct')], rows: kat.map(function (r) { return [r[0], r[1], r[2], div(r[2], top)]; }), tot: ['Toplam', rows.length, top, top ? 1 : null] }),
      { type: 'hbars', rows: kat.map(function (r) { return [r[0], r[2], r[3]]; }), f: 'tl0', xlsx: false }));
    // aylık
    if (rows.length) {
      var dl = dilimler(o.tumu ? kapsamHarcama(rows, c).from : o.from, o.tumu ? kapsamHarcama(rows, c).to : o.to);
      var ay = dl.map(function (d) { var a = rows.filter(function (q) { return icinde(q.r.tarih, d); }); return { d: d, a: a, t: sum(a, function (q) { return q.tutar; }) }; });
      B.push(H(dl.baslik));
      if (dl.length > 1) B.push({ type: 'bars', labels: ay.map(function (a) { return a.d.ad; }), f: 'tl', series: K.slice(0, 3).map(function (k, i) { return { name: k, color: KAT_RENK[i], values: ay.map(function (a) { return sum(a.a, function (q) { return q.r.kategori === k ? q.tutar : 0; }); }) }; })
        .concat([{ name: 'Diğer kalemler', color: '#8a8f98', values: ay.map(function (a) { return sum(a.a, function (q) { return K.indexOf(q.r.kategori) >= 3 || K.indexOf(q.r.kategori) < 0 ? q.tutar : 0; }); }) }]), xlsx: false });
      B.push(T({ cols: [col(dl.sutun)].concat(K.map(function (k) { return col(k, 'tlz'); }), [col('Toplam', 'tl'), col('Kalem', 'int')]),
        rows: ay.map(function (a) { return [a.d.uzun].concat(K.map(function (k) { return sum(a.a, function (q) { return q.r.kategori === k ? q.tutar : 0; }); }), [a.t, a.a.length]); }),
        tot: ['Toplam'].concat(K.map(function (k) { return sum(rows, function (q) { return q.r.kategori === k ? q.tutar : 0; }); }), [top, rows.length]) }));
    }
    // harcama türü ve ulaşım türü
    var turAd = HR.TURLER.map(function (t) { return t[0]; });
    rows.forEach(function (q) { if (turAd.indexOf(q.r.detay) < 0) turAd.push(q.r.detay); });
    var turler = turAd.map(function (ad) { var a = rows.filter(function (q) { return q.r.detay === ad; }); var t0 = HR.tur(ad); return [ad, t0 ? t0[1] : (a[0] && a[0].r.kategori) || '', a.length, sum(a, function (q) { return q.tutar; })]; }).filter(function (r) { return r[2]; });
    B.push(H('Harcama türü ve ulaşım'));
    B.push(T({ title: 'Harcama türüne göre', cols: [col('Harcama türü'), col('Kategori'), col('Kalem', 'int'), col('Tutar', 'tl'), col('Ortalama', 'tl'), col('Pay', 'pct')],
      rows: turler.map(function (r) { return [r[0], r[1], r[2], r[3], div(r[3], r[2]), div(r[3], top)]; }), tot: ['Toplam', '', rows.length, top, div(top, rows.length), top ? 1 : null] }));
    var ul = HR.ULASIM.map(function (u) { var a = rows.filter(function (q) { return q.r.ulasim === u; }); return [u, a.length, sum(a, function (q) { return q.tutar; })]; }).filter(function (r) { return r[1]; });
    var ulT = sum(ul, function (r) { return r[2]; }), ulN = sum(ul, function (r) { return r[1]; });
    B.push(T({ title: 'Ulaşım türüne göre', cols: [col('Ulaşım türü'), col('Bilet / fiş', 'int'), col('Tutar', 'tl'), col('Ortalama', 'tl'), col('Pay', 'pct')],
      rows: ul.map(function (r) { return [r[0], r[1], r[2], div(r[2], r[1]), div(r[2], ulT)]; }), tot: ['Toplam', ulN, ulT, div(ulT, ulN), ulT ? 1 : null], empty: 'Ulaşım harcaması yok' }));
    // şehir içi / dışı ve iller
    var kon = ['Şehir İçi', 'Şehir Dışı', 'Eşleşmedi'].map(function (k) {
      var a = rows.filter(function (q) { return q.konum === k; }), dn = {}; a.forEach(function (q) { if (q.x) dn[q.x.d.id] = 1; }); var nd = Object.keys(dn).length, t2 = sum(a, function (q) { return q.tutar; });
      return [k === 'Eşleşmedi' ? 'Donörle eşleşmeyen' : k, nd, a.length, t2, div(t2, nd), div(t2, top)];
    }).filter(function (r) { return r[2]; });
    var il = {}; rows.forEach(function (q) { if (!q.x) return; var k = q.x.h.il || '(boş)'; var r = il[k] || (il[k] = { ad: k, dn: {}, t: 0, n: 0 }); r.dn[q.x.d.id] = 1; r.t += q.tutar; r.n++; });
    var iller = Object.keys(il).map(function (k) { var r = il[k]; var nd = Object.keys(r.dn).length; return [r.ad, nd, r.n, r.t, div(r.t, nd)]; }).sort(function (a, b) { return b[3] - a[3]; });
    B.push(H('Şehir içi / şehir dışı ve iller', 'ikamet ili Ankara olan donör şehir içi sayılır'));
    B.push(T({ cols: [col('Konum'), col('Donör', 'int'), col('Kalem', 'int'), col('Tutar', 'tl'), col('Donör başı', 'tl'), col('Pay', 'pct')], rows: kon }));
    var ilCols = [col('İl'), col('Donör', 'int'), col('Tutar', 'tl'), col('Donör başı', 'tl')], ilRow = function (r) { return [r[0], r[1], r[3], r[4]]; };
    var ilKisa = iller.slice(0, 15).map(ilRow);
    if (iller.length > 16) { var kalan = iller.slice(15), kd = sum(kalan, function (r) { return r[1]; }), kt = sum(kalan, function (r) { return r[3]; }); ilKisa.push({ v: ['Diğer ' + kalan.length + ' il', kd, kt, div(kt, kd)], muted: true }); }
    else ilKisa = iller.map(ilRow);
    B.push(ROW(T({ title: 'İllere göre', cols: ilCols, rows: ilKisa, xlsx: false }),
      { type: 'hbars', title: 'En çok harcama yapılan iller', rows: iller.slice(0, 12).map(function (r) { return [r[0], r[3]]; }), f: 'tl0', color: '#A3262A', xlsx: false }));
    B.push(T({ title: 'İllere göre', cols: ilCols, rows: iller.map(ilRow), pdf: false, html: false }));
    // donör bazında
    B.push(H('Donör bazında', dlist.length + ' donör · tutara göre'));
    B.push(T({ cols: [col('#', 'int', { a: 'r' }), col('Ad soyad'), col('Hasta kodu'), col('İl')].concat(K.map(function (k) { return col(k === 'Akaryakıt / Otopark' ? 'Akaryakıt / otopark' : k, 'tlz'); }), [col('Toplam', 'tl'), col('Kalem', 'int')]),
      rows: dlist.map(function (d, i) { return [i + 1, d.ad, d.x ? d.x.d.hk : 'eşleşmedi', d.x ? d.x.h.il : ''].concat(K.map(function (k) { return d.kat[k] || 0; }), [d.toplam, d.n]); }),
      tot: ['', 'Toplam', '', ''].concat(K.map(function (k) { return sum(rows, function (q) { return q.r.kategori === k ? q.tutar : 0; }); }), [top, rows.length]), xlsx: false, uzun: true, empty: 'Bu dönemde harcama yok' }));
    B.push(T({ sheet: 'Donör bazında', cols: [col('Ad soyad'), col('Hasta kodu'), col('Donör no'), col('İkamet'), col('İl'), col('Konum'), col('Hastane'), col('Yöntem'), col('Durum grubu'), col('Refakatçi'), col('Konaklama gece', 'intz')]
      .concat(K.map(function (k) { return col(k + ' (₺)', 'tl'); }), [col('Toplam (₺)', 'tl'), col('Kalem', 'int')]),
      xw: [24, 12, 18, 22, 14, 11, 18, 12, 18, 10, 10, 14, 14, 14, 14, 14, 15, 8],
      rows: dlist.map(function (d) { var x = d.x, dd = x ? x.d : {}; return [d.ad, x ? dd.hk : 'EŞLEŞMEDİ', dd.dno, dd.ikamet, x ? x.h.il : '', x ? x.h.konum : '', dd.hastane, dd.yontem, x ? x.h.grup : '', d.rf, d.gece].concat(K.map(function (k) { return d.kat[k] || 0; }), [d.toplam, d.n]); }),
      tot: ['Toplam', '', '', '', '', '', '', '', '', '', sum(dlist, function (d) { return d.gece; })].concat(K.map(function (k) { return sum(rows, function (q) { return q.r.kategori === k ? q.tutar : 0; }); }), [top, rows.length]), pdf: false, html: false }));
    // yemek kartı (harcama toplamına dahil değil)
    yemekBolumu(c, o, B, top);
    // harcama satırları
    var det = rows.slice().sort(function (a, b) { return (a.r.tarih || 0) - (b.r.tarih || 0); });
    B.push(Object.assign(H('Harcama satırları', det.length + ' kalem · tarihe göre'), { pdf: o.ayrinti, xlsx: false }));
    B.push(T({ sheet: 'Harcama satırları', cols: [col('Tarih', 'date', { a: 'c' }), col('Donör'), col('Hasta kodu'), col('Harcama türü'), col('Kategori'), col('Ulaşım'), col('Refakatçi'), col('Gece', 'intz'), col('Not', 'txt', { wrap: 2 }), col('Tutar', 'tl')],
      xw: [11, 24, 12, 16, 18, 11, 10, 7, 34, 13],
      rows: det.map(function (q) { var r = q.r; return [r.tarih, q.x ? q.x.d.ad : r.ad, q.x ? q.x.d.hk : 'EŞLEŞMEDİ', r.detay, r.kategori, r.ulasim, r.refakatci, r.gece, r.not, q.tutar]; }),
      tot: ['', 'Toplam', '', '', '', '', '', '', '', top], pdf: o.ayrinti, uzun: true, empty: 'Bu dönemde harcama yok' }));
    var info = [];
    if (tarihsiz) info.push(tarihsiz + ' harcama satırının tarihi olmadığı için rapora girmedi.');
    return { landscape: false, info: info, blocks: B, ayrinti: { ad: 'Harcama satırları', n: det.length }, ozet: 'Toplam ' + fmt(top, 'tl') + ' · ' + rows.length + ' kalem · ' + eslesen.length + ' donör',
      not: 'Tutarlar harcama satırlarının tarihine göre döneme yazılır. Kategori ve ulaşım türü harcama türünden gelir.' };
  }
  function kapsamHarcama(rows, c) {
    var mn = null, mx = null; rows.forEach(function (q) { var s = q.r.tarih; if (s == null) return; if (mn == null || s < mn) mn = s; if (mx == null || s > mx) mx = s; });
    if (mn == null) mn = mx = c.today;
    return { from: DT.serial(DT.year(mn), DT.month(mn), 1), to: DT.serial(DT.year(mx), DT.month(mx) + 1, 1) - 1 };
  }

  /* ================= 3 · İŞ YÜKÜ VE TAŞIMA ================= */
  var TUR_KISA = { 'Sağlık muayenesi': 'Sağlık k.', 'Aşı': 'Aşı', 'Toplama': 'Toplama', 'Ek test / izlem / diğer bağışçı işi': 'Ek iş / izlem', 'Transfer': 'Transfer',
    'Ürün taşıma – şehir içi': 'Taşıma içi', 'Ürün taşıma – şehir dışı': 'Taşıma dışı', 'Bağışçı kazanımı (saha)': 'Kazanım', 'Kargo / numune gönderimi': 'Kargo',
    'Ofis / lab / koordinasyon': 'Ofis / lab', 'Eğitim / sınav / diğer': 'Eğitim / diğer' };
  var GRUPLAR = ['Bağışçı takibi', 'Transfer', 'Ürün taşıma', 'Bağışçı kazanımı', 'Ofis / lab / koordinasyon', 'Kargo, eğitim ve diğer'];
  var PERS_RENK = ['#2F6FB0', '#1E6B3A', '#8A6D0B', '#5B3A8C', '#A3262A', '#0f766e', '#c2410c', '#475569'];
  function isYukuRaporu(c, o) {
    var R = DT.isYuku(c.state, c.D, c.pool, o.from, o.to), TS = DT.tasimaStats(c.state, c.D, c.pool, o.from, o.to);
    var turler = (c.state.lists.isTuru || DT.IS_TURU).filter(function (t) { return t !== 'İzin'; });
    var rows = R.rows, toplam = sum(rows, function (r) { return r.toplam; }), aktif = rows.filter(function (r) { return r.toplam > 0 && r.ad !== 'Diğer / listede yok'; });
    var tot = TS.rows.reduce(function (a, r) { return [a[0] + r.ic, a[1] + r.dis, a[2] + r.bizzat, a[3] + r.kurye, a[4] + r.toplam, a[5] + r.benzersiz]; }, [0, 0, 0, 0, 0, 0]);
    var B = [];
    B.push({ type: 'kpis', items: [
      { v: toplam, f: 'int', l: 'Toplam görev', c: NAVY }, { v: aktif.length, f: 'int', l: 'Görev alan personel', c: '#2F6FB0' },
      { v: div(sum(aktif, function (r) { return r.toplam; }), aktif.length), f: 'dec1', l: 'Personel başına görev', c: '#D99A2B' },
      { v: sum(rows, function (r) { return r.gunN; }), f: 'int', l: 'Görevli gün (personel toplamı)', c: '#5B3A8C' },
      { v: tot[4], f: 'int', l: 'Ürün taşıma', c: '#1E6B3A' }, { v: tot[1], f: 'int', l: 'Şehir dışı taşıma', c: '#A3262A' }] });
    B.push(H('Personel iş yükü'));
    B.push(ROW(T({ cols: [col('Personel'), col('Toplam', 'int'), col('Arşivden', 'intz'), col('Programdan', 'intz'), col('Görevli gün', 'intz'), col('Hafta sonu', 'intz'), col('İzin günü', 'intz')],
      rows: rows.map(function (r) { return [r.ad, r.toplam, r.kayit, r.canli, r.gunN, r.hsonuN, r.izinN]; }),
      tot: ['Toplam', toplam, sum(rows, function (r) { return r.kayit; }), sum(rows, function (r) { return r.canli; }), sum(rows, function (r) { return r.gunN; }), sum(rows, function (r) { return r.hsonuN; }), sum(rows, function (r) { return r.izinN; })],
      note: 'Arşivden: Görev Kayıtları (kapatılan haftalar ve Excel’den gelen kayıtlar). Programdan: kapatılmamış haftalardaki görevler; bugünden sonrası plandır.' }),
    { type: 'hbars', rows: rows.filter(function (r) { return r.toplam; }).map(function (r, i) { return [r.ad, r.toplam, PERS_RENK[i % PERS_RENK.length]]; }), f: 'int', xlsx: false }));
    B.push(T({ title: 'Görev türüne göre', cols: [col('Personel')].concat(turler.map(function (t) { return col(TUR_KISA[t] || t, 'intz'); }), [col('Toplam', 'int')]),
      rows: rows.map(function (r) { return [r.ad].concat(turler.map(function (t) { return r.tur[t] || 0; }), [r.toplam]); }),
      tot: ['Toplam'].concat(turler.map(function (t) { return sum(rows, function (r) { return r.tur[t] || 0; }); }), [toplam]) }));
    var named = rows.filter(function (r) { return r.toplam; });
    B.push(H('Ana görev grupları'));
    if (named.length) B.push({ type: 'bars', labels: named.map(function (r) { return r.ad; }), f: 'int', series: GRUPLAR.slice(0, 3).map(function (g, i) { return { name: g, color: ['#2F6FB0', '#1E6B3A', '#8A6D0B'][i], values: named.map(function (r) { return r.ana[g] || 0; }) }; }), xlsx: false });
    B.push(T({ cols: [col('Personel')].concat(GRUPLAR.map(function (g) { return col(g, 'intz'); })), rows: rows.map(function (r) { return [r.ad].concat(GRUPLAR.map(function (g) { return r.ana[g] || 0; })); }),
      tot: ['Toplam'].concat(GRUPLAR.map(function (g) { return sum(rows, function (r) { return r.ana[g] || 0; }); })) }));
    var dl = dilimler(o.from, o.to);
    if (dl.length > 1 && dl.length <= 24) {
      var byP = {}, order = [];
      R.recs.forEach(function (rec) { if (rec.tur === 'İzin') return; var n = DT.inPersonel(c.state.lists, rec.personel) || 'Diğer / listede yok'; if (!byP[n]) { byP[n] = dl.map(function () { return 0; }); order.push(n); } for (var i = 0; i < dl.length; i++) if (icinde(rec.tarih, dl[i])) { byP[n][i]++; break; } });
      var pl = c.state.lists.personel.filter(function (p) { return byP[p]; }).concat(order.filter(function (p) { return c.state.lists.personel.indexOf(p) < 0; }));
      B.push(T({ title: dl.baslik + ' görev sayısı', cols: [col('Personel')].concat(dl.map(function (d) { return col(d.ad, 'intz'); }), [col('Toplam', 'int')]),
        rows: pl.map(function (p) { return [p].concat(byP[p], [sum(byP[p])]); }), tot: ['Toplam'].concat(dl.map(function (d, i) { return sum(pl, function (p) { return byP[p][i]; }); }), [sum(pl, function (p) { return sum(byP[p]); })]) }));
    }
    // taşıma
    B.push(H('Ürün taşıma', TS.n + ' taşıma · yurt dışı hariç'));
    B.push({ type: 'kpis', items: [{ v: tot[0], f: 'int', l: 'Şehir içi', c: '#1E6B3A' }, { v: tot[1], f: 'int', l: 'Şehir dışı', c: '#A3262A' }, { v: tot[2], f: 'int', l: 'Bizzat gitti', c: '#2F6FB0' },
      { v: tot[3], f: 'int', l: 'Kurye karşılama / teslim', c: '#D99A2B' }], per: 4 });
    var sehir = TS.sehirler;
    B.push(ROW(T({ title: 'Personel başına', cols: [col('Personel'), col('Şehir içi', 'intz'), col('Şehir dışı', 'intz'), col('Bizzat', 'intz'), col('Kurye', 'intz'), col('Toplam', 'int'), col('Benzersiz', 'intz')],
      rows: TS.rows.map(function (r) { return [r.ad, r.ic, r.dis, r.bizzat, r.kurye, r.toplam, r.benzersiz]; }), tot: ['Toplam', tot[0], tot[1], tot[2], tot[3], tot[4], tot[5]],
      note: 'Şehir dışında açıklamada “kurye” geçiyorsa kurye karşılama / teslim sayılır.' })));
    B.push(ROW(T({ title: 'Karşı şehir (şehir dışı)', cols: [col('Şehir'), col('Taşıma', 'int')], rows: sehir.map(function (s) { return [s.ad, s.n]; }), empty: 'Şehir dışı taşıma yok' }),
      { type: 'hbars', title: 'Şehirler', rows: sehir.slice(0, 10).map(function (s) { return [s.ad, s.n]; }), f: 'int', color: '#1E6B3A', xlsx: false }));
    // görev kayıtları
    var recs = R.recs.slice().sort(function (a, b) { return a.tarih - b.tarih || S(a.personel).localeCompare(S(b.personel), 'tr'); });
    var kay = function (r) { return r.canli ? 'Program' : S(r.kaynak) || 'Arşiv'; };
    B.push(Object.assign(H('Görev kayıtları', recs.length + ' kayıt'), { pdf: o.ayrinti, xlsx: false }));
    B.push(T({ sheet: 'Görev kayıtları', cols: [col('Tarih', 'date', { a: 'c' }), col('Personel'), col('Görev türü'), col('Açıklama', 'txt', { wrap: 2 }), col('Kaynak')], xw: [11, 16, 30, 70, 12],
      rows: recs.map(function (r) { return [r.tarih, r.personel, r.tur, r.aciklama, kay(r)]; }), pdf: o.ayrinti, uzun: true, empty: 'Bu dönemde görev yok' }));
    return { landscape: true, info: [], blocks: B, ayrinti: { ad: 'Görev kayıtları', n: recs.length }, ozet: toplam + ' görev · ' + aktif.length + ' personel · ' + tot[4] + ' ürün taşıma',
      not: 'Görevler Görev Kayıtları’ndan ve kapatılmamış haftalarda programdan sayılır (yurt dışı ürün taşıma hariç).' };
  }

  /* ================= 5 · YEMEK KARTI ================= */
  function ykSatirlar(c, o) {
    return (c.yrows || []).filter(function (q) { return o.tumu || (q.r.tarih >= o.from && q.r.tarih <= o.to); });
  }
  function ykAsamaTablosu(rows, top) {
    var YK = root.YK, dn = function (a) { var m = {}; a.forEach(function (q) { m[q.x ? q.x.d.id : 'e:' + q.r.ad] = 1; }); return Object.keys(m).length; };
    var r = YK.ASAMA.map(function (a) { var b = rows.filter(function (q) { return q.asama === a; }), t = sum(b, function (q) { return q.tutar; }), n = dn(b); return [a, b.length, n, t, div(t, n), div(t, top)]; });
    return T({ cols: [col('Aşama'), col('Yükleme', 'int'), col('Donör', 'int'), col('Tutar', 'tl'), col('Donör başı', 'tl'), col('Pay', 'pct')], rows: r,
      tot: ['Toplam', rows.length, dn(rows), top, div(top, dn(rows)), top ? 1 : null] });
  }
  function ykDonorler(rows) {
    var m = {}, out = [];
    rows.forEach(function (q) {
      var k = q.x ? q.x.d.id : 'e:' + q.r.ad, d = m[k];
      if (!d) { d = m[k] = { x: q.x, ad: q.x ? q.x.d.ad : q.r.ad, tarih: [], t: 0, n: 0, asama: {} }; out.push(d); }
      d.t += q.tutar; d.n++; d.asama[q.asama] = (d.asama[q.asama] || 0) + q.tutar;
      var g = DT.fmtShort(q.r.tarih); if (d.tarih.indexOf(g) < 0) d.tarih.push(g);
    });
    return out;
  }
  function yemekBolumu(c, o, B, hTop) {
    var rows = ykSatirlar(c, o);
    if (!rows.length) return;
    var top = sum(rows, function (q) { return q.tutar; });
    B.push(H('Yemek kartı yüklemeleri', fmt(top, 'tl') + ' · ' + rows.length + ' yükleme'));
    B.push(ykAsamaTablosu(rows, top));
    B.push(NOTE('Yemek kartı yüklemeleri harcama toplamına dahil değildir. Harcama ve yemek kartı birlikte: ' + fmt(hTop + top, 'tl') + '.'));
  }
  function yemekRaporu(c, o) {
    var YK = root.YK, rows = ykSatirlar(c, o).slice().sort(function (a, b) { return a.r.tarih - b.r.tarih || S(a.r.saat).localeCompare(S(b.r.saat)); });
    var top = sum(rows, function (q) { return q.tutar; }), iade = rows.filter(function (q) { return q.tutar < 0; }), es = rows.filter(function (q) { return !q.x; });
    var dl = ykDonorler(rows), eslesen = dl.filter(function (d) { return d.x; });
    var B = [];
    B.push({ type: 'kpis', items: [
      { v: top, f: 'tl', l: 'Toplam yükleme', c: '#A3262A' }, { v: rows.length, f: 'int', l: 'Yükleme', c: NAVY },
      { v: dl.length, f: 'int', l: 'Donör', c: '#2F6FB0' }, { v: div(top, dl.length), f: 'tl', l: 'Donör başı ortalama', c: '#D99A2B' },
      { v: sum(iade, function (q) { return q.tutar; }), f: 'tl', l: 'İade / geri çekim (' + iade.length + ')', c: '#8a8f98' }, { v: es.length, f: 'int', l: 'Donörü bulunamayan yükleme', c: '#5B3A8C' }] });
    B.push(H('Aşamalara göre', 'yükleme tarihi donörün sağlık kontrolü, aşı ve toplama tarihlerine göre'));
    B.push(ROW(ykAsamaTablosu(rows, top), { type: 'hbars', rows: YK.ASAMA.map(function (a) { return [a, sum(rows, function (q) { return q.asama === a ? q.tutar : 0; }), YK.RENK[a]]; }), f: 'tl0', xlsx: false }));
    if (rows.length) {
      var d0 = dilimler(o.tumu ? rows[0].r.tarih : o.from, o.tumu ? rows[rows.length - 1].r.tarih : o.to);
      var ay = d0.map(function (d) { var a = rows.filter(function (q) { return icinde(q.r.tarih, d); }); return { d: d, a: a }; });
      B.push(H(d0.baslik));
      if (d0.length > 1) B.push({ type: 'bars', labels: ay.map(function (a) { return a.d.ad; }), f: 'tl', xlsx: false,
        series: YK.ASAMA.map(function (a) { return { name: a, color: YK.RENK[a], values: ay.map(function (z) { return sum(z.a, function (q) { return q.asama === a ? q.tutar : 0; }); }) }; }) });
      B.push(T({ cols: [col(d0.sutun)].concat(YK.ASAMA.map(function (a) { return col(a, 'tlz'); }), [col('Toplam', 'tl'), col('Yükleme', 'int')]),
        rows: ay.map(function (z) { return [z.d.uzun].concat(YK.ASAMA.map(function (a) { return sum(z.a, function (q) { return q.asama === a ? q.tutar : 0; }); }), [sum(z.a, function (q) { return q.tutar; }), z.a.length]); }),
        tot: ['Toplam'].concat(YK.ASAMA.map(function (a) { return sum(rows, function (q) { return q.asama === a ? q.tutar : 0; }); }), [top, rows.length]) }));
    }
    // her aşama için donörler (alt başlıklar)
    YK.ASAMA.forEach(function (a) {
      var b = rows.filter(function (q) { return q.asama === a; });
      if (!b.length) return;
      var dd = ykDonorler(b).sort(function (p, q) { return q.t - p.t; }), t = sum(b, function (q) { return q.tutar; });
      B.push(H(a, fmt(t, 'tl') + ' · ' + dd.length + ' donör · ' + b.length + ' yükleme'));
      B.push(T({ cols: [col('Ad soyad'), col('Hasta kodu'), col('Süreç'), col('Yükleme günleri', 'txt', { wrap: 2 }), col('Yükleme', 'int'), col('Tutar', 'tl')],
        rows: dd.map(function (d) { var q0 = b.filter(function (q) { return (q.x ? q.x.d.id : 'e:' + q.r.ad) === (d.x ? d.x.d.id : 'e:' + d.ad); })[0]; return { v: [d.ad, d.x ? d.x.d.hk : 'bulunamadı', q0 ? q0.sebep : '', d.tarih.join(', '), d.n, d.t], muted: !d.x }; }),
        tot: ['Toplam', '', '', '', b.length, t] }));
    });
    // donör bazında (Excel) ve yüklemeler
    B.push(T({ sheet: 'Donör bazında', cols: [col('Ad soyad'), col('Hasta kodu'), col('Donör no'), col('Hastane'), col('Yöntem'), col('Sağlık kontrolü', 'date'), col('Toplama', 'date')]
      .concat(YK.ASAMA.map(function (a) { return col(a, 'tl'); }), [col('Toplam', 'tl'), col('Yükleme', 'int')]), xw: [24, 12, 18, 18, 12, 12, 12, 14, 14, 14, 12, 14, 9],
      rows: dl.sort(function (p, q) { return q.t - p.t; }).map(function (d) { var x = d.x, dd = x ? x.d : {}; return [d.ad, x ? dd.hk : 'BULUNAMADI', dd.dno, dd.hastane, dd.yontem, dd.sk, dd.top].concat(YK.ASAMA.map(function (a) { return d.asama[a] || 0; }), [d.t, d.n]); }),
      tot: ['Toplam', '', '', '', '', '', ''].concat(YK.ASAMA.map(function (a) { return sum(rows, function (q) { return q.asama === a ? q.tutar : 0; }); }), [top, rows.length]), pdf: false, html: false }));
    B.push(Object.assign(H('Yüklemeler', rows.length + ' yükleme · tarihe göre'), { pdf: o.ayrinti, xlsx: false }));
    B.push(T({ sheet: 'Yüklemeler', cols: [col('Tarih', 'date', { a: 'c' }), col('Saat', 'txt', { a: 'c' }), col('Ad soyad'), col('Hasta kodu'), col('Aşama'), col('Açıklama', 'txt', { wrap: 2 }), col('Tutar', 'tl')],
      xw: [11, 7, 24, 12, 16, 70, 12],
      rows: rows.map(function (q) { var r = q.r; return { v: [r.tarih, r.saat, q.x ? q.x.d.ad : r.ad, q.x ? q.x.d.hk : 'bulunamadı', q.asama, r.aciklama || r.aciklama2, q.tutar], muted: q.tutar < 0 }; }),
      tot: ['', '', 'Toplam', '', '', '', top], pdf: o.ayrinti, uzun: true, empty: 'Bu dönemde yemek kartı yüklemesi yok' }));
    return { landscape: false, info: [], blocks: B, ayrinti: { ad: 'Yüklemeler', n: rows.length },
      ozet: 'Toplam ' + fmt(top, 'tl') + ' · ' + rows.length + ' yükleme · ' + dl.length + ' donör · ' + YK.ASAMA.map(function (a) { return a + ' ' + fmt(sum(rows, function (q) { return q.asama === a ? q.tutar : 0; }), 'tl0'); }).join(' · '),
      not: 'Aşama, yükleme tarihinin donörün tarihlerine göre bulunur: sağlık kontrolünden 3 gün önce – 2 gün sonra “Sağlık kontrolü”; aşı başlangıcından (kemik iliğinde toplamadan) 3 gün önce – toplamadan 3 gün sonra toplama dönemi. Toplama döneminde aşı günlerinde yükleme varsa “Aşı + toplama”, yalnızca toplama günlerinde ise “Toplama süreci”. Uymayanlar “Diğer”dir; aşama yükleme listesinden elle değiştirilebilir.' };
  }

  /* ================= 4 · DASHBOARD ÖZETİ ================= */
  function ozetRaporu(c, o) {
    var t = c.today, R = DT.dashboard(c.state, c.D, c.pool, { today: t, from: o.from, to: o.to, esik: c.state.settings.esik });
    var IY = DT.isYuku(c.state, c.D, c.pool, o.from, o.to), TS = DT.tasimaStats(c.state, c.D, c.pool, o.from, o.to);
    var hr = c.hrows.filter(function (q) { return o.tumu || (q.r.tarih != null && q.r.tarih >= o.from && q.r.tarih <= o.to); });
    var htop = sum(hr, function (q) { return q.tutar; }), gorev = sum(IY.rows, function (r) { return r.toplam; });
    var B = [];
    B.push({ type: 'kpis', items: [
      { v: R.kayitli, f: 'int', l: 'Kayıtlı donör', c: NAVY }, { v: R.skYap, f: 'int', l: 'Sağlık kontrolü yapılan', c: '#2F6FB0' },
      { v: R.topGer, f: 'int', l: 'Toplama gerçekleşen', c: '#15803d' }, { v: R.topPlan, f: 'int', l: 'Planlanan toplama', c: '#86c79c' },
      { v: R.durdu, f: 'int', l: 'Süreç durdu', c: '#8a8f98' }, { v: R.oran, f: 'pct', l: 'Gerçekleşme oranı', c: '#D99A2B' },
      { v: gorev, f: 'int', l: 'Personel görevi', c: '#5B3A8C' }, { v: htop, f: 'tl0', l: 'Donör harcaması', c: '#A3262A' }] });
    var dl = dilimler(o.from, o.to), D = c.D;
    var cnt = function (fn) { var n = 0; D.forEach(function (x) { if (fn(x)) n++; }); return n; };
    var ay = dl.map(function (d) {
      return { d: d, sk: cnt(function (x) { return x.d.sk != null && !x.skYapilmadi && icinde(x.d.sk, d); }),
        ger: cnt(function (x) { return x.d.top != null && !x.stopped && x.d.top <= t && icinde(x.d.top, d); }),
        plan: cnt(function (x) { return x.d.top != null && !x.stopped && x.d.top > t && icinde(x.d.top, d); }) };
    });
    B.push(H(dl.baslik, 'sağlık kontrolü ve toplama'));
    if (dl.length > 1) B.push({ type: 'bars', labels: ay.map(function (a) { return a.d.ad; }), f: 'int', h: 110, series: [
      { name: 'Sağlık kontrolü', color: '#2F6FB0', values: ay.map(function (a) { return a.sk; }) },
      { name: 'Toplama gerçekleşen', color: '#15803d', values: ay.map(function (a) { return a.ger; }) },
      { name: 'Planlanan toplama', color: '#86c79c', values: ay.map(function (a) { return a.plan; }) }], xlsx: false });
    B.push(Object.assign(T({ title: dl.baslik, cols: [col(dl.sutun), col('Sağlık kontrolü', 'int'), col('Toplama gerçekleşen', 'int'), col('Planlanan toplama', 'int')],
      rows: ay.map(function (a) { return [a.d.uzun, a.sk, a.ger, a.plan]; }) }), { pdf: dl.length === 1, html: dl.length === 1 }));
    B.push(H('Toplama ve süreç'));
    B.push(ROW(T({ title: 'Toplama gerçekleşme', cols: [col('Durum'), col('Donör', 'int')], rows: [['Gerçekleşen', R.topGer], ['Planlanan', R.topPlan], ['İptal · hasta ex', R.iptal], ['Erteleme', R.ertele], ['Red', R.red], ['Vazgeçme', R.vazgec]],
      tot: ['Gerçekleşme oranı', R.oran == null ? '–' : fmt(R.oran, 'pct')] }),
    T({ title: 'Şehir içi / şehir dışı', cols: [col('İkamet'), col('Sağlık kontrolü', 'int'), col('Toplama', 'int')], rows: [['Ankara içi', R.skAnk, R.topAnk], ['Ankara dışı', R.skDis, R.topDis]],
      note: 'İkametinde “Ankara” geçen donör şehir içi sayılır.' })));
    var nt = sum(R.nedenler, function (n) { return n.n; }), nk = R.nakil;
    B.push(ROW(T({ title: 'Süreç durma nedenleri', cols: [col('Neden'), col('Donör', 'int'), col('Pay', 'pct')], rows: R.nedenler.filter(function (n) { return n.n; }).map(function (n) { return [n.ad, n.n, div(n.n, nt)]; }), tot: ['Toplam', nt, nt ? 1 : null], empty: 'Süreci duran donör yok' }),
      T({ title: 'Nakil merkezi', cols: [col('Nakil merkezi'), col('Gerçekleşen', 'int'), col('Planlanan', 'int')], rows: [['Yurt içi', nk.yiGer, nk.yiPlan], ['Yurt dışı', nk.ydGer, nk.ydPlan], ['Girilmemiş', nk.yokGer, nk.yokPlan]].filter(function (r) { return r[1] || r[2]; }),
        note: R.ulkeler.length ? 'Yurt dışı: ' + R.ulkeler.map(function (u) { return u.ad + ' ' + u.n; }).join(', ') : '' })));
    B.push(H('Hastane ve yöntem'));
    var hs = R.hastane.filter(function (r) { return r.sk || r.top; }), sure = {}; R.sureHastane.forEach(function (s) { sure[s.ad] = s; });
    B.push(T({ cols: [col('Hastane'), col('Sağlık k. yapılan', 'intz'), col('Toplama gerç.', 'intz'), col('Ort. süreç (gün)', 'dec1'), col('En kısa', 'int'), col('En uzun', 'int')],
      rows: hs.map(function (r) { var s = sure[r.ad] || {}; return [r.ad, r.sk, r.top, s.ort, s.min, s.max]; }), tot: ['Toplam', R.skYap, R.topGer, R.sureTum.ort, R.sureTum.min, R.sureTum.max],
      note: 'Süreç süresi: sağlık kontrolünden toplamaya geçen gün. ' + R.esikAsan + ' süreç ' + R.esik + ' günü aştı.' }));
    var yon = R.yontem.filter(function (r) { return r.n; });
    B.push(ROW(T({ title: 'Yöntem', cols: [col('Yöntem'), col('Donör', 'int')], rows: yon.map(function (r) { return [r.ad, r.n]; }) }),
      { type: 'hbars', title: 'Yönteme göre donör', rows: yon.map(function (r, i) { return [r.ad, r.n, PERS_RENK[i % PERS_RENK.length]]; }), f: 'int', xlsx: false }));
    // personel
    var tsBy = {}; TS.rows.forEach(function (r) { tsBy[r.ad] = r; });
    var pr = IY.rows.map(function (r) { var s = tsBy[r.ad] || {}; return [r.ad, r.toplam, r.tur['Sağlık muayenesi'] || 0, r.tur['Aşı'] || 0, r.tur['Toplama'] || 0, s.toplam || 0, r.gunN]; });
    TS.rows.forEach(function (r) { if (!IY.rows.some(function (q) { return q.ad === r.ad; })) pr.push([r.ad, 0, 0, 0, 0, r.toplam, 0]); });
    B.push(H('Personel', gorev + ' görev · ' + TS.n + ' ürün taşıma'));
    B.push(T({ cols: [col('Personel'), col('Görev', 'int'), col('Sağlık kontrolü', 'intz'), col('Aşı', 'intz'), col('Toplama', 'intz'), col('Ürün taşıma', 'intz'), col('Görevli gün', 'intz')], rows: pr.filter(function (r) { return r[1] || r[5]; }),
      tot: ['Toplam', gorev, sum(pr, function (r) { return r[2]; }), sum(pr, function (r) { return r[3]; }), sum(pr, function (r) { return r[4]; }), TS.n, sum(pr, function (r) { return r[6]; })] }));
    // harcama
    var K = HR.KATEGORI, kat = K.map(function (k, i) { return [k, sum(hr, function (q) { return q.r.kategori === k ? q.tutar : 0; }), KAT_RENK[i]]; });
    var dn = {}; hr.forEach(function (q) { if (q.x) dn[q.x.d.id] = 1; }); var nd = Object.keys(dn).length;
    B.push(H('Donör harcaması', fmt(htop, 'tl') + ' · ' + hr.length + ' kalem · ' + nd + ' donör'));
    var kon = ['Şehir İçi', 'Şehir Dışı'].map(function (k) { var a = hr.filter(function (q) { return q.konum === k; }), d2 = {}; a.forEach(function (q) { d2[q.x.d.id] = 1; }); var tt = sum(a, function (q) { return q.tutar; }); return [k, Object.keys(d2).length, tt, div(tt, Object.keys(d2).length)]; });
    B.push(ROW(T({ title: 'Kategoriye göre', cols: [col('Kategori'), col('Tutar', 'tl'), col('Pay', 'pct')], rows: kat.map(function (r) { return [r[0], r[1], div(r[1], htop)]; }), tot: ['Toplam', htop, htop ? 1 : null] }),
      T({ title: 'Şehir içi / dışı', cols: [col('Konum'), col('Donör', 'int'), col('Tutar', 'tl'), col('Donör başı', 'tl')], rows: kon, tot: ['Toplam', nd, htop, div(htop, nd)] })));
    yemekBolumu(c, o, B, htop);
    return { landscape: false, info: [], blocks: B,
      ozet: R.topGer + ' toplama gerçekleşti · ' + R.topPlan + ' planlı · ' + R.durdu + ' süreç durdu · ' + gorev + ' görev · harcama ' + fmt(htop, 'tl0'),
      not: 'Sayılar sağlık kontrolü ve toplama tarihine göre döneme yazılır. Süreç durdu: açıklamasında iptal, erteleme, red, vazgeç ya da hasta ex geçen donörler (toplama sayılarına dahil değildir).' };
  }

  /* ================= 6 · PERSONEL MESAİ ================= */
  // süreler dakika tutulur, raporda saat (iki ondalık) yazılır
  var sa = function (min) { return min == null ? null : Math.round(min / 60 * 100) / 100; };
  function mesaiRaporu(c, o) {
    var MS = root.MS, ctx = MS.ctx(c.state, c.today), m = ctx.m;
    var R = MS.donem(ctx, o.from, o.to, { gunler: true }), Tt = MS.toplam(R), e = R.etkin, G = MS.gorevOzet(ctx, o.from, o.to);
    var B = [], info = [];
    if (e && (e.from !== o.from || e.to !== o.to)) info.push('Hesaplanan günler: ' + DT.fmt(e.from) + ' – ' + DT.fmt(e.to) + ' (takip başlangıcı ve bugünle sınırlı)');
    if (!e) info.push('Bu dönemde hesaplanacak gün yok: takip başlangıcından önce ya da ileri tarihli.');
    B.push({ type: 'kpis', items: [
      { v: sa(Tt.fazla), f: 'sa', l: 'Fazla mesai (saat)', c: '#B4570B' }, { v: sa(Tt.netTatil), f: 'sa', l: 'Resmi tatilde çalışma (saat)', c: '#A3262A' },
      { v: sa(Tt.eksik), f: 'sa', l: 'Eksik (saat)', c: '#8a8f98' }, { v: Tt.yemek, f: 'int', l: 'Yemek hakkı', c: '#2F6FB0' },
      { v: Tt.cmt + Tt.paz, f: 'int', l: 'Hafta sonu çalışılan gün', c: '#5B3A8C' }, { v: Tt.dinlenme, f: 'int', l: '12 saat dinlenme ihlali', c: '#c62828' }] });
    B.push(H('Personel bazında', e ? DT.fmt(e.from) + ' – ' + DT.fmt(e.to) : ''));
    B.push(T({ cols: [col('Personel'), col('Net', 'sa'), col('Zorunlu', 'sa'), col('Fazla mesai', 'sa'), col('Eksik', 'saz'), col('Tatil mesaisi', 'saz'), col('Yemek', 'intz'), col('Cmt', 'intz'), col('Paz', 'intz'),
      col('İzin günü', 'intz'), col('Görev günü', 'intz'), col('Girilmemiş', 'intz'), col('Dinlenme ihlali', 'intz')],
      rows: R.map(function (r) { return [r.p, sa(r.net), sa(r.zor), sa(r.fazla), sa(r.eksik), sa(r.netTatil), r.yemek, r.cmt, r.paz, r.izinGun, r.gorevGun, r.girilmemis, r.dinlenme]; }),
      tot: ['Toplam', sa(Tt.net), sa(Tt.zor), sa(Tt.fazla), sa(Tt.eksik), sa(Tt.netTatil), Tt.yemek, Tt.cmt, Tt.paz, Tt.izinGun, Tt.gorevGun, Tt.girilmemis, Tt.dinlenme], empty: 'Takip edilen personel yok' }));
    if (Tt.fazla) B.push({ type: 'hbars', title: 'Fazla mesai (saat)', rows: R.map(function (r, i) { return [r.p, sa(r.fazla), PERS_RENK[i % PERS_RENK.length]]; }), f: 'sa', xlsx: false });
    if (e) {
      var dl = dilimler(e.from, e.to);
      if (dl.length > 1) {
        var Sx = dl.map(function (d) { return MS.donem(ctx, d.bas, d.son); });
        B.push(H(dl.baslik + ' fazla mesai', 'saat'));
        B.push(T({ cols: [col(dl.sutun)].concat(R.map(function (r) { return col(r.p, 'saz'); }), [col('Toplam', 'sa')]),
          rows: dl.map(function (d, i) { return [d.uzun].concat(Sx[i].map(function (r) { return sa(r.fazla); }), [sa(MS.toplam(Sx[i]).fazla)]); }),
          note: 'Her ' + { hafta: 'hafta', ay: 'ay', yil: 'yıl' }[dl.tur] + ' kendi zorunlu saatiyle hesaplanır; bu yüzden toplamları dönemin fazla mesaisinden farklı olabilir.' }));
      }
    }
    var gl = m.gorev.filter(function (g) { return g.bas != null && g.bas >= o.from && g.bas <= o.to; }).sort(function (a, b) { return a.bas - b.bas; });
    if (gl.length) {
      B.push(H('Görevlendirme', gl.length + ' görev'));
      B.push(T({ cols: [col('Personel'), col('Görev', 'intz'), col('Ürün taşıma', 'intz'), col('Kalmalı', 'intz'), col('Konaklama gecesi', 'intz'), col('Günübirlik', 'intz')],
        rows: G.filter(function (r) { return r.n; }).map(function (r) { return [r.p, r.n, r.tasima, r.kalmali, r.gece, r.gunubirlik]; }),
        tot: ['Toplam', gl.length, sum(G, function (r) { return r.tasima; }), sum(G, function (r) { return r.kalmali; }), sum(G, function (r) { return r.gece; }), sum(G, function (r) { return r.gunubirlik; })] }));
      B.push(T({ sheet: 'Görevlendirme', cols: [col('Personel'), col('Başlangıç', 'date', { a: 'c' }), col('Bitiş', 'date', { a: 'c' }), col('Gün', 'int'), col('Görev türü'), col('Gidilen yer'), col('Not', 'txt', { wrap: 2 })],
        xw: [14, 11, 11, 6, 18, 22, 40],
        rows: gl.map(function (g) { var bit = g.bit != null && g.bit >= g.bas ? g.bit : g.bas; return [g.p, g.bas, bit, bit - g.bas + 1, g.tur, g.yer, g.not]; }) }));
    }
    // gün gün kayıtlar
    var det = [], sira = function (p) { for (var i = 0; i < m.personel.length; i++) if (eqi(m.personel[i], p)) return i; return 99; };
    R.forEach(function (r) {
      r.gunler.forEach(function (g) {
        var bos = !g.rec && g.zorTam > 0 && !g.gorev;
        if (!g.rec && !g.gorev && !bos) return;
        var ek = [];
        if (g.izin) ek.push(root.MS.izinAd(g.izin.t) + (g.izin.s ? ' ' + String(g.izin.s).replace('.', ',') + ' sa' : ''));
        if (g.gorev) ek.push('Görev' + (g.gorev.yer ? ': ' + g.gorev.yer : ''));
        if (g.tatil) ek.push(g.tatil.ad);
        var uy = [];
        if (g.dinlenme != null) uy.push('dinlenme ' + fmt(sa(g.dinlenme), 'sa') + ' sa');
        if (g.cakisma) uy.push('çakışan saat');
        det.push({ v: [g.s, DT.gun(g.s), r.p, root.MS.aralikYazi(g.rec) || (bos ? 'girilmedi' : ''), g.brut ? sa(g.net) : null, sa(g.zor), g.tatil && g.tatil.tur === 'tam' ? sa(g.net) : sa(g.net - g.zor), g.yemek,
          ek.join(' · '), [g.not].concat(uy).filter(Boolean).join(' · ')], muted: bos, k: sira(r.p) });
      });
    });
    det.sort(function (a, b) { return a.v[0] - b.v[0] || a.k - b.k; });
    B.push(Object.assign(H('Günlük kayıtlar', det.length + ' kişi-gün · tarihe göre'), { pdf: o.ayrinti, xlsx: false }));
    B.push(T({ sheet: 'Günlük kayıtlar', cols: [col('Tarih', 'date', { a: 'c' }), col('Gün'), col('Personel'), col('Giriş – çıkış', 'txt', { wrap: 2 }), col('Net', 'saz'), col('Zorunlu', 'saz'), col('Fark', 'saz'),
      col('Yemek', 'intz'), col('İzin · görev · tatil', 'txt', { wrap: 2 }), col('Not · uyarı', 'txt', { wrap: 2 })],
      xw: [11, 10, 12, 26, 8, 8, 8, 7, 24, 44], rows: det, pdf: o.ayrinti, uzun: true, empty: 'Bu dönemde mesai kaydı yok' }));
    return { landscape: true, info: info, blocks: B, ayrinti: { ad: 'Günlük kayıtlar', n: det.length },
      ozet: 'Fazla mesai ' + fmt(sa(Tt.fazla), 'sa') + ' sa' + (Tt.netTatil ? ' (resmi tatil ' + fmt(sa(Tt.netTatil), 'sa') + ' sa dahil)' : '') + ' · ' + Tt.yemek + ' yemek hakkı · ' + (Tt.cmt + Tt.paz) + ' hafta sonu günü' + (Tt.girilmemis ? ' · ' + Tt.girilmemis + ' gün girilmemiş' : ''),
      not: 'Net: giriş–çıkış aralıklarının toplamı; hafta içi 3,5 saatin altında mola yok, 3,5–7,5 saat 30 dakika, daha uzunsa 1 saat mola düşülür; hafta sonu mola düşülmez. Zorunlu: iş günü 8, arife 4 saat; izin günleri düşülür. ' +
        'Fazla mesai = en çok(0, resmi tatil dışındaki net − zorunlu) + resmi tatilde çalışılan saatin tamamı. Yemek: 3,5 saat ve üstü 1, 10 saat ve üstü 2; resmi tatilde ve şehir dışı görevde yok. ' +
        'Dinlenme: önceki günün son çıkışı ile günün ilk girişi arası 12 saatten az. Girilmemiş: saat, izin ya da görev yazılmamış iş günü.' };
  }

  /* ---------------- rapor modeli ---------------- */
  /** c: { state, D, pool, hrows, yrows, today } · o: { tur, from, to, ayrinti, filtre } */
  RP.build = function (c, o) {
    o = Object.assign({}, o);
    o.tumu = o.from == null || o.to == null;
    var period = RP.donemAd(o.from, o.to);
    if (o.tumu) { var k = kapsam(c); o.from = k.from; o.to = k.to; }
    var fn = { donor: donorRaporu, harcama: harcamaRaporu, isyuku: isYukuRaporu, ozet: ozetRaporu, yemek: yemekRaporu, mesai: mesaiRaporu }[o.tur] || donorRaporu;
    var m = fn(c, o);
    m.tur = o.tur; m.title = BASLIK[o.tur] || 'Rapor'; m.period = period;
    m.info = (o.tumu ? [] : [DT.fmt(o.from) + ' – ' + DT.fmt(o.to)]).concat(m.info || []);
    if (o.tumu) m.info.unshift('Uygulamadaki bütün kayıtlar');
    m.info[0] = m.info[0] + '  ·  Rapor tarihi: ' + DT.fmt(c.today);
    if (m.not) m.blocks.push(NOTE(m.not));
    m.footer = 'Donör Takip · ' + m.title + ' · ' + DT.fmt(c.today);
    m.dosya = DOSYA[o.tur] + '_' + (o.tumu ? 'tum_kayitlar' : DT.iso(o.from) + '_' + DT.iso(o.to));
    return m;
  };

  /* ---------------- PDF ---------------- */
  RP.toPdf = function (m) { return root.PDFR.build(m, fmt); };

  /* ---------------- Excel ---------------- */
  // stiller (xlsx-io): 1 tarih · 2 başlık · 3 sayfa başlığı · 5 gri · 6 gri tarih · 7 ₺ · 8 % · 9 kalın toplam · 10 kalın ₺ · 11 bölüm · 12 sayı · 13 kalın sayı · 14 kalın % · 15 not · 16 alt başlık · 17 ondalık · 18 saat · 19 kalın saat
  var XS = { date: 1, tl: 7, tlz: 7, tl0: 7, pct: 8, int: 12, intz: 12, dec1: 17, sa: 18, saz: 18 }, XT = { date: 9, tl: 10, tlz: 10, tl0: 10, pct: 14, int: 13, intz: 13, dec1: 17, txt: 9, sa: 19, saz: 19 };
  function xcell(v, f, tot, muted) {
    if (v == null || v === '') return tot ? { v: '', s: 9 } : '';
    if (typeof v === 'number' && !isNaN(v)) {
      if (f === 'txt' || !f) return { v: v, s: tot ? 13 : muted ? 5 : 12 };
      return { v: f === 'tl' || f === 'tlz' || f === 'tl0' ? Math.round(v * 100) / 100 : v, s: tot ? XT[f] : f === 'date' && muted ? 6 : XS[f] };
    }
    return { v: S(v), s: tot ? 9 : muted ? 5 : 0 };
  }
  RP.toXlsx = function (m, z) {
    var X = root.XLSXIO, ozet = [], sheets = [], widths = [];
    var put = function (row) { ozet.push(row); row.forEach(function (c2, i) { var l = c2 && typeof c2 === 'object' ? (c2.s === 3 || c2.s === 11 ? 0 : String(c2.v == null ? '' : c2.v).length) : String(c2 == null ? '' : c2).length; if (c2 && c2.s === 7) l = l + 6; widths[i] = Math.max(widths[i] || 0, Math.min(l, 48)); }); };
    ozet.push([{ v: m.title, s: 3 }]); ozet.push([{ v: 'Dönem: ' + m.period, s: 16 }]);
    (m.info || []).forEach(function (l) { ozet.push([{ v: l, s: 15 }]); });
    ozet.push([]);
    var table = function (b, into) {
      if (b.title) into.put([{ v: b.title, s: 16 }]);
      into.put(b.cols.map(function (c2) { return { v: c2.t, s: 2 }; }));
      b.rows.forEach(function (r) { var v = r.v || r; into.put(b.cols.map(function (c2, i) { return xcell(v[i], c2.f, false, r.muted); })); });
      if (b.tot) into.put(b.cols.map(function (c2, i) { return xcell(b.tot[i], c2.f, true); }));
      if (b.note) into.put([{ v: b.note, s: 15 }]);
      into.put([]);
    };
    var main = { put: put };
    var each = function (b) {
      if (!b || b.xlsx === false) return;
      if (b.type === 'row') { b.items.forEach(each); return; }
      if (b.type === 'h') { ozet.push([{ v: b.text + (b.sub ? '  ·  ' + b.sub : ''), s: 11 }]); return; }
      if (b.type === 'note') { ozet.push([{ v: b.text, s: 15 }]); return; }
      if (b.type === 'kpis') { b.items.forEach(function (it) { put([{ v: it.l, s: 0 }, xcell(it.v, it.f, true)]); }); put([]); return; }
      if (b.type === 'bars') { table({ cols: [{ t: '', f: 'txt' }].concat(b.series.map(function (s) { return { t: s.name, f: b.f }; })), rows: b.labels.map(function (l, i) { return [l].concat(b.series.map(function (s) { return s.values[i]; })); }) }, main); return; }
      if (b.type === 'hbars') { table({ title: b.title, cols: [{ t: '', f: 'txt' }, { t: 'Değer', f: b.f }], rows: b.rows.map(function (r) { return [r[0], r[1]]; }) }, main); return; }
      if (b.type === 'table') {
        if (b.sheet) {
          var rows = [[{ v: m.title + ' · ' + b.sheet, s: 3 }], [{ v: 'Dönem: ' + m.period, s: 16 }], []];
          var into = { put: function (r) { rows.push(r); } };
          table(Object.assign({}, b, { title: null, note: null }), into);
          if (rows.length && !rows[rows.length - 1].length) rows.pop();
          var heights = []; heights[3] = 30;
          sheets.push({ name: b.sheet.slice(0, 31), rows: rows, freezeRow: 4, filterRow: b.rows.length ? 4 : null, heights: heights,
            cols: b.xw || b.cols.map(function (c2) { return c2.f === 'date' ? 11 : c2.f === 'tl' ? 14 : c2.f && c2.f !== 'txt' ? 10 : 22; }) });
        } else table(b, main);
      }
    };
    m.blocks.forEach(each);
    var cols = []; for (var i = 0; i < Math.max(widths.length, 2); i++) cols.push(Math.max(i === 0 ? 30 : 11, Math.round((widths[i] || 8) * 1.1) + 2));
    var all = [{ name: 'Özet', rows: ozet, cols: cols }].concat(sheets);
    return z ? X.buildXlsxZ(all) : X.buildXlsx(all);
  };
  RP.toXlsxZ = function (m) { return RP.toXlsx(m, true); };

  root.RP = RP;
  if (typeof module !== 'undefined' && module.exports) module.exports = RP;
})(typeof window !== 'undefined' ? window : globalThis);
