/* Donör Takip – Donör harcamaları (Donor_Harcama_Dashboard.xlsx'in uygulamadaki karşılığı).
 * Harcama satırları state.harcama'da tutulur; donör özetleri ve dashboard hesapları buradan üretilir.
 */
(function (root) {
  'use strict';
  var DT = root.DT, HR = {};
  var S = function (v) { return v == null ? '' : String(v); };
  var fold = function (s) { return S(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase(); };
  var key = function (s) { return fold(s).replace(/[^a-z0-9çğıöşüâîû]+/g, ''); };
  var up = function (s) { return S(s).trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR'); };

  HR.KATEGORI = ['Ulaşım', 'Konaklama', 'Yemek', 'Akaryakıt / Otopark', 'Diğer'];
  HR.ULASIM = ['Uçak', 'Otobüs', 'Tren', 'Şahsi Araç', 'Taksi', 'Havaş'];
  // Harcama türü (Excel "Detay") → kategori, ulaşım türü, muhasebe kalemi, not kodu
  HR.TURLER = [
    ['Uçak bileti', 'Ulaşım', 'Uçak', 'YURTİÇİ GEÇİCİ GÖREV ULAŞIM GİDERLERİ', '213'],
    ['Otobüs bileti', 'Ulaşım', 'Otobüs', 'YURTİÇİ GEÇİCİ GÖREV ULAŞIM GİDERLERİ', '213'],
    ['Tren bileti', 'Ulaşım', 'Tren', 'YURTİÇİ GEÇİCİ GÖREV ULAŞIM GİDERLERİ', '213'],
    ['Taksi', 'Ulaşım', 'Taksi', 'YURTİÇİ GEÇİCİ GÖREV ULAŞIM GİDERLERİ', '213'],
    ['Havaş', 'Ulaşım', 'Havaş', 'YURTİÇİ GEÇİCİ GÖREV ULAŞIM GİDERLERİ', '213'],
    ['Akaryakıt', 'Akaryakıt / Otopark', 'Şahsi Araç', 'AKARYAKIT VE YAĞ GİDERLERİ', '430'],
    ['Otopark', 'Akaryakıt / Otopark', 'Şahsi Araç', 'TAŞIMA GİDERLERİ', '330'],
    ['Konaklama', 'Konaklama', '', 'YURTİÇİ GEÇİCİ GÖREV KONAKLAMA GİDERLERİ', '212'],
    ['Yemek', 'Yemek', '', 'BAĞIŞÇILARA VERİLEN İKRAM VE PROMOSYON GİDERLERİ', '485'],
    ['Kamu hastanesi', 'Diğer', '', 'DİĞER HİZMET ALIMLARI', '399'],
    ['Taşıma gideri', 'Diğer', '', 'TAŞIMA GİDERLERİ', '330']
  ];
  HR.tur = function (detay) { for (var i = 0; i < HR.TURLER.length; i++) if (HR.TURLER[i][0] === detay) return HR.TURLER[i]; return null; };
  // Yeni harcama satırı: tür seçilince kategori / ulaşım / kalem kendiliğinden
  HR.yeni = function (o) {
    var t = HR.tur(o.detay) || HR.TURLER[0];
    return {
      id: o.id || DT.uid(), tarih: o.tarih, detay: t[0], kategori: t[1], ulasim: t[2], kalem: t[3],
      refakatci: t[1] === 'Konaklama' ? S(o.refakatci) : '', gece: t[1] === 'Konaklama' && +o.gece > 0 ? +o.gece : null,
      not: S(o.not), tutar: Math.round((+o.tutar || 0) * 100) / 100, donorId: o.donorId || null, ad: S(o.ad), sira: o.sira || null
    };
  };

  /* ---- il ve konum (şehir içi = Ankara) ---- */
  var ILLER = ('ADANA ADIYAMAN AFYONKARAHİSAR AĞRI AMASYA ANKARA ANTALYA ARTVİN AYDIN BALIKESİR BİLECİK BİNGÖL BİTLİS BOLU BURDUR BURSA ÇANAKKALE ' +
    'ÇANKIRI ÇORUM DENİZLİ DİYARBAKIR EDİRNE ELAZIĞ ERZİNCAN ERZURUM ESKİŞEHİR GAZİANTEP GİRESUN GÜMÜŞHANE HAKKARİ HATAY ISPARTA MERSİN İSTANBUL ' +
    'İZMİR KARS KASTAMONU KAYSERİ KIRKLARELİ KIRŞEHİR KOCAELİ KONYA KÜTAHYA MALATYA MANİSA KAHRAMANMARAŞ MARDİN MUĞLA MUŞ NEVŞEHİR NİĞDE ORDU ' +
    'RİZE SAKARYA SAMSUN SİİRT SİNOP SİVAS TEKİRDAĞ TOKAT TRABZON TUNCELİ ŞANLIURFA UŞAK VAN YOZGAT ZONGULDAK AKSARAY BAYBURT KARAMAN KIRIKKALE ' +
    'BATMAN ŞIRNAK BARTIN ARDAHAN IĞDIR YALOVA KARABÜK KİLİS OSMANİYE DÜZCE').split(' ');
  var IL_ESDEGER = { AFYON: 'AFYONKARAHİSAR', URFA: 'ŞANLIURFA', MARAŞ: 'KAHRAMANMARAŞ', 'K.MARAŞ': 'KAHRAMANMARAŞ', ANTEP: 'GAZİANTEP', İÇEL: 'MERSİN',
    DERSİM: 'TUNCELİ', ADAPAZARI: 'SAKARYA', İZMİT: 'KOCAELİ', ANTAKYA: 'HATAY', İST: 'İSTANBUL' };
  // yanlış ile yazılabilen ilçeler: ilçe adı il adından önce gelir
  var ILCE_IL = { SAFRANBOLU: 'KARABÜK' };
  var ANKARA_ILCE = ('ALTINDAĞ AYAŞ BALA BEYPAZARI ÇAMLIDERE ÇANKAYA ÇUBUK ELMADAĞ ETİMESGUT EVREN GÖLBAŞI GÜDÜL HAYMANA KAHRAMANKAZAN KAZAN KALECİK ' +
    'KEÇİÖREN KIZILCAHAMAM MAMAK NALLIHAN POLATLI PURSAKLAR SİNCAN ŞEREFLİKOÇHİSAR YENİMAHALLE AKYURT').split(' ');
  var IL_KEY = {};
  ILLER.forEach(function (il) { IL_KEY[key(il)] = il; });
  Object.keys(IL_ESDEGER).forEach(function (k) { IL_KEY[key(k)] = IL_ESDEGER[k]; });
  ANKARA_ILCE.forEach(function (k) { if (!IL_KEY[key(k)]) IL_KEY[key(k)] = 'ANKARA'; });
  // ikamet → il; önce Excel'den öğrenilen eşleşmeler, sonra il adı / bilinen ilçe, sonra "/" sonrası
  HR.ilOf = function (ikamet, ogrenilen) {
    var ik = S(ikamet).trim();
    if (!ik) return '';
    var k0 = key(ik);
    if (ogrenilen && ogrenilen[k0]) return ogrenilen[k0];
    var parts = ik.split(/[\/,\-–]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    var ilce = {}; Object.keys(ILCE_IL).forEach(function (k) { ilce[key(k)] = ILCE_IL[k]; });
    for (var a = 0; a < parts.length; a++) if (ilce[key(parts[a])]) return ilce[key(parts[a])];
    var bulunan = parts.map(function (p) { return IL_KEY[key(p)]; }).filter(Boolean);
    if (bulunan.indexOf('ANKARA') >= 0) return 'ANKARA';
    if (bulunan.length) return bulunan[bulunan.length - 1];
    var w = ik.split(/[\s\/,\-–()]+/);
    for (var j = w.length - 1; j >= 0; j--) { var n = IL_KEY[key(w[j])]; if (n) return n; }
    return up(parts.length ? parts[parts.length - 1] : ik);
  };
  HR.konum = function (il) { return il === 'ANKARA' ? 'Şehir İçi' : 'Şehir Dışı'; };
  HR.durumGrubu = function (x) {
    var d = S(x.durum);
    if (d === 'Toplama yapıldı') return 'Toplama yapıldı';
    var m = /^Süreç durdu · (.+)$/.exec(d);
    if (m) return 'Durdu: ' + { 'iptal': 'İptal', 'vazgeçti': 'Vazgeçti', 'erteleme': 'Erteleme', 'red': 'Red', 'hasta ex': 'Hasta ex' }[m[1]];
    return 'Toplama planlandı';
  };
  HR.DURUM_GRUPLARI = ['Toplama yapıldı', 'Toplama planlandı', 'Durdu: İptal', 'Durdu: Vazgeçti', 'Durdu: Erteleme', 'Durdu: Red', 'Durdu: Hasta ex'];

  /* ---- donör özetleri (Excel "Donör Harcama" sayfası) ---- */
  HR.derive = function (state, D) {
    var byId = {}, ogr = state.ilEslesme || {};
    D.forEach(function (x) {
      var il = HR.ilOf(x.d.ikamet, ogr);
      x.h = { il: il, konum: HR.konum(il), grup: HR.durumGrubu(x), toplam: 0, kat: {}, yil: {}, gece: 0, satir: 0, refakatci: '', ulasim: '', _ul: {} };
      HR.KATEGORI.forEach(function (k) { x.h.kat[k] = 0; });
      byId[x.d.id] = x;
    });
    var rows = (state.harcama || []).map(function (r) {
      var p = r.tarih != null ? DT.parts(r.tarih) : null, x = r.donorId ? byId[r.donorId] : null;
      var o = { r: r, x: x, yil: p ? p.y : null, ay: p ? p.m : null, konum: x ? x.h.konum : 'Eşleşmedi', tutar: +r.tutar || 0 };
      if (x) {
        var h = x.h;
        h.toplam += o.tutar; h.kat[r.kategori] = (h.kat[r.kategori] || 0) + o.tutar; h.satir++;
        if (o.yil != null) h.yil[o.yil] = (h.yil[o.yil] || 0) + o.tutar;
        if (r.gece) h.gece += +r.gece;
        var rf = up(r.refakatci);
        if (rf === 'VAR') h.refakatci = 'Var'; else if (rf === 'YOK' && h.refakatci !== 'Var') h.refakatci = 'Yok';
        if (r.ulasim) h._ul[r.ulasim] = 1;
      }
      return o;
    });
    D.forEach(function (x) { x.h.toplam = Math.round(x.h.toplam * 100) / 100; x.h.ulasim = Object.keys(x.h._ul).sort().join(' + '); });
    return rows;
  };

  /* ---- dashboard (Excel "Dashboard" sayfasının bölümleri) ---- */
  var sum = function (a, f) { var t = 0; for (var i = 0; i < a.length; i++) t += f ? f(a[i]) : a[i]; return t; };
  var div = function (a, b) { return b ? a / b : 0; };
  HR.dashboard = function (state, D, rows, opt) {
    opt = opt || {};
    var R = {}, years = {};
    rows.forEach(function (o) { if (o.yil != null) years[o.yil] = 1; });
    R.yillar = Object.keys(years).map(Number).sort();
    var Y = opt.yil && years[opt.yil] ? +opt.yil : (R.yillar.length ? R.yillar[R.yillar.length - 1] : DT.year(opt.today || DT.today()));
    var P = Y - 1;
    R.Y = Y; R.P = P;
    var ayMax = 0; rows.forEach(function (o) { if (o.yil === Y && o.ay > ayMax) ayMax = o.ay; });
    R.ayMax = ayMax || 12;
    var harcamali = D.filter(function (x) { return x.h.toplam > 0; });
    var inY = function (o, y) { return o.yil === y; }, aynıDonem = function (o) { return o.ay <= R.ayMax; };
    // 0 · KPI
    R.toplamDonor = D.length;
    R.toplamaYapilan = D.filter(function (x) { return x.h.grup === 'Toplama yapıldı'; }).length;
    R.planli = D.filter(function (x) { return x.h.grup === 'Toplama planlandı'; }).length;
    R.duran = D.filter(function (x) { return /^Durdu/.test(x.h.grup); }).length;
    R.sehirIci = D.filter(function (x) { return x.h.konum === 'Şehir İçi'; }).length;
    R.sehirDisi = D.length - R.sehirIci;
    R.toplam = sum(rows, function (o) { return o.tutar; });
    R.harcamaliDonor = harcamali.length;
    R.donorBasi = div(R.toplam, harcamali.length);
    var rfVar = harcamali.filter(function (x) { return x.h.refakatci === 'Var'; });
    R.refakatciliDonor = D.filter(function (x) { return x.h.refakatci === 'Var'; }).length;
    R.refakatciOrt = div(sum(rfVar, function (x) { return x.h.toplam; }), rfVar.length);
    R.eslesmeyen = rows.filter(function (o) { return !o.x; });
    R.eslesmeyenTutar = sum(R.eslesmeyen, function (o) { return o.tutar; });
    // 1 · yıllara göre kategori
    R.yilTablo = R.yillar.map(function (y) {
      var rr = rows.filter(function (o) { return inY(o, y); }), r = { yil: y, kat: {}, satir: rr.length };
      HR.KATEGORI.forEach(function (k) { r.kat[k] = sum(rr, function (o) { return o.r.kategori === k ? o.tutar : 0; }); });
      r.toplam = sum(rr, function (o) { return o.tutar; });
      r.donor = D.filter(function (x) { return (x.h.yil[y] || 0) > 0; }).length;
      r.ort = div(r.toplam, r.donor);
      return r;
    });
    R.katToplam = {}; HR.KATEGORI.forEach(function (k) { R.katToplam[k] = sum(rows, function (o) { return o.r.kategori === k ? o.tutar : 0; }); });
    // 2 · ulaşım türü
    var ulTablo = function (rr) {
      var t = HR.ULASIM.map(function (u) {
        var a = rr.filter(function (o) { return o.r.ulasim === u; });
        return { ad: u, tutar: sum(a, function (o) { return o.tutar; }), adet: a.length };
      });
      var tt = sum(t, function (r) { return r.tutar; }), ta = sum(t, function (r) { return r.adet; });
      t.forEach(function (r) { r.ort = div(r.tutar, r.adet); r.pay = div(r.tutar, tt); });
      return { rows: t, tutar: tt, adet: ta, ort: div(tt, ta) };
    };
    R.ulasim = ulTablo(rows);
    // 3 · refakatçi (harcaması olan donörler)
    var rfRow = function (ad, list) {
      var n = list.length;
      return { ad: ad, n: n, toplam: sum(list, function (x) { return x.h.toplam; }), ort: div(sum(list, function (x) { return x.h.toplam; }), n),
        ulasim: div(sum(list, function (x) { return x.h.kat['Ulaşım']; }), n), konaklama: div(sum(list, function (x) { return x.h.kat['Konaklama']; }), n),
        yemek: div(sum(list, function (x) { return x.h.kat['Yemek']; }), n), gece: div(sum(list, function (x) { return x.h.gece; }), n) };
    };
    R.refakatci = [rfRow('Var', rfVar), rfRow('Yok', harcamali.filter(function (x) { return x.h.refakatci === 'Yok'; })),
      rfRow('Bilgi yok', harcamali.filter(function (x) { return !x.h.refakatci; })), rfRow('Toplam', harcamali)];
    // 4 · durum, yöntem, hastane
    R.durum = HR.DURUM_GRUPLARI.map(function (g) {
      var a = D.filter(function (x) { return x.h.grup === g; });
      return { ad: g, n: a.length, pay: div(a.length, D.length), tutar: sum(a, function (x) { return x.h.toplam; }) };
    });
    var grupTablo = function (alan, liste) {
      return liste.map(function (ad) {
        var a = D.filter(function (x) { return DT.eqi(x.d[alan], ad); }), t = a.filter(function (x) { return x.h.grup === 'Toplama yapıldı'; }).length;
        return { ad: ad, n: a.length, top: t, basari: div(t, a.length), tutar: sum(a, function (x) { return x.h.toplam; }) };
      }).filter(function (r) { return r.n; });
    };
    R.yontem = grupTablo('yontem', (state.lists.yontem || []).slice());
    R.hastane = grupTablo('hastane', (state.lists.hastane || []).map(function (hh) { return hh.ad; }));
    // 5 · en yüksek 10
    R.top10 = harcamali.slice().sort(function (a, b) { return b.h.toplam - a.h.toplam; }).slice(0, 10);
    // 6 · şehir içi / dışı
    R.konum = ['Şehir İçi', 'Şehir Dışı'].map(function (k) {
      var a = D.filter(function (x) { return x.h.konum === k; }), hz = a.filter(function (x) { return x.h.toplam > 0; });
      var top = a.filter(function (x) { return x.h.grup === 'Toplama yapıldı'; }).length, tutar = sum(a, function (x) { return x.h.toplam; });
      return { ad: k, n: a.length, top: top, basari: div(top, a.length), harcamali: hz.length, tutar: tutar, ort: div(tutar, hz.length),
        refakatcili: a.filter(function (x) { return x.h.refakatci === 'Var'; }).length,
        ortUlasim: div(sum(hz, function (x) { return x.h.kat['Ulaşım']; }), hz.length), ortKonaklama: div(sum(hz, function (x) { return x.h.kat['Konaklama']; }), hz.length),
        ortYemek: div(sum(hz, function (x) { return x.h.kat['Yemek']; }), hz.length), ortAkaryakit: div(sum(hz, function (x) { return x.h.kat['Akaryakıt / Otopark']; }), hz.length),
        ortGece: div(sum(hz, function (x) { return x.h.gece; }), hz.length) };
    });
    var konTop = sum(R.konum, function (k) { return k.tutar; });
    R.konum.forEach(function (k) { k.pay = div(k.tutar, konTop); });
    var iller = {};
    D.forEach(function (x) {
      if (x.h.konum !== 'Şehir Dışı') return;
      var il = x.h.il || '(boş)', r = iller[il] || (iller[il] = { il: il, n: 0, top: 0, tutar: 0, harcamali: 0, ulasim: 0, konaklama: 0 });
      r.n++; if (x.h.grup === 'Toplama yapıldı') r.top++;
      r.tutar += x.h.toplam; if (x.h.toplam > 0) r.harcamali++;
      r.ulasim += x.h.kat['Ulaşım'] + x.h.kat['Akaryakıt / Otopark']; r.konaklama += x.h.kat['Konaklama'];
    });
    R.iller = Object.keys(iller).map(function (k) { var r = iller[k]; r.basari = div(r.top, r.n); r.ort = div(r.tutar, r.harcamali); return r; })
      .sort(function (a, b) { return b.n - a.n || b.tutar - a.tutar; });
    R.illerMaliyet = R.iller.filter(function (r) { return r.ulasim + r.konaklama > 0; }).sort(function (a, b) { return (b.ulasim + b.konaklama) - (a.ulasim + a.konaklama); });
    // 7 · aylık Y ve P
    R.aylik = DT.AYLAR.map(function (ad, i) {
      var m = i + 1;
      return { ad: ad, p: sum(rows, function (o) { return o.yil === P && o.ay === m ? o.tutar : 0; }), y: sum(rows, function (o) { return o.yil === Y && o.ay === m ? o.tutar : 0; }) };
    });
    // 8 · şehir dışı ulaşım ve konaklama
    var dis = rows.filter(function (o) { return o.konum === 'Şehir Dışı'; });
    R.disUlasim = sum(dis, function (o) { return o.r.kategori === 'Ulaşım' || o.r.kategori === 'Akaryakıt / Otopark' ? o.tutar : 0; });
    R.disKonaklama = sum(dis, function (o) { return o.r.kategori === 'Konaklama' ? o.tutar : 0; });
    R.disHarcamali = D.filter(function (x) { return x.h.konum === 'Şehir Dışı' && x.h.toplam > 0; }).length;
    R.disYil = R.yillar.map(function (y) {
      var a = dis.filter(function (o) { return o.yil === y; });
      return { yil: y, donor: D.filter(function (x) { return x.h.konum === 'Şehir Dışı' && (x.h.yil[y] || 0) > 0; }).length,
        ulasim: sum(a, function (o) { return o.r.kategori === 'Ulaşım' ? o.tutar : 0; }), akaryakit: sum(a, function (o) { return o.r.kategori === 'Akaryakıt / Otopark' ? o.tutar : 0; }) };
    });
    R.disUlasimTur = ulTablo(dis);
    // 9 · harcama türleri ve göstergeler: Y, P, P aynı dönem
    var donem = function (y, ayni) { return rows.filter(function (o) { return o.yil === y && (!ayni || aynıDonem(o)); }); };
    var rY = donem(Y), rP = donem(P), rPa = donem(P, true);
    R.turler = HR.TURLER.map(function (t) {
      var f = function (a) { var b = a.filter(function (o) { return o.r.detay === t[0]; }); return { tutar: sum(b, function (o) { return o.tutar; }), adet: b.length }; };
      return { ad: t[0], kat: t[1], p: f(rP), pa: f(rPa), y: f(rY) };
    });
    var gosterge = function (a, yilKey) {
      var t = sum(a, function (o) { return o.tutar; }), donors = {}, maxD = {};
      a.forEach(function (o) { if (o.x) { donors[o.x.d.id] = 1; maxD[o.x.d.id] = (maxD[o.x.d.id] || 0) + o.tutar; } });
      var nd = Object.keys(donors).length, k = function (c) { return sum(a, function (o) { return o.r.kategori === c ? o.tutar : 0; }); };
      var ul = k('Ulaşım') + k('Akaryakıt / Otopark'), avg = function (d) { var b = a.filter(function (o) { return o.r.detay === d; }); return div(sum(b, function (o) { return o.tutar; }), b.length); };
      var dis2 = sum(a, function (o) { return o.konum === 'Şehir Dışı' ? o.tutar : 0; });
      return { toplam: t, satir: a.length, donor: nd, ort: div(t, nd), enYuksek: Object.keys(maxD).reduce(function (m, id) { return Math.max(m, maxD[id]); }, 0),
        ulasim: ul, konaklama: k('Konaklama'), yemek: k('Yemek'), dbUlasim: div(ul, nd), dbKonaklama: div(k('Konaklama'), nd), dbYemek: div(k('Yemek'), nd),
        payUlasim: div(ul, t), payKonaklama: div(k('Konaklama'), t), payDis: div(dis2, t),
        ucak: avg('Uçak bileti'), otobus: avg('Otobüs bileti'), konaklamaFis: avg('Konaklama'), yemekFis: avg('Yemek') };
    };
    R.gY = gosterge(rY); R.gP = gosterge(rP); R.gPa = gosterge(rPa);
    R.ceyrek = [0, 1, 2, 3].map(function (q) {
      var f = function (y) {
        var a = rows.filter(function (o) { return o.yil === y && o.ay > q * 3 && o.ay <= q * 3 + 3; }), k = function (c) { return sum(a, function (o) { return o.r.kategori === c ? o.tutar : 0; }); };
        return { ulasim: k('Ulaşım') + k('Akaryakıt / Otopark'), konaklama: k('Konaklama'), yemek: k('Yemek'), toplam: sum(a, function (o) { return o.tutar; }) };
      };
      return { ad: (q + 1) + '. Çeyrek', p: f(P), y: f(Y) };
    });
    // 10 · şehir içi / dışı yıllara göre
    R.konumYil = ['Şehir İçi', 'Şehir Dışı'].map(function (kn) {
      var g = function (y, ayni) {
        var a = rows.filter(function (o) { return o.konum === kn && o.yil === y && (!ayni || aynıDonem(o)); }), all = rows.filter(function (o) { return o.yil === y && (!ayni || aynıDonem(o)); });
        var donors = {}; a.forEach(function (o) { if (o.x) donors[o.x.d.id] = 1; });
        var nd = Object.keys(donors).length, t = sum(a, function (o) { return o.tutar; }), k = function (c) { return sum(a, function (o) { return o.r.kategori === c ? o.tutar : 0; }); };
        var kayit = D.filter(function (x) { return x.h.konum === kn && x.d.sk != null && DT.year(x.d.sk) === y && (!ayni || DT.parts(x.d.sk).m <= R.ayMax); });
        return { kayit: kayit.length, top: kayit.filter(function (x) { return x.h.grup === 'Toplama yapıldı'; }).length, toplam: t, satir: a.length, donor: nd, ort: div(t, nd),
          ulasim: k('Ulaşım') + k('Akaryakıt / Otopark'), konaklama: k('Konaklama'), yemek: k('Yemek'),
          dbUlasim: div(k('Ulaşım') + k('Akaryakıt / Otopark'), nd), dbKonaklama: div(k('Konaklama'), nd), dbYemek: div(k('Yemek'), nd), pay: div(t, sum(all, function (o) { return o.tutar; })) };
      };
      return { ad: kn, p: g(P), y: g(Y), pa: g(P, true) };
    });
    return R;
  };

  // Donör listesi yenilenince (Excel'den içe aktarma) harcamaları yeni donör kayıtlarına bağla
  HR.relink = function (harcama, eski, yeni) {
    var byOld = {}, used = {};
    eski.forEach(function (d) { byOld[d.id] = d; });
    var find = function (o) {
      var c = yeni.filter(function (d) { return o.hk && DT.eqi(d.hk, o.hk) && (!o.dno || !d.dno || DT.eqi(d.dno, o.dno)); });
      if (!c.length && o.dno) c = yeni.filter(function (d) { return DT.eqi(d.dno, o.dno); });
      if (!c.length && o.ad) c = yeni.filter(function (d) { return key(d.ad) === key(o.ad); });
      if (c.length > 1) { var b = c.filter(function (d) { return d.sk === o.sk && d.top === o.top; }); if (b.length) c = b; }
      return c[0] || null;
    };
    var cache = {};
    return harcama.map(function (r) {
      var o = byOld[r.donorId], n = Object.assign({}, r);
      if (!o) return n;
      if (!(r.donorId in cache)) { var f = find(o); cache[r.donorId] = f ? f.id : null; }
      n.donorId = cache[r.donorId]; if (!n.donorId) n.ad = n.ad || o.ad;
      return n;
    });
  };

  /* ---- Excel'den içe aktarma (Donor_Harcama_Dashboard.xlsx) ---- */
  HR.importWorkbook = function (buf, state) {
    var X = root.XLSXIO;
    return X.openWorkbook(buf).then(function (wb) {
      if (wb.sheetNames.indexOf('Harcama Detay') < 0) throw new Error("Bu dosyada 'Harcama Detay' sayfası yok.");
      return Promise.all([wb.sheet('Harcama Detay', { maxCol: 16 }), wb.sheetNames.indexOf('Donör Harcama') >= 0 ? wb.sheet('Donör Harcama', { maxCol: 26 }) : null]);
    }).then(function (r) {
      var det = r[0], don = r[1] || {}, T = function (row, c) { return row && row[c] ? X.cellText(row[c]) : ''; };
      var head = function (sh) { var m = {}; Object.keys(sh[1] || {}).forEach(function (c) { m[key(T(sh[1], +c))] = +c; }); return m; };
      var hd = head(det), hn = head(don);
      var col = function (m, ad, def) { var k = key(ad); return m[k] != null ? m[k] : def; };
      // Excel donör kimliği → uygulamadaki donör (hasta kodu + donör no, yoksa ad soyad)
      var exDonor = {}, ilEslesme = {};
      Object.keys(don).map(Number).filter(function (rn) { return rn > 1; }).forEach(function (rn) {
        var row = don[rn], id = T(row, col(hn, 'Donör ID', 1));
        if (!id) return;
        exDonor[id] = { hk: T(row, col(hn, 'Hasta Kodu', 2)), dno: T(row, col(hn, 'Donör No', 3)), ad: T(row, col(hn, 'Ad Soyad', 4)),
          sk: X.cellDate(row[col(hn, 'Sağlık Kontrol Tarihi', 6)]), top: X.cellDate(row[col(hn, 'Toplama Tarihi', 9)]) };
        var ik = T(row, col(hn, 'İkamet', 5)), il = T(row, col(hn, 'İl', 25));
        if (ik && il) ilEslesme[key(ik)] = up(il);
      });
      var used = {}, rep = { satir: 0, eslesen: 0, eslesmeyen: 0, donorBulunamadi: 0 };
      var findDonor = function (e) {
        var cands = state.donors.filter(function (d) { return e.hk && DT.eqi(d.hk, e.hk) && (!e.dno || !d.dno || DT.eqi(d.dno, e.dno)); });
        if (!cands.length && e.dno) cands = state.donors.filter(function (d) { return DT.eqi(d.dno, e.dno); });
        if (!cands.length && e.ad) cands = state.donors.filter(function (d) { return key(d.ad) === key(e.ad); });
        if (cands.length > 1) {
          var best = cands.filter(function (d) { return (e.sk == null || d.sk === e.sk) && (e.top == null || d.top === e.top) && !used[d.id]; });
          if (best.length) cands = best; else { var free = cands.filter(function (d) { return !used[d.id]; }); if (free.length) cands = free; }
        }
        return cands[0] || null;
      };
      var map = {};
      Object.keys(exDonor).forEach(function (id) { var d = findDonor(exDonor[id]); if (d) { map[id] = d.id; used[d.id] = 1; } else rep.donorBulunamadi++; });
      var out = [];
      Object.keys(det).map(Number).filter(function (rn) { return rn > 1; }).sort(function (a, b) { return a - b; }).forEach(function (rn) {
        var row = det[rn], tutar = row[col(hd, 'Tutar (₺)', 13)], t = tutar ? +tutar.v : NaN;
        if (isNaN(t)) return;
        var detay = T(row, col(hd, 'Detay', 16)), tur = HR.tur(detay);
        var exId = T(row, col(hd, 'Eşleşen Donör ID', 6)), donorId = map[exId] || null;
        var h = HR.yeni({ tarih: X.cellDate(row[col(hd, 'Tarih', 2)]), detay: tur ? detay : 'Uçak bileti', tutar: t, donorId: donorId,
          ad: up(T(row, col(hd, 'Bağışçı (Standart)', 5)) || T(row, col(hd, 'Bağışçı (Kaynak)', 4))),
          refakatci: up(T(row, col(hd, 'Refakatçi', 10))), gece: row[col(hd, 'Konaklama Gün', 11)] ? +row[col(hd, 'Konaklama Gün', 11)].v : null,
          not: T(row, col(hd, 'Not', 12)), sira: T(row, col(hd, 'Sıra No', 1)) });
        if (!tur) { // bilinmeyen tür: Excel'deki kategori ve kalemle sakla
          h.detay = detay; h.kategori = T(row, col(hd, 'Kategori', 8)) || 'Diğer'; h.ulasim = T(row, col(hd, 'Ulaşım Türü', 9)); h.kalem = T(row, col(hd, 'Harcama Kalemi', 7));
        }
        if (h.refakatci && h.kategori !== 'Konaklama') h.refakatci = up(T(row, col(hd, 'Refakatçi', 10)));
        if (row[col(hd, 'Konaklama Gün', 11)] && h.gece == null) h.gece = +row[col(hd, 'Konaklama Gün', 11)].v || null;
        rep.satir++; if (donorId) rep.eslesen++; else rep.eslesmeyen++;
        out.push(h);
      });
      return { harcama: out, ilEslesme: ilEslesme, rapor: rep, eslesme: map };
    });
  };

  /* ---- Excel'e aktarma: Donör Harcama + Harcama Detay ---- */
  HR.exportXlsx = function (state, D, rows) {
    var X = root.XLSXIO, hd = function (a) { return a.map(function (v) { return { v: v, s: 2 }; }); };
    var dt = function (v) { return v == null ? '' : { v: v, s: 1 }; }, n2 = function (v) { return Math.round((+v || 0) * 100) / 100; };
    var don = [hd(['Hasta Kodu', 'Donör No', 'Ad Soyad', 'İkamet', 'İl', 'Konum', 'Sağlık Kontrol', 'Yöntem', 'Hastane', 'Toplama', 'Nakil Merkezi', 'Durum', 'Durum Grubu',
      'Ulaşım Türü', 'Refakatçi', 'Konaklama Gün'].concat(HR.KATEGORI.map(function (k) { return k + ' (₺)'; }), ['Toplam (₺)', 'Kalem Sayısı', 'Açıklama']))];
    D.forEach(function (x) {
      var d = x.d, h = x.h;
      don.push([d.hk, d.dno, d.ad, d.ikamet, h.il, h.konum, dt(d.sk), d.yontem, d.hastane, dt(d.top), d.bolge, x.durum, h.grup, h.ulasim, h.refakatci, h.gece || 0]
        .concat(HR.KATEGORI.map(function (k) { return n2(h.kat[k]); }), [n2(h.toplam), h.satir, d.aciklama]));
    });
    var det = [hd(['Tarih', 'Ay', 'Yıl', 'Bağışçı', 'Hasta Kodu', 'Harcama Kalemi', 'Kategori', 'Ulaşım Türü', 'Detay', 'Refakatçi', 'Konaklama Gün', 'Not', 'Tutar (₺)', 'Konum'])];
    rows.slice().sort(function (a, b) { return (a.r.tarih || 0) - (b.r.tarih || 0); }).forEach(function (o) {
      var r = o.r;
      det.push([dt(r.tarih), o.ay, o.yil, o.x ? o.x.d.ad : r.ad, o.x ? o.x.d.hk : 'EŞLEŞMEDİ', r.kalem, r.kategori, r.ulasim, r.detay, r.refakatci, r.gece, r.not, n2(r.tutar), o.konum]);
    });
    return X.buildXlsx([
      { name: 'Donör Harcama', rows: don, freezeRow: 1, filterRow: 1, cols: [12, 18, 24, 22, 15, 11, 12, 12, 18, 12, 30, 22, 18, 20, 10, 10, 12, 12, 12, 12, 10, 12, 8, 40] },
      { name: 'Harcama Detay', rows: det, freezeRow: 1, filterRow: 1, cols: [12, 5, 6, 24, 12, 40, 18, 12, 15, 10, 9, 30, 12, 11] }
    ]);
  };

  root.HR = HR;
  if (typeof module !== 'undefined' && module.exports) module.exports = HR;
})(typeof window !== 'undefined' ? window : globalThis);
