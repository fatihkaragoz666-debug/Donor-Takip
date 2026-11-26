/* Donör Takip – PERSONEL MESAİ: Personel_Mesai_Takip.xlsx'in kuralları (Mesai Takip, Aylık Fazla Mesai, Görevlendirme).
 *
 * Kayıt: state.mesai.gun[tarih][PERSONEL] = { a: [[giriş, çıkış], …] (gece yarısından dakika), ara, iz: {t, s}, n }
 *  - Aralık süresi: çıkış − giriş; çıkış girişten önce ya da aynıysa ertesi güne geçer (00:00–00:00 = 24 saat).
 *  - Mola: hafta içi günün toplam süresinden düşülür: 3,5 saatin altı yok, 3,5–7,5 saat 30 dk, 7,5 saatten uzun 1 saat.
 *    Hafta sonu mola düşülmez.
 *  - Zorunlu saat: hafta içi iş günü 8 saat, arife 4 saat; hafta sonu ve resmi tatil 0. İzin günü zorunludan düşülür.
 *  - Fazla mesai = en çok(0, resmi tatil dışındaki net − zorunlu) + resmi tatilde çalışılan net saatin tamamı.
 *  - Yemek: günlük net (hafta sonu toplam süre) 3,5 saat ve üstü 1, 10 saat ve üstü 2; resmi tatilde ve şehir dışı
 *    görevlendirmede 0.
 *  - 12 saat dinlenme: günün ilk girişi ile önceki günün son çıkışı arası. Haftalık 48 saat sınırı.
 *  - Takip başlangıcından önceki günler ve saat girilen son günden sonrası zorunlu saate girmez (Excel'deki Ms_SonGiris);
 *    bugün kendisi için henüz yazılmadıysa bugün de girmez.
 *  - Aylık hesap kullanıcının ay dönemleriyle yapılır: kural (donemGun: 1 = takvim ayı, 20 = ayın 20'si – ertesi ayın 19'u;
 *    donemAd: ay adını dönemin başladığı 'bas' ya da bittiği 'bit' ay verir) ve aya özel tarihler (aylar['2026-11'] = {bas, bit}).
 */
