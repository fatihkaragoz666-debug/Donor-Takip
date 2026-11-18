/* Donör Takip – arayüz */
(function () {
  'use strict';
  var KEY = 'donorTakip.v1', PREV = 'donorTakip.onceki';
  var qs = new URLSearchParams(location.search);
  if (qs.get('today')) { var tq = DT.fromIso(qs.get('today')); if (tq) window.__TODAY = tq; }
  var NB = window.AndroidBridge || null;
  var S = DT.S, fold = DT.fold, eqi = DT.eqi;

  var state, D = [], pool = [], today, byId = {}, holMap = {};
  var ui = {
    search: '', dfilter: 'all', dsort: 'new', dlimit: 60,
    calY: null, calM: null, calSel: null, calP: '',
    progDate: null, alBase: null, alP: '', tkP: '', utYil: '', dashYil: null, dashAy: '', ekPast: false,
    weekStart: null, hwP: '', ajDate: null, rpF: 'all', rpH: '', rpY: '', rpLimit: 80,
    rpTur: 'donor', rpHz: 'buay', rpBas: null, rpBit: null, rpDurum: 'all', rpHast: '', rpYon: '', rpOlcut: 'her', rpAyr: { donor: true, harcama: true, isyuku: false, yemek: true },
    scroll: {}
  };

  /* ---------------- yardımcılar ---------------- */
  function h(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  var view = $('#view');
  function pct(v) { return v == null ? '–' : (Math.round(v * 1000) / 10).toLocaleString('tr-TR') + '%'; }
  function num(v) { return v == null ? '–' : (typeof v === 'number' ? v.toLocaleString('tr-TR') : v); }
  function upperTR(s) { return S(s).toLocaleUpperCase('tr-TR'); }
  function telHref(t) { var d = S(t).replace(/[^\d+]/g, ''); return d ? 'tel:' + d : ''; }
  function gunAd(s) { return DT.gun(s); }
  function dateLong(s) { return DT.fmt(s) + ' · ' + gunAd(s); }
  function isOffDay(s) { return DT.weekday(s) >= 6 || !!holMap[s]; }

  var I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.6 3.3-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/></svg>',
    track: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/></svg>',
    tl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5v16c4.4 0 8-3.1 8-7.5"/><path d="m5 11 9-3.5M5 15l9-3.5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><rect x="5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="16" y="13" width="3" height="5" rx="1"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.8 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3 6.5 9 6.5 9-6.5"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/><path d="M8.5 17v-3M12 17v-5M15.5 17v-2"/></svg>',
    open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
  };

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  function busy(on, msg) {
    var b = $('#busy');
    if (on) { if (!b) { b = document.createElement('div'); b.id = 'busy'; b.className = 'busy'; document.body.appendChild(b); } b.innerHTML = '<div><div class="spin"></div>' + h(msg || 'Lütfen bekleyin…') + '</div>'; }
    else if (b) b.remove();
  }
  var sheetOnClose = null;
  function openSheet(html, onClose) {
    var s = $('#sheet');
    s.innerHTML = '<div class="scrim" data-act="closeSheet"></div><div class="panel"><div class="grab"></div>' + html + '</div>';
    s.hidden = false; sheetOnClose = onClose || null;
  }
  function closeSheet() { var s = $('#sheet'); if (s.hidden) return false; s.hidden = true; s.innerHTML = ''; var f = sheetOnClose; sheetOnClose = null; if (f) f(); return true; }
  function confirmSheet(title, text, okLabel, danger, onOk) {
    openSheet('<h3>' + h(title) + '</h3><div class="sub">' + h(text) + '</div><div class="btns"><button class="btn" data-act="closeSheet">Vazgeç</button>' +
      '<button class="btn ' + (danger ? 'danger' : 'pri') + '" id="cfOk">' + h(okLabel) + '</button></div>');
    $('#cfOk').onclick = function () { closeSheet(); onOk(); };
  }

  /* ---------------- veri ---------------- */
  function load() {
    try { var s = localStorage.getItem(KEY); state = s ? migrate(JSON.parse(s)) : DT.newState(window.DT_DEFAULT_LISTS); }
    catch (e) { console.error(e); state = DT.newState(window.DT_DEFAULT_LISTS); }
  }
  function migrate(s) {
    var base = DT.newState(window.DT_DEFAULT_LISTS);
    s.donors = s.donors || []; s.overrides = s.overrides || {}; s.ekGorevler = s.ekGorevler || []; s.ekKons = s.ekKons || []; s.ajanda = s.ajanda || [];
    s.planNotlar = s.planNotlar || []; s.gorevKayit = s.gorevKayit || []; s.tasimaKayit = s.tasimaKayit || []; s.kapanis = s.kapanis || { kesim: null };
    s.harcama = s.harcama || []; s.ilEslesme = s.ilEslesme || {}; s.yemekKart = s.yemekKart || [];
    s.settings = Object.assign({}, base.settings, s.settings || {});
    s.lists = Object.assign({}, base.lists, s.lists || {});
    s.lists.prog = Object.assign({}, base.lists.prog, s.lists.prog || {});
    s.donors.forEach(function (d) { if (!d.id) d.id = DT.uid(); });
    return s;
  }
  var saveTimer;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Kayıt yapılamadı: depolama dolu olabilir.'); }
  }
  var hrows = [], yrows = [];
  function recompute() {
    today = DT.today();
    D = DT.derive(state, today);
    pool = DT.buildPool(state, D);
    byId = {}; D.forEach(function (x) { byId[x.d.id] = x; });
    holMap = DT.holidayMap(state.lists);
    hrows = HR.derive(state, D);
    yrows = YK.derive(state, D);
    esCache = {};
  }
  function commit(keepScroll) { save(); recompute(); render(keepScroll !== false); }

  /* ---------------- yönlendirme ---------------- */
  function route() { return (location.hash || '#/').slice(1).split('?')[0].split('/').filter(Boolean); }
  function go(hash, replace) {
    if (replace) location.replace('#' + hash); else location.hash = hash;
  }
  var NAVY = '#1F3A5F';
  var GROUPS = {
    planlama: { ad: 'PLANLAMA', renk: '#2F6FB0', acik: '#E3EDF8', alt: 'Günlük ve haftalık iş planı', pages: [
      ['/plan/takvim', 'Takvim', 'Aylık görünüm: her günün görevleri'], ['/plan/program', 'Çalışma Programı', 'Yarının programı, WhatsApp metni'],
      ['/plan/haftalik', 'Haftalık Program', 'Haftanın görevleri: gün gün liste'], ['/plan/hplan', 'Haftalık Plan', 'Hafta defteri: görevler, personel, notlar'],
      ['/plan/ajanda', 'Ajanda', 'Saatli notlar, programa eklenecek işler'], ['/plan/uyarilar', 'Görev Listesi', 'Geri sayım uyarıları']] },
    takip: { ad: 'TAKİP', renk: '#1E6B3A', acik: '#E2F1E7', alt: 'Donörlerin süreç takibi', pages: [
      ['/takip/saglik', 'Sağlık Kontrolü Takip', 'Sağlık kontrolü yaklaşan donörler'], ['/takip/asi', 'Aşı Takip', 'Aşıdaki ve aşıya başlayacak donörler'],
      ['/takip/toplama', 'Toplama Takip', 'Toplaması yaklaşan donörler'], ['/takip/tasima', 'Ürün Taşıma', 'Taşınacak ürünler ve taşıyan personel'],
      ['/takip/ekkons', 'Ek Konsültasyon', 'Ek konsültasyona gidecek donörler'], ['/takip/sonizlem', 'Son İzlem Takip', 'Son izlem tarihi yaklaşan donörler'],
      ['/takip/idm', 'IDM', 'IDM tarih aralığı işaretlenen donörler']] },
    arsiv: { ad: 'DONÖR KAYIT VE ARŞİV', renk: '#8A6D0B', acik: '#F5EEDA', alt: 'Donör kayıtları, raporlar ve arşiv', pages: [
      ['/donorler', 'Donör Kayıt', 'Donör bilgileri: ana tablo'], ['/arsiv/rapor', 'Donör Raporu', 'Yöneticiye gönderilecek temiz kopya'],
      ['/arsiv/kapanis', 'Haftalık Kapanış', 'Haftayı kapatıp görevleri arşive aktarma'], ['/arsiv/gorev', 'Görev Kayıtları', 'Personel görev arşivi'],
      ['/arsiv/tasima', 'Taşıma Kayıtları', 'Ürün taşıma arşivi'], ['/arsiv/kilavuz', 'Kılavuz', 'Sayfaların kullanım açıklamaları'],
      ['/ayarlar/listeler', 'Listeler', 'Personel, hastane ve açılır listeler']] },
    dashboard: { ad: 'DASHBOARD', renk: '#5B3A8C', acik: '#ECE5F5', alt: 'İstatistikler ve grafikler', pages: [
      ['/dashboard', 'Dashboard', 'Donör ve görev istatistikleri, grafikler'], ['/dash/isyuku', 'İş Yükü', 'Personel iş yükü'],
      ['/dash/tasima', 'Taşıma İstatistiği', 'Ürün taşıma istatistikleri'], ['/dash/raporlar', 'Raporlar', 'Tarih aralığına göre PDF ve Excel rapor']] },
    eslesme: { ad: 'EŞLEŞME', renk: '#0E7C86', acik: '#DDF1F2', alt: 'Kök hücre eşleşme takibi', pages: [] },
    harcama: { ad: 'MALİ İŞLER', renk: '#A3262A', acik: '#F8E4E3', alt: 'Donör harcaması, yemek kartı ve harcama dashboard', pages: [
      ['/harcama', 'Harcama Dashboard', 'Yıllara, kategoriye, ulaşıma ve ile göre harcama'], ['/harcama/kayitlar', 'Harcama Kayıtları', 'Harcama satırları: ekle, düzenle, Excel’den al'],
      ['/harcama/donorler', 'Donör Harcama', 'Donör başına harcama özeti'], ['/harcama/yemek', 'Yemek Kartı', 'Yükleme detayı: sağlık kontrolü, aşı + toplama, toplama süreci']] }
  };
  // EŞLEŞME sayfaları (Excel'deki ANA SAYFA: KAYIT VE TAKİP · DASHBOARD)
  var ES_SAYFA = {
    kayit: [['/es/kayitlar', 'Eşleşme Kayıtları', 'ANA TABLO: bütün eşleşmeler; ekle, düzenle, ara'], ['/es/bekleyen', 'Bekleyen Listesi', 'Numune bekleyen ve sonucu girilmemiş eşleşmeler'],
      ['/es/kontrol', 'Veri Kontrolü', 'İstatistiğe girmeyen, düzeltilecek kayıtlar']],
    dash: [['/es/dashboard', 'Dashboard', 'Eşleşme göstergeleri ve grafikler'], ['/es/yillik', 'Yıllık Eşleşme', 'KBM / BKM bazlı yıllık eşleşme'], ['/es/bolge', 'Bölge Devirleri', 'Gelen ve devrettiğimiz eşleşmeler'],
      ['/es/tur', 'Hasta Türü ve Cinsiyet', 'Yurt içi / yurt dışı, cinsiyet'], ['/es/bekleyenler', 'Bekleyen Eşleşmeler', 'Aylık bekleyen eşleşme sayıları'], ['/es/numune', 'Numune Alım Süresi', 'Talepten numuneye ortalama gün'],
      ['/es/vazgecme', 'Vazgeçme ve İnaktivasyon', 'Vazgeçme, sistem inaktivasyonu, nedenler'], ['/es/personel', 'Personel İstatistiği', 'Personel bazlı görüşme']]
  };
  GROUPS.eslesme.pages = ES_SAYFA.kayit.concat(ES_SAYFA.dash);
  // Ana Sayfa'daki dört bölüm; PLANLAMA, TAKİP ve DONÖR KAYIT VE ARŞİV, MİHMANDARLIK'ın içindedir
  var MIH = { ad: 'MİHMANDARLIK', renk: '#1F3A5F', acik: '#E4E9F0', alt: 'Planlama, takip, donör kayıt ve arşiv', gruplar: ['planlama', 'takip', 'arsiv'] };
  function topOf(gk) { return gk && MIH.gruplar.indexOf(gk) >= 0 ? 'mihmandarlik' : gk; }
  function groupOf(path) {
    if (path === '/' || path === '') return null;
    var k = path.split('/')[1];
    if (k === 'mihmandarlik') return 'mihmandarlik';
    if (k === 'g') return path.split('/')[2];
    if (k === 'plan') return 'planlama';
    if (k === 'takip') return 'takip';
    if (k === 'donorler' || k === 'donor' || k === 'arsiv' || path === '/ayarlar/listeler') return 'arsiv';
    if (k === 'dashboard' || k === 'dash') return 'dashboard';
    if (k === 'harcama') return 'harcama';
    if (k === 'es') return 'eslesme';
    return null;
  }
  var TABS = [['home', '/', 'Ana Sayfa', I.home], ['mihmandarlik', '/mihmandarlik', 'Mihmandarlık', I.users], ['eslesme', '/g/eslesme', 'Eşleşme', I.link],
    ['harcama', '/g/harcama', 'Mali İşler', I.tl], ['dashboard', '/g/dashboard', 'Dashboard', I.chart]];
  function groupSeg(key, cur) {
    return '<div class="seg">' + GROUPS[key].pages.filter(function (pg) { return !pg[3]; }).map(function (pg) {
      return '<button class="' + (pg[0] === cur ? 'on' : '') + '" data-act="goto" data-h="' + pg[0] + '" data-replace="1">' + h(pg[1]) + '</button>';
    }).join('') + '</div>';
  }

  function render(keepScroll) {
    var p = route(), out;
    var top = keepScroll ? view.scrollTop : null;
    try {
      if (p.length === 0) out = scrHome();
      else if (p[0] === 'mihmandarlik') out = scrMihmandarlik();
      else if (p[0] === 'g' && p[1] === 'eslesme') out = scrEsHome();
      else if (p[0] === 'es') out = scrEs(p[1], p[2]);
      else if (p[0] === 'g' && GROUPS[p[1]]) out = scrGroup(p[1]);
      else if (p[0] === 'arsiv' && p[1] === 'rapor') out = scrRapor();
      else if (p[0] === 'arsiv' && p[1] === 'kilavuz') out = scrKilavuz();
      else if (p[0] === 'arsiv' && p[1] === 'kapanis') out = scrKapanis();
      else if (p[0] === 'arsiv' && p[1] === 'gorev') out = scrGorev();
      else if (p[0] === 'arsiv' && p[1] === 'tasima') out = scrTasimaKayit();
      else if (p[0] === 'dash' && p[1] === 'isyuku') out = scrIsYuku();
      else if (p[0] === 'dash' && p[1] === 'tasima') out = scrTasimaIst();
      else if (p[0] === 'dash' && p[1] === 'raporlar') out = scrRaporlar();
      else if (p[0] === 'harcama' && p[1] === 'kayitlar') out = scrHrKayit();
      else if (p[0] === 'harcama' && p[1] === 'donorler') out = scrHrDonor();
      else if (p[0] === 'harcama' && p[1] === 'yemek') out = scrYemek();
      else if (p[0] === 'harcama') out = scrHarcama();
      else if (p[0] === 'donorler') out = scrDonors();
      else if (p[0] === 'donor' && p[1] === 'yeni') out = scrDonorForm(null);
      else if (p[0] === 'donor' && p[2] === 'duzenle') out = scrDonorForm(p[1]);
      else if (p[0] === 'donor') out = scrDonor(p[1]);
      else if (p[0] === 'plan') out = scrPlan(p[1] || 'takvim');
      else if (p[0] === 'takip') out = scrTakip(p[1] || 'saglik');
      else if (p[0] === 'dashboard') out = scrDash();
      else if (p[0] === 'ayarlar' && p[1] === 'listeler') out = scrLists();
      else if (p[0] === 'ayarlar') out = scrSettings();
      else out = scrHome();
    } catch (e) {
      console.error(e);
      out = { title: 'Hata', html: '<div class="page"><div class="card pad"><b>Bir hata oluştu.</b><div class="small muted">' + h(e.message) + '</div></div></div>' };
    }
    var gk = groupOf('/' + p.join('/')), G = gk === 'mihmandarlik' ? MIH : gk ? GROUPS[gk] : null;
    document.documentElement.style.setProperty('--g', G ? G.renk : NAVY);
    document.documentElement.style.setProperty('--g-soft', G ? G.acik : '#E4E9F0');
    $('#title').textContent = out.title;
    // geri düğmesi: Ana Sayfa ve alt sekmelerdeki bölüm sayfaları dışında
    var kok = p.length === 0 || p[0] === 'mihmandarlik' || (p[0] === 'g' && MIH.gruplar.indexOf(p[1]) < 0);
    $('#btnBack').hidden = !(out.back || !kok);
    $('#topActions').innerHTML = out.actions || '';
    view.innerHTML = out.html;
    // sayfa düğmeleri satırında seçili düğme görünür olsun
    view.querySelectorAll('.seg').forEach(function (sg) { var b = sg.querySelector('button.on'); if (b && b.offsetLeft + b.offsetWidth > sg.clientWidth) sg.scrollLeft = b.offsetLeft - 12; });
    var tab = topOf(gk) || 'home';
    $('#tabs').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    view.scrollTop = top != null ? top : (ui.scroll[location.hash] || 0);
    if (out.after) out.after();
  }

  /* ---------------- ortak parçalar ---------------- */
  function persOptions(sel, emptyLabel) {
    var o = emptyLabel != null ? '<option value="">' + h(emptyLabel) + '</option>' : '';
    state.lists.personel.forEach(function (p) { o += '<option' + (eqi(p, sel) ? ' selected' : '') + '>' + h(p) + '</option>'; });
    return o;
  }
  function listOptions(list, sel, emptyLabel) {
    var found = false, o = '<option value="">' + h(emptyLabel || '— seçin —') + '</option>';
    list.forEach(function (v) { var on = eqi(v, sel); if (on) found = true; o += '<option' + (on ? ' selected' : '') + '>' + h(v) + '</option>'; });
    if (sel && !found) o += '<option selected>' + h(sel) + '</option>';
    return o;
  }
  function durumCls(s) {
    if (!s) return 'p-grey';
    if (s.indexOf('Süreç durdu') === 0) return 'p-grey';
    if (s === 'Toplama yapıldı') return 'p-top';
    if (s === 'Aşı sürecinde') return 'p-asi';
    if (s === 'Toplama planlandı') return 'p-tas';
    if (s.indexOf('Sağlık') === 0) return 'p-sk';
    return 'p-pri';
  }
  function kindName(k) { return { sk: 'Sağlık kontrolü', asi: 'Aşı', top: 'Toplama', tas: 'Ürün taşıma', yat: 'Hastane yatış' }[k]; }
  function taskTitle(x, t) {
    if (t.slot >= 2 && t.slot <= 5 && x.sabahAksam) return 'AŞI (' + t.gun + '. gün) · SABAH-AKŞAM';
    if (t.slot === 7) return 'ÜRÜN TAŞIMA · ' + t.islem;
    return t.islem;
  }
  function taskSlots(x, t) { return (t.slot >= 2 && t.slot <= 5 && x.sabahAksam) ? [t.slot, t.slot + 7] : [t.slot]; }
  function whoBtn(x, t) {
    if (t.slot === 7 && t.yd) return '<span class="who" title="Yurt dışı ürünü personel taşımaz">Yurt dışı</span>';
    var slots = taskSlots(x, t);
    var names = slots.map(function (s) { return x.pers[s] || ''; });
    var label = names[0] || '';
    if (slots.length === 2 && names[1] !== names[0]) label = (names[0] || '—') + ' / ' + (names[1] || '—');
    var ov = slots.some(function (s) { return x.persOverridden[s]; });
    var none = !names[0] && !(slots.length === 2 && names[1]);
    return '<button class="who' + (none ? ' none' : '') + (ov ? ' ov' : '') + '" data-act="pick" data-id="' + h(x.d.id) + '" data-slots="' + slots.join(',') + '">' + h(none ? 'Ata' : label) + '</button>';
  }
  function taskCard(t, showDate) {
    var x = D[t.i], d = x.d;
    var l2 = t.slot === 7 ? (S(d.hk) ? d.hk + ' · ' : '') + S(d.ad) + ' · ' + (x.sehir || '') : (S(d.hk) ? d.hk + ' · ' : '') + S(d.ad);
    var l3 = t.slot === 7 ? S(d.bolge) : S(d.hastane) + (S(d.tel) ? ' · ' + d.tel : '');
    return '<div class="task"><div class="bar k-' + t.kind + '"></div><div class="b" data-act="donor" data-id="' + h(d.id) + '">' +
      '<div class="l1">' + (showDate ? '<span class="muted">' + h(DT.fmtShort(t.date)) + ' · </span>' : '') + h(taskTitle(x, t)) + '</div>' +
      '<div class="l2">' + h(l2) + '</div><div class="l3">' + h(l3) + '</div></div>' + whoBtn(x, t) + '</div>';
  }
  function emptyBox(title, text) { return '<div class="empty"><b>' + h(title) + '</b>' + h(text || '') + '</div>'; }
  function noDataCard() {
    return '<div class="card pad"><h2>Başlamak için verilerinizi aktarın</h2><div class="small muted" style="margin-bottom:12px">Donör Takip Excel dosyanızı (.xlsx) seçin; donörler, listeler ve haftalık programda seçtiğiniz personel atamaları uygulamaya aktarılır. Veriler yalnızca bu telefonda saklanır.</div>' +
      '<div class="btns"><button class="btn pri" data-act="import">' + I.up + 'Excel dosyası seç</button><button class="btn" data-act="newDonor">' + I.plus + 'Elle ekle</button></div></div>';
  }

  /* ---------------- Ana sayfa: MİHMANDARLIK · EŞLEŞME · MALİ İŞLER · DASHBOARD ---------------- */
  function scrHome() {
    var t = today, bugun = DT.calendarTasks(pool, D, t, t + 1, '').length, yarin = DT.calendarTasks(pool, D, t + 1, t + 2, '').length, uyari = DT.alerts(D, t, '').length;
    var Y = DT.year(t), hY = hrows.reduce(function (a, o) { return a + (o.yil === Y ? o.tutar : 0); }, 0), yY = yrows.reduce(function (a, o) { return a + (DT.year(o.r.tarih) === Y ? o.tutar : 0); }, 0);
    var topY = D.filter(function (x) { return !x.stopped && x.d.top != null && x.d.top <= t && DT.year(x.d.top) === Y; }).length;
    var btn = function (h0, renk, ikon, ad, alt, canli) {
      return '<button class="anabtn" style="background:' + renk + '" data-act="goto" data-h="' + h0 + '"><span class="ai">' + ikon + '</span><span class="grow"><span class="gt">' + h(ad) + '</span><span class="gs">' + h(alt) + '</span>' +
        (canli ? '<span class="gc">' + h(canli) + '</span>' : '') + '</span><span class="ar">' + I.right + '</span></button>';
    };
    var html = '<div class="banner k"><img src="img/kizilay-banner.jpg" alt=""></div><div class="page home">' +
      '<div class="hometitle k"><div class="ht">OABKM KÖK HÜCRE BİRİMİ</div><div class="hs">Bugün  ' + h(DT.fmt(t)) + '  ·  ' + h(gunAd(t)) + (holMap[t] ? '  ·  <b>' + h(holMap[t]) + '</b>' : '') + '</div></div>';
    if (!state.donors.length) html += noDataCard();
    html += '<div class="anabtns">' +
      btn('/mihmandarlik', MIH.renk, I.users, MIH.ad, 'Planlama, takip, donör kayıt ve arşiv', 'Bugün ' + bugun + ' · yarın ' + yarin + ' görev' + (uyari ? ' · ' + uyari + ' uyarı' : '')) +
      btn('/g/eslesme', GROUPS.eslesme.renk, I.link, GROUPS.eslesme.ad, 'Kök hücre eşleşmeleri, devirler, istatistikler', !esData ? 'Yükleniyor…' : !esData.kayitlar.length ? 'Eşleşme tablosunu yükleyin' :
        (function () { var R = esStats(), j = R.Y.indexOf(Y), kn = esKontrolSay(); return Y + ': ' + num(j >= 0 ? R.yillikTop.v[j] : 0) + ' eşleşme' + (kn ? ' · ' + kn + ' kontrol uyarısı' : ''); })()) +
      btn('/g/harcama', GROUPS.harcama.renk, I.tl, GROUPS.harcama.ad, 'Donör harcaması ve yemek kartı', Y + ': ' + tl(hY) + ' harcama · ' + tl(yY) + ' yemek kartı') +
      btn('/g/dashboard', GROUPS.dashboard.renk, I.chart, GROUPS.dashboard.ad, 'İstatistikler, iş yükü, taşıma ve raporlar', Y + ': ' + topY + ' toplama gerçekleşti') + '</div>';
    html += '</div>';
    return { title: 'Ana Sayfa', html: html, actions: '<button class="icon" data-act="goto" data-h="/ayarlar" aria-label="Ayarlar">' + I.gear + '</button>' };
  }
  /* ---------------- MİHMANDARLIK (önceki ana sayfa) ---------------- */
  function scrMihmandarlik() {
    var t = today, todayTasks = DT.calendarTasks(pool, D, t, t + 1, ''), tomorrow = DT.calendarTasks(pool, D, t + 1, t + 2, '');
    var alerts = DT.alerts(D, t, ''), kontrol = D.filter(function (x) { return x.kontrol; }).length;
    var unassigned = tomorrow.filter(function (k) { var x = D[k.i]; return !(k.slot === 7 && k.yd) && !x.pers[k.slot]; }).length;
    var html = '<div class="page home">' +
      '<div class="ghead" style="background:' + MIH.renk + '"><div class="gt">' + MIH.ad + '</div><div class="gs">Bugün ' + h(DT.fmt(t)) + ' · ' + h(gunAd(t)) + (holMap[t] ? ' · ' + h(holMap[t]) : '') + '</div></div>';
    if (!state.donors.length) html += noDataCard();
    html += '<div class="tiles">' +
      '<button class="tile" data-act="calToday"><div class="n">' + todayTasks.length + '</div><div class="l">Bugün · görev</div><div class="s">Takvim’de bugünün görevleri</div></button>' +
      '<button class="tile" data-act="goto" data-h="/plan/program"><div class="n">' + tomorrow.length + '</div><div class="l">Yarın · görev' + (unassigned ? ' · <span style="color:var(--red)">' + unassigned + ' atanmamış</span>' : '') + '</div><div class="s">Çalışma Programı: yarının programı</div></button>' +
      '<button class="tile' + (alerts.length ? ' warn' : ' ok') + '" data-act="goto" data-h="/plan/uyarilar"><div class="n">' + alerts.length + '</div><div class="l">Geri sayım uyarısı</div><div class="s">Görev Listesi: kaç gün kaldı</div></button>' +
      '<button class="tile' + (kontrol ? ' warn' : ' ok') + '" data-act="kontrolList"><div class="n">' + kontrol + '</div><div class="l">Kontrol notu</div><div class="s">Donör Kayıt’ta eksik ya da uyumsuz bilgi</div></button></div>' +
      '<div class="actions"><button class="btn newdonor" data-act="newDonor">' + I.plus + 'YENİ DONÖR EKLE</button><button class="btn wa" data-act="shareTomorrow">' + I.wa + 'Yarının programı</button></div>' +
      '<div class="btns"><button class="btn pdfbtn" data-act="pdfPick">' + I.up + 'PDF’ten donör ekle</button><button class="btn pdfbtn" data-act="mailDurum">' + I.mail + 'Mailden iptal / erteleme</button></div>' +
      '<div class="groups">' + MIH.gruplar.map(function (k) {
        var g = GROUPS[k];
        return '<button class="gbtn" style="background:' + g.renk + '" data-act="goto" data-h="/g/' + k + '"><span class="gt">' + h(g.ad) + '</span><span class="gs">' + h(g.alt) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="hint" style="margin:2px 4px 6px">Bir gruba dokununca o grubun sayfaları açılır. Her sayfanın üstündeki düğmelerle gruptaki sayfalar arasında geçebilirsiniz.</div>' +
      '<div class="sec-title">Bugünün görevleri</div><div class="card">' +
      (todayTasks.length ? todayTasks.map(function (k) { return taskCard(k); }).join('') : emptyBox('Bugün için görev yok', '')) + '</div>';
    if (alerts.length) {
      html += '<div class="sec-title">Yaklaşan uyarılar</div><div class="card">' + alerts.slice(0, 4).map(alertRow).join('') +
        (alerts.length > 4 ? '<button class="btn ghost block" data-act="goto" data-h="/plan/uyarilar">Tümünü gör (' + alerts.length + ')</button>' : '') + '</div>';
    }
    html += '</div>';
    return { title: 'Mihmandarlık', html: html, actions: '<button class="icon" data-act="goto" data-h="/ayarlar" aria-label="Ayarlar">' + I.gear + '</button>' };
  }

  /* ---------------- Grup menüleri (Excel'deki PLANLAMA / TAKİP / DONÖR KAYIT VE ARŞİV / DASHBOARD sayfaları) ---------------- */
  function scrGroup(k) {
    var g = GROUPS[k];
    var html = '<div class="page"><div class="ghead" style="background:' + g.renk + '"><div class="gt">' + h(g.ad) + '</div><div class="gs">' + h(g.alt) + ' · açmak istediğiniz sayfaya dokunun</div></div>' +
      (g.pages.length ? '' : '<div class="card pad"><b>Bu bölüm hazırlanıyor.</b><div class="small muted" style="margin-top:6px">Eşleşme tablosunun sayfaları buraya eklenecek.</div></div>') +
      '<div class="gcards">' + g.pages.map(function (pg) {
        return '<button class="gcard' + (pg[3] ? ' soon' : '') + '" style="background:' + g.renk + '" ' + (pg[3] ? 'data-act="soon"' : 'data-act="goto" data-h="' + pg[0] + '"') + '>' +
          '<span class="ct">' + h(pg[1]) + '</span><span class="cs" style="color:' + g.acik + '">' + h(pg[3] ? 'Sonraki sürümde' : pg[2]) + '</span></button>';
      }).join('') + '</div></div>';
    return { title: g.ad.charAt(0) + g.ad.slice(1).toLocaleLowerCase('tr-TR'), html: html };
  }

  /* ---------------- Donör listesi ---------------- */
  var DFILTERS = [['all', 'Tümü'], ['active', 'Süreçte'], ['done', 'Toplama yapıldı'], ['stopped', 'Durdu'], ['kontrol', 'Kontrol notu']];
  function dfilterFn(k) {
    if (k === 'active') return function (x) { return !x.stopped && x.durum !== 'Toplama yapıldı'; };
    if (k === 'done') return function (x) { return x.durum === 'Toplama yapıldı'; };
    if (k === 'stopped') return function (x) { return x.stopped; };
    if (k === 'kontrol') return function (x) { return !!x.kontrol; };
    return function () { return true; };
  }
  function filteredDonors() {
    var f = dfilterFn(ui.dfilter), q = fold(ui.search.trim()), arr = D.filter(f);
    if (q) {
      var terms = q.split(/\s+/);
      arr = arr.filter(function (x) {
        var d = x.d, hay = fold([d.hk, d.dno, d.ad, d.tel, d.ikamet, d.hastane, d.bolge, d.aciklama, d.personel, d.yontem].join(' '));
        var hayDigits = S(d.tel).replace(/\D/g, '');
        return terms.every(function (t) { return hay.indexOf(t) >= 0 || (/^\d{3,}$/.test(t) && hayDigits.indexOf(t) >= 0); });
      });
    }
    if (ui.dsort === 'new') arr = arr.slice().reverse();
    else if (ui.dsort === 'top') arr = arr.slice().sort(function (a, b) { return (b.d.top || -1) - (a.d.top || -1) || b.i - a.i; });
    else if (ui.dsort === 'sk') arr = arr.slice().sort(function (a, b) { return (b.d.sk || -1) - (a.d.sk || -1) || b.i - a.i; });
    else if (ui.dsort === 'ad') arr = arr.slice().sort(function (a, b) { return S(a.d.ad).localeCompare(S(b.d.ad), 'tr'); });
    return arr;
  }
  function donorItem(x) {
    var d = x.d, chips = [];
    if (d.sk != null) chips.push('<span class="pillx p-sk">SK ' + DT.fmtShort(d.sk) + '</span>');
    if (x.asi != null) chips.push('<span class="pillx p-asi">Aşı ' + DT.fmtShort(x.asi) + '</span>');
    if (d.top != null) chips.push('<span class="pillx p-top">Top. ' + DT.fmtShort(d.top) + '</span>');
    if (S(d.personel)) chips.push('<span class="pillx p-grey">' + h(d.personel) + '</span>');
    var t2 = [d.hk, d.hastane, d.yontem].filter(Boolean).join(' · ');
    return '<a class="item' + (x.stopped ? ' stopped' : '') + '" data-act="donor" data-id="' + h(d.id) + '"><div class="t1"><span class="name">' + h(d.ad || d.hk || '(adsız)') + '</span>' +
      (x.kontrol ? '<span class="warnicon" title="' + h(x.kontrol) + '">' + I.warn + '</span>' : '') +
      '<span class="pillx ' + durumCls(x.durum) + '">' + h(x.durum) + '</span></div><div class="t2 ellipsis">' + h(t2) + '</div>' +
      (chips.length ? '<div class="t3">' + chips.join('') + '</div>' : '') + '</a>';
  }
  function donorListHtml() {
    var arr = filteredDonors();
    if (!arr.length) return '<div class="card">' + emptyBox(state.donors.length ? 'Eşleşen kayıt yok' : 'Henüz donör yok', state.donors.length ? 'Aramayı ya da filtreyi değiştirin.' : '') + '</div>';
    var shown = arr.slice(0, ui.dlimit);
    return '<div class="summary">' + arr.length + ' kayıt</div><div class="card list">' + shown.map(donorItem).join('') + '</div>' +
      (arr.length > shown.length ? '<button class="btn block" data-act="more">Daha fazla göster (' + (arr.length - shown.length) + ')</button>' : '');
  }
  function scrDonors() {
    var counts = {}; DFILTERS.forEach(function (f) { counts[f[0]] = D.filter(dfilterFn(f[0])).length; });
    var html = '<div class="page flush">' + groupSeg('arsiv', '/donorler') + '<div class="seg sub">' + DFILTERS.map(function (f) {
      return '<button class="' + (ui.dfilter === f[0] ? 'on' : '') + '" data-act="dfilter" data-v="' + f[0] + '">' + f[1] + '<span class="c">' + counts[f[0]] + '</span></button>';
    }).join('') + '</div>' +
      '<div class="toolbar"><div class="search grow">' + I.search + '<input class="inp" type="search" placeholder="Ad, hasta kodu, telefon, hastane…" value="' + h(ui.search) + '" data-ui="search"></div>' +
      '<select class="inp" data-ui="dsort" style="flex:none;width:auto">' +
      [['new', 'Son eklenen'], ['top', 'Toplama'], ['sk', 'Sağlık k.'], ['ad', 'Ad']].map(function (o) { return '<option value="' + o[0] + '"' + (ui.dsort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div><div class="btns" style="margin-bottom:10px"><button class="btn pdfbtn" data-act="pdfPick">' + I.up + 'PDF’ten donör ekle</button><button class="btn pdfbtn" data-act="mailDurum">' + I.mail + 'Mailden iptal / erteleme</button></div><div id="dlist">' + donorListHtml() + '</div></div>' +
      '<button class="fab" data-act="newDonor" aria-label="Yeni donör">' + I.plus + '</button>';
    return { title: 'Donör Kayıt', html: html };
  }

  /* ---------------- Donör ayrıntısı ---------------- */
  function scrDonor(id) {
    var x = byId[id];
    if (!x) return { title: 'Donör', back: true, html: '<div class="page">' + emptyBox('Kayıt bulunamadı', 'Silinmiş olabilir.') + '</div>' };
    var d = x.d, L = state.lists;
    var html = '<div class="page"><div class="card dhead"><div class="row"><div class="grow"><div class="n">' + h(d.ad || '(adsız)') + '</div><div class="c">' + h([d.hk, d.dno].filter(Boolean).join(' · ')) + '</div></div></div>' +
      '<div style="margin-top:8px"><span class="pillx ' + durumCls(x.durum) + '">' + h(x.durum) + '</span>' + (x.stopped ? ' <span class="pillx p-grey">Plan ve listelerden çıkarıldı</span>' : '') + '</div>' +
      '<div class="btns" style="margin-top:12px"><button class="btn pri" data-act="editDonor" data-id="' + h(id) + '">' + I.edit + 'Düzenle</button>' +
      (telHref(d.tel) ? '<a class="btn" href="' + h(telHref(d.tel)) + '">' + I.phone + 'Ara</a>' : '') +
      '<button class="btn" data-act="copyDonor" data-id="' + h(id) + '">' + I.copy + 'Kopyala</button></div>' +
      '<button class="btn block pdfbtn" data-act="durumNew" data-id="' + h(id) + '" style="margin-top:8px">İptal / red / erteleme ekle</button></div>';
    if (x.issues.length) html += '<div class="issues"><b>Kontrol</b>' + x.issues.map(h).join('<br>') + '</div>';
    if (x.dupAd) html += '<div class="issues"><b>Aynı ad soyad</b>Bu ad soyad başka bir kayıtta da var.</div>';
    // Süreç
    var tl = [];
    if (d.sk != null) tl.push([d.sk, 'Sağlık kontrolü', 'sk']);
    if (x.asiYok) tl.push([null, 'Aşı yok', 'asi']);
    else if (x.asi != null) tl.push([x.asi, 'Aşı başlangıcı (1.–4. gün: ' + DT.fmtShort(x.asi) + ' – ' + DT.fmtShort(x.asi + 3) + ')' + (d.asiManual != null ? ' · elle' : ''), 'asi']);
    if (d.top != null && x.kem && eqi(d.hastane, 'BİLKENT PEDİATRİ')) tl.push([d.top - 1, 'Hastane yatış', 'yat']);
    if (d.top != null) tl.push([d.top, 'Toplama' + (S(d.bolge) ? ' → ' + (x.yd === 1 ? 'yurt dışı' : x.baslik) : ''), 'top']);
    if (x.sonIzlem != null) tl.push([x.sonIzlem, 'Son izlem' + (d.sonIzlemManual != null ? ' · elle' : ''), 'sk']);
    if (d.idmBas != null || d.idmBit != null) tl.push([d.idmBas, 'IDM ' + DT.fmt(d.idmBas) + (d.idmBit != null ? ' – ' + DT.fmt(d.idmBit) : ''), 'yat']);
    if (tl.length) {
      html += '<div class="sec-title">Süreç</div><div class="card timeline">' + tl.map(function (e) {
        return '<div class="tl' + (e[0] != null && e[0] < today ? ' past' : '') + '"><span class="pillx p-' + e[2] + '">' + (e[0] != null ? DT.fmt(e[0]) : '—') + '</span><div class="ds">' + h(e[1]) +
          (e[0] != null ? '<div class="tiny muted">' + gunAd(e[0]) + (holMap[e[0]] ? ' · ' + h(holMap[e[0]]) : '') + (e[0] >= today ? ' · ' + (e[0] === today ? 'bugün' : (e[0] - today) + ' gün sonra') : '') + '</div>' : '') + '</div></div>';
      }).join('') + '</div>';
    }
    // Görevler
    var mine = pool.filter(function (t) { return t.i === x.i && t.slot < 9; });
    if (mine.length) {
      html += '<div class="sec-title">Görevler ve personel</div><div class="card">' + mine.map(function (t) { return taskCard(t, true); }).join('') + '</div>' +
        '<div class="note" style="margin:-4px 6px 8px">Personel düğmesine dokunarak göreve kişi atayın. Atama Takvim, Çalışma Programı ve takip listelerine yansır.</div>';
    }
    var rows = [['Hasta kodu', d.hk], ['Donör numarası', d.dno], ['Ad soyad', d.ad], ['Telefon', d.tel], ['İkameti', d.ikamet + (x.ankara === 1 ? ' (Ankara içi)' : x.ankara === 0 ? ' (Ankara dışı)' : '')],
      ['Yöntemi', d.yontem], ['Hastane', d.hastane], ['Açıklama', d.aciklama], ['Nakil merkezi', S(d.bolge) + (x.sehir ? ' · ' + x.sehir : '')],
      ['İlgilenen personel', d.personel], ['Taşıyan personel', d.tasiyan], ['Ulaşım', d.ulasim], ['Konaklama', d.konaklama], ['IDM', d.idm ? '✓' : '']];
    html += '<div class="sec-title">Bilgiler</div><div class="card dl">' + rows.map(function (r) { return '<div>' + h(r[0]) + '</div><div>' + (r[1] ? h(r[1]) : '<span class="muted">—</span>') + '</div>'; }).join('') + '</div>' +
      hrDonorSection(x) +
      '<button class="btn danger block" data-act="delDonor" data-id="' + h(id) + '" style="margin-top:8px">Kaydı sil</button></div>';
    return { title: d.ad || 'Donör', back: true, html: html, tab: 'donorler' };
  }

  /* ---------------- Donör formu ---------------- */
  var formDraft = null;
  function scrDonorForm(id) {
    var x = id ? byId[id] : null;
    if (id && !x) return { title: 'Donör', back: true, html: '<div class="page">' + emptyBox('Kayıt bulunamadı') + '</div>' };
    var d = x ? x.d : DT.emptyDonor(), L = state.lists, pre = pdfPrefill && pdfPrefill.target === (id || 'new') ? pdfPrefill : null;
    if (pre) d = Object.assign({}, d, pre.fields);
    var asiMode = d.asiManual === 'YOK' ? 'yok' : d.asiManual != null ? 'manual' : 'auto';
    var sonMode = d.sonIzlemManual != null ? 'manual' : 'auto';
    var f = function (name, label, val, type, extra) {
      return '<div class="field"><label>' + label + '</label><input class="inp" name="' + name + '" type="' + (type || 'text') + '" value="' + h(val) + '"' + (extra || '') + '></div>';
    };
    var dt = function (name, label, val) { return f(name, label, DT.iso(val), 'date'); };
    var sel = function (name, label, opts) { return '<div class="field"><label>' + label + '</label><select class="inp" name="' + name + '">' + opts + '</select></div>'; };
    var bolgeList = {}; state.donors.forEach(function (o) { if (S(o.bolge)) bolgeList[o.bolge] = 1; });
    var radios = function (name, cur, items) {
      return '<div class="radios">' + items.map(function (it) { return '<label class="' + (cur === it[0] ? 'on' : '') + '"><input type="radio" name="' + name + '" value="' + it[0] + '"' + (cur === it[0] ? ' checked' : '') + '>' + it[1] + '</label>'; }).join('') + '</div>';
    };
    var html = '<div class="page">' + (pre ? pdfInfoCard(pre, x) : (!id ? '<button class="btn block" data-act="pdfPick" style="margin-bottom:10px">' + I.up + 'PDF’ten doldur (Organizasyon Talebi)</button>' : '')) +
      '<form id="dform" autocomplete="off" data-id="' + h(id || '') + '"><div class="card pad">' +
      '<div class="formsec">Kimlik</div>' +
      '<div class="grid2">' + f('hk', 'Hasta kodu', d.hk, 'text', ' autocapitalize="characters"') + f('dno', 'Donör numarası', d.dno, 'text', ' autocapitalize="characters"') + '</div>' +
      f('ad', 'Ad soyad', d.ad, 'text', ' autocapitalize="characters"') +
      '<div class="grid2">' + f('tel', 'Telefon no', d.tel, 'tel') + f('ikamet', 'İkameti', d.ikamet, 'text', ' placeholder="İLÇE/İL" autocapitalize="characters"') + '</div>' +
      '<div class="formsec">Süreç</div>' +
      '<div class="grid2">' + dt('sk', 'Sağlık kontrolü tarihi', d.sk) + sel('yontem', 'Yöntemi', listOptions(L.yontem, d.yontem)) + '</div>' +
      sel('hastane', 'Hastane', listOptions(L.hastane.map(function (e) { return e.ad; }), d.hastane)) +
      '<div class="field"><label>Açıklama</label><textarea class="inp" name="aciklama" rows="3">' + h(d.aciklama) + '</textarea>' +
      '<div class="hint">“iptal”, “ertelendi”, “red”, “vazgeçti”, “hasta ex” yazılan donörün süreci durur. ONKOLOJİ’de “18 kg” gibi 20 kg ve altı kilo yazılırsa aşı 3 gün önce başlar.</div></div>' +
      dt('top', 'Kök hücre toplama tarihi', d.top) +
      '<div class="field"><label>Aşı başlama tarihi</label>' + radios('asiMode', asiMode, [['auto', 'Otomatik'], ['manual', 'Elle tarih'], ['yok', 'Aşı yok']]) +
      '<input class="inp" name="asiManual" type="date" value="' + h(typeof d.asiManual === 'number' ? DT.iso(d.asiManual) : '') + '"' + (asiMode === 'manual' ? '' : ' hidden') + '>' +
      '<div class="calc" id="asiCalc"></div></div>' +
      '<div class="field"><label>Nakil merkezi bölge</label><input class="inp" name="bolge" list="bolgeler" value="' + h(d.bolge) + '" autocapitalize="characters" placeholder="ör. KOÇ ÜNİVERSİTESİ HASTANESİ İST. · YURT DIŞI (ALMANYA - ZKRD)">' +
      '<datalist id="bolgeler">' + Object.keys(bolgeList).sort().map(function (b) { return '<option value="' + h(b) + '">'; }).join('') + '</datalist><div class="calc" id="bolgeCalc" style="margin-top:6px"></div></div>' +
      '<div class="field"><label>Son izlem tarihi</label>' + radios('sonMode', sonMode, [['auto', 'Otomatik (toplama + 20 gün)'], ['manual', 'Elle tarih']]) +
      '<input class="inp" name="sonIzlemManual" type="date" value="' + h(DT.iso(d.sonIzlemManual)) + '"' + (sonMode === 'manual' ? '' : ' hidden') + '><div class="calc" id="sonCalc"></div></div>' +
      '<div class="formsec">Personel ve lojistik</div>' +
      '<div class="grid2">' + sel('personel', 'İlgilenen personel', persOptions(d.personel, '— yok —') + (S(d.personel) && !DT.inPersonel(L, d.personel) ? '<option selected>' + h(d.personel) + '</option>' : '')) +
      sel('tasiyan', 'Taşıyan personel', persOptions(d.tasiyan, '— ilgilenen —') + (S(d.tasiyan) && !DT.inPersonel(L, d.tasiyan) ? '<option selected>' + h(d.tasiyan) + '</option>' : '')) + '</div>' +
      '<div class="grid2">' + sel('ulasim', 'Ulaşım türü', listOptions(L.ulasim, d.ulasim, '—')) + sel('konaklama', 'Konaklama', listOptions(L.konaklama, d.konaklama, '—')) + '</div>' +
      '<div class="formsec">IDM</div>' +
      '<label class="check"><input type="checkbox" name="idm"' + (d.idm ? ' checked' : '') + '> IDM ✓ (IDM sayfasında listelensin)</label>' +
      '<div class="grid2">' + dt('idmBas', 'IDM başlangıç', d.idmBas) + dt('idmBit', 'IDM bitiş', d.idmBit) + '</div>' +
      '</div><div class="btns" style="margin-top:4px"><button type="button" class="btn" data-act="back">Vazgeç</button><button type="submit" class="btn pri">Kaydet</button></div></form></div>';
    return {
      title: id ? 'Donörü düzenle' : 'Yeni donör', back: true, html: html, tab: 'donorler',
      after: function () {
        var form = $('#dform');
        form.addEventListener('input', function () { formPreview(form); });
        form.addEventListener('change', function (e) {
          if (e.target.name === 'asiMode') form.asiManual.hidden = e.target.value !== 'manual';
          if (e.target.name === 'sonMode') form.sonIzlemManual.hidden = e.target.value !== 'manual';
          form.querySelectorAll('.radios label').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
          formPreview(form);
        });
        form.addEventListener('submit', function (e) { e.preventDefault(); saveDonorForm(form); });
        formPreview(form);
      }
    };
  }
  var pdfPrefill = null;
  var PDF_ALAN = [['hk', 'Hasta kodu'], ['dno', 'Donör numarası'], ['ad', 'Ad soyad'], ['tel', 'Telefon'], ['ikamet', 'İkameti'], ['sk', 'Sağlık kontrolü', 1],
    ['yontem', 'Yöntem'], ['hastane', 'Hastane'], ['top', 'Toplama tarihi', 1], ['bolge', 'Nakil merkezi'], ['sonIzlemManual', 'Son izlem', 1], ['aciklama', 'Açıklama']];
  function pdfInfoCard(pre, x) {
    var f = pre.fields, got = [], miss = [], changes = [];
    PDF_ALAN.forEach(function (a) {
      var v = f[a[0]];
      if (v == null || v === '') { if (a[0] !== 'sonIzlemManual' && a[0] !== 'aciklama') miss.push(a[1]); return; }
      got.push(a[1]);
      if (x) { var old = x.d[a[0]], ov = a[2] ? DT.fmt(old) : S(old), nv = a[2] ? DT.fmt(v) : S(v); if (old != null && old !== '' && ov !== nv) changes.push(a[1] + ': ' + ov + ' → ' + nv); else if ((old == null || old === '') && nv) changes.push(a[1] + ': (boş) → ' + nv); }
    });
    return '<div class="card pad pdfcard"><h2>' + I.up + ' PDF’ten okundu</h2><div class="small muted">' + h(pre.file) + (pre.info.takipNo ? ' · ' + h(pre.info.takipNo) : '') + '</div>' +
      (x ? '<div class="issues" style="margin-top:10px"><b>' + h(x.d.hk || x.d.ad) + ' zaten kayıtlı — mevcut kayıt güncellenecek</b>' + (changes.length ? changes.map(h).join('<br>') : 'PDF’teki bilgiler kayıtla aynı.') + '</div>' : '') +
      (x && x.stopped ? '<div class="issues" style="margin-top:8px"><b>Bu donörün süreci durmuş görünüyor</b>Açıklamada “' + h(x.d.aciklama) + '” yazıyor. Süreç yeni tarihlerle devam edecekse aşağıdaki Açıklama alanından o notu silin; yoksa görevler plana girmez.</div>' : '') +
      '<div class="small" style="margin-top:8px"><b>Okunan:</b> ' + h(got.join(', ') || '—') + '</div>' +
      (miss.length ? '<div class="small" style="margin-top:4px;color:var(--orange)"><b>Bulunamadı:</b> ' + h(miss.join(', ')) + '</div>' : '') +
      (pre.info.merkez ? '<div class="small muted" style="margin-top:4px">Toplama merkezi: ' + h(pre.info.merkez) + '</div>' : '') +
      (pre.info.nakilTam ? '<div class="small muted">Nakil merkezi: ' + h(pre.info.nakilTam) + '</div>' : '') +
      (pre.info.kg != null ? '<div class="small muted">Hasta kg: ' + h(pre.info.kg) + '</div>' : '') +
      pre.warn.map(function (w) { return '<div class="small" style="color:var(--red);margin-top:4px">' + h(w) + '</div>'; }).join('') +
      '<div class="small" style="margin-top:8px">Bilgileri kontrol edin; personel gibi PDF’te olmayan alanları ekleyip <b>Kaydet</b>’e basın.</div></div>';
  }
  function handlePdf(res, name) {
    var p = PDFText.parseTalep(res, state.lists);
    if (p.empty) { toast(p.warn[0]); return; }
    var f = p.fields;
    if (!f.hk && !f.ad && !f.dno) { toast('Bu PDF’te donör bilgisi bulunamadı (Organizasyon Talebi formu bekleniyor).'); return; }
    var x = null;
    D.forEach(function (y) { if ((f.hk && eqi(y.d.hk, f.hk) && (!f.dno || !y.d.dno || eqi(y.d.dno, f.dno))) || (!f.hk && f.dno && eqi(y.d.dno, f.dno))) x = y; });
    if (x) ['bolge', 'ikamet', 'ad', 'tel'].forEach(function (k) {   // mevcut yazım PDF'tekinin kısaltmasıysa kullanıcının yazımı kalsın
      var o = DT.normKey(x.d[k]), n = DT.normKey(f[k]);
      if (o && n && n !== o && n.indexOf(o) >= 0) f[k] = x.d[k];
    });
    if (p.info.kg != null && p.info.kg <= 20 && f.hastane && DT.has(f.hastane, 'ONKOLOJ')) {
      var ac = x ? S(x.d.aciklama) : '';
      if (DT.parseKg(ac) == null) f.aciklama = (ac ? ac + ' · ' : '') + 'Hasta ' + String(p.info.kg).replace('.', ',') + ' kg';
    }
    pdfPrefill = { target: x ? x.d.id : 'new', fields: f, info: p.info, warn: p.warn, file: name };
    go(x ? '/donor/' + x.d.id + '/duzenle' : '/donor/yeni');
  }
  /* ---- süreç durumu (iptal / red / erteleme …) → açıklama ---- */
  function durumSheet(o) {
    o = o || {};
    var p = (o.text || o.subject) ? DT.parseDurumMail(o.text, D, o.subject) : { cands: [], durum: null, cumle: '', kodlar: [] };
    var fixed = o.id && byId[o.id] ? byId[o.id] : null;
    var selId = fixed ? fixed.d.id : (p.cands[0] ? p.cands[0].x.d.id : '');
    var opt = function (x) {
      return '<option value="' + h(x.d.id) + '"' + (x.d.id === selId ? ' selected' : '') + '>' + h([x.d.hk, x.d.ad].filter(Boolean).join(' · ')) +
        (x.d.top != null ? ' · ' + DT.fmtShort(x.d.top) + '.' + String(DT.year(x.d.top)).slice(2) : '') + (x.stopped ? ' (durdu)' : '') + '</option>';
    };
    var donorField;
    if (fixed) donorField = '<div class="field"><label>Donör</label><div class="calc"><b>' + h(fixed.d.ad || '(adsız)') + '</b> · ' + h([fixed.d.hk, fixed.d.dno].filter(Boolean).join(' · ')) + '</div></div>';
    else {
      var seen = {};
      var top = p.cands.map(function (c) { seen[c.x.d.id] = 1; return opt(c.x); }).join('');
      var rest = D.filter(function (x) { return !seen[x.d.id] && (S(x.d.hk) || S(x.d.ad)); })
        .sort(function (a, b) { return (b.d.top || 0) - (a.d.top || 0); }).map(opt).join('');
      donorField = '<div class="field"><label>Donör</label><select class="inp" name="id"><option value="">— donör seçin —</option>' +
        (top ? '<optgroup label="Mailde geçen">' + top + '</optgroup>' : '') + '<optgroup label="Tüm donörler">' + rest + '</optgroup></select>' +
        (o.mail && !p.cands.length ? '<div class="hint" style="color:var(--orange)">Mailde kayıtlı bir hasta kodu, donör numarası ya da ad soyad bulunamadı' + (p.kodlar.length ? ' (mailde geçen: ' + h(p.kodlar.join(', ')) + ')' : '') + '. Donörü listeden seçin.</div>' : '') +
        (p.cands.length > 1 ? '<div class="hint">Mailde birden fazla donör geçiyor; doğru olanı seçin.</div>' : '') + '</div>';
    }
    var radios = '<div class="radios">' + DT.DURUMLAR.map(function (z) {
      return '<label' + (z[0] === p.durum ? ' class="on"' : '') + '><input type="radio" name="durum" value="' + z[0] + '"' + (z[0] === p.durum ? ' checked' : '') + '>' + h(z[1]) + '</label>';
    }).join('') + '</div>';
    openSheet('<h3>' + (o.mail ? 'Mailden süreç durumu' : 'Süreç durumu ekle') + '</h3>' +
      (o.mail ? '<div class="sub">' + (p.durum ? 'Mailde “' + h(DT.DURUMLAR.filter(function (z) { return z[0] === p.durum; })[0][1].toLocaleLowerCase('tr-TR')) + '” bulundu. Kontrol edip ekleyin.' : 'Mailde iptal, red ya da erteleme ifadesi bulunamadı; durumu siz seçin.') + '</div>' : '') +
      '<form id="durform">' + donorField +
      '<div class="field"><label>Durum</label>' + radios + (p.cumle ? '<div class="hint">Mailde: “' + h(p.cumle) + '”</div>' : '') + '</div>' +
      '<div class="field"><label>Ek not (isteğe bağlı)</label><input class="inp" name="sebep" placeholder="Boş bırakılırsa yalnızca anahtar kelime yazılır"></div>' +
      '<div class="calc small" id="durPrev"></div>' +
      '<div class="hint" style="margin:8px 2px 12px">Açıklamasında iptal, red, ertele, vazgeç ya da hasta ex yazan donörün görevleri Excel’deki gibi plan ve listelerden çıkar.</div>' +
      '<div class="btns"><button type="button" class="btn" data-act="closeSheet">Vazgeç</button><button class="btn pri">Açıklamaya ekle</button></div></form>');
    var f = $('#durform');
    var cur = function () { return fixed || byId[f.id ? f.id.value : ''] || null; };
    var durum = function () { var r = f.querySelector('[name=durum]:checked'); return r ? r.value : null; };
    var zatenVar = function (x) {   // aynı anahtar kelime açıklamada zaten varsa tekrar yazma
      var z = DT.DURUMLAR.filter(function (q) { return q[0] === durum(); })[0];
      return !!(x && z && !S(f.sebep.value).trim() && DT.fold(x.d.aciklama).indexOf(DT.fold(z[2])) >= 0);
    };
    var yeni = function (x) {
      var not = DT.durumNotu(durum(), f.sebep.value), ac = x ? S(x.d.aciklama).trim() : '';
      if (!not || zatenVar(x)) return ac;
      return (ac ? ac + ' · ' : '') + not;
    };
    var prev = function () {
      var x = cur(), n = DT.durumNotu(durum(), f.sebep.value);
      $('#durPrev').innerHTML = !n ? '<b>Yeni açıklama:</b> <span class="muted">durum seçin</span>' :
        zatenVar(x) ? '<b>Açıklamada zaten yazıyor:</b> ' + h(x.d.aciklama) : '<b>Yeni açıklama:</b> ' + h(yeni(x));
    };
    f.addEventListener('change', function () { f.querySelectorAll('.radios label').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); prev(); });
    f.addEventListener('input', prev);
    prev();
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var x = cur();
      if (!x) { toast('Donör seçin'); return; }
      if (!durum()) { toast('Durum seçin'); return; }
      if (zatenVar(x)) { closeSheet(); toast('Açıklamada zaten yazıyor'); if (location.hash !== '#/donor/' + x.d.id) go('/donor/' + x.d.id); return; }
      x.d.aciklama = yeni(x);
      var id = x.d.id;
      closeSheet(); commit(); toast('Açıklamaya eklendi · süreç durdu');
      if (location.hash !== '#/donor/' + id) go('/donor/' + id);
    });
  }
  function mailPasteSheet() {
    openSheet('<h3>Mailden durum ekle</h3><div class="sub">Outlook’ta mailin metnini seçip kopyalayın, buraya yapıştırın. Hasta kodu ve iptal / red / erteleme bilgisi okunur.</div>' +
      '<div class="field"><textarea class="inp" id="mailTxt" rows="8" placeholder="Mail metni…"></textarea></div>' +
      '<div class="btns"><button type="button" class="btn" data-act="closeSheet">Vazgeç</button><button type="button" class="btn pri" id="mailOku">Oku</button></div>');
    $('#mailOku').onclick = function () {
      var t = $('#mailTxt').value;
      if (!t.trim()) { toast('Mail metnini yapıştırın'); return; }
      closeSheet(); durumSheet({ text: t, mail: true });
    };
  }
  // Outlook'ta mail metni: Paylaş › Donör Takip ya da seçili metin menüsünde Donör Takip
  window.receiveSharedText = function (subject, text) {
    if (/^\s*$/.test(String(text || '') + String(subject || ''))) return;
    durumSheet({ text: text, subject: subject, mail: true });
  };
  function readForm(form, base) {
    var d = Object.assign({}, base);
    var v = function (n) { return S(form[n].value).trim(); };
    d.hk = upperTR(v('hk')); d.dno = upperTR(v('dno')); d.ad = upperTR(v('ad')); d.tel = v('tel'); d.ikamet = upperTR(v('ikamet'));
    d.sk = DT.fromIso(v('sk')); d.yontem = v('yontem'); d.hastane = v('hastane'); d.aciklama = S(form.aciklama.value).trim();
    d.top = DT.fromIso(v('top')); d.bolge = v('bolge'); d.personel = v('personel'); d.tasiyan = v('tasiyan');
    d.ulasim = v('ulasim'); d.konaklama = v('konaklama'); d.idm = form.idm.checked; d.idmBas = DT.fromIso(v('idmBas')); d.idmBit = DT.fromIso(v('idmBit'));
    var am = form.querySelector('[name=asiMode]:checked').value;
    d.asiManual = am === 'yok' ? 'YOK' : am === 'manual' ? DT.fromIso(v('asiManual')) : null;
    var sm = form.querySelector('[name=sonMode]:checked').value;
    d.sonIzlemManual = sm === 'manual' ? DT.fromIso(v('sonIzlemManual')) : null;
    return d;
  }
  function formPreview(form) {
    var id = form.dataset.id, base = id && byId[id] ? byId[id].d : DT.emptyDonor();
    var d = readForm(form, base);
    var x = DT.derive({ lists: state.lists, donors: [d] }, today)[0];
    var a = $('#asiCalc'), s = $('#sonCalc'), b = $('#bolgeCalc');
    if (a) a.textContent = x.asiYok ? 'Aşı yapılmaz' : x.asi != null ? 'Aşı: ' + DT.fmt(x.asi) + ' – ' + DT.fmt(x.asi + 3) + ' (' + (d.top != null && d.asiManual == null ? (d.top - x.asi) + ' gün önce' : 'elle') + ')' : 'Toplama tarihi girilince hesaplanır';
    if (s) s.textContent = x.sonIzlem != null ? 'Son izlem: ' + DT.fmt(x.sonIzlem) : 'Toplama tarihi girilince hesaplanır';
    if (b) b.textContent = !S(d.bolge) ? 'Programda ürün taşıma satırı için gerekli' : x.yd === 1 ? 'Yurt dışı · ürünü personel taşımaz' : 'Şehir: ' + x.sehir + ' · Programda: ' + S(d.hastane || 'HASTANE') + '-' + x.baslik;
  }
  function saveDonorForm(form) {
    var id = form.dataset.id;
    var base = id && byId[id] ? byId[id].d : DT.emptyDonor();
    var d = readForm(form, base);
    if (!d.hk && !d.ad) { toast('Hasta kodu ya da ad soyad girin.'); return; }
    if (form.querySelector('[name=asiMode]:checked').value === 'manual' && d.asiManual == null) { toast('Aşı tarihini seçin ya da Otomatik’i işaretleyin.'); return; }
    if (id) { var k = state.donors.indexOf(base); state.donors[k] = d; }
    else state.donors.push(d);
    save(); recompute();
    toast(id ? 'Kaydedildi' : 'Donör eklendi'); pdfPrefill = null;
    if (id) history.back(); else go('/donor/' + d.id, true);
  }

  /* ---------------- Personel atama ---------------- */
  function pickPersonnel(id, slots) {
    var x = byId[id]; if (!x) return;
    var d = x.d, ov = state.overrides, L = state.lists;
    var t = pool.find(function (k) { return k.i === x.i && k.slot === slots[0]; });
    var title = t ? taskTitle(x, t) : 'Görev';
    var defFor = function (s) {
      if (s >= 9) return 'sabah personeli';
      if (s === 7) return S(d.tasiyan) ? 'taşıyan: ' + d.tasiyan : (S(d.personel) ? 'ilgilenen: ' + d.personel : 'boş');
      return S(d.personel) ? 'ilgilenen: ' + d.personel : 'boş';
    };
    var group = function (s, label) {
      var key = d.id + '|' + s, has = Object.prototype.hasOwnProperty.call(ov, key), cur = has ? S(ov[key]) : null;
      var opt = function (val, text, sub, on, wide) {
        return '<label class="popt' + (on ? ' on' : '') + (wide ? ' wide' : '') + '"><input type="radio" name="s' + s + '" value="' + h(val) + '"' + (on ? ' checked' : '') + '>' + h(text) + (sub ? ' <span class="s">' + h(sub) + '</span>' : '') + '</label>';
      };
      return (label ? '<div class="lbl" style="margin-top:12px">' + h(label) + '</div>' : '') + '<div class="popts">' +
        L.personel.map(function (p) { return opt(p, p, '', has && eqi(cur, p)); }).join('') +
        opt('\u0000', 'Atanmamış', '', has && cur === '') +
        opt('\u0001', 'Varsayılan', defFor(s), !has, true) + '</div>';
    };
    var two = slots.length === 2;
    openSheet('<h3>Personel ata</h3><div class="sub">' + h(title) + '\n' + h((d.hk ? d.hk + ' · ' : '') + d.ad) + (t ? '\n' + h(dateLong(t.date)) : '') + '</div>' +
      '<form id="pform">' + (two ? group(slots[0], 'Sabah') + group(slots[1], 'Akşam') : group(slots[0])) +
      (two ? '<div class="btns" style="margin-top:12px"><button type="button" class="btn" data-act="closeSheet">Vazgeç</button><button class="btn pri">Kaydet</button></div>' : '') + '</form>');
    var form = $('#pform');
    form.addEventListener('change', function () { form.querySelectorAll('.popt').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); });
    var apply = function () {
      slots.forEach(function (s) {
        var r = form.querySelector('[name=s' + s + ']:checked'); if (!r) return;
        var key = d.id + '|' + s;
        if (r.value === '\u0001') delete ov[key]; else if (r.value === '\u0000') ov[key] = ''; else ov[key] = r.value;
      });
      closeSheet(); commit(); toast('Personel kaydedildi');
    };
    if (two) form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
    else form.addEventListener('change', apply);
  }

  /* ---------------- Planlama ---------------- */
  var PLAN_TITLES = { takvim: 'Takvim', program: 'Çalışma Programı', haftalik: 'Haftalık Program', hplan: 'Haftalık Plan', ajanda: 'Ajanda', uyarilar: 'Görev Listesi', ek: 'Ek görevler' };
  function scrPlan(tab) {
    var body = tab === 'program' ? planProgram() : tab === 'uyarilar' ? planAlerts() : tab === 'ek' ? planEk() : tab === 'haftalik' ? planWeek() : tab === 'hplan' ? planHPlan() : tab === 'ajanda' ? planAjanda() : planCalendar();
    return { title: PLAN_TITLES[tab] || 'Planlama', html: '<div class="page flush">' + groupSeg('planlama', '/plan/' + (tab === 'ek' ? 'program' : tab)) + body + '</div>' };
  }
  function planCalendar() {
    if (ui.calY == null) { var p0 = DT.parts(today); ui.calY = p0.y; ui.calM = p0.m; }
    if (ui.calSel == null) ui.calSel = today;
    var first = DT.serial(ui.calY, ui.calM, 1), start = DT.weekStart(first), next = DT.serial(ui.calY, ui.calM + 1, 1);
    var tasks = DT.calendarTasks(pool, D, start, start + 42, ui.calP);
    var byDay = {}; tasks.forEach(function (t) { (byDay[t.date] = byDay[t.date] || []).push(t); });
    var mt = tasks.filter(function (t) { return t.date >= first && t.date < next; });
    var c = function (fn) { return mt.filter(fn).length; };
    var html = '<div class="calhead"><button class="icon" data-act="calMove" data-v="-1" aria-label="Önceki ay">' + I.left + '</button><div class="m">' + DT.AYLAR[ui.calM - 1] + ' ' + ui.calY + '</div>' +
      '<button class="icon" data-act="calMove" data-v="1" aria-label="Sonraki ay">' + I.right + '</button></div>' +
      '<div class="toolbar"><select class="inp" data-ui="calP">' + persOptions(ui.calP, 'Herkes') + '</select><button class="btn sm" data-act="calToday">Bugün</button></div>' +
      '<div class="summary">Bu ay · ' + c(function (t) { return t.slot === 1; }) + ' sağlık kontrolü · ' + c(function (t) { return t.kind === 'asi'; }) + ' aşı · ' +
      c(function (t) { return t.slot === 8; }) + ' yatış · ' + c(function (t) { return t.slot === 6; }) + ' toplama</div>' +
      '<div class="cal">' + ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(function (g) { return '<div class="wd">' + g + '</div>'; }).join('');
    for (var k = 0; k < 42; k++) {
      var s = start + k, list = byDay[s] || [], p = DT.parts(s);
      var cls = 'day' + (p.m !== ui.calM ? ' out' : '') + (holMap[s] ? ' hol' : '') + (s === today ? ' today' : '') + (s === ui.calSel ? ' sel' : '');
      html += '<button class="' + cls + '" data-act="calDay" data-v="' + s + '"><span class="num">' + p.d + '</span><span class="dots">' +
        list.slice(0, 6).map(function (t) { return '<i class="dot k-' + t.kind + '"></i>'; }).join('') + '</span>' +
        (list.length ? '<span class="more">' + list.length + ' görev</span>' : '') + '</button>';
    }
    html += '</div><div class="legend"><span><i class="k-sk"></i>Sağlık kontrolü</span><span><i class="k-asi"></i>Aşı</span><span><i class="k-top"></i>Toplama</span><span><i class="k-tas"></i>Ürün taşıma</span><span><i class="k-yat"></i>Hastane yatış</span><span><i style="background:#f3c9c9"></i>Resmi tatil</span></div>';
    var sel = ui.calSel, selList = byDay[sel] || DT.calendarTasks(pool, D, sel, sel + 1, ui.calP);
    html += '<div class="sec-title">' + h(dateLong(sel)) + (holMap[sel] ? ' · <span style="color:var(--red)">' + h(holMap[sel]) + '</span>' : '') + '</div><div class="card">' +
      (selList.length ? selList.map(function (t) { return taskCard(t); }).join('') : emptyBox('Bu gün için görev yok', ui.calP ? ui.calP + ' için' : '')) + '</div>' +
      '<button class="btn block" data-act="progFor" data-v="' + sel + '">' + I.wa + 'Bu günün çalışma programı</button>';
    return html;
  }
  function planProgram() {
    if (ui.progDate == null) ui.progDate = today + 1;
    var s = ui.progDate, prog = DT.program(state, D, pool, s);
    var dayTasks = DT.calendarTasks(pool, D, s, s + 1, '');
    var ek = state.ekGorevler.filter(function (e) { return e.tarih === s; });
    var unassigned = dayTasks.filter(function (t) { return !(t.slot === 7 && t.yd) && !D[t.i].pers[t.slot]; }).length;
    var html = '<div class="datebar"><button class="icon" data-act="progMove" data-v="-1">' + I.left + '</button><input class="inp" type="date" value="' + DT.iso(s) + '" data-ui="progDate" data-type="date">' +
      '<button class="icon" data-act="progMove" data-v="1">' + I.right + '</button></div>' +
      '<div class="row wrap" style="margin-bottom:10px;gap:6px"><button class="chip' + (s === today ? ' on' : '') + '" data-act="progSet" data-v="' + today + '">Bugün</button><button class="chip' + (s === today + 1 ? ' on' : '') + '" data-act="progSet" data-v="' + (today + 1) + '">Yarın</button>' +
      '<span class="small muted grow right">' + h(gunAd(s)) + (holMap[s] ? ' · ' + h(holMap[s]) : '') + '</span></div>' +
      (unassigned ? '<div class="issues"><b>' + unassigned + ' görevde personel atanmamış</b>Aşağıdaki listeden atayabilirsiniz.</div>' : '') +
      '<div class="card pad"><div class="prog">' + h(prog.text) + '</div><div class="btns" style="margin-top:12px"><button class="btn" data-act="copyProg">' + I.copy + 'Kopyala</button><button class="btn wa" data-act="shareProg" data-wa="1">' + I.wa + 'WhatsApp</button><button class="btn" data-act="shareProg">' + I.share + 'Paylaş</button></div>' +
      '<button class="btn block outlook" data-act="mailProg" style="margin-top:8px">' + I.mail + 'Outlook ile e-posta gönder</button></div>' +
      '<div class="sec-title">Görev atamaları (' + dayTasks.length + ')</div><div class="card">' + (dayTasks.length ? dayTasks.map(function (t) { return taskCard(t); }).join('') : emptyBox('Bu gün için takvim görevi yok')) + '</div>' +
      '<div class="sec-title">Ek görevler (' + ek.length + ')</div><div class="card">' + (ek.length ? ek.map(ekRow).join('') : emptyBox('Ek görev yok', 'Takvimde olmayan işler (ek konsültasyon vb.) için ekleyin.')) + '</div>' +
      '<div class="btns"><button class="btn" data-act="ekNew" data-v="' + s + '">' + I.plus + 'Ek görev ekle</button><button class="btn" data-act="goto" data-h="/plan/ek">Tüm ek görevler</button></div>' +
      '<div class="note" style="margin:8px 4px">Ek konsültasyonlar Takip › Ek Konsültasyon’dan, saatli notlar Ajanda’dan (DURUM: PROGRAMA EKLE) programa yazılır.</div>';
    return html;
  }
  function alertRow(a) {
    var x = a.x, d = x.d;
    return '<div class="trow" data-act="donor" data-id="' + h(d.id) + '"><div class="h"><span class="name">' + h(d.ad) + '</span><span class="pillx ' + (a.onem === 1 ? 'p-red' : 'p-or') + '">' + (a.onem === 1 ? 'YÜKSEK' : 'ORTA') + '</span></div>' +
      '<div class="small" style="margin-top:3px">' + h(a.text) + '</div>' +
      '<dl class="kv"><dt>Tarih</dt><dd>' + h(dateLong(a.date)) + '</dd><dt>Hasta kodu</dt><dd>' + h([d.hk, d.dno].filter(Boolean).join(' · ')) + '</dd>' +
      '<dt>Hastane</dt><dd>' + h(d.hastane) + '</dd><dt>İkamet</dt><dd>' + h(d.ikamet) + '</dd>' + (d.tel ? '<dt>Telefon</dt><dd>' + h(d.tel) + '</dd>' : '') +
      '<dt>Personel</dt><dd>' + h(a.pers || '—') + '</dd></dl></div>';
  }
  function planAlerts() {
    var base = ui.alBase == null ? today : ui.alBase;
    var al = DT.alerts(D, base, ui.alP);
    var groups = [[1, 'Aşı başlangıcı'], [2, 'Sağlık kontrolü'], [3, 'Toplama ve ürün taşıma']];
    var html = '<div class="toolbar"><input class="inp" type="date" value="' + DT.iso(base) + '" data-ui="alBase" data-type="date" style="flex:1"><select class="inp" data-ui="alP">' + persOptions(ui.alP, 'Herkes') + '</select></div>' +
      '<div class="summary">Geri sayım uyarıları · ' + al.length + ' uyarı · ' + (base === today ? 'bugün' : DT.fmt(base)) + ' itibarıyla. Ankara dışı donörde 10 gün, Ankara içinde 5 gün önceden.</div>';
    if (!al.length) return html + '<div class="card">' + emptyBox('Şu an uyarı yok') + '</div>';
    groups.forEach(function (g) {
      var list = al.filter(function (a) { return g[0] === 3 ? a.grp >= 3 : a.grp === g[0]; });
      if (!list.length) return;
      html += '<div class="sec-title">' + g[1] + ' (' + list.length + ')</div><div class="card">' + list.map(alertRow).join('') + '</div>';
    });
    return html;
  }
  function ekRow(e) {
    var x = null;
    D.some(function (y) { if (S(e.hastaKodu) && eqi(y.d.hk, e.hastaKodu)) { x = y; return true; } return false; });
    return '<div class="trow" data-act="ekEdit" data-id="' + h(e.id) + '"><div class="h"><span class="name">' + h(e.islem || '(işlem yok)') + '</span><span class="pillx p-pri">' + h(e.tarih != null ? DT.fmt(e.tarih) : 'tarih yok') + '</span></div>' +
      '<div class="small muted">' + h([e.hastaKodu, x ? x.d.ad : '', e.personel || 'Personel atanmamış'].filter(Boolean).join(' · ')) + '</div></div>';
  }
  function planEk() {
    var list = state.ekGorevler.slice().filter(function (e) { return ui.ekPast || e.tarih == null || e.tarih >= today; })
      .sort(function (a, b) { return (a.tarih || 0) - (b.tarih || 0); });
    return '<div class="summary">Takvimde olmayan işler (ek konsültasyon vb.). Seçilen günün Çalışma Programı’nda personelin altında yazılır.</div>' +
      '<label class="check small"><input type="checkbox" data-ui="ekPast"' + (ui.ekPast ? ' checked' : '') + '> Geçmiş tarihlileri de göster</label>' +
      '<div class="card">' + (list.length ? list.map(ekRow).join('') : emptyBox('Ek görev yok')) + '</div>' +
      '<button class="fab" data-act="ekNew" aria-label="Ek görev ekle">' + I.plus + '</button>';
  }
  function ekForm(e) {
    var isNew = !e;
    e = e || { id: DT.uid(), tarih: ui.progDate || today + 1, personel: '', hastaKodu: '', islem: '' };
    var codes = state.donors.filter(function (d) { return S(d.hk) && (d.top == null || d.top >= today - 30); }).slice(-300).reverse();
    openSheet('<h3>' + (isNew ? 'Ek görev ekle' : 'Ek görevi düzenle') + '</h3><form id="ekform">' +
      '<div class="field"><label>Tarih</label><input class="inp" type="date" name="tarih" value="' + DT.iso(e.tarih) + '" required></div>' +
      '<div class="field"><label>Personel</label><select class="inp" name="personel">' + persOptions(e.personel, '— atanmamış —') + '</select></div>' +
      '<div class="field"><label>Hasta kodu</label><input class="inp" name="hastaKodu" list="hkodlar" value="' + h(e.hastaKodu) + '" autocapitalize="characters" placeholder="ör. KK37754P"><datalist id="hkodlar">' +
      codes.map(function (d) { return '<option value="' + h(d.hk) + '">' + h(d.ad) + '</option>'; }).join('') + '</datalist><div class="hint">Donör kaydında varsa ad, telefon ve hastane programa kendiliğinden yazılır.</div></div>' +
      '<div class="field"><label>İşlem</label><input class="inp" name="islem" value="' + h(e.islem) + '" placeholder="ör. ' + h(state.lists.prog.EkKons || 'EK KONSÜLTASYON') + '" autocapitalize="characters"></div>' +
      '<div class="btns">' + (isNew ? '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>' : '<button type="button" class="btn danger" id="ekDel">Sil</button>') + '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#ekform');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = { id: e.id, tarih: DT.fromIso(f.tarih.value), personel: f.personel.value, hastaKodu: upperTR(f.hastaKodu.value.trim()), islem: upperTR(f.islem.value.trim()) };
      if (o.tarih == null) { toast('Tarih seçin'); return; }
      if (!o.hastaKodu && !o.islem) { toast('Hasta kodu ya da işlem girin'); return; }
      var k = state.ekGorevler.findIndex(function (z) { return z.id === e.id; });
      if (k >= 0) state.ekGorevler[k] = o; else state.ekGorevler.push(o);
      closeSheet(); commit(); toast('Kaydedildi');
    });
    var del = $('#ekDel');
    if (del) del.onclick = function () { state.ekGorevler = state.ekGorevler.filter(function (z) { return z.id !== e.id; }); closeSheet(); commit(); toast('Silindi'); };
  }

  /* ---------------- Takip ---------------- */
  var TKTABS = [['saglik', 'Sağlık kontrolü'], ['asi', 'Aşı'], ['toplama', 'Toplama'], ['tasima', 'Ürün taşıma'], ['sonizlem', 'Son izlem'], ['idm', 'IDM']];
  function scrTakip(tab) {
    var seg = groupSeg('takip', '/takip/' + tab);
    if (tab === 'ekkons') return { title: 'Ek Konsültasyon', html: '<div class="page flush">' + seg + takipKons() + '</div>' };
    var TT = { saglik: 'Sağlık Kontrolü Takip', asi: 'Aşı Takip', toplama: 'Toplama Takip', tasima: 'Ürün Taşıma', sonizlem: 'Son İzlem Takip', idm: 'IDM' };
    var pLabel = tab === 'idm' ? 'Tüm ilgilenenler' : tab === 'tasima' ? 'Tüm taşıyanlar' : tab === 'sonizlem' ? 'Tüm takip edenler' : 'Herkes';
    var html = '<div class="page flush">' + seg + '<div class="toolbar"><select class="inp" data-ui="tkP">' + persOptions(ui.tkP, pLabel) + '</select></div>';
    var f = ui.tkP, t = today, head = 'Bugün: ' + DT.fmt(t) + ' (' + gunAd(t) + ')';
    var rows, body = '';
    var name = function (x) { return '<div class="h"><span class="name">' + h(x.d.ad) + '</span>'; };
    var tail = function (x) { return '<dt>Hasta kodu</dt><dd>' + h([x.d.hk, x.d.dno].filter(Boolean).join(' · ')) + '</dd>'; };
    var tel = function (x) { return x.d.tel ? '<dt>Telefon</dt><dd>' + h(x.d.tel) + '</dd>' : ''; };
    if (tab === 'saglik') {
      rows = DT.listSaglik(D, t, f, state.lists);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' bugün · ' + rows.filter(function (r) { return r.date > t && r.date <= t + 7; }).length + ' önümüzdeki 7 günde';
      body = rows.map(function (r) {
        var x = r.x, diff = r.date - t, ank = x.ankara === 1;
        var cls = r.durum === 2 ? 'p-sk' : (!ank && x.ankara === 0 && diff <= 10) ? 'p-red' : (ank && diff <= 5) ? 'p-or' : 'p-grey';
        var txt = r.durum === 2 ? 'BUGÜN SAĞLIK KONTROLÜ' : diff === 1 ? 'Yarın' : diff + ' gün sonra';
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + cls + '">' + txt + '</span></div><dl class="kv">' +
          '<dt>Tarih</dt><dd' + (isOffDay(r.date) ? ' style="color:var(--orange);font-weight:600"' : '') + '>' + h(dateLong(r.date)) + (holMap[r.date] ? ' · ' + h(holMap[r.date]) : '') + '</dd>' + tail(x) +
          '<dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd><dt>İkamet</dt><dd>' + h(x.d.ikamet) + (x.ankara === 1 ? ' · Ankara içi' : x.ankara === 0 ? ' · Ankara dışı' : '') + '</dd>' + tel(x) +
          ((x.d.ulasim || x.d.konaklama) ? '<dt>Ulaşım</dt><dd>' + h([x.d.ulasim, x.d.konaklama].filter(Boolean).join(' · ')) + '</dd>' : '') +
          (r.kargo ? '<dt>Kargo</dt><dd>' + h(r.kargo) + '</dd>' : '') + '<dt>Personel</dt><dd>' + h(r.pers || '—') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Bugün ya da sonrasında sağlık kontrolü olan donör yok.');
    } else if (tab === 'asi') {
      rows = DT.listAsi(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' aşıda · ' + rows.filter(function (r) { return r.durum === 1; }).length + ' başlayacak · ' + rows.filter(function (r) { return r.durum === 3; }).length + ' toplama bekliyor';
      body = rows.map(function (r) {
        var x = r.x, days = '';
        for (var k = 0; k < 4; k++) { var s = r.bas + k; days += '<span class="' + (s < t ? 'done' : s === t ? 'now' : '') + '">' + (k + 1) + '. ' + DT.fmtShort(s) + '</span>'; }
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 2 ? 'p-asi' : r.durum === 3 ? 'p-top' : 'p-grey') + '">' + h(r.text) + '</span></div>' +
          '<div class="days4">' + days + '</div><dl class="kv">' + tail(x) + '<dt>Hastane</dt><dd>' + h(x.d.hastane) + (x.sabahAksam ? ' · sabah-akşam' : '') + '</dd>' +
          '<dt>Toplama</dt><dd>' + (x.d.top != null ? h(dateLong(x.d.top)) : '—') + '</dd>' + tel(x) + '<dt>Personel</dt><dd>' + h(r.pers || '—') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Aşı takibi yapılacak donör yok.');
    } else if (tab === 'toplama') {
      rows = DT.listToplama(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' toplama bugün · ' + rows.filter(function (r) { return r.date > t && r.date <= t + 7; }).length + ' önümüzdeki 7 günde';
      body = rows.map(function (r) {
        var x = r.x;
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 2 ? 'p-top' : 'p-grey') + '">' + h(r.text) + '</span></div><dl class="kv">' +
          '<dt>Tarih</dt><dd' + (isOffDay(r.date) ? ' style="color:var(--orange);font-weight:600"' : '') + '>' + h(dateLong(r.date)) + (holMap[r.date] ? ' · ' + h(holMap[r.date]) : '') + '</dd>' + tail(x) +
          '<dt>Yöntem</dt><dd>' + h(x.d.yontem) + '</dd><dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd><dt>Nakil merkezi</dt><dd>' + h(x.d.bolge || '—') + '</dd>' + tel(x) +
          '<dt>Personel</dt><dd>' + h(r.pers || '—') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Bugün ya da sonrasında toplaması olan donör yok.');
    } else if (tab === 'tasima') {
      rows = DT.listTasima(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' taşıma bugün · ' + rows.filter(function (r) { return r.durum === 1; }).length + ' yaklaşan taşıma';
      body = rows.map(function (r) {
        var x = r.x;
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 2 ? 'p-tas' : 'p-grey') + '">' + h(r.text) + '</span></div><dl class="kv">' +
          '<dt>Tarih</dt><dd>' + h(dateLong(r.date)) + '</dd>' + tail(x) + '<dt>Eşleştirme</dt><dd>' + h(r.eslesme) + '</dd><dt>Şehir</dt><dd>' + h(x.sehir || '—') + '</dd>' +
          '<dt>Taşıyan</dt><dd>' + h(r.pers || '—') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Bugün ya da sonrasında taşıması olan ürün yok.');
      var years = yearsInData();
      var mx = DT.tasimaMatrix(state, D, ui.utYil ? +ui.utYil : null);
      body = '<div class="card">' + body + '</div><div class="sec-title">Hastane → nakil merkezi bölgesi</div><div class="card pad"><div class="toolbar"><select class="inp" data-ui="utYil"><option value="">Tüm yıllar</option>' +
        years.map(function (y) { return '<option' + (String(y) === String(ui.utYil) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
        (mx.cols.length ? '<div class="tscroll"><table class="t"><tr><th>Hastane</th>' + mx.cols.map(function (c) { return '<th style="white-space:normal;min-width:84px">' + h(c) + '</th>'; }).join('') + '<th>Toplam</th></tr>' +
          mx.rows.map(function (r) { return '<tr><td>' + h(r.hastane) + '</td>' + r.cells.map(function (v) { return '<td>' + (v || '') + '</td>'; }).join('') + '<td><b>' + r.toplam + '</b></td></tr>'; }).join('') + '</table></div>' : emptyBox('Veri yok')) +
        '<div class="note">En çok ürün giden 8 nakil merkezi gösterilir. Yurt dışı ve süreci durmuş kayıtlar hariç.</div></div>';
      return { title: TT[tab], html: html + '<div class="summary">' + h(head) + '</div>' + body + '</div>' };
    } else if (tab === 'sonizlem') {
      rows = DT.listSonIzlem(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' son izlem bugün · ' + rows.filter(function (r) { return r.date > t && r.date <= t + 7; }).length + ' önümüzdeki 7 günde';
      body = rows.map(function (r) {
        var x = r.x;
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 2 ? 'p-sk' : 'p-grey') + '">' + h(r.text) + '</span></div><dl class="kv">' +
          '<dt>Son izlem</dt><dd>' + h(dateLong(r.date)) + (r.gun ? ' · toplamadan ' + h(r.gun) : '') + '</dd><dt>Toplama</dt><dd>' + (x.d.top != null ? h(DT.fmt(x.d.top)) : '—') + '</dd>' + tail(x) +
          '<dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd>' + tel(x) + '<dt>Takip eden</dt><dd>' + h(r.pers || 'Atanmamış') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Bugün ya da sonrasında son izlemi olan donör yok.');
    } else {
      rows = DT.listIdm(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 1; }).length + ' donörde IDM sürüyor · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' başlayacak';
      body = rows.map(function (r) {
        var x = r.x;
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 1 ? 'p-yat' : r.durum === 3 ? 'p-or' : 'p-grey') + '">' + h(r.text) + '</span></div><dl class="kv">' +
          '<dt>IDM</dt><dd>' + h(DT.fmt(x.d.idmBas) || '—') + ' – ' + h(DT.fmt(x.d.idmBit) || '—') + (r.sure ? ' · ' + h(r.sure) : '') + '</dd><dt>Toplama</dt><dd>' + (x.d.top != null ? h(DT.fmt(x.d.top)) : '—') + '</dd>' + tail(x) +
          '<dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd><dt>İlgilenen</dt><dd>' + h(r.pers || 'Atanmamış') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('IDM işaretli donör yok.', 'Donör kaydında IDM ✓ işaretleyip tarih aralığını girin.');
    }
    return { title: TT[tab], html: html + '<div class="summary">' + h(head) + '</div><div class="card">' + body + '</div></div>' };
  }
  function yearsInData() {
    var ys = {};
    state.donors.forEach(function (d) { if (d.top != null) ys[DT.year(d.top)] = 1; if (d.sk != null) ys[DT.year(d.sk)] = 1; });
    ys[DT.year(today)] = 1;
    return Object.keys(ys).map(Number).sort(function (a, b) { return b - a; });
  }

  /* ---------------- Dashboard ---------------- */
  function tbl(head, rows, totRow) {
    return '<div class="tscroll"><table class="t"><tr>' + head.map(function (x) { return '<th>' + h(x) + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r) { return '<tr>' + r.map(function (v, i) { return '<td>' + (i === 0 ? h(v) : h(num(v))) + '</td>'; }).join('') + '</tr>'; }).join('') +
      (totRow ? '<tr class="tot">' + totRow.map(function (v, i) { return '<td>' + (i === 0 ? h(v) : h(num(v))) + '</td>'; }).join('') + '</tr>' : '') + '</table></div>';
  }
  // opt: { fmt: eksen yazısı, full: etiketler kısaltılmasın }
  function barChart(labels, series, colors, names, opt) {
    opt = opt || {};
    var W = 340, H = 150, pad = opt.fmt ? 34 : 22, n = labels.length, max = 1, fmt = opt.fmt || Math.round;
    series.forEach(function (s) { s.forEach(function (v) { if (v > max) max = v; }); });
    var gw = (W - pad) / n, bw = Math.max(3, (gw - 6) / series.length);
    // açıklamalar (legend) satıra sığdığı kadar yan yana
    var leg = [], lx = pad, ly = 0;
    names.forEach(function (nm) { var w = 24 + S(nm).length * 5.6; if (lx + w > W && lx > pad) { lx = pad; ly++; } leg.push([lx, ly]); lx += w; });
    var legRows = ly + 1;
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 18 + legRows * 14) + '" role="img">';
    [0, .5, 1].forEach(function (f) { var y = H - f * (H - 12); svg += '<line x1="' + pad + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#e3e7eb"/><text x="' + (pad - 4) + '" y="' + (y + 3) + '" font-size="9" text-anchor="end" fill="#7b8794">' + h(fmt(max * f)) + '</text>'; });
    labels.forEach(function (l, i) {
      series.forEach(function (s, k) {
        var v = s[i] || 0, bh = v / max * (H - 12), x = pad + i * gw + 3 + k * bw;
        svg += '<rect x="' + x.toFixed(1) + '" y="' + (H - bh).toFixed(1) + '" width="' + (bw - 1).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5" fill="' + colors[k] + '"><title>' + h(l + ' · ' + names[k] + ': ' + v) + '</title></rect>';
      });
      svg += '<text x="' + (pad + i * gw + gw / 2).toFixed(1) + '" y="' + (H + 12) + '" font-size="9" text-anchor="middle" fill="#4a5764">' + h(opt.full ? l : l.slice(0, 3)) + '</text>';
    });
    svg += names.map(function (nm, k) {
      var x = leg[k][0], y = H + 20 + leg[k][1] * 14;
      return '<rect x="' + x + '" y="' + y + '" width="9" height="9" rx="2" fill="' + colors[k] + '"/><text x="' + (x + 13) + '" y="' + (y + 8) + '" font-size="10" fill="#4a5764">' + h(nm) + '</text>';
    }).join('');
    return svg + '</svg>';
  }
  function scrDash() {
    if (ui.dashYil == null) ui.dashYil = DT.year(today);
    var Y = ui.dashYil ? +ui.dashYil : '', R = DT.dashboard(state, D, pool, { today: today, year: Y, esik: state.settings.esik, month: ui.dashAy ? +ui.dashAy : null });
    var years = yearsInData();
    var card = function (title, inner, note) { return '<div class="card pad"><h2>' + h(title) + '</h2>' + inner + (note ? '<div class="note">' + h(note) + '</div>' : '') + '</div>'; };
    var kpi = function (n, l) { return '<div class="kpi"><div class="n">' + h(n) + '</div><div class="l">' + h(l) + '</div></div>'; };
    var html = '<div class="page flush">' + groupSeg('dashboard', '/dashboard') + '<div class="toolbar"><select class="inp" data-ui="dashYil"><option value="">Tüm yıllar</option>' + years.map(function (y) { return '<option' + (String(y) === String(ui.dashYil) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="summary">Dönem: ' + (Y || 'tüm yıllar') + ' · Toplama sayılarına süreci durmuş (iptal, erteleme, red, vazgeç, hasta ex) kayıtlar dahil değildir.</div>' +
      '<div class="kpis">' + kpi(num(R.kayitli), 'Kayıtlı donör') + kpi(num(R.skYap), 'Sağlık kontrolü yapılan') + kpi(num(R.topGer), 'Toplama gerçekleşen') +
      kpi(num(R.topPlan), 'Planlanan toplama') + kpi(num(R.durdu), 'Süreç durdu') + kpi(pct(R.oran), 'Gerçekleşme oranı') + '</div>';
    html += card('Şehir içi / şehir dışı', tbl(['', 'Sağlık kontrolü', 'Toplama'], [['Ankara içi', R.skAnk, R.topAnk], ['Ankara dışı', R.skDis, R.topDis]]), 'İKAMETİ’nde “Ankara” geçen donör şehir içi sayılır.');
    html += card('Toplama gerçekleşme', tbl(['Durum', 'Donör'], [['Gerçekleşen', R.topGer], ['Planlanan', R.topPlan], ['İptal · hasta ex', R.iptal], ['Erteleme', R.ertele], ['Red', R.red], ['Vazgeçme', R.vazgec], ['Gerçekleşme oranı', pct(R.oran)]]), 'Bir açıklamada birden fazla kelime varsa her biri ayrı sayılır.');
    html += card('Aylık toplama · ' + R.gy, barChart(DT.AYLAR, [R.aylik.map(function (m) { return m.ger; }), R.aylik.map(function (m) { return m.plan; })], ['#15803d', '#86c79c'], ['Gerçekleşen', 'Planlanan']) +
      tbl(['Ay', 'Gerçekleşen', 'Planlanan'], R.aylik.map(function (m) { return [m.ad, m.ger, m.plan]; })));
    var il = R.iller.slice(0, 15);
    html += card('Sağlık kontrolü · il bazlı', il.length ? tbl(['İl', 'Yapılan', 'Planlanan', 'Toplam'], il.map(function (r) { return [r.il, r.yap, r.plan, r.yap + r.plan]; })) : emptyBox('Sağlık kontrolü kaydı yok.'), R.iller.length > 15 ? '+' + (R.iller.length - 15) + ' il daha' : '');
    html += card('Hastane bazlı', tbl(['Hastane', 'Sağlık k. yapılan', 'Toplama gerç.'], R.hastane.map(function (r) { return [r.ad, r.sk, r.top]; })));
    html += card('Yöntem · ulaşım · konaklama', tbl(['Yöntem', 'Donör'], R.yontem.map(function (r) { return [r.ad, r.n]; })) + '<div class="hr"></div>' +
      tbl(['Ulaşım türü', 'Donör'], R.ulasim.map(function (r) { return [r.ad, r.n]; })) + '<div class="hr"></div>' + tbl(['Konaklama', 'Donör'], R.konaklama.map(function (r) { return [r.ad, r.n]; })),
      'Donörün toplama yılına (yoksa sağlık kontrolü yılına) göre sayılır.');
    var nk = R.nakil;
    html += card('Nakil merkezi · yurt içi / yurt dışı', tbl(['', 'Gerçekleşen', 'Planlanan'], [['Yurt içi', nk.yiGer, nk.yiPlan], ['Yurt dışı', nk.ydGer, nk.ydPlan], ['Girilmemiş', nk.yokGer, nk.yokPlan],
      ['Yurt dışı oranı', pct(nk.ydGer + nk.yiGer + nk.yokGer ? nk.ydGer / (nk.ydGer + nk.yiGer + nk.yokGer) : null), pct(nk.ydPlan + nk.yiPlan + nk.yokPlan ? nk.ydPlan / (nk.ydPlan + nk.yiPlan + nk.yokPlan) : null)]]) +
      (R.ulkeler.length ? '<div class="hr"></div>' + tbl(['Ülke', 'Toplama'], R.ulkeler.map(function (u) { return [u.ad, u.n]; })) : ''), 'Ülke, NAKİL MERKEZİ’ndeki parantezden okunur: YURT DIŞI (ALMANYA - ZKRD).');
    var kt = R.kargo.reduce(function (a, k) { return [a[0] + k.tk, a[1] + k.ase]; }, [0, 0]);
    html += card('Kargo · ' + R.gy, tbl(['Ay', 'Turkish', 'ASE', 'Toplam'], R.kargo.map(function (k) { return [k.ad, k.tk, k.ase, k.tk + k.ase]; }), ['Toplam', kt[0], kt[1], kt[0] + kt[1]]),
      'Yurt dışı nakil merkezli donörün hafta içi sağlık kontrolü günü (gün başına bir kargo): Pzt, Çar, Cuma Turkish · Salı, Perş. ASE.');
    html += card('Süreç süresi · sağlık kontrolünden toplamaya', tbl(['Hastane', 'Toplama', 'Ort. gün', 'En kısa', 'En uzun'], R.sureHastane.map(function (s) { return [s.ad, s.n, s.ort, s.min, s.max]; }), ['Tümü', R.sureTum.n, R.sureTum.ort, R.sureTum.min, R.sureTum.max]) +
      '<div class="row" style="margin-top:10px"><span class="small grow">Uzun süreç eşiği (gün)</span><input class="inp" type="number" min="1" style="width:90px" value="' + h(R.esik) + '" data-act-change="esik"></div>' +
      '<div class="small" style="margin-top:6px"><b>' + R.esikAsan + '</b> süreç bu eşiği aştı.</div><div class="hr"></div>' +
      tbl(['Ay (' + R.gy + ')', 'Ort. gün', 'Toplama'], R.sureAylik.map(function (s) { return [s.ad, s.ort == null ? '' : s.ort, s.n]; })));
    var nt = R.nedenler.reduce(function (a, n) { return a + n.n; }, 0);
    html += card('Süreç durma nedenleri', tbl(['Neden', 'Donör', 'Pay'], R.nedenler.map(function (n) { return [n.ad, n.n, pct(nt ? n.n / nt : null)]; }), ['Toplam', nt, '']) + '<div class="hr"></div>' +
      tbl(['Ay (' + R.gy + ')', 'Durdu', 'Gerçekleşen', 'Durma oranı'], R.durmaAylik.map(function (m) { return [m.ad, m.durdu, m.ger, pct(m.oran)]; })),
      'Hasta: “hasta kaynaklı”, “hastası”, hasta ex · Nakil merkezi: “merkez” · Bağışçı sağlık: “red”, “muayene” · Vazgeçme: “bağışçı”, “vazgeç”.');
    var yk = R.yilKars;
    html += card('Yıl karşılaştırması · gerçekleşen toplama', barChart(DT.AYLAR, [yk.map(function (m) { return m.once; }), yk.map(function (m) { return m.bu || 0; })], ['#9fb3c8', '#0f4c5c'], [String(R.gy - 1), String(R.gy)]) +
      tbl(['Ay', String(R.gy - 1), String(R.gy), 'Fark'], yk.map(function (m) { return [m.ad, m.once, m.bu == null ? '' : m.bu, m.bu == null ? '' : m.bu - m.once]; })),
      'Yılbaşından ' + DT.parts(today).d + ' ' + DT.AYLAR[DT.parts(today).m - 1] + '’e: ' + (R.gy - 1) + ' → ' + R.ytd.once + ' · ' + R.gy + ' → ' + R.ytd.bu);
    html += card('Önümüzdeki 4 hafta · iş yükü', tbl(['Hafta', 'Sağlık k.', 'Aşı baş.', 'Toplama', 'Taşıma', 'Yatış', 'Toplam'], R.dortHafta.map(function (w, i) { return [DT.fmtShort(w.bas) + (i === 0 ? ' •' : ''), w.sk, w.asi, w.top, w.tas, w.yat, w.toplam]; })),
      '• bu hafta. Hafta başlangıcı (pazartesi) yazılıdır. Süreci durmuş donörler sayılmaz. Aşı başlangıcı = aşının 1. günü. Yurt dışı ürünleri sayılmaz.');
    html += card('Haftanın günlerine göre', tbl(['Gün', 'Sağlık kontrolü', 'Toplama'], R.gunler.map(function (g) { return [g.ad, g.sk, g.top]; })));
    var ikT = R.ikamet.reduce(function (a, r) { return a + r.donor; }, 0);
    html += card('İkamet · Ankara içi / dışı', tbl(['İkamet', 'Donör', 'Sağlık k.', 'Toplama', 'Pay'], R.ikamet.map(function (r) { return [r.ad, r.donor, r.sk, r.top, pct(ikT ? r.donor / ikT : null)]; })));
    var pa = R.persAy;
    var ayOpts = '<option value="">Bu ay</option>' + DT.AYLAR.map(function (a, i) { return '<option value="' + (i + 1) + '"' + (String(ui.dashAy) === String(i + 1) ? ' selected' : '') + '>' + a + '</option>'; }).join('');
    html += card('Personel iş yükü · ' + DT.AYLAR[pa.m - 1] + ' ' + pa.y, '<div class="toolbar"><select class="inp" data-ui="dashAy">' + ayOpts + '</select></div>' +
      tbl(['Personel', 'Sağlık k.', 'Aşı', 'Toplama', 'Taşıma', 'Toplam'], pa.rows.map(function (r) { return [r.ad, r.sk, r.asi, r.top, r.tas, r.sk + r.asi + r.top + r.tas]; })),
      'Görev günleri sayılır (aşı günü = 4 günün her biri; sabah-akşam ayrı). Ürün taşıma taşıyan personele yazılır.');
    var py = R.persYil;
    html += card('Personel iş yükü · ' + py.y, tbl(['Personel', 'SK', 'Aşı', 'Top.', 'Yatış', 'Taşıma', 'Ek kons.', 'Toplam', 'Yapılan', 'Plan.', 'Pay'], py.rows.map(function (r) { return [r.ad, r.sk, r.asi, r.top, r.yat, r.tas, r.ek, r.toplam, r.yapilan, r.plan, pct(r.pay)]; })) +
      '<div class="hr"></div>' + tbl(['Özet', 'Değer'], [['Toplam görev', py.toplam], ['Personele atanan', py.atanan], ['Atanma oranı', pct(py.oran)], ['Görev alan personel', py.aktif], ['Personel başına ortalama', py.ort == null ? '–' : py.ort], ['En çok görev alan', py.enCok], ['En az görev alan', py.enAz]]));
    html += card('Önümüzdeki 4 hafta · personel planı', tbl(['Personel'].concat(R.dortHafta.map(function (w) { return DT.fmtShort(w.bas); })).concat(['Toplam']), R.persHafta.map(function (r) { return [r.ad].concat(r.weeks).concat([r.toplam]); })));
    var dl = R.dli;
    html += card('DLİ', tbl(['', 'Donör', 'Pay'], [['DLİ kaydı', dl.kayit, pct(dl.kayitPay)], ['Toplama gerçekleşen', dl.ger, pct(dl.gerPay)], ['Planlanan toplama', dl.plan, pct(dl.planPay)], ['Süreç durdu', dl.durdu, pct(dl.durduPay)]]) +
      '<div class="hr"></div>' + tbl(['Hastane', 'DLİ kaydı', 'Toplama gerç.'], dl.hastane.map(function (r) { return [r.ad, r.kayit, r.ger]; })), 'AÇIKLAMA’da ayrı kelime olarak DLİ geçen kayıtlar.');
    html += '</div>';
    return { title: 'Dashboard', html: html };
  }

  /* ---------------- Haftalık Program ---------------- */
  function planWeek() {
    if (ui.weekStart == null) ui.weekStart = DT.weekStart(today);
    var ws = ui.weekStart, a = DT.parts(ws), b = DT.parts(ws + 6);
    var html = '<div class="datebar"><button class="icon" data-act="weekMove" data-v="-7">' + I.left + '</button><div class="inp center">' +
      a.d + ' ' + DT.AYLAR[a.m - 1] + ' – ' + b.d + ' ' + DT.AYLAR[b.m - 1] + ' ' + b.y + '</div><button class="icon" data-act="weekMove" data-v="7">' + I.right + '</button></div>' +
      '<div class="toolbar"><select class="inp" data-ui="hwP">' + persOptions(ui.hwP, 'Herkes') + '</select><button class="btn sm" data-act="weekNow">Bu hafta</button></div>';
    var total = 0, body = '';
    for (var k = 0; k < 7; k++) {
      var s = ws + k, p = DT.parts(s);
      var list = DT.calendarTasks(pool, D, s, s + 1, ui.hwP || '').filter(function (t) { return !(t.slot === 7 && t.yd); });
      total += list.length;
      body += '<div class="dayhead' + (s === today ? ' today' : '') + (holMap[s] ? ' hol' : '') + '"><span>' + pad2(p.d) + '.' + pad2(p.m) + '.' + p.y + ' (' + DT.GUNLER_B[k] + ') ÇALIŞMA PROGRAMIMIZ</span>' +
        (holMap[s] ? '<span class="tiny">' + h(holMap[s]) + '</span>' : '') + '<button class="btn sm ghost" data-act="progFor" data-v="' + s + '">Program</button></div>' +
        '<div class="card">' + (list.length ? list.map(function (t) { return taskCard(t); }).join('') : emptyBox('Bu gün için görev yok.')) + '</div>';
    }
    return html + '<div class="summary">' + total + ' görev' + (ui.hwP ? ' · ' + h(ui.hwP) : '') + ' · Personel düğmesinden göreve kişi atayın; seçim programa ve tüm sayfalara geçer. Yurt dışı ürün taşıma bu sayfada yer almaz.</div>' + body;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- Ajanda ---------------- */
  function planAjanda() {
    if (ui.ajDate == null) ui.ajDate = today;
    var s = ui.ajDate, p = DT.parts(s), cnt = pool.filter(function (t) { return t.date === s; }).length;
    var notes = state.ajanda.filter(function (a) { return a.tarih === s; });
    var html = '<div class="datebar"><button class="icon" data-act="ajMove" data-v="-1">' + I.left + '</button><input class="inp" type="date" value="' + DT.iso(s) + '" data-ui="ajDate" data-type="date">' +
      '<button class="icon" data-act="ajMove" data-v="1">' + I.right + '</button></div>' +
      '<div class="dayhead' + (s === today ? ' today' : '') + (holMap[s] ? ' hol' : '') + '"><span>' + p.d + ' ' + DT.AYLAR_B[p.m - 1] + ' ' + p.y + '  ·  ' + DT.GUNLER_B[DT.weekday(s) - 1] +
      (holMap[s] ? '  ·  ' + h(holMap[s]) : '') + (cnt ? '  ·  ' + cnt + ' görev' : '') + (s === today ? '  ·  BUGÜN' : '') + '</span>' + (s !== today ? '<button class="btn sm ghost" data-act="ajSet" data-v="' + today + '">Bugüne git</button>' : '') + '</div><div class="card agenda">';
    var row = function (saat, list) {
      return '<div class="arow"><div class="atime">' + (saat || 'Serbest') + '</div><div class="anotes">' + list.map(function (a) {
        var cls = a.durum === 'PROGRAMA EKLE' || a.durum === 'EVET' ? 'p-pri' : a.durum === 'YAPILDI' ? 'p-top' : a.durum === 'İPTAL' ? 'p-grey' : '';
        return '<button class="anote' + (a.durum === 'İPTAL' ? ' cancel' : '') + '" data-act="ajEdit" data-id="' + h(a.id) + '"><span class="at">' + h(a.not) + '</span><span class="am">' +
          (a.personel ? '<span class="pillx p-grey">' + h(a.personel) + '</span>' : '') + (a.durum ? '<span class="pillx ' + cls + '">' + h(a.durum) + '</span>' : '') +
          (a.tur ? '<span class="pillx p-or">' + h(a.tur) + '</span>' : '') + '</span></button>';
      }).join('') + '<button class="aadd" data-act="ajNew" data-saat="' + (saat || '') + '">' + I.plus + '</button></div></div>';
    };
    DT.AJANDA_SAATLER.forEach(function (h0) { html += row(h0, notes.filter(function (a) { return a.saat === h0; })); });
    html += row('', notes.filter(function (a) { return DT.AJANDA_SAATLER.indexOf(a.saat) < 0; }));
    html += '</div><div class="note" style="margin:8px 4px">Programa girmesini istediğiniz notta DURUM: PROGRAMA EKLE seçin (personel seçerseniz onun altına, seçmezseniz NOTLAR başlığı altına yazılır). Biten işi YAPILDI, vazgeçileni İPTAL yapın.</div>';
    var up = state.ajanda.filter(function (a) { return a.tarih > s && a.durum !== 'YAPILDI' && a.durum !== 'İPTAL'; }).sort(function (a, b) { return a.tarih - b.tarih || S(a.saat).localeCompare(S(b.saat)); }).slice(0, 8);
    if (up.length) html += '<div class="sec-title">Sonraki notlar</div><div class="card">' + up.map(function (a) {
      return '<div class="trow" data-act="ajEdit" data-id="' + h(a.id) + '"><div class="h"><span class="name">' + h(a.not) + '</span><span class="pillx p-pri">' + DT.fmtShort(a.tarih) + (a.saat ? ' ' + a.saat : '') + '</span></div>' +
        '<div class="small muted">' + h([a.personel, a.durum, a.tur].filter(Boolean).join(' · ') || '—') + '</div></div>';
    }).join('') + '</div>';
    return html;
  }
  function ajForm(a, saat) {
    var isNew = !a;
    a = a || { id: DT.uid(), tarih: ui.ajDate || today, saat: saat || '', not: '', personel: '', durum: 'PROGRAMA EKLE', tur: '' };
    var durs = ['', 'PROGRAMA EKLE', 'YAPILDI', 'İPTAL'];
    openSheet('<h3>' + (isNew ? 'Not ekle' : 'Notu düzenle') + '</h3><form id="ajform"><div class="grid2">' +
      '<div class="field"><label>Tarih</label><input class="inp" type="date" name="tarih" value="' + DT.iso(a.tarih) + '" required></div>' +
      '<div class="field"><label>Saat</label><select class="inp" name="saat"><option value="">Serbest</option>' + DT.AJANDA_SAATLER.map(function (x) { return '<option' + (x === a.saat ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label>Not</label><textarea class="inp" name="not" rows="2" autocapitalize="characters">' + h(a.not) + '</textarea></div>' +
      '<div class="grid2"><div class="field"><label>Personel</label><select class="inp" name="personel">' + persOptions(a.personel, '— (NOTLAR) —') + '</select></div>' +
      '<div class="field"><label>Durum</label><select class="inp" name="durum">' + durs.map(function (x) { return '<option value="' + x + '"' + (x === a.durum ? ' selected' : '') + '>' + (x || '—') + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label>Tür</label><select class="inp" name="tur">' + listOptions(state.lists.isTuru || [], a.tur, '—') + '</select></div>' +
      '<div class="btns">' + (isNew ? '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>' : '<button type="button" class="btn danger" id="ajDel">Sil</button>') + '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#ajform');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = { id: a.id, tarih: DT.fromIso(f.tarih.value), saat: f.saat.value, not: f.not.value.trim(), personel: f.personel.value, durum: f.durum.value, tur: f.tur.value };
      if (o.tarih == null || !o.not) { toast('Tarih ve not girin'); return; }
      var k = state.ajanda.findIndex(function (z) { return z.id === a.id; });
      if (k >= 0) state.ajanda[k] = o; else state.ajanda.push(o);
      closeSheet(); commit(); toast('Kaydedildi');
    });
    var del = $('#ajDel');
    if (del) del.onclick = function () { state.ajanda = state.ajanda.filter(function (z) { return z.id !== a.id; }); closeSheet(); commit(); toast('Silindi'); };
  }

  /* ---------------- Ek Konsültasyon ---------------- */
  function takipKons() {
    var t = today, list = state.ekKons.slice();
    var up = list.filter(function (e) { return e.tarih == null || e.tarih >= t; }).sort(function (a, b) { return (a.tarih || 9e9) - (b.tarih || 9e9); });
    var past = list.filter(function (e) { return e.tarih != null && e.tarih < t; }).sort(function (a, b) { return b.tarih - a.tarih; });
    var row = function (e) {
      var x = DT.konsDonor(D, e.hastaKodu), dur = DT.konsDurum(D, e, t), who = DT.konsPersonel(D, e);
      var cls = dur === 'BUGÜN' ? 'p-top' : dur.indexOf('Yapıldı') === 0 ? 'p-grey' : (dur.indexOf('yok') >= 0 || dur.indexOf('Tarih') === 0) ? 'p-red' : 'p-sk';
      return '<div class="trow" data-act="konsEdit" data-id="' + h(e.id) + '"><div class="h"><span class="name">' + h(x ? x.d.ad : e.hastaKodu || '—') + '</span><span class="pillx ' + cls + '">' + h(dur) + '</span></div><dl class="kv">' +
        '<dt>Tarih</dt><dd>' + (e.tarih != null ? h(dateLong(e.tarih)) : '—') + '</dd><dt>Hasta kodu</dt><dd>' + h([e.hastaKodu, x ? x.d.dno : ''].filter(Boolean).join(' · ')) + '</dd>' +
        (e.bolum ? '<dt>Bölüm</dt><dd>' + h(e.bolum) + '</dd>' : '') + (x ? '<dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd>' + (x.d.tel ? '<dt>Telefon</dt><dd>' + h(x.d.tel) + '</dd>' : '') + '<dt>Sağlık k.</dt><dd>' + h(DT.fmt(x.d.sk) || '—') + '</dd>' : '') +
        '<dt>Programda</dt><dd>' + h(who || 'PERSONEL ATANMAMIŞ') + (e.personel ? ' (değiştirildi)' : '') + '</dd></dl></div>';
    };
    var today0 = list.filter(function (e) { return e.tarih === t; }).length;
    return '<div class="summary">' + up.filter(function (e) { return e.tarih != null; }).length + ' yaklaşan konsültasyon · ' + today0 + ' bugün. Konsültasyon günü Çalışma Programı’nda sağlık kontrolüne bakan personelin altına “' + h(state.lists.prog.EkKons || 'EK KONSÜLTASYON') + '” olarak yazılır.</div>' +
      '<div class="card">' + (up.length ? up.map(row).join('') : emptyBox('Yaklaşan ek konsültasyon yok')) + '</div>' +
      (past.length ? '<div class="sec-title">Yapılanlar</div><div class="card">' + past.slice(0, 30).map(row).join('') + '</div>' : '') +
      '<button class="fab" data-act="konsNew" aria-label="Ek konsültasyon ekle">' + I.plus + '</button>';
  }
  function konsForm(e) {
    var isNew = !e;
    e = e || { id: DT.uid(), hastaKodu: '', tarih: today + 1, bolum: '', personel: '' };
    var codes = state.donors.filter(function (d) { return S(d.hk) && !(byId[d.id] && byId[d.id].stopped); }).slice(-300).reverse();
    var x = DT.konsDonor(D, e.hastaKodu);
    openSheet('<h3>' + (isNew ? 'Ek konsültasyon ekle' : 'Ek konsültasyon') + '</h3><form id="kform">' +
      '<div class="field"><label>Hasta kodu</label><input class="inp" name="hastaKodu" list="khk" value="' + h(e.hastaKodu) + '" autocapitalize="characters" required><datalist id="khk">' +
      codes.map(function (d) { return '<option value="' + h(d.hk) + '">' + h(d.ad) + '</option>'; }).join('') + '</datalist></div>' +
      '<div class="field"><label>Konsültasyon tarihi</label><input class="inp" type="date" name="tarih" value="' + DT.iso(e.tarih) + '" required></div>' +
      '<div class="field"><label>Bölüm / açıklama</label><input class="inp" name="bolum" value="' + h(e.bolum) + '" autocapitalize="characters"></div>' +
      '<div class="field"><label>Personel (değiştir)</label><select class="inp" name="personel">' + persOptions(e.personel, 'Sağlık kontrolüne bakan' + (x && x.pers[1] ? ' (' + x.pers[1] + ')' : '')) + '</select></div>' +
      '<div class="btns">' + (isNew ? '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>' : '<button type="button" class="btn danger" id="kDel">Sil</button>') + '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#kform');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = { id: e.id, hastaKodu: upperTR(f.hastaKodu.value.trim()), tarih: DT.fromIso(f.tarih.value), bolum: upperTR(f.bolum.value.trim()), personel: f.personel.value };
      if (!o.hastaKodu || o.tarih == null) { toast('Hasta kodu ve tarih girin'); return; }
      if (!DT.konsDonor(D, o.hastaKodu)) toast('Uyarı: hasta kodu Donör Kayıt’ta yok');
      var k = state.ekKons.findIndex(function (z) { return z.id === e.id; });
      if (k >= 0) state.ekKons[k] = o; else state.ekKons.push(o);
      closeSheet(); commit();
    });
    var del = $('#kDel');
    if (del) del.onclick = function () { state.ekKons = state.ekKons.filter(function (z) { return z.id !== e.id; }); closeSheet(); commit(); toast('Silindi'); };
  }

  /* ---------------- Donör Raporu ---------------- */
  function raporRows() {
    return D.filter(function (x) {
      if (!x.durum) return false;
      if (ui.rpF === 'devam' && (x.stopped || x.durum === 'Toplama yapıldı')) return false;
      if (ui.rpF === 'yapildi' && x.durum !== 'Toplama yapıldı') return false;
      if (ui.rpF === 'durdu' && !x.stopped) return false;
      if (ui.rpH && !eqi(x.d.hastane, ui.rpH)) return false;
      if (ui.rpY && !((x.d.top != null ? DT.year(x.d.top) : x.d.sk != null ? DT.year(x.d.sk) : null) === +ui.rpY)) return false;
      return true;
    });
  }
  function scrRapor() {
    ui.rpF = ui.rpF || 'all';
    var rows = raporRows(), yap = rows.filter(function (x) { return x.durum === 'Toplama yapıldı'; }).length, dur = rows.filter(function (x) { return x.stopped; }).length;
    var html = '<div class="page flush">' + groupSeg('arsiv', '/arsiv/rapor') + '<div class="seg sub">' +
      [['all', 'Tümü'], ['devam', 'Devam eden'], ['yapildi', 'Toplama yapıldı'], ['durdu', 'Süreç durdu']].map(function (f) { return '<button class="' + (ui.rpF === f[0] ? 'on' : '') + '" data-act="rpF" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="toolbar"><select class="inp" data-ui="rpH"><option value="">Tüm hastaneler</option>' + state.lists.hastane.map(function (e) { return '<option' + (eqi(e.ad, ui.rpH) ? ' selected' : '') + '>' + h(e.ad) + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-ui="rpY"><option value="">Tüm yıllar</option>' + yearsInData().map(function (y) { return '<option' + (String(y) === String(ui.rpY) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="summary">Rapor tarihi: ' + DT.fmt(today) + ' · ' + rows.length + ' donör · Toplama yapıldı: ' + yap + ' · Devam eden: ' + (rows.length - yap - dur) + ' · Süreç durdu: ' + dur + '</div>' +
      '<div class="btns" style="margin-bottom:10px"><button class="btn pri" data-act="exportRapor">' + I.down + 'Excel’e aktar</button><button class="btn outlook" data-act="mailRapor">' + I.mail + 'Outlook ile gönder</button></div>' +
      '<button class="btn wa block" data-act="tabloWa" style="margin-bottom:10px">' + I.wa + 'Güncel tabloyu (Excel’in aynısı) WhatsApp’ta gönder</button>' +
      '<button class="btn block rpbtn" data-act="rpAc" data-v="donor" style="margin-bottom:10px">' + I.doc + 'Tarih aralığına göre rapor <span class="muted">· PDF / Excel</span></button>' +
      '<div class="card list">' + rows.slice().reverse().slice(0, ui.rpLimit || 80).map(function (x) {
        var d = x.d;
        return '<a class="item" data-act="donor" data-id="' + h(d.id) + '"><div class="t1"><span class="name">' + h(d.ad) + '</span><span class="pillx ' + durumCls(x.durum) + '">' + h(x.durum) + '</span></div>' +
          '<div class="t2">' + h([d.hk, d.hastane, d.yontem].filter(Boolean).join(' · ')) + '</div><div class="t2 muted">' +
          h(['SK ' + (DT.fmt(d.sk) || '—'), 'Toplama ' + (DT.fmt(d.top) || '—'), d.bolge].filter(Boolean).join(' · ')) + '</div></a>';
      }).join('') + '</div>' + (rows.length > (ui.rpLimit || 80) ? '<button class="btn block" data-act="rpMore">Daha fazla göster</button>' : '') + '</div>';
    return { title: 'Donör Raporu', html: html };
  }

  /* ---------------- Kılavuz ---------------- */
  var KILAVUZ = [
    ['Ana Sayfa', 'Uygulama açılınca gelen ilk sayfa. Dört bölüm düğmesi vardır: MİHMANDARLIK (PLANLAMA, TAKİP, DONÖR KAYIT VE ARŞİV), EŞLEŞME, MALİ İŞLER (donör harcaması, yemek kartı) ve DASHBOARD (istatistikler, iş yükü, taşıma, raporlar). Alttaki sekmeler de bu bölümlere gider. MİHMANDARLIK sayfasındaki kutucuklar bugünkü ve yarınki görev sayısını, geri sayım uyarılarını ve kontrol notlarını gösterir; yeni donör ekleme, yarının programı, PDF’ten donör ekleme ve mailden iptal / erteleme düğmeleri de oradadır.'],
    ['Yeni donör eklemek', 'MİHMANDARLIK sayfasındaki YENİ DONÖR EKLE ya da Donör Kayıt’taki + düğmesine dokunun. Toplama tarihini yazınca aşı başlama tarihi 4 gün öncesi olur; ONKOLOJİ’de AÇIKLAMA’ya 20 kg ya da altı bir kilo yazılırsa (ör. “18 kg”) 3 gün öncesi olur. Farklı tarih gerekirse “Elle tarih” seçin. KEMİK İLİĞİ’nde aşı yoktur. Son izlem toplamadan 20 gün sonradır.'],
    ['PDF’ten donör ekle', 'MİHMANDARLIK sayfasındaki ya da Donör Kayıt’taki “PDF’ten donör ekle” ile TÜRKÖK Hücresel Ürün Toplama / Taşıma Hizmeti Organizasyon Talebi PDF’ini seçin. Hasta kodu, donör numarası, ad soyad, telefon, ilçe/il, sağlık kontrolü ve toplama tarihleri, yöntem, hastane (toplama merkezinden) ve nakil merkezi okunur. Hasta kodu zaten kayıtlıysa mevcut kayıt güncellenir; değişen alanlar gösterilir. Kaydetmeden önce kontrol edin.'],
    ['Mailden iptal / red / erteleme', 'Outlook’ta mailin metnini seçin; açılan menüde Donör Takip’e (ya da Paylaş › Donör Takip’e) dokunun. Menüde yoksa metni kopyalayıp Donör Kayıt’taki “Mailden iptal / erteleme” ile yapıştırın. Uygulama hasta kodu, donör numarası ya da ad soyaddan donörü, mailden de durumu (iptal, red, ertelendi, vazgeçti, hasta ex) bulur; siz onaylayınca açıklamaya yalnızca anahtar kelimeyi (İPTAL, RED, ERTELENDİ, VAZGEÇTİ, HASTA EX) ekler; mail metni kopyalanmaz. İsterseniz ek not yazabilirsiniz. Donör sayfasındaki “İptal / red / erteleme ekle” ile elle de eklenebilir. Ertelenen donörün yeni talebi gelince açıklamadaki notu silin.'],
    ['Donör harcama', 'MALİ İŞLER bölümünde (donör harcaması) dört sayfa var: Harcama Dashboard, Harcama Kayıtları, Donör Harcama ve Yemek Kartı. Harcama Kayıtları: harcama satırları; “Harcama ekle” ile donör, tarih, tutar ve harcama türü (uçak bileti, otobüs bileti, konaklama, yemek, akaryakıt…) girilir; kategori, ulaşım türü ve muhasebe kalemi türden kendiliğinden gelir. Konaklamada refakatçi ve gece sayısı da yazılır. Donör sayfasında da o donörün harcamaları ve “Harcama ekle” vardır. “Excel’den al” Donor_Harcama_Dashboard tablosundaki Harcama Detay satırlarını donörlere (hasta kodu ve donör no ile) bağlayarak yükler. Harcama Dashboard, Excel’deki dashboard’un bölümlerini gösterir: özet, yıllara ve kategoriye göre, ulaşım türü, refakatçi, durum, en yüksek 10 donör, şehir içi (ikamet ili Ankara) / şehir dışı, iller, aylık ve yıl karşılaştırma (seçilen yıl ile önceki yılın aynı dönemi). Donör Harcama, donör başına toplamları listeler. Üstteki indirme düğmesi Donör Harcama ve Harcama Detay sayfalı bir Excel verir.'],
    ['WhatsApp’ta güncel tablo', 'Ayarlar › WhatsApp’ta güncel tablo’dan “Günlük hatırlatma”yı açın; hafta içi (tatiller hariç) ya da her gün ve saati seçin. O saatte gelen bildirime dokununca Excel tablonuzun aynısı (bütün sayfalar, formüller, Kızılay resmi) uygulamadaki güncel bilgilerle hazırlanır ve WhatsApp açılır; Gönder’e siz basarsınız. Excel’den içe aktardığınız dosya şablon olarak saklanır; yoksa bir kez “Excel şablonunu seç” ile seçin. Donör Kayıt, bu haftanın personel seçimleri, ek görevler, ek konsültasyon, ajanda, görev ve taşıma kayıtları, listeler ve kapanış tarihi güncellenir; Excel açılınca formüller yeniden hesaplanır. “Şimdi gönder” ile istediğiniz an, Donör Raporu sayfasından da gönderebilirsiniz.'],
    ['Outlook', 'Outlook’ta gelen PDF (Organizasyon Talebi) ya da Excel ekine dokunup Paylaş › Donör Takip seçin: PDF’ten yeni donör formu açılır, Excel dosyası içe aktarılır. Çalışma Programı’ndaki “Outlook ile e-posta gönder” programı, Donör Raporu’ndaki “Outlook ile gönder” raporu Excel eki olarak yeni bir e-postaya koyar. Outlook kurulu değilse telefonun e-posta seçicisi açılır.'],
    ['Otomatik görevler', 'Sağlık kontrolü tarihinde SAĞLIK KONTROLÜ; aşı başlama tarihinde ve sonraki 3 günde AŞI (1.–4. gün; sabah-akşam hastanelerinde sabah ve akşam ayrı); toplama tarihinde TOPLAMA ve ürünün gideceği yer HASTANE-BAŞLIK biçiminde (ör. ONKOLOJİ-AVRUPA); Ankara’daki merkezler (BAŞLIK ANKARA) başlık yerine NAKİL MERKEZİ adıyla yazar (ör. BİLKENT ERİŞKİN-GAZİ ÜNİVERSİTESİ). KEMİK İLİĞİ ve BİLKENT PEDİATRİ olan donörde toplamadan bir gün önce HASTANE YATIŞ oluşur.'],
    ['Personel atama', 'Her görevin yanındaki personel düğmesine dokunup kişi seçin. Seçim Takvim, Haftalık Program, Çalışma Programı, takip listeleri ve Dashboard’a yansır. “Varsayılan” seçilirse Donör Kayıt’taki İLGİLENEN PERSONEL (ürün taşımada TAŞIYAN PERSONEL) kullanılır.'],
    ['Takvim', 'Ay ay görünüm. Renkler: mavi sağlık kontrolü, turuncu aşı, yeşil toplama, koyu yeşil ürün taşıma, mor hastane yatış; kırmızı zemin resmi tatil. Bir güne dokununca o günün görevleri altta listelenir.'],
    ['Çalışma Programı', 'Seçilen günün (varsayılan yarın) programını WhatsApp metni olarak hazırlar: başlık, her personelin adı ve altında görevleri, NOTLAR, ürün taşıma satırları, kargo satırı (yurt dışı nakil merkezli donörün sağlık kontrolü varsa), hafta içi sabit satırlar ve İYİ ÇALIŞMALAR. WhatsApp düğmesi metni doğrudan paylaşır.'],
    ['Haftalık Program', 'Haftanın 7 günü alt alta, her günün görevleri ve atanmış personel. Görevlere buradan da kişi atanabilir.'],
    ['Ajanda', 'Her gün 08:00–18:00 saatleri ve serbest satır. Programa girmesini istediğiniz notta DURUM: PROGRAMA EKLE seçin; personel seçerseniz onun altına, seçmezseniz NOTLAR başlığı altına yazılır.'],
    ['Görev Listesi', 'Geri sayım uyarıları: aşı başlangıcı, sağlık kontrolü, toplama ve ürün taşıma. İKAMETİ’nde “Ankara” yazmayanlarda 10 gün (YÜKSEK), yazanlarda 5 gün (ORTA) önceden; ürün taşımada şehir dışı 10, Ankara içi 5 gün önceden.'],
    ['Takip sayfaları', 'Sağlık Kontrolü, Aşı, Toplama, Ürün Taşıma, Son İzlem ve IDM sayfaları bugün ya da sonrasındaki kayıtları en yakın tarih üstte olacak şekilde listeler. Hafta sonu ya da resmi tatile denk gelen tarih turuncu görünür.'],
    ['Ek Konsültasyon', 'HASTA KODU ve KONSÜLTASYON TARİHİ girin; donör bilgileri ve sağlık kontrolüne bakan personel kendiliğinden gelir. Başka biri gidecekse PERSONEL (DEĞİŞTİR) seçin. Konsültasyon günü programa yazılır.'],
    ['İptal / erteleme / red / vazgeçme / hasta ex', 'AÇIKLAMA’ya iptal, erteleme, red, vazgeç ya da hasta ex yazılan donör takvimden, programlardan, uyarılardan ve takip listelerinden çıkar; Dashboard’da “süreç durdu” sayılır. Kelime silinince donör planlara geri döner.'],
    ['KONTROL', 'Donör kaydındaki eksik ya da uyumsuz bilgiler (yöntem, hastane, nakil merkezi yok; personel listede yok; sağlık kontrolü aşıdan ya da toplamadan sonra; aşı toplamadan sonra; son izlem toplamadan önce) kaydın üstünde turuncu kutuda yazar.'],
    ['Donör Raporu', 'Yöneticiye göndermek için temiz kopya: DURUM sütunuyla birlikte. Süzüp “Excel’e aktar” ile .xlsx olarak kaydedebilirsiniz.'],
    ['Yemek kartı', 'MALİ İŞLER › Yemek Kartı’nda “Excel’den al” ile MetropolCard’ın Yükleme Detay Raporu Excel’ini seçin (Outlook’tan Paylaş › Donör Takip ile de olur). Her yükleme ad soyaddan (bulunamazsa telefondan) donöre bağlanır ve tarihine göre ayrılır: sağlık kontrolü tarihinden 3 gün önce – 2 gün sonra “Sağlık kontrolü”; aşı başlangıcından (kemik iliğinde toplamadan) 3 gün önce – toplamadan 3 gün sonra toplama dönemi. Toplama döneminde aşı günlerinde de yükleme varsa “Aşı + toplama”, yalnızca toplama günlerindeyse “Toplama süreci”; uymayanlar “Diğer”. Sayfada toplam yükleme, aşamalara göre tutarlar ve her aşamanın altında donörler görünür. Yanlış aşamayı ya da donörü Yüklemeler’de yüklemeye dokunarak değiştirin. Aynı rapor ya da çakışan dönem tekrar yüklenirse aynı yükleme iki kez girmez. TC kimlik no ve kart numarası saklanmaz (kartın son 4 hanesi hariç). Donör sayfasında da o donörün yemek kartı yüklemeleri görünür; Raporlar’da Yemek kartı raporu vardır.'],
    ['Raporlar', 'DASHBOARD › Raporlar (Donör Raporu, Harcama Dashboard ve Yemek Kartı sayfalarından da açılır). Raporlar: Donör raporu (dönemdeki donörler; durum, hastane, yöntem süzgeci ve donör listesi), Harcama raporu (kategori, harcama ve ulaşım türü, il, donör bazında; harcama satırları), İş yükü ve taşıma raporu (personel görevleri, görev türleri, ürün taşımaları) Dashboard özeti (dönemin sayıları ve grafikleri, yöneticiye sunum için) ve Yemek kartı raporu (yüklemeler aşamalara ve donörlere göre). Tarih aralığını Bu ay, Geçen ay, Son 3 ay, Bu yıl, Geçen yıl, Tümü ile ya da başlangıç ve bitiş tarihi yazarak seçin; rapor aşağıda önizlenir. “PDF oluştur” tablolu ve grafikli A4 rapor, “Excel oluştur” aynı tabloları (ve tüm listeleri ayrı sayfalarda) verir. Hazır olunca Aç, Telefona kaydet, Outlook ile gönder, WhatsApp’ta gönder ya da başka uygulamayla paylaş seçilir. Uzun listeler (donör listesi, harcama satırları, görev kayıtları) isterseniz PDF’e de eklenir; Excel’de her zaman vardır.'],
    ['Listeler', 'Personel, hastane (ve programdaki adı), yöntem, ulaşım, konaklama, sabah-akşam aşı hastaneleri, resmi tatiller, nakil merkezi anahtar kelimeleri ve programdaki yazılışlar buradan değiştirilir.'],
    ['Haftalık Plan', 'Defter görünümü: her günün görevleri şu sırayla yazılır: kök hücre toplama, kemik iliği toplama, hastane yatış, aşı, sağlık kontrolü, ürün taşıma, kargo. Personel düğmesinden atama yapılır. “Not ekle” ile o güne not yazın; not o günün Çalışma Programı’na (personel seçilirse onun altına, seçilmezse NOTLAR bölümüne) girer.'],
    ['Haftalık Kapanış', 'Her hafta bitince (pazartesi) sıradaki haftayı kapatın: o haftanın personeli seçilmiş görevleri, ek konsültasyonlar ve personeli seçili ajanda notları Görev Kayıtları’na yazılır, İş Yükü ve Taşıma İstatistiği kalıcı olur. Haftalar sırayla kapatılır; personeli seçilmemiş görevler arşive girmez.'],
    ['Görev Kayıtları', 'İş yükü arşivi: Excel’den gelen belge kayıtları, kapatılan haftaların program görevleri (KAYNAK = Program) ve elle eklenenler (KAYNAK = Elle). Programda olmayan bir işi + ile ekleyin.'],
    ['Taşıma Kayıtları', 'Ürün Taşıma Tablosu’ndan gelen belge kayıtları. Yeni taşımalar programdan sayılır ve haftalık kapanışla Görev Kayıtları’na geçer.'],
    ['İş Yükü', 'Personel başına görev sayıları (görev türüne göre), görevli gün, hafta sonu görevli gün ve izin günü; ana gruplar ve aylık tablo. Sayılar Görev Kayıtları’ndan ve henüz kapatılmamış haftalar için programdan canlı gelir.'],
    ['Taşıma İstatistiği', 'Personel başına şehir içi / şehir dışı ürün taşıma, şehir dışı yöntemi (bizzat gitti, kurye karşılama / teslim), karşı şehir ve aylık dağılım. Yurt dışı ürünleri sayılmaz.'],
    ['Veriler ve yedek', 'Veriler yalnızca bu telefonda saklanır. Ayarlar’dan düzenli yedek alın; Excel’den içe aktarma mevcut verinin yerine geçer, önceki veri saklanır ve geri yüklenebilir.']
  ];
  function scrKilavuz() {
    return { title: 'Kılavuz', html: '<div class="page flush">' + groupSeg('arsiv', '/arsiv/kilavuz') + '<div class="card">' + KILAVUZ.map(function (k) {
      return '<details class="kl"><summary>' + h(k[0]) + '</summary><div>' + h(k[1]) + '</div></details>';
    }).join('') + '</div></div>' };
  }

  /* ---------------- Haftalık Plan (defter) ---------------- */
  var PLAN_RENK = { 1: ['KÖK HÜCRE TOPLAMA', 'p-top'], 2: ['KEMİK İLİĞİ TOPLAMA', 'p-yat'], 3: ['HASTANE YATIŞ', 'p-yat'], 4: ['AŞI', 'p-asi'], 5: ['SAĞLIK KONTROLÜ', 'p-sk'], 6: ['ÜRÜN TAŞIMA', 'p-tas'] };
  function planHPlan() {
    if (ui.weekStart == null) ui.weekStart = DT.weekStart(today);
    var ws = ui.weekStart, a = DT.parts(ws), b = DT.parts(ws + 6);
    var html = '<div class="datebar"><button class="icon" data-act="weekMove" data-v="-7">' + I.left + '</button><div class="inp center">' + a.d + ' ' + DT.AYLAR[a.m - 1] + ' – ' + b.d + ' ' + DT.AYLAR[b.m - 1] + ' ' + b.y +
      '</div><button class="icon" data-act="weekMove" data-v="7">' + I.right + '</button></div>' + (ws !== DT.weekStart(today) ? '<button class="btn sm block" data-act="weekNow" style="margin-bottom:8px">● Bu hafta</button>' : '');
    var sum = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, persSum = {};
    for (var k = 0; k < 7; k++) {
      var s = ws + k, p = DT.parts(s);
      var list = pool.filter(function (t) { return t.date === s && t.slot < 9 && !(t.slot === 7 && t.yd); })
        .map(function (t) { return { t: t, g: DT.planGroup(D[t.i], t) }; }).sort(function (x, y) { return x.g - y.g || x.t.key - y.t.key; });
      var kargo = pool.some(function (t) { return t.date === s && t.slot === 1 && D[t.i].yd === 1; }) ? DT.kargoFor(state.lists, s) : '';
      var notes = state.planNotlar.filter(function (n) { return n.tarih === s; });
      html += '<div class="nb' + (s === today ? ' today' : '') + '"><div class="nbh' + (holMap[s] ? ' hol' : '') + '"><b>' + DT.GUNLER_B[k] + '</b> ' + pad2(p.d) + '.' + pad2(p.m) + (holMap[s] ? ' · ' + h(holMap[s]) : '') +
        '<span class="grow"></span><span class="tiny">' + list.length + ' görev</span></div>' +
        list.map(function (e) {
          var t = e.t, x = D[t.i], r = PLAN_RENK[e.g]; sum[e.g]++;
          if (t.kind === 'asi' && x.sabahAksam) r = ['AŞI · S/A', 'p-asi'];
          var nm = t.slot === 7 ? S(x.d.hastane).replace('PEDİATRİ', 'PED.').replace('ERİŞKİN', 'ERİŞ.') + ' → ' + (x.baslik || x.d.bolge) : DT.planName(x);
          taskSlots(x, t).forEach(function (sl) { var w = x.pers[sl] || '—'; persSum[w] = (persSum[w] || 0) + 1; });
          return '<div class="nbr"><span class="pillx ' + r[1] + '">' + h(r[0]) + (t.kind === 'asi' ? ' ' + t.gun : '') + '</span><span class="grow ellipsis" data-act="donor" data-id="' + h(x.d.id) + '">' + h(nm) + '</span>' + whoBtn(x, t) + '</div>';
        }).join('') + (kargo ? '<div class="nbr"><span class="pillx p-or">KARGO</span><span class="grow">' + h(kargo) + '</span></div>' : '') +
        notes.map(function (n) { return '<div class="nbr note" data-act="pnEdit" data-id="' + h(n.id) + '"><span class="pillx p-grey">NOT</span><span class="grow">' + h(n.not) + '</span><span class="tiny">' + h(n.personel || '—') + '</span></div>'; }).join('') +
        '<button class="nbadd" data-act="pnNew" data-v="' + s + '">' + I.plus + ' Not ekle</button></div>';
    }
    html += '<div class="sec-title">Hafta özeti</div><div class="card pad">' + tbl(['İşlem', 'Görev'], Object.keys(sum).map(function (g) { return [PLAN_RENK[g][0], sum[g]]; })) + '<div class="hr"></div>' +
      tbl(['Personel', 'Görev'], Object.keys(persSum).sort(function (x, y) { return persSum[y] - persSum[x]; }).map(function (n) { return [n === '—' ? 'Atanmamış' : n, persSum[n]]; })) +
      '<div class="note">Notlar o günün Çalışma Programı’na yazılır: personel seçilirse onun altına, seçilmezse NOTLAR bölümüne. Yurt dışı ürün taşıma planda yer almaz.</div></div>';
    return html;
  }
  function pnForm(n, tarih) {
    var isNew = !n;
    n = n || { id: DT.uid(), tarih: tarih, not: '', personel: '' };
    openSheet('<h3>' + (isNew ? 'Not ekle' : 'Notu düzenle') + '</h3><div class="sub">' + h(dateLong(n.tarih)) + '</div><form id="pnform">' +
      '<div class="field"><label>Not</label><textarea class="inp" name="not" rows="2" autocapitalize="characters">' + h(n.not) + '</textarea></div>' +
      '<div class="field"><label>Personel</label><select class="inp" name="personel">' + persOptions(n.personel, '— (NOTLAR) —') + '</select></div>' +
      '<div class="btns">' + (isNew ? '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>' : '<button type="button" class="btn danger" id="pnDel">Sil</button>') + '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#pnform');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = { id: n.id, tarih: n.tarih, not: f.not.value.trim(), personel: f.personel.value };
      if (!o.not) { toast('Not yazın'); return; }
      var k = state.planNotlar.findIndex(function (z) { return z.id === n.id; });
      if (k >= 0) state.planNotlar[k] = o; else state.planNotlar.push(o);
      closeSheet(); commit();
    });
    var del = $('#pnDel');
    if (del) del.onclick = function () { state.planNotlar = state.planNotlar.filter(function (z) { return z.id !== n.id; }); closeSheet(); commit(); };
  }

  /* ---------------- Haftalık Kapanış ---------------- */
  function recRow(r) {
    return '<div class="trow"' + (r.id && r.kaynak !== 'Belge' ? ' data-act="gkEdit" data-id="' + h(r.id) + '"' : '') + '><div class="h"><span class="name">' + h(r.personel) + ' · ' + h(r.tur) + '</span><span class="pillx ' +
      (r.kaynak === 'Belge' ? 'p-grey' : r.kaynak === 'Elle' ? 'p-or' : 'p-pri') + '">' + h(DT.fmt(r.tarih)) + '</span></div><div class="small muted">' + h([r.aciklama, r.sehir && r.sehir !== 'Ankara' ? r.sehir : '', r.yontem && r.yontem !== 'Şehir içi' ? r.yontem : '', r.kaynak].filter(Boolean).join(' · ')) + '</div></div>';
  }
  function scrKapanis() {
    var k = DT.kesimOf(state), pend = DT.pendingWeeks(state, today);
    var html = '<div class="page flush">' + groupSeg('arsiv', '/arsiv/kapanis');
    if (k == null) {
      html += '<div class="card pad"><h2>Kapanış henüz başlamadı</h2><div class="small muted" style="margin-bottom:12px">Haftalık kapanış, programdaki görevleri (atanan personeliyle) Görev Kayıtları’na aktarır; İş Yükü ve Taşıma İstatistiği kalıcı olur. Excel dosyasından içe aktarırsanız kapanış tarihi oradan gelir.</div>' +
        '<button class="btn pri block" data-act="kpStart">Bu haftadan başlat</button></div>';
      return { title: 'Haftalık Kapanış', html: html + '</div>' };
    }
    html += '<div class="summary">Kapatılan son gün: ' + DT.fmt(k - 1) + ' · ' + (pend.length ? pend.length + ' hafta kapatılmayı bekliyor' : 'kapanış güncel') + '. Haftalar sırayla kapatılır; personeli seçilmemiş görevler arşive girmez.</div>';
    if (!pend.length) return { title: 'Haftalık Kapanış', html: html + '<div class="card">' + emptyBox('Kapanış güncel', 'İçinde bulunduğunuz hafta bitince (pazartesi) kapatılabilir.') + '</div></div>' };
    var w = pend[0], lr = DT.liveRecords(state, D, pool, w.bas, w.son);
    html += '<div class="card pad"><h2>' + DT.fmt(w.bas) + ' – ' + DT.fmt(w.son) + '</h2><div class="small" style="margin-bottom:10px">' + lr.rows.length + ' görev arşive yazılacak' +
      (lr.eksik ? ' · <b style="color:var(--red)">' + lr.eksik + ' görevde personel seçilmemiş</b>' : '') + '</div>' +
      '<div class="btns">' + (lr.eksik ? '<button class="btn" data-act="kpWeek" data-v="' + DT.weekStart(w.bas) + '">Personel ata</button>' : '') + '<button class="btn pri" data-act="kpClose">Haftayı kapat</button></div></div>' +
      '<div class="card">' + (lr.rows.length ? lr.rows.map(recRow).join('') : emptyBox('Bu haftada personeli seçili görev yok')) + '</div>';
    if (pend.length > 1) html += '<div class="note" style="margin:8px 4px">Sırada bekleyen: ' + pend.slice(1).map(function (p) { return DT.fmtShort(p.bas) + '–' + DT.fmtShort(p.son); }).join(', ') + '</div>';
    return { title: 'Haftalık Kapanış', html: html + '</div>' };
  }

  /* ---------------- Görev Kayıtları ---------------- */
  function gkFiltered() {
    return state.gorevKayit.filter(function (r) {
      return (!ui.gkP || eqi(r.personel, ui.gkP)) && (!ui.gkY || DT.year(r.tarih) === +ui.gkY) && (!ui.gkT || r.tur === ui.gkT) && (!ui.gkK || r.kaynak === ui.gkK);
    });
  }
  function recYears(list) { var y = {}; list.forEach(function (r) { if (r.tarih != null) y[DT.year(r.tarih)] = 1; }); return Object.keys(y).sort().reverse(); }
  function selY(key, list) { return '<select class="inp" data-ui="' + key + '"><option value="">Tüm yıllar</option>' + recYears(list).map(function (y) { return '<option' + (String(ui[key]) === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>'; }
  function scrGorev() {
    var rows = gkFiltered(), by = {};
    rows.forEach(function (r) { by[r.kaynak] = (by[r.kaynak] || 0) + 1; });
    var html = '<div class="page flush">' + groupSeg('arsiv', '/arsiv/gorev') +
      '<div class="toolbar"><select class="inp" data-ui="gkP">' + persOptions(ui.gkP, 'Tüm personel') + '</select>' + selY('gkY', state.gorevKayit) + '</div>' +
      '<div class="toolbar"><select class="inp" data-ui="gkT"><option value="">Tüm görev türleri</option>' + (state.lists.isTuru || DT.IS_TURU).map(function (t) { return '<option' + (t === ui.gkT ? ' selected' : '') + '>' + h(t) + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-ui="gkK"><option value="">Tüm kaynaklar</option>' + ['Belge', 'Program', 'Elle'].map(function (t) { return '<option' + (t === ui.gkK ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
      '<div class="summary">Toplam ' + rows.length + ' kayıt · ' + Object.keys(by).map(function (k) { return k.toLocaleLowerCase('tr-TR') + ' ' + by[k]; }).join(' · ') + '. Programda olmayan işi + ile elle ekleyin.</div>' +
      '<div class="card">' + (rows.length ? rows.slice().sort(function (a, b) { return b.tarih - a.tarih; }).slice(0, ui.gkLimit || 100).map(recRow).join('') : emptyBox('Kayıt yok')) + '</div>' +
      (rows.length > (ui.gkLimit || 100) ? '<button class="btn block" data-act="gkMore">Daha fazla göster</button>' : '') +
      '<button class="fab" data-act="gkNew" aria-label="Kayıt ekle">' + I.plus + '</button></div>';
    return { title: 'Görev Kayıtları', html: html };
  }
  function gkForm(r) {
    var isNew = !r;
    r = r || { id: DT.uid(), tarih: today, personel: '', tur: '', aciklama: '', kaynak: 'Elle' };
    openSheet('<h3>' + (isNew ? 'Görev kaydı ekle' : 'Görev kaydı') + '</h3><form id="gkform"><div class="grid2">' +
      '<div class="field"><label>Tarih</label><input class="inp" type="date" name="tarih" value="' + DT.iso(r.tarih) + '" required></div>' +
      '<div class="field"><label>Personel</label><select class="inp" name="personel" required>' + persOptions(r.personel, '— seçin —') + '</select></div></div>' +
      '<div class="field"><label>Görev türü</label><select class="inp" name="tur" required>' + listOptions(state.lists.isTuru || DT.IS_TURU, r.tur) + '</select></div>' +
      '<div class="field"><label>Açıklama</label><input class="inp" name="aciklama" value="' + h(r.aciklama) + '"></div>' +
      '<div class="btns">' + (isNew ? '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>' : '<button type="button" class="btn danger" id="gkDel">Sil</button>') + '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#gkform');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = Object.assign({}, r, { tarih: DT.fromIso(f.tarih.value), personel: f.personel.value, tur: f.tur.value, aciklama: f.aciklama.value.trim() });
      if (o.tarih == null || !o.personel || !o.tur) { toast('Tarih, personel ve tür seçin'); return; }
      var k = state.gorevKayit.findIndex(function (z) { return z.id === r.id; });
      if (k >= 0) state.gorevKayit[k] = o; else state.gorevKayit.push(o);
      closeSheet(); commit(); toast('Kaydedildi');
    });
    var del = $('#gkDel');
    if (del) del.onclick = function () { state.gorevKayit = state.gorevKayit.filter(function (z) { return z.id !== r.id; }); closeSheet(); commit(); toast('Silindi'); };
  }

  /* ---------------- Taşıma Kayıtları ---------------- */
  function scrTasimaKayit() {
    var rows = state.tasimaKayit.filter(function (t) { return (!ui.tkrP || eqi(t.personel, ui.tkrP)) && (!ui.tkrY || DT.year(t.tarih) === +ui.tkrY); });
    var html = '<div class="page flush">' + groupSeg('arsiv', '/arsiv/tasima') + '<div class="toolbar"><select class="inp" data-ui="tkrP">' + persOptions(ui.tkrP, 'Tüm personel') + '</select>' + selY('tkrY', state.tasimaKayit) + '</div>' +
      '<div class="summary">' + rows.length + ' belge kaydı. Yeni taşımalar programdan sayılır ve haftalık kapanışla Görev Kayıtları’na geçer.</div><div class="card">' +
      (rows.length ? rows.slice().sort(function (a, b) { return b.tarih - a.tarih; }).slice(0, ui.tkrLimit || 100).map(function (t) {
        return '<div class="trow"><div class="h"><span class="name">' + h(t.personel) + ' · ' + h(t.nereden) + ' → ' + h(t.nereye) + '</span><span class="pillx ' + (fold(t.kapsam).indexOf('dış') >= 0 || fold(t.kapsam).indexOf('dis') >= 0 ? 'p-tas' : 'p-grey') + '">' + DT.fmt(t.tarih) + '</span></div>' +
          '<div class="small muted">' + h([t.kapsam, t.yon, t.sehir, t.yontem, t.ekip ? 'Ekip: ' + t.ekip : '', t.not].filter(Boolean).join(' · ')) + '</div></div>';
      }).join('') : emptyBox('Taşıma kaydı yok', 'Excel dosyasından içe aktarınca gelir.')) + '</div>' +
      (rows.length > (ui.tkrLimit || 100) ? '<button class="btn block" data-act="tkrMore">Daha fazla göster</button>' : '') + '</div>';
    return { title: 'Taşıma Kayıtları', html: html };
  }

  /* ---------------- İş Yükü ve Taşıma İstatistiği ---------------- */
  function periodBar(key) {
    var ys = recYears(state.gorevKayit.concat(state.tasimaKayit)); if (ys.indexOf(String(DT.year(today))) < 0) ys.unshift(String(DT.year(today)));
    if (ui[key + 'Y'] == null) ui[key + 'Y'] = String(DT.year(today));
    return '<div class="toolbar"><select class="inp" data-ui="' + key + 'Y"><option value="">Tüm dönem</option>' + ys.map(function (y) { return '<option' + (ui[key + 'Y'] === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-ui="' + key + 'M"><option value="">Tüm yıl</option>' + DT.AYLAR.map(function (a, i) { return '<option value="' + (i + 1) + '"' + (String(ui[key + 'M']) === String(i + 1) ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>';
  }
  function periodOf(key) {
    if (ui[key + 'Y'] == null) ui[key + 'Y'] = String(DT.year(today));
    var y = ui[key + 'Y'], m = ui[key + 'M'];
    if (!y) return { from: 0, to: 99999, label: 'tüm dönem', y: null };
    y = +y; if (m) return { from: DT.serial(y, +m, 1), to: DT.serial(y, +m + 1, 1) - 1, label: DT.AYLAR[m - 1] + ' ' + y, y: y };
    return { from: DT.serial(y, 1, 1), to: DT.serial(y, 12, 31), label: String(y), y: y };
  }
  function monthTable(recsByPers, y) {
    return tbl(['Personel'].concat(DT.AYLAR.map(function (a) { return a.slice(0, 3); })).concat(['Toplam']), recsByPers.map(function (r) {
      var c = DT.AYLAR.map(function (a, i) { return r.ay[y + '-' + pad2(i + 1)] || 0; });
      return [r.ad].concat(c).concat([c.reduce(function (s0, v) { return s0 + v; }, 0)]);
    }));
  }
  function arsivCard(ad) {
    return '<div class="card pad" style="margin:0 12px 10px"><div class="small"><b>' + h(ad) + ' boş.</b> Excel’deki geçmiş kayıtlar uygulamaya alınmamış; şu an yalnızca programdaki görevler sayılıyor. ' +
      'Excel tablonuzdan yalnızca arşivi (Görev ve Taşıma Kayıtları, kapanış tarihi) alabilirsiniz; donörler ve diğer bilgiler değişmez.</div>' +
      '<button class="btn pri block" data-act="arsivAl" style="margin-top:10px">' + I.up + 'Excel’deki geçmiş kayıtları al</button></div>';
  }
  function arsivYukle(buf, name) {
    busy(true, 'Kayıtlar okunuyor…');
    XLSXIO.importWorkbook(buf, window.DT_DEFAULT_LISTS).then(function (res) {
      busy(false);
      var ex = res.state;
      confirmSheet('Geçmiş kayıtları al', name + '\n\n' + ex.gorevKayit.length + ' görev kaydı · ' + ex.tasimaKayit.length + ' taşıma kaydı' +
        (ex.kapanis.kesim != null ? ' · kapanış ' + DT.fmt(ex.kapanis.kesim) : '') + '\n\nUygulamadaki kayıtlarla birleştirilir (aynısı iki kez girmez). Donörler, personel seçimleri ve diğer bilgiler değişmez.', 'Al', false, function () {
        var r = DT.mergeArchive(state, ex);
        commit(); toast(r.gorev + ' görev, ' + r.tasima + ' taşıma kaydı eklendi');
      });
    }).catch(function (e) { busy(false); toast('Okunamadı: ' + e.message); });
  }
  /* ================= DONÖR HARCAMA ================= */
  function tl(v, dec) {
    if (v == null || isNaN(v)) return '–';
    return (+v).toLocaleString('tr-TR', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }) + ' ₺';
  }
  function kisaTL(v) { return v >= 1e6 ? (v / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' Mn' : v >= 1e3 ? Math.round(v / 1e3) + ' B' : String(Math.round(v)); }
  var HRCH = { fmt: kisaTL, full: true };
  function degisim(a, b) { return b ? ((a / b - 1) >= 0 ? '+' : '') + pct(a / b - 1) : '–'; }
  // Donör sayfası: Excel'deki "Donör Harcama" satırının bilgileri + harcama kalemleri
  function hrDonorSection(x) {
    var mine = hrows.filter(function (o) { return o.x === x; }).sort(function (a, b) { return (b.r.tarih || 0) - (a.r.tarih || 0); });
    var hh = x.h, yillar = Object.keys(hh.yil).sort();
    var html = '<div class="sec-title">Harcama bilgileri</div><div class="card pad hrcard">';
    if (mine.length) {
      html += '<div class="hrtop"><div><div class="hrsum">' + tl(hh.toplam, true) + '</div><div class="small muted">Toplam harcama · ' + mine.length + ' kalem</div></div>' +
        (yillar.length ? '<div class="hryil">' + yillar.map(function (y) { return '<div><b>' + tl(hh.yil[y]) + '</b><span>' + y + '</span></div>'; }).join('') + '</div>' : '') + '</div>' +
        '<div class="hrkat">' + HR.KATEGORI.map(function (k) {
          return '<div' + (hh.kat[k] ? '' : ' class="sifir"') + '><span>' + h(k) + '</span><b>' + (hh.kat[k] ? tl(hh.kat[k], true) : '–') + '</b></div>';
        }).join('') + '<div><span>Toplam</span><b>' + tl(hh.toplam, true) + '</b></div></div>';
    } else html += '<div class="small muted" style="margin-bottom:8px">Bu donör için harcama girilmemiş.</div>';
    var bilgi = [['İl', hh.il || '–'], ['Konum', hh.konum], ['Ulaşım türü', hh.ulasim || '–'], ['Refakatçi', hh.refakatci || (mine.length ? 'Bilgi yok' : '–')],
      ['Konaklama', hh.gece ? hh.gece + ' gece' : '–'], ['Durum grubu', hh.grup]];
    html += '<div class="hrbilgi">' + bilgi.map(function (b) { return '<div><span>' + h(b[0]) + '</span><b>' + h(b[1]) + '</b></div>'; }).join('') + '</div>';
    if (mine.length) {
      html += '<div class="hrbas">Harcama kalemleri</div>' + mine.map(function (o) {
        var r = o.r;
        return '<button class="hrrow" data-act="hrEdit" data-id="' + h(r.id) + '"><span class="grow"><b>' + h(r.detay) + '</b><span class="small muted"><br>' + h(DT.fmt(r.tarih)) + ' · ' + h(r.kategori) +
          (r.refakatci ? ' · refakatçi ' + h(r.refakatci.toLocaleLowerCase('tr-TR')) : '') + (r.gece ? ' · ' + r.gece + ' gece' : '') + (r.not ? ' · ' + h(r.not) : '') + '</span></span><b class="amt">' + tl(r.tutar, true) + '</b></button>';
      }).join('');
    }
    html += '<button class="btn block" data-act="hrNew" data-donor="' + h(x.d.id) + '" style="margin-top:10px">' + I.plus + 'Harcama ekle</button>';
    var yk = yrows.filter(function (o) { return o.x === x; }).sort(function (a, b) { return b.r.tarih - a.r.tarih || S(b.r.saat).localeCompare(S(a.r.saat)); });
    if (yk.length) {
      html += '<div class="hrbas">Yemek kartı · ' + tl(x.yk.toplam, true) + ' · ' + yk.length + ' yükleme</div><div class="hrkat">' + YK.ASAMA.filter(function (a) { return x.yk.asama[a]; }).map(function (a) {
        return '<div><span>' + h(a) + '</span><b>' + tl(x.yk.asama[a], true) + '</b></div>'; }).join('') + '</div>' + yk.map(ykSatir).join('');
    }
    return html + '</div>';
  }
  function hrForm(o) {
    o = o || {};
    var r = o.id ? (state.harcama || []).filter(function (z) { return z.id === o.id; })[0] : null;
    var cur = r || { tarih: today, detay: 'Uçak bileti', donorId: o.donor || null, refakatci: '', gece: null, not: '', tutar: '' };
    var donors = D.filter(function (x) { return S(x.d.hk) || S(x.d.ad); }).sort(function (a, b) { return (b.d.top || b.d.sk || 0) - (a.d.top || a.d.sk || 0); });
    var opts = '<option value="">— donör seçin —</option>' + (r && !r.donorId ? '<option value="" selected>' + h(r.ad || 'Eşleşmeyen') + ' (eşleşmedi)</option>' : '') +
      donors.map(function (x) { return '<option value="' + h(x.d.id) + '"' + (x.d.id === cur.donorId ? ' selected' : '') + '>' + h([x.d.ad, x.d.hk].filter(Boolean).join(' · ')) + (x.d.top != null ? ' · ' + DT.fmt(x.d.top) : '') + '</option>'; }).join('');
    var konak = function (det) { var t = HR.tur(det); return t && t[1] === 'Konaklama'; };
    openSheet('<h3>' + (r ? 'Harcamayı düzenle' : 'Harcama ekle') + '</h3><form id="hrform">' +
      '<div class="field"><label>Donör</label><select class="inp" name="donor">' + opts + '</select></div>' +
      '<div class="row" style="gap:8px"><div class="field grow"><label>Tarih</label><input class="inp" type="date" name="tarih" value="' + h(cur.tarih != null ? DT.iso(cur.tarih) : '') + '"></div>' +
      '<div class="field grow"><label>Tutar (₺)</label><input class="inp" type="number" inputmode="decimal" step="0.01" min="0" name="tutar" value="' + h(cur.tutar === '' ? '' : cur.tutar) + '" placeholder="0,00"></div></div>' +
      '<div class="field"><label>Harcama türü</label><select class="inp" name="detay">' + HR.TURLER.map(function (t) {
        return '<option value="' + h(t[0]) + '"' + (t[0] === cur.detay ? ' selected' : '') + '>' + h(t[0]) + (t[1] !== t[0] ? ' · ' + h(t[1]) : '') + '</option>'; }).join('') + '</select>' +
      '<div class="hint" id="hrKalem"></div></div>' +
      '<div id="hrKonak"' + (konak(cur.detay) ? '' : ' hidden') + '><div class="row" style="gap:8px"><div class="field grow"><label>Refakatçi</label><select class="inp" name="refakatci">' +
        [['', 'Bilinmiyor'], ['VAR', 'Var'], ['YOK', 'Yok']].map(function (v) { return '<option value="' + v[0] + '"' + (S(cur.refakatci) === v[0] ? ' selected' : '') + '>' + v[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field grow"><label>Gece</label><input class="inp" type="number" min="0" step="1" name="gece" value="' + h(cur.gece || '') + '"></div></div></div>' +
      '<div class="field"><label>Not</label><input class="inp" name="not" value="' + h(cur.not || '') + '" placeholder="isteğe bağlı"></div>' +
      '<div class="btns">' + (r ? '<button type="button" class="btn danger" id="hrDel">Sil</button>' : '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>') +
      '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#hrform');
    var upd = function () { var t = HR.tur(f.detay.value); $('#hrKalem').textContent = t ? t[3] + (t[2] ? ' · ' + t[2] : '') : ''; $('#hrKonak').hidden = !konak(f.detay.value); };
    f.detay.addEventListener('change', upd); upd();
    if (r) $('#hrDel').onclick = function () {
      confirmSheet('Harcamayı sil', r.detay + ' · ' + DT.fmt(r.tarih) + ' · ' + tl(r.tutar, true), 'Sil', true, function () {
        state.harcama = state.harcama.filter(function (z) { return z.id !== r.id; }); commit(); toast('Harcama silindi');
      });
    };
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var tutar = parseFloat(String(f.tutar.value).replace(',', '.')), tarih = DT.fromIso(f.tarih.value);
      if (!f.donor.value && !(r && !r.donorId)) { toast('Donör seçin'); return; }
      if (tarih == null) { toast('Tarih seçin'); return; }
      if (!(tutar > 0)) { toast('Tutar girin'); return; }
      var x = byId[f.donor.value];
      var nw = HR.yeni({ id: r ? r.id : null, tarih: tarih, detay: f.detay.value, tutar: tutar, donorId: f.donor.value || null, ad: x ? x.d.ad : (r ? r.ad : ''),
        refakatci: f.refakatci.value, gece: f.gece.value, not: f.not.value.trim(), sira: r ? r.sira : null });
      if (r) state.harcama = state.harcama.map(function (z) { return z.id === r.id ? nw : z; }); else state.harcama.push(nw);
      closeSheet(); commit(); toast(r ? 'Harcama kaydedildi' : 'Harcama eklendi · ' + tl(tutar, true));
    });
  }
  function hrImport(buf, name) {
    busy(true, 'Harcamalar okunuyor…');
    HR.importWorkbook(buf, state).then(function (res) {
      busy(false);
      var rp = res.rapor, toplam = res.harcama.reduce(function (a, r) { return a + r.tutar; }, 0);
      confirmSheet('Excel’den harcamaları al', name + '\n\n' + rp.satir + ' harcama satırı · ' + tl(toplam, true) + '\n' + rp.eslesen + ' satır donöre bağlandı' +
        (rp.eslesmeyen ? ' · ' + rp.eslesmeyen + ' satır Excel’de de eşleşmemiş' : '') + (rp.donorBulunamadi ? '\n' + rp.donorBulunamadi + ' Excel donörü uygulamada bulunamadı.' : '') +
        (state.harcama.length ? '\n\nUygulamadaki ' + state.harcama.length + ' harcama silinip yerine bunlar yüklenecek.' : ''), 'Al', !!state.harcama.length, function () {
        state.harcama = res.harcama; state.ilEslesme = Object.assign({}, state.ilEslesme || {}, res.ilEslesme);
        commit(); toast(rp.satir + ' harcama alındı');
      });
    }).catch(function (e) { busy(false); toast('Okunamadı: ' + e.message); });
  }
  function hrToolbar(cur) {
    return groupSeg('harcama', cur);
  }
  var HR_TABS = [['ozet', 'Özet'], ['ulasim', 'Kategori · Ulaşım'], ['donor', 'Donörler'], ['sehir', 'Şehir'], ['aylik', 'Aylık'], ['yillar', 'Yıl karşılaştırma']];
  function scrHarcama() {
    var card = function (t, inner, note) { return '<div class="card pad"><h2>' + h(t) + '</h2>' + inner + (note ? '<div class="note">' + h(note) + '</div>' : '') + '</div>'; };
    var kpi = function (n, l, s2) { return '<div class="kpi"><div class="n">' + h(n) + '</div><div class="l">' + h(l) + '</div>' + (s2 ? '<div class="l" style="margin-top:4px">' + h(s2) + '</div>' : '') + '</div>'; };
    var html = '<div class="page flush">' + hrToolbar('/harcama');
    if (!hrows.length) {
      return { title: 'Harcama Dashboard', html: html + '<div class="page">' + emptyBox('Harcama kaydı yok', 'Harcama Kayıtları’ndan harcama ekleyin ya da Excel’den (Donor_Harcama_Dashboard) alın.') +
        '<button class="btn pri block" data-act="hrImportPick" style="margin-top:10px">' + I.up + 'Excel’den harcamaları al</button></div></div>' };
    }
    var R = HR.dashboard(state, D, hrows, { yil: ui.hrYil, today: today }), Y = R.Y, P = R.P, ay = DT.AYLAR[R.ayMax - 1];
    var tab = ui.hrTab || 'ozet';
    html += '<div class="seg sub">' + HR_TABS.map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="hrTab" data-v="' + t[0] + '">' + h(t[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="toolbar"><select class="inp" data-ui="hrYil" style="flex:none;width:auto">' + R.yillar.map(function (y) { return '<option value="' + y + '"' + (y === Y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
      '<span class="small muted grow">Karşılaştırma: ' + Y + ' ve ' + P + (R.ayMax < 12 ? ' · aynı dönem Ocak–' + ay : '') + '</span>' +
      '<button class="btn" data-act="hrExport" style="flex:none">' + I.down + 'Excel</button><button class="btn" data-act="rpAc" data-v="harcama" style="flex:none">' + I.doc + 'Rapor</button></div>';
    var K = HR.KATEGORI, ulTbl = function (U) {
      return tbl(['Ulaşım türü', 'Harcama', 'Bilet / fiş', 'Ortalama', 'Pay'], U.rows.map(function (u) { return [u.ad, tl(u.tutar), u.adet, tl(u.ort), pct(u.pay)]; }), ['Toplam', tl(U.tutar), U.adet, tl(U.ort), pct(1)]);
    };
    if (tab === 'ozet') {
      html += '<div class="kpis">' + kpi(num(R.toplamDonor), 'Toplam donör', R.sehirIci + ' şehir içi · ' + R.sehirDisi + ' şehir dışı') +
        kpi(num(R.toplamaYapilan), 'Toplama yapılan', pct(R.toplamaYapilan / (R.toplamDonor || 1)) + ' başarı · ' + R.planli + ' planlı') +
        kpi(num(R.duran), 'Süreci duran', pct(R.duran / (R.toplamDonor || 1)) + ' oran') +
        kpi(tl(R.toplam), 'Toplam harcama', R.yilTablo.map(function (y) { return y.yil + ': ' + tl(y.toplam); }).join(' · ')) +
        kpi(tl(R.donorBasi), 'Donör başı ort.', R.harcamaliDonor + ' donöre harcama yapıldı') +
        kpi(num(R.refakatciliDonor), 'Refakatçili donör', 'Ort. ' + tl(R.refakatciOrt) + ' harcama') + '</div>';
      html += card('Yıllara göre harcama', barChart(R.yilTablo.map(function (y) { return String(y.yil); }), K.map(function (k) { return R.yilTablo.map(function (y) { return y.kat[k]; }); }),
        ['#2F6FB0', '#A3262A', '#D99A2B', '#5B3A8C', '#8a8f98'], K, HRCH) +
        tbl(['Yıl'].concat(K, ['Toplam', 'Satır', 'Harcamalı donör', 'Donör başı']), R.yilTablo.map(function (y) {
          return [String(y.yil)].concat(K.map(function (k) { return tl(y.kat[k]); }), [tl(y.toplam), y.satir, y.donor, tl(y.ort)]); }),
          ['Toplam'].concat(K.map(function (k) { return tl(R.katToplam[k]); }), [tl(R.toplam), hrows.length, R.harcamaliDonor, tl(R.donorBasi)])) +
        tbl(['Kategori payı'].concat(K), [['Pay'].concat(K.map(function (k) { return pct(R.katToplam[k] / (R.toplam || 1)); }))]),
        R.yillar.indexOf(P) >= 0 ? Y + ' (Oca–' + ay + ') harcaması, ' + P + '’in aynı dönemine göre ' + degisim(R.gY.toplam, R.gPa.toplam) + ' değişti.' : '');
      if (R.eslesmeyen.length) html += card('Eşleşmeyen harcama', '<div class="small">' + R.eslesmeyen.length + ' harcama satırı (' + tl(R.eslesmeyenTutar, true) + ') bir donöre bağlı değil; toplamlara dahil, donör analizlerine dahil değil.</div>' +
        '<button class="btn block" data-act="goto" data-h="/harcama/kayitlar" style="margin-top:8px" onclick="window.__hrEs=1">Eşleşmeyenleri göster</button>');
      html += card('Süreç durumu', tbl(['Durum', 'Donör', 'Pay', 'Harcama'], R.durum.map(function (d) { return [d.ad, d.n, pct(d.pay), tl(d.tutar)]; }),
        ['Toplam', R.toplamDonor, pct(1), tl(R.durum.reduce(function (a, d) { return a + d.tutar; }, 0))]));
      html += card('Yöntem ve hastane', tbl(['Yöntem / hastane', 'Donör', 'Toplama', 'Başarı', 'Harcama'], R.yontem.concat(R.hastane).map(function (r) { return [r.ad, r.n, r.top, pct(r.basari), tl(r.tutar)]; })));
    } else if (tab === 'ulasim') {
      html += card('Ulaşım türü ve harcama dağılımı', ulTbl(R.ulasim), 'Şahsi araç = akaryakıt + otopark giderleri.');
      html += card(Y + ' harcama türleri', tbl(['Tür', 'Kategori', P + ' tutar', P + ' adet', Y + ' tutar', Y + ' adet', P + ' Oca–' + ay, 'Değişim'], R.turler.map(function (t) {
        return [t.ad, t.kat, tl(t.p.tutar), t.p.adet, tl(t.y.tutar), t.y.adet, tl(t.pa.tutar), degisim(t.y.tutar, t.pa.tutar)]; })), 'Değişim: ' + Y + ' / ' + P + ' aynı dönem (Ocak–' + ay + ') − 1.');
      var C = R.ceyrek;
      html += card('Çeyreklik harcama', barChart(C.map(function (q) { return q.ad.replace('. Çeyrek', '. Ç'); }), [C.map(function (q) { return q.p.toplam; }), C.map(function (q) { return q.y.toplam; })], ['#9fb3c8', '#A3262A'], [String(P), String(Y)], HRCH) +
        tbl(['Çeyrek', P + ' ulaşım*', P + ' konaklama', P + ' yemek', P + ' toplam', Y + ' toplam'], C.map(function (q) { return [q.ad, tl(q.p.ulasim), tl(q.p.konaklama), tl(q.p.yemek), tl(q.p.toplam), tl(q.y.toplam)]; })), '* Ulaşım, akaryakıt / otopark dahil.');
    } else if (tab === 'donor') {
      html += card('Refakatçi analizi (harcaması olan donörler)', tbl(['Refakatçi', 'Donör', 'Toplam', 'Donör başı', 'Ort. ulaşım', 'Ort. konaklama', 'Ort. yemek', 'Ort. gece'], R.refakatci.map(function (f) {
        return [f.ad, f.n, tl(f.toplam), tl(f.ort), tl(f.ulasim), tl(f.konaklama), tl(f.yemek), (Math.round(f.gece * 100) / 100).toLocaleString('tr-TR')]; })),
        R.refakatci[1].ort ? 'Refakatçili donörün ortalama harcaması refakatçisize göre ' + (R.refakatci[0].ort / R.refakatci[1].ort).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kat.' : '');
      html += card('En yüksek harcamalı 10 donör', R.top10.map(function (x, i) {
        return '<button class="hrrow" data-act="donor" data-id="' + h(x.d.id) + '"><span class="rank">' + (i + 1) + '</span><span class="grow"><b>' + h(x.d.ad) + '</b><span class="small muted"><br>' + h(x.d.ikamet || '') +
          (x.h.ulasim ? ' · ' + h(x.h.ulasim) : '') + (x.h.refakatci === 'Var' ? ' · refakatçili' : '') + '</span></span><b class="amt">' + tl(x.h.toplam) + '</b></button>'; }).join(''));
      html += '<button class="btn block" data-act="goto" data-h="/harcama/donorler" style="margin:0 12px 12px">Bütün donörlerin harcaması</button>';
    } else if (tab === 'sehir') {
      html += card('Şehir içi (Ankara) ve şehir dışı', tbl(['Konum', 'Donör', 'Toplama', 'Başarı', 'Harcamalı', 'Toplam', 'Donör başı', 'Refakatçili', 'Pay'], R.konum.map(function (k) {
        return [k.ad, k.n, k.top, pct(k.basari), k.harcamali, tl(k.tutar), tl(k.ort), k.refakatcili, pct(k.pay)]; })) +
        tbl(['Konum', 'Ort. ulaşım', 'Ort. konaklama', 'Ort. yemek', 'Ort. akaryakıt', 'Ort. gece'], R.konum.map(function (k) {
          return [k.ad, tl(k.ortUlasim), tl(k.ortKonaklama), tl(k.ortYemek), tl(k.ortAkaryakit), (Math.round(k.ortGece * 100) / 100).toLocaleString('tr-TR')]; })),
        'Şehir içi = ikamet ili Ankara. ' + (R.konum[0].ort ? 'Şehir dışı bağışçının ortalama harcaması şehir içine göre ' + (R.konum[1].ort / R.konum[0].ort).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kat.' : ''));
      html += '<div class="kpis">' + kpi(tl(R.disUlasim), 'Şehir dışı ulaşım*') + kpi(tl(R.disKonaklama), 'Şehir dışı konaklama') + kpi(num(R.disHarcamali), 'Harcamalı şehir dışı donör') + '</div>';
      html += card('Şehir dışı · yıllara göre', tbl(['Yıl', 'Harcamalı donör', 'Ulaşım', 'Akaryakıt / otopark'], R.disYil.map(function (y) { return [String(y.yil), y.donor, tl(y.ulasim), tl(y.akaryakit)]; })) + ulTbl(R.disUlasimTur),
        '* Ulaşım toplamına şahsi araç (akaryakıt / otopark) giderleri dahildir.');
      html += card('Şehir dışı iller · donör ve başarı', tbl(['İl', 'Donör', 'Toplama', 'Başarı', 'Harcama', 'Donör başı'], R.iller.map(function (r) { return [r.il, r.n, r.top, pct(r.basari), tl(r.tutar), tl(r.ort)]; })));
      html += card('İllere göre ulaşım + konaklama', tbl(['İl', 'Harcamalı donör', 'Ulaşım*', 'Konaklama', 'Toplam'], R.illerMaliyet.map(function (r) { return [r.il, r.harcamali, tl(r.ulasim), tl(r.konaklama), tl(r.ulasim + r.konaklama)]; })));
      var KY = R.konumYil, satir = [['Donör kaydı (SK yılı)', 'kayit', 0], ['Toplama yapılan', 'top', 0], ['Toplam harcama', 'toplam', 1], ['Harcama satırı', 'satir', 0], ['Harcamalı donör', 'donor', 0],
        ['Donör başı', 'ort', 1], ['Ulaşım*', 'ulasim', 1], ['Konaklama', 'konaklama', 1], ['Yemek', 'yemek', 1], ['Donör başı ulaşım', 'dbUlasim', 1], ['Donör başı konaklama', 'dbKonaklama', 1], ['Donör başı yemek', 'dbYemek', 1], ['Yıl içindeki payı', 'pay', 2]];
      KY.forEach(function (k) {
        html += card(k.ad + ' · yıllara göre', tbl(['Gösterge', String(P), String(Y), P + ' Oca–' + ay, 'Değişim'], satir.map(function (s2) {
          var f = s2[2] === 1 ? tl : s2[2] === 2 ? pct : num;
          return [s2[0], f(k.p[s2[1]]), f(k.y[s2[1]]), f(k.pa[s2[1]]), s2[2] === 2 ? (((k.y[s2[1]] - k.pa[s2[1]]) * 100) >= 0 ? '+' : '') + ((k.y[s2[1]] - k.pa[s2[1]]) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' puan' : degisim(k.y[s2[1]], k.pa[s2[1]])]; })));
      });
    } else if (tab === 'aylik') {
      html += card('Aylık harcama · ' + P + ' ve ' + Y, barChart(DT.AYLAR.map(function (a) { return a.slice(0, 3); }), [R.aylik.map(function (m) { return m.p; }), R.aylik.map(function (m) { return m.y; })], ['#9fb3c8', '#A3262A'], [String(P), String(Y)], HRCH) +
        tbl(['Ay', String(P), String(Y), 'Değişim'], R.aylik.map(function (m, i) { return [m.ad, tl(m.p), i < R.ayMax ? tl(m.y) : '–', i < R.ayMax ? degisim(m.y, m.p) : '']; }),
          ['Toplam', tl(R.aylik.reduce(function (a, m) { return a + m.p; }, 0)), tl(R.aylik.reduce(function (a, m) { return a + m.y; }, 0)), '']), Y + ' verisi ' + ay + ' sonuna kadar.');
    } else if (tab === 'yillar') {
      var g = [['Toplam harcama', 'toplam', 1], ['Harcama satırı', 'satir', 0], ['Harcamalı donör', 'donor', 0], ['Donör başı ortalama', 'ort', 1], ['En yüksek donör harcaması', 'enYuksek', 1],
        ['Ulaşım (akaryakıt dahil)', 'ulasim', 1], ['Konaklama', 'konaklama', 1], ['Yemek', 'yemek', 1], ['Donör başı ulaşım', 'dbUlasim', 1], ['Donör başı konaklama', 'dbKonaklama', 1], ['Donör başı yemek', 'dbYemek', 1],
        ['Ulaşımın payı', 'payUlasim', 2], ['Konaklamanın payı', 'payKonaklama', 2], ['Şehir dışı bağışçı payı', 'payDis', 2], ['Ortalama uçak bileti', 'ucak', 1], ['Ortalama otobüs bileti', 'otobus', 1],
        ['Ortalama konaklama fişi', 'konaklamaFis', 1], ['Ortalama yemek fişi', 'yemekFis', 1]];
      html += card('Göstergeler · ' + P + ' ve ' + Y, tbl(['Gösterge', String(P), String(Y), P + ' Oca–' + ay, 'Değişim'], g.map(function (s2) {
        var f = s2[2] === 1 ? tl : s2[2] === 2 ? pct : num, a = R.gY[s2[1]], b = R.gPa[s2[1]];
        return [s2[0], f(R.gP[s2[1]]), f(a), f(b), s2[2] === 2 ? (((a - b) * 100) >= 0 ? '+' : '') + ((a - b) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' puan' : degisim(a, b)]; })),
        Y + ' ile ' + P + '’in aynı dönemi (Ocak–' + ay + ') karşılaştırılır; pay satırlarında yüzde puan farkı.');
    }
    return { title: 'Harcama Dashboard', html: html + '</div>' };
  }
  function scrHrKayit() {
    var es = window.__hrEs; window.__hrEs = 0;
    if (es) ui.hrKat = 'eslesmeyen';
    var years = {}; hrows.forEach(function (o) { if (o.yil) years[o.yil] = 1; });
    var q = DT.fold(ui.hrAra || ''), kat = ui.hrKat || '', yil = ui.hrKYil || '';
    var list = hrows.filter(function (o) {
      if (yil && String(o.yil) !== String(yil)) return false;
      if (kat === 'eslesmeyen') { if (o.x) return false; } else if (kat && o.r.kategori !== kat) return false;
      if (q) { var t = DT.fold([o.x ? o.x.d.ad : o.r.ad, o.x ? o.x.d.hk : '', o.r.detay, o.r.not].join(' ')); if (t.indexOf(q) < 0) return false; }
      return true;
    }).sort(function (a, b) { return (b.r.tarih || 0) - (a.r.tarih || 0); });
    var top = list.reduce(function (a, o) { return a + o.tutar; }, 0), MAX = 300;
    var html = '<div class="page flush">' + hrToolbar('/harcama/kayitlar') +
      '<div class="toolbar"><div class="search grow">' + I.search + '<input class="inp" type="search" placeholder="Donör, hasta kodu, tür, not…" value="' + h(ui.hrAra || '') + '" data-ui="hrAra"></div></div>' +
      '<div class="toolbar"><select class="inp" data-ui="hrKYil"><option value="">Tüm yıllar</option>' + Object.keys(years).sort().map(function (y) { return '<option' + (String(y) === String(yil) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-ui="hrKat"><option value="">Tüm kategoriler</option>' + HR.KATEGORI.map(function (k) { return '<option' + (k === kat ? ' selected' : '') + '>' + h(k) + '</option>'; }).join('') +
      '<option value="eslesmeyen"' + (kat === 'eslesmeyen' ? ' selected' : '') + '>Eşleşmeyen</option></select></div>' +
      '<div class="summary">' + list.length + ' harcama · <b>' + tl(top, true) + '</b></div>' +
      '<div class="btns" style="margin:0 12px 10px"><button class="btn pri" data-act="hrNew">' + I.plus + 'Harcama ekle</button><button class="btn" data-act="hrImportPick">' + I.up + 'Excel’den al</button></div>' +
      '<div class="card">' + (list.length ? list.slice(0, MAX).map(function (o) {
        var r = o.r;
        return '<button class="hrrow" data-act="hrEdit" data-id="' + h(r.id) + '"><span class="grow"><b>' + h(o.x ? o.x.d.ad : (r.ad || '—')) + '</b>' + (o.x ? '' : ' <span class="small" style="color:var(--orange)">eşleşmedi</span>') +
          '<span class="small muted"><br>' + h(DT.fmt(r.tarih)) + ' · ' + h(r.detay) + (r.refakatci ? ' · refakatçi ' + h(r.refakatci.toLocaleLowerCase('tr-TR')) : '') + (r.not ? ' · ' + h(r.not) : '') + '</span></span><b class="amt">' + tl(r.tutar, true) + '</b></button>';
      }).join('') + (list.length > MAX ? '<div class="note" style="padding:10px">İlk ' + MAX + ' satır gösteriliyor; aramayı daraltın.</div>' : '') : emptyBox('Harcama yok', '')) + '</div></div>';
    return { title: 'Harcama Kayıtları', html: html, actions: '<button class="icon" data-act="hrExport" aria-label="Excel’e aktar">' + I.down + '</button>' };
  }
  function scrHrDonor() {
    var q = DT.fold(ui.hrDAra || ''), sirala = ui.hrDSira || 'toplam';
    var list = D.filter(function (x) { return (S(x.d.hk) || S(x.d.ad)) && (ui.hrDHepsi || x.h.toplam > 0); }).filter(function (x) {
      return !q || DT.fold([x.d.ad, x.d.hk, x.d.ikamet, x.h.il].join(' ')).indexOf(q) >= 0;
    }).sort(sirala === 'ad' ? function (a, b) { return S(a.d.ad).localeCompare(S(b.d.ad), 'tr'); } : sirala === 'tarih' ? function (a, b) { return (b.d.top || b.d.sk || 0) - (a.d.top || a.d.sk || 0); } :
      function (a, b) { return b.h.toplam - a.h.toplam; });
    var html = '<div class="page flush">' + hrToolbar('/harcama/donorler') +
      '<div class="toolbar"><div class="search grow">' + I.search + '<input class="inp" type="search" placeholder="Ad, hasta kodu, il…" value="' + h(ui.hrDAra || '') + '" data-ui="hrDAra"></div>' +
      '<select class="inp" data-ui="hrDSira" style="flex:none;width:auto"><option value="toplam"' + (sirala === 'toplam' ? ' selected' : '') + '>Harcamaya göre</option><option value="tarih"' + (sirala === 'tarih' ? ' selected' : '') + '>Tarihe göre</option><option value="ad"' + (sirala === 'ad' ? ' selected' : '') + '>Ada göre</option></select></div>' +
      '<label class="opt" style="margin:0 14px 8px"><input type="checkbox" data-ui="hrDHepsi"' + (ui.hrDHepsi ? ' checked' : '') + '><span>Harcaması olmayan donörleri de göster</span></label>' +
      '<div class="summary">' + list.length + ' donör · <b>' + tl(list.reduce(function (a, x) { return a + x.h.toplam; }, 0)) + '</b></div><div class="card">' +
      list.slice(0, 300).map(function (x) {
        var hh = x.h;
        return '<button class="hrrow" data-act="donor" data-id="' + h(x.d.id) + '"><span class="grow"><b>' + h(x.d.ad || x.d.hk) + '</b><span class="small muted"> · ' + h(hh.il || '—') + ' · ' + h(hh.konum) + '</span>' +
          '<span class="small muted"><br>' + h(hh.grup) + (hh.ulasim ? ' · ' + h(hh.ulasim) : '') + (hh.refakatci ? ' · refakatçi ' + h(hh.refakatci.toLocaleLowerCase('tr-TR')) : '') + (hh.gece ? ' · ' + hh.gece + ' gece' : '') + '</span>' +
          (hh.toplam ? '<span class="small"><br>' + HR.KATEGORI.filter(function (k) { return hh.kat[k]; }).map(function (k) { return h(k) + ' ' + tl(hh.kat[k]); }).join(' · ') + '</span>' : '') +
          '</span><b class="amt">' + (hh.toplam ? tl(hh.toplam) : '–') + '</b></button>';
      }).join('') + '</div></div>';
    return { title: 'Donör Harcama', html: html, actions: '<button class="icon" data-act="hrExport" aria-label="Excel’e aktar">' + I.down + '</button>' };
  }

  /* ---------------- Yemek kartı (MetropolCard yükleme detayı) ---------------- */
  function ykSatir(o) {
    var r = o.r;
    return '<button class="hrrow" data-act="ykEdit" data-id="' + h(r.id) + '"><span class="grow"><b>' + h(DT.fmt(r.tarih)) + (r.saat ? ' ' + h(r.saat) : '') + '</b>' +
      '<span class="pillx yk" style="background:' + YK.RENK[o.asama] + '">' + h(o.asama) + '</span>' +
      '<span class="small muted"><br>' + h(o.sebep) + (r.tutar < 0 ? ' · iade' : '') + '</span></span><b class="amt' + (r.tutar < 0 ? ' neg' : '') + '">' + tl(r.tutar, true) + '</b></button>';
  }
  function ykDonem() {
    var k = ui.ykAy || '';
    if (!k) return { from: null, to: null, ad: 'Tüm yüklemeler' };
    var a = k.split('-'), y = +a[0], m = +a[1];
    return { from: DT.serial(y, m, 1), to: DT.serial(y, m + 1, 1) - 1, ad: DT.AYLAR[m - 1] + ' ' + y };
  }
  function scrYemek() {
    var html = '<div class="page flush">' + hrToolbar('/harcama/yemek');
    var top0 = (state.yemekKart || []).length;
    if (!top0) {
      return { title: 'Yemek Kartı', html: html + '<div class="page">' + emptyBox('Yemek kartı yüklemesi yok', 'MetropolCard’dan aldığınız Yükleme Detay Raporu Excel’ini seçin. Uygulama her yüklemeyi donöre bağlar ve tarihine göre sağlık kontrolü, aşı + toplama, toplama süreci olarak ayırır.') +
        '<button class="btn pri block" data-act="ykPick" style="margin-top:10px">' + I.up + 'Yükleme detayı Excel’ini seç</button></div></div>' };
    }
    var aylar = {}; yrows.forEach(function (o) { var p0 = DT.parts(o.r.tarih); aylar[p0.y + '-' + ('0' + p0.m).slice(-2)] = 1; });
    var ayList = Object.keys(aylar).sort().reverse(), P0 = ykDonem();
    var rows = yrows.filter(function (o) { return P0.from == null || (o.r.tarih >= P0.from && o.r.tarih <= P0.to); });
    var tab = ui.ykTab || 'ozet', toplam = rows.reduce(function (a, o) { return a + o.tutar; }, 0);
    var donor = {}; rows.forEach(function (o) { donor[o.x ? o.x.d.id : 'e:' + o.r.ad] = 1; });
    var nd = Object.keys(donor).length, es = rows.filter(function (o) { return !o.x; }).length, iade = rows.filter(function (o) { return o.tutar < 0; });
    html += '<div class="seg sub">' + [['ozet', 'Özet'], ['liste', 'Yüklemeler']].map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="ykTab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="toolbar"><select class="inp" data-ui="ykAy"><option value="">Tüm aylar</option>' + ayList.map(function (k) { var a = k.split('-'); return '<option value="' + k + '"' + (ui.ykAy === k ? ' selected' : '') + '>' + DT.AYLAR[+a[1] - 1] + ' ' + a[0] + '</option>'; }).join('') + '</select>' +
      '<button class="btn" data-act="ykPick" style="flex:none">' + I.up + 'Excel’den al</button><button class="btn" data-act="rpAc" data-v="yemek" style="flex:none">' + I.doc + 'Rapor</button></div>';
    if (tab === 'liste') {
      var q = DT.fold(ui.ykAra || ''), asm = ui.ykAsama || '';
      var list = rows.filter(function (o) { return (!asm || o.asama === asm) && (!q || DT.fold((o.x ? o.x.d.ad + ' ' + o.x.d.hk : '') + ' ' + o.r.ad + ' ' + o.r.aciklama).indexOf(q) >= 0); })
        .sort(function (a, b) { return b.r.tarih - a.r.tarih || S(b.r.saat).localeCompare(S(a.r.saat)); });
      html += '<div class="toolbar"><div class="search grow">' + I.search + '<input class="inp" type="search" placeholder="Ad, hasta kodu…" value="' + h(ui.ykAra || '') + '" data-ui="ykAra"></div>' +
        '<select class="inp" data-ui="ykAsama" style="flex:none;width:auto"><option value="">Tüm aşamalar</option>' + YK.ASAMA.map(function (a) { return '<option' + (asm === a ? ' selected' : '') + '>' + h(a) + '</option>'; }).join('') + '</select></div>' +
        '<div class="summary">' + list.length + ' yükleme · <b>' + tl(list.reduce(function (a, o) { return a + o.tutar; }, 0), true) + '</b> · Aşamayı değiştirmek için yüklemeye dokunun.</div><div class="card">' +
        list.slice(0, 400).map(function (o) {
          var r = o.r;
          return '<button class="hrrow" data-act="ykEdit" data-id="' + h(r.id) + '"><span class="grow"><b>' + h(o.x ? o.x.d.ad : r.ad) + '</b>' + (o.x ? '' : ' <span class="pillx p-red">donör bulunamadı</span>') +
            '<span class="small muted"><br>' + h(DT.fmt(r.tarih)) + (r.saat ? ' ' + h(r.saat) : '') + (o.x && o.x.d.hk ? ' · ' + h(o.x.d.hk) : '') + '</span>' +
            '<span class="small"><br><span class="pillx yk" style="background:' + YK.RENK[o.asama] + ';margin-left:0">' + h(o.asama) + '</span> ' + (o.oto ? '' : '<b>elle</b> · ') + h(o.oto ? o.sebep : '') + '</span></span>' +
            '<b class="amt' + (r.tutar < 0 ? ' neg' : '') + '">' + tl(r.tutar, true) + '</b></button>';
        }).join('') + (list.length ? '' : emptyBox('Eşleşen yükleme yok')) + '</div></div>';
      return { title: 'Yemek Kartı', html: html };
    }
    html += '<div class="kpis rpkpis">' + [[tl(toplam), 'Toplam yükleme'], [num(rows.length), 'Yükleme'], [num(nd), 'Donör'], [tl(nd ? toplam / nd : 0), 'Donör başı ortalama'],
      [iade.length ? tl(iade.reduce(function (a, o) { return a + o.tutar; }, 0)) : '–', 'İade / geri çekim'], [num(es), 'Donörü bulunamayan']].map(function (k) {
      return '<div class="kpi"><div class="n">' + h(k[0]) + '</div><div class="l">' + h(k[1]) + '</div></div>'; }).join('') + '</div>';
    var asamaTop = {}, asamaN = {}, asamaD = {};
    YK.ASAMA.forEach(function (a) { asamaTop[a] = 0; asamaN[a] = 0; asamaD[a] = {}; });
    rows.forEach(function (o) { asamaTop[o.asama] += o.tutar; asamaN[o.asama]++; asamaD[o.asama][o.x ? o.x.d.id : 'e:' + o.r.ad] = 1; });
    var mx = Math.max.apply(null, YK.ASAMA.map(function (a) { return asamaTop[a]; }).concat([1]));
    html += '<div class="card pad"><h2>Aşamalara göre · ' + h(P0.ad) + '</h2><div class="ykasama">' + YK.ASAMA.map(function (a) {
      var nd2 = Object.keys(asamaD[a]).length;
      return '<div><div class="t"><span class="dot" style="background:' + YK.RENK[a] + '"></span><b>' + h(a) + '</b><span class="grow"></span><b>' + tl(asamaTop[a], true) + '</b></div>' +
        '<div class="b"><i style="width:' + Math.max(0, asamaTop[a] / mx * 100).toFixed(1) + '%;background:' + YK.RENK[a] + '"></i></div>' +
        '<div class="small muted">' + asamaN[a] + ' yükleme · ' + nd2 + ' donör' + (nd2 ? ' · donör başı ' + tl(asamaTop[a] / nd2) : '') + ' · ' + pct(toplam ? asamaTop[a] / toplam : null) + '</div></div>';
    }).join('') + '</div><div class="note">Aşama, yükleme tarihinin donörün sağlık kontrolü, aşı ve toplama tarihlerine göre bulunur. Toplama döneminde aşı günlerinde de yükleme varsa “Aşı + toplama”, yalnızca toplama günlerinde ise “Toplama süreci” sayılır. Yanlışsa Yüklemeler’den değiştirin.</div></div>';
    // her aşamanın alt başlığı: donörler
    YK.ASAMA.forEach(function (a) {
      var b = rows.filter(function (o) { return o.asama === a; });
      if (!b.length) return;
      var m = {}, dl = [];
      b.forEach(function (o) { var k = o.x ? o.x.d.id : 'e:' + o.r.ad, d = m[k]; if (!d) { d = m[k] = { o: o, t: 0, n: 0, g: [] }; dl.push(d); } d.t += o.tutar; d.n++; var g = DT.fmtShort(o.r.tarih); if (d.g.indexOf(g) < 0) d.g.push(g); });
      dl.sort(function (p, q2) { return q2.t - p.t; });
      html += '<div class="sec-title" style="display:flex;align-items:center;gap:8px"><span class="dot" style="background:' + YK.RENK[a] + '"></span>' + h(a) + ' · ' + tl(asamaTop[a]) + '</div><div class="card">' + dl.map(function (d) {
        var o = d.o, x = o.x;
        return '<button class="hrrow" ' + (x ? 'data-act="donor" data-id="' + h(x.d.id) + '"' : 'data-act="ykEdit" data-id="' + h(o.r.id) + '"') + '><span class="grow"><b>' + h(x ? x.d.ad : o.r.ad) + '</b>' +
          (x ? '<span class="small muted"> · ' + h(x.d.hk || '') + '</span>' : ' <span class="pillx p-red">donör bulunamadı</span>') +
          '<span class="small muted"><br>' + h(o.oto ? o.sebep : 'Elle seçildi') + '</span><span class="small"><br>' + d.n + ' yükleme · ' + h(d.g.join(', ')) + '</span></span><b class="amt">' + tl(d.t) + '</b></button>';
      }).join('') + '</div>';
    });
    if (ayList.length > 1 && !ui.ykAy) {
      html += '<div class="card pad" style="margin-top:12px"><h2>Aylara göre</h2>' + tbl(['Ay'].concat(YK.ASAMA, ['Toplam']), ayList.slice().reverse().map(function (k) {
        var a = k.split('-'), y = +a[0], mm = +a[1], b = rows.filter(function (o) { var p0 = DT.parts(o.r.tarih); return p0.y === y && p0.m === mm; });
        return [DT.AYLAR[mm - 1].slice(0, 3) + ' ' + y].concat(YK.ASAMA.map(function (as) { return tl(b.filter(function (o) { return o.asama === as; }).reduce(function (s2, o) { return s2 + o.tutar; }, 0)); }), [tl(b.reduce(function (s2, o) { return s2 + o.tutar; }, 0))]);
      })) + '</div>';
    }
    html += '</div>';
    return { title: 'Yemek Kartı', html: html, actions: '<button class="icon" data-act="ykExcel" aria-label="Excel’e aktar">' + I.down + '</button>' };
  }
  function ykImport(buf, name) {
    busy(true, 'Yükleme detayı okunuyor…');
    YK.importWorkbook(buf).then(function (res) {
      busy(false);
      var rp = res.rapor, mg = YK.merge(state.yemekKart || [], res.rows);
      // yeni gelenlerin kaçı donöre bağlanıyor (önizleme)
      var tmp = { yemekKart: mg.list, ekKons: state.ekKons }, rr = YK.derive(tmp, D), yeniId = {};
      res.rows.forEach(function (r) { yeniId[r.id] = 1; });
      var yeni = rr.filter(function (o) { return yeniId[o.r.id]; }), bag = yeni.filter(function (o) { return o.x; }).length;
      var asm = YK.ASAMA.map(function (a) { var t = yeni.filter(function (o) { return o.asama === a; }).reduce(function (s2, o) { return s2 + o.tutar; }, 0); return t ? a + ' ' + tl(t) : ''; }).filter(Boolean).join(' · ');
      recompute();
      if (!rp.satir) { toast('Dosyada yükleme satırı bulunamadı'); return; }
      confirmSheet('Yemek kartı yüklemeleri', name + '\n\n' + rp.satir + ' yükleme · ' + tl(rp.toplam, true) + (rp.iade ? ' (' + rp.iade + ' iade dahil)' : '') + '\n' + DT.fmt(rp.ilk) + ' – ' + DT.fmt(rp.son) +
        '\n\n' + (mg.ayni ? mg.ayni + ' yükleme zaten vardı, tekrar eklenmeyecek.\n' : '') + mg.eklenen + ' yeni yükleme eklenecek' + (mg.eklenen ? ': ' + bag + ' tanesi donöre bağlandı' + (mg.eklenen - bag ? ', ' + (mg.eklenen - bag) + ' tanesinin donörü bulunamadı' : '') + '.\n' + asm : '.'),
        mg.eklenen ? 'Ekle' : 'Tamam', false, function () {
          if (!mg.eklenen) return;
          state.yemekKart = mg.list; commit(); toast(mg.eklenen + ' yükleme eklendi');
          if (route()[1] !== 'yemek') go('/harcama/yemek');
        });
    }).catch(function (e) { busy(false); recompute(); toast('Okunamadı: ' + e.message); });
  }
  function ykForm(id) {
    var o = yrows.filter(function (z) { return z.r.id === id; })[0];
    if (!o) return;
    var r = o.r, oto = o.oto ? o.asama : o.otoAsama;
    var donors = D.filter(function (x) { return S(x.d.hk) || S(x.d.ad); }).sort(function (a, b) { return (b.d.top || b.d.sk || 0) - (a.d.top || a.d.sk || 0); });
    var cur = r.donorId || '';
    var dopts = '<option value=""' + (!cur ? ' selected' : '') + '>Otomatik' + (!r.donorId && o.x ? ' (' + h(o.x.d.ad) + (o.x.d.hk ? ' · ' + h(o.x.d.hk) : '') + ')' : !r.donorId ? ' (bulunamadı)' : '') + '</option>' +
      donors.map(function (x) { return '<option value="' + h(x.d.id) + '"' + (x.d.id === cur ? ' selected' : '') + '>' + h([x.d.ad, x.d.hk].filter(Boolean).join(' · ')) + (x.d.sk != null ? ' · SK ' + DT.fmt(x.d.sk) : '') + '</option>'; }).join('');
    openSheet('<h3>Yemek kartı yüklemesi</h3><div class="sub">' + h(DT.fmt(r.tarih)) + (r.saat ? ' ' + h(r.saat) : '') + ' · ' + h(r.ad) + ' · <b>' + tl(r.tutar, true) + '</b>' + (r.kart4 ? ' · kart …' + h(r.kart4) : '') + '</div>' +
      (r.aciklama || r.aciklama2 ? '<div class="calc small" style="margin-bottom:12px">' + h(r.aciklama) + (r.aciklama2 && r.aciklama2 !== r.aciklama ? '<br>' + h(r.aciklama2) : '') + '</div>' : '') +
      '<form id="ykform"><div class="field"><label>Aşama</label><div class="radios">' + [''].concat(YK.ASAMA).map(function (a) {
        var on = (r.asama || '') === a;
        return '<label class="' + (on ? 'on' : '') + '"><input type="radio" name="asama" value="' + h(a) + '"' + (on ? ' checked' : '') + '>' + (a ? h(a) : 'Otomatik: ' + h(oto)) + '</label>';
      }).join('') + '</div></div>' +
      '<div class="field"><label>Donör</label><select class="inp" name="donor">' + dopts + '</select><div class="hint">' + h(o.oto ? o.sebep : 'Aşama elle seçildi · otomatik: ' + oto) + '</div></div>' +
      '<div class="btns"><button type="button" class="btn danger" id="ykDel">Sil</button><button class="btn pri">Kaydet</button></div></form>');
    var f = $('#ykform');
    f.addEventListener('change', function () { f.querySelectorAll('.radios label').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var a = (f.querySelector('input[name=asama]:checked') || {}).value || '';
      r.asama = a || null; r.donorId = f.donor.value || null;
      closeSheet(); commit(); toast('Kaydedildi');
    });
    $('#ykDel').onclick = function () {
      confirmSheet('Yüklemeyi sil', DT.fmt(r.tarih) + ' · ' + r.ad + ' · ' + tl(r.tutar, true), 'Sil', true, function () {
        state.yemekKart = state.yemekKart.filter(function (z) { return z.id !== r.id; }); commit(); toast('Silindi');
      });
    };
  }

  function scrIsYuku() {
    var P = periodOf('iy'), R = DT.isYuku(state, D, pool, P.from, P.to), kesim = DT.kesimOf(state);
    var card = function (t, inner, note) { return '<div class="card pad"><h2>' + h(t) + '</h2>' + inner + (note ? '<div class="note">' + h(note) + '</div>' : '') + '</div>'; };
    var tur = state.lists.isTuru || DT.IS_TURU;
    var html = '<div class="page flush">' + groupSeg('dashboard', '/dash/isyuku') + periodBar('iy') +
      '<div class="summary">Dönem: ' + h(P.label) + ' · ' + (kesim != null ? 'Görev Kayıtları + ' + DT.fmt(kesim) + ' sonrası programdan canlı sayım' : 'programdaki görevlerden canlı sayım (Görev Kayıtları boş)') + '.</div>' +
      (state.gorevKayit.length ? '' : arsivCard('Görev Kayıtları'));
    html += card('Personel özeti', tbl(['Personel', 'Toplam', 'Kayıtlardan', 'Programdan (canlı)', 'Görevli gün', 'Hafta sonu', 'İzin günü'], R.rows.map(function (r) { return [r.ad, r.toplam, r.kayit, r.canli, r.gunN, r.hsonuN, r.izinN]; })),
      'Görevli gün: en az bir görevi olan farklı günler (izin hariç).');
    html += card('Görev türüne göre', tbl(['Personel'].concat(tur.filter(function (t) { return t !== 'İzin'; })), R.rows.map(function (r) { return [r.ad].concat(tur.filter(function (t) { return t !== 'İzin'; }).map(function (t) { return r.tur[t] || 0; })); })));
    var grups = ['Bağışçı takibi', 'Transfer', 'Ürün taşıma', 'Bağışçı kazanımı', 'Ofis / lab / koordinasyon', 'Kargo, eğitim ve diğer'];
    var named = R.rows.filter(function (r) { return r.toplam; });
    html += card('Ana gruplar', named.length ? barChart(named.map(function (r) { return r.ad; }), grups.slice(0, 3).map(function (g) { return named.map(function (r) { return r.ana[g] || 0; }); }), ['#2F6FB0', '#1E6B3A', '#8A6D0B'], grups.slice(0, 3)) +
      tbl(['Personel'].concat(grups), named.map(function (r) { return [r.ad].concat(grups.map(function (g) { return r.ana[g] || 0; })); })) : emptyBox('Bu dönemde görev yok'));
    if (P.y) {
      var byP = {}; R.recs.forEach(function (rec) { if (rec.tur === 'İzin') return; var n = DT.inPersonel(state.lists, rec.personel) || 'Diğer / listede yok'; var m = DT.parts(rec.tarih); var o = byP[n] = byP[n] || { ad: n, ay: {} }; var key = m.y + '-' + pad2(m.m); o.ay[key] = (o.ay[key] || 0) + 1; });
      html += card('Aylık görev sayısı · ' + P.y, monthTable(Object.keys(byP).map(function (k) { return byP[k]; }), P.y));
    }
    return { title: 'İş Yükü', html: html + '</div>' };
  }
  function scrTasimaIst() {
    var P = periodOf('ts'), R = DT.tasimaStats(state, D, pool, P.from, P.to);
    var card = function (t, inner, note) { return '<div class="card pad"><h2>' + h(t) + '</h2>' + inner + (note ? '<div class="note">' + h(note) + '</div>' : '') + '</div>'; };
    var tot = R.rows.reduce(function (a, r) { return [a[0] + r.ic, a[1] + r.dis, a[2] + r.bizzat, a[3] + r.kurye, a[4] + r.toplam, a[5] + r.benzersiz]; }, [0, 0, 0, 0, 0, 0]);
    var html = '<div class="page flush">' + groupSeg('dashboard', '/dash/tasima') + periodBar('ts') + '<div class="summary">Dönem: ' + h(P.label) + ' · ' + R.n + ' taşıma · Taşıma Kayıtları + programdan gelen taşımalar (yurt dışı hariç).</div>' +
      (state.tasimaKayit.length ? '' : arsivCard('Taşıma Kayıtları')) +
      '<div class="kpis">' + [[tot[4], 'Toplam taşıma'], [tot[0], 'Şehir içi'], [tot[1], 'Şehir dışı'], [tot[2], 'Bizzat gitti'], [tot[3], 'Kurye karşılama / teslim'], [tot[5], 'Benzersiz taşıma']].map(function (k) {
        return '<div class="kpi"><div class="n">' + num(k[0]) + '</div><div class="l">' + h(k[1]) + '</div></div>'; }).join('') + '</div>';
    html += card('Personel başına', tbl(['Personel', 'Şehir içi', 'Şehir dışı', 'Bizzat', 'Kurye', 'Toplam', 'Benzersiz'], R.rows.map(function (r) { return [r.ad, r.ic, r.dis, r.bizzat, r.kurye, r.toplam, r.benzersiz]; }), ['Toplam'].concat(tot.slice(0, 2), tot.slice(2, 4), [tot[4], tot[5]])),
      'Şehir dışında AÇIKLAMA’da “kurye” geçiyorsa yöntem kurye karşılama / teslim sayılır.');
    html += card('Karşı şehir (şehir dışı)', R.sehirler.length ? tbl(['Şehir', 'Taşıma'], R.sehirler.map(function (c) { return [c.ad, c.n]; })) : emptyBox('Şehir dışı taşıma yok'));
    if (P.y) html += card('Aylık dağılım · ' + P.y, monthTable(R.rows.filter(function (r) { return r.toplam; }), P.y));
    return { title: 'Taşıma İstatistiği', html: html + '</div>' };
  }

  /* ================= EŞLEŞME (YENİ EŞLEŞME TABLOSU OABKM) ================= */
  // Kayıtlar IndexedDB'de ("eslesme") tutulur; istatistikler ES modülünde Excel formülleriyle aynı hesaplanır
  var esData = null, esCache = {}, esSaveTimer = null;
  function esYukle() {
    var bitti = function (d) { esData = d && d.kayitlar ? d : { kayitlar: [], bas: 2015 }; esCache = {}; var p = route(); if (!p.length || p[0] === 'es' || (p[0] === 'g' && p[1] === 'eslesme')) render(true); };
    IDB.get('eslesme').then(bitti, function () { bitti(null); });
  }
  function esDegisti() {
    esCache = {};
    clearTimeout(esSaveTimer);
    esSaveTimer = setTimeout(function () { IDB.put('eslesme', esData).catch(function () { toast('Eşleşme kayıtları saklanamadı'); }); }, 250);
  }
  function esStats() { if (!esCache.stats) esCache.stats = ES.stats(esData, today); return esCache.stats; }
  function esKontrol() { if (!esCache.kontrol) esCache.kontrol = ES.kontrol(esData, today); return esCache.kontrol; }
  function esKontrolSay() { return esKontrol().reduce(function (a, k) { return a + k.n; }, 0); }
  function esBul(id) { return (esData.kayitlar || []).filter(function (r) { return r.id === id; })[0] || null; }
  function esV(v) { return ES.bos(v) ? '' : S(v).trim(); }
  function esDurumCls(r) {
    var d = DT.fold(esV(r.durum));
    if (!d) return ES.eqx(r.nDurum, 'Alındı') ? 'p-red' : 'p-pri';
    if (d === 'nakil') return 'p-top';
    if (/rezerve/.test(d)) return 'p-asi';
    if (/serbest/.test(d)) return 'p-sk';
    return 'p-grey';
  }
  function esDurumAd(r) { return esV(r.durum) || (ES.eqx(r.nDurum, 'Alındı') ? 'Sonuç girilmemiş' : esV(r.nDurum) || 'Durum yok'); }
  function esBos(baslik) {
    return '<div class="card pad"><h2>' + h(baslik || 'Eşleşme tablosunu yükleyin') + '</h2><div class="small muted" style="margin-bottom:12px">YENİ EŞLEŞME TABLOSU OABKM Excel dosyanızı seçin; ANA TABLO’daki bütün eşleşmeler uygulamaya alınır, istatistikler Excel’deki gibi hesaplanır. Veriler yalnızca bu telefonda saklanır.</div>' +
      '<div class="btns"><button class="btn pri" data-act="esPick">' + I.up + 'Excel dosyası seç</button><button class="btn" data-act="esYeni">' + I.plus + 'Elle ekle</button></div></div>';
  }
  function esYukleniyor(t) { return { title: t || 'Eşleşme', back: true, html: '<div class="page">' + emptyBox('Eşleşme kayıtları yükleniyor…') + '</div>' }; }

  /* ---- Eşleşme ana sayfası (Excel'deki ANA SAYFA) ---- */
  function scrEsHome() {
    var g = GROUPS.eslesme;
    var html = '<div class="page"><div class="ghead" style="background:' + g.renk + '"><div class="gt">EŞLEŞME</div><div class="gs">Kök hücre bağışçı eşleşmeleri, devirler ve süreç istatistikleri</div></div>';
    if (!esData) return { title: 'Eşleşme', html: html + emptyBox('Eşleşme kayıtları yükleniyor…') + '</div>' };
    var cards = function (pages, renk) {
      return '<div class="gcards">' + pages.map(function (pg) {
        return '<button class="gcard" style="background:' + renk + '" data-act="goto" data-h="' + pg[0] + '"><span class="ct">' + h(pg[1]) + '</span><span class="cs" style="color:#DDF1F2">' + h(pg[2]) + '</span></button>';
      }).join('') + '</div>';
    };
    if (!esData.kayitlar.length) html += esBos();
    else {
      var R = esStats(), Y = DT.year(today), j = R.Y.indexOf(Y), kn = esKontrolSay(), nt = R.numuneTop;
      var tile = function (n, l, s2, href, cls) { return '<button class="tile' + (cls ? ' ' + cls : '') + '" data-act="goto" data-h="' + href + '"><div class="n">' + h(n) + '</div><div class="l">' + h(l) + '</div><div class="s">' + h(s2) + '</div></button>'; };
      html += '<div class="tiles">' +
        tile(num(j >= 0 ? R.yillikTop.v[j] : 0), 'Bu yıl eşleşme (' + Y + ')', j > 0 ? 'Geçen yıl: ' + num(R.yillikTop.v[j - 1]) : 'Yıllık Eşleşme', '/es/yillik') +
        tile(num(R.bekleyenTop.top), 'Bekleyen eşleşme', 'Numune bekleniyor', '/es/bekleyen', R.bekleyenTop.top ? 'warn' : 'ok') +
        tile(j >= 0 && nt.v[j] != null ? RP.fmt(nt.v[j], 'dec1') + ' gün' : '–', 'Bu yıl ort. numune alım süresi', nt.top != null ? 'Genel ortalama: ' + RP.fmt(nt.top, 'dec1') + ' gün' : '', '/es/numune') +
        tile(num(kn), 'Veri kontrol uyarısı', kn ? 'Düzeltilmesi gereken kayıt' : 'Sorun yok', '/es/kontrol', kn ? 'warn' : 'ok') + '</div>' +
        '<button class="btn newdonor block" data-act="esYeni" style="margin-bottom:6px">' + I.plus + 'YENİ EŞLEŞME EKLE</button>';
    }
    html += '<div class="sec-title">Kayıt ve takip</div>' + cards(ES_SAYFA.kayit, g.renk) + '<div class="sec-title">Dashboard</div>' + cards(ES_SAYFA.dash, '#13606A');
    if (esData.kayitlar.length) {
      html += '<div class="sec-title">Tablo</div><div class="card pad"><div class="small muted" style="margin-bottom:10px">' + num(esData.kayitlar.length) + ' eşleşme kaydı' + (esData.kaynak ? ' · Excel: ' + h(esData.kaynak) : '') + '</div>' +
        '<div class="row" style="gap:8px;margin-bottom:10px"><span class="small grow">İstatistik başlangıç yılı</span><select class="inp" style="width:110px" data-act-change="esBas">' +
        (function () { var o = ''; for (var y = 2010; y <= DT.year(today); y++) o += '<option' + (y === +esData.bas ? ' selected' : '') + '>' + y + '</option>'; return o; })() + '</select></div>' +
        '<div class="btns"><button class="btn" data-act="esPick">' + I.up + 'Excel’den yeniden al</button><button class="btn" data-act="esExcel">' + I.down + 'Excel’e aktar</button></div></div>';
    }
    html += '<div class="hint" style="margin:8px 4px">Sayfaların üstündeki düğmelerle Eşleşme sayfaları arasında geçebilirsiniz. Kutucuklara dokununca ilgili sayfa açılır.</div></div>';
    return { title: 'Eşleşme', html: html };
  }

  /* ---- Eşleşme Kayıtları (ANA TABLO) ---- */
  var ES_FILTRE = [['', 'Tümü'], ['sonuc', 'Sonucu girilmemiş'], ['bekleyen', 'Numune bekleyen'], ['gelen', 'Devirle gelen'], ['giden', 'Devrettiğimiz']];
  function esListe() {
    var q = DT.fold((ui.esAra || '').trim()), f = ui.esF || '', y = ui.esYil ? +ui.esYil : null, k = ui.esKbm || '';
    var sonuc = f === 'sonuc' ? ES.bekleyenListe(esData, 'sonuc') : null, bek = f === 'bekleyen' ? ES.bekleyenListe(esData, 'numune') : null, set = sonuc || bek;
    var ids = {}; if (set) set.forEach(function (r) { ids[r.id] = 1; });
    var terms = q ? q.split(/\s+/) : [];
    var arr = esData.kayitlar.filter(function (r) {
      if (set && !ids[r.id]) return false;
      if (f === 'gelen' && !ES.eqx(r.devir, 'Devreden GVM')) return false;
      if (f === 'giden' && !ES.eqx(r.devir, 'Devir Yapılan GVM')) return false;
      if (y && !(r.talep != null && DT.year(r.talep) === y)) return false;
      if (k && !ES.eqx(r.kbm, k)) return false;
      if (terms.length) { var hay = DT.fold([r.unit, r.ad, r.kbm, r.not, r.durum, r.devreden, r.devirYapilan, r.pers].join(' ')); if (!terms.every(function (t) { return hay.indexOf(t) >= 0; })) return false; }
      return true;
    });
    return arr.map(function (r, i) { return [r, i]; }).sort(function (a, b) { var ta = a[0].talep, tb = b[0].talep; return (ta == null) - (tb == null) || (tb || 0) - (ta || 0) || b[1] - a[1]; }).map(function (z) { return z[0]; });
  }
  function esItem(r, ek) {
    var t2 = [esV(r.unit), esV(r.kbm), r.talep != null ? 'Talep ' + DT.fmt(r.talep) : r.talepTx ? 'Talep “' + r.talepTx + '”' : ''].filter(Boolean).join(' · ');
    var chips = [];
    if (esV(r.nDurum)) chips.push('<span class="pillx ' + (ES.eqx(r.nDurum, 'Alındı') ? 'p-top' : ES.eqx(r.nDurum, 'Beklemede') ? 'p-asi' : 'p-grey') + '">Numune: ' + h(esV(r.nDurum)) + (r.numune != null ? ' ' + DT.fmtShort(r.numune) : '') + '</span>');
    if (ES.eqx(r.devir, 'Devreden GVM')) chips.push('<span class="pillx p-sk">Gelen: ' + h(esV(r.devreden).replace(' GVM', '') || '?') + '</span>');
    if (ES.eqx(r.devir, 'Devir Yapılan GVM')) chips.push('<span class="pillx p-or">Devredildi: ' + h(esV(r.devirYapilan).replace(' GVM', '') || '?') + '</span>');
    if (esV(r.tur)) chips.push('<span class="pillx p-grey">' + h(esV(r.tur)) + (esV(r.yas) ? ' · ' + h(esV(r.yas)) : '') + '</span>');
    if (esV(r.pers)) chips.push('<span class="pillx p-grey">' + h(esV(r.pers)) + '</span>');
    return '<a class="item" data-act="goto" data-h="/es/kayit/' + h(r.id) + '"><div class="t1"><span class="name">' + h(esV(r.ad) || esV(r.unit) || '(adsız)') + '</span><span class="pillx ' + esDurumCls(r) + '">' + h(esDurumAd(r)) + '</span></div>' +
      '<div class="t2 ellipsis">' + h(t2) + '</div>' + (ek ? '<div class="t2">' + ek + '</div>' : '') + (chips.length ? '<div class="t3">' + chips.join('') + '</div>' : '') +
      (esV(r.not) ? '<div class="t2 muted ellipsis">' + h(r.not) + '</div>' : '') + '</a>';
  }
  function esListeHtml() {
    var arr = esListe(), lim = ui.esLim || 60;
    if (!arr.length) return '<div class="card">' + emptyBox('Eşleşen kayıt yok', 'Aramayı ya da süzgeçleri değiştirin.') + '</div>';
    return '<div class="summary">' + num(arr.length) + ' kayıt · yeni talep üstte</div><div class="card list">' + arr.slice(0, lim).map(function (r) { return esItem(r); }).join('') + '</div>' +
      (arr.length > lim ? '<button class="btn block" data-act="esMore">Daha fazla göster (' + num(arr.length - lim) + ')</button>' : '');
  }
  function scrEsKayitlar() {
    var html = '<div class="page flush">' + groupSeg('eslesme', '/es/kayitlar');
    if (!esData.kayitlar.length) return { title: 'Eşleşme Kayıtları', html: html + '<div class="page">' + esBos() + '</div></div>' };
    var ys = {}; esData.kayitlar.forEach(function (r) { if (r.talep != null) ys[DT.year(r.talep)] = 1; });
    html += '<div class="seg sub">' + ES_FILTRE.map(function (f) { return '<button class="' + ((ui.esF || '') === f[0] ? 'on' : '') + '" data-act="esF" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="toolbar"><div class="search grow">' + I.search + '<input class="inp" type="search" placeholder="Unit no, ad soyad, not…" value="' + h(ui.esAra || '') + '" data-ui="esAra"></div></div>' +
      '<div class="toolbar"><select class="inp" data-ui="esYil"><option value="">Tüm yıllar</option>' + Object.keys(ys).sort().reverse().map(function (y) { return '<option' + (String(ui.esYil) === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-ui="esKbm"><option value="">Tüm KBM’ler</option>' + ES.KBM.map(function (k) { return '<option' + (ui.esKbm === k ? ' selected' : '') + '>' + h(k) + '</option>'; }).join('') + '</select></div>' +
      '<div id="eslist">' + esListeHtml() + '</div></div><button class="fab" data-act="esYeni" aria-label="Yeni eşleşme">' + I.plus + '</button>';
    return { title: 'Eşleşme Kayıtları', html: html };
  }

  /* ---- Eşleşme formu ---- */
  function scrEsForm(id) {
    var yeni = id === 'yeni', r = yeni ? ES.yeni() : esBul(id);
    if (!r) return { title: 'Eşleşme', back: true, html: '<div class="page">' + emptyBox('Kayıt bulunamadı', 'Silinmiş olabilir.') + '</div>' };
    var sel = function (name, label, list, val, hint, groups) {
      var v = esV(val), found = false, o = '<option value="">— seçin —</option>';
      var opt = function (x) { var on = !found && v && ES.eqx(x, v); if (on) found = true; return '<option' + (on ? ' selected' : '') + '>' + h(x) + '</option>'; };
      if (groups) groups.forEach(function (g2) { o += '<optgroup label="' + h(g2[0]) + '">' + g2[1].map(opt).join('') + '</optgroup>'; });
      else o += list.map(opt).join('');
      if (v && !found) o += '<option selected>' + h(v) + '</option>';
      return '<div class="field"><label>' + label + '</label><select class="inp" name="' + name + '">' + o + '</select>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
    };
    var txt = function (name, label, val, extra) { return '<div class="field"><label>' + label + '</label><input class="inp" name="' + name + '" value="' + h(esV(val)) + '"' + (extra || '') + '></div>'; };
    var tarih = function (name, label) {
      var tx = r[name + 'Tx'];
      return '<div class="field"><label>' + label + '</label><input class="inp" type="date" name="' + name + '" value="' + (r[name] != null ? DT.iso(r[name]) : '') + '">' +
        (tx ? '<div class="hint" style="color:var(--red)">Excel’de tarih değil, metin olarak yazılmış: “' + h(tx) + '”. Doğru tarihi seçin.</div>' : '') + '</div>';
    };
    var html = '<div class="page"><form id="esform" autocomplete="off"><div class="card pad">' +
      '<div class="formsec">Bağışçı</div>' +
      txt('unit', 'Bağışçı Unit No', r.unit, ' autocapitalize="characters" placeholder="T00…"') + txt('ad', 'Bağışçının adı soyadı', r.ad) +
      '<div class="grid2">' + sel('cins', 'Cinsiyet', ES.CINSIYET, r.cins) + sel('kbm', 'OABKM Bağlıları', ES.KBM, r.kbm) + '</div>' +
      sel('gvm', 'Bağışta bulunulan GVM', ES.GVM, r.gvm) +
      '<div class="formsec">Devir</div>' +
      sel('devir', 'Devir durumu', ES.DEVIR, r.devir, 'Devreden GVM: başka bölgeden bize gelen · Devir Yapılan GVM: bizim başka bölgeye devrettiğimiz (istatistiklere girmez).') +
      '<div class="grid2">' + sel('devreden', 'Devreden KHBM', ES.BOLGE, r.devreden) + sel('devirYapilan', 'Devir yapılan KHBM', ES.BOLGE, r.devirYapilan) + '</div>' +
      tarih('devirT', 'Devir tarihi') +
      '<div class="formsec">Eşleşme</div>' +
      '<div class="grid2">' + tarih('talep', 'Talep tarihi') + '<div class="field"><label>Eşleşme oranı</label><input class="inp" name="oran" list="esOran" value="' + h(esV(r.oran)) + '" placeholder="10\\10"><datalist id="esOran">' + ES.ORAN.map(function (o) { return '<option value="' + h(o) + '">'; }).join('') + '</datalist></div></div>' +
      '<div class="grid2">' + sel('alim', 'Kök hücre alım yeri', ES.ALIM, r.alim) + sel('yas', 'Hasta yaş', ES.YAS, r.yas) + '</div>' +
      sel('tur', 'Hasta türü', ES.TUR, r.tur) +
      '<div class="formsec">Konfirmasyon numunesi</div>' +
      '<div class="grid2">' + sel('nDurum', 'Numune durumu', ES.NUMUNE, r.nDurum) + tarih('numune', 'Numune alındı / alınmadı tarihi') + '</div>' +
      '<div class="formsec">Sonuç</div>' +
      sel('durum', 'Durum', ES.DURUM, r.durum) +
      sel('neden', 'Vazgeçme / inaktivasyon nedeni', null, r.neden, '', [['Vazgeçme nedeni', ES.NEDEN_VAZGECME], ['İnaktivasyon nedeni', ES.NEDEN_INAKTIVASYON]]) +
      sel('pers', 'İlgilenen personel', state.lists.personel, r.pers, 'Personel İstatistiği’nde görüşme olarak sayılır.') +
      '<div class="field"><label>Notlar</label><textarea class="inp" name="not" rows="3">' + h(S(r.not)) + '</textarea></div>' +
      '</div><div class="btns" style="margin-top:4px">' + (yeni ? '<button type="button" class="btn" data-act="back">Vazgeç</button>' : '<button type="button" class="btn danger" id="esSil">Sil</button>') +
      '<button class="btn pri">Kaydet</button></div></form></div>';
    return {
      title: yeni ? 'Yeni eşleşme' : (esV(r.ad) || 'Eşleşme'), back: true, html: html, after: function () {
        var f = $('#esform');
        f.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var o = Object.assign({}, r);
          ['unit', 'ad', 'cins', 'gvm', 'kbm', 'devir', 'devreden', 'devirYapilan', 'alim', 'oran', 'yas', 'tur', 'nDurum', 'durum', 'neden', 'pers'].forEach(function (k) { o[k] = f[k].value.trim(); });
          o.unit = o.unit.toLocaleUpperCase('tr-TR'); o.not = f.not.value.trim();
          ['talep', 'devirT', 'numune'].forEach(function (k) {
            var v = DT.fromIso(f[k].value);
            if (v != null) { o[k] = v; delete o[k + 'Tx']; } else { o[k] = null; if (!r[k + 'Tx'] || r[k] != null) delete o[k + 'Tx']; }
          });
          if (!o.unit && !o.ad) { toast('Unit no ya da ad soyad girin'); return; }
          if (o.talep == null && !o.talepTx) { toast('Talep tarihini girin'); return; }
          if (yeni) { o.no = esData.kayitlar.reduce(function (m, z) { return Math.max(m, z.no || 0); }, 0) + 1; esData.kayitlar.push(o); }
          else { var i = esData.kayitlar.indexOf(r); if (i >= 0) esData.kayitlar[i] = o; }
          esDegisti(); toast(yeni ? 'Eşleşme eklendi' : 'Kaydedildi'); history.back();
        });
        var del = $('#esSil');
        if (del) del.onclick = function () {
          confirmSheet('Eşleşme kaydını sil', (esV(r.ad) || esV(r.unit)) + (r.talep != null ? ' · talep ' + DT.fmt(r.talep) : '') + ' kaydı silinecek.', 'Sil', true, function () {
            esData.kayitlar = esData.kayitlar.filter(function (z) { return z !== r; }); esDegisti(); toast('Kayıt silindi'); history.back();
          });
        };
      }
    };
  }

  /* ---- Bekleyen Listesi ---- */
  function scrEsBekleyen() {
    var html = '<div class="page flush">' + groupSeg('eslesme', '/es/bekleyen');
    if (!esData.kayitlar.length) return { title: 'Bekleyen Listesi', html: html + '<div class="page">' + esBos() + '</div></div>' };
    var tur = ui.esBek || 'numune', nb = ES.bekleyenListe(esData, 'numune'), sn = ES.bekleyenListe(esData, 'sonuc'), list = tur === 'sonuc' ? sn : nb, lim = ui.esBLim || 100;
    html += '<div class="seg sub"><button class="' + (tur === 'numune' ? 'on' : '') + '" data-act="esBek" data-v="numune">Numune bekleyen<span class="c">' + nb.length + '</span></button>' +
      '<button class="' + (tur === 'sonuc' ? 'on' : '') + '" data-act="esBek" data-v="sonuc">Sonucu girilmemiş<span class="c">' + sn.length + '</span></button></div>' +
      '<div class="summary">' + (tur === 'sonuc' ? 'Numune “Alındı” ama Durum seçilmemiş eşleşmeler.' : 'Konfirmasyon numunesi durumu “Beklemede” olan eşleşmeler.') + ' Devrettiklerimiz hariç. Gün: talepten bugüne. Düzeltmek için kayda dokunun.</div>';
    if (!list.length) html += '<div class="card">' + emptyBox('Şu anda bu listede kayıt yok') + '</div>';
    else html += '<div class="card list">' + list.slice(0, lim).map(function (r) {
      var gun = r.talep != null ? today - r.talep : null;
      return esItem(r, gun != null ? '<b>' + gun + ' gün</b>' + (esV(r.alim) ? ' · ' + h(esV(r.alim)) : '') + (esV(r.oran) ? ' · oran ' + h(esV(r.oran)) : '') : '');
    }).join('') + '</div>' + (list.length > lim ? '<button class="btn block" data-act="esBMore">Daha fazla göster (' + (list.length - lim) + ')</button>' : '');
    return { title: 'Bekleyen Listesi', html: html + '</div>' };
  }

  /* ---- Veri Kontrolü ---- */
  function scrEsKontrol() {
    var html = '<div class="page flush">' + groupSeg('eslesme', '/es/kontrol');
    if (!esData.kayitlar.length) return { title: 'Veri Kontrolü', html: html + '<div class="page">' + esBos() + '</div></div>' };
    var K = esKontrol(), top = esKontrolSay();
    html += '<div class="summary">İstatistiklere girmeyen ya da düzeltilmesi gereken kayıtlar; hepsinin 0 olması beklenir. Toplam <b>' + top + '</b> uyarı. Kayda dokunup düzeltin.</div>';
    ui.esKAc = ui.esKAc || {};
    K.forEach(function (k) {
      var ac = ui.esKAc[k.k], lim = ac ? 500 : 5;
      html += '<div class="card pad eskon"><div class="row" style="align-items:flex-start;gap:10px"><span class="grow"><b>' + h(k.ad) + '</b><div class="small muted" style="margin-top:3px">' + h(k.ne) + '</div></span>' +
        '<span class="pillx ' + (k.n ? 'p-red' : 'p-top') + '" style="font-size:14px">' + k.n + '</span></div>' +
        (k.n ? '<div class="list" style="margin:8px -14px -14px">' + k.list.slice(0, lim).map(function (r) {
          var ek = k.k === 'metin' ? 'Metin: ' + h([r.talepTx ? 'talep “' + r.talepTx + '”' : '', r.numuneTx ? 'numune “' + r.numuneTx + '”' : ''].filter(Boolean).join(' · ')) :
            k.k === 'once' ? 'Talep ' + DT.fmt(r.talep) + ' · numune ' + DT.fmt(r.numune) : k.k === 'ileri' ? 'Talep ' + DT.fmt(r.talep) + (r.numune != null ? ' · numune ' + DT.fmt(r.numune) : '') :
            k.k === 'kbm' ? 'KBM: “' + h(S(r.kbm) || 'boş') + '”' : k.k === 'cins' ? 'Cinsiyet: “' + h(S(r.cins) || 'boş') + '”' : 'Hasta türü: “' + h(S(r.tur) || 'boş') + '”';
          return esItem(r, ek);
        }).join('') + (k.n > lim ? '<button class="btn ghost block" data-act="esKAc" data-v="' + k.k + '">Tümünü göster (' + k.n + ')</button>' : '') + '</div>' : '') + '</div>';
    });
    return { title: 'Veri Kontrolü', html: html + '</div>' };
  }

  /* ---- istatistik tabloları ---- */
  function esTablo(R, rows, tot, opt) {
    opt = opt || {};
    var f = function (v) { return v == null ? '–' : opt.dec ? RP.fmt(v, 'dec1') : num(v); };
    var tr = function (r, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + h(r.ad) + '</td>' + r.v.map(function (v) { return '<td' + (!v && !opt.dec ? ' class="z"' : '') + '>' + f(v) + '</td>'; }).join('') + '<td><b>' + f(r.top) + '</b></td></tr>'; };
    return '<div class="tscroll"><table class="t tsticky"><tr><th>' + h(opt.bas || '') + '</th>' + R.Y.map(function (y) { return '<th>' + y + '</th>'; }).join('') + '<th>' + h(opt.top || 'TOPLAM') + '</th></tr>' +
      rows.map(function (r) { return tr(r, r.ek ? 'ek' : ''); }).join('') + (tot ? tr(tot, 'tot') : '') + '</table></div>';
  }
  function esKart(baslik, inner, not) { return '<div class="card pad"><h2>' + h(baslik) + '</h2>' + inner + (not ? '<div class="note">' + h(not) + '</div>' : '') + '</div>'; }
  function esSon(R, n) { var k = Math.max(0, R.Y.length - (n || 12)); return k; }
  function esGrafik(R, seriler, renkler, adlar, opt) {
    var k = esSon(R, 12);
    return barChart(R.Y.slice(k).map(String), seriler.map(function (s2) { return s2.slice(k).map(function (v) { return v || 0; }); }), renkler, adlar, Object.assign({ full: true }, opt || {}));
  }
  function esSayfa(yol, baslik, govde) {
    var html = '<div class="page flush">' + groupSeg('eslesme', yol);
    if (!esData.kayitlar.length) return { title: baslik, html: html + '<div class="page">' + esBos() + '</div></div>' };
    return { title: baslik, html: html + govde() + '</div>' };
  }
  var ES_NOT = 'Yıl = Talep Tarihi yılı. Devirle gelen eşleşmeler dahil, diğer bölgelere devrettiğimiz eşleşmeler hariç.';
  function scrEsYillik() {
    return esSayfa('/es/yillik', 'Yıllık Eşleşme', function () {
      var R = esStats();
      return esKart('OABKM yıllık eşleşme', esGrafik(R, [R.yillikTop.v], ['#0E7C86'], ['OABKM'])) +
        esKart('KBM / BKM bazlı yıllık eşleşme sayıları', esTablo(R, R.yillik, R.yillikTop, { bas: 'KBM / BKM' }), ES_NOT);
    });
  }
  function scrEsBolge() {
    return esSayfa('/es/bolge', 'Bölge Devirleri', function () {
      var R = esStats();
      var ek = function (r) { return Object.assign({ ek: 1 }, r); };
      return esKart('Gelen ve devrettiğimiz · yıllara göre', esGrafik(R, [R.gelenTop.v, R.gidenTop.v], ['#2F6FB0', '#C2410C'], ['Gelen devir', 'Devrettiğimiz'])) +
        esKart('Bölgelerden bize gelen eşleşme devirleri', esTablo(R, R.gelen.filter(function (r) { return r.top; }).concat([ek(R.gelenSecilmemis)]), R.gelenTop, { bas: 'Bölge (GVM)' }),
          'Devir Durumu = Devreden GVM (bölge = Devreden KHBM). Hiç devri olmayan bölgeler gösterilmez.') +
        esKart('Bizim diğer bölgelere devrettiğimiz eşleşmeler', esTablo(R, R.giden.filter(function (r) { return r.top; }).concat([ek(R.gidenSecilmemis)]), R.gidenTop, { bas: 'Bölge (GVM)' }),
          'Devir Durumu = Devir Yapılan GVM (bölge = Devir Yapılan KHBM). Yıl = Talep Tarihi yılı.');
    });
  }
  function scrEsTur() {
    return esSayfa('/es/tur', 'Hasta Türü ve Cinsiyet', function () {
      var R = esStats();
      return esKart('Yurt içi / yurt dışı · yıllara göre', esGrafik(R, [R.tur[0].v, R.tur[1].v, R.tur[2].v], ['#0E7C86', '#5B3A8C', '#D99A2B'], ['Yurt içi (TC Vatandaşı)', 'Yurt dışı', 'Sağlık turizmi'])) +
        esKart('Yurt içi / yurt dışı eşleşme sayıları (Hasta Türü)', esTablo(R, R.tur.map(function (r, i) { return Object.assign({}, r, { ad: i === 0 ? 'Yurt İçi (TC Vatandaşı)' : r.ad }); }), R.turTop, { bas: 'Hasta türü' }), ES_NOT) +
        esKart('Eşleşen bağışçı cinsiyet dağılımı', '<div class="escins">' + R.cinsiyet.map(function (c, i) {
          return '<div><b>' + h(c.ad) + '</b><span class="b"><i style="width:' + ((c.oran || 0) * 100).toFixed(1) + '%;background:' + ['#2F6FB0', '#C2410C'][i] + '"></i></span><span>' + num(c.n) + ' · ' + pct(c.oran) + '</span></div>';
        }).join('') + '</div>' + tbl(['Cinsiyet', 'Sayı', 'Oran'], R.cinsiyet.map(function (c) { return [c.ad, c.n, pct(c.oran)]; }), ['Toplam', R.cinsiyetTop, pct(R.cinsiyetTop ? 1 : null)]),
          'Başlangıç yılından bugüne toplam; her eşleşme ayrı sayılır.');
    });
  }
  function scrEsBekleyenIst() {
    return esSayfa('/es/bekleyenler', 'Bekleyen Eşleşmeler', function () {
      var R = esStats();
      return '<div class="summary">Toplam bekleyen: <b>' + num(R.bekleyenTop.top) + '</b> · Konfirmasyon numunesi durumu “Beklemede” olan eşleşmeler; ay = talep ayı. Listesi Bekleyen Listesi’nde.</div>' +
        esKart('Aylık bekleyen eşleşme sayıları', esTablo(R, R.bekleyen, R.bekleyenTop, { bas: 'Ay' }), 'Devrettiğimiz eşleşmeler hariç. Durum güncellendikçe tablo kendiliğinden değişir.') +
        '<button class="btn block" data-act="goto" data-h="/es/bekleyen" style="margin:0 0 12px">Bekleyen kayıtların listesi</button>';
    });
  }
  function scrEsNumune() {
    return esSayfa('/es/numune', 'Numune Alım Süresi', function () {
      var R = esStats();
      return esKart('Ortalama numune alım süresi (gün) · OABKM', esGrafik(R, [R.numuneTop.v.map(function (v) { return v == null ? 0 : Math.round(v * 10) / 10; })], ['#0E7C86'], ['Ortalama gün'], { fmt: function (v) { return RP.fmt(v, 'dec1'); } })) +
        esKart('KBM / BKM bazlı yıllık ortalama (gün)', esTablo(R, R.numune, R.numuneTop, { bas: 'KBM / BKM', top: 'GENEL ORT.', dec: true }),
          'Talep tarihi ile konfirmasyon numunesi alındı tarihi arasındaki gün; yalnız “Alındı” kayıtlar. Tarihi metin olan ya da numune tarihi talepten önce girilmiş kayıtlar hesaba girmez (Veri Kontrolü).');
    });
  }
  function scrEsVazgecme() {
    return esSayfa('/es/vazgecme', 'Vazgeçme ve İnaktivasyon', function () {
      var R = esStats();
      return esKart('Vazgeçme ve sistem inaktivasyonu · yıllara göre', esGrafik(R, [R.vazgecmeTop.v, R.inaktivasyonTop.v], ['#C2410C', '#8a8f98'], ['Bağışçı vazgeçme', 'Sistem inaktivasyonu'])) +
        esKart('Bağışçı vazgeçme sayıları (Durum = Bağışçı Vazgeçti)', esTablo(R, R.vazgecme, R.vazgecmeTop, { bas: 'KBM / BKM' })) +
        esKart('Sistem inaktivasyon sayıları (Durum = Sistem İnaktivasyonu)', esTablo(R, R.inaktivasyon, R.inaktivasyonTop, { bas: 'KBM / BKM' }), ES_NOT) +
        (R.nedenler.length ? esKart('Vazgeçme / inaktivasyon nedenleri', tbl(['Neden', 'Eşleşme'], R.nedenler.map(function (n) { return [n.ad, n.n]; })), 'Başlangıç yılından bugüne; nedeni seçilmiş eşleşmeler.') : '');
    });
  }
  function scrEsPersonel() {
    return esSayfa('/es/personel', 'Personel İstatistiği', function () {
      var Y = ui.esPerYil ? +ui.esPerYil : DT.year(today), P = ES.personel(esData, today, state.lists.personel, Y), R = { Y: P.Y };
      var f = function (v) { return v == null ? '–' : num(v); };
      var html = '<div class="summary">Görüşme = İlgilenen Personel’e adı yazılan eşleşme kaydı; yıl ve ay talep tarihine göre. Personeli eşleşme kaydını düzenleyerek seçin.</div>' +
        esKart('Personel bazlı yıllık görüşme sayısı', esTablo(R, P.yillik.concat([Object.assign({ ek: 1 }, P.girilmemis)]), P.toplam, { bas: 'Personel' }));
      html += '<div class="toolbar"><span class="small grow">Seçilen yıl</span><select class="inp" style="width:110px;flex:none" data-ui="esPerYil">' + P.Y.slice().reverse().map(function (y) { return '<option' + (y === Y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>';
      html += esKart(Y + ' · personel bazlı görüşme sonuçları', tbl(['Personel', 'Görüşme', 'Numune alındı', 'Numune alınmadı', 'Bağışçı vazgeçti', 'Sistem inaktiv.', 'Vazgeçme oranı', 'Ort. süre (gün)'],
        P.sonuc.map(function (o) { return [o.ad, o.gorusme, o.alindi, o.alinmadi, o.vazgecti, o.inaktivasyon, o.oran == null ? '–' : pct(o.oran), o.sure == null ? '–' : RP.fmt(o.sure, 'dec1')]; }),
        ['Toplam', P.sonucTop.gorusme, P.sonucTop.alindi, P.sonucTop.alinmadi, P.sonucTop.vazgecti, P.sonucTop.inaktivasyon, P.sonucTop.oran == null ? '–' : pct(P.sonucTop.oran), P.sonucTop.sure == null ? '–' : RP.fmt(P.sonucTop.sure, 'dec1')]));
      var ay = DT.AYLAR.map(function (a) { return a.slice(0, 3); });
      html += esKart(Y + ' · aylık görüşme sayısı', barChart(ay, [P.aylikHepsi], ['#0E7C86'], ['Görüşme']) +
        tbl(['Personel'].concat(ay, ['Toplam']), P.aylik.map(function (r) { return [r.ad].concat(r.v, [r.top]); }), ['Toplam'].concat(P.aylikHepsi, [P.aylikHepsi.reduce(function (a, b) { return a + b; }, 0)])));
      return html;
    });
  }
  /* ---- Eşleşme Dashboard ---- */
  function scrEsDash() {
    return esSayfa('/es/dashboard', 'Eşleşme Dashboard', function () {
      var R = esStats(), Y = DT.year(today), j = R.Y.indexOf(Y), p = j - 1, P = ES.personel(esData, today, state.lists.personel, Y);
      var v = function (row) { return j >= 0 ? row.v[j] : 0; }, onc = function (row) { return p >= 0 ? 'Geçen yıl: ' + num(row.v[p]) : ''; };
      var kpi = function (n, l, s2) { return '<div class="kpi"><div class="n">' + h(n) + '</div><div class="l">' + h(l) + '</div>' + (s2 ? '<div class="l" style="margin-top:4px">' + h(s2) + '</div>' : '') + '</div>'; };
      var html = '<div class="kpis rpkpis">' + kpi(num(R.yillikTop.top), 'Toplam eşleşme', R.Y[0] + ' – ' + Y) + kpi(num(v(R.yillikTop)), 'Bu yıl eşleşme', onc(R.yillikTop)) +
        kpi(num(v(R.gelenTop)), 'Bu yıl gelen devir', onc(R.gelenTop)) + kpi(num(v(R.gidenTop)), 'Bu yıl devrettiğimiz', onc(R.gidenTop)) +
        kpi(j >= 0 && R.numuneTop.v[j] != null ? RP.fmt(R.numuneTop.v[j], 'dec1') + ' gün' : '–', 'Bu yıl ort. numune süresi', R.numuneTop.top != null ? 'Genel ort.: ' + RP.fmt(R.numuneTop.top, 'dec1') + ' gün' : '') +
        kpi(num(R.bekleyenTop.top), 'Bekleyen eşleşme', 'Numune bekleniyor') + '</div>';
      html += esKart('Yıllık eşleşme sayısı (OABKM)', esGrafik(R, [R.yillikTop.v], ['#0E7C86'], ['OABKM']));
      if (j >= 0) {
        var kb = R.yillik.map(function (r) { return r.ad.replace(' KBM', '').replace('Ankara Batı', 'Ank. Batı'); });
        html += esKart('KBM bazlı eşleşme · ' + (p >= 0 ? R.Y[p] + ' ve ' : '') + Y, barChart(kb, (p >= 0 ? [R.yillik.map(function (r) { return r.v[p]; })] : []).concat([R.yillik.map(function (r) { return r.v[j]; })]),
          p >= 0 ? ['#9fb3c8', '#0E7C86'] : ['#0E7C86'], p >= 0 ? [String(R.Y[p]), String(Y)] : [String(Y)], { full: true }));
      }
      html += esKart('Yurt içi / yurt dışı eşleşme', esGrafik(R, [R.tur[0].v, R.tur[1].v], ['#0E7C86', '#5B3A8C'], ['Yurt içi', 'Yurt dışı']));
      html += esKart('Bağışçı vazgeçme ve sistem inaktivasyonu', esGrafik(R, [R.vazgecmeTop.v, R.inaktivasyonTop.v], ['#C2410C', '#8a8f98'], ['Vazgeçme', 'Sistem inaktivasyonu']));
      html += esKart('Ortalama numune alım süresi (gün)', esGrafik(R, [R.numuneTop.v.map(function (x) { return x == null ? 0 : Math.round(x * 10) / 10; })], ['#2F6FB0'], ['Ortalama gün'], { fmt: function (x) { return RP.fmt(x, 'dec1'); } }));
      html += esKart('Bölge devirleri: gelen / devrettiğimiz', esGrafik(R, [R.gelenTop.v, R.gidenTop.v], ['#2F6FB0', '#C2410C'], ['Gelen', 'Devrettiğimiz']));
      var bol = R.gelen.map(function (r, i) { return { ad: r.ad.replace(' GVM', ''), g: r.top, d: R.giden[i].top }; }).filter(function (b) { return b.g || b.d; }).sort(function (a, b) { return (b.g + b.d) - (a.g + a.d); });
      var mx = Math.max.apply(null, bol.map(function (b) { return Math.max(b.g, b.d); }).concat([1]));
      html += esKart('Bölge bazında devirler (toplam)', '<div class="esbol">' + bol.map(function (b) {
        return '<div><span class="l">' + h(b.ad) + '</span><span class="bb"><i style="width:' + (b.g / mx * 100).toFixed(1) + '%;background:#2F6FB0"></i><i style="width:' + (b.d / mx * 100).toFixed(1) + '%;background:#C2410C"></i></span><span class="v">' + b.g + ' / ' + b.d + '</span></div>';
      }).join('') + '</div><div class="small muted" style="margin-top:6px"><span class="dot" style="background:#2F6FB0"></span> gelen  ·  <span class="dot" style="background:#C2410C"></span> devrettiğimiz</div>');
      html += esKart('Eşleşen bağışçı cinsiyet dağılımı', '<div class="escins">' + R.cinsiyet.map(function (c, i) {
        return '<div><b>' + h(c.ad) + '</b><span class="b"><i style="width:' + ((c.oran || 0) * 100).toFixed(1) + '%;background:' + ['#2F6FB0', '#C2410C'][i] + '"></i></span><span>' + num(c.n) + ' · ' + pct(c.oran) + '</span></div>'; }).join('') + '</div>');
      var pr = P.sonuc.filter(function (o) { return o.gorusme; }).sort(function (a, b) { return b.gorusme - a.gorusme; }).slice(0, 10);
      html += esKart('Personel bazında görüşme (bu yıl, ilk 10)', pr.length ? tbl(['Personel', 'Görüşme', 'Numune alındı', 'Vazgeçti'], pr.map(function (o) { return [o.ad, o.gorusme, o.alindi, o.vazgecti]; })) :
        '<div class="small muted">Bu yıl İlgilenen Personel’i seçilmiş eşleşme yok. Eşleşme kaydını düzenleyip personeli seçin.</div>');
      html += esKart('Aylık görüşme sayısı (bu yıl, tüm personel)', barChart(DT.AYLAR.map(function (a) { return a.slice(0, 3); }), [P.aylikHepsi], ['#0E7C86'], ['Görüşme']));
      return html;
    });
  }
  function scrEs(sayfa, arg) {
    if (!esData) return esYukleniyor();
    switch (sayfa) {
      case 'kayitlar': return scrEsKayitlar();
      case 'kayit': return scrEsForm(arg);
      case 'bekleyen': return scrEsBekleyen();
      case 'kontrol': return scrEsKontrol();
      case 'dashboard': return scrEsDash();
      case 'yillik': return scrEsYillik();
      case 'bolge': return scrEsBolge();
      case 'tur': return scrEsTur();
      case 'bekleyenler': return scrEsBekleyenIst();
      case 'numune': return scrEsNumune();
      case 'vazgecme': return scrEsVazgecme();
      case 'personel': return scrEsPersonel();
      default: return scrEsHome();
    }
  }
  function esImport(buf, name) {
    busy(true, 'Eşleşme tablosu okunuyor…');
    setTimeout(function () {
      ES.importWorkbook(buf).then(function (res) {
        busy(false);
        var K = res.kayitlar, ys = K.filter(function (r) { return r.talep != null; }).map(function (r) { return DT.year(r.talep); });
        if (!K.length) { toast('Dosyada eşleşme kaydı bulunamadı'); return; }
        var eski = esData && esData.kayitlar.length;
        confirmSheet('Eşleşme tablosunu al', name + '\n\n' + num(K.length) + ' eşleşme kaydı · talep ' + Math.min.apply(null, ys) + ' – ' + Math.max.apply(null, ys) + ' · istatistik başlangıcı ' + res.bas +
          (res.rapor.metin ? '\n' + res.rapor.metin + ' tarih metin olarak yazılmış; Veri Kontrolü’nde görünür.' : '') +
          (eski ? '\n\nUygulamadaki ' + num(eski) + ' eşleşme kaydı bunlarla değiştirilecek (uygulamada yaptığınız değişiklikler dahil).' : ''), 'Al', !!eski, function () {
          esData = { kayitlar: K, bas: res.bas, kaynak: name, tarih: Date.now() }; esDegisti();
          toast(num(K.length) + ' eşleşme kaydı alındı');
          if (route()[1] === 'eslesme') render(true); else go('/g/eslesme');
        });
      }).catch(function (e) { busy(false); console.error(e); toast('Okunamadı: ' + e.message); });
    }, 30);
  }

  /* ---------------- Raporlar: tarih aralığına göre PDF / Excel ---------------- */
  function rpDonem() {
    if (ui.rpHz === 'ozel') {
      var a = ui.rpBas != null ? ui.rpBas : today, b = ui.rpBit != null ? ui.rpBit : a;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
    return RP.hazir(ui.rpHz, today);
  }
  function rpAyrinti() { return ui.rpTur !== 'ozet' && !!ui.rpAyr[ui.rpTur]; }
  function rpModel() {
    var r = rpDonem();
    return RP.build({ state: state, D: D, pool: pool, hrows: hrows, yrows: yrows, today: today },
      { tur: ui.rpTur, from: r.from, to: r.to, ayrinti: rpAyrinti(), filtre: { durum: ui.rpDurum, hastane: ui.rpHast, yontem: ui.rpYon, olcut: ui.rpOlcut } });
  }
  // önizleme: rapor modelinin bölümleri kartlar hâlinde
  function rpBlockHtml(b) {
    if (!b || b.html === false) return '';
    var F = RP.fmt;
    if (b.type === 'row') return b.items.map(rpBlockHtml).join('');
    if (b.type === 'note') return '<div class="note">' + h(b.text) + '</div>';
    if (b.type === 'kpis') return '<div class="kpis rpkpis">' + b.items.map(function (it) {
      return '<div class="kpi" style="border-top:3px solid ' + (it.c || NAVY) + '"><div class="n">' + h(F(it.v, it.f)) + '</div><div class="l">' + h(it.l) + '</div></div>'; }).join('') + '</div>';
    if (b.type === 'bars') return (b.title ? '<div class="rpcap">' + h(b.title) + '</div>' : '') +
      barChart(b.labels, b.series.map(function (s2) { return s2.values; }), b.series.map(function (s2) { return s2.color; }), b.series.map(function (s2) { return s2.name; }),
        { fmt: b.f === 'tl' || b.f === 'tl0' ? kisaTL : null, full: true });
    if (b.type === 'hbars') {
      var rows = b.rows.filter(function (r) { return r[1] > 0; }), mx = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
      return (b.title ? '<div class="rpcap">' + h(b.title) + '</div>' : '') + '<div class="rphb">' + rows.map(function (r) {
        return '<div><span class="l">' + h(r[0]) + '</span><span class="b"><i style="width:' + Math.max(1, r[1] / mx * 100).toFixed(1) + '%;background:' + (r[2] || b.color || NAVY) + '"></i></span><b>' + h(F(r[1], b.f)) + '</b></div>'; }).join('') + '</div>';
    }
    if (b.type === 'table') {
      var lim = b.uzun ? 12 : 60, shown = b.rows.slice(0, lim), num2 = function (c) { return c.f && c.f !== 'txt'; };
      var cell = function (v, c) { return '<td' + (num2(c) ? '' : ' class="l"') + '>' + h(F(v, c.f)) + '</td>'; };
      return (b.title ? '<div class="rpcap">' + h(b.title) + '</div>' : '') + '<div class="tscroll"><table class="t rpt"><tr>' + b.cols.map(function (c) { return '<th' + (num2(c) ? '' : ' class="l"') + '>' + h(c.t) + '</th>'; }).join('') + '</tr>' +
        shown.map(function (r) { var v = r.v || r; return '<tr' + (r.muted ? ' class="mut"' : '') + '>' + b.cols.map(function (c, i) { return cell(v[i], c); }).join('') + '</tr>'; }).join('') +
        (b.tot && b.rows.length <= lim ? '<tr class="tot">' + b.cols.map(function (c, i) { return cell(b.tot[i], c); }).join('') + '</tr>' : '') + '</table></div>' +
        (!b.rows.length ? '<div class="small muted" style="padding:8px 2px">' + h(b.empty || 'Kayıt yok') + '</div>' : '') +
        (b.rows.length > lim ? '<div class="small muted" style="padding:6px 2px">… ve ' + num(b.rows.length - lim) + ' satır daha · PDF ve Excel’de tamamı</div>' : '') +
        (b.note ? '<div class="note">' + h(b.note) + '</div>' : '');
    }
    return '';
  }
  function rpPreview(m) {
    var out = '', open = false;
    m.blocks.forEach(function (b) {
      if (!b || b.html === false) return;
      if (b.type === 'h') {
        if (open) out += '</div>';
        out += '<div class="card pad"><h2>' + h(b.text) + (b.sub ? ' <span class="small muted" style="font-weight:500">· ' + h(b.sub) + '</span>' : '') + '</h2>';
        open = true; return;
      }
      if (b.type === 'note' && !open) { out += '<div class="note" style="margin:4px 6px 10px">' + h(b.text) + '</div>'; return; }
      out += rpBlockHtml(b);
    });
    if (open) out += '</div>';
    return out;
  }
  function scrRaporlar() {
    var r = rpDonem(), m = null, err = null;
    try { m = rpModel(); } catch (e) { console.error(e); err = e; }
    var opt = function (v, ad, sel) { return '<option value="' + h(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + h(ad) + '</option>'; };
    var html = '<div class="page flush">' + groupSeg('dashboard', '/dash/raporlar') +
      '<div class="sec-title">Rapor</div><div class="card rpturler">' + RP.TURLER.map(function (t) {
        return '<button class="rptur' + (ui.rpTur === t[0] ? ' on' : '') + '" data-act="rpTur" data-v="' + t[0] + '"><span class="dot"></span><span class="grow"><b>' + h(t[1]) + '</b><span>' + h(t[2]) + '</span></span></button>';
      }).join('') + '</div>' +
      '<div class="sec-title">Tarih aralığı</div><div class="card pad"><div class="chips">' + RP.HAZIR.map(function (z) {
        return '<button class="chip' + (ui.rpHz === z[0] ? ' on' : '') + '" data-act="rpHz" data-v="' + z[0] + '">' + h(z[1]) + '</button>';
      }).join('') + '</div>' +
      (ui.rpHz === 'tumu' ? '<div class="small muted" style="margin-top:10px">Uygulamadaki bütün kayıtlar raporlanır.</div>' :
        '<div class="grid2" style="margin-top:10px"><div class="field" style="margin:0"><label>Başlangıç</label><input class="inp" type="date" data-ui="rpBas" data-type="date" value="' + DT.iso(r.from) + '"></div>' +
        '<div class="field" style="margin:0"><label>Bitiş</label><input class="inp" type="date" data-ui="rpBit" data-type="date" value="' + DT.iso(r.to) + '"></div></div>') +
      '<div class="rpdonem"><b>' + h(RP.donemAd(r.from, r.to)) + '</b>' + (r.from != null ? ' · ' + (r.to - r.from + 1) + ' gün' : '') + '</div></div>';
    if (ui.rpTur === 'donor') {
      html += '<div class="sec-title">Süzgeç</div><div class="card pad"><div class="grid2">' +
        '<div class="field"><label>Durum</label><select class="inp" data-ui="rpDurum">' + RP.DONOR_DURUM.map(function (z) { return opt(z[0], z[1], ui.rpDurum); }).join('') + '</select></div>' +
        '<div class="field"><label>Tarih ölçütü</label><select class="inp" data-ui="rpOlcut">' + RP.OLCUT.map(function (z) { return opt(z[0], z[1], ui.rpOlcut); }).join('') + '</select></div>' +
        '<div class="field" style="margin:0"><label>Hastane</label><select class="inp" data-ui="rpHast">' + opt('', 'Tümü', ui.rpHast) + state.lists.hastane.map(function (e) { return opt(e.ad, e.ad, ui.rpHast); }).join('') + '</select></div>' +
        '<div class="field" style="margin:0"><label>Yöntem</label><select class="inp" data-ui="rpYon">' + opt('', 'Tümü', ui.rpYon) + (state.lists.yontem || []).map(function (y) { return opt(y, y, ui.rpYon); }).join('') + '</select></div></div></div>';
    }
    if (m && m.ayrinti) {
      html += '<label class="opt rpayr"><input type="checkbox" data-act-change="rpAyr"' + (rpAyrinti() ? ' checked' : '') + '><span>' + h(m.ayrinti.ad) + ' PDF’te de olsun<div class="s">' +
        num(m.ayrinti.n) + ' satır' + (m.ayrinti.n > 300 ? ' · uzun bir liste, PDF çok sayfa olur' : '') + '. Excel’de her zaman vardır.</div></span></label>';
    }
    html += '<div class="btns rpgo"><button class="btn pri" data-act="rpUret" data-v="pdf"' + (m ? '' : ' disabled') + '>' + I.doc + 'PDF oluştur</button>' +
      '<button class="btn xls" data-act="rpUret" data-v="xlsx"' + (m ? '' : ' disabled') + '>' + I.down + 'Excel oluştur</button></div>';
    if (err) html += '<div class="card pad"><b>Rapor hazırlanamadı.</b><div class="small muted">' + h(err.message) + '</div></div>';
    if (m) {
      html += '<div class="sec-title">Önizleme · ' + h(m.title) + ' · ' + h(m.period) + '</div>' +
        (m.info.length > 1 ? '<div class="note" style="margin:-2px 6px 8px">' + m.info.slice(1).map(h).join('<br>') + '</div>' : '') + rpPreview(m);
    }
    return { title: 'Raporlar', html: html + '</div>' };
  }
  var rpSonuc = null;
  function rpUret(bicim) {
    busy(true, (bicim === 'pdf' ? 'PDF' : 'Excel') + ' hazırlanıyor…');
    setTimeout(function () {
      var m;
      try { m = rpModel(); } catch (e) { busy(false); toast('Rapor hazırlanamadı: ' + e.message); return; }
      (bicim === 'pdf' ? RP.toPdf(m) : RP.toXlsxZ(m)).then(function (bytes) {
        busy(false);
        rpSonuc = { m: m, bytes: bytes, bicim: bicim, name: m.dosya + (bicim === 'pdf' ? '.pdf' : '.xlsx'), mime: bicim === 'pdf' ? 'application/pdf' : XLSX_MIME };
        rpSheet();
      }).catch(function (e) { busy(false); console.error(e); toast('Rapor hazırlanamadı: ' + (e && e.message)); });
    }, 40);
  }
  function rpSheet() {
    var r = rpSonuc, kb = r.bytes.length < 1048576 ? Math.max(1, Math.round(r.bytes.length / 1024)) + ' KB' : (r.bytes.length / 1048576).toFixed(1).replace('.', ',') + ' MB';
    var sayfa = r.bicim === 'pdf' && r.m.sayfa ? ' · ' + r.m.sayfa + ' sayfa' : '';
    openSheet('<h3>' + h(r.m.title) + ' hazır</h3><div class="sub">' + h(r.m.period) + ' · ' + (r.bicim === 'pdf' ? 'PDF' : 'Excel') + sayfa + ' · ' + kb + '</div>' +
      '<div class="small muted" style="margin:-4px 0 14px">' + h(r.m.ozet) + '</div>' +
      '<div class="btns" style="margin-bottom:8px"><button class="btn pri" data-act="rpSend" data-v="open">' + I.open + 'Aç</button><button class="btn" data-act="rpSend" data-v="save">' + I.down + 'Telefona kaydet</button></div>' +
      '<div class="btns" style="margin-bottom:8px"><button class="btn outlook" data-act="rpSend" data-v="email">' + I.mail + 'Outlook ile gönder</button><button class="btn wa" data-act="rpSend" data-v="whatsapp">' + I.wa + 'WhatsApp’ta gönder</button></div>' +
      '<button class="btn block" data-act="rpSend" data-v="share">' + I.share + 'Başka uygulamayla paylaş</button>');
  }

  /* ---------------- Ayarlar ---------------- */
  function scrSettings() {
    var prev = null; try { prev = localStorage.getItem(PREV); } catch (e) { /* yok */ }
    var size = 0; try { size = (localStorage.getItem(KEY) || '').length; } catch (e) { /* yok */ }
    var html = '<div class="page"><div class="sec-title">Veri</div><div class="card pad">' +
      '<div class="small muted" style="margin-bottom:12px">' + state.donors.length + ' donör · ' + Object.keys(state.overrides).length + ' personel ataması · ' + state.ekGorevler.length + ' ek görev · ' + state.ekKons.length + ' ek konsültasyon · ' + state.ajanda.length + ' ajanda notu · ' + Math.round(size / 1024) + ' KB. Veriler yalnızca bu telefonda saklanır; düzenli yedek alın.</div>' +
      '<button class="btn pri block" data-act="import" style="margin-bottom:8px">' + I.up + 'Excel’den içe aktar (.xlsx)</button>' +
      '<button class="btn block" data-act="exportXlsx" style="margin-bottom:8px">' + I.down + 'Excel’e aktar (Donör Kayıt)</button>' +
      '<button class="btn block" data-act="arsivAl" style="margin-bottom:8px">' + I.up + 'Excel’den yalnızca geçmiş kayıtları al</button>' +
      '<button class="btn block" data-act="hrImportPick" style="margin-bottom:8px">' + I.up + 'Excel’den donör harcamalarını al</button>' +
      '<button class="btn block" data-act="ykPick" style="margin-bottom:8px">' + I.up + 'Yemek kartı yükleme detayını al</button>' +
      '<button class="btn block" data-act="esPick" style="margin-bottom:8px">' + I.up + 'Eşleşme tablosunu Excel’den al</button>' +
      '<div class="btns" style="margin-bottom:8px"><button class="btn" data-act="backup">' + I.down + 'Yedek al</button><button class="btn" data-act="importJson">' + I.up + 'Yedekten yükle</button></div>' +
      (prev ? '<button class="btn ghost block" data-act="restorePrev">İçe aktarmadan önceki veriye dön</button>' : '') +
      '</div>' + tabloCard() + '<div class="sec-title">Listeler</div><div class="card pad"><div class="small muted" style="margin-bottom:10px">Personel, hastaneler, resmi tatiller, nakil merkezi anahtar kelimeleri ve programdaki yazılışlar.</div>' +
      '<button class="btn block" data-act="goto" data-h="/ayarlar/listeler">Listeleri düzenle</button></div>' +
      '<div class="sec-title">Nasıl çalışır?</div><div class="card pad small" style="line-height:1.55">' +
      'Toplama tarihi girilince aşı 4 gün önce (ONKOLOJİ’de 20 kg ve altı için 3 gün önce) başlar; kemik iliğinde aşı yoktur. Son izlem toplamadan 20 gün sonradır. ' +
      'Sağlık kontrolü, aşı (1.–4. gün; sabah-akşam hastanelerinde iki ayrı görev), toplama, ürün taşıma ve BİLKENT PEDİATRİ kemik iliği için hastane yatış görevleri kendiliğinden oluşur. ' +
      'Açıklamaya iptal, erteleme, red, vazgeç ya da hasta ex yazılan donör tüm plan ve listelerden çıkar. Görevlere kişi atamak için görevin yanındaki personel düğmesine dokunun.</div>' +
      '<div class="sec-title">Tehlikeli bölge</div><div class="card pad"><button class="btn danger block" data-act="wipe">Tüm verileri sil</button></div>' +
      '<div class="note right" style="margin:8px 6px">Donör Takip ' + h(NB && NB.appVersion ? NB.appVersion() : 'web') + '</div></div>';
    return { title: 'Ayarlar', back: true, html: html, tab: 'home' };
  }
  function scrLists() {
    var L = state.lists;
    var ta = function (name, label, lines, hint) {
      return '<div class="field"><label>' + label + '</label><textarea class="inp" name="' + name + '" rows="' + Math.min(10, Math.max(3, lines.length + 1)) + '">' + h(lines.join('\n')) + '</textarea>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
    };
    var html = '<div class="page flush">' + groupSeg('arsiv', '/ayarlar/listeler') + '<form id="lform"><div class="card pad">' +
      ta('personel', 'Personel', L.personel, 'Her satıra bir kişi. Çalışma Programı’ndaki sıra bu sıradır.') +
      ta('hastane', 'Hastane | Programdaki adı', L.hastane.map(function (e) { return e.ad + (e.prog ? ' | ' + e.prog : ''); }), 'ör. ONKOLOJİ | ONKOLOJİ HASTANESİ') +
      ta('yontem', 'Yöntem', L.yontem) + ta('ulasim', 'Ulaşım türü', L.ulasim) + ta('konaklama', 'Konaklama', L.konaklama) +
      ta('asiCift', 'Sabah-akşam aşı hastaneleri', L.asiCift, 'Bu hastanelerde aşı sabah ve akşam iki ayrı görev olur.') +
      ta('tatiller', 'Resmi tatiller (GG.AA.YYYY | Ad)', L.tatiller.slice().sort(function (a, b) { return a.tarih - b.tarih; }).map(function (t) { return DT.fmt(t.tarih) + ' | ' + t.ad; }), 'Adında “arife” geçen günler yarım gün sayılır (sabit satırlar yazılır).') +
      ta('tasAnahtar', 'Nakil merkezi anahtar kelimesi | Şehir', L.tasAnahtar.map(function (e) { return e.kelime + ' | ' + e.sehir; }), 'Ürün taşıma uyarısı için şehir. Listede en altta eşleşen kelime geçerlidir.') +
      ta('basAnahtar', 'Başlık anahtar kelimesi | Başlık', L.basAnahtar.map(function (e) { return e.kelime + ' | ' + e.baslik; }), 'Takvim ve programdaki “HASTANE-BAŞLIK” satırı için (ör. AVRUPA). Başlığı ANKARA olan merkezler nakil merkezi adıyla yazar.') +
      '<div class="formsec">Programdaki yazılışlar</div>' +
      DT.PROG_KEYS.map(function (k) { return '<div class="field"><label>' + h(k[1]) + '</label><input class="inp" name="prog_' + k[0] + '" value="' + h(L.prog[k[0]] || '') + '"></div>'; }).join('') +
      '</div><button class="btn pri block">Kaydet</button></form></div>';
    return {
      title: 'Listeler', back: true, html: html, tab: 'home', after: function () {
        $('#lform').addEventListener('submit', function (e) { e.preventDefault(); saveLists(e.target); });
      }
    };
  }
  function saveLists(f) {
    var lines = function (n) { return f[n].value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
    var pairs = function (n) { return lines(n).map(function (l) { var k = l.indexOf('|'); return k < 0 ? [l.trim(), ''] : [l.slice(0, k).trim(), l.slice(k + 1).trim()]; }); };
    var L = state.lists, bad = [];
    L.personel = lines('personel');
    L.hastane = pairs('hastane').map(function (p) { return { ad: p[0], prog: p[1] }; });
    L.yontem = lines('yontem'); L.ulasim = lines('ulasim'); L.konaklama = lines('konaklama'); L.asiCift = lines('asiCift');
    L.tatiller = pairs('tatiller').map(function (p) { var t = DT.parseDateText(p[0]); if (t == null) bad.push(p[0]); return { tarih: t, ad: p[1] }; }).filter(function (t) { return t.tarih != null; });
    L.tasAnahtar = pairs('tasAnahtar').map(function (p) { return { kelime: p[0], sehir: p[1] }; });
    L.basAnahtar = pairs('basAnahtar').map(function (p) { return { kelime: p[0], baslik: p[1] }; });
    DT.PROG_KEYS.forEach(function (k) { L.prog[k[0]] = f['prog_' + k[0]].value.trim(); });
    commit(false);
    toast(bad.length ? 'Kaydedildi · okunamayan tarih: ' + bad.slice(0, 3).join(', ') : 'Listeler kaydedildi');
  }

  /* ---------------- dosya, paylaşım ---------------- */
  function b64(u8) { var s = '', CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
  function saveFile(bytes, name, mime) {
    if (NB && NB.saveFile) { window.onNativeFileSaved = function (ok) { toast(ok ? 'Dosya kaydedildi' : 'Dosya kaydedilmedi'); }; NB.saveFile(b64(bytes), name, mime); return; }
    var url = URL.createObjectURL(new Blob([bytes], { type: mime })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function copyText(text) {
    if (NB && NB.copyText) { NB.copyText(text); toast('Panoya kopyalandı'); return; }
    var done = function () { toast('Panoya kopyalandı'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Kopyalanamadı'); } t.remove(); }
  }
  function shareText(text, wa) {
    if (NB) { if (wa && NB.shareWhatsApp) NB.shareWhatsApp(text); else NB.shareText(text); return; }
    if (wa) { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return; }
    if (navigator.share) navigator.share({ text: text }).catch(function () { /* iptal */ }); else copyText(text);
  }
  var fileMode = 'xlsx';
  function pickFile(mode) {
    fileMode = mode;
    var inp = $('#fileInput'); inp.value = '';
    inp.setAttribute('accept', mode === 'json' ? '.json,application/json' : mode === 'pdf' ? '.pdf,application/pdf' : '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    inp.click();
  }
  function onFile(file) {
    if (!file) return;
    var reader = new FileReader();
    busy(true, 'Dosya okunuyor…');
    reader.onload = function () { processBuffer(reader.result, file.name); };
    reader.onerror = function () { busy(false); toast('Dosya okunamadı'); };
    reader.readAsArrayBuffer(file);
  }
  function processBuffer(buf, fname) {
    var file = { name: fname || 'dosya' };
    (function () {
      var isJson = /\.json$/i.test(file.name) || fileMode === 'json' && !/\.xlsx$/i.test(file.name);
      var head = new Uint8Array(buf, 0, Math.min(5, buf.byteLength));
      if (/\.pdf$/i.test(file.name) || String.fromCharCode.apply(null, head) === '%PDF-') {
        PDFText.extract(buf).then(function (res) { busy(false); handlePdf(res, file.name); })
          .catch(function (e) { busy(false); console.error(e); toast('PDF okunamadı: ' + e.message); });
        return;
      }
      if (isJson) {
        busy(false);
        try {
          var s = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(buf))), esd = s.eslesme && s.eslesme.kayitlar ? s.eslesme : null;
          delete s.eslesme; s = migrate(s);
          if (!Array.isArray(s.donors)) throw new Error('Yedek dosyası tanınmadı');
          confirmSheet('Yedekten yükle', s.donors.length + ' donör ve ' + Object.keys(s.overrides).length + ' personel ataması' + (esd ? ', ' + esd.kayitlar.length + ' eşleşme kaydı' : '') + ' yüklenecek. Telefondaki mevcut veriler (' + state.donors.length + ' donör) bunlarla değiştirilecek.', 'Yükle', false, function () {
            if (esd) { esData = esd; esDegisti(); }
            replaceState(s, 'Yedek yüklendi');
          });
        } catch (e) { toast('Yedek okunamadı: ' + e.message); }
        return;
      }
      if (fileMode === 'arsiv') { busy(false); arsivYukle(buf, file.name); return; }
      if (fileMode === 'harcama') { busy(false); hrImport(buf, file.name); return; }
      if (fileMode === 'yemek') { busy(false); ykImport(buf, file.name); return; }
      if (fileMode === 'eslesme') { busy(false); esImport(buf, file.name); return; }
      if (fileMode === 'sablon') {
        XLSXTablo.check(buf).then(function () { return saveTemplate(buf, file.name); })
          .then(function () { busy(false); render(true); toast('Excel şablonu kaydedildi'); })
          .catch(function (e) { busy(false); toast(e.message); });
        return;
      }
      setTimeout(function () {
        YK.detect(buf).then(function (yk) {
          if (yk) { busy(false); ykImport(buf, file.name); return null; }
          return XLSXIO.openWorkbook(buf).then(function (wb) {
            // Eşleşme tablosu (ANA TABLO) mı?
            if (wb.sheetNames.indexOf('ANA TABLO') >= 0 && wb.sheetNames.indexOf('Donör Kayıt') < 0) { busy(false); esImport(buf, file.name); return null; }
            return XLSXIO.importWorkbook(buf, window.DT_DEFAULT_LISTS);
          });
        }).then(function (res) {
          if (!res) return;
          busy(false);
          var r = res.report;
          confirmSheet('Excel’den içe aktar', file.name + '\n\n' + r.donors + ' donör · ' + r.overrides + ' personel ataması · ' + r.ekGorevler + ' ek görev · ' + (r.ekKons || 0) + ' ek konsültasyon · ' + (r.ajanda || 0) + ' ajanda notu · ' + (r.gorevKayit || 0) + ' görev kaydı · ' + (r.tasimaKayit || 0) + ' taşıma kaydı' + (r.lists ? ' · listeler' : '') +
            '\n\nTelefondaki mevcut veriler (' + state.donors.length + ' donör) bunlarla değiştirilecek. Önceki veri saklanır; Ayarlar’dan geri dönebilirsiniz.', 'İçe aktar', false, function () { replaceState(res.state, r.donors + ' donör aktarıldı'); saveTemplate(buf, file.name).then(function () { render(true); }, function () { /* şablon saklanamadı */ }); });
        }).catch(function (e) { busy(false); console.error(e); toast('İçe aktarılamadı: ' + e.message); });
      }, 30);
    })();
  }
  // Outlook vb. uygulamalardan "Paylaş" ile gelen dosya (Android tarafı /paylasilan/ adresinden sunar)
  window.receiveSharedFile = function (name, mime) {
    busy(true, 'Dosya alınıyor…');
    fetch('/paylasilan/' + encodeURIComponent(name || 'dosya')).then(function (r) {
      if (!r.ok) throw new Error('dosya açılamadı');
      return r.arrayBuffer();
    }).then(function (buf) {
      var nm = name || 'dosya';
      if (!/\.(pdf|xlsx|xlsm|json)$/i.test(nm)) nm += /pdf/.test(mime) ? '.pdf' : /json/.test(mime) ? '.json' : '.xlsx';
      fileMode = /\.json$/i.test(nm) ? 'json' : 'xlsx';
      processBuffer(buf, nm);
    }).catch(function (e) { busy(false); toast('Paylaşılan dosya okunamadı: ' + e.message); });
  };
  function emailText(subject, text) {
    if (NB && NB.shareEmail) { NB.shareEmail(subject, text); return; }
    location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
  }
  function emailFile(bytes, name, mime, subject, text) {
    if (NB && NB.shareFile) { NB.shareFile(b64(bytes), name, mime, subject, text); return; }
    try {
      var f = new File([bytes], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: subject, text: text }).catch(function () {}); return; }
    } catch (e) { /* desteklenmiyor */ }
    saveFile(bytes, name, mime);
  }
  /* ---- WhatsApp'ta güncel tablo: kullanıcının Excel'i (şablon) + güncel veriler ---- */
  var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var IDB = {
    db: null,
    open: function () {
      if (IDB.db) return Promise.resolve(IDB.db);
      return new Promise(function (res, rej) {
        if (!window.indexedDB) { rej(new Error('Telefonda dosya deposu yok')); return; }
        var r = indexedDB.open('donorTakip', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('dosya'); };
        r.onsuccess = function () { IDB.db = r.result; res(r.result); };
        r.onerror = function () { rej(r.error || new Error('Depo açılamadı')); };
      });
    },
    put: function (k, v) {
      return IDB.open().then(function (db) {
        return new Promise(function (res, rej) {
          var tx = db.transaction('dosya', 'readwrite'); tx.objectStore('dosya').put(v, k);
          tx.oncomplete = function () { res(); }; tx.onerror = tx.onabort = function () { rej(tx.error || new Error('Kaydedilemedi')); };
        });
      });
    },
    get: function (k) {
      return IDB.open().then(function (db) {
        return new Promise(function (res, rej) {
          var q = db.transaction('dosya', 'readonly').objectStore('dosya').get(k);
          q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); };
        });
      });
    }
  };
  function saveTemplate(buf, name) {
    return IDB.put('sablon', { ad: name, buf: buf, tarih: Date.now() }).then(function () {
      state.settings.sablon = { ad: name, tarih: Date.now(), boyut: buf.byteLength };
      save();
    });
  }
  function tabloAyar() { return state.settings.tablo || { on: false, saat: '08:30', tel: '', gun: 'haftaici', oto: false, sohbet: '' }; }
  function syncReminder() {
    if (!NB || !NB.hatirlatmaKur) return;
    var t = tabloAyar(), m = /^(\d{1,2}):(\d{2})$/.exec(t.saat || '08:30') || [0, 8, 30];
    var tatil = (state.lists.tatiller || []).map(function (x) { return DT.iso(x.tarih); }).join(',');
    try {
      NB.hatirlatmaKur(JSON.stringify({ on: !!t.on, saat: +m[1], dakika: +m[2], tatil: tatil, hergun: t.gun === 'hergun', oto: !!t.oto, sohbet: S(t.sohbet).trim() }));
    } catch (e) { console.error(e); }
  }
  // Telefonun durumu: bildirim izni, tam saat alarmı, pil kısıtlaması, otomatik gönderme hizmeti, son çalışma
  function hDurum() {
    if (!NB || !NB.hatirlatmaDurum) return null;
    try { return JSON.parse(NB.hatirlatmaDurum()); } catch (e) { return null; }
  }
  var GUN_AD = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  function msYazi(ms) {
    var d = new Date(ms), p2 = function (n) { return ('0' + n).slice(-2); };
    return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + GUN_AD[d.getDay()] + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function tbDurumHtml() {
    var t = tabloAyar(), d = hDurum();
    if (!d) return '<div class="hint">Durum bilgisi yalnızca Android uygulamasında görünür.</div>';
    var satir = function (ok, ad, alt, ne, dugme) {
      return '<div class="tbd"><span class="ic ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '!') + '</span><div class="l">' + ad + (alt ? '<div class="s">' + alt + '</div>' : '') + '</div>' +
        (ok || !ne ? '' : '<button class="btn sm" data-act="tbAyar" data-ne="' + ne + '">' + dugme + '</button>') + '</div>';
    };
    var html = satir(d.bildirim, 'Bildirim izni', d.bildirim ? '' : 'Kapalıysa hatırlatma görünmez', 'bildirim', 'Aç') +
      satir(d.tamAlarm, 'Tam saatinde çalışma', d.tamAlarm ? '' : 'İzin yoksa telefon gönderimi geciktirebilir', 'alarm', 'İzin ver') +
      satir(d.pil, 'Pil kısıtlaması yok', d.pil ? '' : 'Pil tasarrufu uygulamayı uyutup saati kaçırabilir', 'pil', 'Kaldır');
    if (t.oto) {
      html += satir(d.erisim, 'Otomatik gönderme hizmeti', d.erisim ? 'Erişilebilirlik › Donör Takip – tablo gönderme: açık' :
        'Erişilebilirlik › Yüklenen uygulamalar › “Donör Takip – tablo gönderme”yi açın', 'erisim', 'Aç');
      if (!d.erisim && d.sdk >= 33) html += '<div class="hint" style="margin:2px 2px 8px">Açılmıyorsa ya da “Kısıtlanmış ayar” derse: Uygulama bilgileri › sağ üstte ⋮ › <b>Kısıtlanmış ayarlara izin ver</b>, sonra yeniden “Aç”.</div>' +
        '<button class="btn sm" data-act="tbAyar" data-ne="uygulama" style="margin:0 0 8px">Uygulama bilgileri</button>';
    }
    html += '<div class="calc small" style="margin-top:10px">' +
      '<div><b>Sonraki:</b> ' + (t.on && d.sonraki ? msYazi(d.sonraki) : 'kapalı') + '</div>' +
      '<div><b>Son çalışma:</b> ' + (d.son ? msYazi(d.son) + (d.sonSonuc ? ' · ' + h(d.sonSonuc) : '') : 'henüz yok') + '</div></div>';
    return html;
  }
  function tabloGonder(target) {
    busy(true, 'Güncel tablo hazırlanıyor…');
    setTimeout(function () {
      IDB.get('sablon').then(function (t) {
        if (!t || !t.buf) throw new Error('SABLON_YOK');
        return XLSXTablo.build(t.buf, state, D, pool, today).then(function (r) { r.name = XLSXTablo.fileName(t.ad, today); return r; });
      }).then(function (r) {
        var act = D.filter(function (x) { return !x.stopped && x.d.top != null && x.d.top >= today; }).length;
        var bugun = DT.calendarTasks(pool, D, today, today + 1, '').length;
        var cap = 'Donör Takip · güncel tablo · ' + DT.fmt(today) + ' ' + gunAd(today) + '\n' + state.donors.length + ' donör · süreçte ' + act + ' · bugün ' + bugun + ' görev';
        sendBigFile(r.bytes, r.name, XLSX_MIME, target, cap);
        if (r.warn.length) toast(r.warn[0]);
      }).catch(function (e) {
        busy(false);
        if (e && e.message === 'SABLON_YOK') {
          confirmSheet('Excel tablonuzu bir kez seçin', 'Güncel tablo, sizin Excel dosyanızın aynısı olarak hazırlanır. Telefondaki Donör Takip Excel’ini seçin; uygulamadaki veriler değişmez.', 'Excel’i seç', false, function () { pickFile('sablon'); });
          return;
        }
        console.error(e); toast('Tablo hazırlanamadı: ' + (e && e.message));
      });
    }, 60);
  }
  // Büyük dosya: Android'e parça parça aktarılır (WhatsApp, e-posta ya da kaydet)
  // opt: { label: 'Tablo' | 'Rapor', subject: e-posta konusu, phone: WhatsApp numarası (verilmezse tablo ayarındaki) }
  function sendBigFile(bytes, name, mime, target, text, opt) {
    opt = opt || {};
    var label = opt.label || 'Tablo';
    if (NB && NB.fileBegin) {
      var CH = 3 * 256 * 1024, i = 0;
      if (!NB.fileBegin(name)) { busy(false); toast('Dosya hazırlanamadı'); return; }
      var step = function () {
        if (i >= bytes.length) {
          busy(false);
          if (target === 'save') window.onNativeFileSaved = function (ok) { toast(ok ? label + ' kaydedildi' : label + ' kaydedilmedi'); };
          NB.fileFinish(target, mime, opt.subject != null ? opt.subject : name.replace(/\.xlsx$/i, ''), text, opt.phone != null ? opt.phone : S(tabloAyar().tel));
          return;
        }
        busy(true, label + ' hazırlanıyor… %' + Math.round(i * 100 / bytes.length));
        if (!NB.fileAppend(b64(bytes.subarray(i, i + CH)))) { busy(false); toast('Dosya yazılamadı'); return; }
        i += CH; setTimeout(step, 0);
      };
      step();
      return;
    }
    busy(false);
    if (target === 'save') { saveFile(bytes, name, mime); return; }
    if (target === 'open') { var u = URL.createObjectURL(new Blob([bytes], { type: mime })); window.open(u, '_blank'); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); return; }
    emailFile(bytes, name, mime, opt.subject || name, text);
  }
  window.onNativeAction = function (a) {
    if (DT.today() !== today) { recompute(); render(true); }
    if (a === 'tabloGonder') tabloGonder('whatsapp');
    else if (a === 'otoGonder') tabloGonder('whatsappOto');
  };
  window.onNativeResume = function () { var el = $('#tbDurum'); if (el) el.innerHTML = tbDurumHtml(); };
  window.onNotifPermission = function (ok) { if (!ok) toast('Bildirim izni verilmedi; hatırlatma görünmez. Telefon ayarlarından Donör Takip’e bildirim izni verin.'); };
  function tabloAyarKaydet(sessiz) {
    var on = $('#tbOn').checked, saat = $('#tbSaat').value || '08:30', tel = $('#tbTel').value.trim(), gun = $('#tbGun').value === 'hergun' ? 'hergun' : 'haftaici';
    var oto = $('#tbOto').checked, sohbet = $('#tbSohbet').value.replace(/\s+/g, ' ').trim();
    if (!/^\d{1,2}:\d{2}$/.test(saat)) { toast('Saat seçin'); return false; }
    if (oto && !tel.replace(/\D/g, '') && !sohbet) { toast('Otomatik gönderme için numara ya da sohbet / grup adı yazın'); return false; }
    state.settings.tablo = { on: on, saat: saat, tel: tel, gun: gun, oto: oto, sohbet: sohbet };
    save(); syncReminder();
    var el = $('#tbDurum'); if (el) el.innerHTML = tbDurumHtml();
    if (sessiz) return true;
    if (on && !state.settings.sablon) toast('Kuruldu. Excel şablonunu da seçin.');
    else toast(on ? (oto ? 'Otomatik gönderim kuruldu: ' : 'Hatırlatma kuruldu: ') + (gun === 'hergun' ? 'her gün ' : 'hafta içi ') + saat : 'Günlük gönderim kapalı');
    if (on && !NB) toast('Günlük gönderim yalnızca Android uygulamasında çalışır');
    var d = hDurum();
    if (on && oto && d && !d.erisim) setTimeout(function () { toast('Otomatik gönderme hizmetini açın: aşağıdaki “Aç” düğmesi'); }, 1600);
    return true;
  }
  function tabloCard() {
    var t = tabloAyar(), sb = state.settings.sablon;
    var mb = function (n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; };
    return '<div class="sec-title">WhatsApp’ta güncel tablo</div><div class="card pad">' +
      '<div class="small muted" style="margin-bottom:10px">Excel tablonuzun aynısı (bütün sayfalar, formüller, resim) uygulamadaki güncel bilgilerle hazırlanır ve WhatsApp’ta gönderilir.</div>' +
      '<div class="calc small" style="margin-bottom:10px">' + (sb ? '<b>Excel şablonu:</b> ' + h(sb.ad) + (sb.boyut ? ' · ' + mb(sb.boyut) : '') + (sb.tarih ? ' · ' + (function (dt) { return ('0' + dt.getDate()).slice(-2) + '.' + ('0' + (dt.getMonth() + 1)).slice(-2) + '.' + dt.getFullYear(); })(new Date(sb.tarih)) : '') : '<b>Excel şablonu yok.</b> Excel’den içe aktardığınızda kendiliğinden saklanır; ya da aşağıdan bir kez seçin.') + '</div>' +
      '<button class="btn block" data-act="tabloSablon" style="margin-bottom:12px">' + I.up + (sb ? 'Excel şablonunu değiştir' : 'Excel şablonunu seç') + '</button>' +
      '<label class="opt" style="padding:6px 2px"><input type="checkbox" id="tbOn"' + (t.on ? ' checked' : '') + '><span>Her gün seçilen saatte<div class="s">Saat gelince tablo hazırlanır ve WhatsApp açılır.</div></span></label>' +
      '<div class="row" style="gap:8px;margin:6px 0 10px"><div class="field grow" style="margin:0"><label>Günler</label><select class="inp" id="tbGun"><option value="haftaici"' + (t.gun !== 'hergun' ? ' selected' : '') + '>Hafta içi (tatiller hariç)</option><option value="hergun"' + (t.gun === 'hergun' ? ' selected' : '') + '>Her gün</option></select></div>' +
      '<div class="field" style="margin:0;width:132px"><label>Saat</label><input class="inp" type="time" id="tbSaat" value="' + h(t.saat || '08:30') + '"></div></div>' +
      '<label class="opt" style="padding:6px 2px"><input type="checkbox" id="tbOto"' + (t.oto ? ' checked' : '') + '><span>Otomatik gönder<div class="s">Gönder’e uygulama basar. Telefon açıksa saatinde, kilitliyse kilidi açınca gönderilir. Kapalıysa bildirim gelir; dokununca WhatsApp açılır, Gönder’e siz basarsınız.</div></span></label>' +
      '<div class="field" style="margin:6px 0 8px"><label>WhatsApp numarası (kişiye)</label><input class="inp" type="tel" id="tbTel" value="' + h(t.tel || '') + '" placeholder="05xx… · kendi numaranız = kendinize"></div>' +
      '<div class="field" style="margin:0 0 4px"><label>ya da sohbet / grup adı</label><input class="inp" id="tbSohbet" value="' + h(t.sohbet || '') + '" placeholder="WhatsApp’taki adıyla, birebir"></div>' +
      '<div class="hint" style="margin:0 2px 10px">Numara yazarsanız WhatsApp doğrudan o kişinin sohbetinde açılır. Gruba göndermek için numarayı boş bırakıp grubun adını WhatsApp’ta göründüğü gibi yazın; grup son sohbetlerde olmalı.</div>' +
      '<button class="btn pri block" data-act="tabloKaydet" style="margin-bottom:10px">Kaydet</button>' +
      '<div id="tbDurum">' + tbDurumHtml() + '</div>' +
      (NB && NB.hatirlatmaDene ? '<button class="btn block" data-act="tabloDene" style="margin:10px 0 8px">Dene: 1 dakika sonra çalıştır</button>' : '') +
      '<div class="btns"><button class="btn wa" data-act="tabloWa">' + I.wa + 'Şimdi gönder</button><button class="btn" data-act="tabloSave">' + I.down + 'Telefona kaydet</button></div></div>';
  }
  function replaceState(s, msg) {
    try { if (state.donors.length) localStorage.setItem(PREV, JSON.stringify(state)); } catch (e) { /* yer yoksa geç */ }
    // telefona özgü ayarlar (tablo şablonu, WhatsApp hatırlatması) korunur
    s.settings = s.settings || {};
    if (state.settings && state.settings.tablo && !s.settings.tablo) s.settings.tablo = state.settings.tablo;
    if (state.settings && state.settings.sablon && !s.settings.sablon) s.settings.sablon = state.settings.sablon;
    // Excel'den içe aktarmada harcamalar korunur; donör kimlikleri yeni kayıtlara yeniden bağlanır
    if ((!s.harcama || !s.harcama.length) && state.harcama && state.harcama.length) {
      s.harcama = HR.relink(state.harcama, state.donors, s.donors || []);
      s.ilEslesme = Object.assign({}, state.ilEslesme || {}, s.ilEslesme || {});
    }
    if ((!s.yemekKart || !s.yemekKart.length) && state.yemekKart && state.yemekKart.length) s.yemekKart = HR.relink(state.yemekKart, state.donors, s.donors || []);
    s = migrate(s);
    state = s; save(); recompute(); ui.calY = null; ui.calSel = null; ui.progDate = null;
    go('/', true); render(); toast(msg);
  }
  function stamp() { return DT.iso(today); }

  /* ---------------- olaylar ---------------- */
  var ACT = {
    goto: function (el) { go(el.dataset.h, !!el.dataset.replace); },
    back: function () { history.back(); },
    closeSheet: function () { closeSheet(); },
    donor: function (el) { go('/donor/' + el.dataset.id); },
    newDonor: function () { go('/donor/yeni'); },
    editDonor: function (el) { go('/donor/' + el.dataset.id + '/duzenle'); },
    delDonor: function (el) {
      var x = byId[el.dataset.id]; if (!x) return;
      confirmSheet('Kaydı sil', (x.d.ad || x.d.hk) + ' kaydı ve görev atamaları silinecek.', 'Sil', true, function () {
        state.donors = state.donors.filter(function (d) { return d.id !== x.d.id; });
        Object.keys(state.overrides).forEach(function (k) { if (k.indexOf(x.d.id + '|') === 0) delete state.overrides[k]; });
        save(); recompute(); toast('Kayıt silindi'); history.back();
      });
    },
    copyDonor: function (el) { var x = byId[el.dataset.id]; if (x) copyText(DT.donorLine(state.lists, x)); },
    pick: function (el) { pickPersonnel(el.dataset.id, el.dataset.slots.split(',').map(Number)); },
    dfilter: function (el) { ui.dfilter = el.dataset.v; ui.dlimit = 60; render(true); },
    more: function () { ui.dlimit += 100; render(true); },
    kontrolList: function () { ui.dfilter = 'kontrol'; ui.search = ''; go('/donorler'); },
    calMove: function (el) { var m = ui.calM + (+el.dataset.v), y = ui.calY; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ui.calM = m; ui.calY = y; render(true); },
    calDay: function (el) { ui.calSel = +el.dataset.v; var p = DT.parts(ui.calSel); if (p.m !== ui.calM) { ui.calM = p.m; ui.calY = p.y; } render(true); },
    calToday: function () { var p = DT.parts(today); ui.calY = p.y; ui.calM = p.m; ui.calSel = today; if (route()[1] === 'takvim') render(true); else go('/plan/takvim'); },
    progFor: function (el) { ui.progDate = +el.dataset.v; go('/plan/program', true); },
    progMove: function (el) { ui.progDate = (ui.progDate || today + 1) + (+el.dataset.v); render(true); },
    progSet: function (el) { ui.progDate = +el.dataset.v; render(true); },
    mailProg: function () {
      var p = DT.parts(ui.progDate);
      emailText(('0' + p.d).slice(-2) + '.' + ('0' + p.m).slice(-2) + '.' + p.y + ' Çalışma Programı', DT.program(state, D, pool, ui.progDate).text);
    },
    mailRapor: function () {
      busy(true, 'Rapor hazırlanıyor…');
      setTimeout(function () {
        try {
          var rows = raporRows(), yap = rows.filter(function (x) { return x.durum === 'Toplama yapıldı'; }).length, dur = rows.filter(function (x) { return x.stopped; }).length;
          emailFile(XLSXIO.exportReport(state, D, today, rows), 'Donor_Raporu_' + stamp() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Donör Raporu · ' + DT.fmt(today),
            'Merhaba,\n\nDonör Raporu ektedir (' + DT.fmt(today) + ').\n' + rows.length + ' donör · Toplama yapıldı: ' + yap + ' · Devam eden: ' + (rows.length - yap - dur) + ' · Süreç durdu: ' + dur + '\n\nİyi çalışmalar.');
        } catch (e) { toast('Hata: ' + e.message); }
        busy(false);
      }, 30);
    },
    copyProg: function () { copyText(DT.program(state, D, pool, ui.progDate).text); },
    shareProg: function (el) { shareText(DT.program(state, D, pool, ui.progDate).text, !!el.dataset.wa); },
    shareTomorrow: function () { shareText(DT.program(state, D, pool, today + 1).text, true); },
    ekNew: function (el) { if (el.dataset.v) ui.progDate = +el.dataset.v; ekForm(null); },
    ekEdit: function (el) { var e = state.ekGorevler.find(function (z) { return z.id === el.dataset.id; }); if (e) ekForm(e); },
    soon: function () { toast('Bu sayfa sonraki sürümde eklenecek'); },
    pnNew: function (el) { pnForm(null, +el.dataset.v); },
    pnEdit: function (el) { var n = state.planNotlar.find(function (z) { return z.id === el.dataset.id; }); if (n) pnForm(n); },
    kpStart: function () { state.kapanis.kesim = DT.weekStart(today); commit(); },
    kpWeek: function (el) { ui.weekStart = +el.dataset.v; go('/plan/haftalik'); },
    kpClose: function () {
      var w = DT.pendingWeeks(state, today)[0]; if (!w) return;
      var lr = DT.liveRecords(state, D, pool, w.bas, w.son);
      confirmSheet('Haftayı kapat', DT.fmt(w.bas) + ' – ' + DT.fmt(w.son) + ': ' + lr.rows.length + ' görev Görev Kayıtları’na yazılacak.' + (lr.eksik ? '\n' + lr.eksik + ' görevde personel seçilmediği için arşive girmeyecek.' : ''), 'Kapat', false, function () {
        lr.rows.forEach(function (r) { r.id = DT.uid(); r.hafta = DT.weekStart(w.bas); state.gorevKayit.push(r); });
        state.kapanis.kesim = w.son + 1; commit(); toast('Hafta kapatıldı');
      });
    },
    gkNew: function () { gkForm(null); },
    gkEdit: function (el) { var r = state.gorevKayit.find(function (z) { return z.id === el.dataset.id; }); if (r) gkForm(r); },
    gkMore: function () { ui.gkLimit = (ui.gkLimit || 100) + 300; render(true); },
    tkrMore: function () { ui.tkrLimit = (ui.tkrLimit || 100) + 300; render(true); },
    weekMove: function (el) { ui.weekStart = (ui.weekStart || DT.weekStart(today)) + (+el.dataset.v); render(true); },
    weekNow: function () { ui.weekStart = DT.weekStart(today); render(true); },
    ajMove: function (el) { ui.ajDate = (ui.ajDate || today) + (+el.dataset.v); render(true); },
    ajSet: function (el) { ui.ajDate = +el.dataset.v; render(true); },
    ajNew: function (el) { ajForm(null, el.dataset.saat); },
    ajEdit: function (el) { var a = state.ajanda.find(function (z) { return z.id === el.dataset.id; }); if (a) ajForm(a); },
    konsNew: function () { konsForm(null); },
    konsEdit: function (el) { var e = state.ekKons.find(function (z) { return z.id === el.dataset.id; }); if (e) konsForm(e); },
    rpF: function (el) { ui.rpF = el.dataset.v; ui.rpLimit = 80; render(true); },
    rpMore: function () { ui.rpLimit = (ui.rpLimit || 80) + 200; render(true); },
    exportRapor: function () {
      busy(true, 'Excel hazırlanıyor…');
      setTimeout(function () { try { saveFile(XLSXIO.exportReport(state, D, today, raporRows()), 'Donor_Raporu_' + stamp() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } catch (e) { toast('Hata: ' + e.message); } busy(false); }, 30);
    },
    import: function () { pickFile('xlsx'); },
    pdfPick: function () { pickFile('pdf'); },
    hrNew: function (el) { hrForm({ donor: el && el.dataset ? el.dataset.donor : null }); },
    hrEdit: function (el) { hrForm({ id: el.dataset.id }); },
    hrTab: function (el) { ui.hrTab = el.dataset.v; render(); },
    hrImportPick: function () { pickFile('harcama'); },
    ykPick: function () { pickFile('yemek'); },
    esPick: function () { pickFile('eslesme'); },
    esYeni: function () { go('/es/kayit/yeni'); },
    esF: function (el) { ui.esF = el.dataset.v; ui.esLim = 60; render(true); },
    esMore: function () { ui.esLim = (ui.esLim || 60) + 200; var l = $('#eslist'); if (l) l.innerHTML = esListeHtml(); },
    esBek: function (el) { ui.esBek = el.dataset.v; ui.esBLim = 100; render(true); },
    esBMore: function () { ui.esBLim = (ui.esBLim || 100) + 300; render(true); },
    esKAc: function (el) { ui.esKAc = ui.esKAc || {}; ui.esKAc[el.dataset.v] = 1; render(true); },
    esExcel: function () {
      busy(true, 'Excel hazırlanıyor…');
      setTimeout(function () {
        ES.exportXlsx(esData, today, state.lists.personel).then(function (b) { busy(false); saveFile(b, 'Eslesme_Tablosu_' + stamp() + '.xlsx', XLSX_MIME); }, function (e) { busy(false); toast('Hata: ' + e.message); });
      }, 30);
    },
    ykTab: function (el) { ui.ykTab = el.dataset.v; render(); },
    ykEdit: function (el) { ykForm(el.dataset.id); },
    ykExcel: function () {
      var P0 = ykDonem();
      busy(true, 'Excel hazırlanıyor…');
      setTimeout(function () {
        try {
          var m = RP.build({ state: state, D: D, pool: pool, hrows: hrows, yrows: yrows, today: today }, { tur: 'yemek', from: P0.from, to: P0.to, ayrinti: true });
          RP.toXlsxZ(m).then(function (b) { busy(false); saveFile(b, m.dosya + '.xlsx', XLSX_MIME); }, function (e) { busy(false); toast('Hata: ' + e.message); });
        } catch (e) { busy(false); toast('Hata: ' + e.message); }
      }, 30);
    },
    hrExport: function () {
      try { saveFile(HR.exportXlsx(state, D, hrows), 'Donor_Harcama_' + stamp() + '.xlsx', XLSX_MIME); } catch (e) { toast('Hata: ' + e.message); }
    },
    tabloSablon: function () { pickFile('sablon'); },
    arsivAl: function () {
      // Kayıtlı Excel şablonu varsa onu kullan, yoksa dosya seçtir
      IDB.get('sablon').then(function (t) { if (t && t.buf) arsivYukle(t.buf, t.ad); else pickFile('arsiv'); }, function () { pickFile('arsiv'); });
    },
    tabloWa: function () { tabloGonder('whatsapp'); },
    rpTur: function (el) { ui.rpTur = el.dataset.v; render(true); },
    rpHz: function (el) { ui.rpHz = el.dataset.v; var r = RP.hazir(ui.rpHz, today); ui.rpBas = r.from; ui.rpBit = r.to; render(true); },
    rpAc: function (el) { ui.rpTur = el.dataset.v || ui.rpTur; go('/dash/raporlar'); },
    rpUret: function (el) { rpUret(el.dataset.v); },
    rpSend: function (el) {
      var r = rpSonuc, t = el.dataset.v; if (!r) return;
      closeSheet();
      var konu = r.m.title + ' · ' + r.m.period;
      var metin = t === 'email' ? 'Merhaba,\n\n' + r.m.title + ' (' + r.m.period + ') ektedir.\n' + r.m.ozet + '\n\nİyi çalışmalar.' : t === 'whatsapp' || t === 'share' ? konu + '\n' + r.m.ozet : '';
      busy(true, 'Rapor hazırlanıyor…');
      setTimeout(function () { sendBigFile(r.bytes, r.name, r.mime, t, metin, { label: 'Rapor', subject: konu, phone: '' }); }, 30);
    },
    tabloSave: function () { tabloGonder('save'); },
    tabloKaydet: function () { tabloAyarKaydet(false); },
    tabloDene: function () {
      if (!tabloAyarKaydet(true)) return;
      NB.hatirlatmaDene();
      var t = tabloAyar();
      toast(t.oto ? 'Deneme 1 dakika sonra: tablo gerçekten gönderilir. Telefon kilitliyse kilidi açınca.' : 'Deneme 1 dakika sonra: bildirim gelecek');
      setTimeout(window.onNativeResume, 300);
    },
    tbAyar: function (el) { if (NB && NB.ayarAc) NB.ayarAc(el.dataset.ne); },
    mailDurum: function () { mailPasteSheet(); },
    durumNew: function (el) { durumSheet({ id: el.dataset.id }); },
    importJson: function () { pickFile('json'); },
    exportXlsx: function () {
      busy(true, 'Excel hazırlanıyor…');
      setTimeout(function () { try { saveFile(XLSXIO.exportDonors(state, D, today), 'Donor_Kayit_' + stamp() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } catch (e) { toast('Hata: ' + e.message); } busy(false); }, 30);
    },
    backup: function () { saveFile(new TextEncoder().encode(JSON.stringify(esData && esData.kayitlar.length ? Object.assign({}, state, { eslesme: esData }) : state)), 'DonorTakip_yedek_' + stamp() + '.json', 'application/json'); },
    restorePrev: function () {
      var p; try { p = JSON.parse(localStorage.getItem(PREV)); } catch (e) { p = null; }
      if (!p) { toast('Önceki veri yok'); return; }
      confirmSheet('Önceki veriye dön', 'Son içe aktarmadan önceki ' + (p.donors || []).length + ' donörlük veri geri yüklenecek.', 'Geri yükle', false, function () {
        var cur = state; state = migrate(p); try { localStorage.setItem(PREV, JSON.stringify(cur)); } catch (e) { /* geç */ } save(); recompute(); go('/', true); render(); toast('Önceki veri yüklendi');
      });
    },
    wipe: function () {
      confirmSheet('Tüm verileri sil', 'Bu telefondaki tüm donör kayıtları, atamalar ve listeler silinecek. Önce yedek almanızı öneririz.', 'Hepsini sil', true, function () {
        try { localStorage.setItem(PREV, JSON.stringify(state)); } catch (e) { /* geç */ }
        state = DT.newState(window.DT_DEFAULT_LISTS); save(); recompute(); go('/', true); render(); toast('Veriler silindi');
      });
    }
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var a = el.dataset.act;
    if (ACT[a]) { e.preventDefault(); e.stopPropagation(); ACT[a](el, e); }
  });
  var searchTimer;
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.ui === 'esAra') {
      ui.esAra = el.value; ui.esLim = 60;
      clearTimeout(searchTimer); searchTimer = setTimeout(function () { var l = $('#eslist'); if (l) l.innerHTML = esListeHtml(); }, 150);
      return;
    }
    if (el.dataset && el.dataset.ui === 'search') {
      ui.search = el.value; ui.dlimit = 60;
      clearTimeout(searchTimer); searchTimer = setTimeout(function () { var l = $('#dlist'); if (l) l.innerHTML = donorListHtml(); }, 120);
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.ui && el.dataset.ui !== 'search' && el.dataset.ui !== 'esAra') {
      var v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.type === 'date') { v = DT.fromIso(el.value); if (v == null) return; }
      ui[el.dataset.ui] = v;
      if (el.dataset.ui === 'rpBas' || el.dataset.ui === 'rpBit') { var r0 = rpDonem(); if (ui.rpHz !== 'ozel') { ui.rpBas = el.dataset.ui === 'rpBas' ? v : r0.from; ui.rpBit = el.dataset.ui === 'rpBit' ? v : r0.to; } ui.rpHz = 'ozel'; }
      render(true);
    } else if (el.dataset && el.dataset.actChange === 'esBas') {
      esData.bas = +el.value; esDegisti(); render(true);
    } else if (el.dataset && el.dataset.actChange === 'rpAyr') {
      ui.rpAyr[ui.rpTur] = el.checked; render(true);
    } else if (el.dataset && el.dataset.actChange === 'esik') {
      var n = parseInt(el.value, 10); if (n > 0) { state.settings.esik = n; commit(); }
    }
  });
  $('#fileInput').addEventListener('change', function (e) { onFile(e.target.files[0]); });
  $('#btnBack').addEventListener('click', function () { history.back(); });
  $('#btnBack').innerHTML = I.back;
  $('#tabs').innerHTML = '<div class="in">' + TABS.map(function (t) {
    return '<button data-tab="' + t[0] + '" data-h="' + t[1] + '"><span class="pill">' + t[3] + '</span>' + t[2] + '</button>';
  }).join('') + '</div>';
  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var cur = route()[0] || 'home';
    go(b.dataset.h, cur !== 'home');
  });
  window.addEventListener('hashchange', function (e) {
    var old = (e.oldURL || '').split('#')[1];
    if (old != null) ui.scroll['#' + old] = view.scrollTop;
    closeSheet();
    if (pdfPrefill && !/\/donor\/[^/]+(\/duzenle)?$/.test(location.hash)) pdfPrefill = null;
    render();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && DT.today() !== today) { recompute(); render(true); } });
  setInterval(function () { if (DT.today() !== today) { recompute(); render(true); } }, 60000);

  /* ---------------- Android köprüsü ---------------- */
  window.setInsets = function (top, bottom) {
    document.documentElement.style.setProperty('--sat', (top || 0) + 'px');
    document.documentElement.style.setProperty('--sab', (bottom || 0) + 'px');
  };
  window.handleBack = function () { return closeSheet(); };
  window.DTApp = { state: function () { return state; }, recompute: recompute, render: render, ui: ui };

  load(); recompute(); render();
  esYukle();
  setTimeout(syncReminder, 500);
})();
