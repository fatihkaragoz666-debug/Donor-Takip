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
 *  - Takip başlangıcından önceki ve bugünden sonraki günler zorunlu saate girmez (içinde bulunulan ay bugüne kadar);
 *    bugün henüz yazılmadıysa bugün de girmez.
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
    return { v: 1, personel: p, bas: null, std: [480, 1020], donemGun: 20, ust: 48, gun: {}, gorev: [] };
  };
  MS.hazirla = function (state) {
    var m = state.mesai;
    if (!m || typeof m !== 'object') m = state.mesai = MS.yeni(state.lists);
    var y = MS.yeni(state.lists);
    if (!Array.isArray(m.personel)) m.personel = y.personel;
    if (!Array.isArray(m.std) || m.std.length !== 2) m.std = y.std;
    if (!m.donemGun) m.donemGun = 20;
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
    var bas = m.bas;
    if (bas == null) Object.keys(m.gun).forEach(function (k) { var s = +k; if (MS.dolu(m.gun[k]) && (bas == null || s < bas)) bas = s; });
    return { m: m, hol: hol, gorev: gorev, bas: bas, today: today != null ? today : DT.today(), L: state.lists };
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
  // Etkin aralık: takip başlangıcı ile bugün arasına kırpılır
  MS.etkin = function (ctx, from, to) {
    var a = from, b = Math.min(to, ctx.today);
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
  /** Aylık Fazla Mesai: personel × 12 ay (takvim ayı); etkin olmayan ay null */
  MS.aylik = function (ctx, y) {
    var aylar = [];
    for (var m = 1; m <= 12; m++) { var a = MS.ayAraligi(y, m); aylar.push(MS.etkin(ctx, a.from, a.to) ? MS.donem(ctx, a.from, a.to) : null); }
    return ctx.m.personel.map(function (p, i) {
      var v = aylar.map(function (ay) { return ay ? ay[i].fazla : null; });
      return { p: p, ay: v, yil: v.reduce(function (t, x) { return t + (x || 0); }, 0), tatil: aylar.reduce(function (t, ay) { return t + (ay ? ay[i].netTatil : 0); }, 0) };
    });
  };
  /** 20'si – ertesi ayın 19'u gibi dönem: bugünü içeren dönem (k: 0 bu dönem, -1 önceki) */
  MS.donemAraligi = function (ctx, base, k) {
    var g = ctx.m.donemGun || 20, p = DT.parts(base);
    var y = p.y, m = p.m;
    if (g > 1 && p.d < g) { m--; if (m < 1) { m = 12; y--; } }
    m += k || 0;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    var from = DT.serial(y, m, g > 1 ? g : 1), to = g > 1 ? DT.serial(y, m + 1, g) - 1 : DT.serial(y, m + 1, 1) - 1;
    return { from: from, to: to };
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
    for (var i = 0; i < parca.length; i++) for (var j = 0; j < personel.length; j++) if (DT.eqi(parca[i], personel[j])) return personel[j];
    return null;
  };
  var RE_COKGUN = /(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s+(\d{1,2})[:.](\d{2})\s*[-–—]+\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s+(\d{1,2})[:.](\d{2})/;
  var RE_TARIH = /(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)/;
  var RE_KISA_TARIH = /(^|[^\d:.])(\d{1,2})[./](\d{1,2})\s+(?=\d{1,2}[:.]\d{2}\s*[-–—])/;
  var RE_ARALIK = /(\d{1,2})[:.](\d{2})\s*[-–—]+\s*(\d{1,2})[:.](\d{2})/g;
  function gecerliSaat(h, m) { return h <= 24 && m <= 59 && !(h === 24 && m > 0); }
  function tarihDuzelt(s, msgS, uyari, yazilan) {
    if (Math.abs(s - msgS) <= 20) return s;
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
        curS = tarihDuzelt(DT.serial(yy, +dm[2], +dm[1]), msg.s, uy, dm[0]);
        kalan = kalan.replace(dm[0], ' ');
      } else {
        var km = RE_KISA_TARIH.exec(kalan);
        if (km) { curS = tarihDuzelt(DT.serial(DT.parts(msg.s).y, +km[3], +km[2]), msg.s, uy, km[2] + '.' + km[3]); kalan = kalan.replace(km[0], km[1] + ' '); }
      }
      var a = [], m;
      RE_ARALIK.lastIndex = 0;
      while ((m = RE_ARALIK.exec(kalan))) {
        if (!gecerliSaat(+m[1], +m[2]) || !gecerliSaat(+m[3], +m[4])) continue;
        a.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]);
      }
      if (!a.length) return;
      var hedef = curS != null ? curS : msg.s;
      if (izin) { ekle(hedef, [], { izinSatiri: DT.xtrim(satir), uyari: ['mazeret / izin saatleri mesai sayılmadı: ' + DT.xtrim(satir)] }); return; }
      ekle(hedef, a, { uyari: uy });
    });
    return sira.map(function (s) { return gunler[s]; });
  };
  /**
   * WhatsApp metninden personel-gün kayıtları. Aynı kişi aynı gün için birden çok mesaj yazdıysa sonuncusu alınır.
   * dönüş: { satirlar: [{ s, p, a, kaynak, uyari, cokGun, mevcut, durum }], bilinmeyen: { ad: mesaj sayısı }, mesaj }
   */
  MS.whatsapp = function (state, metin, opt) {
    opt = opt || {};
    var m = MS.hazirla(state), personel = opt.personel || m.personel, harita = opt.harita || {};
    var mesajlar = MS.waMesajlar(metin), bilinmeyen = {}, kayit = {}, sira = [];
    mesajlar.forEach(function (msg) {
      var p = MS.waKisi(msg.kim, personel, harita);
      var gunler = MS.waAyikla(msg);
      if (!gunler.length) return;
      if (!p) { bilinmeyen[msg.kim] = (bilinmeyen[msg.kim] || 0) + 1; return; }
      gunler.forEach(function (g) {
        if (opt.from != null && g.s < opt.from) return;
        if (opt.to != null && g.s > opt.to) return;
        var k = g.s + '|' + p, eski = kayit[k];
        var kaynak = DT.xtrim(msg.govde.replace(/\n/g, ' · ')).slice(0, 140);
        if (eski && eski.msgS === msg.s && eski.saat === msg.saat) {
          g.a.forEach(function (x) { if (!eski.a.some(function (y) { return y[0] === x[0] && y[1] === x[1]; })) eski.a.push(x); });
          return;
        }
        var r = { s: g.s, p: p, a: g.a.slice(), uyari: g.uyari.slice(), cokGun: g.cokGun, izinSatiri: g.izinSatiri || null, kaynak: kaynak,
          msgS: msg.s, saat: msg.saat, kim: msg.kim };
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
    var ay = [[{ v: 'Aylık fazla mesai (saat)', s: 3 }], [{ v: 'Takvim ayı · içinde bulunulan ay bugüne kadar · fazla = en çok(0, tatil dışı net − zorunlu) + resmi tatilde çalışılan saat', s: 16 }], []];
    var AY3 = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    if (gunler.length) {
      for (var y = DT.year(gunler[0]); y <= DT.year(Math.max(t0, gunler[gunler.length - 1])); y++) {
        var A = MS.aylik(ctx, y);
        ay.push([{ v: String(y), s: 11 }]);
        ay.push([{ v: 'Personel', s: 2 }].concat(AY3.map(function (x) { return { v: x, s: 2 }; }), [{ v: 'Yıl', s: 2 }, { v: 'Tatil mesaisi', s: 2 }]));
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
      { name: 'Aylık Fazla Mesai', rows: ay, cols: [14, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 12] },
      { name: 'Görevlendirme', rows: gv, cols: [14, 12, 12, 18, 22, 30, 6, 6], freezeRow: 4, filterRow: gv.length > 4 ? 4 : null, heights: heights }
    ]);
  };

  root.MS = MS;
})(typeof window !== 'undefined' ? window : globalThis);
