/* Donör Takip – EŞLEŞME: Kök hücre eşleşme takibi (YENİ EŞLEŞME TABLOSU OABKM'nin uygulamadaki karşılığı).
 * Kayıtlar (ANA TABLO) IndexedDB'de tutulur; istatistik sayfaları Excel formüllerinin aynısıyla hesaplanır.
 * Excel gibi metin karşılaştırmaları büyük/küçük harf duyarsızdır.
 */
(function (root) {
  'use strict';
  var DT = root.DT, ES = {};
  var S = function (v) { return v == null ? '' : String(v); };

  /* ---------------- listeler (Excel'deki açılır listeler) ---------------- */
  ES.KBM = ['Ankara KBM', 'Ankara Batı KBM', 'Çorum KBM', 'Kastamonu KBM', 'Kırıkkale KBM', 'Konya KBM'];
  ES.GVM = ['Avrupa GVM', 'Batı Akdeniz GVM', 'Batı Anadolu GVM', 'Batı Karadeniz GVM', 'Doğu Akdeniz GVM', 'Doğu Anadolu GVM', 'Doğu Karadeniz GVM', 'Ege GVM',
    'Güney Anadolu GVM', 'Güney Batı Anadolu GVM', 'Güney Doğu GVM', 'Güney Ege GVM', 'Güney Marmara GVM', 'İç Anadolu GVM', 'Kuzey Marmara GVM', 'Orta Akdeniz GVM',
    'Orta Anadolu GVM', 'Orta Karadeniz GVM'];
  ES.BOLGE = ES.GVM.filter(function (g) { return g !== 'Orta Anadolu GVM'; });   // devir bölgeleri (bizim bölge hariç)
  ES.CINSIYET = ['Erkek', 'Kadın'];
  ES.DEVIR = ['Devir Yok', 'Devreden GVM', 'Devir Yapılan GVM'];
  ES.ALIM = ['Ekip', 'Sabit'];
  ES.YAS = ['Erişkin', 'Pediatrik'];
  ES.TUR = ['TC Vatandaşı', 'Yurt Dışı', 'Sağlık Turizmi'];
  ES.NUMUNE = ['Alındı', 'Alınmadı', 'Beklemede', 'Devir'];
  ES.DURUM = ['Bağışçı Kaynaklı İnaktivasyon', 'Bağışçı Kaynaklı İptal', 'Bağışçı Vazgeçti', 'Daha Önce CT Çalışıldı', 'Dış Merkez CT', 'Nakil', 'Reaktif', 'Rezerve', 'Serbest',
    'Sistem İnaktivasyonu', 'Nakil Merkezi Red', 'Hasta Ex'];
  ES.NEDEN_VAZGECME = ['Aile Baskısı', 'Dini - Etnik Nedenler', 'Hastayı Tanıma İsteği', 'Kamuoyu Olumsuz Etkileri', 'Kişisel Vazgeçme Nedenleri', 'Maddi Beklenti',
    'Nakil Yönteminin Kabul Edilmemesi', 'Sisteme İlişkin Güvensizlik', 'Süreç Memnuniyetsizliği'];
  ES.NEDEN_INAKTIVASYON = ['Tıbbi Red', 'Tutuklu ve Hükümlüler', 'Ulaşılamadı', 'Vefat', 'Yaş Sınırının Dolması', 'Yurt Dışı Öğrenim, İş, İkamet'];
  ES.ORAN = ['10\\10', '9\\10', '8\\8', '7\\8'];
  ES.ALANLAR = [ // [alan, başlık (Excel sütunu)]
    ['unit', 'Bağışçı Unit No'], ['ad', 'Bağışçının Adı-Soyadı'], ['cins', 'Cinsiyet'], ['gvm', 'Bağışta Bulunulan GVM'], ['kbm', 'OABKM Bağlıları'], ['devir', 'Devir Durumu'],
    ['devreden', 'Devreden KHBM'], ['devirYapilan', 'Devir Yapılan KHBM'], ['alim', 'Kök Hücre Alım Yeri'], ['oran', 'Eşleşme Oranı'], ['yas', 'Hasta Yaş'], ['tur', 'Hasta Türü'],
    ['talep', 'Talep Tarihi'], ['devirT', 'Devir Tarihi'], ['numune', 'Konfirmasyon Numunesi Alındı / Alınmadı Tarihi'], ['nDurum', 'Konfirmasyon Numunesi Durum'], ['durum', 'Durum'],
    ['neden', 'Vazgeçme / İnaktivasyon Nedenleri'], ['pers', 'İlgilenen Personel'], ['not', 'Notlar']];
  ES.TARIH = { talep: 1, devirT: 1, numune: 1 };

  // Excel karşılaştırması büyük/küçük harf duyarsızdır: ÇOKEĞERSAY ve "=" büyük harfe çevirerek karşılaştırır
  // ("KADIN" = "Kadın", ama "SİStem" ≠ "Sistem"); KAÇINCI (Veri Kontrolü) küçük harfe çevirerek ("KADIN" ≠ "Kadın").
  // Excel'in hesapladığı değerlerle birebir doğrulandı.
  var up = function (s) { return S(s).toUpperCase(); };
  var low = function (s) { return S(s).toLowerCase(); };
  var eqx = function (a, b) { return up(a) === up(b); };
  ES.eqx = eqx;
  var isNum = function (v) { return typeof v === 'number' && !isNaN(v); };
  ES.bos = function (v) { return S(v).trim() === '' || eqx(S(v).trim(), 'Seçiniz'); };

  /* ---------------- veri ---------------- */
  ES.yeni = function () {
    var r = { id: DT.uid() };
    ES.ALANLAR.forEach(function (a) { r[a[0]] = ES.TARIH[a[0]] ? null : ''; });
    return r;
  };
  ES.yillar = function (data, today) {
    var bas = +data.bas || 2015, son = DT.year(today), out = [];
    for (var y = bas; y <= son && out.length < 40; y++) out.push(y);
    return out;
  };

  /* ---------------- Excel'den içe aktarma (ANA TABLO) ---------------- */
  ES.importWorkbook = function (buf) {
    var X = root.XLSXIO, wb0;
    return X.openWorkbook(buf).then(function (wb) {
      wb0 = wb;
      if (wb.sheetNames.indexOf('ANA TABLO') < 0) throw new Error("Bu dosyada 'ANA TABLO' sayfası yok.");
      return Promise.all([wb.sheet('ANA TABLO', { maxCol: 21 }), wb.sheetNames.indexOf('ANA SAYFA') >= 0 ? wb.sheet('ANA SAYFA', { minRow: 18, maxRow: 18, minCol: 8, maxCol: 8 }) : null]);
    }).then(function (r) {
      var sh = r[0], as = r[1] || {};
      // başlık satırı: "Bağışçı Unit No" yazan satır
      var hr = 6;
      for (var k = 1; k <= 12; k++) if (sh[k] && sh[k][2] && /unit/i.test(X.cellText(sh[k][2]))) { hr = k; break; }
      var col = {};
      Object.keys(sh[hr] || {}).forEach(function (c) {
        var t = DT.fold(X.cellText(sh[hr][c])).replace(/\s+/g, ' ').trim();
        ES.ALANLAR.forEach(function (a) { if (col[a[0]] == null && DT.fold(a[1]) === t) col[a[0]] = +c; });
      });
      ES.ALANLAR.forEach(function (a, i) { if (col[a[0]] == null) col[a[0]] = i + 2; });   // B..U
      var out = [], metin = 0;
      Object.keys(sh).map(Number).filter(function (n) { return n > hr; }).sort(function (a, b) { return a - b; }).forEach(function (rn) {
        var row = sh[rn], rec = { id: DT.uid(), no: rn - hr, satir: rn }, dolu = false;
        ES.ALANLAR.forEach(function (a) {
          var cell = row[col[a[0]]];
          if (ES.TARIH[a[0]]) {
            var v = cell ? cell.v : null;
            if (typeof v === 'number') { rec[a[0]] = Math.floor(v); dolu = true; }
            else if (S(v).trim()) { rec[a[0]] = null; rec[a[0] + 'Tx'] = S(v).trim(); metin++; dolu = true; }
            else rec[a[0]] = null;
          } else {
            var t = cell ? X.cellText(cell) : '';
            if (cell && typeof cell.v === 'number' && a[0] === 'oran') t = String(cell.v);
            rec[a[0]] = t;
            if (t.trim() && !eqx(t.trim(), 'Seçiniz')) dolu = true;
          }
        });
        if (!dolu || (!S(rec.unit).trim() && !S(rec.ad).trim() && rec.talep == null && !rec.talepTx && rec.numune == null && !S(rec.not).trim())) return;
        if (eqx(S(rec.pers).trim(), 'Seçiniz')) rec.pers = '';
        out.push(rec);
      });
      var bas = as[18] && as[18][8] && typeof as[18][8].v === 'number' ? as[18][8].v : 2015;
      return { kayitlar: out, bas: bas, rapor: { kayit: out.length, metin: metin } };
    });
  };

  /* ---------------- istatistikler (tek geçişte; Excel formülleriyle aynı sonuç) ---------------- */
  ES.stats = function (data, today) {
    var K = data.kayitlar || [], Y = ES.yillar(data, today), son = DT.year(today), y0 = Y.length ? Y[0] : son, nY = Y.length;
    var idx = function (list) { var m = {}; list.forEach(function (v, i) { m[up(v)] = i; }); return m; };
    var KB = idx(ES.KBM), BO = idx(ES.BOLGE), TU = idx(ES.TUR), CI = idx(ES.CINSIYET);
    var U_GIDEN = up('Devir Yapılan GVM'), U_GELEN = up('Devreden GVM'), U_BEK = up('Beklemede'), U_ALINDI = up('Alındı'), U_VAZ = up('Bağışçı Vazgeçti'), U_INA = up('Sistem İnaktivasyonu');
    var mat = function (n) { var o = []; for (var i = 0; i < n; i++) { var r = []; for (var j = 0; j < nY; j++) r.push(0); o.push(r); } return o; };
    var yil = mat(ES.KBM.length), gel = mat(ES.BOLGE.length), git = mat(ES.BOLGE.length), tur = mat(ES.TUR.length), bek = mat(12), vaz = mat(ES.KBM.length), ina = mat(ES.KBM.length);
    var gelTop = mat(1)[0], gitTop = mat(1)[0], cins = [0, 0];
    var nsS = mat(ES.KBM.length), nsN = mat(ES.KBM.length), nsKS = ES.KBM.map(function () { return 0; }), nsKN = ES.KBM.map(function () { return 0; });
    var nsYS = mat(1)[0], nsYN = mat(1)[0], nsT = 0, nsC = 0, ned = {};
    K.forEach(function (r) {
      var t = isNum(r.talep) ? r.talep : null;
      if (t == null) return;
      var p = DT.parts(t), yi = p.y >= y0 && p.y <= son ? p.y - y0 : -1;
      if (yi < 0) return;
      var dv = up(r.devir), giden = dv === U_GIDEN, ki = KB[up(r.kbm)], du = up(r.durum);
      if (dv === U_GELEN) { gelTop[yi]++; var b1 = BO[up(r.devreden)]; if (b1 != null) gel[b1][yi]++; }
      if (giden) { gitTop[yi]++; var b2 = BO[up(r.devirYapilan)]; if (b2 != null) git[b2][yi]++; return; }
      if (ki != null) {
        yil[ki][yi]++;
        if (du === U_VAZ) vaz[ki][yi]++;
        if (du === U_INA) ina[ki][yi]++;
      }
      var ti = TU[up(r.tur)]; if (ti != null) tur[ti][yi]++;
      var ci = CI[up(r.cins)]; if (ci != null) cins[ci]++;
      var nd = up(r.nDurum);
      if (nd === U_BEK) bek[p.m - 1][yi]++;
      if (nd === U_ALINDI && isNum(r.numune) && r.numune >= t) {
        var d = r.numune - t;
        nsYS[yi] += d; nsYN[yi]++; nsT += d; nsC++;
        if (ki != null) { nsS[ki][yi] += d; nsN[ki][yi]++; nsKS[ki] += d; nsKN[ki]++; }
      }
      if (!ES.bos(r.neden)) { var k2 = S(r.neden).trim(); ned[k2] = (ned[k2] || 0) + 1; }
    });
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    var rows = function (names, m) { return names.map(function (ad, i) { return { ad: ad, v: m[i], top: sum(m[i]) }; }); };
    var topla = function (rs, ad) { var v = Y.map(function (y, j) { return rs.reduce(function (a, r) { return a + r.v[j]; }, 0); }); return { ad: ad, v: v, top: sum(v) }; };
    var fark = function (tot, rs) { var v = tot.map(function (x, j) { return x - rs.reduce(function (a, r) { return a + r.v[j]; }, 0); }); return { ad: 'Bölge seçilmemiş', v: v, top: sum(v) }; };
    var R = { Y: Y, son: son };
    R.yillik = rows(ES.KBM, yil); R.yillikTop = topla(R.yillik, 'OABKM (BKM toplamı)');
    R.gelen = rows(ES.BOLGE, gel); R.gelenSecilmemis = fark(gelTop, R.gelen); R.gelenTop = { ad: 'TOPLAM', v: gelTop, top: sum(gelTop) };
    R.giden = rows(ES.BOLGE, git); R.gidenSecilmemis = fark(gitTop, R.giden); R.gidenTop = { ad: 'TOPLAM', v: gitTop, top: sum(gitTop) };
    R.tur = rows(ES.TUR, tur); R.turTop = topla(R.tur, 'TOPLAM');
    var ct = cins[0] + cins[1];
    R.cinsiyet = ES.CINSIYET.map(function (c, i) { return { ad: c, n: cins[i], oran: ct ? cins[i] / ct : null }; });
    R.cinsiyetTop = ct;
    R.bekleyen = rows(DT.AYLAR, bek); R.bekleyenTop = topla(R.bekleyen, 'TOPLAM BEKLEYEN');
    var ort = function (s2, n) { return n ? s2 / n : null; };
    R.numune = ES.KBM.map(function (ad, i) { return { ad: ad, v: Y.map(function (y, j) { return ort(nsS[i][j], nsN[i][j]); }), top: ort(nsKS[i], nsKN[i]), n: nsN[i] }; });
    R.numuneTop = { ad: 'OABKM (BKM geneli)', v: Y.map(function (y, j) { return ort(nsYS[j], nsYN[j]); }), top: ort(nsT, nsC), n: nsYN };
    R.vazgecme = rows(ES.KBM, vaz); R.vazgecmeTop = topla(R.vazgecme, 'OABKM (BKM toplamı)');
    R.inaktivasyon = rows(ES.KBM, ina); R.inaktivasyonTop = topla(R.inaktivasyon, 'OABKM (BKM toplamı)');
    R.nedenler = Object.keys(ned).map(function (k2) { return { ad: k2, n: ned[k2] }; }).sort(function (a, b) { return b.n - a.n; });
    return R;
  };
  // Personel: yıllık görüşme, seçilen yıl sonuçları ve aylık
  ES.personel = function (data, today, personel, yil) {
    var K = data.kayitlar || [], Y = ES.yillar(data, today), ys = function (y) { return DT.serial(y, 1, 1); };
    var inY = function (t, y) { return isNum(t) && t >= ys(y) && t < ys(y + 1); };
    var say = function (fn) { var n = 0; for (var i = 0; i < K.length; i++) if (fn(K[i])) n++; return n; };
    var P = personel.filter(function (p) { return S(p).trim(); });
    var R = { Y: Y, yil: yil };
    R.yillik = P.map(function (p) { var v = Y.map(function (y) { return say(function (r) { return eqx(r.pers, p) && inY(r.talep, y); }); }); return { ad: p, v: v, top: v.reduce(function (a, b) { return a + b; }, 0) }; });
    var tot = Y.map(function (y) { return say(function (r) { return inY(r.talep, y); }); });
    R.toplam = { ad: 'TOPLAM EŞLEŞME KAYDI', v: tot, top: tot.reduce(function (a, b) { return a + b; }, 0) };
    R.girilmemis = { ad: 'Personel girilmemiş', v: tot.map(function (t, i) { return t - R.yillik.reduce(function (a, r) { return a + r.v[i]; }, 0); }) };
    R.girilmemis.top = R.girilmemis.v.reduce(function (a, b) { return a + b; }, 0);
    var sonuc = function (fn) {
      var b = K.filter(function (r) { return fn(r) && inY(r.talep, yil); });
      var o = { gorusme: b.length, alindi: b.filter(function (r) { return eqx(r.nDurum, 'Alındı'); }).length, alinmadi: b.filter(function (r) { return eqx(r.nDurum, 'Alınmadı'); }).length,
        vazgecti: b.filter(function (r) { return eqx(r.durum, 'Bağışçı Vazgeçti'); }).length, inaktivasyon: b.filter(function (r) { return eqx(r.durum, 'Sistem İnaktivasyonu'); }).length };
      o.oran = o.gorusme ? o.vazgecti / o.gorusme : null;
      var s = b.filter(function (r) { return eqx(r.nDurum, 'Alındı') && isNum(r.numune) && isNum(r.talep) && r.numune >= r.talep; });
      o.sure = s.length ? s.reduce(function (a, r) { return a + r.numune - r.talep; }, 0) / s.length : null;
      return o;
    };
    R.sonuc = P.map(function (p) { var o = sonuc(function (r) { return eqx(r.pers, p); }); o.ad = p; return o; });
    R.sonucTop = sonuc(function (r) { return P.some(function (p) { return eqx(r.pers, p); }); });
    R.aylik = P.map(function (p) {
      var v = DT.AYLAR.map(function (a, mi) { return say(function (r) { return eqx(r.pers, p) && isNum(r.talep) && r.talep >= DT.serial(yil, mi + 1, 1) && r.talep < DT.serial(yil, mi + 2, 1); }); });
      return { ad: p, v: v, top: v.reduce(function (a, b) { return a + b; }, 0) };
    });
    R.aylikHepsi = DT.AYLAR.map(function (a, mi) { return say(function (r) { return S(r.pers).trim() !== '' && isNum(r.talep) && r.talep >= DT.serial(yil, mi + 1, 1) && r.talep < DT.serial(yil, mi + 2, 1); }); });
    return R;
  };
  // Bekleyen listesi: numune bekleyen · sonucu girilmemiş (devrettiklerimiz hariç)
  ES.bekleyenListe = function (data, tur) {
    return (data.kayitlar || []).filter(function (r) {
      if (eqx(r.devir, 'Devir Yapılan GVM')) return false;
      if (tur === 'sonuc') return isNum(r.talep) && eqx(r.nDurum, 'Alındı') && (eqx(r.durum, 'Seçiniz') || S(r.durum) === '');
      return eqx(r.nDurum, 'Beklemede');
    });
  };
  // Veri kontrolü: istatistiklere girmeyen ya da düzeltilmesi gereken kayıtlar
  ES.KONTROLLER = [
    ['kbm', 'Talep tarihi olan ama KBM (OABKM Bağlıları) seçilmemiş / listede olmayan eşleşme', 'OABKM Bağlıları’ndan KBM seçin'],
    ['cins', 'Cinsiyeti boş ya da “Erkek” / “Kadın” dışında yazılmış eşleşme', 'Cinsiyeti listeden seçin'],
    ['tur', 'Hasta Türü seçilmemiş eşleşme', 'Hasta Türü’nü listeden seçin'],
    ['metin', 'Talep ya da numune tarihi tarih değil, metin olarak yazılmış kayıt', 'Tarihi yeniden girin'],
    ['once', 'Numune tarihi talep tarihinden önce girilmiş kayıt (süre hesabına girmez)', 'Tarihlerin yılını / gününü kontrol edin'],
    ['ileri', 'Talep ya da numune tarihi bugünden ileri girilmiş kayıt', 'Büyük olasılıkla yıl yanlış yazılmış']
  ];
  ES.kontrol = function (data, today) {
    var K = data.kayitlar || [], Y = ES.yillar(data, today), bas = DT.serial(Y[0] || DT.year(today), 1, 1), son = DT.serial(DT.year(today) + 1, 1, 1);
    var aralik = function (r) { return isNum(r.talep) && r.talep >= bas && r.talep < son && !eqx(r.devir, 'Devir Yapılan GVM'); };
    var inList = function (v, list) { return list.some(function (x) { return low(v) === low(x); }); };
    var fn = {
      kbm: function (r) { return aralik(r) && !inList(r.kbm, ES.KBM); },
      cins: function (r) { return aralik(r) && !inList(r.cins, ES.CINSIYET); },
      tur: function (r) { return aralik(r) && !inList(r.tur, ES.TUR); },
      metin: function (r) { return !!(r.talepTx || r.numuneTx); },
      once: function (r) { return isNum(r.numune) && isNum(r.talep) && r.numune < r.talep; },
      ileri: function (r) { return (isNum(r.talep) && r.talep > today) || (isNum(r.numune) && r.numune > today); }
    };
    return ES.KONTROLLER.map(function (k) { var list = K.filter(fn[k[0]]); return { k: k[0], ad: k[1], ne: k[2], n: list.length, list: list }; });
  };

  /* ---------------- Excel'e aktarma ---------------- */
  ES.exportXlsx = function (data, today, personel) {
    var X = root.XLSXIO, R = ES.stats(data, today), P = ES.personel(data, today, personel, DT.year(today));
    var hd = function (a) { return a.map(function (v) { return { v: v, s: 2 }; }); }, dt = function (v) { return v == null ? '' : { v: v, s: 1 }; };
    var ana = [hd(['Sıra'].concat(ES.ALANLAR.map(function (a) { return a[1]; })))];
    (data.kayitlar || []).forEach(function (r, i) {
      ana.push([i + 1].concat(ES.ALANLAR.map(function (a) { return ES.TARIH[a[0]] ? (r[a[0]] != null ? dt(r[a[0]]) : S(r[a[0] + 'Tx'])) : S(r[a[0]]); })));
    });
    var yt = function (baslik, rows, tot, fmt) {
      var out = [[{ v: baslik, s: 3 }], [], hd([''].concat(R.Y.map(String), ['TOPLAM']))];
      rows.concat(tot ? [tot] : []).forEach(function (r) { out.push([r.ad].concat(r.v.map(function (v) { return v == null ? '–' : fmt ? Math.round(v * 10) / 10 : v; }), [r.top == null ? '–' : fmt ? Math.round(r.top * 10) / 10 : r.top])); });
      out.push([]);
      return out;
    };
    var ist = [].concat(
      yt('Yıllık eşleşme sayıları (devirle gelenler dahil, devrettiklerimiz hariç)', R.yillik, R.yillikTop),
      yt('Bölgelerden bize gelen eşleşme devirleri', R.gelen.concat([R.gelenSecilmemis]), R.gelenTop),
      yt('Bizim diğer bölgelere devrettiğimiz eşleşmeler', R.giden.concat([R.gidenSecilmemis]), R.gidenTop),
      yt('Yurt içi / yurt dışı eşleşme sayıları (Hasta Türü)', R.tur, R.turTop),
      yt('Bekleyen eşleşmeler (numune bekleniyor)', R.bekleyen, R.bekleyenTop),
      yt('Ortalama numune alım süresi (gün)', R.numune, R.numuneTop, true),
      yt('Bağışçı vazgeçme sayıları', R.vazgecme, R.vazgecmeTop),
      yt('Sistem inaktivasyon sayıları', R.inaktivasyon, R.inaktivasyonTop),
      yt('Personel bazlı yıllık görüşme sayısı', P.yillik.concat([P.girilmemis]), P.toplam));
    var w = [40].concat(R.Y.map(function () { return 8; }), [10]);
    return X.buildXlsxZ([
      { name: 'ANA TABLO', rows: ana, freezeRow: 1, filterRow: 1, cols: [6, 16, 24, 9, 22, 16, 18, 20, 20, 12, 10, 10, 14, 12, 12, 14, 14, 26, 30, 16, 40] },
      { name: 'İstatistikler', rows: ist, cols: w }
    ]);
  };

  root.ES = ES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ES;
})(typeof window !== 'undefined' ? window : globalThis);
