/* Donör Takip – iş mantığı.
 * Excel dosyasındaki (Hesap sayfası ve takip sayfaları) formüllerin JavaScript karşılığı.
 * Tarihler Excel seri numarası olarak tutulur (1899-12-30 = 0), böylece hesaplar Excel ile birebir aynı olur.
 */
(function (root) {
  'use strict';
  var DT = {};

  /* ---------------- Tarih ---------------- */
  var MS = 86400000, EPOCH = Date.UTC(1899, 11, 30);
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  DT.serial = function (y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / MS); };
  DT.parts = function (s) { var t = new Date(EPOCH + s * MS); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  DT.weekday = function (s) { var w = new Date(EPOCH + s * MS).getUTCDay(); return w === 0 ? 7 : w; }; // Pzt=1 … Paz=7
  DT.today = function () {
    if (root.__TODAY) return root.__TODAY;
    var n = new Date(); return DT.serial(n.getFullYear(), n.getMonth() + 1, n.getDate());
  };
  DT.fmt = function (s) { if (s == null || s === '') return ''; var p = DT.parts(s); return pad(p.d) + '.' + pad(p.m) + '.' + p.y; };
  DT.fmtShort = function (s) { if (s == null || s === '') return ''; var p = DT.parts(s); return pad(p.d) + '.' + pad(p.m); };
  DT.iso = function (s) { if (s == null || s === '') return ''; var p = DT.parts(s); return p.y + '-' + pad(p.m) + '-' + pad(p.d); };
  DT.fromIso = function (str) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str || '');
    return m ? DT.serial(+m[1], +m[2], +m[3]) : null;
  };
  DT.parseDateText = function (str) {
    str = String(str == null ? '' : str).trim();
    var m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(str);
    if (m) return DT.serial(+m[3], +m[2], +m[1]);
    return DT.fromIso(str);
  };
  DT.year = function (s) { return DT.parts(s).y; };
  DT.month = function (s) { return DT.parts(s).m; };
  DT.weekStart = function (s) { return s - DT.weekday(s) + 1; };

  DT.AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  DT.AYLAR_B = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
  DT.GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  DT.GUNLER_B = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ', 'PAZAR'];
  DT.gun = function (s) { return DT.GUNLER[DT.weekday(s) - 1]; };

  /* ---------------- Metin ---------------- */
  function S(v) { return v == null ? '' : String(v); }
  // Excel SEARCH büyük/küçük harf duyarsız: Türkçe İ/I/ı farkını da yok sayıyoruz.
  function fold(v) { return S(v).replace(/[İIı]/g, 'i').toLowerCase(); }
  function has(text) {
    var f = fold(text);
    for (var i = 1; i < arguments.length; i++) if (f.indexOf(fold(arguments[i])) >= 0) return true;
    return false;
  }
  function xtrim(v) { return S(v).replace(/ +/g, ' ').trim(); } // Excel TRIM
  function eqi(a, b) { return fold(xtrim(a)) === fold(xtrim(b)); }
  function normKey(v) {
    return xtrim(v).toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
      .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
  }
  DT.S = S; DT.fold = fold; DT.has = has; DT.xtrim = xtrim; DT.eqi = eqi; DT.normKey = normKey;

  function excelValue(s) {
    if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return parseFloat(s);
    return null;
  }
  // AÇIKLAMA'daki "18 kg", "19,5 KG" gibi kilo yazısı (Hesap!CJ/CK)
  DT.parseKg = function (aciklama) {
    var t = S(aciklama), i = fold(t).indexOf('kg');
    if (i < 0) return null;
    var left = xtrim(t.slice(0, i).replace(/\(/g, '').replace(/[:\-]/g, ' '));
    var parts = left.split(' '), tok = (parts[parts.length - 1] || '').replace(/,/g, '.');
    if (tok === '') return null;
    var dot = tok.indexOf('.');
    if (dot >= 0) {
      var a = excelValue(tok.slice(0, dot)); if (a == null) return null;
      var b = tok.slice(dot + 1); if (b.length === 0) return a;
      var bv = excelValue(b); if (bv == null) return null;
      return a + bv / Math.pow(10, b.length);
    }
    return excelValue(tok);
  };

  /* ---------------- Listeler ---------------- */
  DT.PROG_KEYS = [
    ['SK', 'SAĞLIK KONTROLÜ'], ['Asi', 'AŞI'], ['TopPer', 'TOPLAMA (PERİFERİK)'], ['TopKem', 'TOPLAMA (KEMİK İLİĞİ)'],
    ['Yat', 'HASTANE YATIŞ'], ['Tasima', 'ÜRÜN TAŞIMA'], ['KargoTK', 'KARGO · PZT, ÇAR, CUMA'], ['KargoAse', 'KARGO · SALI, PERŞEMBE'],
    ['EkKons', 'EK KONSÜLTASYON'], ['Sabit1', 'HAFTA İÇİ SABİT SATIR 1'], ['Sabit2', 'HAFTA İÇİ SABİT SATIR 2'],
    ['AsiSabah', 'AŞI · SABAH (sabah-akşam hastaneleri)'], ['AsiAksam', 'AŞI · AKŞAM (sabah-akşam hastaneleri)']
  ];
  DT.hospProg = function (L, h) {
    for (var i = 0; i < L.hastane.length; i++) {
      var e = L.hastane[i];
      if (eqi(e.ad, h)) return S(e.prog) === '' ? S(h) : S(e.prog);
    }
    return S(h);
  };
  DT.inPersonel = function (L, name) {
    for (var i = 0; i < L.personel.length; i++) if (eqi(L.personel[i], name)) return L.personel[i];
    return null;
  };
  DT.holidayMap = function (L) {
    var m = {};
    (L.tatiller || []).forEach(function (t) { if (t.tarih != null) m[t.tarih] = m[t.tarih] ? m[t.tarih] + ' · ' + t.ad : S(t.ad); });
    return m;
  };
  DT.fullHoliday = function (L, s) {
    return (L.tatiller || []).some(function (t) { return t.tarih === s && fold(t.ad).indexOf('arife') < 0; });
  };
  function prepKeywords(list, field) {
    return (list || []).map(function (e) { return { k: normKey(e.kelime), v: S(e[field]) }; })
      .filter(function (e) { return e.k !== ''; });
  }
  function lastMatch(kw, text) {
    var r = null;
    for (var i = 0; i < kw.length; i++) if (text.indexOf(kw[i].k) >= 0) r = kw[i].v;
    return r;
  }

  /* ---------------- Donör türetilmiş alanları ---------------- */
  DT.derive = function (state, today) {
    var L = state.lists;
    var ctx = { L: L, today: today, tas: prepKeywords(L.tasAnahtar, 'sehir'), bas: prepKeywords(L.basAnahtar, 'baslik') };
    var adCount = {};
    state.donors.forEach(function (d) { var k = fold(xtrim(d.ad)); if (k) adCount[k] = (adCount[k] || 0) + 1; });
    return state.donors.map(function (d, i) {
      var x = deriveOne(d, i, ctx);
      x.dupAd = !!(fold(xtrim(d.ad)) && adCount[fold(xtrim(d.ad))] > 1);
      return x;
    });
  };

  function deriveOne(d, i, c) {
    var L = c.L, today = c.today;
    var x = { i: i, idx: i + 1, d: d };
    var ac = S(d.aciklama);
    x.hastaEx = has(ac, 'hasta ex', 'hastası ex', 'hastasi ex', 'ex oldu', 'exitus');
    x.iptal = has(ac, 'iptal') || x.hastaEx;
    x.ertele = has(ac, 'ertele');
    x.red = has(ac, 'red');
    x.vazgec = has(ac, 'vazgeç', 'vazgec');
    x.stopped = x.iptal || x.ertele || x.red || x.vazgec;
    x.kem = has(d.yontem, 'kem');
    x.kg = DT.parseKg(ac);
    x.onk = has(d.hastane, 'ONKOLOJ');
    x.asiYok = false;
    if (d.asiManual === 'YOK') { x.asi = null; x.asiYok = true; }
    else if (d.asiManual != null) x.asi = d.asiManual;
    else if (d.top == null) x.asi = null;
    else if (x.kem) { x.asi = null; x.asiYok = true; }
    else x.asi = d.top - ((x.onk && x.kg != null && x.kg <= 20) ? 3 : 4);
    x.sonIzlem = d.sonIzlemManual != null ? d.sonIzlemManual : (d.top != null ? d.top + 20 : null);

    var ik = S(d.ikamet);
    x.ankara = ik.length === 0 ? '' : (has(ik, 'ankara') ? 1 : 0);
    var b = S(d.bolge);
    x.yd = b.length === 0 ? '' : (has(b, 'DIŞI', 'dışı', 'yurt dis', 'yurtdis') ? 1 : 0);
    var ea = xtrim(b) === '' ? '' : normKey(b);
    if (ea === '') { x.sehir = ''; x.baslik = ''; }
    else if (x.yd === 1) { x.sehir = 'Yurt dışı'; x.baslik = xtrim(b); }
    else {
      var s1 = lastMatch(c.tas, ea); x.sehir = s1 == null ? 'Diğer' : s1;
      // Başlık ANKARA çıkan (Ankara'daki) merkezler başlık yerine NAKİL MERKEZİ adıyla yazar
      var s2 = lastMatch(c.bas, ea); x.baslik = s2 == null || fold(xtrim(s2)) === 'ankara' ? xtrim(b) : s2;
    }
    x.sabahAksam = (L.asiCift || []).some(function (h) { return eqi(h, d.hastane); });
    var slash = ik.indexOf('/');
    x.il = xtrim(slash >= 0 ? ik.substr(slash + 1, 60) : ik);
    // Ülke (yurt dışı nakil merkezi parantezinden)
    x.ulke = '';
    if (x.yd === 1) {
      var p = b.indexOf('(');
      if (p < 0) x.ulke = 'Belirtilmemiş';
      else {
        var mid = b.substr(p + 1, 99);
        var a1 = mid.indexOf('-'), a2 = mid.indexOf(')');
        var k = Math.min(a1 >= 0 ? a1 + 1 : 99, a2 >= 0 ? a2 + 1 : 99);
        x.ulke = xtrim(mid.substr(0, k - 1)).split('USA').join('AMERİKA');
      }
    }
    x.dli = has(' ' + ac.replace(/[-\/]/g, ' '), ' DLİ', ' DLI', ' dli');
    x.skYapilmadi = has(ac, 'kontrol') && has(ac, 'yapılmad', 'YAPILMAD', 'yapilmad');

    // KONTROL sütunu
    var issues = [];
    if ((S(d.hk) + S(d.ad)).length > 0 && !x.stopped) {
      if (!S(d.yontem)) issues.push('Yöntem yok');
      if (!S(d.hastane)) issues.push('Hastane yok');
      if (d.top != null && !b) issues.push('Nakil merkezi yok');
      if (S(d.personel) && !DT.inPersonel(L, d.personel)) issues.push('Personel listede yok');
      if (S(d.tasiyan) && !DT.inPersonel(L, d.tasiyan)) issues.push('Taşıyan personel listede yok');
      if (d.sk != null && d.top != null) {
        if (d.sk > d.top) issues.push('Sağlık kontrolü toplamadan sonra');
        else if (x.asi != null && d.sk >= x.asi) issues.push('Sağlık kontrolü aşıdan sonra');
      }
      if (x.asi != null && d.top != null && x.asi >= d.top) issues.push('Aşı toplamadan sonra');
      if (x.sonIzlem != null && d.top != null && x.sonIzlem < d.top) issues.push('Son izlem toplamadan önce');
      if (d.idmBas != null && d.idmBit != null && d.idmBit < d.idmBas) issues.push('IDM bitişi başlangıçtan önce');
      if (!d.idm && (d.idmBas != null || d.idmBit != null)) issues.push('IDM tarihi var, işaret yok');
    }
    x.kontrol = issues.join('  ·  ').slice(0, 200);
    x.issues = issues;

    // Donör Raporu · DURUM
    if ((S(d.hk) + S(d.ad)).length === 0) x.durum = '';
    else if (x.hastaEx) x.durum = 'Süreç durdu · hasta ex';
    else if (x.vazgec) x.durum = 'Süreç durdu · vazgeçti';
    else if (x.red) x.durum = 'Süreç durdu · red';
    else if (x.ertele) x.durum = 'Süreç durdu · erteleme';
    else if (x.iptal) x.durum = 'Süreç durdu · iptal';
    else if (d.top != null) {
      if (d.top <= today) x.durum = 'Toplama yapıldı';
      else if (x.asi != null && today >= x.asi) x.durum = 'Aşı sürecinde';
      else x.durum = 'Toplama planlandı';
    } else if (d.sk != null) x.durum = d.sk <= today ? 'Sağlık kontrolü yapıldı' : 'Sağlık kontrolü planlandı';
    else x.durum = 'Kayıt açıldı';
    return x;
  }

  /* ---------------- Görev havuzu (Hesap sayfası: donör başına 12 satır) ----------------
   * slot 1 sağlık kontrolü · 2-5 aşı (1.-4. gün, sabah) · 6 toplama · 7 ürün taşıma · 8 hastane yatış · 9-12 aşı akşam
   */
  DT.SLOT_TIP = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 2, 10: 3, 11: 4, 12: 5 };
  DT.taskKind = function (slot) {
    if (slot === 1) return 'sk';
    if ((slot >= 2 && slot <= 5) || slot >= 9) return 'asi';
    if (slot === 6) return 'top';
    if (slot === 7) return 'tas';
    return 'yat';
  };

  DT.resolvePersonnel = function (state, D) {
    var ov = state.overrides || {};
    D.forEach(function (x) {
      var d = x.d, M = S(d.personel);
      var get = function (slot, def) { var k = d.id + '|' + slot; return Object.prototype.hasOwnProperty.call(ov, k) ? S(ov[k]) : def; };
      var P = {};
      [1, 2, 3, 4, 5, 6, 8].forEach(function (s) { P[s] = get(s, M); });
      P[7] = x.yd === 1 ? '' : get(7, S(d.tasiyan) !== '' ? S(d.tasiyan) : M);
      [9, 10, 11, 12].forEach(function (s) { P[s] = get(s, P[s - 7]); });
      x.pers = P;
      x.persOverridden = {};
      for (var s = 1; s <= 12; s++) x.persOverridden[s] = Object.prototype.hasOwnProperty.call(ov, d.id + '|' + s);
    });
  };

  DT.buildPool = function (state, D) {
    DT.resolvePersonnel(state, D);
    var tasks = [];
    D.forEach(function (x) {
      var d = x.d, idx = x.idx;
      if (x.stopped) return;
      function T(slot, date, islem, g, sub, prio, extra) {
        var t = {
          i: x.i, idx: idx, slot: slot, tip: DT.SLOT_TIP[slot], kind: DT.taskKind(slot), date: date, islem: islem,
          key: date * 1e6 + g * 1e5 + idx * 10 + sub, cd: prio * 1e6 + idx * 100 + slot, prio: prio,
          pers: x.pers[slot], yd: false, aksam: false
        };
        if (extra) for (var k in extra) t[k] = extra[k];
        tasks.push(t);
      }
      if (d.sk != null) T(1, d.sk, 'SAĞLIK KONTROLÜ', 1, 0, 4);
      if (x.asi != null && !x.kem) {
        for (var n = 0; n < 4; n++) T(2 + n, x.asi + n, 'AŞI (' + (n + 1) + '. gün)' + (x.sabahAksam ? ' · SABAH' : ''), 2, 0, 5, { gun: n + 1 });
      }
      if (d.top != null) {
        T(6, d.top, 'TOPLAMA', 3, 0, x.kem ? 1 : 2);
        if (S(d.bolge) !== '') T(7, d.top, S(d.hastane) + '-' + x.baslik, 3, 1, x.kem ? 1 : 2, { yd: x.yd === 1 });
        if (x.kem && eqi(d.hastane, 'BİLKENT PEDİATRİ')) T(8, d.top - 1, 'HASTANE YATIŞ', 3, 2, 3);
      }
      if (x.sabahAksam && x.asi != null && !x.kem) {
        for (var m = 0; m < 4; m++) T(9 + m, x.asi + m, 'AŞI (' + (m + 1) + '. gün) · AKŞAM', 2, 1, 5, { aksam: true, gun: m + 1 });
      }
    });
    tasks.sort(function (a, b) { return a.key - b.key; });
    return tasks;
  };

  // Takvim kutusundaki 3 satır
  DT.taskLabel = function (x, t) {
    var d = x.d;
    if (t.slot === 7) return [t.islem];
    var l1;
    if (t.slot >= 2 && t.slot <= 5 && x.sabahAksam) {
      var ak = x.pers[t.slot + 7];
      l1 = 'AŞI (' + t.gun + '. gün) · SABAH-AKŞAM' + (t.pers ? ' · ' + t.pers : '') + (ak && ak !== t.pers ? ' / ' + ak : '');
    } else l1 = t.islem + (t.pers ? ' · ' + t.pers : '');
    var l2 = (S(d.hk) ? d.hk + ' · ' : '') + S(d.ad);
    var l3 = S(d.hastane) + (S(d.tel) ? (S(d.hastane) ? ' · ' : '') + d.tel : '');
    return [l1, l2, l3];
  };

  // Takvimde görünen görevler (akşam satırları sabah satırıyla birleşir)
  DT.calendarTasks = function (pool, D, from, to, persFilter) {
    return pool.filter(function (t) {
      if (t.slot >= 9) return false;
      if (t.date < from || t.date >= to) return false;
      if (!persFilter) return true;
      if (eqi(t.pers, persFilter)) return true;
      var x = D[t.i];
      return t.slot >= 2 && t.slot <= 5 && x.sabahAksam && eqi(x.pers[t.slot + 7], persFilter);
    });
  };

  /* ---------------- Geri sayım uyarıları (Görev Listesi) ---------------- */
  DT.alerts = function (D, base, persFilter) {
    var rows = [];
    D.forEach(function (x) {
      if (x.stopped) return;
      var d = x.d, ik = S(d.ikamet), ank = has(ik, 'ankara');
      var ok = function (ao) { return (ik !== '' && !ank && ao >= 1 && ao <= 10) || (ank && ao >= 1 && ao <= 5); };
      var where = ank ? 'Ankara içi' : 'Ankara dışı';
      function add(ah, grp, ao, text, onem, pers) {
        rows.push({ x: x, i: x.i, ah: ah, grp: grp, ao: ao, date: base + ao, text: text, onem: onem, pers: pers,
          key: grp * 1e10 + ao * 1e6 + x.idx * 10 + (ah - 1) });
      }
      var ao;
      if (d.sk != null) { ao = d.sk - base; if (ok(ao)) add(1, 2, ao, 'Sağlık kontrolüne ' + ao + ' gün kaldı  ·  ' + where, ank ? 2 : 1, x.pers[1]); }
      if (x.asi != null) { ao = x.asi - base; if (ok(ao)) add(2, 1, ao, 'Aşı başlangıcına ' + ao + ' gün kaldı  ·  ' + where, ank ? 2 : 1, x.pers[2]); }
      if (d.top != null) { ao = d.top - base; if (ok(ao)) add(3, 3, ao, 'Toplamaya ' + ao + ' gün kaldı  ·  ' + where, ank ? 2 : 1, x.pers[6]); }
      if (d.top != null && x.yd !== 1) {
        ao = d.top - base;
        var c = x.sehir, near = c === 'Ankara' || c === 'Yurt dışı' || c === '';
        if ((!near && ao >= 1 && ao <= 10) || (near && ao >= 1 && ao <= 5)) {
          var w = c === 'Yurt dışı' ? 'Yurt dışı' : c === 'Ankara' ? 'Ankara içi' : c === '' ? 'Nakil merkezi yok' : 'Şehir dışı: ' + c;
          add(4, 4, ao, 'Ürün taşımaya ' + ao + ' gün kaldı  ·  ' + w, near ? 2 : 1, x.pers[7]);
        }
      }
    });
    return rows.filter(function (r) { return !persFilter || eqi(r.pers, persFilter); })
      .sort(function (a, b) { return a.key - b.key; });
  };

  /* ---------------- Takip listeleri ---------------- */
  function pf(name, f) { return !f || eqi(name, f); }
  function byKey(a, b) { return a.key - b.key; }

  DT.listSaglik = function (D, today, f, L) {
    var r = [];
    D.forEach(function (x) {
      var d = x.d; if (x.stopped || d.sk == null || d.sk < today || !pf(x.pers[1], f)) return;
      r.push({ x: x, date: d.sk, durum: d.sk === today ? 2 : 1, key: (d.sk - today) * 1e5 + x.idx, pers: x.pers[1],
        kargo: x.yd === 1 ? kargoFor(L, d.sk) : '' });
    });
    return r.sort(byKey);
  };
  function kargoFor(L, s) {
    var w = DT.weekday(s), P = (L && L.prog) || {};
    if (w === 1 || w === 3 || w === 5) return P.KargoTK || 'TURKISH CARGO';
    if (w === 2 || w === 4) return P.KargoAse || 'ASE CARGO';
    return '';
  }
  DT.kargoFor = kargoFor;

  DT.listAsi = function (D, today, f) {
    var r = [];
    D.forEach(function (x) {
      var d = x.d; if (x.stopped || x.asi == null || x.kem) return;
      var U = x.asi;
      if (!pf(x.pers[2], f)) return;
      if (today > U + 3 && (d.top == null || today > d.top)) return;
      var w = (today < U ? U - today : today > U + 3 ? today - U - 3 : 0) * 1e5 + (today > U + 3 ? 50000 : 0) + x.idx;
      var durum = today < U ? 1 : today <= U + 3 ? 2 : (d.top != null && today <= d.top) ? 3 : 4;
      var txt;
      if (durum === 1) txt = U - today === 1 ? 'Yarın başlıyor' : (U - today) + ' gün sonra başlıyor';
      else if (durum === 2) txt = 'AŞIDA · ' + (today - U + 1) + '. gün' + (today - U === 3 ? ' (son gün)' : '');
      else if (durum === 3) txt = d.top === today ? 'Bugün toplama' : 'Aşı bitti · toplama ' + (d.top - today) + ' gün sonra';
      else txt = 'Tamamlandı';
      r.push({ x: x, bas: U, durum: durum, text: txt, key: w, pers: x.pers[2] });
    });
    return r.sort(byKey);
  };

  DT.listToplama = function (D, today, f) {
    var r = [];
    D.forEach(function (x) {
      var d = x.d; if (x.stopped || d.top == null || d.top < today || !pf(x.pers[6], f)) return;
      var diff = d.top - today;
      var durum = d.top > today ? 1 : 2;
      r.push({ x: x, date: d.top, durum: durum, key: Math.abs(diff) * 1e5 + x.idx, pers: x.pers[6],
        text: durum === 2 ? 'BUGÜN TOPLAMA' : (diff === 1 ? 'Yarın toplama' : diff + ' gün sonra toplama') });
    });
    return r.sort(byKey);
  };

  DT.listTasima = function (D, today, f) {
    var r = [];
    D.forEach(function (x) {
      var d = x.d; if (x.stopped || d.top == null || x.yd === 1 || d.top < today || !pf(x.pers[7], f)) return;
      var diff = d.top - today, bolge = xtrim(d.bolge);
      r.push({ x: x, date: d.top, durum: diff > 0 ? 1 : 2, key: Math.abs(diff) * 1e5 + x.idx, pers: x.pers[7],
        bolge: bolge, eslesme: bolge === '' ? 'Nakil merkezi girilmemiş' : S(d.hastane) + '-' + bolge,
        text: diff === 0 ? 'BUGÜN TAŞIMA' : (diff === 1 ? 'Yarın taşıma' : diff + ' gün sonra taşıma') });
    });
    return r.sort(byKey);
  };

  // Ürün Taşıma · hastane × bölge eşleştirme tablosu
  DT.tasimaMatrix = function (state, D, year) {
    var ok = D.filter(function (x) {
      var d = x.d;
      return d.top != null && xtrim(d.bolge) !== '' && !x.stopped && x.yd !== 1 && (!year || DT.year(d.top) === year);
    });
    var cnt = {}, order = [];
    ok.forEach(function (x) { var b = xtrim(x.d.bolge); if (!(b in cnt)) { cnt[b] = 0; order.push(b); } cnt[b]++; });
    var cols = order.slice().sort(function (a, b) { return cnt[b] - cnt[a] || order.indexOf(a) - order.indexOf(b); }).slice(0, 8);
    var rows = state.lists.hastane.map(function (h) {
      var mine = ok.filter(function (x) { return eqi(x.d.hastane, h.ad); });
      return { hastane: h.ad, cells: cols.map(function (c) { return mine.filter(function (x) { return eqi(xtrim(x.d.bolge), c); }).length; }), toplam: mine.length };
    });
    return { cols: cols, rows: rows };
  };

  DT.listSonIzlem = function (D, today, f) {
    var r = [];
    D.forEach(function (x) {
      var s = x.sonIzlem; if (x.stopped || s == null || s < today || !pf(x.pers[1], f)) return;
      var diff = s - today;
      r.push({ x: x, date: s, durum: diff === 0 ? 2 : 1, key: diff * 1e5 + x.idx, pers: x.pers[1],
        gun: x.d.top != null ? (s - x.d.top) + '. gün' : '',
        text: diff === 0 ? 'BUGÜN SON İZLEM' : diff === 1 ? 'Yarın' : diff + ' gün sonra' });
    });
    return r.sort(byKey);
  };

  DT.listIdm = function (D, today, f) {
    var r = [];
    D.forEach(function (x) {
      var d = x.d;
      if ((S(d.ad) + S(d.hk)).length === 0 || x.stopped) return;
      if (!(d.idm || d.idmBas != null || d.idmBit != null)) return;
      if (!pf(d.personel, f)) return;
      var T = d.idmBas, U = d.idmBit, end = U != null ? U : T;
      var ex = T == null ? 3 : T > today ? 2 : end < today ? 4 : 1;
      var key = ex * 1e5 + (ex === 4 ? 99999 - Math.min(99999, Math.max(0, end - 40000)) : (T != null ? T - 40000 : 0)) + x.idx / 10000;
      var txt;
      if (ex === 1) txt = 'Sürüyor · ' + (today - T + 1) + '. gün' + (end === today ? ' · bugün bitiyor' : ' · ' + (end - today) + ' gün kaldı');
      else if (ex === 2) txt = T - today === 1 ? 'Yarın başlıyor' : (T - today) + ' gün sonra başlıyor';
      else if (ex === 3) txt = 'Tarih girilmedi';
      else txt = 'Bitti · ' + (today - end === 1 ? 'dün' : (today - end) + ' gün önce');
      var sure = (T != null && U != null) ? (U < T ? 'tarih hatalı' : (U - T + 1) + ' gün') : '';
      r.push({ x: x, durum: ex, key: key, text: txt, sure: sure, pers: S(d.personel) });
    });
    return r.sort(byKey);
  };

  /* ---------------- Çalışma Programı (WhatsApp metni) ---------------- */
  DT.UNASSIGNED = 'PERSONEL ATANMAMIŞ';
  DT.donorLine = function (L, x) {
    var d = x.d;
    var s = S(d.hk) === '' ? S(d.ad) : S(d.hk) + (S(d.dno) === '' ? '' : '-' + S(d.dno)) + ' ' + S(d.ad);
    if (!(S(d.tel) === '' && S(d.ikamet) === '')) s += ' (' + S(d.tel) + (S(d.ikamet) === '' ? '' : ' -' + S(d.ikamet)) + ')';
    if (S(d.hastane) !== '') s += ' ' + DT.hospProg(L, d.hastane);
    return s;
  };
  DT.islemProg = function (L, x, slot) {
    var P = L.prog || {};
    if (slot === 1) return S(P.SK);
    if (slot >= 2 && slot <= 5) return S(x.sabahAksam ? P.AsiSabah : P.Asi);
    if (slot >= 9) return S(P.AsiAksam);
    if (slot === 6) return S(x.kem ? P.TopKem : P.TopPer);
    if (slot === 8) return S(P.Yat);
    return S(P.Tasima);
  };
  // Ek Konsültasyon: hasta kodu Donör Kayıt'ta en alttaki eşleşen kayıt; personel = seçilen ya da sağlık kontrolüne bakan
  DT.konsDonor = function (D, hk) {
    var k = xtrim(hk), r = null;
    if (!k) return null;
    D.forEach(function (x) { if (xtrim(x.d.hk) === k) r = x; });
    return r;
  };
  DT.konsPersonel = function (D, e) {
    if (xtrim(e.personel)) return xtrim(e.personel);
    var x = DT.konsDonor(D, e.hastaKodu);
    return x ? S(x.pers[1]) : '';
  };
  DT.konsDurum = function (D, e, today) {
    if (!xtrim(e.hastaKodu) && e.tarih == null) return '';
    if (xtrim(e.hastaKodu) && !DT.konsDonor(D, e.hastaKodu)) return 'Hasta kodu Donör Kayıt\'ta yok';
    if (e.tarih == null) return 'Tarih yazın';
    if (e.tarih === today) return 'BUGÜN';
    if (e.tarih > today) return e.tarih - today === 1 ? 'Yarın' : (e.tarih - today) + ' gün sonra';
    return 'Yapıldı · ' + (today - e.tarih) + ' gün önce';
  };
  DT.AJANDA_SAATLER = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  DT.ajandaProgramda = function (a) { return xtrim(a.not) !== '' && (a.durum === 'PROGRAMA EKLE' || a.durum === 'EVET'); };

  DT.program = function (state, D, pool, date) {
    var L = state.lists, P = L.prog || {};
    var persList = L.personel.filter(function (p) { return xtrim(p) !== ''; });
    function canon(name) { var n = xtrim(name); if (!n) return DT.UNASSIGNED; var f = DT.inPersonel(L, n); return f || DT.UNASSIGNED; }
    var groups = {}, gorder = [];
    function grp(name) {
      if (!groups[name]) { groups[name] = { name: name, items: [], ek: [], prio: 6 }; gorder.push(name); }
      return groups[name];
    }
    var dayTasks = pool.filter(function (t) { return t.date === date; });
    var kargo = false;
    dayTasks.forEach(function (t) {
      if (t.slot === 7) return;
      var x = D[t.i], g = grp(canon(t.pers));
      g.items.push({ cd: t.cd, text: DT.donorLine(L, x) + ' ' + DT.islemProg(L, x, t.slot), t: t });
      g.prio = Math.min(g.prio, t.prio);
      if (t.slot === 1 && x.yd === 1) kargo = true;
    });
    var ekByCode = {};
    D.forEach(function (x) { var k = xtrim(x.d.hk); if (k && !(k in ekByCode)) ekByCode[k] = x; });
    (state.ekGorevler || []).forEach(function (e) {
      if (e.tarih !== date || !(S(e.personel) || S(e.hastaKodu) || S(e.islem))) return;
      var x = ekByCode[xtrim(e.hastaKodu)];
      var text = x ? DT.donorLine(L, x) + ' ' + S(e.islem) : xtrim(S(e.hastaKodu) + ' ' + S(e.islem));
      grp(canon(e.personel)).ek.push({ text: text, e: e });
    });
    (state.ekKons || []).forEach(function (e) {
      if (e.tarih !== date) return;
      var x = DT.konsDonor(D, e.hastaKodu); if (!x) return;
      var text = DT.donorLine(L, x) + ' ' + S(P.EkKons) + (xtrim(e.bolum) ? ' (' + xtrim(e.bolum) + ')' : '');
      grp(canon(DT.konsPersonel(D, e))).ek.push({ text: text, kons: e });
    });
    var notlar = [];
    (state.ajanda || []).filter(function (a) { return a.tarih === date && DT.ajandaProgramda(a); })
      .sort(function (a, b) { return S(a.saat || '99').localeCompare(S(b.saat || '99')); })
      .forEach(function (a) {
        var text = (a.saat ? a.saat + ' ' : '') + xtrim(a.not), who = xtrim(a.personel) && DT.inPersonel(L, a.personel);
        if (who) grp(who).ek.push({ text: text, ajanda: a }); else notlar.push(text);
      });
    (state.planNotlar || []).filter(function (n) { return n.tarih === date && xtrim(n.not) !== ''; }).forEach(function (n) {
      var who = xtrim(n.personel) && DT.inPersonel(L, n.personel);
      if (who) grp(who).ek.push({ text: xtrim(n.not), plan: n }); else notlar.push(xtrim(n.not));
    });
    var posOf = function (name) { var i = persList.indexOf(name); return i >= 0 ? i + 1 : persList.length + 1; };
    var ordered = gorder.map(function (n) { return groups[n]; })
      .sort(function (a, b) { return (a.prio * 100 + posOf(a.name)) - (b.prio * 100 + posOf(b.name)); });
    var lines = [];
    var p = DT.parts(date);
    lines.push(pad(p.d) + '.' + pad(p.m) + '.' + p.y + ' (' + DT.GUNLER_B[DT.weekday(date) - 1] + ') ÇALIŞMA PROGRAMIMIZ');
    ordered.forEach(function (g) {
      g.items.sort(function (a, b) { return a.cd - b.cd; });
      lines.push(g.name);
      g.items.forEach(function (it) { lines.push(it.text); });
      g.ek.forEach(function (it) { lines.push(it.text); });
      lines.push('');
    });
    if (notlar.length) { lines.push('NOTLAR'); notlar.forEach(function (n) { lines.push(n); }); lines.push(''); }
    var tasLines = dayTasks.filter(function (t) { return t.slot === 7 && !t.yd; });
    tasLines.forEach(function (t) { lines.push(t.islem + ' ' + S(P.Tasima) + (t.pers ? ' (' + t.pers + ')' : '')); });
    var wd = DT.weekday(date);
    if (kargo) {
      var k = (wd === 1 || wd === 3 || wd === 5) ? S(P.KargoTK) : (wd === 2 || wd === 4) ? S(P.KargoAse) : '';
      if (k) lines.push(k);
    }
    if (wd <= 5 && !DT.fullHoliday(L, date)) {
      [P.Sabit1, P.Sabit2].forEach(function (s) { if (xtrim(s) !== '') lines.push(xtrim(s)); });
    }
    lines.push('İYİ ÇALIŞMALAR');
    return { lines: lines, text: lines.join('\n'), groups: ordered, tasks: dayTasks, tasima: tasLines, notlar: notlar };
  };

  /* ---------------- Dashboard ---------------- */
  DT.dashboard = function (state, D, pool, opts) {
    var L = state.lists, today = opts.today, Y = opts.year || '', GY = Y || DT.year(today);
    var esik = opts.esik != null ? opts.esik : 35;
    var inY = function (s) { return !Y || DT.year(s) === Y; };
    var R = { year: Y, gy: GY };
    D.forEach(function (x) {
      var d = x.d;
      x._skYap = d.sk != null && !x.skYapilmadi && d.sk <= today && inY(d.sk);
      x._skPlan = d.sk != null && !x.skYapilmadi && d.sk > today && inY(d.sk);
      x._topGer = d.top != null && !x.stopped && d.top <= today && inY(d.top);
      x._topPlan = d.top != null && !x.stopped && d.top > today && inY(d.top);
      x._topGerTum = d.top != null && !x.stopped && d.top <= today;
      x._topPlanTum = d.top != null && !x.stopped && d.top > today;
      var sy = d.top != null ? DT.year(d.top) : d.sk != null ? DT.year(d.sk) : '';
      x._surecOK = (S(d.hk) + S(d.ad)).length > 0 && (!Y || sy === Y);
      x._sure = (x._topGer && d.sk != null && d.top - d.sk >= 0) ? d.top - d.sk : null;
      x._surecTarih = d.top != null ? d.top : d.sk;
    });
    var cnt = function (fn) { var n = 0; D.forEach(function (x) { if (fn(x)) n++; }); return n; };
    R.kayitli = cnt(function (x) { return x._surecOK; });
    R.skYap = cnt(function (x) { return x._skYap; });
    R.topGer = cnt(function (x) { return x._topGer; });
    R.topPlan = cnt(function (x) { return x._topPlan; });
    R.durdu = cnt(function (x) { return x.stopped && x._surecOK; });
    R.oran = R.topGer + R.durdu === 0 ? null : R.topGer / (R.topGer + R.durdu);
    R.skAnk = cnt(function (x) { return x.ankara === 1 && x._skYap; });
    R.skDis = cnt(function (x) { return x.ankara === 0 && x._skYap; });
    R.topAnk = cnt(function (x) { return x.ankara === 1 && x._topGer; });
    R.topDis = cnt(function (x) { return x.ankara === 0 && x._topGer; });
    R.iptal = cnt(function (x) { return x.iptal && x._surecOK; });
    R.ertele = cnt(function (x) { return x.ertele && x._surecOK; });
    R.red = cnt(function (x) { return x.red && x._surecOK; });
    R.vazgec = cnt(function (x) { return x.vazgec && x._surecOK; });
    var mStart = function (y, m) { return DT.serial(y, m, 1); };
    var inMonth = function (s, y, m) { return s != null && s >= mStart(y, m) && s < mStart(y, m + 1); };
    R.aylik = DT.AYLAR.map(function (ad, k) {
      return { ad: ad,
        ger: cnt(function (x) { return x._topGerTum && inMonth(x.d.top, GY, k + 1); }),
        plan: cnt(function (x) { return x._topPlanTum && inMonth(x.d.top, GY, k + 1); }) };
    });
    // İl bazlı sağlık kontrolü
    var il = {}, ilOrder = [];
    D.forEach(function (x) {
      if (!x.il || !(x._skYap || x._skPlan)) return;
      if (!(x.il in il)) { il[x.il] = { il: x.il, yap: 0, plan: 0, first: ilOrder.length }; ilOrder.push(x.il); }
      if (x._skYap) il[x.il].yap++; if (x._skPlan) il[x.il].plan++;
    });
    R.iller = ilOrder.map(function (k) { return il[k]; })
      .sort(function (a, b) { return b.yap - a.yap || b.plan - a.plan || a.first - b.first; });
    R.hastane = L.hastane.map(function (h) {
      return { ad: h.ad, sk: cnt(function (x) { return eqi(x.d.hastane, h.ad) && x._skYap; }), top: cnt(function (x) { return eqi(x.d.hastane, h.ad) && x._topGer; }) };
    });
    function byList(list, field) {
      var rows = list.map(function (v) { return { ad: v, n: cnt(function (x) { return eqi(x.d[field], v) && x._surecOK; }) }; });
      rows.push({ ad: 'Belirtilmemiş', n: cnt(function (x) { return S(x.d[field]).length === 0 && x._surecOK; }) });
      return rows;
    }
    R.yontem = byList(L.yontem, 'yontem');
    R.ulasim = byList(L.ulasim, 'ulasim');
    R.konaklama = byList(L.konaklama, 'konaklama');
    R.nakil = {
      yiGer: cnt(function (x) { return x.yd === 0 && x._topGer; }), yiPlan: cnt(function (x) { return x.yd === 0 && x._topPlan; }),
      ydGer: cnt(function (x) { return x.yd === 1 && x._topGer; }), ydPlan: cnt(function (x) { return x.yd === 1 && x._topPlan; }),
      yokGer: cnt(function (x) { return x.yd === '' && x._topGer; }), yokPlan: cnt(function (x) { return x.yd === '' && x._topPlan; })
    };
    var ul = {}, ulOrder = [];
    D.forEach(function (x) {
      if (x.yd !== 1 || !x._topGer) return;
      if (!(x.ulke in ul)) { ul[x.ulke] = { ad: x.ulke, n: 0, first: ulOrder.length }; ulOrder.push(x.ulke); }
      ul[x.ulke].n++;
    });
    R.ulkeler = ulOrder.map(function (k) { return ul[k]; }).sort(function (a, b) { return b.n - a.n || a.first - b.first; });
    // Kargo (yurt dışı nakil merkezli donörün hafta içi sağlık kontrolü günü, gün başına bir kargo)
    var kargoDays = {};
    D.forEach(function (x) {
      var d = x.d;
      if (x.yd !== 1 || d.sk == null || DT.weekday(d.sk) > 5) return;
      if (x.stopped && d.sk > today) return;
      if (!(d.sk in kargoDays)) kargoDays[d.sk] = [1, 3, 5].indexOf(DT.weekday(d.sk)) >= 0 ? 'TK' : 'ASE';
    });
    R.kargo = DT.AYLAR.map(function (ad, k) {
      var tk = 0, ase = 0;
      Object.keys(kargoDays).forEach(function (s) { s = +s; if (inMonth(s, GY, k + 1)) { if (kargoDays[s] === 'TK') tk++; else ase++; } });
      return { ad: ad, tk: tk, ase: ase };
    });
    // Süreç süresi
    function stats(arr) {
      if (!arr.length) return { n: 0, ort: null, min: null, max: null };
      var s = 0, mn = Infinity, mx = -Infinity; arr.forEach(function (v) { s += v; mn = Math.min(mn, v); mx = Math.max(mx, v); });
      return { n: arr.length, ort: Math.round(s / arr.length * 10) / 10, min: mn, max: mx };
    }
    var sureAll = D.filter(function (x) { return x._sure != null; });
    R.sureHastane = L.hastane.map(function (h) {
      var st = stats(sureAll.filter(function (x) { return eqi(x.d.hastane, h.ad); }).map(function (x) { return x._sure; })); st.ad = h.ad; return st;
    });
    R.sureTum = stats(sureAll.map(function (x) { return x._sure; }));
    R.esik = esik;
    R.esikAsan = sureAll.filter(function (x) { return x._sure > esik; }).length;
    R.sureAylik = DT.AYLAR.map(function (ad, k) {
      var a = sureAll.filter(function (x) { return inMonth(x.d.top, GY, k + 1); }).map(function (x) { return x._sure; });
      var st = stats(a); st.ad = ad; return st;
    });
    // Durma nedenleri
    var neden = { 'Hasta kaynaklı': 0, 'Nakil merkezi kaynaklı': 0, 'Bağışçı · sağlık / red': 0, 'Bağışçı · vazgeçme / kişisel': 0, 'Diğer / belirtilmemiş': 0 };
    D.forEach(function (x) {
      if (!x.stopped || !x._surecOK) return;
      var ac = x.d.aciklama, k;
      if (has(ac, 'hasta ex', 'hastası ex', 'hastasi ex', 'ex oldu', 'exitus', 'hasta kaynak', 'hastası', 'hastasi')) k = 'Hasta kaynaklı';
      else if (has(ac, 'merkez')) k = 'Nakil merkezi kaynaklı';
      else if (has(ac, 'red', 'muayene')) k = 'Bağışçı · sağlık / red';
      else if (has(ac, 'bağışçı', 'bagisci', 'vazgeç', 'vazgec')) k = 'Bağışçı · vazgeçme / kişisel';
      else k = 'Diğer / belirtilmemiş';
      neden[k]++;
    });
    R.nedenler = Object.keys(neden).map(function (k) { return { ad: k, n: neden[k] }; });
    R.durmaAylik = DT.AYLAR.map(function (ad, k) {
      var dur = cnt(function (x) { return x.stopped && x._surecTarih != null && inMonth(x._surecTarih, GY, k + 1) && x._surecTarih <= today; });
      var ger = cnt(function (x) { return x._topGerTum && inMonth(x.d.top, GY, k + 1); });
      return { ad: ad, durdu: dur, ger: ger, oran: dur + ger === 0 ? null : dur / (dur + ger) };
    });
    // Yıl karşılaştırması
    R.yilKars = DT.AYLAR.map(function (ad, k) {
      var once = cnt(function (x) { return x._topGerTum && inMonth(x.d.top, GY - 1, k + 1); });
      var bu = mStart(GY, k + 1) > today ? null : cnt(function (x) { return x._topGerTum && inMonth(x.d.top, GY, k + 1); });
      return { ad: ad, once: once, bu: bu };
    });
    var tp = DT.parts(today);
    var ytdEnd = function (y) { return DT.serial(y, tp.m, tp.d); };
    R.ytd = {
      once: cnt(function (x) { return x._topGerTum && x.d.top >= mStart(GY - 1, 1) && x.d.top <= ytdEnd(GY - 1); }),
      bu: cnt(function (x) { return x._topGerTum && x.d.top >= mStart(GY, 1) && x.d.top <= ytdEnd(GY); })
    };
    // Önümüzdeki 4 hafta
    var ws = DT.weekStart(today);
    R.dortHafta = [0, 1, 2, 3].map(function (w) {
      var a = ws + w * 7, b = a + 7, inW = function (t) { return t.date >= a && t.date < b; };
      var r = { bas: a, sk: 0, asi: 0, top: 0, tas: 0, yat: 0 };
      pool.forEach(function (t) {
        if (!inW(t)) return;
        if (t.slot === 1) r.sk++; else if (t.slot === 2) r.asi++; else if (t.slot === 6) r.top++;
        else if (t.slot === 7 && !t.yd) r.tas++; else if (t.slot === 8) r.yat++;
      });
      r.toplam = r.sk + r.asi + r.top + r.tas + r.yat; return r;
    });
    R.gunler = DT.GUNLER.map(function (g, k) {
      return { ad: g, sk: cnt(function (x) { return x._skYap && DT.weekday(x.d.sk) === k + 1; }), top: cnt(function (x) { return x._topGer && DT.weekday(x.d.top) === k + 1; }) };
    });
    R.ikamet = [['Ankara içi', 1], ['Ankara dışı', 0], ['İkamet girilmemiş', '']].map(function (e) {
      return { ad: e[0], donor: cnt(function (x) { return x.ankara === e[1] && x._surecOK; }), sk: cnt(function (x) { return x.ankara === e[1] && x._skYap; }), top: cnt(function (x) { return x.ankara === e[1] && x._topGer; }) };
    });
    // Personel iş yükü
    var persList = L.personel.filter(function (p) { return xtrim(p) !== ''; });
    var PY = Y || DT.year(today), PM = opts.month || DT.month(today);
    function persRows(from, to) {
      var rows = persList.map(function (p) { return { ad: p, sk: 0, asi: 0, top: 0, yat: 0, tas: 0, ek: 0, yapilan: 0 }; });
      var other = { ad: 'Atanmamış / listede yok', sk: 0, asi: 0, top: 0, yat: 0, tas: 0, ek: 0, yapilan: 0 };
      pool.forEach(function (t) {
        if (t.date < from || t.date >= to) return;
        if (t.slot === 7 && t.yd) return;
        var r = null;
        for (var i = 0; i < persList.length; i++) if (eqi(persList[i], t.pers)) { r = rows[i]; break; }
        r = r || other;
        if (t.slot === 1) r.sk++; else if (t.kind === 'asi') r.asi++; else if (t.slot === 6) r.top++;
        else if (t.slot === 8) r.yat++; else if (t.slot === 7) r.tas++;
        if (t.date <= today) r.yapilan++;
      });
      (state.ekKons || []).forEach(function (e) {
        if (e.tarih == null || e.tarih < from || e.tarih >= to) return;
        var nm = DT.konsPersonel(D, e); if (!nm && !xtrim(e.hastaKodu)) return;
        var r = null;
        for (var i = 0; i < persList.length; i++) if (eqi(persList[i], nm)) { r = rows[i]; break; }
        r = r || other; r.ek++; if (e.tarih <= today) r.yapilan++;
      });
      rows.push(other);
      rows.forEach(function (r) { r.toplam = r.sk + r.asi + r.top + r.yat + r.tas + r.ek; r.plan = r.toplam - r.yapilan; });
      return rows;
    }
    R.persAy = { y: PY, m: PM, rows: persRows(mStart(PY, PM), mStart(PY, PM + 1)) };
    var pyRows = persRows(mStart(PY, 1), mStart(PY + 1, 1));
    var pyTotal = pyRows.reduce(function (s, r) { return s + r.toplam; }, 0);
    pyRows.forEach(function (r) { r.pay = pyTotal ? r.toplam / pyTotal : null; });
    var named = pyRows.slice(0, -1), active = named.filter(function (r) { return r.toplam > 0; });
    var other = pyRows[pyRows.length - 1];
    var mx = named.reduce(function (m, r) { return r.toplam > (m ? m.toplam : 0) ? r : m; }, null);
    var mnAct = active.reduce(function (m, r) { return !m || r.toplam < m.toplam ? r : m; }, null);
    R.persYil = { y: PY, rows: pyRows, toplam: pyTotal, atanan: pyTotal - other.toplam,
      oran: pyTotal ? (pyTotal - other.toplam) / pyTotal : null, aktif: active.length,
      ort: active.length ? Math.round((pyTotal - other.toplam) / active.length * 10) / 10 : null,
      enCok: mx ? mx.ad + ' (' + mx.toplam + ')' : '–', enAz: mnAct ? mnAct.ad + ' (' + mnAct.toplam + ')' : '–' };
    R.persHafta = persList.concat(['Atanmamış / listede yok']).map(function (p, i) {
      var isOther = i === persList.length;
      var weeks = [0, 1, 2, 3].map(function (w) {
        var a = ws + w * 7, b = a + 7;
        var match = function (name) { var n2 = DT.inPersonel(L, name); return isOther ? !n2 : eqi(n2 || '', p); };
        return pool.filter(function (t) {
          if (t.date < a || t.date >= b || (t.slot === 7 && t.yd)) return false;
          return match(t.pers);
        }).length + (state.ekKons || []).filter(function (e) {
          return e.tarih != null && e.tarih >= a && e.tarih < b && (xtrim(e.hastaKodu) || xtrim(e.personel)) && match(DT.konsPersonel(D, e));
        }).length;
      });
      return { ad: p, weeks: weeks, toplam: weeks.reduce(function (s, v) { return s + v; }, 0) };
    });
    // DLİ
    var dli = D.filter(function (x) { return x.dli && x._surecOK; });
    R.dli = {
      kayit: dli.length, kayitPay: R.kayitli ? dli.length / R.kayitli : null,
      ger: dli.filter(function (x) { return x._topGer; }).length, plan: dli.filter(function (x) { return x._topPlan; }).length,
      durdu: dli.filter(function (x) { return x.stopped; }).length,
      hastane: L.hastane.map(function (h) {
        return { ad: h.ad, kayit: dli.filter(function (x) { return eqi(x.d.hastane, h.ad); }).length,
          ger: dli.filter(function (x) { return eqi(x.d.hastane, h.ad) && x._topGer; }).length };
      })
    };
    R.dli.gerPay = R.topGer ? R.dli.ger / R.topGer : null;
    R.dli.planPay = R.topPlan ? R.dli.plan / R.topPlan : null;
    R.dli.durduPay = R.dli.kayit ? R.dli.durdu / R.dli.kayit : null;
    return R;
  };

  /* ---------------- Durum / yeni kayıt ---------------- */
  DT.emptyDonor = function () {
    return { id: DT.uid(), hk: '', dno: '', ad: '', tel: '', ikamet: '', sk: null, yontem: '', hastane: '', aciklama: '',
      asiManual: null, top: null, bolge: '', personel: '', sonIzlemManual: null, ulasim: '', konaklama: '', tasiyan: '',
      idm: false, idmBas: null, idmBit: null };
  };
  DT.uid = function () { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  DT.newState = function (lists) {
    return { version: 1, donors: [], overrides: {}, ekGorevler: [], ekKons: [], ajanda: [], planNotlar: [], gorevKayit: [], tasimaKayit: [], kapanis: { kesim: null },
      lists: JSON.parse(JSON.stringify(lists)), settings: { esik: 35 } };
  };

  /* ---------------- Haftalık Plan sırası ---------------- */
  DT.planGroup = function (x, t) {   // 1 kök hücre toplama · 2 kemik iliği · 3 yatış · 4 aşı · 5 sağlık kontrolü · 6 ürün taşıma
    if (t.slot === 6) return x.kem ? 2 : 1;
    if (t.slot === 8) return 3;
    if (t.slot === 1) return 5;
    if (t.slot === 7) return 6;
    return 4;
  };
  DT.planName = function (x) {
    var d = x.d, il = x.ankara === 1 || !S(d.ikamet).trim() ? '' : ' (' + (x.il || xtrim(d.ikamet)) + ')';
    return S(d.ad) + il + (S(d.hastane) ? ' · ' + S(d.hastane).replace('PEDİATRİ', 'PED.').replace('ERİŞKİN', 'ERİŞ.') : '');
  };

  /* ---------------- Görev arşivi, haftalık kapanış, iş yükü ---------------- */
  DT.IS_TURU = ['Sağlık muayenesi', 'Aşı', 'Toplama', 'Ek test / izlem / diğer bağışçı işi', 'Transfer', 'Ürün taşıma – şehir içi',
    'Ürün taşıma – şehir dışı', 'Bağışçı kazanımı (saha)', 'Kargo / numune gönderimi', 'Ofis / lab / koordinasyon', 'Eğitim / sınav / diğer', 'İzin'];
  DT.ANA_GRUP = { 'Sağlık muayenesi': 'Bağışçı takibi', 'Aşı': 'Bağışçı takibi', 'Toplama': 'Bağışçı takibi', 'Ek test / izlem / diğer bağışçı işi': 'Bağışçı takibi',
    'Transfer': 'Transfer', 'Ürün taşıma – şehir içi': 'Ürün taşıma', 'Ürün taşıma – şehir dışı': 'Ürün taşıma', 'Bağışçı kazanımı (saha)': 'Bağışçı kazanımı',
    'Kargo / numune gönderimi': 'Kargo, eğitim ve diğer', 'Ofis / lab / koordinasyon': 'Ofis / lab / koordinasyon', 'Eğitim / sınav / diğer': 'Kargo, eğitim ve diğer', 'İzin': 'İzin' };
  // Programdaki görevlerden kayıt satırları (kapanışta arşive yazılır; kapatılmamış haftalar için canlı sayılır)
  DT.liveRecords = function (state, D, pool, from, to) {
    var L = state.lists, out = [], eksik = 0;
    pool.forEach(function (t) {
      if (t.date < from || t.date > to || (t.slot === 7 && t.yd)) return;
      var who = DT.inPersonel(L, t.pers), x = D[t.i], d = x.d;
      if (!who) { eksik++; return; }
      var r = { tarih: t.date, personel: who, kaynak: 'Program', aciklama: t.islem + ' – ' + S(d.hastane) + ' – ' + (S(d.hk) ? d.hk + ' ' : '') + S(d.ad) };
      if (t.slot === 1) r.tur = 'Sağlık muayenesi';
      else if (t.kind === 'asi') r.tur = 'Aşı';
      else if (t.slot === 6) r.tur = 'Toplama';
      else if (t.slot === 8) r.tur = 'Ek test / izlem / diğer bağışçı işi';
      else {
        var ic = x.sehir === 'Ankara';
        r.tur = ic ? 'Ürün taşıma – şehir içi' : 'Ürün taşıma – şehir dışı';
        r.nereden = S(d.hastane); r.nereye = S(d.bolge); r.yon = ic ? 'Ankara içi' : "Ankara'dan çıkış"; r.sehir = x.sehir || 'Diğer';
        r.yontem = ic ? 'Şehir içi' : (has(d.aciklama, 'kurye') ? 'Kurye karşılama / teslim' : 'Bizzat gitti');
      }
      out.push(r);
    });
    (state.ekKons || []).forEach(function (e) {
      if (e.tarih == null || e.tarih < from || e.tarih > to) return;
      var who = DT.inPersonel(L, DT.konsPersonel(D, e));
      if (!who) { eksik++; return; }
      out.push({ tarih: e.tarih, personel: who, kaynak: 'Program', tur: 'Ek test / izlem / diğer bağışçı işi', aciklama: S(L.prog.EkKons || 'EK KONSÜLTASYON') + ' – ' + S(e.hastaKodu) + (e.bolum ? ' – ' + e.bolum : '') });
    });
    (state.ajanda || []).forEach(function (a) {
      if (a.tarih == null || a.tarih < from || a.tarih > to || !xtrim(a.personel)) return;
      if (['PROGRAMA EKLE', 'YAPILDI', 'EVET'].indexOf(a.durum) < 0) return;
      var who = DT.inPersonel(L, a.personel); if (!who) return;
      out.push({ tarih: a.tarih, personel: who, kaynak: 'Program', tur: a.tur || 'Eğitim / sınav / diğer', aciklama: (a.saat ? a.saat + ' ' : '') + xtrim(a.not) });
    });
    out.sort(function (a, b) { return a.tarih - b.tarih || S(a.personel).localeCompare(S(b.personel), 'tr'); });
    return { rows: out, eksik: eksik };
  };
  // Kapatılmayı bekleyen haftalar: kesim gününden başlayıp pazar biten pencereler, içinde bulunulan haftaya kadar
  // Kapanış kesim tarihi; kaydedilmemişse arşivin son gününden sonrası (arşiv de yoksa null)
  DT.kesimOf = function (state) {
    var k = state.kapanis && state.kapanis.kesim;
    if (k != null) return k;
    var mx = null;
    (state.gorevKayit || []).forEach(function (r) { if (r.tarih != null && (mx == null || r.tarih > mx)) mx = r.tarih; });
    return mx != null ? mx + 1 : null;
  };
  DT.pendingWeeks = function (state, today) {
    var k = DT.kesimOf(state), out = [];
    if (k == null) return out;
    var cur = DT.weekStart(today);
    while (k < cur && out.length < 60) { var end = DT.weekStart(k) + 6; out.push({ bas: k, son: end }); k = end + 1; }
    return out;
  };
  DT.workRecords = function (state, D, pool, from, to) {
    // Arşiv (Görev Kayıtları) + kesimden sonrası programdan canlı sayım; arşiv hiç yoksa bütün dönem programdan sayılır
    var kesim = DT.kesimOf(state);
    var arc = (state.gorevKayit || []).filter(function (r) { return r.tarih != null && r.tarih >= from && r.tarih <= to; })
      .map(function (r) { return Object.assign({ canli: false }, r); });
    var live = [], lf = kesim != null ? Math.max(from, kesim) : from;
    if (lf <= to) live = DT.liveRecords(state, D, pool, lf, to).rows.map(function (r) { r.canli = true; return r; });
    return arc.concat(live);
  };
  // Excel'deki arşivi uygulamadakiyle birleştirir (aynı kayıt iki kez girmez)
  DT.mergeArchive = function (state, ex) {
    var gk = function (r) { return [r.tarih, xtrim(r.personel), r.tur, xtrim(r.aciklama), r.kaynak].join('|'); };
    var tk = function (r) { return [r.tarih, xtrim(r.personel), xtrim(r.nereden), xtrim(r.nereye), xtrim(r.ifade)].join('|'); };
    // Excel'deki kayıtların hepsi + uygulamada Excel'dekinden fazla olanlar (aynı gün aynı iş iki kez yapılmış olabilir)
    var union = function (ex, app, key) {
      var cnt = {}, seen = {}, out = ex.slice();
      ex.forEach(function (r) { var k = key(r); cnt[k] = (cnt[k] || 0) + 1; });
      app.forEach(function (r) { var k = key(r); seen[k] = (seen[k] || 0) + 1; if (seen[k] > (cnt[k] || 0)) out.push(r); });
      return out.sort(function (x, y) { return (x.tarih || 0) - (y.tarih || 0); });
    };
    var g0 = (state.gorevKayit || []).length, t0 = (state.tasimaKayit || []).length;
    state.gorevKayit = union(ex.gorevKayit || [], state.gorevKayit || [], gk);
    state.tasimaKayit = union(ex.tasimaKayit || [], state.tasimaKayit || [], tk);
    var a = state.kapanis && state.kapanis.kesim, b = ex.kapanis && ex.kapanis.kesim;
    state.kapanis = state.kapanis || {};
    state.kapanis.kesim = a == null ? (b == null ? null : b) : (b == null ? a : Math.max(a, b));
    return { gorev: state.gorevKayit.length - g0, tasima: state.tasimaKayit.length - t0 };
  };
  DT.isYuku = function (state, D, pool, from, to) {
    var L = state.lists, persList = L.personel.filter(function (p) { return xtrim(p) !== ''; });
    var recs = DT.workRecords(state, D, pool, from, to);
    var mk = function (ad) { var r = { ad: ad, tur: {}, kayit: 0, canli: 0, toplam: 0, gun: {}, hsonu: {}, izin: {}, ana: {} }; DT.IS_TURU.forEach(function (t) { r.tur[t] = 0; }); return r; };
    var rows = persList.map(mk), other = mk('Diğer / listede yok');
    recs.forEach(function (rec) {
      var r = null;
      for (var i = 0; i < persList.length; i++) if (eqi(persList[i], rec.personel)) { r = rows[i]; break; }
      r = r || other;
      var tur = DT.IS_TURU.indexOf(rec.tur) >= 0 ? rec.tur : 'Eğitim / sınav / diğer';
      if (tur === 'İzin') { r.izin[rec.tarih] = 1; return; }
      r.tur[tur]++; r.toplam++; if (rec.canli) r.canli++; else r.kayit++;
      r.gun[rec.tarih] = 1; if (DT.weekday(rec.tarih) >= 6) r.hsonu[rec.tarih] = 1;
      var g = DT.ANA_GRUP[tur] || 'Kargo, eğitim ve diğer'; r.ana[g] = (r.ana[g] || 0) + 1;
    });
    rows.push(other);
    rows.forEach(function (r) { r.gunN = Object.keys(r.gun).length; r.hsonuN = Object.keys(r.hsonu).length; r.izinN = Object.keys(r.izin).length; });
    return { rows: rows.filter(function (r, i) { return i < rows.length - 1 || r.toplam || r.izinN; }), recs: recs };
  };
  DT.tasimaStats = function (state, D, pool, from, to) {
    var L = state.lists, persList = L.personel.filter(function (p) { return xtrim(p) !== ''; });
    var recs = [];
    (state.tasimaKayit || []).forEach(function (t) {
      if (t.tarih == null || t.tarih < from || t.tarih > to) return;
      recs.push({ tarih: t.tarih, personel: t.personel, ic: fold(t.kapsam).indexOf('içi') >= 0 || fold(t.kapsam).indexOf('ici') >= 0, sehir: S(t.sehir), yontem: S(t.yontem), benzersiz: S(t.benzersiz) !== '0', kaynak: 'Belge' });
    });
    DT.workRecords(state, D, pool, from, to).forEach(function (r) {
      if (r.kaynak === 'Belge' || S(r.tur).indexOf('Ürün taşıma') !== 0) return;
      recs.push({ tarih: r.tarih, personel: r.personel, ic: r.tur === 'Ürün taşıma – şehir içi', sehir: S(r.sehir), yontem: S(r.yontem), benzersiz: true, kaynak: r.canli ? 'Canlı' : r.kaynak });
    });
    var mk = function (ad) { return { ad: ad, ic: 0, dis: 0, bizzat: 0, kurye: 0, toplam: 0, benzersiz: 0, ay: {} }; };
    var rows = persList.map(mk), other = mk('Diğer / listede yok'), sehir = {};
    recs.forEach(function (rec) {
      var r = null;
      for (var i = 0; i < persList.length; i++) if (eqi(persList[i], rec.personel)) { r = rows[i]; break; }
      r = r || other;
      r.toplam++; if (rec.benzersiz) r.benzersiz++;
      if (rec.ic) r.ic++; else { r.dis++; if (fold(rec.yontem).indexOf('kurye') >= 0) r.kurye++; else r.bizzat++; var c = rec.sehir || 'Belirtilmemiş'; sehir[c] = (sehir[c] || 0) + 1; }
      var m = DT.parts(rec.tarih); var key = m.y + '-' + (m.m < 10 ? '0' : '') + m.m; r.ay[key] = (r.ay[key] || 0) + 1;
    });
    rows.push(other);
    return { rows: rows.filter(function (r, i) { return i < rows.length - 1 || r.toplam; }), sehirler: Object.keys(sehir).map(function (k) { return { ad: k, n: sehir[k] }; }).sort(function (a, b) { return b.n - a.n; }), n: recs.length };
  };

  /* ---- Mailden süreç durumu: iptal / red / erteleme / vazgeçme / hasta ex ---- */
  var HARF = 'a-z0-9çğöşüâîû';
  DT.DURUMLAR = [ // [anahtar, düğme, açıklamaya yazılan, mailde aranan]
    ['hastaex', 'Hasta ex', 'HASTA EX', new RegExp('exitus|ex oldu|hasta(si)? ex(?![' + HARF + '])|kaybedil|vefat')],
    ['vazgec', 'Vazgeçti', 'VAZGEÇTİ', /vazge[cç]|onamini geri|geri çekil/],
    ['red', 'Red', 'RED', new RegExp('(^|[^' + HARF + '])(redd?[' + HARF + ']*|ret)(?![' + HARF + '])|uygun bulunmad')],
    ['ertele', 'Ertelendi', 'ERTELENDİ', /ertele|ileri (bir )?tarihe|beklemeye al/],
    ['iptal', 'İptal', 'İPTAL', /iptal/]
  ];
  DT.parseDurumMail = function (text, D, subject) {
    var body = S(text).replace(/\r/g, ''), konu = S(subject).replace(/\r/g, '');
    var raw = (konu ? konu + '\n' : '') + body, f = fold(raw).replace(/[ \t\u00a0]+/g, ' ');
    var r = { cands: [], durum: null, cumle: '', kodlar: [] };
    // durum: listedeki sırayla ilk eşleşen (hasta ex > vazgeçti > red > ertelendi > iptal)
    for (var k = 0; k < DT.DURUMLAR.length; k++) if (DT.DURUMLAR[k][3].test(f)) { r.durum = DT.DURUMLAR[k][0]; break; }
    // durumun geçtiği cümle (açıklamaya kısa not olarak)
    if (r.durum) {
      var re = DT.DURUMLAR.filter(function (z) { return z[0] === r.durum; })[0][3];
      var BASLIK = /^(kimden|gönderen|kime|konu|tarih|gönderildi|from|to|subject|sent|date|cc|bilgi)\s*:/i;
      var lines = body.split(/\n+/).filter(function (l) { return !BASLIK.test(l.trim()); }).join('\n');
      var parts = lines.split(/\n+|(?:[.!?])\s+/).concat([konu.replace(BASLIK, '')]);
      for (var j = 0; j < parts.length; j++) {
        var c = xtrim(parts[j].replace(/\s+/g, ' '));
        if (c && re.test(fold(c))) {
          c = c.replace(/^(merhaba|sayın|selam|iyi çalışmalar|bilgilerinize)[^,:]*[,:]\s*/i, '');
          r.cumle = c.length > 140 ? c.slice(0, 137).replace(/\s+\S*$/, '') + '…' : c;
          break;
        }
      }
    }
    // donör: hasta kodu / donör numarası (kesin) ya da ad soyad
    var bound = function (w) { var i = f.indexOf(w); while (i >= 0) { var a = f.charAt(i - 1), b = f.charAt(i + w.length); if (!new RegExp('[' + HARF + ']').test(a || ' ') && !new RegExp('[' + HARF + ']').test(b || ' ')) return true; i = f.indexOf(w, i + 1); } return false; };
    (D || []).forEach(function (x) {
      var d = x.d, sc = 0, hk = fold(xtrim(d.hk)), dno = fold(xtrim(d.dno)), ad = fold(xtrim(d.ad));
      if (hk.length >= 4 && bound(hk)) sc += 10;
      if (dno.length >= 6 && bound(dno)) sc += 10;
      if (ad.indexOf(' ') > 0 && bound(ad)) sc += 5;
      if (sc) r.cands.push({ x: x, sc: sc });
    });
    r.cands.sort(function (a, b) { return b.sc - a.sc || (S(b.x.d.top) ? b.x.d.top : 0) - (S(a.x.d.top) ? a.x.d.top : 0); });
    if (r.cands.length && r.cands[0].sc >= 10) r.cands = r.cands.filter(function (c) { return c.sc >= 10; });
    var known = {};
    (D || []).forEach(function (x) { known[fold(xtrim(x.d.hk))] = 1; known[fold(xtrim(x.d.dno))] = 1; });
    (raw.match(/\b(?:[A-Z]{2}\d{4,}[A-Z]?|T\d{14})\b/g) || []).forEach(function (c) { if (!known[fold(c)] && r.kodlar.indexOf(c) < 0) r.kodlar.push(c); });
    return r;
  };
  // Açıklamaya yalnızca anahtar kelime yazılır (ör. ERTELENDİ); elle not girilirse yanına eklenir
  DT.durumNotu = function (durum, sebep) {
    var z = DT.DURUMLAR.filter(function (q) { return q[0] === durum; })[0];
    if (!z) return '';
    return z[2] + (xtrim(sebep) ? ': ' + xtrim(sebep) : '');
  };


  root.DT = DT;
  if (typeof module !== 'undefined' && module.exports) module.exports = DT;
})(typeof window !== 'undefined' ? window : globalThis);