(function (root) {
  'use strict';
  var DT = root.DT, MS = {};
  var S = DT.S, fold = DT.fold;

  MS.VARSAYILAN_PERSONEL = ['AHMET', 'BERKAY', 'ÖMER', 'HASGÜL', 'SUAT', 'KEREM'];
  MS.IZIN = [['yillik', 'Yıllık izin'], ['rapor', 'Raporlu'], ['mazeret', 'Mazeret izni'], ['idari', 'İdari izin'], ['diger', 'Diğer izin']];
  MS.GOREV_TURU = ['Ürün taşıma', 'Donör ziyareti', 'Eğitim / toplantı', 'Diğer'];
  MS.GUN3 = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  MS.MAX_ARALIK = 4;

  MS.izinAd = function (t) { for (var i = 0; i < MS.IZIN.length; i++) if (MS.IZIN[i][0] === t) return MS.IZIN[i][1]; return 'İzin'; };

  /* ---------------- durum ---------------- */
  MS.yeni = function (lists) {
    var L = (lists && lists.personel) || [];
    var p = MS.VARSAYILAN_PERSONEL.filter(function (n) { return L.some(function (x) { return DT.eqi(x, n); }); });
    if (!p.length) p = L.slice(0, 6);
    return { v: 1, personel: p, bas: null, std: [480, 1020], donemGun: 20, donemAd: 'bas', aylar: {}, ust: 48, gun: {}, gorev: [] };
  };
  MS.hazirla = function (state) {
    var m = state.mesai;
    if (!m || typeof m !== 'object') m = state.mesai = MS.yeni(state.lists);
    var y = MS.yeni(state.lists);
    if (!Array.isArray(m.personel)) m.personel = y.personel;
    if (!Array.isArray(m.std) || m.std.length !== 2) m.std = y.std;
    if (!m.donemGun) m.donemGun = 20;
    if (m.donemAd !== 'bit') m.donemAd = 'bas';
    if (!m.aylar || typeof m.aylar !== 'object' || Array.isArray(m.aylar)) m.aylar = {};
    if (!m.harita || typeof m.harita !== 'object' || Array.isArray(m.harita)) m.harita = {};
    if (!m.ust) m.ust = 48;
    if (!m.gun || typeof m.gun !== 'object') m.gun = {};
    if (!Array.isArray(m.gorev)) m.gorev = [];
    if (m.bas === undefined) m.bas = null;
    return m;
  };

  /* ---------------- saat yazımı ---------------- */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  MS.hhmm = function (min) { if (min == null || isNaN(min)) return ''; min = Math.round(min); if (min === 1440) return '24:00'; min = ((min % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); };
  /** "08:00", "8.00", "8:5", "0800", "24:00" → dakika; geçersizse null */
  MS.saatOku = function (t) {
    if (t == null) return null;
    if (typeof t === 'number') { if (isNaN(t) || t < 0) return null; if (t <= 1) return Math.round(t * 1440); return null; }
    var s = String(t).trim().replace(/\s+/g, '');
    var m = /^(\d{1,2})[:.,](\d{1,2})(?::\d{2})?$/.exec(s) || /^(\d{2})(\d{2})$/.exec(s);
    if (!m) { m = /^(\d{1,2})$/.exec(s); if (!m) return null; m = [s, m[1], '0']; }
    var h = +m[1], mi = +m[2];
    if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
    return h * 60 + mi;
  };
  /** saat (ondalık) yazısı: 8 → "8", 7,5 → "7,5", 7,333 → "7,33" */
  MS.saat = function (min, bos) {
    if (min == null || isNaN(min)) return bos == null ? '' : bos;
    if (!min && bos != null) return bos;
    var v = Math.round(min / 60 * 100) / 100;
    return v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  MS.saat2 = function (min) { return (Math.round(min / 60 * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  MS.sure = function (st, en) { var d = en - st; if (d <= 0) d += 1440; return d; };

  /* ---------------- gün türü ---------------- */
  /** ctx: { hol: tarih → tatil adı } */
  MS.ctx = function (state, today) {
    var m = MS.hazirla(state), hol = DT.holidayMap(state.lists), gorev = {};
    m.gorev.forEach(function (g) {
      if (g.bas == null) return;
      var bit = g.bit != null && g.bit >= g.bas ? g.bit : g.bas;
      for (var s = g.bas; s <= bit && s - g.bas < 400; s++) {
        var k = DT.fold(DT.xtrim(g.p)).toUpperCase(); (gorev[s] = gorev[s] || {})[k] = g;
      }
    });
    var bas = m.bas, t = today != null ? today : DT.today(), son = null;
    Object.keys(m.gun).forEach(function (k) {
      var s = +k, g = m.gun[k];
      if (m.bas == null && MS.dolu(g) && (bas == null || s < bas)) bas = s;
      // saat girilen son gün (bugünle sınırlı): bitmemiş ay / dönemde zorunlu saat bu güne kadar sayılır
      if (s <= t && (son == null || s > son)) for (var p in g) if (g[p] && g[p].a && g[p].a.length) { son = s; break; }
    });
    return { m: m, hol: hol, gorev: gorev, bas: bas, son: son, today: t, L: state.lists };
  };
  MS.dolu = function (gunObj) { for (var p in gunObj) if (MS.kayitDolu(gunObj[p])) return true; return false; };
  MS.kayitDolu = function (r) { return !!r && ((r.a && r.a.length) || r.iz || S(r.n).trim() !== '' || r.ara); };
  MS.tatil = function (ctx, s) {
    var ad = ctx.hol[s];
    if (!ad) return null;
    var parca = String(ad).split(' · ');
    var tam = parca.some(function (x) { return fold(x).indexOf('arife') < 0; });
    return { tur: tam ? 'tam' : 'arife', ad: ad };
  };
  MS.hs = function (s) { return DT.weekday(s) >= 6; };
  /** günün zorunlu süresi (dakika), izin hariç */
  MS.zorunluGun = function (ctx, s) {
    if (MS.hs(s)) return 0;
    var t = MS.tatil(ctx, s);
    if (t && t.tur === 'tam') return 0;
    return t && t.tur === 'arife' ? 240 : 480;
  };
  MS.gorevde = function (ctx, s, p) { var g = ctx.gorev[s]; return g ? g[DT.fold(DT.xtrim(p)).toUpperCase()] || null : null; };
  MS.kayit = function (ctx, s, p) {
    var g = ctx.m.gun[s];
    if (!g) return null;
    if (g[p]) return g[p];
    for (var k in g) if (DT.eqi(k, p)) return g[k];
    return null;
  };

  /* ---------------- bir günün hesabı ---------------- */
  /** dakika cinsinden: brut, mola, net, yemek, zorunlu; uyarılar: cakisma, eksikSaat */
  MS.gun = function (ctx, s, p, rec) {
    if (rec === undefined) rec = MS.kayit(ctx, s, p);
    var hs = MS.hs(s), tat = MS.tatil(ctx, s), gor = MS.gorevde(ctx, s, p);
    var a = (rec && rec.a) || [], brut = 0, ilk = null, son = null, cakisma = false, prevEnd = null, eksik = false;
    var sirali = a.filter(function (x) { return x && x[0] != null && x[1] != null; }).slice().sort(function (x, y) { return x[0] - y[0]; });
    if (a.some(function (x) { return x && ((x[0] == null) !== (x[1] == null)); })) eksik = true;
    sirali.forEach(function (x) {
      var d = MS.sure(x[0], x[1]), en = x[0] + d;
      brut += d;
      if (ilk == null) ilk = x[0];
      if (son == null || en > son) son = en;
      if (prevEnd != null && x[0] < prevEnd) cakisma = true;
      prevEnd = prevEnd == null ? en : Math.max(prevEnd, en);
    });
    var ara = rec && rec.ara ? Math.max(0, +rec.ara || 0) : 0;
    brut = Math.max(0, brut - ara);
    var mola = hs ? 0 : brut < 210 ? 0 : brut <= 450 ? 30 : 60;
    var net = brut - mola;
    var temel = hs ? brut : net;
    var yemek = (tat && tat.tur === 'tam') || gor ? 0 : temel >= 600 ? 2 : temel >= 210 ? 1 : 0;
    var zor = MS.zorunluGun(ctx, s), izinDus = 0;
    if (rec && rec.iz && zor) {
      var sa = rec.iz.s != null && rec.iz.s !== '' ? Math.round(+rec.iz.s * 60) : null;
      izinDus = sa == null || isNaN(sa) ? zor : Math.min(zor, Math.max(0, sa));
    }
    return {
      s: s, p: p, rec: rec, hs: hs, tatil: tat, gorev: gor, izin: rec && rec.iz ? rec.iz : null, not: rec ? S(rec.n) : '',
      brut: brut, mola: mola, net: net, yemek: yemek, zorTam: zor, zor: zor - izinDus, ara: ara,
      ilk: ilk, son: son, cakisma: cakisma, eksikGiris: eksik, aralik: sirali,
      tatilNet: tat && tat.tur === 'tam' ? net : 0
    };
  };
  /** 12 saat dinlenme: önceki günün son çıkışı → bu günün ilk girişi (dakika); null: bakılacak bir şey yok */
  MS.dinlenme = function (ctx, s, p, bu, once) {
    bu = bu || MS.gun(ctx, s, p); once = once || MS.gun(ctx, s - 1, p);
    if (bu.ilk == null || once.son == null) return null;
    return 1440 + bu.ilk - once.son;
  };

  /* ---------------- dönem özeti ---------------- */
  // Etkin aralık: takip başlangıcı ile saat girilen son gün (en çok bugün) arasına kırpılır
  MS.etkin = function (ctx, from, to) {
    var a = from, b = Math.min(to, ctx.today);
    if (ctx.son !== undefined) b = ctx.son == null ? -Infinity : Math.min(b, ctx.son);
    if (ctx.bas != null) a = Math.max(a, ctx.bas);
    return a <= b ? { from: a, to: b } : null;
  };
  /** her personel için dönem toplamları (dakika). opt.kirp=false: bugüne / başlangıca kırpma */
  MS.donem = function (ctx, from, to, opt) {
    opt = opt || {};
    var e = opt.kirp === false ? { from: from, to: to } : MS.etkin(ctx, from, to);
    var kisiler = opt.personel || ctx.m.personel;
    var out = kisiler.map(function (p) {
      var r = { p: p, net: 0, netTatil: 0, netNormal: 0, zor: 0, fazla: 0, eksik: 0, brut: 0, mola: 0, yemek: 0, cmt: 0, paz: 0,
        izinGun: 0, gorevGun: 0, gunN: 0, girilmemis: 0, dinlenme: 0, cakisma: 0, eksikGiris: 0, aktif: !!e, gunler: [] };
      if (!e) return r;
      var once = MS.gun(ctx, e.from - 1, p);
      for (var s = e.from; s <= e.to; s++) {
        var g = MS.gun(ctx, s, p);
        // bugün henüz yazılmadıysa zorunluya ve "girilmemiş"e sayılmaz (gün bitmedi)
        var bugunBos = s === ctx.today && !g.rec && !g.gorev && opt.kirp !== false;
        if (bugunBos) g.zor = 0;
        r.brut += g.brut; r.mola += g.mola; r.net += g.net; r.netTatil += g.tatilNet; r.zor += g.zor; r.yemek += g.yemek;
        if (g.brut > 0) {
          r.gunN++;
          if (DT.weekday(s) === 6) r.cmt++;
          if (DT.weekday(s) === 7) r.paz++;
        }
        if (g.izin) r.izinGun++;
        if (g.gorev) r.gorevGun++;
        if (g.zorTam > 0 && !g.rec && !g.gorev && !bugunBos) r.girilmemis++;
        if (g.cakisma) r.cakisma++;
        if (g.eksikGiris) r.eksikGiris++;
        var dn = MS.dinlenme(ctx, s, p, g, once);
        if (dn != null && dn < 720) { r.dinlenme++; g.dinlenme = dn; }
        if (opt.gunler) r.gunler.push(g);
        once = g;
      }
      r.netNormal = r.net - r.netTatil;
      r.fazla = Math.max(0, r.netNormal - r.zor) + r.netTatil;
      r.eksik = Math.max(0, r.zor - r.netNormal);
      return r;
    });
    out.etkin = e;
    return out;
  };
  MS.toplam = function (rows) {
    var t = { p: 'Toplam', net: 0, netTatil: 0, zor: 0, fazla: 0, eksik: 0, yemek: 0, cmt: 0, paz: 0, izinGun: 0, gorevGun: 0, gunN: 0, girilmemis: 0, dinlenme: 0, cakisma: 0 };
    rows.forEach(function (r) { for (var k in t) if (k !== 'p') t[k] += r[k] || 0; });
    return t;
  };

  /* ---------------- hafta ---------------- */
  /** haftalık tablo: her personel için 7 gün + toplamlar; zorunlu haftanın tamamı (takip başlangıcına kırpılır) */
  MS.hafta = function (ctx, ws) {
    var bitti = ws + 6 < ctx.today;
    return ctx.m.personel.map(function (p) {
      var r = { p: p, gunler: [], net: 0, netTatil: 0, zor: 0, fazla: 0, eksik: 0, yemek: 0, dinlenme: 0, cakisma: 0, bitti: bitti };
      var once = MS.gun(ctx, ws - 1, p);
      for (var i = 0; i < 7; i++) {
        var s = ws + i, g = MS.gun(ctx, s, p);
        if (ctx.bas != null && s < ctx.bas) { g.zor = 0; g.zorTam = 0; }
        var dn = MS.dinlenme(ctx, s, p, g, once);
        if (dn != null && dn < 720) { g.dinlenme = dn; r.dinlenme++; }
        if (g.cakisma) r.cakisma++;
        r.net += g.net; r.netTatil += g.tatilNet; r.zor += g.zor; r.yemek += g.yemek;
        r.gunler.push(g); once = g;
      }
      var normal = r.net - r.netTatil;
      r.fazla = Math.max(0, normal - r.zor) + r.netTatil;
      r.eksik = Math.max(0, r.zor - normal);
      r.asim = r.net > ctx.m.ust * 60;
      return r;
    });
  };
  /** DURUM yazısı (Excel'deki DURUM sütununun gelişmiş hâli: haftanın zorunlu saatine göre) */
  MS.durum = function (ctx, r) {
    var t = [];
    if (r.asim) t.push(ctx.m.ust + ' saat aşıldı');
    if (r.bitti && r.eksik > 0) t.push(MS.saat(r.eksik) + ' sa eksik');
    if (r.dinlenme) t.push(r.dinlenme + ' dinlenme');
    if (r.cakisma) t.push('çakışan saat');
    return t.join(' · ');
  };

  /* ---------------- ay ve yıl ---------------- */
  MS.ayAraligi = function (y, m) { return { from: DT.serial(y, m, 1), to: DT.serial(y, m + 1, 1) - 1 }; };
  // sayıya iyelik eki: 1'i, 2'si, 3'ü, 6'sı, 9'u, 10'u, 20'si …
  var EK = ['i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
  MS.ek = function (n) { n = +n; return n % 10 ? EK[n % 10 - 1] : ({ 10: 'u', 20: 'si', 30: 'u' })[n] || 'ı'; };
  MS.gunEk = function (n) { return n + '’' + MS.ek(n); };
  /** kurala göre ay dönemi (aya özel tarih hariç) */
  MS.ayKurali = function (m, y, mo) {
    var g = m.donemGun > 1 ? Math.min(28, m.donemGun) : 1;
    if (g === 1) return { from: DT.serial(y, mo, 1), to: DT.serial(y, mo + 1, 1) - 1 };
    if (m.donemAd === 'bit') return { from: DT.serial(y, mo - 1, g), to: DT.serial(y, mo, g) - 1 };
    return { from: DT.serial(y, mo, g), to: DT.serial(y, mo + 1, g) - 1 };
  };
  /** kullanıcının ay dönemi: aya özel tarih (m.aylar['y-ay']) varsa o, yoksa kural */
  MS.ayDonemi = function (m, y, mo) {
    while (mo < 1) { mo += 12; y--; }
    while (mo > 12) { mo -= 12; y++; }
    var k = y + '-' + mo, o = m.aylar && m.aylar[k], r = MS.ayKurali(m, y, mo);
    var ozel = !!(o && o.bas != null && o.bit != null && o.bas <= o.bit);
    return { y: y, m: mo, k: k, from: ozel ? o.bas : r.from, to: ozel ? o.bit : r.to, ozel: ozel, ayAd: DT.AYLAR[mo - 1], ad: DT.AYLAR[mo - 1] + ' ' + y };
  };
  /** s gününü içeren ay dönemi (aya özel tarihler dahil); boşluktaki gün için sonraki dönem */
  MS.ayBul = function (m, s) {
    var p = DT.parts(s), best = null, a, d;
    for (d = -2; d <= 2; d++) {
      a = MS.ayDonemi(m, p.y, p.m + d);
      if (a.from <= s && s <= a.to && (!best || (a.ozel && !best.ozel))) best = a;
    }
    if (best) return best;
    for (d = -2; d <= 3; d++) { a = MS.ayDonemi(m, p.y, p.m + d); if (a.from > s && (!best || a.from < best.from)) best = a; }
    return best || MS.ayDonemi(m, p.y, p.m);
  };
  /** [from, to] ile kesişen ay dönemleri, aralığa kırpılmış */
  MS.aylarArasi = function (m, from, to) {
    var out = [], a = MS.ayBul(m, from), n = 0;
    while (a.from <= to && n++ < 600) {
      if (a.to >= from) out.push(Object.assign({}, a, { from: Math.max(a.from, from), to: Math.min(a.to, to), tamFrom: a.from, tamTo: a.to }));
      a = MS.ayDonemi(m, a.y, a.m + 1);
    }
    return out;
  };
  /** yılın ay dönemleri arasında boşluk / çakışma uyarıları */
  MS.ayKontrol = function (m, y) {
    var uy = [];
    for (var mo = 0; mo <= 12; mo++) {
      var a = MS.ayDonemi(m, y, mo), b = MS.ayDonemi(m, y, mo + 1);
      if (!a.ozel && !b.ozel) continue;
      var f = b.from - a.to - 1;
      if (f > 0) uy.push(a.ayAd + ' ile ' + b.ayAd + ' arasında ' + f + ' gün hesaba girmiyor');
      else if (f < 0) uy.push(a.ayAd + ' ile ' + b.ayAd + ' ' + (-f) + ' gün çakışıyor');
    }
    return uy;
  };
  /** kuralın yazısı: "Ayın 20’si – ertesi ayın 19’u" */
  MS.kuralYazi = function (m) {
    var g = m.donemGun > 1 ? Math.min(28, m.donemGun) : 1;
    return g === 1 ? 'Takvim ayı (1’i – ay sonu)' : 'Ayın ' + MS.gunEk(g) + ' – ertesi ayın ' + MS.gunEk(g - 1);
  };
  /** Aylık Fazla Mesai: personel × 12 ay (kullanıcının ay dönemleri); etkin olmayan ay null */
  MS.aylik = function (ctx, y) {
    var aylar = [], donemler = [];
    for (var m = 1; m <= 12; m++) {
      var a = MS.ayDonemi(ctx.m, y, m);
      donemler.push(a);
      aylar.push(MS.etkin(ctx, a.from, a.to) ? MS.donem(ctx, a.from, a.to) : null);
    }
    var out = ctx.m.personel.map(function (p, i) {
      var v = aylar.map(function (ay) { return ay ? ay[i].fazla : null; });
      return { p: p, ay: v, yil: v.reduce(function (t, x) { return t + (x || 0); }, 0), tatil: aylar.reduce(function (t, ay) { return t + (ay ? ay[i].netTatil : 0); }, 0) };
    });
    out.donemler = donemler;
    out.etkin = aylar.map(function (ay) { return ay ? ay.etkin : null; });
    return out;
  };
  /** bugünü (base) içeren ay dönemi; k: 0 bu ay, -1 önceki ay … */
  MS.donemAraligi = function (ctx, base, k) {
    var a = MS.ayBul(ctx.m, base);
    return k ? MS.ayDonemi(ctx.m, a.y, a.m + k) : a;
  };

  /* ---------------- görevlendirme ---------------- */
  MS.gorevOzet = function (ctx, from, to) {
    return ctx.m.personel.map(function (p) {
      var r = { p: p, n: 0, tasima: 0, kalmali: 0, gece: 0, gunubirlik: 0 };
      ctx.m.gorev.forEach(function (g) {
        if (!DT.eqi(g.p, p) || g.bas == null || g.bas < from || g.bas > to) return;
        var bit = g.bit != null && g.bit >= g.bas ? g.bit : g.bas;
        r.n++;
        if (/ta[sş][iı]ma/.test(fold(g.tur))) r.tasima++;
        if (bit > g.bas) { r.kalmali++; r.gece += bit - g.bas; } else r.gunubirlik++;
      });
      return r;
    });
  };

  /* ---------------- kayıt yazma ---------------- */
  MS.yaz = function (state, s, p, rec) {
    var m = MS.hazirla(state), k = String(s);
    var temiz = null;
    if (rec) {
      var a = (rec.a || []).filter(function (x) { return x && x[0] != null && x[1] != null; }).map(function (x) { return [x[0], x[1]]; })
        .sort(function (x, y) { return x[0] - y[0]; });
      temiz = {};
      if (a.length) temiz.a = a;
      if (rec.ara) temiz.ara = rec.ara;
      if (rec.iz && rec.iz.t) temiz.iz = rec.iz.s != null && rec.iz.s !== '' && !isNaN(+rec.iz.s) ? { t: rec.iz.t, s: +rec.iz.s } : { t: rec.iz.t };
      if (S(rec.n).trim()) temiz.n = S(rec.n).trim();
      if (!MS.kayitDolu(temiz)) temiz = null;
    }
    if (temiz) { (m.gun[k] = m.gun[k] || {})[p] = temiz; }
    else if (m.gun[k]) { delete m.gun[k][p]; if (!Object.keys(m.gun[k]).length) delete m.gun[k]; }
  };
  MS.ayni = function (x, y) {
    var a = x && x.a ? x.a : [], b = y && y.a ? y.a : [];
    if (a.length !== b.length) return false;
    // 24:00 ile 00:00 aynı andır (çıkış 00:00 = gece yarısı)
    for (var i = 0; i < a.length; i++) if (a[i][0] % 1440 !== b[i][0] % 1440 || a[i][1] % 1440 !== b[i][1] % 1440) return false;
    return (x && x.ara || 0) === (y && y.ara || 0);
  };
  MS.aralikYazi = function (rec) {
    if (!rec) return '';
    var t = (rec.a || []).map(function (x) { return MS.hhmm(x[0]) + '–' + MS.hhmm(x[1] === 0 ? 1440 : x[1]); }).join(', ');
    if (rec.ara) t += (t ? ' ' : '') + '(ara ' + MS.hhmm(rec.ara) + ')';
    return t;
  };

  /** boş iş günlerini standart mesaiyle doldurma adayları (tatil, izin, görev ve kaydı olan günler hariç) */
  MS.standartAdaylar = function (ctx, from, to) {
    var out = [];
    for (var s = from; s <= Math.min(to, ctx.today); s++) {
      if (MS.zorunluGun(ctx, s) !== 480) continue;
      if (ctx.bas != null && s < ctx.bas) continue;
      ctx.m.personel.forEach(function (p) { if (!MS.kayit(ctx, s, p) && !MS.gorevde(ctx, s, p)) out.push({ s: s, p: p }); });
    }
    return out;
  };

  /* ================= Excel'den: Personel_Mesai_Takip.xlsx ================= */
  // Sütunlar başlıklardan bulunur: haftalık bloklardaki "Giriş 1 / Çıkış 1 …" satırı günleri, A sütunu haftanın
  // pazartesisini, B sütunu personeli verir. Eski sürümlerdeki tek giriş–çıkış + ARA düzeni de okunur.
  var UPPER = function (t) { return DT.xtrim(t).toLocaleUpperCase('tr-TR'); };
  function hucreMetni(c) { return c && c.v != null ? String(c.v) : ''; }
  function hucreSaat(c) {
    if (!c || c.v == null || c.v === '') return null;
    if (typeof c.v === 'number') { var v = c.v; if (v > 1) v = v - Math.floor(v); return v < 0 ? null : Math.round(v * 1440); }
    return MS.saatOku(String(c.v));
  }
  var GUN_ON = { pzt: 0, pts: 0, sal: 1, car: 2, çar: 2, per: 3, cum: 4, cmt: 5, cts: 5, paz: 6 };
  /** nottaki izin: saat yoksa yalnızca o gün hiç giriş–çıkış yoksa izin sayılır; "Mazeret izni 2 sa" saatlik izindir */
  function izinOku(not, saatVar) {
    var f = fold(not);
    if (!/mazeret|izin|rapor/.test(f)) return null;
    var sa = /(\d+(?:[.,]\d+)?)\s*(?:sa|saat)\b/.exec(f), s = sa ? +sa[1].replace(',', '.') : null;
    if (saatVar && s == null) return null;
    var t = /rapor/.test(f) ? 'rapor' : /yillik/.test(f) ? 'yillik' : /idari/.test(f) ? 'idari' : /mazeret/.test(f) ? 'mazeret' : 'diger';
    return s != null && s > 0 && s < 24 ? { t: t, s: s } : { t: t };
  }
  MS.mesaiTablosu = function (sh, gsh) {
    var satirlar = Object.keys(sh || {}).map(Number).sort(function (a, b) { return a - b; });
    var etiketler = [];
    satirlar.forEach(function (r) {
      var row = sh[r], lab = [];
      Object.keys(row).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
        var m = /^(GIRIS|CIKIS)\s*(\d)?$/.exec(DT.normKey(hucreMetni(row[c])));
        if (m) lab.push({ c: c, k: m[1] === 'GIRIS' ? 'g' : 'c', n: m[2] ? +m[2] : null });
      });
      if (lab.length < 7) return;
      var gunler = [], cur = null, bek = null;
      lab.forEach(function (l) {
        if (l.k === 'g') { if (!cur || l.n == null || l.n === 1) { cur = []; gunler.push(cur); } bek = l; }
        else if (bek && cur) { cur.push([bek.c, l.c]); bek = null; }
      });
      if (gunler.length < 7) return;
      var e = { r: r, gunler: gunler.slice(0, 7), not: null, ara: null, tarih: null };
      for (var rt = r; rt >= r - 3 && e.tarih == null; rt--) { var at = sh[rt] && sh[rt][1]; if (at && typeof at.v === 'number' && at.v > 40000 && at.v < 60000) e.tarih = Math.floor(at.v); }
      for (var rr = r; rr >= r - 2; rr--) {
        var row2 = sh[rr]; if (!row2) continue;
        Object.keys(row2).forEach(function (c) {
          var t = DT.normKey(hucreMetni(row2[c]));
          if (e.not == null && t === 'NOT') e.not = +c;
          if (e.ara == null && /^ARA\b/.test(t)) e.ara = +c;
        });
      }
      etiketler.push(e);
    });
    if (!etiketler.length) throw new Error('Mesai Takip sayfasında “Giriş / Çıkış” başlıkları bulunamadı.');
    var gun = {}, kisiler = [], ilkHafta = null, aralikN = 0, gunN = 0, ilk = null, son = null, uyari = [];
    var ei = 0;
    satirlar.forEach(function (r) {
      while (ei + 1 < etiketler.length && etiketler[ei + 1].r < r) ei++;
      var e = etiketler[ei];
      if (!e || r <= e.r) return;
      var row = sh[r], a = row[1], b = row[2];
      var aSayi = a && typeof a.v === 'number' && a.v > 40000 && a.v < 60000;
      if (!aSayi && (e.tarih == null || (a && hucreMetni(a).trim()))) return;
      var ad = UPPER(hucreMetni(b));
      if (!ad || !/^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ .'-]{0,30}$/.test(ad) || /HAFTA|TOPLAM|PERSONEL|ZORUNLU/.test(ad)) return;
      var ws = aSayi ? Math.floor(a.v) : e.tarih, notlar = {}, genelNot = [];
      if (e.not != null && row[e.not]) {
        hucreMetni(row[e.not]).split(/\s+·\s+(?=[A-Za-zÇĞİÖŞÜçğıöşü]{3}\s*:)|\n/).forEach(function (parca) {
          var m = /^\s*([A-Za-zÇĞİÖŞÜçğıöşü]{3})\s*:\s*(.+)$/.exec(parca);
          var k = m ? GUN_ON[fold(m[1]).slice(0, 3)] : null;
          if (k != null) (notlar[k] = notlar[k] || []).push(m[2].trim()); else if (parca.trim()) genelNot.push(parca.trim());
        });
      }
      var satirDolu = false;
      e.gunler.forEach(function (ciftler, d) {
        var aralik = [];
        ciftler.forEach(function (gc) {
          var g = hucreSaat(row[gc[0]]), c = hucreSaat(row[gc[1]]);
          if (g != null && c != null) aralik.push([g, c]);
          else if (g != null || c != null) uyari.push(ad + ' ' + DT.fmt(ws + d) + ': giriş ya da çıkış eksik');
        });
        var ara = null;
        if (e.ara != null && ciftler.length === 1) { var av = row[e.ara + d]; if (av && typeof av.v === 'number' && av.v > 0 && av.v < 1) ara = Math.round(av.v * 1440); }
        var not = (notlar[d] || []).join(' · ');
        if (!aralik.length && !not) return;
        if (!aralik.length && notlar[d] == null) return;
        var s = ws + d, rec = {};
        if (aralik.length) { rec.a = aralik.sort(function (x, y) { return x[0] - y[0]; }); aralikN += aralik.length; }
        if (ara) rec.ara = ara;
        if (not) rec.n = not;
        var iz = izinOku(not, aralik.length > 0);
        if (iz) { rec.iz = iz; if (fold(not).replace(/\d+(?:[.,]\d+)?\s*(?:sa|saat)\b/, '').trim() === fold(MS.izinAd(iz.t)).trim()) delete rec.n; }
        (gun[s] = gun[s] || {})[ad] = rec;
        gunN++; satirDolu = true;
        if (ilk == null || s < ilk) ilk = s;
        if (son == null || s > son) son = s;
      });
      if (satirDolu && genelNot.length) {
        for (var d = 0; d < 7; d++) { var k = gun[ws + d] && gun[ws + d][ad]; if (k) { k.n = (k.n ? k.n + ' · ' : '') + genelNot.join(' · '); break; } }
      }
      if (kisiler.indexOf(ad) < 0) kisiler.push(ad);
      if (ilkHafta == null || ws < ilkHafta) ilkHafta = ws;
    });
    // Görevlendirme
    var gorev = [];
    if (gsh) {
      var gs = Object.keys(gsh).map(Number).sort(function (a, b) { return a - b; }), hr = null, col = {};
      for (var i = 0; i < gs.length && hr == null; i++) {
        var row = gsh[gs[i]], t = {};
        Object.keys(row).forEach(function (c) { t[c] = DT.normKey(hucreMetni(row[c])); });
        var ks = Object.keys(t);
        if (ks.some(function (c) { return /^PERSONEL/.test(t[c]); }) && ks.some(function (c) { return /^BASLANGIC/.test(t[c]); })) {
          hr = gs[i];
          ks.forEach(function (c) {
            var x = t[c];
            if (col.p == null && /^PERSONEL/.test(x)) col.p = +c;
            else if (col.bas == null && /^BASLANGIC/.test(x)) col.bas = +c;
            else if (col.bit == null && /^BITIS/.test(x)) col.bit = +c;
            else if (col.tur == null && /TUR/.test(x)) col.tur = +c;
            else if (col.yer == null && /^(YER|GIDILEN|SEHIR|IL\b|GUZERGAH)/.test(x)) col.yer = +c;
            else if (col.not == null && /^(NOT|ACIKLAMA)/.test(x)) col.not = +c;
          });
        }
      }
      if (hr != null) gs.forEach(function (r) {
        if (r <= hr) return;
        var row = gsh[r], p = UPPER(hucreMetni(row[col.p])), bas = root.XLSXIO.cellDate(row[col.bas]);
        if (!p || bas == null || bas < 40000) return;
        var bit = col.bit != null ? root.XLSXIO.cellDate(row[col.bit]) : null;
        gorev.push({ id: DT.uid(), p: p, bas: bas, bit: bit != null && bit >= bas ? bit : bas, tur: col.tur != null ? DT.xtrim(hucreMetni(row[col.tur])) : '',
          yer: col.yer != null ? DT.xtrim(hucreMetni(row[col.yer])) : '', not: col.not != null ? DT.xtrim(hucreMetni(row[col.not])) : '' });
      });
    }
    return { gun: gun, gorev: gorev, personel: kisiler, ilkHafta: ilkHafta, rapor: { gun: gunN, aralik: aralikN, kisi: kisiler.length, ilk: ilk, son: son, gorev: gorev.length, uyari: uyari } };
  };
  MS.importWorkbook = function (buf) {
    var X = root.XLSXIO;
    return X.openWorkbook(buf).then(function (wb) {
      var bul = function (ad) { return wb.sheetNames.filter(function (n) { return fold(n).replace(/\s+/g, ' ').trim() === ad; })[0]; };
      var mt = bul('mesai takip'), gv = bul('görevlendirme');
      if (!mt) throw new Error("Bu dosyada 'Mesai Takip' sayfası yok.");
      return Promise.all([wb.sheet(mt, { maxCol: 64 }), gv ? wb.sheet(gv, { maxCol: 24 }) : null]);
    }).then(function (r) { return MS.mesaiTablosu(r[0], r[1]); });
  };
  /** içe aktarılanı mevcut kayıtlarla karşılaştır: yeni / aynı / farklı */
  MS.karsilastir = function (state, gun) {
    var m = MS.hazirla(state), n = { yeni: 0, ayni: 0, farkli: 0 };
    Object.keys(gun).forEach(function (s) {
      Object.keys(gun[s]).forEach(function (p) {
        var cur = m.gun[s] && m.gun[s][p];
        if (!cur) n.yeni++; else if (MS.ayni(cur, gun[s][p]) && S(cur.n) === S(gun[s][p].n)) n.ayni++; else n.farkli++;
      });
    });
    return n;
  };
  /** içe aktarılan günleri yaz (aynı personel-gün değiştirilir); görevlendirmeleri ekle (aynısı varsa atlanır) */
  MS.uygula = function (state, res) {
    var m = MS.hazirla(state);
    Object.keys(res.gun).forEach(function (s) { Object.keys(res.gun[s]).forEach(function (p) { MS.yaz(state, +s, p, res.gun[s][p]); }); });
    var eklenen = 0;
    (res.gorev || []).forEach(function (g) {
      if (m.gorev.some(function (x) { return DT.eqi(x.p, g.p) && x.bas === g.bas && x.bit === g.bit; })) return;
      m.gorev.push(g); eklenen++;
    });
    (res.personel || []).forEach(function (p) { if (!m.personel.some(function (x) { return DT.eqi(x, p); })) m.personel.push(p); });
    if (res.ilkHafta != null && (m.bas == null || res.ilkHafta < m.bas)) m.bas = res.ilkHafta;
    return eklenen;
  };

  /* ================= WhatsApp yazışmasından ================= */
  // "Sohbeti dışa aktar" (.txt / .zip) ya da kopyalanan mesajlar: gönderen personele, mesajdaki tarih ve
  // "08:00-17:00" biçimindeki aralıklar güne eşlenir. Mazeret / izin yazan satırlardaki saatler mesai sayılmaz.
  var GORUNMEZ = /[‎‏‪-‮⁦-⁩﻿]/g;
  var BAS_ANDROID = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*[-–]\s*([^:]{1,60}?):\s?([\s\S]*)$/;
  var BAS_IOS = /^\[(\d{1,2})[./](\d{1,2})[./](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\]\s*([^:]{1,60}?):\s?([\s\S]*)$/;
  MS.waMesajlar = function (metin) {
    var out = [], cur = null;
    String(metin || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (satir) {
      var t = satir.replace(GORUNMEZ, '');
      var m = BAS_IOS.exec(t.trim()) || BAS_ANDROID.exec(t.trim());
      if (m) {
        var y = +m[3]; if (y < 100) y += 2000;
        cur = { s: DT.serial(y, +m[2], +m[1]), saat: pad(+m[4]) + ':' + m[5], kim: DT.xtrim(m[6].replace(/^~\s*/, '')), govde: m[7] };
        out.push(cur);
      } else if (cur) cur.govde += '\n' + t;
    });
    return out;
  };
  /** gönderen adı → personel (ilk ad ya da adın içinde geçen personel adı) */
  MS.waKisi = function (kim, personel, harita) {
    if (harita && harita[kim] !== undefined) return harita[kim] || null;
    var parca = UPPER(kim).replace(/[^A-ZÇĞİÖŞÜ ]/g, ' ').split(/\s+/).filter(Boolean);
    for (var i = 0; i < parca.length; i++) for (var j = 0; j < personel.length; j++) if (DT.eqi(parca[i], personel[j]) || DT.normKey(parca[i]) === DT.normKey(personel[j])) return personel[j];
    return null;
  };
  var RE_COKGUN = /(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s+(\d{1,2})[:.](\d{2})\s*[-–—]+\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s+(\d{1,2})[:.](\d{2})/;
  var RE_TARIH = /(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)/;
  var RE_KISA_TARIH = /(^|[^\d:.])(\d{1,2})[./](\d{1,2})\s+(?=\d{1,2}[:.]\d{2}\s*[-–—])/;
  var RE_ARALIK = /(\d{1,2})[:.](\d{2})\s*[-–—]+\s*(\d{1,2})[:.](\d{2})/g;
  function gecerliSaat(h, m) { return h <= 24 && m <= 59 && !(h === 24 && m > 0); }
  function tarihDuzelt(s, msgS, uyari, yazilan, kesin) {
    if (kesin === false || Math.abs(s - msgS) <= 20) return s;
    var p = DT.parts(s), q = DT.parts(msgS), aday = DT.serial(q.y, q.m, p.d);
    if (aday > msgS) aday = DT.serial(q.y, q.m - 1, p.d);
    if (Math.abs(aday - msgS) <= 7) { uyari.push('tarih düzeltildi (yazılan ' + yazilan + ')'); return aday; }
    uyari.push('mesaj tarihinden uzak: ' + yazilan);
    return s;
  }
  /** bir mesajdan günler: [{ s, a: [[g,c]], cokGun, uyari: [], izinSatiri }] */
  MS.waAyikla = function (msg) {
    var gunler = {}, sira = [], curS = null;
    var ekle = function (s, a, ek) {
      var g = gunler[s];
      if (!g) { g = gunler[s] = { s: s, a: [], uyari: [], cokGun: false }; sira.push(s); }
      a.forEach(function (x) { if (!g.a.some(function (y) { return y[0] === x[0] && y[1] === x[1]; })) g.a.push(x); });
      if (ek) Object.keys(ek).forEach(function (k) { if (k === 'uyari') g.uyari = g.uyari.concat(ek.uyari); else g[k] = ek[k]; });
    };
    msg.govde.split('\n').forEach(function (satir) {
      var lf = fold(satir), uy = [];
      var izin = /mazeret|izin|rapor/.test(lf);
      var cg = RE_COKGUN.exec(satir);
      if (cg && !izin) {
        var y1 = cg[3] ? +cg[3] : DT.parts(msg.s).y, y2 = cg[8] ? +cg[8] : y1;
        if (y1 < 100) y1 += 2000; if (y2 < 100) y2 += 2000;
        var s1 = DT.serial(y1, +cg[2], +cg[1]), s2 = DT.serial(y2, +cg[7], +cg[6]);
        var t1 = +cg[4] * 60 + +cg[5], t2 = +cg[9] * 60 + +cg[10];
        if (s2 >= s1 && s2 - s1 <= 6 && gecerliSaat(+cg[4], +cg[5]) && gecerliSaat(+cg[9], +cg[10])) {
          for (var s = s1; s <= s2; s++) ekle(s, [[s === s1 ? t1 : 0, s === s2 ? t2 : 0]], { cokGun: true, uyari: s === s1 ? ['çok günlük kesintisiz görev: ' + DT.fmtShort(s1) + ' ' + MS.hhmm(t1) + ' – ' + DT.fmtShort(s2) + ' ' + MS.hhmm(t2)] : [] });
          curS = s2;
          return;
        }
      }
      var kalan = satir, dm = RE_TARIH.exec(kalan);
      if (dm) {
        var yy = +dm[3]; if (yy < 100) yy += 2000;
        curS = tarihDuzelt(DT.serial(yy, +dm[2], +dm[1]), msg.s, uy, dm[0], msg.tarihKesin);
        kalan = kalan.replace(dm[0], ' ');
      } else {
        var km = RE_KISA_TARIH.exec(kalan);
        if (km) { curS = tarihDuzelt(DT.serial(DT.parts(msg.s).y, +km[3], +km[2]), msg.s, uy, km[2] + '.' + km[3], msg.tarihKesin); kalan = kalan.replace(km[0], km[1] + ' '); }
      }
      var a = [], m;
      RE_ARALIK.lastIndex = 0;
      while ((m = RE_ARALIK.exec(kalan))) {
        if (!gecerliSaat(+m[1], +m[2]) || !gecerliSaat(+m[3], +m[4])) continue;
        a.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]);
      }
      if (!a.length) return;
      var hedef = curS != null ? curS : msg.s, tahmin = curS == null && msg.tarihKesin === false ? { tahmin: true } : null;
      if (izin) { ekle(hedef, [], Object.assign({ izinSatiri: DT.xtrim(satir), uyari: ['mazeret / izin saatleri mesai sayılmadı: ' + DT.xtrim(satir)] }, tahmin)); return; }
      ekle(hedef, a, Object.assign({ uyari: uy }, tahmin));
    });
    return sira.map(function (s) { return gunler[s]; });
  };
  /**
   * WhatsApp metninden personel-gün kayıtları. Aynı kişi aynı gün için birden çok mesaj yazdıysa sonuncusu alınır.
   * dönüş: { satirlar: [{ s, p, a, kaynak, uyari, cokGun, mevcut, durum }], bilinmeyen: { ad: mesaj sayısı }, mesaj }
   */
  MS.whatsapp = function (state, metin, opt) {
    opt = opt || {};
    var m = MS.hazirla(state), personel = opt.personel || m.personel, harita = Object.assign({}, m.harita, opt.harita || {});
    var mesajlar = opt.mesajlar || MS.waMesajlar(metin), bilinmeyen = {}, kayit = {}, sira = [];
    mesajlar.forEach(function (msg) {
      var p = MS.waKisi(msg.kim, personel, harita);
      var gunler = MS.waAyikla(msg);
      if (!gunler.length) return;
      if (!p) { bilinmeyen[msg.kim] = (bilinmeyen[msg.kim] || 0) + 1; return; }
      gunler.forEach(function (g) {
        if (opt.from != null && g.s < opt.from) return;
        if (opt.to != null && g.s > opt.to) return;
        var k = g.s + '|' + p, eski = kayit[k];
        var kaynak = DT.xtrim((msg.goster != null ? msg.goster : msg.govde).replace(/\n/g, ' · ')).slice(0, 140);
        if (eski && eski.msgS === msg.s && eski.saat === msg.saat && !msg.ekran) {
          g.a.forEach(function (x) { if (!eski.a.some(function (y) { return y[0] === x[0] && y[1] === x[1]; })) eski.a.push(x); });
          return;
        }
        // aynı saatler ikinci kez (üst üste binen ekran görüntüleri): uyarısız geç
        if (eski && JSON.stringify(eski.a) === JSON.stringify(g.a) && (eski.izinSatiri || null) === (g.izinSatiri || null)) return;
        var r = { s: g.s, p: p, a: g.a.slice(), uyari: g.uyari.slice(), cokGun: g.cokGun, izinSatiri: g.izinSatiri || null, kaynak: kaynak,
          msgS: msg.s, saat: msg.saat, kim: msg.kim, tahmin: !!g.tahmin, gi: msg.gi };
        if (g.tahmin) r.uyari.push(msg.tarihElle ? 'tarih elle seçildi: ' + DT.fmt(g.s) : 'tarih mesajda ve ekranda görünmüyor: ' + DT.fmt(g.s) + ' alındı');
        if (eski) r.uyari.unshift('aynı gün için ' + (eski.tekrar ? eski.tekrar + 1 : 2) + '. mesaj; sonuncusu alındı'), r.tekrar = (eski.tekrar || 1) + 1;
        else sira.push(k);
        kayit[k] = r;
      });
    });
    var ctx = MS.ctx(state);
    var satirlar = sira.map(function (k) {
      var r = kayit[k];
      r.a.sort(function (x, y) { return x[0] - y[0]; });
      if (!r.a.length && r.izinSatiri) { r.rec = { iz: { t: 'mazeret' }, n: r.izinSatiri }; }
      else r.rec = { a: r.a, n: r.izinSatiri ? r.izinSatiri : '' };
      r.mevcut = MS.kayit(ctx, r.s, r.p);
      r.durum = !r.mevcut ? 'yeni' : MS.ayni(r.mevcut, r.rec) ? 'ayni' : 'farkli';
      return r;
    }).sort(function (x, y) { return x.s - y.s || personel.indexOf(x.p) - personel.indexOf(y.p); });
    return { satirlar: satirlar, bilinmeyen: bilinmeyen, mesaj: mesajlar.length };
  };
  /** .txt ya da .zip (WhatsApp dışa aktarma) → metin */
  MS.waMetin = function (buf) {
    var u8 = new Uint8Array(buf);
    if (u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b) {
      var zip = root.XLSXIO.readZip(buf);
      var ad = zip.names.filter(function (n) { return /\.txt$/i.test(n); }).sort(function (a, b) { return (/_chat\.txt$|whatsapp/i.test(b) ? 1 : 0) - (/_chat\.txt$|whatsapp/i.test(a) ? 1 : 0); })[0];
      if (!ad) return Promise.reject(new Error('Zip dosyasında sohbet metni (.txt) yok.'));
      return zip.text(ad);
    }
    return Promise.resolve(new TextDecoder('utf-8').decode(u8));
  };

  /* ================= Ekran görüntüsünden (telefonda metin okuma) =================
   * Girdi: [{ ad, zaman (ms), w, h, satirlar: [{ t, x, y, w, h, e: [{ t, x, y, w, h }] }] }] — Android ML Kit satırları ve kelimeleri.
   * WhatsApp ekranı: ortadaki tarih ayracı (Bugün, Dün, Salı, 25 Kasım 2026), balonun üstündeki gönderen adı, mesaj, sağ alttaki saat.
   * Liste / tablo: satır personel adıyla başlıyorsa saatler o kişiye yazılır ("AHMET 08:00 17:00").
   * Çıktı: MS.whatsapp için mesaj listesi { s, saat, kim, govde, tarihKesin, ekran }.
   */
  var GUN_ADI = { pazartesi: 1, sali: 2, carsamba: 3, persembe: 4, cuma: 5, cumartesi: 6, pazar: 7,
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
  var AY_ADI = { ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  MS.EKRAN_SIZ = 'Siz (kendi mesajınız)';
  MS.EKRAN_YOK = '(gönderen görünmüyor)';
  MS.ekranYok = function (k) { return S(k).indexOf(MS.EKRAN_YOK) === 0; };
  function ascii(t) {
    return fold(t).replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/û/g, 'u');
  }
  /** ekran görüntüsünün günü: dosya adından (Screenshot_20261126-184012…), yoksa dosya zamanından, yoksa bugün */
  MS.ekranTarihi = function (ad, zaman, today) {
    var m = /(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)/.exec(S(ad));
    if (m) return { s: DT.serial(+m[1], +m[2], +m[3]), kaynak: 'ad' };
    if (zaman > 0) { var d = new Date(zaman); return { s: DT.serial(d.getFullYear(), d.getMonth() + 1, d.getDate()), kaynak: 'zaman' }; }
    return { s: today, kaynak: 'bugun' };
  };
  /** WhatsApp tarih ayracı → gün (ref: ekran görüntüsünün günü) */
  MS.ayracTarihi = function (t, ref) {
    var a = ascii(t).replace(/[^a-z0-9./ ]/g, ' ').replace(/\s+/g, ' ').trim(), m;
    if (!a) return null;
    if (a === 'bugun' || a === 'today') return ref;
    if (a === 'dun' || a === 'yesterday') return ref - 1;
    if (GUN_ADI[a]) { var fark = (DT.weekday(ref) - GUN_ADI[a] + 7) % 7; return ref - (fark || 7); }
    if ((m = /^(\d{1,2}) ([a-z]+)(?: (\d{4}))?(?: [a-z]+)?$/.exec(a)) && AY_ADI[m[2]]) {
      var y = m[3] ? +m[3] : DT.parts(ref).y, s = DT.serial(y, AY_ADI[m[2]], +m[1]);
      if (!m[3] && s > ref) s = DT.serial(y - 1, AY_ADI[m[2]], +m[1]);
      return s;
    }
    if ((m = /^([a-z]+) (\d{1,2}) (\d{4})$/.exec(a)) && AY_ADI[m[1]]) return DT.serial(+m[3], AY_ADI[m[1]], +m[2]);
    if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})$/.exec(a))) { var yy = +m[3]; if (yy < 100) yy += 2000; return DT.serial(yy, +m[2], +m[1]); }
    return null;
  };
  /** okuma hatalarını düzelt: tire çeşitleri, "08 : 00", "O8:00", "0800-1700" */
  MS.ocrDuzelt = function (t) {
    return S(t).replace(GORUNMEZ, '')
      .replace(/[–—−‑‒﹣－]/g, '-')
      .replace(/(\d)\s*[;：]\s*(\d)/g, '$1:$2')
      .replace(/\b[Oo](\d)([:.]\d{2})/g, '0$1$2')
      .replace(/(\d{1,2})([:.])[Oo](\d)/g, '$1$20$3')
      .replace(/(\d{1,2})\s*:\s+(\d{2})(?!\d)/g, '$1:$2')
      .replace(/(\d{1,2})\s+:\s*(\d{2})(?!\d)/g, '$1:$2')
      .replace(/(^|[^\d:.])([01]\d|2[0-4])([0-5]\d)\s*-\s*([01]\d|2[0-4])([0-5]\d)(?![\d:.])/g, '$1$2:$3-$4:$5');
  };
  var RE_SAATK = /(^|[^\d.:])(\d{1,2})([:.])(\d{2})(?![\d:]|\.\d)/g;
  function aralikVar(t) {
    var m, v = false, x = MS.ocrDuzelt(t);
    RE_ARALIK.lastIndex = 0;
    while ((m = RE_ARALIK.exec(x))) if (gecerliSaat(+m[1], +m[2]) && gecerliSaat(+m[3], +m[4])) { v = true; break; }
    RE_ARALIK.lastIndex = 0;
    return v;
  }
  /** tire olmadan yazılmış iki saat ("08:00 17:00", "giriş 08.00 çıkış 17.00") → "08:00-17:00" */
  function saatEsle(t) {
    if (aralikVar(t)) return t;
    var f = ascii(t), gc = /giris\D{0,12}?(\d{1,2})[:.](\d{2})[\s\S]{0,40}?cikis\D{0,12}?(\d{1,2})[:.](\d{2})/.exec(f);
    if (gc) return t + '\n' + gc[1] + ':' + gc[2] + '-' + gc[3] + ':' + gc[4];
    // tarihler çıkarılır; "08.10" gibi noktalı ve ay sanılabilecek (dakika 01–12) yazımlar sayılmaz
    var z = [], m, tt = t.replace(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/g, ' ');
    RE_SAATK.lastIndex = 0;
    while ((m = RE_SAATK.exec(tt))) {
      if (!gecerliSaat(+m[2], +m[4])) continue;
      if (m[3] === '.' && +m[4] >= 1 && +m[4] <= 12) continue;
      z.push(m[2] + ':' + m[4]);
    }
    return z.length === 2 ? t + '\n' + z[0] + '-' + z[1] : t;
  }
  function saatMi(t) { return /^\d{1,2}[:.]\d{2}$/.test(t); }
  // mesaj balonunun saati: tek başına satır ya da satırın sonundaki küçük saat (✓✓ okunabilir)
  var RE_TIK = /[\s✓✔√vVwW/\\~ﾉ'"’`.,]+$/;
  function damgaAyir(r, medH) {
    var t = r.tt.replace(/\b(düzenlendi|duzenlendi|edited)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    var sade = t.replace(/\s*(öö|ös|oo|os|am|pm)\b/gi, '').replace(RE_TIK, '');
    if (saatMi(sade)) return { yalniz: true, damga: sade.replace('.', ':') };
    var e = (r.e || []).filter(function (x) { return S(x.t).trim(); });
    while (e.length > 1 && !/\d/.test(e[e.length - 1].t) && S(e[e.length - 1].t).replace(RE_TIK, '') === '') e = e.slice(0, -1);
    if (e.length < 2) return { t: t };
    var son = e[e.length - 1], st = S(son.t).replace(RE_TIK, '');
    if (!saatMi(st)) return { t: t };
    var onceki = S(e[e.length - 2].t);
    if (/[-–—]$/.test(onceki)) return { t: t };                                  // aralığın bitişi
    // boy karşılaştırması rakamlı parçalarla (harflerin çıkıntıları kutuyu büyütür); rakam yoksa bütün parçalarla
    var ref = e.slice(0, -1).filter(function (x) { return /\d/.test(x.t); });
    if (!ref.length) ref = e.slice(0, -1);
    var hs = ref.map(function (x) { return x.h; }).sort(function (a, b) { return a - b; }), mh = hs[Math.floor(hs.length / 2)] || medH;
    var kucuk = son.h < 0.84 * mh, once = e[e.length - 2], bosluk = son.x - (once.x + once.w);
    var aralikOnce = aralikVar(e.slice(0, -1).map(function (x) { return x.t; }).join(' ')) && bosluk >= 0.8 * son.h;
    if (!kucuk && !aralikOnce) return { t: t };
    var i = t.lastIndexOf(son.t);
    return { t: (i > 0 ? t.slice(0, i) : t).trim(), damga: st.replace('.', ':') };
  }
  /** satır gönderen adı mı: 'kesin' (personel adı, telefon), 'aday' (Başlık Biçimi kısa satır) ya da null */
  function isimTuru(t, P) {
    var tt = S(t).trim();
    if (!tt || /\d{1,2}[:.]\d{2}/.test(tt)) return null;
    if (/^\+?\d[\d\s()-]{8,}\d(\s*~.*)?$/.test(tt) || /^~\s*\S/.test(tt)) return 'kesin';
    if (/[,;:!?@#%]/.test(tt) || /\d/.test(tt)) return null;
    var kel = tt.split(/\s+/);
    if (kel.length > 4) return null;
    if (/^(siz|you)$/i.test(tt)) return 'kesin';
    if (kel.length <= 3 && kel.some(function (k) { return P[DT.normKey(k.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, ''))]; })) return 'kesin';
    return kel.every(function (k) { return /^[A-ZÇĞİÖŞÜ][a-zçğıöşü.'’-]*$|^[A-ZÇĞİÖŞÜ]{2,}$/.test(k); }) ? 'aday' : null;
  }
  /** OCR satırlarını görünür satırlara birleştir (aynı yükseklikteki parçalar soldan sağa) */
  function ekranSatirlari(img) {
    var L = (img.satirlar || []).filter(function (l) { return S(l.t).trim(); }).map(function (l) {
      var e = l.e && l.e.length ? l.e : [{ t: l.t, x: l.x, y: l.y, w: l.w, h: l.h }];
      return { t: S(l.t), x: +l.x || 0, y: +l.y || 0, w: +l.w || 0, h: +l.h || 1, e: e };
    });
    L.sort(function (a, b) { return (a.y + a.h / 2) - (b.y + b.h / 2); });
    var rows = [];
    L.forEach(function (l) {
      var cy = l.y + l.h / 2, hedef = null;
      for (var i = rows.length - 1; i >= 0 && i >= rows.length - 4; i--) {
        var r = rows[i];
        if (Math.abs(r.cy - cy) < 0.5 * Math.min(r.h, l.h) && !r.p.some(function (q) { return q.x < l.x + l.w && l.x < q.x + q.w; })) { hedef = r; break; }
      }
      if (hedef) { hedef.p.push(l); hedef.x = Math.min(hedef.x, l.x); hedef.r = Math.max(hedef.r, l.x + l.w); hedef.h = Math.max(hedef.h, l.h); }
      else rows.push({ cy: cy, h: l.h, x: l.x, r: l.x + l.w, y: l.y, p: [l] });
    });
    rows.forEach(function (r) {
      r.p.sort(function (a, b) { return a.x - b.x; });
      r.e = [].concat.apply([], r.p.map(function (q) { return q.e; }));
      r.tt = DT.xtrim(r.p.map(function (q) { return q.t; }).join(' ').replace(GORUNMEZ, ''));
    });
    return rows;
  }
  MS.ekran = function (goruntuler, state, opt) {
    opt = opt || {};
    var m = MS.hazirla(state), today = opt.today != null ? opt.today : DT.today(), P = {};
    m.personel.forEach(function (p) { P[DT.normKey(p)] = p; });
    var mesajlar = [], okunan = [], varsayilan = {}, cok = (goruntuler || []).length > 1;
    // görüntünün en üstünde adı kesilmiş gönderen; birden çok görüntüde her görüntü ayrı (farklı kişiler olabilir)
    var yokAd = function (gi) { return cok ? MS.EKRAN_YOK + ' · ' + (gi + 1) + '. görüntü' : MS.EKRAN_YOK; };
    (goruntuler || []).forEach(function (img, gi) {
      if (!img || img.hata) { okunan.push('— ' + S(img && img.ad) + ': ' + S(img && img.hata || 'okunamadı')); return; }
      var W = +img.w || 1080, H = +img.h || 0, ref = MS.ekranTarihi(img.ad, img.zaman, today).s, rows = ekranSatirlari(img);
      if (!W || W < 50) W = Math.max.apply(null, rows.map(function (r) { return r.r; }).concat([1080]));
      okunan.push('— ' + S(img.ad || 'ekran görüntüsü ' + (gi + 1)) + ' · ' + DT.fmt(ref));
      var hs = rows.map(function (r) { return r.h; }).sort(function (a, b) { return a - b; }), medH = hs[Math.floor(hs.length / 2)] || 30;
      rows.forEach(function (r) {
        var cx = (r.x + r.r) / 2;
        r.orta = Math.abs(cx - W / 2) < 0.07 * W && r.r - r.x < 0.62 * W && r.x > 0.15 * W;
        r.ayrac = r.orta ? MS.ayracTarihi(r.tt, ref) : null;
        r.sistem = r.orta && r.ayrac == null && !aralikVar(r.tt);
      });
      var ilk = rows.filter(function (r) { return r.ayrac != null; })[0];
      // ilk ayracın üstündeki mesajlar: ayraçtan önceki gün (tahmin); ayraç yoksa ekran görüntüsünün günü (tahmin)
      varsayilan[gi] = ilk ? ilk.ayrac - 1 : ref;
      var tarih = null, cur = null, sonAd = null, sonAdX = null, bu = [], oncekiAlt = null, ust = true;
      var yeni = function (kim, own, adX) {
        if (kim || own) ust = false;
        cur = { kim: kim, own: own, satir: [], s: tarih, saat: null, bitti: false, adX: adX, gi: gi, ust: ust && !kim && !own };
        bu.push(cur);
      };
      rows.forEach(function (r, i) {
        okunan.push(r.tt);
        if (H && r.y + r.h < 0.045 * H && !aralikVar(r.tt)) return;          // telefonun durum çubuğu (saat, pil)
        if (r.ayrac != null) { tarih = r.ayrac; cur = null; sonAd = null; sonAdX = null; ust = false; return; }
        if (r.sistem) { cur = null; ust = false; return; }
        // satırlar arasında büyük boşluk: yeni balon (ör. grup başlığı ile ilk mesaj arası)
        if (cur && oncekiAlt != null && r.y - oncekiAlt > 1.3 * medH) cur.bitti = true;
        oncekiAlt = r.y + r.h;
        if (/^(iletildi|forwarded)$/.test(ascii(r.tt).replace(/[^a-z]/g, ''))) return;
        var d = damgaAyir(r, medH);
        if (d.yalniz) { if (cur) { cur.bitti = true; cur.saat = cur.saat || d.damga; } return; }
        var t = d.t;
        if (!t) return;
        var ad = isimTuru(t, P);
        if (ad === 'aday') {
          var sn = rows[i + 1];
          ad = sn && !sn.ayrac && (aralikVar(sn.tt) || RE_TARIH.test(sn.tt) || saatEsle(sn.tt) !== sn.tt) ? 'kesin' : null;
        }
        if (ad) {
          // gönderen adının hemen altında ikinci bir ad: yanıtlanan mesajın (alıntı) başlığı
          if (cur && !cur.own && !cur.satir.length && !cur.bitti && cur.adX != null) { cur.alinti = true; return; }
          yeni(t, false, r.x); sonAd = t; sonAdX = r.x;
          return;
        }
        if (cur && cur.alinti) { if (r.x > cur.adX + 0.015 * W) return; cur.alinti = false; }
        var own = sonAdX != null ? (r.x > sonAdX + 0.12 * W || (r.x > 0.25 * W && r.r > 0.9 * W)) : r.x > 0.3 * W;
        if (!cur || cur.bitti || cur.own !== own) yeni(own ? MS.EKRAN_SIZ : cur && !cur.own ? cur.kim : null, own, null);
        cur.satir.push(t);
        if (d.damga) { cur.bitti = true; cur.saat = d.damga; }
      });
      bu.forEach(function (c) {
        if (!c.satir.length) return;
        var govde = [];
        c.satir.forEach(function (t0) {
          var t = MS.ocrDuzelt(t0);
          // satır personel adıyla başlıyorsa (liste / tablo) saatler o kişinin
          var mm = /^\s*(?:[-•*·]|\d{1,2}[.)])?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)(?![A-Za-zÇĞİÖŞÜçğıöşü])[\s:;.,-]*(.*)$/.exec(t), p = mm && P[DT.normKey(mm[1])];
          if (p) {
            var gv = saatEsle(mm[2]);
            if (aralikVar(gv) || /mazeret|izin|rapor/.test(ascii(gv))) {
              mesajlar.push({ s: c.s, saat: c.saat || '00:00', kim: p, govde: gv, goster: mm[2], ekran: true, gi: c.gi, sira: mesajlar.length });
              return;
            }
          }
          govde.push(t);
        });
        if (!govde.length) return;
        var g = c.kim ? saatEsle(govde.join('\n')) : govde.join('\n');     // göndereni belli olmayan metinde (başlık, giriş kutusu) tiresiz saat eşlenmez
        mesajlar.push({ s: c.s, saat: c.saat || '00:00', kim: c.kim || yokAd(c.gi), govde: g, goster: govde.join('\n'), ekran: true, gi: c.gi, ust: c.ust, sira: mesajlar.length });
      });
    });
    // kaydırarak alınmış, üst üste binen görüntüler: aynı mesaj (aynı balon saati ve metin) başka görüntüde
    // tarihli ya da göndereni belli görünüyorsa tarih / gönderen oradan alınır
    var anahtar = function (x) { return x.saat !== '00:00' ? x.saat + '|' + ascii(x.govde).replace(/[^a-z0-9]/g, '') : null; };
    var esler = {}, bulunanGun = {}, bulunanKim = {};
    mesajlar.forEach(function (x) { var k = anahtar(x); if (k) (esler[k] = esler[k] || []).push(x); });
    mesajlar.forEach(function (x) {
      var k = anahtar(x), es = k ? esler[k].filter(function (y) { return y.gi !== x.gi && (MS.ekranYok(x.kim) || MS.ekranYok(y.kim) || x.kim === y.kim); }) : [];
      if (!es.length) return;
      if (x.s == null) {
        var d = es.filter(function (y) { return y.s != null; })[0];
        if (d) { x.s = d.s; x.eslesti = true; if (bulunanGun[x.gi] == null) bulunanGun[x.gi] = d.s; }
      }
      if (x.ust && MS.ekranYok(x.kim)) {
        var b = es.filter(function (y) { return !MS.ekranYok(y.kim); })[0];
        if (b && bulunanKim[x.gi] == null) bulunanKim[x.gi] = b.kim;
      }
    });
    // tarihi görünmeyenler (görüntüde ilk ayracın üstündekiler; aralarında gün değişmez):
    // içlerinden biri başka görüntüde tarihli görünüyorsa hepsi o gün (kesin); yoksa elle seçilen gün ya da tahmin
    var elle = function (gi) { var t = opt.tarih; return t == null ? null : typeof t === 'object' ? (t[gi] != null ? t[gi] : null) : t; };
    var tahminler = {};
    mesajlar.forEach(function (x) {
      if (x.s != null) x.tarihKesin = true;
      else if (bulunanGun[x.gi] != null) { x.s = bulunanGun[x.gi]; x.tarihKesin = true; }
      else {
        var u = elle(x.gi);
        x.s = u != null ? u : varsayilan[x.gi];
        x.tarihKesin = false;
        if (u != null) x.tarihElle = true;
        if (tahminler[x.gi] == null) tahminler[x.gi] = x.s;
      }
      if (x.ust && bulunanKim[x.gi] && MS.ekranYok(x.kim)) x.kim = bulunanKim[x.gi];
    });
    // zaman sırası (görüntüler hangi sırayla verilirse verilsin): gün, sonra balon saati; saati okunamayan
    // mesaj aynı görüntüde kendinden önceki mesajın saatini alır. Aynı kişi-gün için sonuncu mesaj geçerli olur.
    var dk = function (t) { return +t.slice(0, 2) * 60 + +t.slice(3, 5); }, onceki = {};
    mesajlar.forEach(function (x) { var sa = x.saat !== '00:00' ? dk(x.saat) : onceki[x.gi] != null ? onceki[x.gi] : 0; onceki[x.gi] = sa; x.anah = x.s * 1440 + sa; });
    mesajlar.sort(function (a, b) { return a.anah - b.anah || a.gi - b.gi || a.sira - b.sira; });
    mesajlar.forEach(function (x) { delete x.anah; delete x.sira; delete x.ust; });
    var ilkTahmin = Object.keys(tahminler).map(Number).sort(function (a, b) { return a - b; })[0];
    return { mesajlar: mesajlar, okunan: okunan.join('\n'), tahminGun: ilkTahmin != null ? tahminler[ilkTahmin] : null, tahminler: tahminler };
  };

  /* ================= Excel'e aktarma ================= */
  // "Mesai Takip" sayfası uygulamanın okuduğu düzendedir (haftalık bloklar, Giriş/Çıkış başlıkları, NOT): dosya yeniden alınabilir.
  // stiller (xlsx-io): 1 tarih · 2 başlık · 3 sayfa başlığı · 9 kalın · 15 not · 16 alt başlık · 18 saat (0,00) · 19 kalın saat · 20 saat:dakika
  var sa2 = function (min) { return Math.round(min / 60 * 100) / 100; };
  var notDuz = function (t) { return S(t).replace(/\n/g, ' '); };
  function gunNotu(rec) {
    if (!rec) return '';
    var parca = [], n = notDuz(rec.n);
    if (rec.iz && !/mazeret|izin|rapor/.test(fold(n))) parca.push(MS.izinAd(rec.iz.t) + (rec.iz.s ? ' ' + String(rec.iz.s).replace('.', ',') + ' sa' : ''));
    else if (rec.iz && rec.iz.s && !/\d\s*(sa|saat)\b/.test(fold(n))) n = n + ' ' + String(rec.iz.s).replace('.', ',') + ' sa';
    if (n) parca.push(n);
    return parca.join(' – ');
  }
  function gunTuru(ctx, s) { var t = MS.tatil(ctx, s); return t ? (t.tur === 'tam' ? 'Resmi tatil' : 'Arife') : MS.hs(s) ? 'Hafta sonu' : 'Hafta içi'; }
  MS.exportXlsx = function (state, today) {
    var X = root.XLSXIO, ctx = MS.ctx(state, today), m = ctx.m;
    var gunler = Object.keys(m.gun).map(Number).filter(function (s) { return MS.dolu(m.gun[s]); }).sort(function (a, b) { return a - b; });
    var kisiler = m.personel.slice();
    gunler.forEach(function (s) { Object.keys(m.gun[s]).forEach(function (p) { if (!kisiler.some(function (x) { return DT.eqi(x, p); })) kisiler.push(p); }); });
    var K = 2;
    gunler.forEach(function (s) { Object.keys(m.gun[s]).forEach(function (p) { var a = m.gun[s][p].a; if (a && a.length > K) K = Math.min(MS.MAX_ARALIK, a.length); }); });
    var kayitN = 0; gunler.forEach(function (s) { kayitN += Object.keys(m.gun[s]).length; });
    var t0 = ctx.today;
    // 1 · Mesai Takip: haftalık bloklar
    var rows = [[{ v: 'PERSONEL MESAİ TAKİP', s: 3 }], [{ v: 'Donör Takip uygulamasından · ' + DT.fmt(t0) + ' · ' + kayitN + ' kişi-gün kaydı', s: 16 }],
      [{ v: 'Çıkış girişten önceyse ertesi gün sayılır (00:00–00:00 = 24 saat). Net: toplam süre − hafta içi mola. Fazla: haftanın net saati − zorunlu saat; resmi tatilde çalışılan saatin tamamı fazladır. Bu dosya uygulamaya yeniden alınabilir.', s: 15 }], []];
    var cols = [11, 12];
    for (var d0 = 0; d0 < 7; d0++) for (var k0 = 0; k0 < K * 2; k0++) cols.push(7);
    cols = cols.concat([8, 8, 8, 8, 7, 44]);
    if (gunler.length) {
      var w1 = DT.weekStart(gunler[0]), w2 = DT.weekStart(Math.max(gunler[gunler.length - 1], Math.min(t0, gunler[gunler.length - 1] + 6)));
      for (var ws = w1; ws <= w2; ws += 7) {
        var bas = [{ v: ws, s: 1 }, { v: 'HAFTA ' + DT.fmtShort(ws) + ' – ' + DT.fmt(ws + 6), s: 16 }];
        for (var d = 0; d < 7; d++) {
          var t = MS.tatil(ctx, ws + d);
          bas[2 + d * K * 2] = { v: MS.GUN3[d] + ' ' + DT.fmtShort(ws + d) + (t ? ' · ' + t.ad : ''), s: 16 };
        }
        rows.push(bas);
        var lab = ['', { v: 'PERSONEL', s: 2 }];
        for (d = 0; d < 7; d++) for (var k = 1; k <= K; k++) lab.push({ v: 'Giriş ' + k, s: 2 }, { v: 'Çıkış ' + k, s: 2 });
        ['Net (sa)', 'Zorunlu (sa)', 'Fazla (sa)', 'Eksik (sa)', 'Yemek', 'NOT'].forEach(function (x) { lab.push({ v: x, s: 2 }); });
        rows.push(lab);
        var H = MS.hafta(Object.assign({}, ctx, { m: Object.assign({}, m, { personel: kisiler }) }), ws);
        H.forEach(function (r) {
          var row = [{ v: ws, s: 1 }, r.p], notlar = [];
          r.gunler.forEach(function (g, di) {
            var a = g.rec && g.rec.a ? g.rec.a : [];
            for (var i = 0; i < K; i++) {
              var x = a[i];
              row.push(x ? { v: x[0] / 1440, s: 20 } : '', x ? { v: x[1] / 1440, s: 20 } : '');
            }
            var nt = gunNotu(g.rec);
            if (nt) notlar.push(MS.GUN3[di] + ': ' + nt);
          });
          var bos = !r.gunler.some(function (g) { return g.rec; });
          row.push(bos && !r.zor ? '' : { v: sa2(r.net), s: 18 }, { v: sa2(r.zor), s: 18 }, r.fazla ? { v: sa2(r.fazla), s: 18 } : '', r.eksik ? { v: sa2(r.eksik), s: 18 } : '', r.yemek || '', notlar.join(' · '));
          rows.push(row);
        });
        rows.push([]);
      }
    }
    // 2 · Günlük: kişi-gün satırları (girilmemiş iş günleri de)
    var gl = [[{ v: 'Günlük mesai kayıtları', s: 3 }], [{ v: 'Takip edilen günler · girilmemiş iş günleri de listelenir', s: 16 }], []];
    var gbas = ['Tarih', 'Gün', 'Personel', 'Gün türü', 'Giriş – çıkış', 'Toplam (sa)', 'Mola (dk)', 'Net (sa)', 'Zorunlu (sa)', 'Fark (sa)', 'Tatil mesaisi (sa)', 'Yemek', 'İzin', 'Görev', 'Dinlenme (sa)', 'Not'];
    gl.push(gbas.map(function (x) { return { v: x, s: 2 }; }));
    if (gunler.length) {
      var e = { from: ctx.bas != null ? Math.min(ctx.bas, gunler[0]) : gunler[0], to: Math.max(gunler[gunler.length - 1], t0) };
      kisiler.forEach(function (p) {
        var once = MS.gun(ctx, e.from - 1, p);
        for (var s = e.from; s <= e.to; s++) {
          var g = MS.gun(ctx, s, p), dn = MS.dinlenme(ctx, s, p, g, once); once = g;
          var bosIs = !g.rec && g.zorTam > 0 && !g.gorev && s <= t0 && (ctx.bas == null || s >= ctx.bas) && m.personel.some(function (x) { return DT.eqi(x, p); });
          if (!g.rec && !g.gorev && !bosIs) continue;
          gl.push([{ v: s, s: 1 }, DT.gun(s), p, gunTuru(ctx, s), MS.aralikYazi(g.rec) || (bosIs ? 'GİRİLMEDİ' : ''),
            g.brut ? { v: sa2(g.brut), s: 18 } : '', g.mola || '', g.brut ? { v: sa2(g.net), s: 18 } : '', { v: sa2(g.zor), s: 18 },
            g.tatil && g.tatil.tur === 'tam' ? '' : { v: sa2(g.net - g.zor), s: 18 }, g.tatilNet ? { v: sa2(g.tatilNet), s: 18 } : '', g.yemek || '',
            g.izin ? MS.izinAd(g.izin.t) + (g.izin.s ? ' ' + String(g.izin.s).replace('.', ',') + ' sa' : '') : '', g.gorev ? (g.gorev.tur || 'Görev') + (g.gorev.yer ? ' · ' + g.gorev.yer : '') : '',
            dn != null && dn < 720 ? { v: sa2(dn), s: 18 } : '', notDuz(g.not)]);
        }
      });
      var bl = gl.slice(4).sort(function (x, y) { return x[0].v - y[0].v || kisiler.indexOf(x[2]) - kisiler.indexOf(y[2]); });
      gl = gl.slice(0, 4).concat(bl);
    }
    // 3 · Aylık Fazla Mesai
    var ay = [[{ v: 'Aylık fazla mesai (saat)', s: 3 }], [{ v: 'Ay dönemi: ' + MS.kuralYazi(m) + (m.donemGun > 1 ? ', ay adı dönemin ' + (m.donemAd === 'bit' ? 'bittiği' : 'başladığı') + ' ay' : '') +
      ' · içinde bulunulan ay saat girilen son güne kadar' + (ctx.son != null ? ' (' + DT.fmt(ctx.son) + ')' : '') + ' · fazla = en çok(0, tatil dışı net − zorunlu) + resmi tatilde çalışılan saat', s: 16 }], []];
    var AY3 = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    if (gunler.length) {
      for (var y = MS.ayBul(m, gunler[0]).y; y <= MS.ayBul(m, Math.max(t0, gunler[gunler.length - 1])).y; y++) {
        var A = MS.aylik(ctx, y);
        ay.push([{ v: String(y), s: 11 }]);
        ay.push([{ v: 'Personel', s: 2 }].concat(AY3.map(function (x) { return { v: x, s: 2 }; }), [{ v: 'Yıl', s: 2 }, { v: 'Tatil mesaisi', s: 2 }]));
        ay.push([{ v: 'Tarihler', s: 16 }].concat(A.donemler.map(function (a) { return { v: DT.fmtShort(a.from) + '–' + DT.fmtShort(a.to) + (a.ozel ? ' •' : ''), s: 16 }; })));
        A.forEach(function (r) { ay.push([r.p].concat(r.ay.map(function (v) { return v == null ? '' : { v: sa2(v), s: 18 }; }), [{ v: sa2(r.yil), s: 18 }, r.tatil ? { v: sa2(r.tatil), s: 18 } : ''])); });
        ay.push([{ v: 'Toplam', s: 9 }].concat(AY3.map(function (x, i) { return A.some(function (r) { return r.ay[i] != null; }) ? { v: sa2(A.reduce(function (t2, r) { return t2 + (r.ay[i] || 0); }, 0)), s: 19 } : { v: '', s: 9 }; }),
          [{ v: sa2(A.reduce(function (t2, r) { return t2 + r.yil; }, 0)), s: 19 }, { v: sa2(A.reduce(function (t2, r) { return t2 + r.tatil; }, 0)), s: 19 }]));
        ay.push([]);
      }
    }
    // 4 · Görevlendirme (uygulamanın okuduğu başlıklar)
    var gv = [[{ v: 'Görevlendirme', s: 3 }], [{ v: 'Şehir dışı görevler · görev günlerinde yemek hakkı verilmez', s: 16 }], []];
    gv.push(['PERSONEL', 'BAŞLANGIÇ', 'BİTİŞ', 'GÖREV TÜRÜ', 'GİDİLEN YER', 'NOT', 'GÜN', 'GECE'].map(function (x) { return { v: x, s: 2 }; }));
    m.gorev.slice().sort(function (a, b) { return (a.bas || 0) - (b.bas || 0); }).forEach(function (g) {
      var bit = g.bit != null && g.bit >= g.bas ? g.bit : g.bas;
      gv.push([g.p, { v: g.bas, s: 1 }, { v: bit, s: 1 }, g.tur || '', g.yer || '', g.not || '', bit - g.bas + 1, bit - g.bas || '']);
    });
    var heights = []; heights[3] = 30;
    return X.buildXlsx([
      { name: 'Mesai Takip', rows: rows, cols: cols },
      { name: 'Günlük', rows: gl, cols: [11, 10, 12, 12, 24, 9, 8, 9, 9, 9, 10, 7, 14, 18, 10, 40], freezeRow: 4, filterRow: gl.length > 4 ? 4 : null, heights: heights },
      { name: 'Aylık Fazla Mesai', rows: ay, cols: [14, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 9, 12] },
      { name: 'Görevlendirme', rows: gv, cols: [14, 12, 12, 18, 22, 30, 6, 6], freezeRow: 4, filterRow: gv.length > 4 ? 4 : null, heights: heights }
    ]);
  };

  root.MS = MS;
})(typeof window !== 'undefined' ? window : globalThis);
